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
    const { email, password, name, acceptedTerms, acceptedPrivacy } = req.body;

    // Validate input
    if (!email || !password || !name) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email, password y nombre son requeridos',
      });
      return;
    }

    // Validate terms acceptance
    if (!acceptedTerms || !acceptedPrivacy) {
      res.status(400).json({
        error: 'Bad Request',
        message:
          'Debe aceptar los Términos y Condiciones y la Política de Privacidad',
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

    // Generate email verification code
    const verificationCode = crypto.randomBytes(32).toString('hex');
    const verificationExp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Hash password
    const salt = generateSalt();
    const hash = hashPassword(password, salt);

    // Create user
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hash,
        passwordSalt: salt,
        role: 'user',
        language: 'es',
        timezone: 'America/Argentina/Buenos_Aires',
        emailVerified: false,
        emailVerificationCode: verificationCode,
        emailVerificationExp: verificationExp,
        acceptedTermsAt: now,
        acceptedPrivacyAt: now,
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

// POST /auth/verify-email - Verify email with code
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email y código son requeridos',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado',
      });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'El email ya está verificado',
      });
      return;
    }

    if (!user.emailVerificationCode || !user.emailVerificationExp) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'No hay código de verificación pendiente',
      });
      return;
    }

    if (new Date() > user.emailVerificationExp) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'El código de verificación ha expirado',
      });
      return;
    }

    if (user.emailVerificationCode !== code) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Código de verificación inválido',
      });
      return;
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExp: null,
      },
    });

    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        type: 'user.email_verified',
        detailsJson: { email },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      message: 'Email verificado exitosamente',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al verificar email',
    });
  }
});

// POST /auth/resend-verification - Resend verification code
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email es requerido',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado',
      });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'El email ya está verificado',
      });
      return;
    }

    // Generate new verification code
    const verificationCode = crypto.randomBytes(32).toString('hex');
    const verificationExp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: verificationCode,
        emailVerificationExp: verificationExp,
      },
    });

    // TODO: Send email with verification code
    console.log(`Verification code for ${email}: ${verificationCode}`);

    res.json({
      message: 'Código de verificación reenviado',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al reenviar código',
    });
  }
});

// POST /auth/forgot-password - Request password reset
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email es requerido',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Don't reveal if user exists
    if (!user) {
      res.json({
        message: 'Si el email existe, recibirás un código de recuperación',
      });
      return;
    }

    // Generate reset code
    const resetCode = crypto.randomBytes(32).toString('hex');
    const resetExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetCode: resetCode,
        passwordResetExp: resetExp,
      },
    });

    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        type: 'user.password_reset_requested',
        detailsJson: { email },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // TODO: Send email with reset code
    console.log(`Password reset code for ${email}: ${resetCode}`);

    res.json({
      message: 'Si el email existe, recibirás un código de recuperación',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al procesar solicitud',
    });
  }
});

// POST /auth/reset-password - Reset password with code
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email, código y nueva contraseña son requeridos',
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'La contraseña debe tener al menos 8 caracteres',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado',
      });
      return;
    }

    if (!user.passwordResetCode || !user.passwordResetExp) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'No hay código de recuperación pendiente',
      });
      return;
    }

    if (new Date() > user.passwordResetExp) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'El código de recuperación ha expirado',
      });
      return;
    }

    if (user.passwordResetCode !== code) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Código de recuperación inválido',
      });
      return;
    }

    // Hash new password
    const salt = generateSalt();
    const hash = hashPassword(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        passwordSalt: salt,
        passwordResetCode: null,
        passwordResetExp: null,
      },
    });

    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        type: 'user.password_reset_completed',
        detailsJson: { email },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      message: 'Contraseña actualizada exitosamente',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al restablecer contraseña',
    });
  }
});

export default router;
