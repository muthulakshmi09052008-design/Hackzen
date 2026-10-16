import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { CCTVEvent, CCTVTrack, SearchFilterCriteria, VideoMetadata } from '../types.js';

const DB_FILE_PATH = path.resolve(process.cwd(), 'cctv_surveillance.sqlite');

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE_PATH)) {
    const filebuffer = fs.readFileSync(DB_FILE_PATH);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  // Schema creation
  db.run(`
    CREATE TABLE IF NOT EXISTS cctv_videos (
      id TEXT PRIMARY KEY,
      filename TEXT,
      url TEXT,
      duration_sec REAL,
      width INTEGER,
      height INTEGER,
      fps REAL,
      total_frames INTEGER,
      uploaded_at TEXT,
      is_analyzed INTEGER,
      event_count INTEGER,
      track_count INTEGER
    );

    CREATE TABLE IF NOT EXISTS cctv_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT,
      track_id TEXT,
      first_seen_sec REAL,
      last_seen_sec REAL,
      total_dwell_sec REAL,
      zones_visited TEXT,
      shelves_interacted_count INTEGER DEFAULT 0,
      visited_shelf_a_count INTEGER DEFAULT 0,
      items_picked_up_count INTEGER DEFAULT 0,
      items_returned_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cctv_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT,
      track_id TEXT,
      event_type TEXT,
      zone TEXT,
      start_time_sec REAL,
      end_time_sec REAL,
      duration_sec REAL,
      confidence REAL,
      details TEXT,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_events_video ON cctv_events(video_id);
    CREATE INDEX IF NOT EXISTS idx_events_track ON cctv_events(track_id);
    CREATE INDEX IF NOT EXISTS idx_events_type ON cctv_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_events_time ON cctv_events(start_time_sec);
    CREATE INDEX IF NOT EXISTS idx_tracks_video ON cctv_tracks(video_id);
  `);

  // Safe migrations for existing SQLite file on disk
  try {
    db.run(`ALTER TABLE cctv_tracks ADD COLUMN items_picked_up_count INTEGER DEFAULT 0;`);
  } catch {}
  try {
    db.run(`ALTER TABLE cctv_tracks ADD COLUMN items_returned_count INTEGER DEFAULT 0;`);
  } catch {}

  persistDb();
  return db;
}

export function persistDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE_PATH, buffer);
  } catch (err) {
    console.error('Failed to persist SQLite DB to file:', err);
  }
}

