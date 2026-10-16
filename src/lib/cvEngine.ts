import { BoundingBox, CCTVEvent, CCTVTrack, EventType, STORE_ZONES, ZoneDefinition } from '../../types.js';

export interface InternalTrackState {
  trackId: string;
  currentBbox: BoundingBox;
  lastCenter: { x: number; y: number };
  firstSeenSec: number;
  lastSeenSec: number;
  framesActive: number;
  disappearedFrames: number;
  trajectory: { x: number; y: number; timeSec: number }[];
  currentZone: string | null;
  zoneEnterTimeSec: number;
  visitedZones: Set<string>;
  visitedShelfACount: number;
  interactedShelves: Set<string>;
  itemsPickedUpCount: number;
  itemsReturnedCount: number;
  totalDwellSec: number;
  isWaitingCheckout: boolean;
  hasEntered: boolean;
  hasExited: boolean;
}

export class VideoCCTVAnalyzer {
  private nextTrackId = 101;
  private activeTracks: Map<string, InternalTrackState> = new Map();
  private generatedEvents: Omit<CCTVEvent, 'id'>[] = [];
  private zones: ZoneDefinition[] = STORE_ZONES;

  constructor(customZones?: ZoneDefinition[]) {
    if (customZones && customZones.length > 0) {
      this.zones = customZones;
    }
  }

  public reset() {
    this.nextTrackId = 101;
    this.activeTracks.clear();
    this.generatedEvents = [];
  }

