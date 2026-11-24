// Canvas renderer for the rig: chips, power, cooling, users, billing and the
// stream of request packets. Pure drawing; it reads state and never mutates it.
import { TUNING, nodeDef, type NodeId } from '../sim/data';
import { fmtMoney, fmtNum, type Bottleneck, type NodeStats, type RigStats, type SystemId } from '../sim/engine';
import type { GameState } from '../sim/state';

const C = {
  bg: '#05090c',
  grid: 'rgba(79,227,232,0.045)',
  panel: '#0a1217',
  line: '#1b2b33',
  text: '#cfe7ee',
  muted: '#6d8791',
  cyan: '#4fe3e8',
  green: '#3ee08f',
  amber: '#f5b642',
  red: '#ff4d5e',
  magenta: '#c46cff',
  blue: '#5aa8ff',
};
const NODE_COLOR: Record<NodeId, string> = { n14: C.cyan, n7: C.green, n5: C.magenta, n3: C.amber };

const CHIP = 240;
const GAP = 70;

interface Rect { x: number; y: number; w: number; h: number }
interface Particle { pts: [number, number][]; t: number; speed: number; color: string; size: number; pill?: boolean }

export type ZoneSection = 'compute' | 'thermal' | 'power' | 'network';
export interface Zone { rect: Rect; section: ZoneSection; node?: NodeId; cluster?: number }
export interface RigView {
  chipRects: Map<NodeId, Rect>;
  zones: Zone[];
}

