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

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // File path for persistent active server configuration and presentation files
  const DATA_DIR = path.resolve(__dirname, 'data');
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (_) {}
  }
  const PRESENTATIONS_DIR = path.resolve(DATA_DIR, 'presentations');
  if (!fs.existsSync(PRESENTATIONS_DIR)) {
    try {
      fs.mkdirSync(PRESENTATIONS_DIR, { recursive: true });
    } catch (_) {}
  }

  // Pre-seed sample presentation if available
  try {
    const sampleSrc = path.resolve(__dirname, 'public/assets/aistudio/Trinh_chieu_001_f1f3b979.html');
    const sampleDst = path.resolve(PRESENTATIONS_DIR, 'lec_presentation_1.html');
    if (fs.existsSync(sampleSrc) && !fs.existsSync(sampleDst)) {
      fs.copyFileSync(sampleSrc, sampleDst);
    }
  } catch (_) {}

  const CONFIG_FILE = path.resolve(DATA_DIR, 'active_server_config.json');

  // API Route: Upload Presentation HTML
  app.post('/api/upload-presentation', (req, res) => {
    try {
      const { id, filename, content } = req.body;
      if (!id || !content) {
        return res.status(400).json({ success: false, error: 'Thiếu id hoặc nội dung tệp HTML' });
      }
      const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
      const filePath = path.resolve(PRESENTATIONS_DIR, `${safeId}.html`);
      fs.writeFileSync(filePath, content, 'utf-8');
      
      const serverUrl = `/api/presentations/${safeId}.html`;
      return res.json({
        success: true,
        id: safeId,
        filename: filename || `${safeId}.html`,
        url: serverUrl,
        size: Buffer.byteLength(content, 'utf-8')
      });
    } catch (e: any) {
      console.error('Error saving presentation:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // API Route: Get Presentation HTML
  app.get('/api/presentations/:filename', (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.resolve(PRESENTATIONS_DIR, filename);

      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(filePath);
      }

      // Fallback: check public/assets/aistudio/
      const fallbackPublic = path.resolve(__dirname, 'public/assets/aistudio', filename);
      if (fs.existsSync(fallbackPublic)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.sendFile(fallbackPublic);
      }

      // Check if filename is Trinh_chieu_001 or sample
      if (filename.includes('Trinh_chieu_001') || filename === 'lec_presentation_1.html') {
        const sampleFile = path.resolve(__dirname, 'public/assets/aistudio/Trinh_chieu_001_f1f3b979.html');
        if (fs.existsSync(sampleFile)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.sendFile(sampleFile);
        }
      }

      return res.status(404).send('Không tìm thấy tệp trình chiếu');
    } catch (e: any) {
      return res.status(500).send('Lỗi máy chủ khi đọc trình chiếu: ' + e.message);
    }
  });

  // API Route: Delete Presentation HTML
  app.delete('/api/presentations/:filename', (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.resolve(PRESENTATIONS_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

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
