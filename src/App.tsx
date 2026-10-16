import React, { useEffect, useState } from 'react';
import { Camera, ShieldCheck, Database, BookOpen, Layers, Activity, Sparkles } from 'lucide-react';
import { CCTVPlayer } from './components/CCTVPlayer.js';
import { VideoUpload } from './components/VideoUpload.js';
import { SearchPanel } from './components/SearchPanel.js';
import { EventLogTable } from './components/EventLogTable.js';
import { ArchitectureModal } from './components/ArchitectureModal.js';
import { CCTVEvent, CCTVTrack, VideoMetadata } from '../types.js';

export default function App() {
  const [currentVideo, setCurrentVideo] = useState<VideoMetadata | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [events, setEvents] = useState<CCTVEvent[]>([]);
  const [tracks, setTracks] = useState<CCTVTrack[]>([]);
  const [activeTab, setActiveTab] = useState<'monitor' | 'database'>('monitor');
  const [isArchitectureOpen, setIsArchitectureOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch initial benchmark data and events from SQLite database
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const vidRes = await fetch('/api/videos');
      const vidData = await vidRes.json();
      if (vidData.success && vidData.videos && vidData.videos.length > 0) {
        setCurrentVideo(vidData.videos[0]);
      }

      const evtRes = await fetch('/api/events');
      const evtData = await evtRes.json();
      if (evtData.success && evtData.events) {
        setEvents(evtData.events);
      }

      const trkRes = await fetch('/api/tracks');
      const trkData = await trkRes.json();
      if (trkData.success && trkData.tracks) {
        setTracks(trkData.tracks);
      }
    } catch (err) {
      console.error('Failed to load initial CCTV surveillance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleJumpToTimestamp = (timestampSec: number, trackId?: string) => {
    setCurrentTime(timestampSec);
    if (trackId) {
      setSelectedTrackId(trackId);
    }
    // Switch to monitor view if in database tab
    if (activeTab !== 'monitor') {
      setActiveTab('monitor');
    }
  };

  const handleSearchResultsChange = (matchedEvents: CCTVEvent[], matchedTracks: CCTVTrack[]) => {
    // If specific events returned, we keep track of them
    if (matchedTracks.length > 0) {
      setSelectedTrackId(matchedTracks[0].trackId);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Application Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Camera size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                CCTV Vision Search AI
              </h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700/50 text-emerald-400">
                Prototype v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Computer Vision Person Tracking · SQLite Indexing · Gemini NL Search
            </p>
          </div>
        </div>

        {/* System Capabilities & Mode Toggles */}
        <div className="flex items-center gap-2">
          {/* Status indicators */}
          <div className="hidden md:flex items-center gap-3 text-xs text-slate-400 mr-2 border-r border-slate-800 pr-4">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Gemini 3.8 Flash</span>
            </div>
            <span className="text-slate-600">·</span>
            <div className="flex items-center gap-1.5">
              <Database size={12} className="text-emerald-400" />
              <span>SQLite WASM Engine</span>
            </div>
            <span className="text-slate-600">·</span>
            <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-emerald-400" />
              <span>Centroid & IoU Tracker</span>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'monitor'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Surveillance & Search
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'database'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SQLite Event Log ({events.length})
            </button>
          </div>

          {/* Architecture Modal Button */}
          <button
            onClick={() => setIsArchitectureOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-colors"
          >
            <BookOpen size={13} />
            <span>Architecture & Guide</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-6">
        {activeTab === 'monitor' ? (
          <div className="space-y-6">
            {/* Primary Grid: CCTV Viewport (Left) + Search & Results (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (7 cols): CCTV Player & Upload */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <CCTVPlayer
                  currentVideo={currentVideo}
                  currentTime={currentTime}
                  onTimeUpdate={setCurrentTime}
                  selectedTrackId={selectedTrackId}
                  onSelectTrack={setSelectedTrackId}
                  activeEvents={events}
                />

                <VideoUpload
                  currentVideo={currentVideo}
                  onVideoSelect={(v) => {
                    setCurrentVideo(v);
                    setCurrentTime(0);
                  }}
                  onAnalysisComplete={loadInitialData}
                />
              </div>

              {/* Right Column (5 cols): Natural Language Search & Findings */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <SearchPanel
                  videoId={currentVideo?.id}
                  onJumpToTimestamp={handleJumpToTimestamp}
                  onSearchResultsChange={handleSearchResultsChange}
                />
              </div>
            </div>

            {/* Bottom Section: Compact Searchable Event Records */}
            <EventLogTable
              events={events}
              onJumpToTimestamp={handleJumpToTimestamp}
            />
          </div>
        ) : (
          /* Database Tab View */
          <div className="space-y-4">
            <EventLogTable
              events={events}
              onJumpToTimestamp={handleJumpToTimestamp}
            />
          </div>
        )}
      </main>

      {/* Architecture & Student Team Explanation Modal */}
      <ArchitectureModal
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        Natural Language Search for CCTV Using Computer Vision and Generative AI · Academic Prototype
      </footer>
    </div>
  );
}