export class RigRenderer {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private spawnAcc = { in: 0, out: 0 };
  private cam = { x: 0, y: 0, scale: 0.8 };
  private time = 0;
  private fanAngle = new Map<NodeId, number>();
  private clickFlash = 0;
  private lastQueue = 0;
  view: RigView = { chipRects: new Map(), zones: [] };
  hover: Zone | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(r.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(r.height * dpr));
  }

  /** Convert a click in CSS pixels to world coordinates. */
  toWorld(px: number, py: number): [number, number] {
    const dpr = this.canvas.width / Math.max(1, this.canvas.getBoundingClientRect().width);
    const sx = px * dpr, sy = py * dpr;
    return [(sx - this.canvas.width / 2) / (this.cam.scale * dpr) + this.cam.x, (sy - this.canvas.height / 2) / (this.cam.scale * dpr) + this.cam.y];
  }

  /** Which clickable part of the rig is under this point (CSS pixels)? */
  zoneAt(px: number, py: number): Zone | null {
    const [wx, wy] = this.toWorld(px, py);
    const pad = 10;
    for (const z of this.view.zones) {
      const r = z.rect;
      if (wx >= r.x - pad && wx <= r.x + r.w + pad && wy >= r.y - pad && wy <= r.y + r.h + pad) return z;
    }
    return null;
  }

  flashClick() { this.clickFlash = 1; }

  draw(s: GameState, r: RigStats, bn: Bottleneck[], dt: number) {
    this.time += dt;
    this.clickFlash = Math.max(0, this.clickFlash - dt * 3);
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const dpr = W / Math.max(1, this.canvas.getBoundingClientRect().width);

    // ----- layout in world units
    const n = s.nodes.length;
    const chipsW = n * CHIP + (n - 1) * GAP;
    const x0 = -chipsW / 2;
    const chipY = -CHIP / 2;
    const rects = new Map<NodeId, Rect>();
    s.nodes.forEach((ns, i) => rects.set(ns.id, { x: x0 + i * (CHIP + GAP), y: chipY, w: CHIP, h: CHIP }));
    this.view.chipRects = rects;
    const barW = Math.max(560, chipsW + 80);
    const billing: Rect = { x: -barW / 2, y: chipY - 150, w: barW, h: 46 };
    const users: Rect = { x: -barW / 2, y: chipY + CHIP + 100, w: barW, h: 92 };
    const gate: Rect = { x: -70, y: users.y + 6, w: 140, h: users.h - 12 };
    const leftX = Math.min(x0 - 210, -barW / 2 - 160);
    const psu: Rect = { x: leftX, y: chipY + 20, w: 140, h: CHIP - 20 };
    const clockBox: Rect = { x: leftX, y: chipY - 110, w: 140, h: 100 };
    const rad: Rect = { x: Math.max(x0 + chipsW + 70, barW / 2 + 20), y: chipY - 110, w: 150, h: CHIP + 110 };
    this.view.zones = [
      ...[...rects].map(([id, rect]) => ({ rect, section: 'compute' as const, node: id })),
      { rect: clockBox, section: 'compute' }, { rect: psu, section: 'power' }, { rect: rad, section: 'thermal' },
      { rect: users, section: 'network' }, { rect: billing, section: 'network' },
    ];
    const bbox = { x: psu.x - 30, y: billing.y - 40, w: rad.x + rad.w + 30 - (psu.x - 30), h: users.y + users.h + 40 - (billing.y - 40) };

    // ----- camera: fit everything, never zoom in past 1×, ease toward target
    const target = Math.min(1, (W / dpr) / bbox.w * 0.92, (H / dpr) / bbox.h * 0.92);
    const k = Math.min(1, dt * 2.5);
    this.cam.scale += (target - this.cam.scale) * k;
    this.cam.x += (bbox.x + bbox.w / 2 - this.cam.x) * k;
    this.cam.y += (bbox.y + bbox.h / 2 - this.cam.y) * k;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const sc = this.cam.scale * dpr;
    ctx.setTransform(sc, 0, 0, sc, W / 2 - this.cam.x * sc, H / 2 - this.cam.y * sc);
    this.drawGrid(W, H, sc);

    const red = new Set<SystemId>(bn.filter((b) => b.severity === 'red').map((b) => b.system));
    const redNodes = new Map<NodeId, SystemId>();
    const redCluster = new Map<NodeId, number>();
    for (const b of bn) if (b.node && b.severity === 'red') { redNodes.set(b.node, b.system); if (b.cluster !== undefined) redCluster.set(b.node, b.cluster); }
    const amberDemand = bn.some((b) => b.system === 'demand');
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);

    // ----- wires (drawn under everything)
    const busY = users.y - 44;
    ctx.lineWidth = 2;
    for (const [id, rc] of rects) {
      const col = NODE_COLOR[id];
      this.wire([[0, gate.y], [0, busY], [rc.x + rc.w / 2, busY], [rc.x + rc.w / 2, rc.y + rc.h]], 'rgba(90,168,255,0.35)');
      this.wire([[rc.x + rc.w / 2, rc.y], [rc.x + rc.w / 2, billing.y + billing.h]], 'rgba(62,224,143,0.35)');
      this.wire([[psu.x + psu.w, rc.y + rc.h - 30], [rc.x, rc.y + rc.h - 30]], 'rgba(245,182,66,0.25)');
      this.wire([[rc.x + rc.w, rc.y + 40], [rad.x, rc.y + 40]], 'rgba(255,120,80,0.25)');
      void col;
    }
    void busY;

    // ----- billing
    const billRed = red.has('uplink');
    this.panel(billing, billRed ? this.redCol(pulse) : C.green, 0.9);
    this.label('BILLING', billing.x + 18, billing.y + 29, C.green, 15, 'left', true);
    this.label(`${fmtMoney(r.price)}/tok`, billing.x + 130, billing.y + 29, C.text, 15, 'left');
    this.label(`OUTPUT ${fmtNum(s.servedRate)} tok/s`, billing.x + billing.w / 2 + 20, billing.y + 29, C.muted, 13, 'left');
    this.label(`UPLINK ${fmtNum(r.uplinkCap)} tok/s`, billing.x + billing.w - 16, billing.y + 29, billRed ? this.redCol(pulse) : C.muted, 12, 'right');

    // ----- clock gauge (selected node)
    const sel = r.nodes.find((x) => x.id === s.selectedNode) ?? r.nodes[0];
    this.panel(clockBox, C.amber, 0.6);
    this.label('CLOCK', clockBox.x + clockBox.w / 2, clockBox.y + 22, C.muted, 12, 'center', true);
    ctx.save();
    ctx.strokeStyle = C.amber;
    ctx.lineWidth = 2;
    ctx.shadowColor = C.amber;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    const freq = 1.5 + sel.effClock * 1.2;
    for (let i = 0; i <= 100; i++) {
      const xx = clockBox.x + 14 + (i / 100) * (clockBox.w - 28);
      const yy = clockBox.y + 48 + Math.sin(i / 100 * Math.PI * 2 * freq - this.time * 4) * 9;
      i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
    ctx.restore();
    const throttled = sel.thermalFactor < 0.999;
    this.label(`${sel.def.label} ${sel.effClock.toFixed(2)} GHz`, clockBox.x + clockBox.w / 2, clockBox.y + 84, throttled ? this.redCol(pulse) : C.amber, 14, 'center');

    // ----- PSU
    const psuRed = red.has('power');
    this.panel(psu, psuRed ? this.redCol(pulse) : C.amber, 0.7);
    this.label('⚡ PSU', psu.x + psu.w / 2, psu.y + 24, C.muted, 12, 'center', true);
    const draw = r.nodes.reduce((a, x) => a + x.powerDraw, 0);
    const sup = r.nodes.reduce((a, x) => a + x.supply, 0);
    this.label(`${fmtNum(draw)} W`, psu.x + psu.w / 2, psu.y + 56, psuRed ? this.redCol(pulse) : C.amber, 20, 'center');
    this.label(`OF ${fmtNum(sup)} W`, psu.x + psu.w / 2, psu.y + 76, C.muted, 11, 'center');
    // power cells
    const cells = 8;
    const lit = Math.round(Math.min(1, draw / Math.max(1, sup)) * cells);
    for (let i = 0; i < cells; i++) {
      const cx = psu.x + 16 + (i % 2) * 58, cy = psu.y + 92 + Math.floor(i / 2) * 26;
      this.box({ x: cx, y: cy, w: 50, h: 20 }, i < lit ? C.amber : C.line, i < lit ? 0.9 : 0.4, i < lit ? 'rgba(245,182,66,0.12)' : undefined);
    }

    // ----- radiator + fans
    const hot = red.has('thermal');
    this.panel(rad, hot ? this.redCol(pulse) : C.cyan, 0.7);
    this.label('HEAT OUT', rad.x + rad.w / 2, rad.y + 22, C.cyan, 12, 'center', true);
    ctx.save();
    ctx.strokeStyle = hot ? 'rgba(255,77,94,0.5)' : 'rgba(79,227,232,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      const xx = rad.x + 16 + i * ((rad.w - 32) / 17);
      ctx.beginPath(); ctx.moveTo(xx, rad.y + 36); ctx.lineTo(xx, rad.y + 140); ctx.stroke();
    }
    ctx.restore();
    const fanCount = Math.min(6, 1 + Math.floor(r.nodes.reduce((a, x) => a + (s.nodes.find((q) => q.id === x.id)?.levels.fan ?? 0), 0) / 4));
    for (let i = 0; i < 6; i++) {
      const fx = rad.x + 40 + (i % 2) * 70, fy = rad.y + 175 + Math.floor(i / 2) * 62;
      this.fan(fx, fy, 26, i < fanCount, sel.util, hot);
    }
    const maxTemp = Math.max(...r.nodes.map((x) => x.temp));
    this.label(`${Math.round(maxTemp)}°`, rad.x + rad.w / 2, rad.y + rad.h - 14, hot ? this.redCol(pulse) : C.cyan, 18, 'center');

    // ----- users: people queue in two lanes and walk into the intake gate in the middle
    const inRed = red.has('intake');
    this.panel(users, inRed ? this.redCol(pulse) : amberDemand ? C.amber : C.blue, 0.9);
    this.label('USERS', users.x + 18, users.y + 24, C.blue, 15, 'left', true);
    this.label(`${fmtNum(r.demand)} req/s`, users.x + users.w - 18, users.y + 24, amberDemand ? C.amber : C.text, 15, 'right');
    this.lastQueue = s.queue;
    this.queueLanes(s, r, users, gate);
    this.gate(r, gate, inRed, pulse);

    // ----- chips
    for (const st of r.nodes) this.chip(s, st, rects.get(st.id)!, redNodes.get(st.id), pulse, !r.scheduler, redCluster.get(st.id));

    // ----- packets
    this.spawn(r, rects, gate, busY, billing, dt);
    this.stepParticles(dt);

    // ----- hover outline on clickable parts
    if (this.hover) {
      const hr = this.hover.rect;
      ctx.save();
      ctx.strokeStyle = 'rgba(207,231,238,0.55)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(hr.x - 8, hr.y - 8, hr.w + 16, hr.h + 16, 14);
      ctx.stroke();
      ctx.restore();
      const name = { compute: 'COMPUTE', thermal: 'THERMAL', power: 'POWER', network: 'NETWORK' }[this.hover.section];
      this.label(`UPGRADE ${name} ›`, hr.x + hr.w / 2, hr.y - 16, C.text, 11, 'center', true);
    }

    // ----- manual hint
    if (!r.scheduler) {
      const rc = rects.get(s.nodes[0].id)!;
      const a = 0.55 + 0.45 * Math.sin(this.time * 4);
      this.label('CLICK THE CHIP TO PROCESS', rc.x + rc.w / 2, rc.y - 24, `rgba(79,227,232,${a})`, 14, 'center', true);
    }
  }

  // -------------------------------------------------------------------------

  private redCol(p: number) { return `rgba(255,77,94,${0.55 + 0.45 * p})`; }

  private drawGrid(W: number, H: number, sc: number) {
    const ctx = this.ctx;
    const step = 40;
    const left = this.cam.x - W / 2 / sc, top = this.cam.y - H / 2 / sc;
    const right = left + W / sc, bottom = top + H / sc;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1 / sc;
    ctx.beginPath();
    for (let x = Math.floor(left / step) * step; x < right; x += step) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
    for (let y = Math.floor(top / step) * step; y < bottom; y += step) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
    ctx.stroke();
  }

  private wire(pts: [number, number][], color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -this.time * 20;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  }

  private panel(r: Rect, color: string, glow: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * glow;
    this.round(r, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private box(r: Rect, color: string, alpha: number, fill?: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (fill) { ctx.fillStyle = fill; this.round(r, 4); ctx.fill(); }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    this.round(r, 4);
    ctx.stroke();
    ctx.restore();
  }

  private round(r: Rect, rad: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, rad);
  }

  private label(text: string, x: number, y: number, color: string, size: number, align: CanvasTextAlign, spaced = false) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${spaced ? 600 : 500} ${size}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = align;
    if (spaced) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '2px';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private fan(x: number, y: number, rad: number, on: boolean, util: number, hot: boolean) {
    const ctx = this.ctx;
    const key = (`fan${x}` as unknown) as NodeId;
    const a = (this.fanAngle.get(key) ?? 0) + (on ? 0.05 + util * 0.35 : 0);
    this.fanAngle.set(key, a);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = on ? (hot ? C.red : C.cyan) : C.line;
    ctx.globalAlpha = on ? 0.9 : 0.5;
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle as string;
    ctx.shadowBlur = on ? 8 : 0;
    ctx.beginPath(); ctx.roundRect(-rad - 4, -rad - 4, rad * 2 + 8, rad * 2 + 8, 6); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.stroke();
    if (on) {
      ctx.rotate(a);
      for (let i = 0; i < 5; i++) {
        ctx.rotate((Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(rad * 0.6, -rad * 0.2, rad * 0.85, rad * 0.25);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private chip(s: GameState, st: NodeStats, rc: Rect, redSys: SystemId | undefined, pulse: number, manual: boolean, memRedCluster?: number) {
    const ctx = this.ctx;
    const col = NODE_COLOR[st.id];
    const selected = s.selectedNode === st.id;
    const def = nodeDef(st.id);
    const flash = manual ? this.clickFlash : 0;

    // pins
    ctx.save();
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    for (let i = 1; i < 12; i++) {
      const t = rc.x + (i * rc.w) / 12;
      const u = rc.y + (i * rc.h) / 12;
      ctx.beginPath();
      ctx.moveTo(t, rc.y - 8); ctx.lineTo(t, rc.y);
      ctx.moveTo(t, rc.y + rc.h); ctx.lineTo(t, rc.y + rc.h + 8);
      ctx.moveTo(rc.x - 8, u); ctx.lineTo(rc.x, u);
      ctx.moveTo(rc.x + rc.w, u); ctx.lineTo(rc.x + rc.w + 8, u);
      ctx.stroke();
    }
    ctx.restore();

    // package
    const heatGlow = redSys === 'thermal' ? this.redCol(pulse) : col;
    ctx.save();
    ctx.fillStyle = '#081015';
    ctx.strokeStyle = heatGlow;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.shadowColor = heatGlow;
    ctx.shadowBlur = (selected ? 22 : 12) + flash * 30;
    this.round(rc, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (selected) this.brackets(rc, col);

    this.label(`${def.chipName}`, rc.x + 14, rc.y + 24, col, 13, 'left', true);
    this.label(`${def.label}`, rc.x + rc.w - 14, rc.y + 24, C.muted, 12, 'right');

    // core clusters: one framed block per cluster slot, each with its own grid of cores
    const gx = rc.x + 16, gy = rc.y + 38, gw = rc.w - 32, gh = rc.h * 0.52;
    const computeRed = redSys === 'compute';
    const ns = s.nodes.find((n) => n.id === st.id)!;
    const slotW = gw / def.maxClusters;
    for (let k = 0; k < def.maxClusters; k++) {
      const box: Rect = { x: gx + k * slotW + 2, y: gy, w: slotW - 4, h: gh };
      const cl = st.clusters[k];
      if (!cl) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(109,135,145,0.35)';
        this.round(box, 6); ctx.stroke();
        ctx.restore();
        this.label(`C${k + 1}`, box.x + box.w / 2, box.y + box.h / 2 - 4, 'rgba(109,135,145,0.55)', 11, 'center', true);
        this.label('+', box.x + box.w / 2, box.y + box.h / 2 + 14, 'rgba(109,135,145,0.55)', 14, 'center');
        this.view.zones.unshift({ rect: box, section: 'compute', node: st.id });
        continue;
      }
      const selected = s.selectedNode === st.id && ns.cluster === k;
      ctx.save();
      ctx.strokeStyle = selected ? C.green : 'rgba(62,224,143,0.35)';
      ctx.lineWidth = selected ? 2 : 1;
      if (selected) { ctx.shadowColor = C.green; ctx.shadowBlur = 10; }
      this.round(box, 6); ctx.stroke();
      ctx.restore();
      this.label(`C${k + 1}`, box.x + 5, box.y + 12, selected ? C.green : C.muted, 9, 'left', true);
      this.view.zones.unshift({ rect: box, section: 'compute', node: st.id, cluster: k });

      const maxC = def.coresPerCluster;
      const cols = box.w > 90 ? 3 : 2;
      const rows = Math.ceil(maxC / cols);
      const iy = box.y + 16, ih = box.h - 20;
      const cw = (box.w - 6) / cols, chh = ih / rows;
      for (let i = 0; i < maxC; i++) {
        const cell: Rect = { x: box.x + 3 + (i % cols) * cw + 2, y: iy + Math.floor(i / cols) * chh + 2, w: cw - 4, h: chh - 4 };
        if (i < cl.cores) {
          const glow = 0.25 + st.util * 0.6 + flash * 0.4;
          const c = computeRed ? this.redCol(pulse) : C.green;
          ctx.save();
          ctx.fillStyle = `rgba(62,224,143,${0.08 + glow * 0.25})`;
          ctx.strokeStyle = c;
          ctx.lineWidth = 1.2;
          ctx.shadowColor = c;
          ctx.shadowBlur = 4 + glow * 8;
          this.round(cell, 3); ctx.fill(); ctx.stroke();
          ctx.restore();
          if (cell.w > 22 && cell.h > 22) {
            ctx.save();
            ctx.strokeStyle = 'rgba(62,224,143,0.35)';
            ctx.lineWidth = 1;
            const iw = (cell.w - 10) / 2, ih2 = (cell.h - 10) / 2;
            for (let q = 0; q < 4; q++) ctx.strokeRect(cell.x + 4 + (q % 2) * (iw + 2), cell.y + 4 + Math.floor(q / 2) * (ih2 + 2), iw, ih2);
            ctx.restore();
          }
          if (st.util > 0.02 || manual) {
            const ph = (this.time * (0.6 + cl.effClock * 0.4) + i * 0.37 + k * 0.21) % 1;
            ctx.save();
            ctx.fillStyle = (i + k) % 2 ? C.amber : C.green;
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(cell.x + cell.w / 2, cell.y + cell.h * (1 - ph), 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        } else {
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(109,135,145,0.3)';
          this.round(cell, 3); ctx.stroke();
          ctx.restore();
        }
      }
    }

    // memory: one block under each cluster, showing how full that cluster's memory is
    const my = gy + gh + 8;
    for (let k = 0; k < def.maxClusters; k++) {
      const mb: Rect = { x: gx + k * slotW + 2, y: my, w: slotW - 4, h: 20 };
      const cl = st.clusters[k];
      if (!cl) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(109,135,145,0.3)';
        this.round(mb, 4); ctx.stroke();
        ctx.restore();
        continue;
      }
      // Every starved cluster shows red; the one the tip points at pulses.
      const starved = cl.memCap < cl.computeTok * TUNING.slack && st.util > 0.5;
      const memRed = starved || (redSys === 'memory' && memRedCluster === k);
      const c = memRed ? this.redCol(pulse) : C.amber;
      const segs = 4, sw = (mb.w - 4) / segs;
      const used = Math.max(0.06, cl.memLoad);
      for (let i = 0; i < segs; i++) {
        const on = i / segs < used;
        this.box({ x: mb.x + 2 + i * sw, y: mb.y, w: sw - 3, h: mb.h }, on ? c : C.line, on ? 0.95 : 0.6, on ? 'rgba(245,182,66,0.22)' : undefined);
      }
      this.label(`M${k + 1}`, mb.x + 2, my + 32, memRed ? c : C.muted, 9, 'left', true);
      this.label(`${Math.round(cl.memLoad * 100)}%`, mb.x + mb.w - 2, my + 32, memRed ? c : C.muted, 9, 'right');
      this.view.zones.unshift({ rect: mb, section: 'compute', node: st.id, cluster: k });
    }
    if (def.id === 'n5' || def.id === 'n3') {
      this.label(`NPU ${st.npu}`, rc.x + rc.w / 2, rc.y + 24, st.npu > 0 ? C.magenta : C.muted, 10, 'center', true);
    }

    // footer: temp bar + throughput
    const fy = rc.y + rc.h - 22;
    const tFrac = Math.min(1, (st.temp - 25) / 65);
    ctx.save();
    ctx.fillStyle = C.line;
    ctx.fillRect(gx, fy, gw * 0.45, 5);
    ctx.fillStyle = st.temp >= 84 ? C.red : st.temp > 70 ? C.amber : C.cyan;
    ctx.fillRect(gx, fy, gw * 0.45 * tFrac, 5);
    ctx.restore();
    this.label(`${Math.round(st.temp)}°`, gx + gw * 0.45 + 8, fy + 6, st.temp >= 84 ? C.red : C.muted, 11, 'left');
    this.label(`${fmtNum(st.cap)} tok/s`, gx + gw, fy + 6, col, 12, 'right');
    if (redSys === 'power') this.label('POWER CAPPED', rc.x + rc.w / 2, rc.y + rc.h + 26, this.redCol(pulse), 12, 'center', true);
    if (redSys === 'thermal') this.label('THROTTLING', rc.x + rc.w / 2, rc.y + rc.h + 26, this.redCol(pulse), 12, 'center', true);
  }

  private brackets(rc: Rect, col: string) {
    const ctx = this.ctx;
    const L = 18, o = 12;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    const corners: [number, number, number, number][] = [
      [rc.x - o, rc.y - o, 1, 1], [rc.x + rc.w + o, rc.y - o, -1, 1],
      [rc.x - o, rc.y + rc.h + o, 1, -1], [rc.x + rc.w + o, rc.y + rc.h + o, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      ctx.beginPath(); ctx.moveTo(x + dx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * L); ctx.stroke();
    }
    ctx.restore();
  }

  private spawn(r: RigStats, rects: Map<NodeId, Rect>, gate: Rect, busY: number, billing: Rect, dt: number) {
    // Visual rates grow with the log of real throughput so it always looks busier as you improve.
    const vis = (x: number) => (x <= 0 ? 0 : Math.min(45, 1.5 + Math.log2(1 + x) * 3.2));
    const speed = (x: number) => 0.35 + Math.min(1.4, Math.log10(1 + x) * 0.35);
    const inRate = vis(r.arrivals);
    const outRate = r.scheduler ? vis(r.capTok > 0 ? Math.min(r.capTok, r.arrivals * r.tokPerReq) : 0) : 0;
    this.spawnAcc.in += inRate * dt;
    this.spawnAcc.out += outRate * dt;
    const ids = [...rects.keys()];
    const caps = r.nodes.map((n) => n.cap);
    const capSum = caps.reduce((a, b) => a + b, 0) || 1;
    const pick = () => {
      let x = Math.random() * capSum;
      for (let i = 0; i < ids.length; i++) { x -= caps[i]; if (x <= 0) return ids[i]; }
      return ids[ids.length - 1];
    };
    while (this.spawnAcc.in >= 1) {
      this.spawnAcc.in -= 1;
      const rc = rects.get(pick())!;
      const tx = rc.x + rc.w / 2 + (Math.random() - 0.5) * 30;
      const lane = (Math.random() - 0.5) * 10;
      this.particles.push({ pts: [[lane, gate.y], [lane, busY + lane * 0.3], [tx, busY + lane * 0.3], [tx, rc.y + rc.h]], t: 0, speed: speed(r.arrivals), color: C.blue, size: 3, pill: true });
    }
    while (this.spawnAcc.out >= 1) {
      this.spawnAcc.out -= 1;
      const rc = rects.get(pick())!;
      const sx = rc.x + rc.w / 2 + (Math.random() - 0.5) * 30;
      const tx = billing.x + billing.w * (0.3 + Math.random() * 0.4);
      this.particles.push({ pts: [[sx, rc.y], [sx, billing.y + billing.h + 40], [tx, billing.y + billing.h + 40], [tx, billing.y + billing.h]], t: 0, speed: speed(r.capTok), color: C.green, size: 2.6 });
    }
  }

  /** Little people waiting in two lanes either side of the intake gate. The lane fills as the queue grows. */
  private queueLanes(s: GameState, r: RigStats, users: Rect, gate: Rect) {
    const ctx = this.ctx;
    const ly = users.y + 64, spacing = 17;
    const lanes: [number, number][] = [[users.x + 18, gate.x - 14], [users.x + users.w - 18, gate.x + gate.w + 14]];
    const perLane = Math.floor((lanes[0][1] - lanes[0][0]) / spacing);
    const waiting = s.queue <= 0 ? 0 : s.queue < perLane * 2 ? Math.ceil(s.queue) : perLane * 2;
    const busy = s.queue > 20;
    // Walking speed follows how fast requests get through the gate.
    const flow = r.scheduler ? Math.min(2.2, 0.25 + Math.log10(1 + r.arrivals) * 0.6) : 0.08;
    const phase = (this.time * flow) % 1;
    lanes.forEach(([outer, inner], li) => {
      const dir = Math.sign(inner - outer);
      // lane floor
      ctx.save();
      ctx.strokeStyle = 'rgba(90,168,255,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.moveTo(outer, ly + 11); ctx.lineTo(inner, ly + 11); ctx.stroke();
      ctx.restore();
      const n = Math.ceil(waiting / 2) - (li === 1 && waiting % 2 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const d = (i + 1 - phase) * spacing; // distance back from the gate end
        const x = inner - dir * d;
        if ((x - outer) * dir < 0) continue;
        const fadeIn = Math.min(1, ((x - outer) * dir) / spacing);
        const fadeOut = Math.min(1, d / (spacing * 0.9));
        const bob = Math.abs(Math.sin(this.time * flow * Math.PI * 2 + i * 0.9)) * 2;
        const hue = (i * 7 + li * 3) % 5 === 0 ? C.cyan : busy && i > n * 0.6 ? C.amber : C.blue;
        this.person(x, ly - bob, hue, Math.min(fadeIn, fadeOut));
      }
    });
    if (waiting === 0) this.label('no one waiting', users.x + 18, ly + 2, C.muted, 10, 'left');
  }

  private person(x: number, y: number, color: string, alpha: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, y - 4, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y + 5.5, 5.8, 4.2, 0, Math.PI, 0); ctx.fill();
    ctx.restore();
  }

  /** The intake gate: people go in at the sides, request capsules leave from the top. */
  private gate(r: RigStats, g: Rect, red: boolean, pulse: number) {
    const ctx = this.ctx;
    const col = red ? this.redCol(pulse) : C.blue;
    ctx.save();
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    this.round(g, 10); ctx.fill(); ctx.stroke();
    ctx.restore();
    // chevrons pointing inward and up, sweeping with the flow
    const flow = r.scheduler ? 1 + Math.log10(1 + r.arrivals) : 0.3;
    for (let i = 0; i < 3; i++) {
      const a = 0.25 + 0.75 * ((Math.sin(this.time * flow * 3 - i * 1.2) + 1) / 2);
      for (const side of [-1, 1]) {
        const cx = g.x + g.w / 2 + side * (g.w / 2 - 14 - i * 8);
        ctx.save();
        ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx + side * 3, g.y + 46); ctx.lineTo(cx - side * 3, g.y + 52); ctx.lineTo(cx + side * 3, g.y + 58); ctx.stroke();
        ctx.restore();
      }
    }
    this.label('INTAKE', g.x + g.w / 2, g.y + 18, col, 12, 'center', true);
    this.label(`${fmtNum(r.intakeCap)} req/s`, g.x + g.w / 2, g.y + 36, red ? col : C.text, 11, 'center');
    this.label(`QUEUE ${fmtNum(this.lastQueue)}`, g.x + g.w / 2, g.y + g.h - 10, this.lastQueue > 20 ? C.amber : C.muted, 10, 'center');
  }

  burstFromChip(id: NodeId) {
    const rc = this.view.chipRects.get(id);
    if (!rc) return;
    for (let i = 0; i < 6; i++) {
      const sx = rc.x + rc.w / 2 + (Math.random() - 0.5) * 40;
      this.particles.push({ pts: [[sx, rc.y], [sx, rc.y - 140]], t: 0, speed: 0.9, color: C.green, size: 3 });
    }
  }

  private stepParticles(dt: number) {
    const ctx = this.ctx;
    ctx.save();
    for (const p of this.particles) {
      p.t += dt * p.speed;
      const [x, y] = along(p.pts, Math.min(1, p.t));
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      if (p.pill) {
        // A request capsule with a faint trail behind it.
        const [bx, by] = along(p.pts, Math.max(0, Math.min(1, p.t) - 0.025));
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 3;
        ctx.strokeStyle = p.color;
        ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.roundRect(x - 5, y - 3, 10, 6, 3);
      } else {
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
    this.particles = this.particles.filter((p) => p.t < 1).slice(-600);
  }
}

function along(pts: [number, number][], t: number): [number, number] {
  let total = 0;
  const segs: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(d);
    total += d;
  }
  let dist = t * total;
  for (let i = 0; i < segs.length; i++) {
    if (dist <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? Math.min(1, dist / segs[i]) : 1;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    }
    dist -= segs[i];
  }
  return pts[pts.length - 1];
}
