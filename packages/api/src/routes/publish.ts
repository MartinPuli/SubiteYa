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

const router = Router();

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
// const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
// const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';

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

// POST /publish - Upload video and publish to multiple TikTok accounts
router.post(
  '/',
  upload.single('video'),
  async (req: AuthRequest, res: Response) => {
    const processedFilesForCleanup = new Set<string>();
    let originalVideoPath: string | null = null;

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
      const {
        title: titleParam,
        caption,
        disableComment: disableCommentRaw = 'false',
        disableDuet: disableDuetRaw = 'false',
        disableStitch: disableStitchRaw = 'false',
        accountIds,
      } = req.body;

      // Convert string booleans to actual booleans (FormData sends strings)
      const disableComment =
        disableCommentRaw === 'true' || disableCommentRaw === true;
      const disableDuet = disableDuetRaw === 'true' || disableDuetRaw === true;
      const disableStitch =
        disableStitchRaw === 'true' || disableStitchRaw === true;

      // For unaudited apps, TikTok only allows SELF_ONLY (private) posts
      // Force private mode until app is audited by TikTok
      const privacyLevel = 'SELF_ONLY';

      // Accept either title or caption
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

      // Verify all connections belong to user and get them
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

      // Save original video to temp file
      const tempDir = process.env.TEMP || '/tmp';
      originalVideoPath = path.join(
        tempDir,
        `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`
      );
      await writeFile(originalVideoPath, file.buffer);

      // Create video asset
      const videoAsset = await prisma.videoAsset.create({
        data: {
          userId,
          storageUrl: checksum, // Usamos el checksum como identificador
          originalFilename: file.originalname,
          sizeBytes: file.size,
          checksum,
          status: 'uploaded',
        },
      });

      // Create publish batch
      const batch = await prisma.publishBatch.create({
        data: {
          userId,
          videoAssetId: videoAsset.id,
          defaultsJson: {
            title,
            privacyLevel,
            disableComment,
            disableDuet,
            disableStitch,
          },
          scheduleTimeUtc: null,
        },
      });

      const connectionVideoBuffers = new Map<string, Buffer>();

      // Apply brand pattern per connection so each cuenta usa su diseño
      for (const connection of connections) {
        try {
          const pattern = await prisma.brandPattern.findFirst({
            where: {
              userId,
              tiktokConnectionId: connection.id,
              isDefault: true,
            },
          });

          const shouldApplyPattern =
            !!pattern &&
            (pattern.logoUrl || pattern.enableEffects || pattern.enableSubtitles);

          if (!shouldApplyPattern) {
            connectionVideoBuffers.set(connection.id, file.buffer);
            if (!pattern) {
              console.log(
                `[${connection.displayName}] Sin patrón por defecto, se usa el video original`
              );
            } else {
              console.log(
                `[${connection.displayName}] Patrón sin efectos/ajustes activos, se usa el video original`
              );
            }
            continue;
          }

          console.log(
            `[${connection.displayName}] Aplicando patrón "${pattern.name}" al video...`
          );

          const processResult = await applyBrandPattern(originalVideoPath, {
            // Logo
            logoUrl: pattern.logoUrl ?? undefined,
            logoPosition: pattern.logoPosition ?? undefined,
            logoSize: pattern.logoSize ?? undefined,
            logoOpacity: pattern.logoOpacity ?? undefined,
            // Effects
            enableEffects: pattern.enableEffects ?? undefined,
            filterType: pattern.filterType ?? undefined,
            brightness: pattern.brightness ?? undefined,
            contrast: pattern.contrast ?? undefined,
            saturation: pattern.saturation ?? undefined,
            // Subtitles
            enableSubtitles: pattern.enableSubtitles ?? undefined,
            subtitleStyle: pattern.subtitleStyle ?? undefined,
            subtitlePosition: pattern.subtitlePosition ?? undefined,
            subtitleColor: pattern.subtitleColor ?? undefined,
            subtitleBgColor: pattern.subtitleBgColor ?? undefined,
            subtitleFontSize: pattern.subtitleFontSize ?? undefined,
          });

          if (processResult.success && processResult.outputPath) {
            const processedBuffer = await fs.promises.readFile(
              processResult.outputPath
            );
            connectionVideoBuffers.set(connection.id, processedBuffer);
            console.log(
              `[${connection.displayName}] ✓ Patrón aplicado. Tamaño final: ${processedBuffer.length} bytes`
            );

            if (processResult.outputPath !== originalVideoPath) {
              try {
                await unlink(processResult.outputPath);
              } catch (unlinkError) {
                console.warn(
                  `[${connection.displayName}] No se pudo borrar video procesado inmediatamente:`,
                  unlinkError
                );
                processedFilesForCleanup.add(processResult.outputPath);
              }
            }
          } else {
            console.warn(
              `[${connection.displayName}] ⚠ Error al aplicar patrón: ${processResult.error}. Se usará el video original.`
            );
            connectionVideoBuffers.set(connection.id, file.buffer);
          }
        } catch (patternError) {
          console.error(
            `[${connection.displayName}] Error procesando patrón:`,
            patternError
          );
          connectionVideoBuffers.set(connection.id, file.buffer);
        }
      }

      // Publish to each account
      const publishResults = await Promise.all(
        connections.map(async connection => {
          try {
            const finalVideoBuffer =
              connectionVideoBuffers.get(connection.id) ?? file.buffer;

            // Decrypt access token
            const accessToken = decryptToken(connection.accessTokenEnc);

            // 1. Query Creator Info (required before posting)
            console.log(
              `[${connection.displayName}] Step 1: Querying creator info...`
            );
            const creatorInfoResponse = await fetch(
              'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json; charset=UTF-8',
                },
                // No body required per TikTok docs
              }
            );

            const responseText = await creatorInfoResponse.text();
            console.log(
              `[${connection.displayName}] Creator info response (${creatorInfoResponse.status}):`,
              responseText
            );

            if (!creatorInfoResponse.ok) {
              let errorData;
              try {
                errorData = JSON.parse(responseText);
              } catch {
                errorData = { rawResponse: responseText };
              }

              // Check for common errors
              const errorMsg =
                errorData.error?.message ||
                errorData.message ||
                JSON.stringify(errorData);
              const errorCode = errorData.error?.code || 'unknown';

              console.error(
                `[${connection.displayName}] Creator info failed:`,
                {
                  status: creatorInfoResponse.status,
                  code: errorCode,
                  message: errorMsg,
                }
              );

              // Provide helpful error messages
              if (
                errorCode === 'scope_not_authorized' ||
                errorMsg.includes('scope')
              ) {
                throw new Error(
                  'Falta el permiso video.publish. Ve a Conexiones y reconecta tu cuenta de TikTok para otorgar los permisos necesarios.'
                );
              } else if (
                errorCode === 'access_token_invalid' ||
                creatorInfoResponse.status === 401
              ) {
                throw new Error(
                  'Token inválido o expirado. Reconecta tu cuenta de TikTok en la página de Conexiones.'
                );
              } else {
                throw new Error(
                  `Error TikTok (${creatorInfoResponse.status}): ${errorMsg}`
                );
              }
            }

            const creatorInfo = JSON.parse(responseText);
            console.log(`[${connection.displayName}] Creator info OK:`, {
              username: creatorInfo.data?.creator_username,
              maxDuration: creatorInfo.data?.max_video_post_duration_sec,
            });

            // 2. Initialize video upload
            const initResponse = await fetch(
              'https://open.tiktokapis.com/v2/post/publish/video/init/',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify({
                  post_info: {
                    title,
                    privacy_level: privacyLevel,
                    disable_duet: disableDuet,
                    disable_comment: disableComment,
                    disable_stitch: disableStitch,
                    video_cover_timestamp_ms: 1000,
                  },
                  source_info: {
                    source: 'FILE_UPLOAD',
                    video_size: finalVideoBuffer.length,
                    chunk_size: finalVideoBuffer.length, // Subir todo de una vez
                    total_chunk_count: 1,
                  },
                }),
              }
            );

            if (!initResponse.ok) {
              const errorData = await initResponse.json();
              throw new Error(`Init failed: ${JSON.stringify(errorData)}`);
            }

            const initData = (await initResponse.json()) as {
              data: {
                publish_id: string;
                upload_url: string;
              };
            };

            // 3. Upload video file
            const uploadResponse = await fetch(initData.data.upload_url, {
              method: 'PUT',
              headers: {
                'Content-Type': file.mimetype,
                'Content-Range': `bytes 0-${finalVideoBuffer.length - 1}/${finalVideoBuffer.length}`,
              },
              body: finalVideoBuffer,
            });

            if (!uploadResponse.ok) {
              throw new Error('Video upload failed');
            }

            // Create publish job record
            const job = await prisma.publishJob.create({
              data: {
                batchId: batch.id,
                userId,
                tiktokConnectionId: connection.id,
                videoAssetId: videoAsset.id,
                caption: title,
                hashtags: [],
                privacyStatus: privacyLevel,
                allowDuet: !disableDuet,
                allowStitch: !disableStitch,
                allowComment: !disableComment,
                scheduleTimeUtc: null,
                state: 'publishing',
                idempotencyKey: crypto.randomBytes(16).toString('hex'),
                tiktokVideoId: initData.data.publish_id,
              },
            });

            return {
              success: true,
              jobId: job.id,
              publishId: initData.data.publish_id,
              connectionId: connection.id,
              displayName: connection.displayName,
            };
          } catch (error) {
            console.error(
              `Error publishing to ${connection.displayName}:`,
              error
            );
            // Create failed job
            const job = await prisma.publishJob.create({
              data: {
                batchId: batch.id,
                userId,
                tiktokConnectionId: connection.id,
                videoAssetId: videoAsset.id,
                caption: title,
                hashtags: [],
                privacyStatus: privacyLevel,
                allowDuet: !disableDuet,
                allowStitch: !disableStitch,
                allowComment: !disableComment,
                scheduleTimeUtc: null,
                state: 'failed',
                idempotencyKey: crypto.randomBytes(16).toString('hex'),
              },
            });

            return {
              success: false,
              jobId: job.id,
              connectionId: connection.id,
              displayName: connection.displayName,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      const successCount = publishResults.filter(r => r.success).length;
      const failedCount = publishResults.filter(r => !r.success).length;

      // Create audit event
      await prisma.auditEvent.create({
        data: {
          userId,
          type: 'batch.created',
          detailsJson: {
            batchId: batch.id,
            videoAssetId: videoAsset.id,
            accountCount: connections.length,
            successCount,
            failedCount,
          },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      // Cleanup temporary files
      try {
        if (originalVideoPath) {
          await unlink(originalVideoPath);
        }
        for (const tempFile of processedFilesForCleanup) {
          try {
            await unlink(tempFile);
          } catch (err) {
            console.warn('Failed to cleanup processed temp file:', err);
          }
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp files:', cleanupError);
      }

      res.status(201).json({
        message: `Video publicado en ${successCount} de ${connections.length} cuenta(s)`,
        batch: {
          id: batch.id,
          videoAssetId: videoAsset.id,
        },
        results: publishResults,
      });
    } catch (error) {
      console.error('Publish error:', error);

      // Cleanup on error
      try {
        if (originalVideoPath) {
          await unlink(originalVideoPath);
        }
        for (const tempFile of processedFilesForCleanup) {
          try {
            await unlink(tempFile);
          } catch (err) {
            console.warn('Failed to cleanup processed temp file:', err);
          }
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp files on error:', cleanupError);
      }

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

    console.log(`[GET /jobs] Found ${jobs.length} jobs for user ${userId}`);

    const serializedJobs = jobs.map(job => ({
      ...job,
      videoAsset: job.videoAsset
        ? {
            ...job.videoAsset,
            sizeBytes: Number(job.videoAsset.sizeBytes),
          }
        : null,
    }));

    res.json({ jobs: serializedJobs });
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
