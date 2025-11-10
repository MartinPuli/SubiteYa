/**
 * ElevenLabs API Routes
 * Voice management and text-to-speech endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import * as elevenlabs from '../lib/elevenlabs';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const router = Router();

// Configure multer for audio file uploads
const upload = multer({
  dest: path.join(os.tmpdir(), 'voice-samples'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

/**
 * GET /api/elevenlabs/voices
 * List all available voices
 */
router.get('/voices', authenticate, async (req: Request, res: Response) => {
  try {
    const voices = await elevenlabs.listVoices();
    res.json({ voices });
  } catch (error) {
    console.error('Error listing voices:', error);
    res.status(500).json({
      error: 'Failed to list voices',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/elevenlabs/voices/:voiceId
 * Get a specific voice by ID
 */
router.get(
  '/voices/:voiceId',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { voiceId } = req.params;
      const voice = await elevenlabs.getVoice(voiceId);
      res.json({ voice });
    } catch (error) {
      console.error('Error getting voice:', error);
      res.status(500).json({
        error: 'Failed to get voice',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/elevenlabs/clone
 * Clone a voice from audio samples
 * Expects multipart/form-data with:
 * - name: string
 * - description: string (optional)
 * - files: audio files (at least 1)
 */
router.post(
  '/clone',
  authenticate,
  upload.array('files', 10),
  async (req: Request, res: Response) => {
    const uploadedFiles: string[] = [];

    try {
      const { name, description } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!name) {
        return res.status(400).json({ error: 'Voice name is required' });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          error: 'At least one audio file is required',
        });
      }

      // Get file paths
      const filePaths = files.map(f => f.path);
      uploadedFiles.push(...filePaths);

      // Clone voice
      const voice = await elevenlabs.cloneVoice(name, filePaths, description);

      res.json({
        success: true,
        voice,
        message: 'Voice cloned successfully',
      });
    } catch (error) {
      console.error('Error cloning voice:', error);
      res.status(500).json({
        error: 'Failed to clone voice',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      // Cleanup uploaded files
      for (const filePath of uploadedFiles) {
        try {
          await fs.promises.unlink(filePath);
        } catch (err) {
          console.error('Failed to delete temp file:', filePath, err);
        }
      }
    }
  }
);

/**
 * POST /api/elevenlabs/generate
 * Generate speech from text
 * Body:
 * - text: string
 * - voice_id: string
 * - model_id: string (optional)
 * - voice_settings: object (optional)
 */
router.post('/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { text, voice_id, model_id, voice_settings } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!voice_id) {
      return res.status(400).json({ error: 'Voice ID is required' });
    }

    const audioBuffer = await elevenlabs.generateSpeech({
      text,
      voice_id,
      model_id,
      voice_settings,
    });

    // Set appropriate headers for audio response
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString(),
      'Content-Disposition': 'attachment; filename="speech.mp3"',
    });

    res.send(audioBuffer);
  } catch (error) {
    console.error('Error generating speech:', error);
    res.status(500).json({
      error: 'Failed to generate speech',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/elevenlabs/default-voices
 * Get recommended default voices for each language
 */
router.get(
  '/default-voices',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      res.json({
        default_voices: elevenlabs.DEFAULT_VOICES,
      });
    } catch (error) {
      console.error('Error getting default voices:', error);
      res.status(500).json({
        error: 'Failed to get default voices',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
