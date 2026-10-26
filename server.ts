import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));

  // File path for persistent active server configuration
  const DATA_DIR = path.resolve(__dirname, 'data');
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (_) {}
  }
  const CONFIG_FILE = path.resolve(DATA_DIR, 'active_server_config.json');

  // API Route: Get Active Server Config
  app.get('/api/server-config', (_req, res) => {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return res.json({
          success: true,
          config: JSON.parse(raw),
          appUrl: process.env.APP_URL || ''
        });
      }
      return res.json({ success: true, config: null, appUrl: process.env.APP_URL || '' });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // API Route: Save or Remove Active Server Config
  app.post('/api/server-config', (req, res) => {
    try {
      const { config } = req.body;
      if (config && typeof config === 'object') {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        return res.json({ success: true, message: 'Server configuration saved' });
      } else {
        if (fs.existsSync(CONFIG_FILE)) {
          fs.unlinkSync(CONFIG_FILE);
        }
        return res.json({ success: true, message: 'Server configuration cleared' });
      }
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount Vite middlewares in development
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      app.use(express.static(__dirname));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(__dirname, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
