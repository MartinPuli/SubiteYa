/**
 * ElevenLabs API Integration
 * Voice cloning and text-to-speech for video narration
 */

import FormData from 'form-data';
import fs from 'node:fs';
import axios from 'axios';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  description?: string;
  preview_url?: string;
}

export interface VoiceSettings {
  stability: number; // 0-1
  similarity_boost: number; // 0-1
  style?: number; // 0-1
  use_speaker_boost?: boolean;
}

export interface GenerateSpeechOptions {
  voice_id: string;
  text: string;
  model_id?: string; // 'eleven_multilingual_v2' for multilingual support
  voice_settings?: VoiceSettings;
}

/**
 * List all available voices from ElevenLabs
 */
export async function listVoices(): Promise<Voice[]> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { voices: Voice[] };
  return data.voices;
}

/**
 * Get a specific voice by ID
 */
export async function getVoice(voiceId: string): Promise<Voice> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  return (await response.json()) as Voice;
}

export interface AudioFileInfo {
  path: string;
  mimetype: string;
  originalname: string;
}

/**
 * Clone a voice from audio samples
 * @param name - Name for the cloned voice
 * @param audioFiles - Array of audio file info (at least 1, max 25)
 * @param description - Optional description
 */
export async function cloneVoice(
  name: string,
  audioFiles: AudioFileInfo[],
  description?: string
): Promise<Voice> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  if (audioFiles.length === 0) {
    throw new Error('At least one audio file is required for voice cloning');
  }

  const formData = new FormData();
  formData.append('name', name);

  if (description) {
    formData.append('description', description);
  }

  // Add audio files with correct mime types
  for (let i = 0; i < audioFiles.length; i++) {
    const fileInfo = audioFiles[i];

    // Create a readable stream instead of reading the whole file
    const fileStream = fs.createReadStream(fileInfo.path);

    // Get file extension
    const ext = fileInfo.originalname.split('.').pop() || 'mp3';
    const filename = `sample_${i}.${ext}`;

    // Append stream with metadata
    formData.append('files', fileStream, {
      filename,
      contentType: fileInfo.mimetype,
      knownLength: fs.statSync(fileInfo.path).size,
    });
  }

  try {
    // Use axios for better multipart/form-data support
    const response = await axios.post(
      `${ELEVENLABS_BASE_URL}/voices/add`,
      formData,
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    return response.data as Voice;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const errorData =
        typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data);
      throw new Error(
        `ElevenLabs voice cloning error: ${error.response.status} - ${errorData}`
      );
    }
    throw error;
  }
}

/**
 * Generate speech audio from text
 * @returns Buffer containing the audio data (MP3)
 */
export async function generateSpeech(
  options: GenerateSpeechOptions
): Promise<Buffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const {
    voice_id,
    text,
    model_id = 'eleven_multilingual_v2', // Default to multilingual model
    voice_settings = {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.5,
      use_speaker_boost: true,
    },
  } = options;

  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${voice_id}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id,
        voice_settings,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs TTS error: ${response.status} - ${error}`);
  }

  // Return audio as Buffer
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate speech and save to file
 */
export async function generateSpeechToFile(
  options: GenerateSpeechOptions,
  outputPath: string
): Promise<void> {
  const audioBuffer = await generateSpeech(options);
  await fs.promises.writeFile(outputPath, audioBuffer);
}

/**
 * Default voices for different languages (curated list)
 * These are actual voice IDs from ElevenLabs that support multiple languages
 * All voices use the multilingual v2 model
 */
export const DEFAULT_VOICES = {
  en: 'pNInz6obpgDQGcFmaJgB', // Adam - English (UK)
  es: '21m00Tcm4TlvDq8ikWAM', // Rachel - Spanish (neutral)
  pt: 'yoZ06aMxZJJ28mfd3POQ', // Sam - Portuguese
  fr: 'XB0fDUnXU5powFXDhCwa', // Charlotte - French
  de: 'TX3LPaxmHKxFdv7VOQHJ', // Elli - German (Alemania)
  it: 'GBv7mTt0atIp3Br8iCZE', // Thomas - Italian (Italiano)
  ja: 'CwhRBWXzGAHq8TQ4Fs17', // Yuki - Japanese (Japonés)
  zh: 'XrExE9yKIg1WjnnlVkGX', // Matilda - Chinese (Chino)
};

/**
 * Get recommended voice for a language
 */
export function getDefaultVoiceForLanguage(language: string): string | null {
  return DEFAULT_VOICES[language as keyof typeof DEFAULT_VOICES] || null;
}

/**
 * Estimate audio duration from text (rough approximation)
 * Average speaking rate: 150 words per minute
 */
export function estimateAudioDuration(text: string): number {
  const words = text.split(/\s+/).length;
  const minutes = words / 150;
  return minutes * 60; // Return duration in seconds
}
