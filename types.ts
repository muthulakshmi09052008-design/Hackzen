export type EventType =
  | 'entered_store'
  | 'visited_shelf'
  | 'interacted_with_shelf'
  | 'product_pickup'
  | 'product_return'
  | 'waiting_checkout'
  | 'standing'
  | 'sitting'
  | 'exited_store';

export interface BoundingBox {
  x: number; // normalized 0..1 or pixel coords
  y: number;
  width: number;
  height: number;
}

export interface ZoneDefinition {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PersonDetection {
  trackId: string;
  bbox: BoundingBox;
  confidence: number;
  zone?: string;
  activity?: string;
  dwellTimeSec?: number;
}

export interface FrameDetection {
  timestampSec: number;
  frameIndex: number;
  detections: PersonDetection[];
}

export interface CCTVTrack {
  id?: number;
  trackId: string;
  videoId: string;
  firstSeenSec: number;
  lastSeenSec: number;
  totalDwellSec: number;
  zonesVisited: string[]; // JSON array in DB
  shelvesInteractedCount: number;
  visitedShelfACount: number;
  itemsPickedUpCount: number;
  itemsReturnedCount: number;
  isActive: boolean;
}

export interface CCTVEvent {
  id: number;
  videoId: string;
  trackId: string;
  eventType: EventType;
  zone: string;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  confidence: number;
  details: string;
  createdAt?: string;
}

export interface SearchFilterCriteria {
  trackId?: string;
  eventType?: EventType;
  zone?: string;
  minDurationSec?: number;
  maxDurationSec?: number;
  minShelfVisits?: number;
  minShelfInteractions?: number;
  minShelfAVisits?: number;
  isProductActionQuery?: boolean;
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface ProductActionSummary {
  trackId: string;
  pickedUpCount: number;
  returnedCount: number;
  netCarriedCount: number;
  actions: string[];
}

export interface SearchResponse {
  query: string;
  summary: string;
  criteria: SearchFilterCriteria;
  matchedEvents: CCTVEvent[];
  matchedTracks: CCTVTrack[];
  productSummary?: ProductActionSummary[];
  suggestedQueries?: string[];
  disclaimer?: string;
  posRequirementNote?: string;
  totalCount: number;
}

export interface VideoMetadata {
  id: string;
  filename: string;
  url: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  uploadedAt: string;
  isAnalyzed: boolean;
  eventCount: number;
  trackCount: number;
}

export const STORE_ZONES: ZoneDefinition[] = [
  {
    id: 'entrance',
    name: 'Entrance Gate',
    color: '#3b82f6', // blue
    x: 0.05,
    y: 0.1,
    width: 0.22,
    height: 0.35,
  },
  {
    id: 'shelf_a',
    name: 'Shelf A (Snacks & Beverages)',
    color: '#10b981', // emerald
    x: 0.35,
    y: 0.1,
    width: 0.28,
    height: 0.35,
  },
  {
    id: 'shelf_b',
    name: 'Shelf B (Packaged Goods)',
    color: '#8b5cf6', // purple
    x: 0.68,
    y: 0.1,
    width: 0.27,
    height: 0.35,
  },
  {
    id: 'checkout',
    name: 'Checkout Counter',
    color: '#f59e0b', // amber
    x: 0.35,
    y: 0.55,
    width: 0.32,
    height: 0.38,
  },
  {
    id: 'exit',
    name: 'Exit Gate',
    color: '#ef4444', // red
    x: 0.72,
    y: 0.55,
    width: 0.23,
    height: 0.38,
  },
];
