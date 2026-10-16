import { BoundingBox, STORE_ZONES, ZoneDefinition } from '../../types.js';

export interface PersonSimState {
  trackId: string;
  color: string;
  shirtColor: string;
  pantsColor: string;
  // Keyframe path points: [timeSec, x, y, action]
  keyframes: {
    t: number;
    x: number;
    y: number;
    action: 'walk' | 'reach' | 'pickup' | 'return' | 'wait' | 'stand';
  }[];
}

const ACTORS: PersonSimState[] = [
  {
    trackId: '101',
    color: '#06b6d4', // cyan
    shirtColor: '#0284c7', // blue shirt
    pantsColor: '#1e293b', // dark jeans
    keyframes: [
      { t: 0, x: 0.12, y: 0.22, action: 'walk' },
      { t: 2, x: 0.14, y: 0.22, action: 'walk' }, // enter
      { t: 5, x: 0.42, y: 0.22, action: 'walk' }, // arrive Shelf A
      { t: 8, x: 0.42, y: 0.22, action: 'reach' }, // interact Shelf A
      { t: 9, x: 0.42, y: 0.22, action: 'pickup' }, // product picked up from Shelf A
      { t: 15, x: 0.45, y: 0.24, action: 'walk' },
      { t: 18, x: 0.76, y: 0.24, action: 'walk' }, // arrive Shelf B
      { t: 28, x: 0.76, y: 0.24, action: 'walk' }, // browse Shelf B
      { t: 32, x: 0.46, y: 0.22, action: 'walk' }, // return Shelf A (2nd visit!)
      { t: 44, x: 0.46, y: 0.22, action: 'reach' },
      { t: 48, x: 0.48, y: 0.68, action: 'walk' }, // arrive Checkout
      { t: 75, x: 0.48, y: 0.68, action: 'wait' }, // wait at checkout
      { t: 78, x: 0.82, y: 0.72, action: 'walk' }, // exit
      { t: 82, x: 0.95, y: 0.72, action: 'walk' }, // offscreen
    ],
  },
  {
    trackId: '102',
    color: '#a855f7', // purple
    shirtColor: '#d946ef', // magenta shirt
    pantsColor: '#334155', // slate pants
    keyframes: [
      { t: 8, x: 0.10, y: 0.20, action: 'walk' },
      { t: 10, x: 0.14, y: 0.22, action: 'walk' }, // enter
      { t: 14, x: 0.78, y: 0.22, action: 'walk' }, // arrive Shelf B
      { t: 20, x: 0.78, y: 0.22, action: 'reach' }, // reach
      { t: 21, x: 0.78, y: 0.22, action: 'pickup' }, // product picked up from Shelf B
      { t: 24, x: 0.78, y: 0.22, action: 'return' }, // product returned back to Shelf B
      { t: 35, x: 0.78, y: 0.22, action: 'walk' },
      { t: 40, x: 0.48, y: 0.24, action: 'walk' }, // arrive Shelf A
      { t: 52, x: 0.48, y: 0.24, action: 'walk' },
      { t: 58, x: 0.42, y: 0.70, action: 'walk' }, // arrive Checkout behind 101
      { t: 85, x: 0.42, y: 0.70, action: 'wait' }, // waiting at checkout
      { t: 90, x: 0.82, y: 0.72, action: 'walk' }, // exit
      { t: 95, x: 0.95, y: 0.72, action: 'walk' }, // offscreen
    ],
  },
  {
    trackId: '103',
    color: '#eab308', // amber
    shirtColor: '#16a34a', // green shirt
    pantsColor: '#1e1b4b', // navy
    keyframes: [
      { t: 23, x: 0.08, y: 0.22, action: 'walk' },
      { t: 25, x: 0.14, y: 0.22, action: 'walk' }, // enter
      { t: 28, x: 0.38, y: 0.22, action: 'walk' }, // shelf A
      { t: 31, x: 0.38, y: 0.22, action: 'pickup' }, // shelf 1 pickup
      { t: 42, x: 0.72, y: 0.22, action: 'walk' }, // shelf B
      { t: 46, x: 0.72, y: 0.22, action: 'pickup' }, // shelf 2 pickup
      { t: 58, x: 0.58, y: 0.38, action: 'walk' }, // center promo rack
      { t: 60, x: 0.58, y: 0.38, action: 'pickup' }, // shelf 3 pickup
      { t: 80, x: 0.25, y: 0.55, action: 'walk' },
      { t: 105, x: 0.25, y: 0.55, action: 'stand' }, // standing in aisle
      { t: 110, x: 0.82, y: 0.72, action: 'walk' }, // exit
      { t: 115, x: 0.95, y: 0.72, action: 'walk' },
    ],
  },
];

