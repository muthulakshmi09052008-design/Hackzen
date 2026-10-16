import React, { useState } from 'react';
import { Database, Filter, Download, Play, ExternalLink } from 'lucide-react';
import { CCTVEvent, EventType } from '../../types.js';

interface EventLogTableProps {
  events: CCTVEvent[];
  onJumpToTimestamp: (timestampSec: number, trackId?: string) => void;
}

export const EventLogTable: React.FC<EventLogTableProps> = ({
  events,
  onJumpToTimestamp,
}) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const filteredEvents = events.filter((e) => {
    if (selectedType !== 'all' && e.eventType !== selectedType) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      return (
        e.trackId.includes(q) ||
        e.zone.toLowerCase().includes(q) ||
        e.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cctv_sqlite_events_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-4">
      {/* Table Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">
            SQLite Event Index Log ({filteredEvents.length} records)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter records..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Event Types</option>
            <option value="product_pickup">Product Picked Up</option>
            <option value="product_return">Product Returned</option>
            <option value="interacted_with_shelf">Interacted with Shelf</option>
            <option value="visited_shelf">Visited Shelf</option>
            <option value="waiting_checkout">Waiting Checkout</option>
            <option value="entered_store">Entered Store</option>
            <option value="standing">Standing</option>
            <option value="exited_store">Exited Store</option>
          </select>

          <button
            onClick={exportJSON}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Download size={12} />
            <span>Export Log</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto rounded-lg border border-slate-800/80">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Track ID</th>
              <th className="py-2.5 px-3">Event Type</th>
              <th className="py-2.5 px-3">Zone</th>
              <th className="py-2.5 px-3">Time Range</th>
              <th className="py-2.5 px-3">Duration</th>
              <th className="py-2.5 px-3">Confidence</th>
              <th className="py-2.5 px-3">Forensic Details</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 text-slate-300">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500">
                  No event records matching filters found in SQLite database.
                </td>
              </tr>
            ) : (
              filteredEvents.map((e) => (
                <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-emerald-400">
                    #{e.trackId}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono text-slate-200">
                      {e.eventType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{e.zone}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    {formatSecs(e.startTimeSec)} - {formatSecs(e.endTimeSec)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    {e.durationSec.toFixed(1)}s
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    {Math.round(e.confidence * 100)}%
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">
                    {e.details}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onJumpToTimestamp(e.startTimeSec, e.trackId)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1 font-mono text-[11px]"
                      title="Jump to CCTV timecode"
                    >
                      <Play size={10} />
                      <span>{formatSecs(e.startTimeSec)}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
