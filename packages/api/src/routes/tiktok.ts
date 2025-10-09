/**
 * @fileoverview TikTok OAuth Routes
 * Purpose: Handle TikTok OAuth flow and token management
 * Max lines: 250
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';
const TIKTOK_REDIRECT_URI =
  process.env.TIKTOK_REDIRECT_URI ||
  'http://localhost:3000/api/auth/tiktok/callback';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  'https://martinpuli.github.io/SubiteYa/connections';

// Encrypt token using AES-256-GCM
function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
    iv
  );

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

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

// GET /auth/tiktok - Initiate OAuth flow
router.get('/tiktok', authenticate, (req: AuthRequest, res: Response) => {
  try {
    if (!TIKTOK_CLIENT_KEY) {
      res.status(500).json({
        error: 'TikTok OAuth not configured',
        message: 'TIKTOK_CLIENT_KEY is missing in environment variables',
      });
      return;
    }

    // Generate CSRF token
    const csrfState = crypto.randomBytes(16).toString('hex');

    // Store state in session or temporary storage
    // For now, we'll pass user ID in state (in production use Redis/session)
    const state = Buffer.from(
      JSON.stringify({
        csrf: csrfState,
        userId: req.user!.userId,
      })
    ).toString('base64');

    // Request user info and video publishing permissions
    // video.publish scope is required for Content Posting API
    const scopes = ['user.info.basic', 'video.publish'];

    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.set('client_key', TIKTOK_CLIENT_KEY);
    authUrl.searchParams.set('scope', scopes.join(','));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', TIKTOK_REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    // Siempre mostrar pantalla de autorización para permitir múltiples cuentas
    authUrl.searchParams.set('disable_auto_auth', '1');

    // Return the auth URL instead of redirecting
    res.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error('TikTok OAuth initiation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al iniciar OAuth de TikTok',
    });
  }
});

// GET /auth/tiktok/callback - Handle OAuth callback
router.get('/tiktok/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Check for OAuth errors
    if (error) {
      console.error('TikTok OAuth error:', error, error_description);
      res.redirect(`${FRONTEND_URL}/connections?error=${error}`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Authorization code is missing',
      });
      return;
    }

    // Verify state
    if (!state || typeof state !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'State parameter is missing',
      });
      return;
    }

    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const userId = stateData.userId;

    // Exchange code for access token
    const tokenResponse = await fetch(
      'https://open.tiktokapis.com/v2/oauth/token/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_key: TIKTOK_CLIENT_KEY,
          client_secret: TIKTOK_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: TIKTOK_REDIRECT_URI,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('TikTok token exchange error:', errorData);
      res.redirect(`${FRONTEND_URL}/connections?error=token_exchange_failed`);
      return;
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      open_id: string;
      scope: string;
    };

    const { access_token, refresh_token, expires_in, open_id, scope } =
      tokenData;

    // Get user info - IMPORTANTE: TikTok requiere especificar los campos
    const userInfoUrl = new URL('https://open.tiktokapis.com/v2/user/info/');
    userInfoUrl.searchParams.set(
      'fields',
      'open_id,union_id,avatar_url,avatar_url_100,display_name'
    );

    const userInfoResponse = await fetch(userInfoUrl.toString(), {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('TikTok user info error:', await userInfoResponse.text());
    }

    const userInfo = (await userInfoResponse.json()) as {
      data?: {
        user?: {
          display_name?: string;
          avatar_url?: string;
          avatar_url_100?: string;
          union_id?: string;
        };
      };
      error?: {
        code?: string;
        message?: string;
      };
    };

    console.log(
      'TikTok user info response:',
      JSON.stringify(userInfo, null, 2)
    );

    const userData = userInfo.data?.user || {};
    const avatarUrl = userData.avatar_url_100 || userData.avatar_url || null;

    // Save connection to database
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await prisma.tikTokConnection.upsert({
      where: { openId: open_id },
      create: {
        userId,
        openId: open_id,
        displayName: userData.display_name || 'TikTok User',
        avatarUrl: avatarUrl,
        scopeGranted: scope.split(','),
        accessTokenEnc: encryptToken(access_token),
        refreshTokenEnc: encryptToken(refresh_token),
        expiresAt,
        isDefault: false,
      },
      update: {
        displayName: userData.display_name || 'TikTok User',
        avatarUrl: avatarUrl,
        scopeGranted: scope.split(','),
        accessTokenEnc: encryptToken(access_token),
        refreshTokenEnc: encryptToken(refresh_token),
        expiresAt,
      },
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        userId,
        type: 'tiktok.connected',
        detailsJson: {
          openId: open_id,
          displayName: userData.display_name,
          scopes: scope.split(','),
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Redirect to frontend
    res.redirect(`${FRONTEND_URL}/connections`);
  } catch (error) {
    console.error('TikTok callback error:', error);
    res.redirect(`${FRONTEND_URL}/connections`);
  }
});

// POST /auth/tiktok/refresh - Refresh access token
router.post(
  '/tiktok/refresh',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { connectionId } = req.body;
      const userId = req.user!.userId;

      const connection = await prisma.tikTokConnection.findFirst({
        where: { id: connectionId, userId },
      });

      if (!connection) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Conexión no encontrada',
        });
        return;
      }

      const refreshToken = decryptToken(connection.refreshTokenEnc);

      const tokenResponse = await fetch(
        'https://open.tiktokapis.com/v2/oauth/token/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_key: TIKTOK_CLIENT_KEY,
            client_secret: TIKTOK_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        }
      );

      if (!tokenResponse.ok) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Error al renovar token',
        });
        return;
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      await prisma.tikTokConnection.update({
        where: { id: connectionId },
        data: {
          accessTokenEnc: encryptToken(tokenData.access_token),
          refreshTokenEnc: encryptToken(tokenData.refresh_token),
          expiresAt,
        },
      });

      res.json({ message: 'Token renovado exitosamente' });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Error al renovar token',
      });
    }
  }
);

export default router;
