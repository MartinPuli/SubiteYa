/**
 * @fileoverview Design Profile Routes
 * Purpose: Manage design patterns per TikTok account
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { DesignSpec, EXAMPLE_TIKTOK_DESIGN } from '../lib/design-schema';
import { createId } from '@paralleldrive/cuid2';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /accounts/:id/design - Get active design for account
router.get('/:id/design', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id: accountId } = req.params;

    // Verify account belongs to user
    const account = await prisma.tikTokConnection.findFirst({
      where: { id: accountId, userId },
      include: {
        design: true,
      },
    });

    if (!account) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Cuenta no encontrada',
      });
      return;
    }

    if (!account.design) {
      res.json({
        design: null,
        message: 'No hay diseño activo para esta cuenta',
      });
      return;
    }

    res.json({
      design: {
        id: account.design.id,
        name: account.design.name,
        version: account.design.version,
        spec: account.design.specJson,
        active: account.design.active,
        createdAt: account.design.createdAt,
        updatedAt: account.design.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get design error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener diseño',
    });
  }
});

// POST /accounts/:id/design - Set/update design for account
router.post('/:id/design', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id: accountId } = req.params;
    const { name, spec, createNew = false } = req.body;

    // Verify account belongs to user
    const account = await prisma.tikTokConnection.findFirst({
      where: { id: accountId, userId },
      include: {
        design: true,
      },
    });

    if (!account) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Cuenta no encontrada',
      });
      return;
    }

    // Validate spec with Zod
    const validationResult = DesignSpec.safeParse(
      spec || EXAMPLE_TIKTOK_DESIGN
    );

    if (!validationResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Especificación de diseño inválida',
        details: validationResult.error.issues,
      });
      return;
    }

    const validatedSpec = validationResult.data;

    let design;

    if (createNew || !account.design) {
      // Create new design profile
      design = await prisma.designProfile.create({
        data: {
          id: createId(),
          userId,
          name: name || 'Diseño Sin Nombre',
          version: 1,
          specJson: validatedSpec as any,
          active: true,
        },
      });

      // Link to account
      await prisma.tikTokConnection.update({
        where: { id: accountId },
        data: { designId: design.id },
      });

      console.log(
        `[Design] Created new profile ${design.id} for account ${accountId}`
      );
    } else {
      // Update existing design (increment version)
      design = await prisma.designProfile.update({
        where: { id: account.design.id },
        data: {
          name: name || account.design.name,
          specJson: validatedSpec as any,
          version: { increment: 1 },
        },
      });

      console.log(
        `[Design] Updated profile ${design.id} to v${design.version}`
      );
    }

    res.json({
      design: {
        id: design.id,
        name: design.name,
        version: design.version,
        spec: design.specJson,
        active: design.active,
        createdAt: design.createdAt,
        updatedAt: design.updatedAt,
      },
    });
  } catch (error) {
    console.error('Set design error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al establecer diseño',
    });
  }
});

// GET /accounts/:id/designs - List all design versions for account
router.get('/:id/designs', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id: accountId } = req.params;

    // Verify account belongs to user
    const account = await prisma.tikTokConnection.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Cuenta no encontrada',
      });
      return;
    }

    // Get all designs for this user
    const designs = await prisma.designProfile.findMany({
      where: { userId },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
    });

    res.json({
      designs: designs.map(d => ({
        id: d.id,
        name: d.name,
        version: d.version,
        active: d.active,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (error) {
    console.error('List designs error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al listar diseños',
    });
  }
});

export default router;
