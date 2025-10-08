/**
 * @fileoverview Auth Routes
 * Purpose: User registration and login
 * Max lines: 200
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import crypto from 'crypto';

function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const passwordHash = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(passwordHash));
}

const router = Router();

// POST /auth/register - User registration
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email, password y nombre son requeridos',
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'La contraseña debe tener al menos 8 caracteres',
      });
      return;
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({
        error: 'Conflict',
        message: 'El email ya está registrado',
      });
      return;
    }

    // Hash password
    const salt = generateSalt();
    const hash = hashPassword(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hash,
        passwordSalt: salt,
        role: 'user',
        language: 'es',
        timezone: 'America/Argentina/Buenos_Aires',
      },
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        type: 'user.registered',
        detailsJson: { email, name },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Generate token
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al registrar usuario',
    });
  }
});

// POST /auth/login - User login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email y password son requeridos',
      });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Credenciales inválidas',
      });
      return;
    }

    // Verify password
    const isValid = verifyPassword(
      password,
      user.passwordSalt,
      user.passwordHash
    );

    if (!isValid) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Credenciales inválidas',
      });
      return;
    }

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        type: 'user.login',
        detailsJson: { email },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Generate token
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al iniciar sesión',
    });
  }
});

// GET /auth/me - Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Token requerido' });
      return;
    }

    const { verifyToken } = await import('../lib/jwt');
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        language: true,
        timezone: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

export default router;
