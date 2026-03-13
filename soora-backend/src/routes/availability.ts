import { Router } from 'express';
import { markAvailability, isAvailable, getAvailabilityStats } from '../services/availability';

const router = Router();

/**
 * POST /availability/report
 * Client reports whether a content item has working streams.
 * Fire-and-forget from the frontend.
 */
router.post('/report', (req, res) => {
  const { type, id, available } = req.body;
  if (!type || !id || typeof available !== 'boolean') {
    return res.status(400).json({ error: 'Missing type, id, or available (boolean)' });
  }
  if (type !== 'anime' && type !== 'movie') {
    return res.status(400).json({ error: 'type must be "anime" or "movie"' });
  }
  markAvailability(type, String(id), available);
  res.json({ ok: true });
});

/**
 * GET /availability/check/:type/:id
 * Debug endpoint to check availability status.
 */
router.get('/check/:type/:id', (req, res) => {
  const { type, id } = req.params;
  if (type !== 'anime' && type !== 'movie') {
    return res.status(400).json({ error: 'type must be "anime" or "movie"' });
  }
  const result = isAvailable(type, id);
  res.json({ type, id, available: result });
});

/**
 * GET /availability/stats
 * Debug endpoint for cache stats.
 */
router.get('/stats', (_req, res) => {
  res.json(getAvailabilityStats());
});

export default router;
