// ==============================================================================
// Security Middleware (backend/middleware/security.ts)
// ==============================================================================
// Configures secure headers, rate limits, CORS configurations,
// and Role-Based Access Control (RBAC) validations.

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger';
import { AuthenticatedRequest } from './auth';

/**
 * Configure Strict Security HTTP Headers
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';"
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  next();
}

/**
 * CORS Middleware Configuration
 */
export function corsConfig(req: Request, res: Response, next: NextFunction) {
  const allowedOrigins = [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-API-Key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}

/**
 * Rate Limiting (Token Bucket Scaffold)
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  // In production, sync with Redis cache bucket limits:
  // const clientIp = req.ip;
  // const rateDetails = await redis.get(`limit:${clientIp}`);
  next();
}

/**
 * Role-Based Access Control Validator
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const hasRole = allowedRoles.includes(req.user.role);
    if (!hasRole) {
      Logger.warn(
        `Access denied: User ${req.user.id} requested roles ${allowedRoles.join(', ')}`,
        'RBAC'
      );
      return res.status(403).json({ error: 'Access Denied: Insufficient privileges' });
    }

    next();
  };
}
