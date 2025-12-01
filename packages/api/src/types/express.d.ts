import type { Logger } from '@subiteya/observability';

export interface RequestContext {
  traceId: string;
  userId?: string;
  videoId?: string;
  jobId?: string;
  accountId?: string;
  ip?: string;
}

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Request {
      context?: RequestContext;
      logger?: Logger;
    }
  }
}

export {};
