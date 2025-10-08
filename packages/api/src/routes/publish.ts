/**
 * @fileoverview Publish Routes
 * Purpose: Video upload and multi-account publishing
 * Max lines: 250
 */

import { Router, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Configure multer for video upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de video no soportado. Use MP4, MOV o AVI.'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// POST /publish - Upload video and create publish jobs
router.post(
  '/',
  upload.single('video'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const file = req.file;

      if (!file) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Archivo de video requerido',
        });
        return;
      }

      // Parse request body
      const { caption, accountIds, scheduleTime } = req.body;

      if (!accountIds || accountIds.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Debe seleccionar al menos una cuenta',
        });
        return;
      }

      // Parse accountIds (can be JSON string or array)
      const parsedAccountIds =
        typeof accountIds === 'string' ? JSON.parse(accountIds) : accountIds;

      if (!Array.isArray(parsedAccountIds) || parsedAccountIds.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'accountIds debe ser un array con al menos un ID',
        });
        return;
      }

      // Verify all connections belong to user
      const connections = await prisma.tikTokConnection.findMany({
        where: {
          id: { in: parsedAccountIds },
          userId,
        },
      });

      if (connections.length !== parsedAccountIds.length) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Una o más cuentas no existen o no te pertenecen',
        });
        return;
      }

      // Calculate checksum
      const checksum = crypto
        .createHash('sha256')
        .update(file.buffer)
        .digest('hex');

      // Create video asset (mock storage URL for now)
      const videoAsset = await prisma.videoAsset.create({
        data: {
          userId,
          storageUrl: `/uploads/${userId}/${checksum}.${file.mimetype.split('/')[1]}`,
          originalFilename: file.originalname,
          sizeBytes: file.size,
          checksum,
          status: 'uploaded',
        },
      });

      // Create publish batch
      const scheduleTimeUtc = scheduleTime ? new Date(scheduleTime) : null;

      const batch = await prisma.publishBatch.create({
        data: {
          userId,
          videoAssetId: videoAsset.id,
          defaultsJson: {
            caption: caption || '',
            privacyStatus: 'public',
            allowDuet: true,
            allowStitch: true,
            allowComment: true,
          },
          scheduleTimeUtc,
        },
      });

      // Create publish jobs for each account
      const jobs = await Promise.all(
        connections.map((connection: { id: string }) =>
          prisma.publishJob.create({
            data: {
              batchId: batch.id,
              userId,
              tiktokConnectionId: connection.id,
              videoAssetId: videoAsset.id,
              caption: caption || '',
              hashtags: [],
              privacyStatus: 'public',
              allowDuet: true,
              allowStitch: true,
              allowComment: true,
              scheduleTimeUtc,
              state: scheduleTimeUtc ? 'scheduled' : 'queued',
              idempotencyKey: crypto.randomBytes(16).toString('hex'),
            },
          })
        )
      );

      // Create audit event
      await prisma.auditEvent.create({
        data: {
          userId,
          type: 'batch.created',
          detailsJson: {
            batchId: batch.id,
            videoAssetId: videoAsset.id,
            accountCount: connections.length,
            scheduled: !!scheduleTimeUtc,
          },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      res.status(201).json({
        message: `Video publicado en ${jobs.length} cuenta(s)`,
        batch: {
          id: batch.id,
          videoAssetId: videoAsset.id,
          jobCount: jobs.length,
          scheduleTime: scheduleTimeUtc,
        },
        jobs: jobs.map(
          (job: { id: string; tiktokConnectionId: string; state: string }) => ({
            id: job.id,
            connectionId: job.tiktokConnectionId,
            state: job.state,
          })
        ),
      });
    } catch (error) {
      console.error('Publish error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Error al publicar video',
      });
    }
  }
);

// GET /publish/jobs - Get user's publish jobs (history)
router.get('/jobs', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { state, limit = '50' } = req.query;

    interface WhereClause {
      userId: string;
      state?: string;
    }

    const whereClause: WhereClause = { userId };

    if (state && typeof state === 'string') {
      whereClause.state = state;
    }

    const jobs = await prisma.publishJob.findMany({
      where: whereClause,
      include: {
        tiktokConnection: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
        videoAsset: {
          select: {
            originalFilename: true,
            sizeBytes: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    res.json({ jobs });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener trabajos',
    });
  }
});

// GET /publish/jobs/:id - Get specific job details
router.get('/jobs/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const jobId = req.params.id;

    const job = await prisma.publishJob.findFirst({
      where: { id: jobId, userId },
      include: {
        tiktokConnection: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
        videoAsset: {
          select: {
            originalFilename: true,
            sizeBytes: true,
            storageUrl: true,
          },
        },
      },
    });

    if (!job) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Trabajo no encontrado',
      });
      return;
    }

    res.json({ job });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener trabajo',
    });
  }
});

export default router;
