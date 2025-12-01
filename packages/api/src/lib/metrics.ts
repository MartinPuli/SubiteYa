import { getMetrics as getCollector } from '@subiteya/observability';

/**
 * Centralized helpers to record observability metrics without leaking
 * the collector implementation across the codebase.
 */
const collector = getCollector();

let activeEditJobs = 0;
let activeUploadJobs = 0;
let activeAccountBackoff = 0;

function clampGauge(value: number): number {
  return value < 0 ? 0 : value;
}

function secondsFromMs(durationMs: number): number {
  return Math.max(durationMs / 1000, 0);
}

export function markVideoIngested(count = 1): void {
  collector.incrementCounter('video_ingested_total', count);
}

export function markEditJobStarted(): void {
  activeEditJobs += 1;
  collector.incrementCounter('video_process_started_total');
  collector.setGauge('active_edit_jobs', activeEditJobs);
}

export function markEditJobFinished(params: {
  success: boolean;
  durationMs: number;
}): void {
  activeEditJobs = clampGauge(activeEditJobs - 1);
  collector.setGauge('active_edit_jobs', activeEditJobs);
  collector.recordHistogram(
    'video_process_duration_seconds',
    secondsFromMs(params.durationMs)
  );

  collector.incrementCounter(
    params.success ? 'video_processed_total' : 'video_process_errors_total'
  );
}

export function markUploadJobStarted(): void {
  activeUploadJobs += 1;
  collector.incrementCounter('video_upload_started_total');
  collector.setGauge('active_upload_jobs', activeUploadJobs);
}

export function markUploadJobFinished(params: {
  success: boolean;
  durationMs: number;
}): void {
  activeUploadJobs = clampGauge(activeUploadJobs - 1);
  collector.setGauge('active_upload_jobs', activeUploadJobs);
  collector.recordHistogram(
    'video_upload_duration_seconds',
    secondsFromMs(params.durationMs)
  );

  collector.incrementCounter(
    params.success
      ? 'video_upload_completed_total'
      : 'video_upload_errors_total'
  );
}

export function updateAccountBackoffGauge(size: number): void {
  activeAccountBackoff = size;
  collector.setGauge('account_backoff_active', activeAccountBackoff);
}

const S3_COUNTERS: Record<'upload' | 'download' | 'delete', string> = {
  upload: 's3_upload_operations_total',
  download: 's3_download_operations_total',
  delete: 's3_delete_operations_total',
};

export function recordS3Operation(
  type: 'upload' | 'download' | 'delete'
): void {
  collector.incrementCounter(S3_COUNTERS[type]);
}

export function recordTempFileSize(bytes: number): void {
  collector.recordHistogram('temp_files_size_bytes', bytes);
  collector.setGauge('temp_file_last_size_bytes', bytes);
}

export async function trackTikTokRequest<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  collector.incrementCounter('tiktok_api_requests_total');
  collector.incrementCounter(`tiktok_api_requests.${operation}`);

  try {
    const result = await fn();
    collector.recordHistogram(
      'tiktok_api_latency_seconds',
      secondsFromMs(Date.now() - start)
    );
    return result;
  } catch (error) {
    collector.incrementCounter('tiktok_api_requests_errors_total');
    collector.incrementCounter(`tiktok_api_requests_errors.${operation}`);
    throw error;
  }
}

export function getRuntimeMetricsSnapshot(): Record<string, unknown> {
  return collector.getMetrics();
}
