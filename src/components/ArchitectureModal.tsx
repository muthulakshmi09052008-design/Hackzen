import React from 'react';
import { X, Layers, Cpu, Database, Sparkles, Terminal, ArrowRight, ShieldCheck, FileCode } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-emerald-400" size={18} />
            <h2 className="text-sm font-semibold text-white">
              CCTV Natural Language Search — System Architecture & Student Team Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300 leading-relaxed">
          {/* Section 1: Project Architecture in Simple Language */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu size={15} className="text-emerald-400" />
              <span>1. Architecture Overview (In Simple Language)</span>
            </h3>
            <p className="text-slate-400">
              The system functions like an intelligent security analyst watching CCTV feeds. It breaks the problem into four dedicated stages:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="font-mono text-emerald-400 font-semibold block mb-1">
                  Stage 1: Video Ingest
                </span>
                <p className="text-slate-400 text-[11px]">
                  CCTV videos (.mp4/.webm) are ingested, timestamped, and partitioned into sample frames.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="font-mono text-emerald-400 font-semibold block mb-1">
                  Stage 2: CV & Tracking
                </span>
                <p className="text-slate-400 text-[11px]">
                  Object detectors detect people; tracker algorithms assign persistent IDs (e.g. Person #101) and monitor zone entry/exit, shelf visits, and dwell.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="font-mono text-emerald-400 font-semibold block mb-1">
                  Stage 3: SQLite Indexing
                </span>
                <p className="text-slate-400 text-[11px]">
                  Every activity is indexed into SQLite with start time, end time, duration, confidence, and track ID for sub-millisecond retrieval.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="font-mono text-emerald-400 font-semibold block mb-1">
                  Stage 4: Gemini Search
                </span>
                <p className="text-slate-400 text-[11px]">
                  Natural language queries are parsed by Gemini into SQL filters; retrieved records are summarized into factual answers citing exact timestamps.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: End-to-End Data Flow */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ArrowRight size={15} className="text-emerald-400" />
              <span>2. Data Flow from Video Upload to Search Results</span>
            </h3>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] space-y-2 text-slate-300">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">1. Video Upload:</span>
                <span>User uploads CCTV video file via POST /api/upload.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">2. Frame Extraction:</span>
                <span>Video decoded into frames (30 FPS, sampled every 5-10 frames).</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">3. Detection & Tracking:</span>
                <span>YOLOv8 detects bounding boxes [x, y, w, h]; Centroid/ByteTrack assigns Track ID #101.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">4. Zone Rule Engine:</span>
                <span>Point-in-polygon math checks bounding box coordinates against Shelf A, Shelf B, and Checkout.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">5. SQLite Storage:</span>
                <span>Event written: {'{'} trackId: '101', event: 'waiting_checkout', start: 48.0s, end: 75.0s {'}'}.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">6. User Query:</span>
                <span>"Show all people waiting near the checkout counter."</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">7. Gemini Parsing:</span>
                <span>Gemini parses query into SQL filter: WHERE event_type = 'waiting_checkout'.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">8. Grounded Synthesis:</span>
                <span>Gemini reviews matched rows and synthesizes summary; UI renders video clips with jump-to-timecode buttons.</span>
              </div>
            </div>
          </section>

          {/* Section 3: Forensic Boundary Warning */}
          <section className="space-y-2 p-3.5 bg-amber-950/20 border border-amber-800/40 rounded-lg text-amber-200">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <ShieldCheck size={16} />
              <span>Forensic Verification & POS Rule (Crucial for Evaluation)</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              CCTV visual cameras track physical proximity and gestures, but <strong className="text-white">CANNOT</strong> verify whether a purchase was finalized or paid for. Attempting to deduce payments from visual camera footage alone produces false accusations. The system warns whenever purchase queries are made, explaining that Point-of-Sale (POS) cashier logs are strictly required.
            </p>
          </section>

          {/* Section 4: Python YOLO Edge Deployment Guide for Student Team */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal size={15} className="text-emerald-400" />
              <span>3. Python Computer Vision Pipeline (For Team Member Deployment)</span>
            </h3>
            <p className="text-slate-400">
              For edge or GPU workstations, run our provided <code className="text-emerald-400">python/cv_pipeline.py</code> script using YOLOv8:
            </p>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300 space-y-1">
              <div className="text-slate-500"># Step 1: Install Python dependencies</div>
              <div>pip install ultralytics opencv-python requests</div>
              <div className="text-slate-500 pt-1"># Step 2: Run video tracking and sync directly to AI Studio web app</div>
              <div>python python/cv_pipeline.py --video my_cctv_file.mp4 --api http://localhost:3000</div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
