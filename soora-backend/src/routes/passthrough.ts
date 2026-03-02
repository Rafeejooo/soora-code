import { Router, Request, Response } from 'express';
import * as consumet from '../services/consumet';

const router = Router();

/**
 * Catch-all passthrough to Consumet API.
 * Any route not handled by orchestrated routes gets forwarded directly.
 * This ensures backwards compatibility with existing frontend calls.
 */
router.all('/*', async (req: Request, res: Response) => {
  try {
    const path = req.path;
    const params = req.query as Record<string, any>;
    const data = await consumet.passthrough(path, params);
    res.json(data);
  } catch (err: any) {
    const status = err.response?.status || 500;
    const message = err.response?.data || { error: 'Passthrough failed' };
    res.status(status).json(message);
  }
});

export default router;
