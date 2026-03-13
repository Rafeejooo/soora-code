import { Router, Request, Response } from 'express';
import {
  saveHistory,
  getUserHistory,
  getInProgress,
  getEntry,
  deleteEntry,
  clearUserHistory,
  HistoryEntry,
} from '../services/historyService';

const router = Router();

/**
 * POST /history/save
 * Save or update a watch progress entry.
 * Body: HistoryEntry (userId required)
 */
router.post('/save', (req: Request, res: Response) => {
  const entry: HistoryEntry = req.body;

  if (!entry.userId || !entry.id || !entry.type) {
    return res.status(400).json({ error: 'Missing required fields: userId, id, type' });
  }
  if (entry.progress < 0 || entry.progress > 1) {
    return res.status(400).json({ error: 'progress must be between 0 and 1' });
  }

  saveHistory(entry);
  res.json({ ok: true });
});

/**
 * GET /history?userId=
 * Get all history for a user.
 */
router.get('/', (req: Request, res: Response) => {
  const userId = String(req.query.userId || '');
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const history = getUserHistory(userId);
  res.json(history);
});

/**
 * GET /history/inprogress?userId=
 * Get in-progress entries (5%-90%) for "Continue Watching".
 */
router.get('/inprogress', (req: Request, res: Response) => {
  const userId = String(req.query.userId || '');
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const items = getInProgress(userId);
  res.json(items);
});

/**
 * GET /history/entry?userId=&id=&episode=
 * Get a specific entry (for resume prompt on Watch page).
 */
router.get('/entry', (req: Request, res: Response) => {
  const userId = String(req.query.userId || '');
  const id = String(req.query.id || '');
  const episode = req.query.episode ? parseInt(String(req.query.episode)) : undefined;

  if (!userId || !id) return res.status(400).json({ error: 'Missing userId or id' });

  const entry = getEntry(userId, id, episode);
  res.json(entry || null);
});

/**
 * DELETE /history/entry?userId=&id=&episode=
 * Delete a specific entry.
 */
router.delete('/entry', (req: Request, res: Response) => {
  const userId = String(req.query.userId || '');
  const id = String(req.query.id || '');
  const episode = req.query.episode ? parseInt(String(req.query.episode)) : undefined;

  if (!userId || !id) return res.status(400).json({ error: 'Missing userId or id' });

  deleteEntry(userId, id, episode);
  res.json({ ok: true });
});

/**
 * DELETE /history?userId=
 * Clear all history for a user.
 */
router.delete('/', (req: Request, res: Response) => {
  const userId = String(req.query.userId || '');
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  clearUserHistory(userId);
  res.json({ ok: true });
});

export default router;