export function renderCCTVFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentTimeSec: number,
  showZones: boolean = true,
  showBBoxes: boolean = true,
  showTracks: boolean = true,
  selectedTrackId: string | null = null
): { trackId: string; bbox: BoundingBox; confidence: number; action: string }[] {
  // Clear canvas
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // 1. Draw 3D floor tiles with perspective
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
  ctx.lineWidth = 1;
  const tileRows = 16;
  const tileCols = 24;
  for (let r = 0; r <= tileRows; r++) {
    const y = (r / tileRows) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let c = 0; c <= tileCols; c++) {
    const x = (c / tileCols) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // 2. Draw Zones (Retail Floor Layout)
  if (showZones) {
    for (const zone of STORE_ZONES) {
      const zx = zone.x * width;
      const zy = zone.y * height;
      const zw = zone.width * width;
      const zh = zone.height * height;

      ctx.fillStyle = `${zone.color}15`;
      ctx.fillRect(zx, zy, zw, zh);

      ctx.strokeStyle = zone.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(zx, zy, zw, zh);
      ctx.setLineDash([]);

      // Zone Label Badge
      ctx.fillStyle = `${zone.color}cc`;
      ctx.fillRect(zx, zy - 18, Math.min(zw, 160), 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText(zone.name, zx + 4, zy - 5);
    }
  }

  // 3. Draw Store Fixtures
  drawFixtures(ctx, width, height);

  // 4. Compute Active Person Positions & Render
  const activeDetections: {
    trackId: string;
    bbox: BoundingBox;
    confidence: number;
    action: string;
  }[] = [];

  for (const actor of ACTORS) {
    const pos = getActorPositionAtTime(actor, currentTimeSec);
    if (!pos) continue;

    const px = pos.x * width;
    const py = pos.y * height;
    const pWidth = 34;
    const pHeight = 64;

    const bbox: BoundingBox = {
      x: (px - pWidth / 2) / width,
      y: (py - pHeight + 10) / height,
      width: pWidth / width,
      height: pHeight / height,
    };

    activeDetections.push({
      trackId: actor.trackId,
      bbox,
      confidence: 0.94 + Math.sin(currentTimeSec * 2 + parseInt(actor.trackId)) * 0.04,
      action: pos.action,
    });

    const isSelected = selectedTrackId === actor.trackId;

    // Draw Trajectory Trail
    if (showTracks) {
      drawTrajectory(ctx, actor, currentTimeSec, width, height, isSelected);
    }

    // Draw 2D Pedestrian Sprite
    drawPedestrian(
      ctx,
      px,
      py,
      actor,
      pos.action,
      currentTimeSec,
      isSelected
    );

    // Draw CV Bounding Box Overlay
    if (showBBoxes) {
      const bx = bbox.x * width;
      const by = bbox.y * height;
      const bw = bbox.width * width;
      const bh = bbox.height * height;

      ctx.strokeStyle = isSelected ? '#38bdf8' : '#22c55e';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;

      // Corner bracket style
      const cornerLen = 8;
      ctx.beginPath();
      // Top left
      ctx.moveTo(bx, by + cornerLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + cornerLen, by);
      // Top right
      ctx.moveTo(bx + bw - cornerLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + cornerLen);
      // Bottom left
      ctx.moveTo(bx, by + bh - cornerLen);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + cornerLen, by + bh);
      // Bottom right
      ctx.moveTo(bx + bw - cornerLen, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - cornerLen);
      ctx.stroke();

      // Label
      const labelText = `ID: #${actor.trackId} [${pos.action.toUpperCase()}]`;
      ctx.font = '10px monospace';
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = isSelected ? '#0369a1' : '#14532d';
      ctx.fillRect(bx, by - 16, textWidth + 8, 16);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(labelText, bx + 4, by - 4);
    }
  }

  // 5. Authentic CCTV On-Screen Display (OSD) HUD
  drawCCTVHUD(ctx, width, height, currentTimeSec);

  return activeDetections;
}

function drawFixtures(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Shelf A 3D isometric block
  const sAx = 0.36 * width;
  const sAy = 0.12 * height;
  const sAw = 0.26 * width;
  const sAh = 0.28 * height;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(sAx, sAy, sAw, sAh);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.strokeRect(sAx, sAy, sAw, sAh);

  // Shelf rows
  for (let i = 1; i <= 3; i++) {
    const rowY = sAy + (sAh / 4) * i;
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(sAx, rowY);
    ctx.lineTo(sAx + sAw, rowY);
    ctx.stroke();

    // Products
    for (let j = 0; j < 8; j++) {
      const px = sAx + 10 + j * 24;
      if (px + 14 < sAx + sAw) {
        ctx.fillStyle = j % 2 === 0 ? '#ef4444' : '#3b82f6';
        ctx.fillRect(px, rowY - 14, 14, 14);
      }
    }
  }

  // Shelf B
  const sBx = 0.69 * width;
  const sBy = 0.12 * height;
  const sBw = 0.25 * width;
  const sBh = 0.28 * height;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(sBx, sBy, sBw, sBh);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(sBx, sBy, sBw, sBh);

  for (let i = 1; i <= 3; i++) {
    const rowY = sBy + (sBh / 4) * i;
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(sBx, rowY);
    ctx.lineTo(sBx + sBw, rowY);
    ctx.stroke();

    for (let j = 0; j < 7; j++) {
      const px = sBx + 10 + j * 26;
      if (px + 16 < sBx + sBw) {
        ctx.fillStyle = j % 2 === 0 ? '#10b981' : '#f59e0b';
        ctx.fillRect(px, rowY - 16, 16, 16);
      }
    }
  }

  // Checkout Counter Desk
  const cx = 0.37 * width;
  const cy = 0.58 * height;
  const cw = 0.28 * width;
  const ch = 0.28 * height;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(cx, cy, cw, ch);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx, cy, cw, ch);

  // Cash Register / POS Terminal
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(cx + 20, cy + 15, 36, 26);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(cx + 24, cy + 18, 28, 14); // Screen glow

  // Barcode scanner stand
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(cx + cw - 40, cy + 18, 12, 22);

  // Promo Rack in center
  const rx = 0.55 * width;
  const ry = 0.36 * height;
  ctx.fillStyle = '#334155';
  ctx.fillRect(rx, ry, 36, 36);
  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(rx, ry, 36, 36);
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  actor: PersonSimState,
  currentTimeSec: number,
  width: number,
  height: number,
  isSelected: boolean
) {
  ctx.strokeStyle = isSelected ? '#38bdf8' : `${actor.color}aa`;
  ctx.lineWidth = isSelected ? 2.5 : 1.5;
  ctx.beginPath();
  let first = true;

  for (const k of actor.keyframes) {
    if (k.t > currentTimeSec) break;
    const kx = k.x * width;
    const ky = k.y * height;
    if (first) {
      ctx.moveTo(kx, ky);
      first = false;
    } else {
      ctx.lineTo(kx, ky);
    }
  }
  ctx.stroke();
}

