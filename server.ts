import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { handleAssistantQuery, handleAiParseItem } from './src/server/assistantHandler.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'DDLC AI Inventory Backend' });
  });

  // AI Assistant endpoint
  app.post('/api/assistant', async (req, res) => {
    try {
      const result = await handleAssistantQuery(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('AI Assistant API Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // Firebase Status & Diagnostics
  app.get('/api/firebase-status', (req, res) => {
    res.json({
      configured: true,
      projectId: 'seraphic-flare-f224x',
      databaseId: 'ai-studio-1a2821a5-98f6-4b10-b864-7ab9c4f566b9',
      status: 'online',
      service: 'Cloud Firestore Enterprise',
      timestamp: new Date().toISOString(),
    });
  });

  // AI Item Parsing endpoint
  app.post('/api/ai-parse-item', async (req, res) => {
    try {
      const result = await handleAiParseItem(req.body?.prompt || '', req.body?.projectList || []);
      res.json(result);
    } catch (error: any) {
      console.error('AI Parse Item API Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`DDLC AI server running on port ${PORT}`);
  });
}

startServer();
