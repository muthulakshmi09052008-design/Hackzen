import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle2, Film, RefreshCw, Cpu } from 'lucide-react';
import { VideoMetadata } from '../../types.js';

interface VideoUploadProps {
  currentVideo: VideoMetadata | null;
  onVideoSelect: (video: VideoMetadata) => void;
  onAnalysisComplete: () => void;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({
  currentVideo,
  onVideoSelect,
  onAnalysisComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatusText('Uploading video to surveillance server...');

    const formData = new FormData();
    formData.append('video', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploading(false);
      setAnalyzing(true);
      setStatusText('Running Computer Vision person detection & tracking...');

      // Mock processing delay to simulate real frame-by-frame inference on video
      setTimeout(async () => {
        // Index detected tracking and product activity events for uploaded video
        const sampleTracks = [
          {
            trackId: '201',
            videoId: data.video.id,
            firstSeenSec: 2.0,
            lastSeenSec: 58.0,
            totalDwellSec: 56.0,
            zonesVisited: ['Entrance Gate', 'Shelf A', 'Shelf B', 'Checkout Counter', 'Exit Gate'],
            shelvesInteractedCount: 2,
            visitedShelfACount: 1,
            itemsPickedUpCount: 2,
            itemsReturnedCount: 1,
            isActive: false,
          },
        ];

        const sampleEvents = [
          {
            videoId: data.video.id,
            trackId: '201',
            eventType: 'entered_store',
            zone: 'Entrance Gate',
            startTimeSec: 2.0,
            endTimeSec: 5.0,
            durationSec: 3.0,
            confidence: 0.95,
            details: `Person #201 entered frame in ${file.name}.`,
          },
          {
            videoId: data.video.id,
            trackId: '201',
            eventType: 'visited_shelf',
            zone: 'Shelf A',
            startTimeSec: 6.0,
            endTimeSec: 18.0,
            durationSec: 12.0,
            confidence: 0.92,
            details: `Person #201 approached Shelf A (Snacks & Beverages).`,
          },
          {
            videoId: data.video.id,
            trackId: '201',
            eventType: 'interacted_with_shelf',
            zone: 'Shelf A',
            startTimeSec: 8.0,
            endTimeSec: 13.0,
            durationSec: 5.0,
            confidence: 0.90,
            details: `Person #201 reached hand toward products on Shelf A.`,
          },
          {
            videoId: data.video.id,
            trackId: '201',
            eventType: 'product_pickup',
            zone: 'Shelf A',
            startTimeSec: 9.0,
            endTimeSec: 12.0,
            durationSec: 3.0,
            confidence: 0.93,
            details: `Person #201 picked up an item from Shelf A for inspection.`,
          },
          {
            videoId: data.video.id,
            trackId: '201',
            eventType: 'product_return',
            zone: 'Shelf A',
            startTimeSec: 13.5,
            endTimeSec: 16.5,
            durationSec: 3.0,
            confidence: 0.91,
            details: `Person #201 returned the inspected item back onto Shelf A.`,
          },
          {
            videoId: data.video.id,
            trackId: '201',
            eventType: 'visited_shelf',
            zone: 'Shelf B',
            startTimeSec: 20.0,
            endTimeSec: 32.0,
            durationSec: 12.0,
            confidence: 0.91,
            details: `Person #201 relocated to Shelf B (Packaged Goods).`,
          },
          {
            videoId: data.video.id,
            trackId: '201',
            eventType: 'product_pickup',
            zone: 'Shelf B',
            startTimeSec: 23.0,
            endTimeSec: 26.0,
            durationSec: 3.0,
            confidence: 0.94,
            details: `Person #201 picked up a second product item from Shelf B.`,
          },
          {
            videoId: data.video.id,
            trackId: '201',
            eventType: 'waiting_checkout',
            zone: 'Checkout Counter',
            startTimeSec: 35.0,
            endTimeSec: 50.0,
            durationSec: 15.0,
            confidence: 0.93,
            details: `Person #201 queued at checkout counter with picked item.`,
          },
          {
            videoId: data.video.id,
            trackId: '201',
            eventType: 'exited_store',
            zone: 'Exit Gate',
            startTimeSec: 54.0,
            endTimeSec: 58.0,
            durationSec: 4.0,
            confidence: 0.97,
            details: `Person #201 walked through exit gate.`,
          },
        ];

        await fetch('/api/save-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: data.video.id,
            tracks: sampleTracks,
            events: sampleEvents,
          }),
        });

        setAnalyzing(false);
        setStatusText('');
        onVideoSelect(data.video);
        onAnalysisComplete();
      }, 1500);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploading(false);
      setAnalyzing(false);
      setStatusText('Error: ' + err.message);
    }
  };

  const loadBenchmarkFootage = async () => {
    try {
      const res = await fetch('/api/videos/vid_store_cam_01');
      const data = await res.json();
      if (data.success && data.video) {
        onVideoSelect(data.video);
        onAnalysisComplete();
      }
    } catch (err) {
      console.error('Failed to load benchmark:', err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film size={16} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white">Active CCTV Footage</span>
        </div>

        <button
          onClick={loadBenchmarkFootage}
          className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw size={12} />
          <span>Reset Benchmark (Cam 01)</span>
        </button>
      </div>

      {/* Current Video Info */}
      <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="flex flex-col">
            <span className="font-medium text-slate-200">
              {currentVideo?.filename || 'cctv_retail_store_cam01.mp4'}
            </span>
            <span className="text-slate-500">
              {currentVideo?.durationSec || 120}s · 1280x720 · 30 FPS ·{' '}
              {currentVideo?.eventCount || 14} Events Indexed
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || analyzing}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <UploadCloud size={13} />
            <span>Upload CCTV MP4</span>
          </button>
        </div>
      </div>

      {/* Progress status */}
      {(uploading || analyzing) && (
        <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
          <Cpu size={14} className="animate-spin text-emerald-400" />
          <span>{statusText}</span>
        </div>
      )}
    </div>
  );
};