function drawPedestrian(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  actor: PersonSimState,
  action: string,
  currentTimeSec: number,
  isSelected: boolean
) {
  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(px, py + 4, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const walkBob = action === 'walk' ? Math.sin(currentTimeSec * 8) * 3 : 0;
  const reachOffset = action === 'reach' ? Math.sin(currentTimeSec * 5) * 8 : 0;

  // Legs / Pants
  ctx.fillStyle = actor.pantsColor;
  ctx.fillRect(px - 7, py - 24 + walkBob, 6, 24);
  ctx.fillRect(px + 1, py - 24 - walkBob, 6, 24);

  // Torso / Shirt
  ctx.fillStyle = actor.shirtColor;
  ctx.fillRect(px - 10, py - 46 + walkBob, 20, 24);

  // Arms
  ctx.fillStyle = actor.shirtColor;
  if (action === 'reach' || action === 'pickup' || action === 'return') {
    // Extended arm reaching toward shelf
    ctx.fillRect(px + 8, py - 44, 18 + reachOffset, 6);
    ctx.fillStyle = '#fed7aa'; // Hand
    ctx.fillRect(px + 26 + reachOffset, py - 44, 6, 6);

    if (action === 'pickup') {
      // Held product item in hand
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px + 32 + reachOffset, py - 48, 8, 12);
    } else if (action === 'return') {
      // Product being replaced on shelf
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(px + 30 + reachOffset, py - 46, 7, 10);
    }
  } else {
    ctx.fillRect(px - 14, py - 44 + walkBob, 5, 18);
    ctx.fillRect(px + 9, py - 44 - walkBob, 5, 18);
  }

  // Head
  ctx.fillStyle = '#fed7aa'; // Skin tone
  ctx.beginPath();
  ctx.arc(px, py - 54 + walkBob, 8, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(px, py - 56 + walkBob, 8, Math.PI, Math.PI * 2);
  ctx.fill();

  // Selection halo
  if (isSelected) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py - 30, 28, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCCTVHUD(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentTimeSec: number
) {
  // Top Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(0, 0, width, 28);

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('● REC', 14, 18);

  const baseDate = new Date(1771193000000 + currentTimeSec * 1000);
  const timeStr = baseDate.toISOString().replace('T', ' ').substring(0, 19);

  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`CAM-04 · RETAIL FLOOR · ${timeStr} · 30 FPS`, 70, 18);

  // Bottom Status
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(0, height - 24, width, 24);

  const m = Math.floor(currentTimeSec / 60);
  const s = Math.floor(currentTimeSec % 60);
  const durStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} / 02:00`;

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px monospace';
  ctx.fillText(`TIMECODE: ${durStr} · AI INFERENCE: ONLINE · CENTROID TRACKING: ACTIVE`, 14, height - 8);
  ctx.fillText('SECURE STREAM #9021', width - 150, height - 8);
}

function getActorPositionAtTime(
  actor: PersonSimState,
  t: number
): { x: number; y: number; action: string } | null {
  const kf = actor.keyframes;
  if (t < kf[0].t || t > kf[kf.length - 1].t) {
    return null;
  }

  for (let i = 0; i < kf.length - 1; i++) {
    const k1 = kf[i];
    const k2 = kf[i + 1];

    if (t >= k1.t && t <= k2.t) {
      const dt = k2.t - k1.t;
      const alpha = dt > 0 ? (t - k1.t) / dt : 0;
      return {
        x: k1.x + (k2.x - k1.x) * alpha,
        y: k1.y + (k2.y - k1.y) * alpha,
        action: k1.action,
      };
    }
  }

  return null;
}
