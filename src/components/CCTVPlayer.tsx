import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Eye, Layers, Navigation, FastForward, Video } from 'lucide-react';
import { BoundingBox, CCTVEvent, VideoMetadata } from '../../types.js';
import { renderCCTVFrame } from '../lib/sampleCCTVGenerator.js';

interface CCTVPlayerProps {
  currentVideo: VideoMetadata | null;
  currentTime: number;
  onTimeUpdate: React.Dispatch<React.SetStateAction<number>> | ((time: number | ((prev: number) => number)) => void);
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string | null) => void;
  activeEvents: CCTVEvent[];
}

export const CCTVPlayer: React.FC<CCTVPlayerProps> = ({
  currentVideo,
  currentTime,
  onTimeUpdate,
  selectedTrackId,
  onSelectTrack,
  activeEvents,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showBBoxes, setShowBBoxes] = useState<boolean>(true);
  const [showTracks, setShowTracks] = useState<boolean>(true);

  const isBenchmarkVideo = !currentVideo || currentVideo.id === 'vid_store_cam_01';
  const duration = currentVideo ? currentVideo.durationSec : 120;

  // Render loop for procedural CCTV canvas
  useEffect(() => {
    let animId: number;
    let lastStamp = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastStamp) / 1000;
      lastStamp = now;

      if (isPlaying && isBenchmarkVideo) {
        onTimeUpdate((prev) => {
          const next = prev + dt * playbackSpeed;
          return next >= duration ? 0 : next;
        });
      }

      if (canvasRef.current && isBenchmarkVideo) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          renderCCTVFrame(
            ctx,
            canvasRef.current.width,
            canvasRef.current.height,
            currentTime,
            showZones,
            showBBoxes,
            showTracks,
            selectedTrackId
          );
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, playbackSpeed, currentTime, isBenchmarkVideo, showZones, showBBoxes, showTracks, selectedTrackId, duration, onTimeUpdate]);

  // Handle HTML5 video element for uploaded files
  const handleVideoTimeUpdate = () => {
    if (videoRef.current && !isBenchmarkVideo) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onTimeUpdate(val);
    if (videoRef.current && !isBenchmarkVideo) {
      videoRef.current.currentTime = val;
    }
  };

  const togglePlay = () => {
    if (!isBenchmarkVideo && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    onTimeUpdate(0);
    if (videoRef.current && !isBenchmarkVideo) {
      videoRef.current.currentTime = 0;
    }
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Find active events occurring at current timestamp
  const currentIncidents = activeEvents.filter(
    (e) => currentTime >= e.startTimeSec && currentTime <= e.endTimeSec
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* CCTV Viewport Frame */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        {isBenchmarkVideo ? (
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className="w-full h-full object-contain cursor-crosshair"
            onClick={() => onSelectTrack(null)}
          />
        ) : (
          <video
            ref={videoRef}
            src={currentVideo?.url}
            className="w-full h-full object-contain"
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            playsInline
            muted
          />
        )}

        {/* Live Active Incident Kicker */}
        {currentIncidents.length > 0 && (
          <div className="absolute top-10 right-4 bg-slate-900/90 border border-emerald-500/40 text-emerald-400 px-3 py-1.5 rounded-lg text-xs backdrop-blur-md shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-mono uppercase font-semibold">
              Event: {currentIncidents[0].eventType.replace('_', ' ')}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-300 font-mono">Person #{currentIncidents[0].trackId}</span>
          </div>
        )}
      </div>

      {/* Scrubber & Timeline Bar */}
      <div className="px-4 pt-3 pb-2 bg-slate-950 border-t border-slate-800">
        <div className="relative flex items-center group">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:h-2 transition-all"
          />
        </div>

        {/* Timeline Event Markers */}
        <div className="relative h-2 w-full mt-1">
          {activeEvents.map((evt) => {
            const leftPct = (evt.startTimeSec / duration) * 100;
            const widthPct = Math.max(((evt.endTimeSec - evt.startTimeSec) / duration) * 100, 1);
            return (
              <button
                key={evt.id}
                onClick={() => onTimeUpdate(evt.startTimeSec)}
                title={`Person #${evt.trackId} - ${evt.eventType} (${formatSecs(evt.startTimeSec)})`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                className="absolute top-0 h-1.5 bg-emerald-500/60 hover:bg-emerald-400 hover:h-2 rounded-sm transition-all"
              />
            );
          })}
        </div>
      </div>

      {/* Control Console Toolbar */}
      <div className="p-3 bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800/80">
        {/* Left: Playback controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Reset to 00:00"
          >
            <RotateCcw size={14} />
          </button>

          <span className="font-mono text-slate-300 px-2 py-1 bg-slate-900 rounded border border-slate-800">
            {formatSecs(currentTime)} / {formatSecs(duration)}
          </span>

          {/* Speed selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 ml-2">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-1 rounded font-mono transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Right: Computer Vision Overlay Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowZones(!showZones)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
              showZones
                ? 'bg-slate-800 border-slate-700 text-emerald-400'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
          >
            <Layers size={13} />
            <span>Store Zones</span>
          </button>

          <button
            onClick={() => setShowBBoxes(!showBBoxes)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
              showBBoxes
                ? 'bg-slate-800 border-slate-700 text-emerald-400'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
          >
            <Eye size={13} />
            <span>CV Bounding Boxes</span>
          </button>

          <button
            onClick={() => setShowTracks(!showTracks)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
              showTracks
                ? 'bg-slate-800 border-slate-700 text-emerald-400'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
          >
            <Navigation size={13} />
            <span>Trajectories</span>
          </button>
        </div>
      </div>
    </div>
  );
};
