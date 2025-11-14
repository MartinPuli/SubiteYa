/**
 * @fileoverview Publish Routes
 * Purpose: Video upload and multi-account publishing using TikTok Content Posting API
 * Max lines: 400
 */

import { Router, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { applyBrandPattern } from '../lib/video-processor';
import { uploadToS3 } from '../lib/storage';
import { queueEditJob } from '../lib/qstash-client';
import { VideoStatus } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const router = Router();

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Helper to cleanup files even if request is aborted
async function safeCleanup(filePaths: string[]) {
  for (const filePath of filePaths) {
    try {
      await unlink(filePath);
      console.log(`✓ Cleaned up: ${filePath}`);
    } catch (err) {
      // File might already be deleted or not exist
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`⚠ Failed to cleanup ${filePath}:`, err);
      }
    }
  }
}
// const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
// const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';

// Configure multer for video upload - Use disk storage to avoid memory issues
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const tempDir = process.env.TEMP || '/tmp';
      cb(null, tempDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `upload-${uniqueSuffix}${ext}`);
    },
  }),
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

// Decrypt token
function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// All routes require authentication
router.use(authenticate);

// POST /publish - Upload video and queue for processing
router.post(
  '/',
  upload.single('video'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const file = req.file;

      console.log('[POST /publish] User:', userId);
      console.log(
        '[POST /publish] File:',
        file ? `${file.originalname} (${file.size} bytes)` : 'NO FILE'
      );

      if (!file) {
        console.log('[POST /publish] ERROR: No file provided');
        res.status(400).json({
          error: 'Bad Request',
          message: 'Archivo de video requerido',
        });
        return;
      }

      // Parse request body
      const {
        title: titleParam,
        caption,
        disableComment: disableCommentRaw = 'false',
        disableDuet: disableDuetRaw = 'false',
        disableStitch: disableStitchRaw = 'false',
        accountIds,
      } = req.body;

      // Convert string booleans to actual booleans
      const disableComment =
        disableCommentRaw === 'true' || disableCommentRaw === true;
      const disableDuet = disableDuetRaw === 'true' || disableDuetRaw === true;
      const disableStitch =
        disableStitchRaw === 'true' || disableStitchRaw === true;

      const title = titleParam || caption;

      if (!title || title.trim().length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'El título/descripción es requerido',
        });
        return;
      }

      if (!accountIds || accountIds.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Debe seleccionar al menos una cuenta',
        });
        return;
      }

      // Parse accountIds
      const parsedAccountIds =
        typeof accountIds === 'string' ? JSON.parse(accountIds) : accountIds;

      if (!Array.isArray(parsedAccountIds) || parsedAccountIds.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'accountIds debe ser un array con al menos un ID',
        });
        return;
      }

      console.log('[POST /publish] Verificando cuentas...');

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

      // Upload video to S3 from disk (avoid loading into memory)
      console.log('[POST /publish] Subiendo video a S3...');
      const fileStream = fs.createReadStream(file.path);
      const s3Result = await uploadToS3({
        file: fileStream,
        filename: file.originalname,
        contentType: file.mimetype,
        folder: 'videos',
      });

      console.log('[POST /publish] Video subido a S3:', s3Result.key);

      // Clean up temporary file after upload
      fs.unlink(file.path, err => {
        if (err)
          console.error('[POST /publish] Failed to delete temp file:', err);
      });

      // Create videos for each account and queue them
      const createdVideos = [];

      for (const connection of connections) {
        // Note: We don't use designId anymore (that's for old DesignProfile system)
        // The Edit Worker will fetch the BrandPattern directly from the connection

        // Create video record with PENDING status (Edit Worker will change to EDITING)
        const video = await prisma.video.create({
          data: {
            id: createId(),
            userId,
            accountId: connection.id,
            srcUrl: s3Result.url,
            title,
            status: VideoStatus.PENDING,
            progress: 0,
            designId: null, // Not using old DesignProfile system
            editSpecJson: {
              disableComment,
              disableDuet,
              disableStitch,
              privacyLevel: 'SELF_ONLY', // Force private for unaudited apps
            },
          },
          include: {
            account: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
            design: {
              select: {
                name: true,
              },
            },
          },
        });

        // Queue edit job (or process immediately if workers are unavailable)
        const jobQueued = await queueEditJob(video.id);

        if (!jobQueued) {
          // If QStash/workers unavailable, mark as PENDING and user can trigger manually
          console.log(
            `[${connection.displayName}] ⚠️  Workers unavailable, video ${video.id} marked as PENDING`
          );
        }

        console.log(
          `[${connection.displayName}] Video ${video.id} created and queued for editing`
        );

        createdVideos.push(video);
      }

      // Create audit event
      await prisma.auditEvent.create({
        data: {
          userId,
          type: 'batch.created',
          detailsJson: {
            videoIds: createdVideos.map(v => v.id),
            accountCount: connections.length,
            srcUrl: s3Result.url,
          },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      res.status(201).json({
        message: `Video encolado para ${connections.length} cuenta(s)`,
        videos: createdVideos,
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
    console.log(`[GET /jobs] Fetching jobs for user: ${userId}`);

    const { state, limit = '50' } = req.query;

    // Fetch old publish_jobs
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

    // Also fetch videos from new system and format as jobs
    const videos = await prisma.video.findMany({
      where: { userId },
      include: {
        account: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    // Map video statuses to job states
    const statusToState: Record<string, string> = {
      PENDING: 'queued', // En Cola de Edición
      EDITING: 'uploading', // Editando Video
      EDITED: 'completed', // Editado (listo para publicar)
      UPLOADING: 'publishing', // En Cola de Publicación
      POSTED: 'published', // Publicado
      FAILED_EDIT: 'failed',
      FAILED_UPLOAD: 'failed',
    };

    const videoJobs = videos.map(video => ({
      id: video.id,
      caption: video.title,
      state: statusToState[video.status] || 'queued',
      createdAt: video.createdAt,
      editedUrl: video.editedUrl, // Agregar URL para preview
      status: video.status, // Status real para el frontend
      tiktokConnection: {
        displayName: video.account?.displayName || 'Cuenta desconocida',
        avatarUrl: video.account?.avatarUrl,
      },
      videoAsset: null,
    }));

    console.log(
      `[GET /jobs] Found ${jobs.length} publish_jobs + ${videos.length} videos for user ${userId}`
    );

    const serializedJobs = jobs.map(job => ({
      ...job,
      videoAsset: job.videoAsset
        ? {
            ...job.videoAsset,
            sizeBytes: Number(job.videoAsset.sizeBytes),
          }
        : null,
    }));

    // Combine both and sort by date
    const allJobs = [...serializedJobs, ...videoJobs].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json({ jobs: allJobs });
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

/**
 * POST /publish/process/:videoId - Process video directly (fallback when workers unavailable)
 * This endpoint allows processing videos directly in the API when external workers are down
 */
router.post(
  '/process/:videoId',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const { videoId } = req.params;
    const userId = req.user!.userId;

    try {
      // Verify video belongs to user
      const video = await prisma.video.findFirst({
        where: { id: videoId, userId },
        include: { design: true },
      });

      if (!video) {
        res.status(404).json({ error: 'Video not found' });
        return;
      }

      // Check if already processing or completed
      const validStatuses: VideoStatus[] = [
        VideoStatus.PENDING,
        VideoStatus.FAILED_EDIT,
      ];
      if (!validStatuses.includes(video.status)) {
        res.status(400).json({
          error: 'Invalid status',
          message: `Video is ${video.status}, cannot process`,
        });
        return;
      }

      // Start processing (run in background)
      res
        .status(202)
        .json({ message: 'Processing started', videoId: video.id });

      // Process asynchronously
      processVideoDirectly(videoId).catch(err => {
        console.error(`[Direct Process] Error processing ${videoId}:`, err);
      });
    } catch (error) {
      console.error('[Direct Process] Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * Process video directly without external workers
 */
async function processVideoDirectly(videoId: string): Promise<void> {
  console.log(`[Direct Process] Starting video ${videoId}`);

  try {
    await prisma.video.update({
      where: { id: videoId },
      data: { status: VideoStatus.EDITING, progress: 10 },
    });

    // Import processing logic here
    // For now, just mark as edited
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.EDITED,
        progress: 100,
        editedUrl: `https://placeholder.com/${videoId}.mp4`, // TODO: actual processing
      },
    });

    console.log(`[Direct Process] ✅ Completed video ${videoId}`);
  } catch (error) {
    console.error(`[Direct Process] ❌ Failed video ${videoId}:`, error);
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.FAILED_EDIT,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

export default router;
