// Headless "reasonable player" bot. Plays the Chip Stage and reports timings,
// so balance changes can be checked without clicking through the game.
// Run: npm run balance
import { ITEMS, MODELS, NODES, RESEARCH, STAGE_1_CLIENTS, type ItemId, type NodeId, type SectionId } from '../src/sim/data';
import {
  assignTalent, buy, canFab, canResearch, clickProcess, costOf, currentGoal, doResearch, fabNode,
  bottlenecks, fmtMoney, fmtNum, fmtTime, goalText, itemsFor, level, maxLevelOf, rigStats, setModel, tick, type GameEvent,
} from '../src/sim/engine';
import { newGame, type GameState } from '../src/sim/state';
import type { Bottleneck } from '../src/sim/engine';
import { nodeDef } from '../src/sim/data';

const DT = 0.1;
const DECIDE_EVERY = 1; // seconds between purchase decisions

function income(s: GameState): number {
  const r = rigStats(s);
  if (!r.scheduler) return 0;
  return Math.min(r.capTok, r.arrivals * r.tokPerReq) * r.price;
}

interface Cand { item: ItemId; node?: NodeId; cluster?: number }
function candidates(s: GameState): Cand[] {
  const out: Cand[] = [];
  for (const it of ITEMS) {
    if (it.scope === 'rig') { out.push({ item: it.id }); continue; }
    for (const n of s.nodes) {
      if (!itemsFor(nodeDef(n.id), it.section).some((x) => x.id === it.id)) continue;
      if (it.scope === 'cluster') n.clusters.forEach((_, ci) => out.push({ item: it.id, node: n.id, cluster: ci }));
      else out.push({ item: it.id, node: n.id });
    }
  }
  return out.filter((c) => level(s, c.item, c.node, c.cluster) < maxLevelOf(c.item, c.node));
}
const costC = (s: GameState, c: Cand) => costOf(s, c.item, c.node, level(s, c.item, c.node, c.cluster), c.cluster);
const buyC = (s: GameState, c: Cand) => buy(s, c.item, c.node, 1, [], c.cluster) > 0;

function bestUpgrade(s: GameState) {
  const base = income(s);
  let best: (Cand & { ratio: number; cost: number }) | null = null;
  for (const c of candidates(s)) {
    const cost = costC(s, c);
    const clone: GameState = structuredClone(s);
    clone.cash = cost + 1;
    buyC(clone, c);
    const gain = income(clone) - base;
    if (gain <= 0) continue;
    const ratio = gain / cost;
    if (!best || ratio > best.ratio) best = { ...c, ratio, cost };
  }
  return best;
}

function goalDirected(s: GameState): boolean {
  const g = currentGoal(s);
  if (!g) return false;
  const sp = g.spec;
  const newest = s.nodes[s.nodes.length - 1].id;
  if (sp.kind === 'buy') return buy(s, sp.item, undefined, 1) > 0;
  if (sp.kind === 'itemUpgrades') return buy(s, sp.item, newest, 1) > 0;
  if (sp.kind === 'sectionUpgrades') {
    const it = ITEMS.find((i) => i.section === sp.section)!;
    return buy(s, it.id, newest, 1) > 0;
  }
  if (sp.kind === 'clock') return candidates(s).some((c) => c.item === 'clock' && buyC(s, c));
  if (sp.kind === 'coolUnderLoad') {
    const r = rigStats(s);
    const hot = r.nodes.filter((n) => n.temp >= sp.temp);
    return hot.some((n) => buy(s, 'heatsink', n.id, 1) > 0 || buy(s, 'fan', n.id, 1) > 0);
  }
  if (sp.kind === 'powerHigh') {
    const r = rigStats(s);
    for (const n of r.nodes) {
      if (n.powerFactor < 0.999) { if (buy(s, 'psu', n.id, 1)) return true; continue; }
    }
    return false;
  }
  if (sp.kind === 'burstsCalm') {
    // Plan for the rush: look at the rig as it would be mid-burst.
    const c: GameState = structuredClone(s);
    c.burstClock = 59;
    c.queue = 100;
    const reds = bottlenecks(c, rigStats(c)).filter((b) => b.severity === 'red' && b.item);
    for (const b of reds) if (fixRed(s, b)) return true;
  }
  if (sp.kind === 'queueUnder' || sp.kind === 'burstsCalm') {
    const r = rigStats(s);
    if (r.demand > r.intakeCap) return buy(s, 'intake', undefined, 1) > 0;
  }
  return false;
}