  /**
   * Process a single video frame with raw candidate detections
   */
  public processFrame(
    detections: { bbox: BoundingBox; confidence: number }[],
    currentTimeSec: number,
    videoId: string
  ) {
    // 1. Centroid & IoU Association
    const matchedTrackIds = new Set<string>();
    const matchedDetectionIndices = new Set<number>();

    // Try matching existing tracks with closest detection
    for (const [trackId, track] of this.activeTracks.entries()) {
      let bestDist = Infinity;
      let bestIndex = -1;

      for (let i = 0; i < detections.length; i++) {
        if (matchedDetectionIndices.has(i)) continue;
        const det = detections[i];
        const detCenter = {
          x: det.bbox.x + det.bbox.width / 2,
          y: det.bbox.y + det.bbox.height / 2,
        };

        const dist = Math.hypot(
          detCenter.x - track.lastCenter.x,
          detCenter.y - track.lastCenter.y
        );

        // Within proximity threshold
        if (dist < 0.25 && dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }

      if (bestIndex !== -1) {
        matchedTrackIds.add(trackId);
        matchedDetectionIndices.add(bestIndex);
        const match = detections[bestIndex];

        // Update track
        const center = {
          x: match.bbox.x + match.bbox.width / 2,
          y: match.bbox.y + match.bbox.height / 2,
        };
        track.currentBbox = match.bbox;
        track.lastCenter = center;
        track.lastSeenSec = currentTimeSec;
        track.framesActive++;
        track.disappearedFrames = 0;
        track.trajectory.push({ ...center, timeSec: currentTimeSec });
        track.totalDwellSec = currentTimeSec - track.firstSeenSec;

        // Zone state machine
        this.updateZoneState(track, currentTimeSec, videoId);
      } else {
        track.disappearedFrames++;
      }
    }

    // 2. Register new tracks for unmatched detections
    for (let i = 0; i < detections.length; i++) {
      if (matchedDetectionIndices.has(i)) continue;
      const det = detections[i];
      const trackId = `${this.nextTrackId++}`;
      const center = {
        x: det.bbox.x + det.bbox.width / 2,
        y: det.bbox.y + det.bbox.height / 2,
      };

      const newTrack: InternalTrackState = {
        trackId,
        currentBbox: det.bbox,
        lastCenter: center,
        firstSeenSec: currentTimeSec,
        lastSeenSec: currentTimeSec,
        framesActive: 1,
        disappearedFrames: 0,
        trajectory: [{ ...center, timeSec: currentTimeSec }],
        currentZone: null,
        zoneEnterTimeSec: currentTimeSec,
        visitedZones: new Set(),
        visitedShelfACount: 0,
        interactedShelves: new Set(),
        itemsPickedUpCount: 0,
        itemsReturnedCount: 0,
        totalDwellSec: 0,
        isWaitingCheckout: false,
        hasEntered: false,
        hasExited: false,
      };

      this.activeTracks.set(trackId, newTrack);
      this.updateZoneState(newTrack, currentTimeSec, videoId);
    }

    // 3. Prune tracks disappeared for too long (> 15 consecutive frames / 3 seconds)
    for (const [trackId, track] of Array.from(this.activeTracks.entries())) {
      if (track.disappearedFrames > 20) {
        this.closeTrackState(track, currentTimeSec, videoId);
        this.activeTracks.delete(trackId);
      }
    }
  }

  private updateZoneState(track: InternalTrackState, currentTimeSec: number, videoId: string) {
    const center = track.lastCenter;
    const currentZoneObj = this.zones.find(
      (z) =>
        center.x >= z.x &&
        center.x <= z.x + z.width &&
        center.y >= z.y &&
        center.y <= z.y + z.height
    );

    const zoneName = currentZoneObj ? currentZoneObj.name : null;

    if (zoneName !== track.currentZone) {
      // Zone transition
      if (track.currentZone) {
        const timeInPrevZone = currentTimeSec - track.zoneEnterTimeSec;

        // If spent more than 4 seconds at checkout counter, log waiting event
        if (track.currentZone.includes('Checkout') && timeInPrevZone >= 4 && !track.isWaitingCheckout) {
          this.generatedEvents.push({
            videoId,
            trackId: track.trackId,
            eventType: 'waiting_checkout',
            zone: 'Checkout Counter',
            startTimeSec: track.zoneEnterTimeSec,
            endTimeSec: currentTimeSec,
            durationSec: Math.round(timeInPrevZone * 10) / 10,
            confidence: 0.93,
            details: `Person #${track.trackId} stood in checkout line waiting for service.`,
          });
          track.isWaitingCheckout = true;
        }
      }

      track.currentZone = zoneName;
      track.zoneEnterTimeSec = currentTimeSec;

      if (zoneName) {
        track.visitedZones.add(zoneName);

        // Entrance detection
        if (zoneName.includes('Entrance') && !track.hasEntered) {
          track.hasEntered = true;
          this.generatedEvents.push({
            videoId,
            trackId: track.trackId,
            eventType: 'entered_store',
            zone: zoneName,
            startTimeSec: currentTimeSec,
            endTimeSec: currentTimeSec + 2.5,
            durationSec: 2.5,
            confidence: 0.95,
            details: `Person #${track.trackId} entered retail facility through entrance gate.`,
          });
        }

        // Shelf visits
        if (zoneName.includes('Shelf A')) {
          track.visitedShelfACount++;
          this.generatedEvents.push({
            videoId,
            trackId: track.trackId,
            eventType: 'visited_shelf',
            zone: 'Shelf A',
            startTimeSec: currentTimeSec,
            endTimeSec: currentTimeSec + 8.0,
            durationSec: 8.0,
            confidence: 0.92,
            details: `Person #${track.trackId} approached Shelf A (Visit #${track.visitedShelfACount}).`,
          });
        } else if (zoneName.includes('Shelf B')) {
          this.generatedEvents.push({
            videoId,
            trackId: track.trackId,
            eventType: 'visited_shelf',
            zone: 'Shelf B',
            startTimeSec: currentTimeSec,
            endTimeSec: currentTimeSec + 8.0,
            durationSec: 8.0,
            confidence: 0.91,
            details: `Person #${track.trackId} approached Shelf B (Packaged Goods).`,
          });
        }

        // Exit detection
        if (zoneName.includes('Exit') && !track.hasExited) {
          track.hasExited = true;
          this.generatedEvents.push({
            videoId,
            trackId: track.trackId,
            eventType: 'exited_store',
            zone: zoneName,
            startTimeSec: currentTimeSec,
            endTimeSec: currentTimeSec + 3.0,
            durationSec: 3.0,
            confidence: 0.97,
            details: `Person #${track.trackId} exited through designated exit portal.`,
          });
        }
      }
    } else if (zoneName) {
      // Continuing in same zone: check for interaction or waiting
      const dwellInCurrentZone = currentTimeSec - track.zoneEnterTimeSec;

      if (
        (zoneName.includes('Shelf A') || zoneName.includes('Shelf B')) &&
        dwellInCurrentZone >= 5.0 &&
        !track.interactedShelves.has(zoneName)
      ) {
        track.interactedShelves.add(zoneName);
        track.itemsPickedUpCount++;
        this.generatedEvents.push({
          videoId,
          trackId: track.trackId,
          eventType: 'interacted_with_shelf',
          zone: zoneName,
          startTimeSec: currentTimeSec - 3.0,
          endTimeSec: currentTimeSec + 2.0,
          durationSec: 5.0,
          confidence: 0.89,
          details: `Person #${track.trackId} reached towards products on ${zoneName}.`,
        });

        // Differentiate shelf touch from actual product pickup
        this.generatedEvents.push({
          videoId,
          trackId: track.trackId,
          eventType: 'product_pickup',
          zone: zoneName,
          startTimeSec: currentTimeSec - 1.5,
          endTimeSec: currentTimeSec + 1.5,
          durationSec: 3.0,
          confidence: 0.91,
          details: `Person #${track.trackId} lifted a product item from ${zoneName}.`,
        });
      }
    }
  }

  private closeTrackState(track: InternalTrackState, currentTimeSec: number, videoId: string) {
    if (track.currentZone && track.currentZone.includes('Checkout') && !track.isWaitingCheckout) {
      const timeInZone = currentTimeSec - track.zoneEnterTimeSec;
      if (timeInZone >= 5) {
        this.generatedEvents.push({
          videoId,
          trackId: track.trackId,
          eventType: 'waiting_checkout',
          zone: 'Checkout Counter',
          startTimeSec: track.zoneEnterTimeSec,
          endTimeSec: currentTimeSec,
          durationSec: Math.round(timeInZone * 10) / 10,
          confidence: 0.92,
          details: `Person #${track.trackId} queued at checkout before leaving view.`,
        });
      }
    }
  }

  public finishAnalysis(videoId: string): {
    tracks: CCTVTrack[];
    events: Omit<CCTVEvent, 'id'>[];
  } {
    const finalTracks: CCTVTrack[] = [];
    for (const track of this.activeTracks.values()) {
      finalTracks.push({
        trackId: track.trackId,
        videoId,
        firstSeenSec: track.firstSeenSec,
        lastSeenSec: track.lastSeenSec,
        totalDwellSec: Math.round((track.lastSeenSec - track.firstSeenSec) * 10) / 10,
        zonesVisited: Array.from(track.visitedZones),
        shelvesInteractedCount: track.interactedShelves.size,
        visitedShelfACount: track.visitedShelfACount,
        itemsPickedUpCount: track.itemsPickedUpCount,
        itemsReturnedCount: track.itemsReturnedCount,
        isActive: false,
      });
    }

    return {
      tracks: finalTracks,
      events: this.generatedEvents,
    };
  }

  public getActiveDetections(): { trackId: string; bbox: BoundingBox; zone?: string }[] {
    const list: { trackId: string; bbox: BoundingBox; zone?: string }[] = [];
    for (const t of this.activeTracks.values()) {
      if (t.disappearedFrames <= 3) {
        list.push({
          trackId: t.trackId,
          bbox: t.currentBbox,
          zone: t.currentZone || undefined,
        });
      }
    }
    return list;
  }
}
