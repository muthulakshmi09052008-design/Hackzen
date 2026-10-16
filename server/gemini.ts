import { GoogleGenAI, Type } from '@google/genai';
import {
  CCTVEvent,
  CCTVTrack,
  ProductActionSummary,
  SearchFilterCriteria,
  SearchResponse,
} from '../types.js';
import { getEvents, getTracks } from './db.js';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

interface QueryParseOutput {
  eventType?: string;
  trackId?: string;
  zone?: string;
  minDurationSec?: number;
  maxDurationSec?: number;
  minShelfVisits?: number;
  minShelfInteractions?: number;
  minShelfAVisits?: number;
  isPurchaseQuery: boolean;
  isProductActionQuery?: boolean;
  productActionType?: 'pickup' | 'return' | 'all';
  isSupportedActivity?: boolean;
  intentExplanation: string;
}

const DEFAULT_SUGGESTED_QUERIES = [
  'How many products did each person pick up?',
  'Which person returned a product to the shelf?',
  'Show all people waiting near the checkout counter.',
  'Find people who visited Shelf A more than once.',
  'Who stayed in the store for more than 20 minutes?',
  'Find people who interacted with more than three shelves.',
  'Show people entering or exiting the store.',
];

export async function processNaturalLanguageSearch(
  query: string,
  videoId?: string
): Promise<SearchResponse> {
  const allTracks = await getTracks(videoId);
  const allEvents = await getEvents(videoId);

  let parsed: QueryParseOutput = {
    isPurchaseQuery: false,
    isSupportedActivity: true,
    intentExplanation: 'Query parsed',
  };

  const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);

  if (hasApiKey) {
    try {
      const parsePrompt = `You are an expert CCTV Video Intelligence AI query parser for retail and commercial premises.
Analyze this user query for CCTV video surveillance events:
"${query}"

Available event types in database:
- "product_pickup" (picking up, taking, grabbing, collecting products/items from shelves)
- "product_return" (returning, putting back, replacing products onto shelves)
- "interacted_with_shelf" (reaching hand toward shelf, browsing, or examining goods)
- "visited_shelf" (standing in front of or browsing near a shelf)
- "waiting_checkout" (standing or queueing at checkout counter / cashier)
- "entered_store" (entering store through entrance gate)
- "exited_store" (exiting or leaving through exit gate)
- "standing" (standing stationary in an aisle)
- "sitting" (sitting down)

Available zones: "Checkout Counter", "Shelf A", "Shelf B", "Entrance Gate", "Exit Gate".

Identify:
1. "isProductActionQuery": true if asking about taking products, picking up items, returning items, product counts, or "how many products they will take / did take".
2. "productActionType": "pickup" (if asking only about taking/picking up), "return" (if asking about returning/putting back), or "all" (for general product counts).
3. "eventType": one of the event types above if specifically targeted.
4. "trackId": specific person/track ID if mentioned (e.g. "Person #101" -> "101").
5. "zone": specific zone name if mentioned.
6. "minDurationSec": minimum dwell or action duration in seconds.
7. "minShelfAVisits": minimum visits specifically to Shelf A (e.g., "more than once" -> 2).
8. "minShelfInteractions": minimum shelf interactions count (e.g., "more than 3 shelves" -> 3).
9. "isPurchaseQuery": true if user asks about buying, purchasing, payment, paying at cashier, or stealing.
10. "isSupportedActivity": true if query relates to retail store surveillance activities (entering, exiting, waiting at checkout, visiting/interacting with shelves, picking up/returning products, dwell time). False for completely unmonitored activities like bicycles, weapons, pets, dancing, running, vehicles.

Return ONLY valid JSON matching the schema.`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: parsePrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                eventType: {
                  type: Type.STRING,
                  description: 'One of the valid event types or empty string',
                },
                trackId: {
                  type: Type.STRING,
                  description: 'Specific tracked person ID if requested, e.g. "101"',
                },
                zone: {
                  type: Type.STRING,
                  description: 'Zone name if mentioned, e.g. "Checkout Counter", "Shelf A"',
                },
                minDurationSec: {
                  type: Type.NUMBER,
                  description: 'Minimum duration in seconds',
                },
                maxDurationSec: {
                  type: Type.NUMBER,
                  description: 'Maximum duration in seconds',
                },
                minShelfVisits: {
                  type: Type.INTEGER,
                  description: 'Minimum shelf visits count',
                },
                minShelfInteractions: {
                  type: Type.INTEGER,
                  description: 'Minimum shelf interactions count',
                },
                minShelfAVisits: {
                  type: Type.INTEGER,
                  description: 'Minimum visits specifically to Shelf A',
                },
                isPurchaseQuery: {
                  type: Type.BOOLEAN,
                  description: 'Whether user asked about purchase, payment, or buying items',
                },
                isProductActionQuery: {
                  type: Type.BOOLEAN,
                  description: 'Whether user asked about taking, picking up, returning, or counting products',
                },
                productActionType: {
                  type: Type.STRING,
                  description: '"pickup", "return", or "all"',
                },
                isSupportedActivity: {
                  type: Type.BOOLEAN,
                  description: 'True if query relates to supported surveillance activities, false if unsupported',
                },
                intentExplanation: {
                  type: Type.STRING,
                  description: 'Short 1-sentence explanation of what was extracted',
                },
              },
              required: ['isPurchaseQuery', 'isSupportedActivity', 'intentExplanation'],
            },
          },
        }),
        6000
      );

      if (response.text) {
        parsed = JSON.parse(response.text.trim());
      }
    } catch (err) {
      console.warn('Gemini query parsing fallback triggered:', err);
      parsed = fallbackRuleParser(query);
    }
  } else {
    parsed = fallbackRuleParser(query);
  }

  // Ensure fallback rule check if isSupportedActivity wasn't explicitly determined
  const fallback = fallbackRuleParser(query);
  if (fallback.isProductActionQuery) {
    parsed.isProductActionQuery = true;
    parsed.productActionType = fallback.productActionType || parsed.productActionType || 'all';
    parsed.isSupportedActivity = true;
    if (!parsed.eventType && fallback.eventType) {
      parsed.eventType = fallback.eventType;
    }
  }
  if (!parsed.isPurchaseQuery && fallback.isPurchaseQuery) {
    parsed.isPurchaseQuery = true;
  }
  if (fallback.isSupportedActivity === false) {
    parsed.isSupportedActivity = false;
  }

  // Filter Tracks and Events based on parsed criteria
  const matchedTracks: CCTVTrack[] = [];
  let matchedEvents: CCTVEvent[] = [];

  const normQuery = query.toLowerCase();

  // 1. Long dwell query check (e.g. "stayed in the store for more than 20 minutes")
  if (parsed.minDurationSec && (normQuery.includes('stay') || normQuery.includes('in the store') || normQuery.includes('dwell'))) {
    for (const track of allTracks) {
      if (track.totalDwellSec >= parsed.minDurationSec) {
        matchedTracks.push(track);
      }
    }
  }

  // 2. Repeat Shelf A visits check
  if (parsed.minShelfAVisits && parsed.minShelfAVisits > 1) {
    for (const track of allTracks) {
      if (track.visitedShelfACount >= parsed.minShelfAVisits) {
        if (!matchedTracks.some((t) => t.trackId === track.trackId)) {
          matchedTracks.push(track);
        }
      }
    }
  }

  // 3. Multi-shelf interaction check
  if (parsed.minShelfInteractions && parsed.minShelfInteractions >= 2) {
    for (const track of allTracks) {
      if (track.shelvesInteractedCount >= parsed.minShelfInteractions) {
        if (!matchedTracks.some((t) => t.trackId === track.trackId)) {
          matchedTracks.push(track);
        }
      }
    }
  }

  // 4. Product action query handling (pick up, take, return, how many products)
  let productSummary: ProductActionSummary[] | undefined = undefined;

  if (parsed.isProductActionQuery) {
    // If specific action: return vs pickup
    if (parsed.productActionType === 'return' || normQuery.includes('return') || normQuery.includes('put back')) {
      matchedEvents = allEvents.filter((e) => e.eventType === 'product_return');
    } else if (parsed.productActionType === 'pickup' || normQuery.includes('pick') || normQuery.includes('grab')) {
      matchedEvents = allEvents.filter((e) => e.eventType === 'product_pickup');
    } else {
      // General product question ("How many products they will take", "Who took products", etc.)
      matchedEvents = allEvents.filter(
        (e) => e.eventType === 'product_pickup' || e.eventType === 'product_return'
      );
    }

    // Build structured product breakdown per tracked person
    const summaryMap = new Map<string, ProductActionSummary>();
    for (const t of allTracks) {
      summaryMap.set(t.trackId, {
        trackId: t.trackId,
        pickedUpCount: 0,
        returnedCount: 0,
        netCarriedCount: 0,
        actions: [],
      });
    }

    for (const e of allEvents) {
      const p = summaryMap.get(e.trackId);
      if (!p) continue;
      if (e.eventType === 'product_pickup') {
        p.pickedUpCount++;
        p.actions.push(`Picked up item at ${e.zone} (${formatTime(e.startTimeSec)})`);
      } else if (e.eventType === 'product_return') {
        p.returnedCount++;
        p.actions.push(`Returned item at ${e.zone} (${formatTime(e.startTimeSec)})`);
      }
    }

    productSummary = Array.from(summaryMap.values()).map((p) => ({
      ...p,
      netCarriedCount: Math.max(0, p.pickedUpCount - p.returnedCount),
    }));

    // If query targeted specific track or specific person who returned/picked up:
    if (parsed.productActionType === 'return' || normQuery.includes('return') || normQuery.includes('put back')) {
      const returnTrackIds = new Set(matchedEvents.map((e) => e.trackId));
      for (const t of allTracks) {
        if (returnTrackIds.has(t.trackId) && !matchedTracks.some((mt) => mt.trackId === t.trackId)) {
          matchedTracks.push(t);
        }
      }
    } else {
      // Include all persons who performed product actions
      const activeTrackIds = new Set(matchedEvents.map((e) => e.trackId));
      for (const t of allTracks) {
        if (activeTrackIds.has(t.trackId) && !matchedTracks.some((mt) => mt.trackId === t.trackId)) {
          matchedTracks.push(t);
        }
      }
    }
  } else {
    // Standard SQL filter query
    const filterCriteria: SearchFilterCriteria = {
      eventType: (parsed.eventType as any) || undefined,
      zone: parsed.zone || undefined,
      trackId: parsed.trackId || undefined,
      minDurationSec: !normQuery.includes('stay') && !normQuery.includes('store') ? parsed.minDurationSec : undefined,
      maxDurationSec: parsed.maxDurationSec,
    };

    const hasSpecificFilter = Boolean(
      filterCriteria.eventType ||
      filterCriteria.zone ||
      filterCriteria.trackId ||
      parsed.minDurationSec ||
      parsed.minShelfAVisits ||
      parsed.minShelfInteractions ||
      matchedTracks.length > 0 ||
      normQuery.includes('stay') ||
      normQuery.includes('all') ||
      normQuery.includes('everything') ||
      normQuery.includes('anyone')
    );

    if (parsed.isSupportedActivity === false) {
      matchedEvents = [];
      matchedTracks.length = 0;
    } else if (!hasSpecificFilter) {
      matchedEvents = [];
      matchedTracks.length = 0;
    } else {
      matchedEvents = await getEvents(videoId, filterCriteria);
    }
  }

  // If tracks were matched by aggregate query, include their relevant events too
  if (matchedTracks.length > 0 && (!parsed.isProductActionQuery || matchedEvents.length === 0)) {
    const trackIds = new Set(matchedTracks.map((t) => t.trackId));
    const extraEvents = allEvents.filter((e) => trackIds.has(e.trackId));
    for (const ee of extraEvents) {
      if (!matchedEvents.some((m) => m.id === ee.id)) {
        matchedEvents.push(ee);
      }
    }
  }

  // Also include tracks for matched events
  const foundTrackIds = new Set(matchedEvents.map((e) => e.trackId));
  for (const t of allTracks) {
    if (foundTrackIds.has(t.trackId) && !matchedTracks.some((mt) => mt.trackId === t.trackId)) {
      matchedTracks.push(t);
    }
  }

  matchedEvents.sort((a, b) => a.startTimeSec - b.startTimeSec);

  // Check for POS purchase disclaimer
  let posRequirementNote: string | undefined = undefined;
  if (
    parsed.isPurchaseQuery ||
    normQuery.includes('buy') ||
    normQuery.includes('purchas') ||
    normQuery.includes('paid') ||
    normQuery.includes('take out') ||
    normQuery.includes('stole')
  ) {
    posRequirementNote =
      'Important Forensics Disclaimer: CCTV visual tracking detects physical item handling and shelf interactions, but CANNOT verify financial transactions or finalized purchases. Verifying whether a person paid for or legally bought an item requires integrated Point-of-Sale (POS) cashier register transaction logs.';
  }

  // Generate Grounded Natural Language Summary with Gemini
  let summary = '';
  if (matchedEvents.length === 0 && matchedTracks.length === 0) {
    summary = `No matching events or people found in the CCTV footage for query: "${query}". No surveillance records exist matching this activity or duration criteria.`;
  } else if (hasApiKey) {
    try {
      const summaryPrompt = `You are a forensic CCTV Video Analytics System Assistant.
The user asked: "${query}"

Here are the EXACT retrieved database records from the CCTV footage:
Tracks Matched: ${JSON.stringify(matchedTracks, null, 2)}
Product Breakdown: ${productSummary ? JSON.stringify(productSummary, null, 2) : 'N/A'}
Events Matched: ${JSON.stringify(
        matchedEvents.slice(0, 15).map((e) => ({
          trackId: e.trackId,
          eventType: e.eventType,
          zone: e.zone,
          startTime: `${Math.floor(e.startTimeSec)}s`,
          endTime: `${Math.floor(e.endTimeSec)}s`,
          duration: `${Math.round(e.durationSec)}s`,
          confidence: `${(e.confidence * 100).toFixed(0)}%`,
          details: e.details,
        })),
        null,
        2
      )}

CRITICAL GROUNDING RULES:
1. Summarize ONLY the retrieved events and tracks above. NEVER invent people, timestamps, purchases, or actions not present in the records.
2. If asked "How many products they will take" or "How many products did each person pick up", address each person by ID (e.g. Person #101 picked up 1 item; Person #102 picked up 1 item and returned it to the shelf, leaving a net 0 items carried; Person #103 picked up 3 items; Person #104 picked up 0 items).
3. If asked about future tense ("will take"), clarify that CCTV analytics reports observed physical actions rather than future intent.
4. State the tracked person ID (e.g. Person #101), the exact timestamps (e.g. 00:08 - 00:12), zone, and what occurred.
5. If the query asks whether someone purchased or paid, reiterate that CCTV footage records physical item interaction, while payment verification strictly requires Point-of-Sale (POS) cashier records.
6. Keep the summary professional, clear, and factual (3-5 sentences).`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: summaryPrompt,
        }),
        6000
      );

      summary = response.text || generateFallbackSummary(query, matchedEvents, matchedTracks, productSummary);
    } catch (err) {
      console.warn('Gemini summary generation failed:', err);
      summary = generateFallbackSummary(query, matchedEvents, matchedTracks, productSummary);
    }
  } else {
    summary = generateFallbackSummary(query, matchedEvents, matchedTracks, productSummary);
  }

  const suggestedQueries =
    matchedEvents.length === 0 && matchedTracks.length === 0
      ? DEFAULT_SUGGESTED_QUERIES
      : undefined;

  return {
    query,
    summary,
    criteria: {
      eventType: (parsed.eventType as any) || undefined,
      zone: parsed.zone,
      trackId: parsed.trackId,
      minDurationSec: parsed.minDurationSec,
      maxDurationSec: parsed.maxDurationSec,
      isProductActionQuery: parsed.isProductActionQuery,
    },
    matchedEvents,
    matchedTracks,
    productSummary,
    suggestedQueries,
    posRequirementNote,
    totalCount: matchedEvents.length,
  };
}