function decide(s: GameState) {
  // Lab first: node research, then pricing/reach/efficiency.
  const nodePending = (['node7', 'node5', 'node3'] as const).find((id) => !(s.research[id] ?? 0));
  if (nodePending) { if (canResearch(s, nodePending)) doResearch(s, nodePending); }
  else for (const id of ['billing', 'efficiency', 'reach'] as const) {
    if (canResearch(s, id)) { doResearch(s, id); break; }
  }
  // Fab a new node as soon as possible.
  for (const n of NODES) if (canFab(s, n.id).ok) fabNode(s, n.id);
  // Talent in its own section.
  for (const t of s.talentOwned) {
    const sec = ({ pip: 'compute', dot: 'network', sal: 'power' } as Record<string, SectionId>)[t];
    assignTalent(s, sec, t);
  }
  // Best model for current income.
  let bestModel = s.model, bestInc = -1;
  for (const m of MODELS) {
    if (!s.modelsOwned.includes(m.id)) continue;
    const c: GameState = structuredClone(s);
    setModel(c, m.id);
    const inc = income(c);
    if (inc > bestInc) { bestInc = inc; bestModel = m.id; }
  }
  setModel(s, bestModel);

  const g = currentGoal(s);
  if (g?.spec.kind === 'ownNode') {
    const def = nodeDef(g.spec.node);
    const researched = !def.research || (s.research as Record<string, number>)[def.research];
    if (researched && s.cash < def.unlockCost) return; // save up
  }
  for (let i = 0; i < 80; i++) {
    if (goalDirected(s)) continue;
    // Follow the red bottleneck like a player would; fall back to best value.
    const reds = bottlenecks(s, rigStats(s)).filter((b) => b.severity === 'red' && b.item);
    let did = false;
    for (const b of reds) if (fixRed(s, b)) { did = true; break; }
    if (did) continue;
    if (reds.length) break; // saving up for the fix
    const b = bestUpgrade(s);
    if (!b || b.cost > s.cash) break;
    buyC(s, b);
  }
}

/** Buy the cheapest upgrade that addresses a red bottleneck. */
function fixRed(s: GameState, b: Bottleneck): boolean {
  const item = b.item!;
  const alts: ItemId[] = item === 'heatsink' ? ['heatsink', 'fan'] : b.system === 'compute' ? ['cores', 'clock', 'cluster', 'npu'] : [item];
  const opts = candidates(s).filter((c) => alts.includes(c.item) && (c.node === b.node || !c.node));
  opts.sort((x, y) => costC(s, x) - costC(s, y));
  return !!opts[0] && buyC(s, opts[0]);
}

const s = newGame(42);
const events: GameEvent[] = [];
let nextDecision = 0;
let lastClient = -1;
const log: string[] = [];
let lastGoalLog = '';
const LIMIT = Number(process.env.LIMIT ?? 4 * 3600);
while (!s.stageComplete && s.playTime < LIMIT) {
  if (level(s, 'scheduler') === 0 && Math.floor(s.playTime * 10) % 3 === 0) clickProcess(s, events);
  tick(s, DT, events);
  if (s.playTime >= nextDecision) { decide(s); nextDecision += DECIDE_EVERY; }
  if (s.clientIndex !== lastClient) {
    lastClient = s.clientIndex;
    const c = STAGE_1_CLIENTS[s.clientIndex];
    log.push(`${fmtTime(s.playTime)}  client ${s.clientIndex + 1}${c ? ` (${c.name})` : ''} starts · cash ${fmtMoney(s.cash)}`);
  }
  if (process.env.TRACE && Math.abs(s.playTime % 60) < DT / 2) {
    const rr = rigStats(s);
    log.push(`${fmtTime(s.playTime)}        cash ${fmtMoney(s.cash)} cap ${fmtNum(rr.capTok)} want ${fmtNum(rr.arrivals * rr.tokPerReq)} served ${fmtNum(s.servedRate)} q ${fmtNum(s.queue)} £/s ${fmtNum(s.servedRate * rr.price)}`);
  }
  const g = currentGoal(s);
  const gt = g ? goalText(g) : '';
  if (gt !== lastGoalLog) { lastGoalLog = gt; if (gt) log.push(`${fmtTime(s.playTime)}      goal: ${gt}`); }
}
for (const l of log) console.log(l);
if (process.env.EVENTS) for (const e of events) console.log(e.text);
const r = rigStats(s);
console.log('---');
console.log(`Finished: ${s.stageComplete} at ${fmtTime(s.playTime)}`);
console.log(`Nodes: ${s.nodes.map((n) => nodeDef(n.id).label).join(', ')} · cap ${fmtNum(r.capTok)} tok/s · demand ${fmtNum(r.demand)} req/s · model ${s.model}`);
console.log(`Research: ${JSON.stringify(s.research)} · Lab left ${s.lab}`);
for (const n of s.nodes) console.log(`  ${nodeDef(n.id).label}: ${JSON.stringify(n.levels)} clusters ${JSON.stringify(n.clusters)}`);
console.log(`  rig: ${JSON.stringify(s.rigLevels)}`);
void RESEARCH;
if (process.env.DEBUG) {
  const { bottlenecks } = await import('../src/sim/engine');
  console.log(JSON.stringify({ queue: s.queue, demand: r.demand, intake: r.intakeCap, arrivals: r.arrivals, tpr: r.tokPerReq, cap: r.capTok, uplink: r.uplinkCap, served: s.servedRate }, null, 0));
  for (const n of r.nodes) console.log(n.id, { cap: n.cap, comp: n.computeTok, mem: n.memCap, tf: n.thermalFactor, pf: n.powerFactor, temp: n.temp });
  console.log(bottlenecks(s, r).map((b) => b.tip));
}
if (process.env.DUMP) {
  const fs = await import('node:fs');
  fs.writeFileSync(process.env.DUMP, JSON.stringify(s));
}
