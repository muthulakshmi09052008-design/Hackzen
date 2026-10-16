import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { ensureBenchmarkDataSeeded } from './server/sampleData.js';
import { getAllVideos, getEvents, getTracks, getVideoById, insertBatchEventsAndTracks, saveVideo } from './server/db.js';
import { processNaturalLanguageSearch } from './server/gemini.js';
import { VideoMetadata } from './types.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Ensure uploads folder exists
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `cctv-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 150 * 1024 * 1024, // 150 MB max
  },
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

// Seed default benchmark CCTV surveillance footage if needed
ensureBenchmarkDataSeeded().catch((err) => {
  console.error('Failed to seed benchmark data:', err);
});

// --- API Endpoints ---

// List all videos
app.get('/api/videos', async (_req, res) => {
  try {
    const videos = await getAllVideos();
    res.json({ success: true, videos });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get video by ID
app.get('/api/videos/:id', async (req, res) => {
  try {
    const video = await getVideoById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    res.json({ success: true, video });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload a new video
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const videoId = `vid_${Date.now()}`;
    const filename = req.file.originalname;
    const url = `/uploads/${req.file.filename}`;
    const durationSec = req.body.duration ? parseFloat(req.body.duration) : 60;
    const width = req.body.width ? parseInt(req.body.width, 10) : 1280;
    const height = req.body.height ? parseInt(req.body.height, 10) : 720;
    const fps = req.body.fps ? parseFloat(req.body.fps) : 30;

    const videoMetadata: VideoMetadata = {
      id: videoId,
      filename,
      url,
      durationSec,
      width,
      height,
      fps,
      totalFrames: Math.round(durationSec * fps),
      uploadedAt: new Date().toISOString(),
      isAnalyzed: false,
      eventCount: 0,
      trackCount: 0,
    };

    await saveVideo(videoMetadata);

    res.json({ success: true, video: videoMetadata });
  } catch (err: any) {
    console.error('Upload failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save analyzed events and tracks for a video
app.post('/api/save-analysis', async (req, res) => {
  try {
    const { videoId, tracks, events } = req.body;
    if (!videoId || !tracks || !events) {
      return res.status(400).json({ success: false, error: 'Missing videoId, tracks, or events' });
    }

    await insertBatchEventsAndTracks(videoId, tracks, events);
    const updatedVideo = await getVideoById(videoId);

    res.json({
      success: true,
      message: `Successfully indexed ${events.length} events and ${tracks.length} tracks into SQLite database.`,
      video: updatedVideo,
    });
  } catch (err: any) {
    console.error('Save analysis failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get events with optional filters
app.get('/api/events', async (req, res) => {
  try {
    const { videoId, trackId, eventType, zone, minDuration, maxDuration } = req.query;
    const criteria: any = {};
    if (trackId) criteria.trackId = String(trackId);
    if (eventType) criteria.eventType = String(eventType);
    if (zone) criteria.zone = String(zone);
    if (minDuration) criteria.minDurationSec = parseFloat(String(minDuration));
    if (maxDuration) criteria.maxDurationSec = parseFloat(String(maxDuration));

    const events = await getEvents(videoId ? String(videoId) : undefined, criteria);
    res.json({ success: true, count: events.length, events });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get tracks for video
app.get('/api/tracks', async (req, res) => {
  try {
    const { videoId } = req.query;
    const tracks = await getTracks(videoId ? String(videoId) : undefined);
    res.json({ success: true, count: tracks.length, tracks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Natural Language Search endpoint using Gemini and SQLite
app.post('/api/search', async (req, res) => {
  try {
    const { query, videoId } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Query string is required' });
    }

    const searchResult = await processNaturalLanguageSearch(query.trim(), videoId);
    res.json({ success: true, ...searchResult });
  } catch (err: any) {
    console.error('Search endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Python CV integration export: export current SQLite database as JSON for Python YOLO / DeepSORT sync
app.get('/api/export-cctv-db', async (_req, res) => {
  try {
    const videos = await getAllVideos();
    const tracks = await getTracks();
    const events = await getEvents();
    res.json({ success: true, videos, tracks, events });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CCTV Vision Search Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server boot error:', err);
});