function fallbackRuleParser(query: string): QueryParseOutput {
  const q = query.toLowerCase();
  const isUnsupported =
    q.includes('bike') ||
    q.includes('bicycle') ||
    q.includes('vehicle') ||
    q.includes('car') ||
    q.includes('weapon') ||
    q.includes('gun') ||
    q.includes('knife') ||
    q.includes('dog') ||
    q.includes('cat') ||
    q.includes('dance') ||
    q.includes('fight') ||
    q.includes('sleep') ||
    q.includes('run');

  const isPurchase =
    q.includes('buy') ||
    q.includes('purchase') ||
    q.includes('paid') ||
    q.includes('payment') ||
    q.includes('stole');

  const isReturn =
    q.includes('return') ||
    q.includes('returned') ||
    q.includes('put back') ||
    q.includes('replaced') ||
    q.includes('put it back');

  const isProduct =
    isReturn ||
    q.includes('product') ||
    q.includes('item') ||
    q.includes('take') ||
    q.includes('took') ||
    q.includes('pick') ||
    q.includes('picked') ||
    q.includes('collect') ||
    q.includes('grab');

  const res: QueryParseOutput = {
    isPurchaseQuery: isPurchase,
    isSupportedActivity: !isUnsupported,
    isProductActionQuery: isProduct,
    productActionType: isReturn ? 'return' : isProduct ? 'all' : undefined,
    intentExplanation: isUnsupported
      ? 'Unsupported activity detected'
      : isProduct
      ? 'Product pickup/return query detected'
      : 'Heuristic rule match',
  };

  if (isUnsupported) {
    return res;
  }

  if (isReturn) {
    res.eventType = 'product_return';
    return res;
  }

  if (isProduct && (q.includes('pick') || q.includes('take') || q.includes('grab'))) {
    res.eventType = 'product_pickup';
  }

  if (q.includes('waiting') || q.includes('checkout') || q.includes('counter') || q.includes('cashier')) {
    res.eventType = 'waiting_checkout';
    res.zone = 'Checkout Counter';
  } else if (q.includes('shelf a')) {
    res.zone = 'Shelf A';
    if (q.includes('more than once') || q.includes('twice') || q.includes('multiple times')) {
      res.minShelfAVisits = 2;
    }
  } else if (q.includes('shelf b')) {
    res.zone = 'Shelf B';
  } else if (q.includes('interact') && (q.includes('shelf') || q.includes('shelves'))) {
    res.eventType = 'interacted_with_shelf';
    if (q.includes('three') || q.includes('3')) {
      res.minShelfInteractions = 3;
    }
  } else if (q.includes('enter') || q.includes('entering')) {
    res.eventType = 'entered_store';
  } else if (q.includes('exit') || q.includes('exiting') || q.includes('left') || q.includes('leaving')) {
    res.eventType = 'exited_store';
  } else if (q.includes('stand') || q.includes('standing')) {
    res.eventType = 'standing';
  }

  // Parse duration
  const minMatch = q.match(/(\d+)\s*(?:minute|min)/);
  if (minMatch) {
    res.minDurationSec = parseInt(minMatch[1], 10) * 60;
  }
  const secMatch = q.match(/(\d+)\s*(?:second|sec)/);
  if (secMatch) {
    res.minDurationSec = parseInt(secMatch[1], 10);
  }

  return res;
}

