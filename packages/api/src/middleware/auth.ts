/**
 * @fileoverview Authentication Middleware
 * Purpose: Protect routes requiring authentication
 * Max lines: 50
 */

import { Request, Response, NextFunction } from 'express';
import { extractToken, verifyToken } from '../lib/jwt';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
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
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token inválido o expirado',
    });
  }
}
