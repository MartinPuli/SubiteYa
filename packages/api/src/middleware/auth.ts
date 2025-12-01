/**
 * @fileoverview Authentication Middleware
 * Purpose: Protect routes requiring authentication
 * Max lines: 80
 */

import { Request, Response, NextFunction } from 'express';
import { extractToken, verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    acceptedTermsVersion?: string | null;
    acceptedPrivacyVersion?: string | null;
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token de autenticación requerido',
      });
      return;
    }

    const payload = verifyToken(token);

    // Fetch user with legal acceptance data
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        acceptedTermsVersion: true,
        acceptedPrivacyVersion: true,
      },
    });

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no encontrado',
      });
      return;
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      acceptedTermsVersion: user.acceptedTermsVersion,
      acceptedPrivacyVersion: user.acceptedPrivacyVersion,
    };

    if (req.context) {
      req.context.userId = user.id;
    }

    if (req.logger) {
      req.logger = req.logger.child({
        userId: user.id,
      });
    }

    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token inválido o expirado',
    });
  }
}
