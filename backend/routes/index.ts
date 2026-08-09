// ==============================================================================
// Express Route Index Mapper (backend/routes/index.ts)
// ==============================================================================

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/security';

const router = Router();

// Apply global rate limits
router.use(rateLimiter);

// 1. Healthcheck Route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 2. Authentication Sync Webhooks
// router.post('/auth/sync', authController.syncProfile);

// 3. Project Configuration Routes
// router.get('/projects', requireAuth, projectsController.listProjects);
// router.post('/projects', requireAuth, projectsController.createProject);

// 4. Test execution dispatcher
// router.post('/projects/:projectId/test-runs', requireAuth, testingController.triggerTestRun);

export default router;
