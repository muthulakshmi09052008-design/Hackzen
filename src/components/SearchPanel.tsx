import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  AlertTriangle,
  PlayCircle,
  ShieldAlert,
  ArrowRight,
  PackageCheck,
  RotateCcw,
  ShoppingBag,
  HelpCircle,
} from 'lucide-react';
import { CCTVEvent, CCTVTrack, SearchResponse } from '../../types.js';

interface SearchPanelProps {
  videoId?: string;
  onJumpToTimestamp: (timestampSec: number, trackId?: string) => void;
  onSearchResultsChange: (events: CCTVEvent[], tracks: CCTVTrack[]) => void;
}

const EXAMPLE_QUERIES = [
  'How many products they will take',
  'How many products did each person pick up?',
  'Which person returned a product to the shelf?',
  'Show all people waiting near the checkout counter.',
  'Find people who visited Shelf A more than once.',
  'Who stayed in the store for more than 20 minutes?',
  'Find people who interacted with more than three shelves.',
  'Show people entering or exiting the store.',
  'Did Person #101 purchase or pay for any item?',
];

export const SearchPanel: React.FC<SearchPanelProps> = ({
  videoId,
  onJumpToTimestamp,
  onSearchResultsChange,
}) => {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          videoId: videoId || 'vid_store_cam_01',
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to search CCTV event database');
      }

      setSearchResponse(data);
      onSearchResultsChange(data.matchedEvents || [], data.matchedTracks || []);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err.message || 'An error occurred during search.');
    } finally {
      setLoading(false);
    }
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatEventType = (type: string) => {
    switch (type) {
      case 'product_pickup':
        return 'Product Picked Up';
      case 'product_return':
        return 'Product Returned';
      case 'interacted_with_shelf':
        return 'Shelf Interacted';
      case 'visited_shelf':
        return 'Shelf Visited';
      case 'waiting_checkout':
        return 'Waiting Checkout';
      case 'entered_store':
        return 'Entered Store';
      case 'exited_store':
        return 'Exited Store';
      default:
        return type.replace('_', ' ');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Natural Language CCTV Search
            </h2>
            <p className="text-xs text-slate-400">
              Query surveillance logs via Gemini AI & SQLite indexing
            </p>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch(query);
        }}
        className="relative flex items-center"
      >
        <Search className="absolute left-3.5 text-slate-500" size={16} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask in natural language (e.g. 'How many products they will take')..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-24 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-1.5 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Search</span>
              <ArrowRight size={12} />
            </>
          )}
        </button>
      </form>

      {/* Suggested Query Buttons */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Suggested Queries
        </span>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_QUERIES.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(q);
                handleSearch(q);
              }}
              className="text-left text-xs px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Section */}
      {searchResponse && (
        <div className="flex flex-col gap-4 mt-2 pt-4 border-t border-slate-800/80">
          {/* Gemini AI Synthesis Card */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col gap-2 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <Sparkles size={13} />
                <span>Gemini Evidence Summary</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {searchResponse.totalCount} events retrieved
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {searchResponse.summary}
            </p>
          </div>

          {/* Product Breakdown Matrix (when product query is asked) */}
          {searchResponse.productSummary && searchResponse.productSummary.length > 0 && (
            <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-lg flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <PackageCheck size={14} className="text-emerald-400" />
                  <span>Detected Product Handling Per Person</span>
                </div>
                <span className="text-[10px] text-slate-500">Visual Evidence</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {searchResponse.productSummary.map((p) => (
                  <div
                    key={p.trackId}
                    className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex flex-col gap-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-semibold text-emerald-400">
                        Person #{p.trackId}
                      </span>
                      <span className="text-[11px] text-slate-400 font-sans">
                        Net Carried: <strong className="text-white font-mono">{p.netCarriedCount}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span className="flex items-center gap-1 text-slate-300">
                        <ShoppingBag size={11} className="text-emerald-400" />
                        Picked Up: <strong className="text-white font-mono">{p.pickedUpCount}</strong>
                      </span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <RotateCcw size={11} className="text-amber-400" />
                        Returned: <strong className="text-white font-mono">{p.returnedCount}</strong>
                      </span>
                    </div>

                    {p.actions.length > 0 && (
                      <div className="text-[10px] text-slate-500 mt-0.5 space-y-0.5">
                        {p.actions.map((act, i) => (
                          <div key={i} className="truncate">• {act}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* POS Forensic Disclaimer (when purchase query is asked) */}
          {searchResponse.posRequirementNote && (
            <div className="p-3 bg-amber-950/30 border border-amber-700/50 rounded-lg text-xs text-amber-200 flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-amber-300">
                  Forensic Camera Limit Warning
                </span>
                <p className="text-amber-200/90 leading-normal">
                  {searchResponse.posRequirementNote}
                </p>
              </div>
            </div>
          )}

          {/* Matched Video Clips / Incidents */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Matching Video Clips & Timestamps
              </span>
              <span className="text-xs text-slate-500">
                Click clip to jump to timestamp
              </span>
            </div>

            {searchResponse.matchedEvents.length === 0 ? (
              <div className="p-4 bg-slate-950/60 border border-slate-800/60 rounded-lg flex flex-col gap-3 text-center text-xs text-slate-400">
                <div className="flex flex-col items-center gap-1">
                  <HelpCircle size={20} className="text-slate-600" />
                  <p className="text-slate-300 font-medium">No matching CCTV events found</p>
                  <p className="text-slate-500 text-[11px]">
                    No recorded surveillance events matched your query in the indexed SQLite database.
                  </p>
                </div>

                {searchResponse.suggestedQueries && (
                  <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400 uppercase font-mono">
                      Try one of these supported queries:
                    </span>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {searchResponse.suggestedQueries.map((sq, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setQuery(sq);
                            handleSearch(sq);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors text-xs"
                        >
                          {sq}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {searchResponse.matchedEvents.map((evt) => (
                  <button
                    key={evt.id}
                    onClick={() => onJumpToTimestamp(evt.startTimeSec, evt.trackId)}
                    className="p-3 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-emerald-500/40 rounded-lg text-left transition-all group flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <PlayCircle size={14} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="font-mono text-xs font-semibold text-white">
                          Person #{evt.trackId}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-slate-400 px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800">
                        {formatSecs(evt.startTimeSec)} - {formatSecs(evt.endTimeSec)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">
                        {formatEventType(evt.eventType)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2">
                      {evt.details}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/50">
                      <span>{evt.zone}</span>
                      <span>Conf: {Math.round(evt.confidence * 100)}%</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
