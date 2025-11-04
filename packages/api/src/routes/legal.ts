/**
 * @fileoverview Legal Acceptance Routes
 * Purpose: Handle terms and privacy policy acceptance
 * Endpoints: POST /legal/accept, GET /legal/status
 */

import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logAuditEvent } from '../services/audit';
import { TERMS_VERSION, PRIVACY_VERSION, LegalDoc } from '../constants/legal';

const router = express.Router();

/**
 * POST /legal/accept
 * Accept or re-accept a legal document
 */
router.post(
  '/accept',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { doc, version } = req.body as { doc: LegalDoc; version: string };

      if (!doc || !version) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'doc and version are required',
        });
      }

      if (doc !== 'terms' && doc !== 'privacy') {
        return res.status(400).json({
          error: 'Invalid doc type',
          message: 'doc must be either "terms" or "privacy"',
        });
      }

      const userId = req.user!.userId;

      // Check if this is first acceptance or re-acceptance
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          acceptedTermsVersion: true,
          acceptedPrivacyVersion: true,
        },
      });

      const isReacceptance =
        doc === 'terms'
          ? !!currentUser?.acceptedTermsVersion
          : !!currentUser?.acceptedPrivacyVersion;

      // Update user record
      const updateData: any = {};
      if (doc === 'terms') {
        updateData.acceptedTermsVersion = version;
        updateData.acceptedTermsAt = new Date();
      } else {
        updateData.acceptedPrivacyVersion = version;
        updateData.acceptedPrivacyAt = new Date();
      }

      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      // Log audit event
      await logAuditEvent(
        userId,
        isReacceptance ? 'legal.reaccepted' : 'legal.accepted',
        { doc, version },
        req.ip,
        req.get('user-agent')
      );

      res.json({
        success: true,
        doc,
        version,
        acceptedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error accepting legal document:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to record legal acceptance',
      });
    }
  }
);

/**
 * GET /legal/status
 * Get current legal acceptance status
 */
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        acceptedTermsVersion: true,
        acceptedPrivacyVersion: true,
        acceptedTermsAt: true,
        acceptedPrivacyAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const termsAccepted = user.acceptedTermsVersion === TERMS_VERSION;
    const privacyAccepted = user.acceptedPrivacyVersion === PRIVACY_VERSION;

    res.json({
      terms: {
        currentVersion: TERMS_VERSION,
        acceptedVersion: user.acceptedTermsVersion,
        acceptedAt: user.acceptedTermsAt,
        needsReaccept: !termsAccepted,
      },
      privacy: {
        currentVersion: PRIVACY_VERSION,
        acceptedVersion: user.acceptedPrivacyVersion,
        acceptedAt: user.acceptedPrivacyAt,
        needsReaccept: !privacyAccepted,
      },
      allAccepted: termsAccepted && privacyAccepted,
    });
  } catch (error) {
    console.error('Error checking legal status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to check legal status',
    });
  }
});

export default router;