function generateFallbackSummary(
  query: string,
  events: CCTVEvent[],
  tracks: CCTVTrack[],
  productSummary?: ProductActionSummary[]
): string {
  if (events.length === 0 && tracks.length === 0) {
    return `No recorded CCTV events matched the search criteria for "${query}". No surveillance records exist matching this activity in the indexed database.`;
  }

  const q = query.toLowerCase();

  // If specific return query, highlight exactly who returned items
  if (q.includes('return') || q.includes('put back') || q.includes('replaced')) {
    const returnPersons = productSummary ? productSummary.filter((p) => p.returnedCount > 0) : [];
    if (returnPersons.length > 0) {
      const returnDetails = returnPersons
        .map(
          (p) =>
            `Person #${p.trackId} returned ${p.returnedCount} item(s) to the shelf (${p.actions
              .filter((a) => a.includes('Returned'))
              .join('; ')})`
        )
        .join('; ');
      return `Visual surveillance analysis identified product return event(s): ${returnDetails}. ${
        returnPersons.length
      } person(s) (${returnPersons.map((p) => `Person #${p.trackId}`).join(', ')}) were recorded putting items back onto shelves.`;
    }
  }

  // If product query, provide concise breakdown
  if (productSummary && productSummary.length > 0) {
    const activePersons = productSummary.filter((p) => p.pickedUpCount > 0 || p.returnedCount > 0);
    const details = activePersons
      .map(
        (p) =>
          `Person #${p.trackId} picked up ${p.pickedUpCount} item(s)${
            p.returnedCount > 0 ? ` and returned ${p.returnedCount} item(s) to the shelf` : ''
          } (net carried: ${p.netCarriedCount})`
      )
      .join('; ');

    return `CCTV visual analysis recorded product interactions across ${activePersons.length} tracked subject(s): ${details}. Note: Surveillance cameras record physical pickup and return actions; purchase verification requires Point-of-Sale (POS) cashier records.`;
  }

  const trackIds = Array.from(new Set(events.map((e) => e.trackId)));
  const uniqueZones = Array.from(new Set(events.map((e) => e.zone).filter(Boolean)));

  const eventDescriptions = events
    .slice(0, 3)
    .map(
      (e) =>
        `Person #${e.trackId} in ${e.zone} at ${formatTime(e.startTimeSec)} - ${formatTime(
          e.endTimeSec
        )} (${e.details})`
    )
    .join('; ');

  return `Found ${events.length} event record(s) involving ${trackIds.length} person track(s) (${trackIds
    .map((id) => `Person #${id}`)
    .join(', ')}) across ${uniqueZones.join(', ') || 'monitored zones'}. Highlighted incidents: ${eventDescriptions}. All timestamps and detections are derived from verified computer vision tracking logs.`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
