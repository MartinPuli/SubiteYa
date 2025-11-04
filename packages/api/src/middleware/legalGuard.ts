import { Request, Response, NextFunction } from 'express';
import { TERMS_VERSION, PRIVACY_VERSION, LegalDoc } from '../constants/legal';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    acceptedTermsVersion?: string | null;
    acceptedPrivacyVersion?: string | null;
  };
}

/**
 * Middleware to check if user has accepted current legal documents
 * Returns 428 Precondition Required if re-acceptance needed
 */
export function requireLegalAcceptance() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { acceptedTermsVersion, acceptedPrivacyVersion } = req.user;

    // Check if terms need re-acceptance
    if (!acceptedTermsVersion || acceptedTermsVersion !== TERMS_VERSION) {
      return res.status(428).json({
        reacceptRequired: true,
        doc: 'terms' as LegalDoc,
        requiredVersion: TERMS_VERSION,
        message: 'You must accept the updated Terms and Conditions',
      });
    }

    // Check if privacy policy needs re-acceptance
    if (!acceptedPrivacyVersion || acceptedPrivacyVersion !== PRIVACY_VERSION) {
      return res.status(428).json({
        reacceptRequired: true,
        doc: 'privacy' as LegalDoc,
        requiredVersion: PRIVACY_VERSION,
        message: 'You must accept the updated Privacy Policy',
      });
    }

    next();
  };
}

/**
 * Helper to check legal acceptance status without blocking
 */
export function checkLegalAcceptance(user: {
  acceptedTermsVersion?: string | null;
  acceptedPrivacyVersion?: string | null;
}): { needsReaccept: boolean; doc?: LegalDoc; version?: string } {
  if (
    !user.acceptedTermsVersion ||
    user.acceptedTermsVersion !== TERMS_VERSION
  ) {
    return {
      needsReaccept: true,
      doc: 'terms',
      version: TERMS_VERSION,
    };
  }

  if (
    !user.acceptedPrivacyVersion ||
    user.acceptedPrivacyVersion !== PRIVACY_VERSION
  ) {
    return {
      needsReaccept: true,
      doc: 'privacy',
      version: PRIVACY_VERSION,
    };
  }

  return { needsReaccept: false };
}
