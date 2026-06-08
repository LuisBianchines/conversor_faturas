import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { registerConvertRoutes } from './routes/convert.routes.js';

const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 20);

const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
  },
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

registerConvertRoutes(app, upload);

app.listen(PORT, () => {
  console.log(`Backend local rodando em http://localhost:${PORT}`);
});
