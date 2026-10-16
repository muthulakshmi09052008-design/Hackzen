# Python Computer Vision Service for CCTV Surveillance

This module allows a four-member student team to run local or edge-based Computer Vision processing with **YOLOv8** and **OpenCV**, automatically syncing detected tracks and timestamped events into the AI Studio prototype.

---

## 1. System Architecture & Flow

```
[ CCTV Video (.mp4) ]
         │
         ▼
[ Python / YOLOv8 Detection ] ── (Detects class 0 'person' bounding boxes)
         │
         ▼
[ ByteTrack / Centroid Tracker ] ── (Assigns persistent Track IDs: #101, #102...)
         │
         ▼
[ Zone Dwell & State Machine ] ── (Checks Shelf A, Shelf B, Checkout Counter)
         │
         ▼
[ JSON Payload Generator ] ── (Generates timestamped event records)
         │
         ▼ HTTP POST /api/save-analysis
[ AI Studio Web Application ] ── (Indexes into SQLite database)
         │
         ▼
[ Gemini 3.8 Flash NL Search ] ── (Answers natural language queries)
```

---

## 2. Prerequisites & Installation

```bash
# Ensure Python 3.9+ is installed
python --version

# Install dependencies
pip install ultralytics opencv-python requests
```

---

## 3. Running the Tracking Script

```bash
# 1. Make sure your web app server is running on http://localhost:3000
# 2. Run the tracking script on any CCTV video file:
python cv_pipeline.py --video /path/to/cctv_footage.mp4 --api http://localhost:3000
```

The script will:
1. Extract video frames.
2. Track people with YOLOv8.
3. Compute zone entrance, exit, shelf visits, shelf interactions, and checkout queue times.
4. Send the structured JSON to `http://localhost:3000/api/save-analysis` to index into SQLite!
