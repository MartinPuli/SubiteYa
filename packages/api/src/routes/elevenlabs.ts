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
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/webm', // Agregado para soportar grabaciones del navegador
      'audio/x-m4a',
      'audio/mp4',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Only audio files are allowed.`
        )
      );
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
  (req: Request, res: Response, next) => {
    upload.array('files', 10)(req, res, err => {
      if (err) {
        console.error('❌ Multer error:', err);
        return res.status(400).json({
          error: 'File upload error',
          message: err.message,
          details:
            err instanceof multer.MulterError
              ? {
                  code: err.code,
                  field: err.field,
                }
              : undefined,
        });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const uploadedFiles: string[] = [];

    try {
      console.log('📥 Clone request body:', req.body);
      console.log(
        '📁 Files received:',
        req.files
          ? (req.files as Express.Multer.File[]).map(f => ({
              originalname: f.originalname,
              mimetype: f.mimetype,
              size: f.size,
            }))
          : 'none'
      );

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

      // Prepare file info with mimetype and original name
      const fileInfos = files.map(f => ({
        path: f.path,
        mimetype: f.mimetype,
        originalname: f.originalname,
      }));
      uploadedFiles.push(...files.map(f => f.path));

      // Clone voice
      const voice = await elevenlabs.cloneVoice(name, fileInfos, description);

      res.json({
        success: true,
        voice,
        message: 'Voice cloned successfully',
      });
    } catch (error) {
      console.error('Error cloning voice:', error);

      // Check for specific ElevenLabs errors
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Subscription error
      if (errorMessage.includes('can_not_use_instant_voice_cloning')) {
        return res.status(403).json({
          error: 'Subscription Required',
          message:
            'La clonación de voz requiere el plan Starter ($5/mes) o superior de ElevenLabs. Tu plan actual no incluye esta funcionalidad.',
          upgrade_url: 'https://elevenlabs.io/pricing',
          details: {
            current_plan: 'Free',
            required_plan: 'Starter',
            monthly_cost: '$5 USD',
          },
        });
      }

      res.status(500).json({
        error: 'Failed to clone voice',
        message: errorMessage,
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
 * Get recommended default voices for each language (20 voices)
 */
router.get(
  '/default-voices',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      // 20 curated voices with descriptions
      const defaultVoicesArray = [
        // English voices
        {
          language: 'Inglés',
          voice_id: elevenlabs.DEFAULT_VOICES.adam,
          name: 'Adam',
          flag: '🇺🇸',
          description: 'Voz masculina profunda y autoritaria',
          gender: 'male',
        },
        {
          language: 'Inglés',
          voice_id: elevenlabs.DEFAULT_VOICES.rachel,
          name: 'Rachel',
          flag: '🇺🇸',
          description: 'Voz femenina profesional y clara',
          gender: 'female',
        },
        {
          language: 'Inglés',
          voice_id: elevenlabs.DEFAULT_VOICES.domi,
          name: 'Domi',
          flag: '🇺🇸',
          description: 'Voz femenina joven y enérgica',
          gender: 'female',
        },
        {
          language: 'Inglés',
          voice_id: elevenlabs.DEFAULT_VOICES.dave,
          name: 'Dave',
          flag: '🇺🇸',
          description: 'Voz masculina amigable y cercana',
          gender: 'male',
        },
        {
          language: 'Inglés',
          voice_id: elevenlabs.DEFAULT_VOICES.emily,
          name: 'Emily',
          flag: '🇺🇸',
          description: 'Voz femenina juvenil americana',
          gender: 'female',
        },
        // Spanish voices
        {
          language: 'Español',
          voice_id: elevenlabs.DEFAULT_VOICES.matias,
          name: 'Matías',
          flag: '🇪🇸',
          description: 'Voz masculina española neutral',
          gender: 'male',
        },
        {
          language: 'Español',
          voice_id: elevenlabs.DEFAULT_VOICES.valentina,
          name: 'Valentina',
          flag: '🇪🇸',
          description: 'Voz femenina española cálida',
          gender: 'female',
        },
        // Portuguese voices
        {
          language: 'Portugués',
          voice_id: elevenlabs.DEFAULT_VOICES.sam,
          name: 'Sam',
          flag: '🇧🇷',
          description: 'Voz masculina brasileña versátil',
          gender: 'male',
        },
        {
          language: 'Portugués',
          voice_id: elevenlabs.DEFAULT_VOICES.serena,
          name: 'Serena',
          flag: '🇧🇷',
          description: 'Voz femenina brasileña suave',
          gender: 'female',
        },
        // French voices
        {
          language: 'Francés',
          voice_id: elevenlabs.DEFAULT_VOICES.charlotte,
          name: 'Charlotte',
          flag: '🇫🇷',
          description: 'Voz femenina francesa elegante',
          gender: 'female',
        },
        {
          language: 'Francés',
          voice_id: elevenlabs.DEFAULT_VOICES.henri,
          name: 'Henri',
          flag: '🇫🇷',
          description: 'Voz masculina francesa sofisticada',
          gender: 'male',
        },
        // German voices
        {
          language: 'Alemán',
          voice_id: elevenlabs.DEFAULT_VOICES.elli,
          name: 'Elli',
          flag: '🇩🇪',
          description: 'Voz femenina alemana clara',
          gender: 'female',
        },
        {
          language: 'Alemán',
          voice_id: elevenlabs.DEFAULT_VOICES.klaus,
          name: 'Klaus',
          flag: '🇩🇪',
          description: 'Voz masculina alemana firme',
          gender: 'male',
        },
        // Italian voices
        {
          language: 'Italiano',
          voice_id: elevenlabs.DEFAULT_VOICES.giovanni,
          name: 'Giovanni',
          flag: '🇮🇹',
          description: 'Voz masculina italiana expresiva',
          gender: 'male',
        },
        {
          language: 'Italiano',
          voice_id: elevenlabs.DEFAULT_VOICES.sofia,
          name: 'Sofia',
          flag: '🇮🇹',
          description: 'Voz femenina italiana melodiosa',
          gender: 'female',
        },
        // Japanese voices
        {
          language: 'Japonés',
          voice_id: elevenlabs.DEFAULT_VOICES.yuki,
          name: 'Yuki',
          flag: '🇯🇵',
          description: 'Voz femenina japonesa dulce',
          gender: 'female',
        },
        {
          language: 'Japonés',
          voice_id: elevenlabs.DEFAULT_VOICES.kenji,
          name: 'Kenji',
          flag: '🇯🇵',
          description: 'Voz masculina japonesa formal',
          gender: 'male',
        },
        // Chinese voices
        {
          language: 'Chino',
          voice_id: elevenlabs.DEFAULT_VOICES.mei,
          name: 'Mei',
          flag: '🇨🇳',
          description: 'Voz femenina mandarín clara',
          gender: 'female',
        },
        {
          language: 'Chino',
          voice_id: elevenlabs.DEFAULT_VOICES.chen,
          name: 'Chen',
          flag: '🇨🇳',
          description: 'Voz masculina mandarín profesional',
          gender: 'male',
        },
        // Additional popular voice
        {
          language: 'Inglés',
          voice_id: elevenlabs.DEFAULT_VOICES.michael,
          name: 'Michael',
          flag: '🇺🇸',
          description: 'Voz masculina profesional versátil',
          gender: 'male',
        },
      ];

      res.json({
        defaultVoices: defaultVoicesArray,
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
