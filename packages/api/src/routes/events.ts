/**
 * @fileoverview SSE (Server-Sent Events) Routes
 * Purpose: Real-time video status updates to frontend
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Map to store SSE connections by userId
const connections = new Map<string, Response[]>();

// All routes require authentication
router.use(authenticate);

// GET /events - SSE endpoint for real-time updates
router.get('/', (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  // Add this connection to the map
  if (!connections.has(userId)) {
    connections.set(userId, []);
  }
  connections.get(userId)!.push(res);

  console.log(
    `[SSE] User ${userId} connected (${connections.get(userId)!.length} connections)`
  );

  // Remove connection on close
  req.on('close', () => {
    const userConnections = connections.get(userId);
    if (userConnections) {
      const index = userConnections.indexOf(res);
      if (index !== -1) {
        userConnections.splice(index, 1);
      }
      if (userConnections.length === 0) {
        connections.delete(userId);
      }
    }
    console.log(`[SSE] User ${userId} disconnected`);
  });

  // Keep-alive ping every 30 seconds
  const keepAliveInterval = setInterval(() => {
    res.write(`: keep-alive\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
  });
});

/**
 * Send event to all connections for a specific user
 */
export function notifyUser(
  userId: string,
  event: {
    type: string;
    videoId?: string;
    status?: string;
    progress?: number;
    error?: string;
    [key: string]: unknown;
  }
) {
  const userConnections = connections.get(userId);
  if (!userConnections || userConnections.length === 0) {
    return; // No active connections
  }

  const data = JSON.stringify({
    ...event,
    timestamp: Date.now(),
  });

  console.log(
    `[SSE] Notifying user ${userId} (${userConnections.length} connections):`,
    event.type
  );

  // Send to all connections
  for (const connection of userConnections) {
    try {
      connection.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error('[SSE] Error sending event:', error);
    }
  }
}

/**
 * Broadcast event to all connected users
 */
export function broadcastEvent(event: {
  type: string;
  [key: string]: unknown;
}) {
  const data = JSON.stringify({
    ...event,
    timestamp: Date.now(),
  });

  console.log(`[SSE] Broadcasting to ${connections.size} users:`, event.type);

  for (const [userId, userConnections] of connections.entries()) {
    for (const connection of userConnections) {
      try {
        connection.write(`data: ${data}\n\n`);
      } catch (error) {
        console.error(`[SSE] Error broadcasting to user ${userId}:`, error);
      }
    }
  }
}

export default router;
