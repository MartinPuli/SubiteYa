/**
 * @fileoverview S3 Storage Service
 * Purpose: Upload/download videos to/from AWS S3 or compatible storage
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import path from 'node:path';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
  // For local development with MinIO/LocalStack
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'subiteya-videos';
const VIDEO_FOLDER = 'videos';
const TEMP_FOLDER = 'temp';

interface UploadOptions {
  file: Buffer | Readable;
  filename: string;
  contentType?: string;
  metadata?: Record<string, string>;
  folder?: 'videos' | 'temp';
}

interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(
  options: UploadOptions
): Promise<UploadResult> {
  const {
    file,
    filename,
    contentType = 'video/mp4',
    metadata = {},
    folder = 'videos',
  } = options;

  // Generate unique key with hash to prevent collisions
  const hash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  const key = `${folder === 'videos' ? VIDEO_FOLDER : TEMP_FOLDER}/${Date.now()}-${hash}-${basename}${ext}`;

  let body: Buffer | Readable;
  let size: number;

  if (Buffer.isBuffer(file)) {
    body = file;
    size = file.length;
  } else {
    // For streams, we need to buffer (or use multipart upload for large files)
    const chunks: Buffer[] = [];
    for await (const chunk of file) {
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks);
    size = body.length;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: {
      ...metadata,
      uploadedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);

  console.log(`[S3] Uploaded ${key} (${size} bytes) to ${BUCKET_NAME}`);

  return {
    key,
    url: `s3://${BUCKET_NAME}/${key}`,
    bucket: BUCKET_NAME,
    size,
  };
}

/**
 * Get a presigned URL for downloading a file (valid 1 hour)
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
}

/**
 * Get a presigned URL for uploading a file (valid 15 minutes)
 */
export async function getPresignedUploadUrl(
  filename: string,
  contentType: string = 'video/mp4',
  expiresIn: number = 900
): Promise<{ key: string; url: string }> {
  const hash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  const key = `${TEMP_FOLDER}/${Date.now()}-${hash}-${basename}${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });

  return { key, url };
}

/**
 * Download a file from S3 to memory
 */
export async function downloadFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error(`File not found: ${key}`);
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as Readable) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  console.log(`[S3] Downloaded ${key} (${buffer.length} bytes)`);

  return buffer;
}

/**
 * Download a file from S3 as a stream
 */
export async function downloadStreamFromS3(key: string): Promise<Readable> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error(`File not found: ${key}`);
  }

  console.log(`[S3] Streaming ${key}`);
  return response.Body as Readable;
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
  console.log(`[S3] Deleted ${key}`);
}

/**
 * Check if a file exists in S3
 */
export async function fileExistsInS3(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'NotFound'
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Extract S3 key from URL (supports s3:// and https:// formats)
 */
export function extractS3Key(url: string): string {
  if (url.startsWith('s3://')) {
    // s3://bucket/path/to/file
    const parts = url.replace('s3://', '').split('/');
    parts.shift(); // Remove bucket name
    return parts.join('/');
  } else if (url.includes('amazonaws.com')) {
    // https://bucket.s3.region.amazonaws.com/path/to/file
    const urlObj = new URL(url);
    return urlObj.pathname.slice(1); // Remove leading /
  } else {
    // Assume it's already a key
    return url;
  }
}

/**
 * Move a file from temp to videos folder
 */
export async function moveToVideoFolder(tempKey: string): Promise<string> {
  // Download from temp
  const buffer = await downloadFromS3(tempKey);

  // Upload to videos folder
  const filename = path.basename(tempKey);
  const result = await uploadToS3({
    file: buffer,
    filename,
    folder: 'videos',
  });

  // Delete temp file
  await deleteFromS3(tempKey);

  console.log(`[S3] Moved ${tempKey} → ${result.key}`);

  return result.key;
}