export async function saveVideo(video: VideoMetadata) {
  const database = await getDb();
  database.run(
    `INSERT OR REPLACE INTO cctv_videos (
      id, filename, url, duration_sec, width, height, fps, total_frames, uploaded_at, is_analyzed, event_count, track_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      video.id,
      video.filename,
      video.url,
      video.durationSec,
      video.width,
      video.height,
      video.fps,
      video.totalFrames,
      video.uploadedAt,
      video.isAnalyzed ? 1 : 0,
      video.eventCount,
      video.trackCount,
    ]
  );
  persistDb();
}

export async function getAllVideos(): Promise<VideoMetadata[]> {
  const database = await getDb();
  const res = database.exec(`SELECT * FROM cctv_videos ORDER BY uploaded_at DESC`);
  if (!res.length) return [];
  const columns = res[0].columns;
  return res[0].values.map((row) => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      id: obj.id,
      filename: obj.filename,
      url: obj.url,
      durationSec: obj.duration_sec,
      width: obj.width,
      height: obj.height,
      fps: obj.fps,
      totalFrames: obj.total_frames,
      uploadedAt: obj.uploaded_at,
      isAnalyzed: Boolean(obj.is_analyzed),
      eventCount: obj.event_count || 0,
      trackCount: obj.track_count || 0,
    };
  });
}

export async function getVideoById(id: string): Promise<VideoMetadata | null> {
  const database = await getDb();
  const stmt = database.prepare(`SELECT * FROM cctv_videos WHERE id = ?`);
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row: any = stmt.getAsObject();
  stmt.free();
  return {
    id: row.id,
    filename: row.filename,
    url: row.url,
    durationSec: row.duration_sec,
    width: row.width,
    height: row.height,
    fps: row.fps,
    totalFrames: row.total_frames,
    uploadedAt: row.uploaded_at,
    isAnalyzed: Boolean(row.is_analyzed),
    eventCount: row.event_count || 0,
    trackCount: row.track_count || 0,
  };
}

export async function insertBatchEventsAndTracks(
  videoId: string,
  tracks: CCTVTrack[],
  events: Omit<CCTVEvent, 'id'>[]
) {
  const database = await getDb();

  // Clear existing tracks & events for this videoId to support re-analysis
  database.run(`DELETE FROM cctv_tracks WHERE video_id = ?`, [videoId]);
  database.run(`DELETE FROM cctv_events WHERE video_id = ?`, [videoId]);

  // Insert tracks
  for (const t of tracks) {
    database.run(
      `INSERT INTO cctv_tracks (
        video_id, track_id, first_seen_sec, last_seen_sec, total_dwell_sec,
        zones_visited, shelves_interacted_count, visited_shelf_a_count,
        items_picked_up_count, items_returned_count, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        videoId,
        t.trackId,
        t.firstSeenSec,
        t.lastSeenSec,
        t.totalDwellSec,
        JSON.stringify(t.zonesVisited || []),
        t.shelvesInteractedCount || 0,
        t.visitedShelfACount || 0,
        t.itemsPickedUpCount || 0,
        t.itemsReturnedCount || 0,
        t.isActive ? 1 : 0,
      ]
    );
  }

  // Insert events
  const now = new Date().toISOString();
  for (const e of events) {
    database.run(
      `INSERT INTO cctv_events (
        video_id, track_id, event_type, zone, start_time_sec, end_time_sec,
        duration_sec, confidence, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        videoId,
        e.trackId,
        e.eventType,
        e.zone,
        e.startTimeSec,
        e.endTimeSec,
        e.durationSec,
        e.confidence,
        e.details,
        now,
      ]
    );
  }

  // Update video metadata counts
  database.run(
    `UPDATE cctv_videos SET is_analyzed = 1, event_count = ?, track_count = ? WHERE id = ?`,
    [events.length, tracks.length, videoId]
  );

  persistDb();
}

export async function getEvents(videoId?: string, criteria?: SearchFilterCriteria): Promise<CCTVEvent[]> {
  const database = await getDb();
  let sql = `SELECT * FROM cctv_events WHERE 1=1`;
  const params: any[] = [];

  if (videoId) {
    sql += ` AND video_id = ?`;
    params.push(videoId);
  }

  if (criteria?.trackId) {
    sql += ` AND track_id = ?`;
    params.push(criteria.trackId);
  }

  if (criteria?.eventType) {
    sql += ` AND event_type = ?`;
    params.push(criteria.eventType);
  }

  if (criteria?.zone) {
    sql += ` AND zone LIKE ?`;
    params.push(`%${criteria.zone}%`);
  }

  if (criteria?.minDurationSec !== undefined && criteria?.minDurationSec > 0) {
    sql += ` AND duration_sec >= ?`;
    params.push(criteria.minDurationSec);
  }

  if (criteria?.maxDurationSec !== undefined && criteria?.maxDurationSec > 0) {
    sql += ` AND duration_sec <= ?`;
    params.push(criteria.maxDurationSec);
  }

  if (criteria?.timeRange) {
    sql += ` AND start_time_sec >= ? AND start_time_sec <= ?`;
    params.push(criteria.timeRange.start, criteria.timeRange.end);
  }

  sql += ` ORDER BY start_time_sec ASC`;

  const stmt = database.prepare(sql);
  stmt.bind(params);

  const results: CCTVEvent[] = [];
  while (stmt.step()) {
    const row: any = stmt.getAsObject();
    results.push({
      id: row.id,
      videoId: row.video_id,
      trackId: row.track_id,
      eventType: row.event_type,
      zone: row.zone,
      startTimeSec: row.start_time_sec,
      endTimeSec: row.end_time_sec,
      durationSec: row.duration_sec,
      confidence: row.confidence,
      details: row.details,
      createdAt: row.created_at,
    });
  }
  stmt.free();
  return results;
}

export async function getTracks(videoId?: string): Promise<CCTVTrack[]> {
  const database = await getDb();
  let sql = `SELECT * FROM cctv_tracks`;
  const params: any[] = [];
  if (videoId) {
    sql += ` WHERE video_id = ?`;
    params.push(videoId);
  }
  sql += ` ORDER BY id ASC`;

  const stmt = database.prepare(sql);
  stmt.bind(params);
  const results: CCTVTrack[] = [];
  while (stmt.step()) {
    const row: any = stmt.getAsObject();
    let zonesVisited: string[] = [];
    try {
      zonesVisited = JSON.parse(row.zones_visited);
    } catch {
      zonesVisited = [];
    }
    results.push({
      id: row.id,
      trackId: row.track_id,
      videoId: row.video_id,
      firstSeenSec: row.first_seen_sec,
      lastSeenSec: row.last_seen_sec,
      totalDwellSec: row.total_dwell_sec,
      zonesVisited,
      shelvesInteractedCount: row.shelves_interacted_count || 0,
      visitedShelfACount: row.visited_shelf_a_count || 0,
      itemsPickedUpCount: row.items_picked_up_count || 0,
      itemsReturnedCount: row.items_returned_count || 0,
      isActive: Boolean(row.is_active),
    });
  }
  stmt.free();
  return results;
}
