import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { clearCache, getCacheStats } from './services/cache';

// Routes
import animeRoutes from './routes/anime';
import movieRoutes from './routes/movies';
import mangaRoutes from './routes/manga';
import doujindesuRoutes from './routes/doujindesu';
import komikplusRoutes from './routes/komikplus';
import proxyRoutes from './routes/proxy';
import historyRoutes from './routes/history';

const app = express();

// ========== MIDDLEWARE ==========
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors({
  origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(','),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Request logging (lightweight)
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 100) { // Only log slow requests
      console.log(`${req.method} ${req.path} ${_res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// ========== HEALTH & STATUS ==========
app.get('/', (_req, res) => {
  res.json({
    name: 'Soora Backend',
    version: '1.0.0',
    status: 'ok',
    consumet: config.consumetUrl,
    tmdb: config.tmdbKey ? 'configured' : 'missing',
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/cache/stats', (_req, res) => {
  res.json(getCacheStats());
});

app.post('/cache/clear', (_req, res) => {
  clearCache();
  res.json({ message: 'Cache cleared' });
});

// ========== ORCHESTRATED ROUTES ==========
// These routes aggregate multiple API calls into single responses
app.use('/anime', animeRoutes);
app.use('/movies', movieRoutes);
app.use('/manga', mangaRoutes);
app.use('/doujindesu', doujindesuRoutes);
app.use('/komikplus', komikplusRoutes);

// ========== PROXY ROUTES ==========
app.use('/proxy', proxyRoutes);

// ========== WATCH HISTORY ==========
app.use('/history', historyRoutes);

// Manga image proxy (separate mount point)
import { default as proxyRouter } from './routes/proxy';
app.get('/manga-img', async (req, res) => {
  const targetUrl = String(req.query.url || '');
  if (!targetUrl) return res.status(400).send('Missing url');
  try {
    const axios = (await import('axios')).default;
    const response = await axios.get(targetUrl, {
      headers: { 'Referer': 'https://mangapill.com/', 'User-Agent': 'Mozilla/5.0' },
      responseType: 'arraybuffer', timeout: 15000,
    });
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(response.data));
  } catch { res.status(502).send('Image proxy error'); }
});

// ========== GLOBAL PASSTHROUGH ==========
// Any route not handled by orchestrated routes gets forwarded to Consumet directly.
// This ensures existing frontend calls still work during migration.
app.use('*', async (req, res, next) => {
  // Skip if already handled or is an internal route
  if (req.originalUrl === '/' || req.originalUrl === '/health' || req.originalUrl.startsWith('/cache')) {
    return next();
  }
  try {
    const { passthrough } = await import('./services/consumet');
    const data = await passthrough(req.originalUrl.split('?')[0], req.query as Record<string, any>);
    res.json(data);
  } catch (err: any) {
    const status = err.response?.status || 502;
    const message = err.response?.data || { error: 'Upstream error' };
    res.status(status).json(message);
  }
});

// ========== ERROR HANDLING ==========
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message || err);
  res.status(err.status || 500).json({
    error: config.nodeEnv === 'development' ? err.message : 'Internal server error',
  });
});

// ========== START ==========
app.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 Soora Backend running on http://0.0.0.0:${config.port}`);
  console.log(`   Consumet API: ${config.consumetUrl}`);
  console.log(`   TMDB Key: ${config.tmdbKey ? '✓ configured' : '✗ missing'}`);
  console.log(`   CORS: ${config.corsOrigin}`);
  console.log(`   Environment: ${config.nodeEnv}`);
});

export default app;
