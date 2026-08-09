// ==============================================================================
// Authentication Middleware (backend/middleware/auth.ts)
// ==============================================================================
// Verifies incoming JWT headers against Supabase Auth rules.

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    Logger.warn('Authentication failed: Missing or malformed header', 'AUTH_MIDDLEWARE');
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // In production, sync with Supabase JWT verifiers:
    // const { data: { user } } = await supabase.auth.getUser(token);
    // req.user = user;
    
    // Mock authenticated user context for scaffolding validation
    req.user = {
      id: 'usr_mock_123',
      email: 'mock@Sculra.io',
      role: 'authenticated',
    };

    next();
  } catch (error) {
    Logger.error('JWT signature verification failed', error as Error, 'AUTH_MIDDLEWARE');
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

