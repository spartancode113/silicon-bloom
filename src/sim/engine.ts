import {
  ITEMS, NODES, STAGE_1_CLIENTS, TUNING,
  itemDef, modelDef, nodeDef, researchDef,
  type ClientDef, type GoalDef, type ItemDef, type ItemId, type ModelId, type NodeDef,
  type NodeId, type ResearchId, type SectionId, type TalentId,
} from './data';
import { newNode, type GameState, type NodeState, type SideObjective } from './state';

// ---------------------------------------------------------------------------
// Derived stats

export interface ClusterStats { cores: number; clock: number; effClock: number }
export interface NodeStats {
  id: NodeId;
  def: NodeDef;
  clusters: ClusterStats[];
  cores: number; // across all clusters
  clock: number; // selected cluster's set clock, GHz
  effClock: number; // selected cluster's clock after thermal throttling
  heat: number; // W at full load
  cool: number; // W removed
  thermalFactor: number; // 1 = no throttle
  power: number; // W at full load
  supply: number;
  powerFactor: number; // 1 = no power cap
  computeTok: number; // tokens/s the cores can make
  memCap: number; // tokens/s memory can feed
  cap: number; // min of the two
  util: number; // 0..1, share of cap used last tick
  temp: number; // °C shown
  powerDraw: number; // W actually drawn last tick
  npu: number;
}

export interface RigStats {
  nodes: NodeStats[];
  nodeCapTotal: number;
  uplinkCap: number;
  capTok: number; // tokens/s the rig can serve
  intakeCap: number; // requests/s
  demand: number; // requests/s wanted right now
  arrivals: number; // requests/s entering the queue
  tokPerReq: number;
  price: number; // £ per token right now
  bursting: boolean;
  scheduler: boolean;
}

/** Level of an upgrade. Cluster upgrades read the given cluster, or the chip's selected one. */
export const level = (s: GameState, item: ItemId, node?: NodeId, cluster?: number): number => {
  const def = itemDef(item);
  if (def.scope === 'rig') return s.rigLevels[item] ?? 0;
  const n = s.nodes.find((x) => x.id === (node ?? s.selectedNode));
  if (!n) return 0;
  if (def.scope === 'cluster') return n.clusters[cluster ?? n.cluster]?.[item] ?? 0;
  return n.levels[item] ?? 0;
};

export const currentClient = (s: GameState): ClientDef | undefined => STAGE_1_CLIENTS[s.clientIndex];
export const currentGoal = (s: GameState): GoalDef | undefined => currentClient(s)?.goals[s.goalIndex];

const hasTalent = (s: GameState, id: TalentId) => Object.values(s.talentSlots).includes(id);
const research = (s: GameState, id: ResearchId) => s.research[id] ?? 0;

export function itemsFor(node: NodeDef | undefined, section: SectionId): ItemDef[] {
  const order = NODES.map((n) => n.id);
  return ITEMS.filter((i) => {
    if (i.section !== section) return false;
    if (i.scope === 'rig') return true;
    if (!node) return false;
    if (i.minNode && order.indexOf(node.id) < order.indexOf(i.minNode)) return false;
    return true;
  });
}

function nodeStats(s: GameState, ns: NodeState, util: number): NodeStats {
  const def = nodeDef(ns.id);
  const lv = (i: ItemId) => ns.levels[i] ?? 0;
  const client = currentClient(s);
  const model = modelDef(s.model);
  const eff = 1 - TUNING.efficiencyPerLevel * research(s, 'efficiency');

  // Each cluster has its own cores and clock; heat, power and memory are shared by the chip.
  const raw = ns.clusters.map((c) => {
    let clock = def.baseClock + def.clockStep * (c.clock ?? 0);
    if (hasTalent(s, 'pip')) clock *= 1.1;
    return { cores: 1 + (c.cores ?? 0), clock };
  });
  const cores = raw.reduce((a, c) => a + c.cores, 0);
  const npu = lv('npu');

  const heat = raw.reduce((a, c) => a + c.cores * Math.pow(c.clock, 1.5), 0) * def.heatPerCoreGHz * eff * (1 + 0.04 * npu);
  const cool = def.coolBase * Math.pow(1.15, lv('heatsink')) * Math.pow(1.05, lv('fan'));
  const thermalFactor = heat > cool ? Math.pow(cool / heat, 2 / 3) : 1;
  const clusters: ClusterStats[] = raw.map((c) => ({ ...c, effClock: c.clock * thermalFactor }));
  const coreGHz = clusters.reduce((a, c) => a + c.cores * c.effClock, 0);
  const sel = clusters[Math.min(ns.cluster, clusters.length - 1)];
  const clock = sel.clock, effClock = sel.effClock;

  const powerMult = eff * (1 - 0.015 * lv('vrm')) * (1 - 0.02 * lv('gating')) *
    (client?.quirk.powerMult ?? 1) * (hasTalent(s, 'sal') ? 0.9 : 1);
  const dynamic = (coreGHz * def.powerPerCoreGHz + lv('fan') * 0.4 * def.idlePower / 5 + lv('l3') * def.idlePower * 0.05) * powerMult;
  const power = dynamic + def.idlePower;
  const supply = def.psuBase * Math.pow(1.15, lv('psu'));
  const powerFactor = power > supply ? Math.max(0.05, (supply - def.idlePower) / dynamic) : 1;

  const computeTok = coreGHz * Math.min(1, powerFactor) * def.tokPerCoreGHz * (1 + 0.12 * npu) / model.computeCost;
  const memCap = def.memBase * Math.pow(1.15, lv('memory')) * Math.pow(1.06, lv('l3')) / (model.memCost * (client?.quirk.memMult ?? 1));
  const cap = Math.min(computeTok, memCap);

  const heatRatio = Math.min(1, heat / cool);
  const temp = thermalFactor < 0.999 && util > 0.6
    ? TUNING.throttleTemp
    : TUNING.idleTemp + (TUNING.throttleTemp - TUNING.idleTemp) * heatRatio * Math.pow(util, 0.7);
  const powerDraw = def.idlePower + Math.min(dynamic * util, supply - def.idlePower);

  return {
    id: ns.id, def, clusters, cores, clock, effClock, heat, cool, thermalFactor, power, supply,
    powerFactor: Math.min(1, powerFactor), computeTok, memCap, cap, util, temp, powerDraw, npu,
  };
}

export function demandNow(s: GameState): { demand: number; bursting: boolean } {
  const client = currentClient(s);
  let demand = TUNING.baseDemand * Math.pow(TUNING.demandPerGoal, s.goalsCompleted) *
    (1 + TUNING.reachPerLevel * research(s, 'reach')) * (client?.quirk.demandMult ?? 1);
  let bursting = false;
  const b = client?.quirk.bursts;
  if (b) {
    const phase = s.burstClock % b.every;
    bursting = phase >= b.every - b.length;
    demand *= bursting ? b.mult : b.base;
  }
  return { demand, bursting };
}

export function tokensPerRequest(s: GameState): number {
  const client = currentClient(s);
  if (client?.quirk.fixedTokens) return client.quirk.fixedTokens;
  return modelDef(s.model).tokPerReq * (client?.quirk.tokenMult ?? 1);
}

export function pricePerToken(s: GameState): number {
  const client = currentClient(s);
  let p = TUNING.pricePerToken * modelDef(s.model).priceMult * (1 + TUNING.billingPerLevel * research(s, 'billing'));
  const q = client?.quirk;
  if (q?.payMult && (q.payNeedsQueueUnder === undefined || s.queue < q.payNeedsQueueUnder)) p *= q.payMult;
  if (s.playTime < s.boostUntil) p *= 2;
  return p;
}

let lastUtil = new Map<NodeId, number>();
export function resetUtilCache() { lastUtil = new Map(); }

export function rigStats(s: GameState): RigStats {
  const nodes = s.nodes.map((n) => nodeStats(s, n, lastUtil.get(n.id) ?? 0));
  const nodeCapTotal = nodes.reduce((a, n) => a + n.cap, 0);
  const uplinkCap = TUNING.uplinkBase * Math.pow(TUNING.uplinkGrowth, level(s, 'uplink'));
  const capTok = Math.min(nodeCapTotal, uplinkCap);
  const intakeCap = TUNING.intakeBase * Math.pow(TUNING.intakeGrowth, level(s, 'intake')) * (hasTalent(s, 'dot') ? 1.15 : 1);
  const { demand, bursting } = demandNow(s);
  return {
    nodes, nodeCapTotal, uplinkCap, capTok, intakeCap, demand,
    arrivals: Math.min(demand, intakeCap),
    tokPerReq: tokensPerRequest(s),
    price: pricePerToken(s),
    bursting,
    scheduler: level(s, 'scheduler') > 0,
  };
}

// ---------------------------------------------------------------------------
// Bottlenecks

export type SystemId = 'scheduler' | 'intake' | 'uplink' | 'memory' | 'thermal' | 'power' | 'compute' | 'demand';
export interface Bottleneck {
  system: SystemId;
  severity: 'red' | 'amber';
  section: SectionId | 'lab';
  item?: ItemId;
  node?: NodeId;
  tip: string;
}

export function bottlenecks(s: GameState, r: RigStats): Bottleneck[] {
  const out: Bottleneck[] = [];
  if (!r.scheduler) {
    out.push({ system: 'scheduler', severity: 'red', section: 'compute', item: 'scheduler', tip: 'Processing is manual. Click the chip, or buy the Auto-scheduler.' });
    return out;
  }
  if (r.demand > r.intakeCap * 1.001) {
    out.push({ system: 'intake', severity: 'red', section: 'network', item: 'intake',
      tip: `Users want ${fmtNum(r.demand)} req/s but intake only lets in ${fmtNum(r.intakeCap)}. Upgrade Request intake.` });
  }
  const tokenDemand = r.arrivals * r.tokPerReq;
  const limited = tokenDemand > r.capTok * 0.98 || s.queue > Math.max(3, r.arrivals * 3);
  if (limited) {
    if (r.uplinkCap < r.nodeCapTotal) {
      out.push({ system: 'uplink', severity: 'red', section: 'network', item: 'uplink',
        tip: `Uplink can only send ${fmtNum(r.uplinkCap)} tok/s. Upgrade Uplink bandwidth.` });
    } else {
      for (const n of r.nodes) {
        const b = nodeLimit(s, n);
        if (b) out.push(b);
      }
    }
  } else if (r.capTok > tokenDemand * 1.3 && r.demand <= r.intakeCap * 1.001) {
    out.push({ system: 'demand', severity: 'amber', section: 'lab',
      tip: 'Your rig is faster than your users. Finish client goals or research Reach in the Lab.' });
  }
  // Put the selected chip's problem first.
  out.sort((a, b) => Number(b.node === s.selectedNode) - Number(a.node === s.selectedNode));
  return out;
}

function nodeLimit(s: GameState, n: NodeStats): Bottleneck | null {
  const tag = n.def.label;
  const maxed = (items: ItemId[]) => items.every((i) => !itemsFor(n.def, itemDef(i).section).some((x) => x.id === i) || level(s, i, n.id) >= maxLevelOf(i, n.id));
  // A chip that is fully upgraded in the limiting area is done, not a bottleneck.
  if (n.thermalFactor < 0.97 && maxed(['heatsink', 'fan'])) return null;
  if (n.thermalFactor >= 0.97 && n.powerFactor < 0.97 && maxed(['psu', 'vrm'])) return null;
  if (n.thermalFactor < 0.97) {
    return { system: 'thermal', severity: 'red', section: 'thermal', item: 'heatsink', node: n.id,
      tip: `${tag} chip is at ${TUNING.throttleTemp}°: clock throttled ${Math.round((1 - n.thermalFactor) * 100)}%. Upgrade cooling.` };
  }
  if (n.powerFactor < 0.97) {
    return { system: 'power', severity: 'red', section: 'power', item: 'psu', node: n.id,
      tip: `${tag} chip needs ${fmtNum(n.power)} W but the PSU gives ${fmtNum(n.supply)} W. Cores are capped. Upgrade the PSU.` };
  }
  if (n.memCap < n.computeTok && !maxed(['memory', 'l3'])) {
    return { system: 'memory', severity: 'red', section: 'compute', item: 'memory', node: n.id,
      tip: `${tag} memory can only feed ${fmtNum(n.memCap)} tok/s; the cores could do ${fmtNum(n.computeTok)}. Upgrade Memory.` };
  }
  const ns = s.nodes.find((x) => x.id === n.id)!;
  const fixes: ItemId[] = ['cores', 'clock', 'cluster', 'npu'];
  const open = (i: ItemId, c?: number) => itemsFor(n.def, 'compute').some((x) => x.id === i) && level(s, i, n.id, c) < maxLevelOf(i, n.id);
  const anyOpen = fixes.some((i) => (itemDef(i).scope === 'cluster' ? ns.clusters.some((_, c) => open(i, c)) : open(i)));
  if (!anyOpen) return null;
  const sel = ns.cluster;
  const item: ItemId = open('cores', sel) ? 'cores' : open('clock', sel) ? 'clock' : open('cluster') ? 'cluster' : 'cores';
  return { system: 'compute', severity: 'red', section: 'compute', item, node: n.id,
    tip: `${tag} cores are flat out at ${fmtNum(n.computeTok)} tok/s. Add cores, raise the clock or add a cluster.` };
}

// ---------------------------------------------------------------------------
// Actions

export interface GameEvent {
  kind: 'goal' | 'client' | 'stage' | 'side' | 'info';
  text: string;
}

export function costOf(s: GameState, item: ItemId, node: NodeId | undefined, lvl: number, cluster?: number): number {
  const def = itemDef(item);
  if (def.scope === 'rig') return def.baseCost * Math.pow(def.growth, lvl);
  const id = node ?? s.selectedNode;
  let mult = nodeDef(id).costMult;
  if (def.scope === 'cluster') {
    const ns = s.nodes.find((x) => x.id === id);
    mult *= Math.pow(1.6, cluster ?? ns?.cluster ?? 0); // later clusters cost a bit more to fill
  }
  return def.baseCost * mult * Math.pow(def.growth, lvl);
}

export function maxLevelOf(item: ItemId, node?: NodeId): number {
  const def = itemDef(item);
  return def.maxLevel(node ? nodeDef(node) : undefined);
}

/** Buy up to `count` levels. Returns levels bought. */
export function buy(s: GameState, item: ItemId, node: NodeId | undefined, count: number, events: GameEvent[] = [], cluster?: number): number {
  const def = itemDef(item);
  const nodeId = def.scope !== 'rig' ? node ?? s.selectedNode : undefined;
  const ns = nodeId ? s.nodes.find((n) => n.id === nodeId) : undefined;
  if (def.scope !== 'rig' && !ns) return 0;
  const ci = cluster ?? ns?.cluster ?? 0;
  let bought = 0;
  while (bought < count) {
    const lvl = level(s, item, nodeId, ci);
    if (lvl >= maxLevelOf(item, nodeId)) break;
    const c = costOf(s, item, nodeId, lvl, ci);
    if (s.cash + 1e-9 < c) break;
    s.cash -= c;
    if (def.scope === 'cluster') ns!.clusters[ci][item] = lvl + 1;
    else if (ns) {
      ns.levels[item] = lvl + 1;
      if (item === 'cluster') { ns.clusters.push({}); ns.cluster = ns.clusters.length - 1; }
    } else s.rigLevels[item] = lvl + 1;
    bought++;
  }
  if (bought > 0) onUpgrade(s, item, def.section, bought, events);
  return bought;
}

export function canFab(s: GameState, id: NodeId): { ok: boolean; reason: string } {
  const def = nodeDef(id);
  if (s.nodes.some((n) => n.id === id)) return { ok: false, reason: 'Owned' };
  const order = NODES.map((n) => n.id);
  const prev = order[order.indexOf(id) - 1];
  if (prev && !s.nodes.some((n) => n.id === prev)) return { ok: false, reason: `Fab ${nodeDef(prev).label} first` };
  if (def.research && !research(s, def.research as ResearchId)) return { ok: false, reason: `Research ${researchDef(def.research as ResearchId).name} in the Lab` };
  if (s.cash < def.unlockCost) return { ok: false, reason: `Needs ${fmtMoney(def.unlockCost)}` };
  return { ok: true, reason: '' };
}

export function fabNode(s: GameState, id: NodeId, events: GameEvent[] = []): boolean {
  if (!canFab(s, id).ok) return false;
  s.cash -= nodeDef(id).unlockCost;
  s.nodes.push(newNode(id));
  s.selectedNode = id;
  events.push({ kind: 'info', text: `Fabbed a ${nodeDef(id).label} chip. It joins the rig and starts earning.` });
  return true;
}

export function canResearch(s: GameState, id: ResearchId): boolean {
  const def = researchDef(id);
  const lvl = research(s, id);
  if (lvl >= def.maxLevel) return false;
  if (def.requires && !research(s, def.requires)) return false;
  return s.lab >= def.cost(lvl);
}

export function doResearch(s: GameState, id: ResearchId): boolean {
  if (!canResearch(s, id)) return false;
  const lvl = research(s, id);
  s.lab -= researchDef(id).cost(lvl);
  s.research[id] = lvl + 1;
  return true;
}

export function setModel(s: GameState, id: ModelId): boolean {
  if (!s.modelsOwned.includes(id)) return false;
  s.model = id;
  return true;
}

export function assignTalent(s: GameState, section: SectionId, id: TalentId | null) {
  if (id === null) { delete s.talentSlots[section]; return; }
  if (!s.talentOwned.includes(id)) return;
  for (const k of Object.keys(s.talentSlots) as SectionId[]) if (s.talentSlots[k] === id) delete s.talentSlots[k];
  s.talentSlots[section] = id;
}

/** A click on the chip before the Auto-scheduler exists. */
export function clickProcess(s: GameState, events: GameEvent[] = []): boolean {
  if (level(s, 'scheduler') > 0 || s.queue < 1) return false;
  s.queue -= 1;
  const tokens = tokensPerRequest(s);
  serve(s, 1, tokens, events);
  const g = currentGoal(s);
  if (g?.spec.kind === 'manual') { s.goalProgress += 1; checkGoal(s, events); }
  return true;
}

// ---------------------------------------------------------------------------
// Tick

export function tick(s: GameState, dt: number, events: GameEvent[] = []): RigStats {
  s.playTime += dt;
  s.burstClock += dt;
  const r = rigStats(s);

  s.queue = Math.min(s.queue + r.arrivals * dt, Math.max(20, r.demand * TUNING.queueCapSeconds));

  let tokensServed = 0;
  if (r.scheduler) {
    const capReq = r.capTok / r.tokPerReq;
    const processed = Math.min(s.queue, capReq * dt);
    s.queue -= processed;
    tokensServed = processed * r.tokPerReq;
    serve(s, processed, tokensServed, events);
  }
  const rate = tokensServed / dt;
  s.servedRate += (rate - s.servedRate) * Math.min(1, dt * 1.5);

  // Share load across chips in proportion to what each can do.
  const share = r.capTok > 0 ? Math.min(1, rate / r.capTok) : 0;
  for (const n of r.nodes) lastUtil.set(n.id, r.scheduler ? share : Math.min(1, s.queue > 0 ? 0.15 : 0));

  trackBursts(s, r, events);
  trackTimedGoals(s, r, dt, events);
  checkGoal(s, events);
  updateSide(s, r, dt, tokensServed, events);
  return r;
}

function serve(s: GameState, requests: number, tokens: number, events: GameEvent[]) {
  const earned = tokens * pricePerToken(s);
  s.cash += earned;
  s.totals.requests += requests;
  s.totals.tokens += tokens;
  s.totals.earned += earned;
  const g = currentGoal(s);
  if (g?.spec.kind === 'served') s.goalProgress += requests;
  if (g?.spec.kind === 'tokens') s.goalProgress += tokens;
  checkGoal(s, events);
}

function trackBursts(s: GameState, r: RigStats, events: GameEvent[]) {
  const b = currentClient(s)?.quirk.bursts;
  if (!b) return;
  if (r.bursting) {
    s.burstPeakQueue = Math.max(s.burstPeakQueue, s.queue);
  } else if (s.wasBursting) {
    const g = currentGoal(s);
    if (g?.spec.kind === 'burstsCalm') {
      if (s.burstPeakQueue < g.spec.maxQueue) {
        s.goalProgress += 1;
        events.push({ kind: 'info', text: `Midnight rush handled (peak queue ${Math.round(s.burstPeakQueue)}).` });
      } else {
        events.push({ kind: 'info', text: `Rush overwhelmed the queue (${Math.round(s.burstPeakQueue)} waiting). Add compute so rushes drain faster.` });
      }
    }
    s.burstPeakQueue = 0;
  }
  s.wasBursting = r.bursting;
}

function trackTimedGoals(s: GameState, r: RigStats, dt: number, _events: GameEvent[]) {
  const g = currentGoal(s);
  if (!g) return;
  const sp = g.spec;
  if (sp.kind === 'queueUnder') {
    s.goalProgress = r.scheduler && s.queue < sp.n ? s.goalProgress + dt : 0;
  } else if (sp.kind === 'coolUnderLoad') {
    const ok = r.scheduler && r.nodes.every((n) => n.temp < sp.temp) && s.servedRate > 0;
    s.goalProgress = ok ? s.goalProgress + dt : 0;
  } else if (sp.kind === 'powerHigh') {
    const ok = r.nodes.some((n) => n.powerFactor >= 0.999 && n.powerDraw / n.supply >= sp.ratio);
    s.goalProgress = ok ? s.goalProgress + dt : 0;
  }
}

export function goalTarget(g: GoalDef): number {
  const sp = g.spec;
  switch (sp.kind) {
    case 'manual': case 'served': case 'tokens': case 'sectionUpgrades': case 'itemUpgrades': case 'burstsCalm': case 'tokRate': return sp.n;
    case 'queueUnder': case 'coolUnderLoad': case 'powerHigh': return sp.secs;
    case 'clock': return sp.ghz;
    case 'buy': case 'ownNode': return 1;
  }
}

/** Current value shown against goalTarget. */
export function goalValue(s: GameState, g: GoalDef): number {
  const sp = g.spec;
  switch (sp.kind) {
    case 'buy': return level(s, sp.item) > 0 ? 1 : 0;
    case 'ownNode': return s.nodes.some((n) => n.id === sp.node) ? 1 : 0;
    case 'tokRate': return s.servedRate;
    case 'manual': return level(s, 'scheduler') > 0 ? sp.n : s.goalProgress;
    case 'clock': return Math.max(...s.nodes.flatMap((n) => n.clusters.map((c) => nodeDef(n.id).baseClock + nodeDef(n.id).clockStep * (c.clock ?? 0))));
    default: return s.goalProgress;
  }
}

export function goalText(g: GoalDef): string {
  const sp = g.spec;
  switch (sp.kind) {
    case 'manual': return `Click the chip to process ${sp.n} requests`;
    case 'buy': return `Buy the ${itemDef(sp.item).name}`;
    case 'served': return `Serve ${fmtNum(sp.n)} requests`;
    case 'tokens': return `Serve ${fmtNum(sp.n)} tokens`;
    case 'tokRate': return `Reach ${fmtNum(sp.n)} tokens/s`;
    case 'clock': return `Reach a ${sp.ghz.toFixed(1)} GHz clock`;
    case 'queueUnder': return `Keep the queue under ${sp.n} for ${sp.secs}s`;
    case 'sectionUpgrades': return `Upgrade ${sp.section} ${sp.n} times`;
    case 'itemUpgrades': return `Upgrade ${itemDef(sp.item).name} ${sp.n} times`;
    case 'coolUnderLoad': return `Keep every chip under ${sp.temp}° for ${sp.secs}s`;
    case 'ownNode': return `Fab a ${nodeDef(sp.node).label} chip`;
    case 'powerHigh': return `Run a PSU above ${Math.round(sp.ratio * 100)}% load without throttling for ${sp.secs}s`;
    case 'burstsCalm': return `Handle ${sp.n} midnight rushes with under ${sp.maxQueue} queued`;
  }
}

function checkGoal(s: GameState, events: GameEvent[]) {
  for (let guard = 0; guard < 10; guard++) {
    const g = currentGoal(s);
    if (!g || s.stageComplete) return;
    if (goalValue(s, g) + 1e-9 < goalTarget(g)) return;
    completeGoal(s, g, events);
  }
}

function completeGoal(s: GameState, g: GoalDef, events: GameEvent[]) {
  const client = currentClient(s)!;
  s.cash += g.cash;
  s.lab += g.lab;
  s.goalsCompleted += 1;
  s.goalProgress = 0;
  events.push({ kind: 'goal', text: `Goal done: ${goalText(g)}. +${fmtMoney(g.cash)}${g.lab ? `, +${g.lab} Lab Point${g.lab > 1 ? 's' : ''}` : ''}` });
  for (const o of s.side) if (o.kind === 'completeGoal') o.progress += 1;
  s.goalIndex += 1;
  if (s.goalIndex >= client.goals.length) {
    s.lab += 2;
    const rw = client.reward;
    if ('talent' in rw) {
      s.talentOwned.push(rw.talent);
      events.push({ kind: 'client', text: `${client.name} is happy! New Talent joined your team. +2 Lab Points` });
    } else if ('model' in rw) {
      s.modelsOwned.push(rw.model);
      events.push({ kind: 'client', text: `${client.name} is happy! New Model unlocked: ${modelDef(rw.model).name} ${modelDef(rw.model).size}. +2 Lab Points` });
    }
    s.clientIndex += 1;
    s.goalIndex = 0;
    s.burstClock = 0;
    s.burstPeakQueue = 0;
    if (rw.stageComplete) {
      s.stageComplete = true;
      s.stageCompleteTime = s.playTime;
      events.push({ kind: 'stage', text: 'Chip Stage complete!' });
    }
  }
}

function onUpgrade(s: GameState, item: ItemId, section: SectionId, n: number, events: GameEvent[]) {
  const g = currentGoal(s);
  if (g?.spec.kind === 'itemUpgrades' && g.spec.item === item) s.goalProgress += n;
  if (g?.spec.kind === 'sectionUpgrades' && g.spec.section === section) s.goalProgress += n;
  for (const o of s.side) if (o.kind === 'levelSection' && o.section === section) o.progress += n;
  checkGoal(s, events);
}

// ---------------------------------------------------------------------------
// Side objectives

function rand(s: GameState): number {
  // mulberry32
  let t = (s.rngSeed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function makeSide(s: GameState): SideObjective {
  const kinds: SideObjective['kind'][] = ['levelSection', 'tokensWindow', 'queueCalm', 'completeGoal'];
  const taken = new Set(s.side.map((o) => o.kind));
  const free = kinds.filter((k) => !taken.has(k));
  const kind = free[Math.floor(rand(s) * free.length)] ?? 'levelSection';
  const base = { id: ++s.sideSeq, kind, progress: 0, started: s.playTime, windowStart: s.playTime, reward: rand(s) < 0.5 ? 'lab' : 'boost' } as SideObjective;
  if (kind === 'levelSection') {
    const secs: SectionId[] = ['compute', 'thermal', 'power', 'network'];
    base.section = secs[Math.floor(rand(s) * secs.length)];
    base.target = 3 + Math.floor(rand(s) * 4);
  } else if (kind === 'tokensWindow') {
    base.target = Math.max(200, Math.round(s.servedRate * 120 * 1.25));
  } else if (kind === 'queueCalm') {
    base.target = 45;
  } else {
    base.target = 1;
  }
  return base;
}

export function sideText(o: SideObjective): string {
  switch (o.kind) {
    case 'levelSection': return `Level ${o.section} ${o.target} times`;
    case 'tokensWindow': return `Serve ${fmtNum(o.target)} tokens in 2 minutes`;
    case 'queueCalm': return `Keep the queue under 2 for ${o.target}s`;
    case 'completeGoal': return 'Complete a client goal';
  }
}

function updateSide(s: GameState, r: RigStats, dt: number, tokens: number, events: GameEvent[]) {
  if (!r.scheduler) return;
  while (s.side.length < 3) s.side.push(makeSide(s));
  for (let i = 0; i < s.side.length; i++) {
    const o = s.side[i];
    if (o.kind === 'tokensWindow') {
      if (s.playTime - o.windowStart > 120) { o.windowStart = s.playTime; o.progress = 0; }
      o.progress += tokens;
    } else if (o.kind === 'queueCalm') {
      o.progress = s.queue < 2 ? o.progress + dt : 0;
    }
    if (o.progress >= o.target) {
      if (o.reward === 'lab') { s.lab += 1; events.push({ kind: 'side', text: `Side objective done: ${sideText(o)}. +1 Lab Point` }); }
      else { s.boostUntil = Math.max(s.boostUntil, s.playTime) + TUNING.boostSeconds; events.push({ kind: 'side', text: `Side objective done: ${sideText(o)}. ×2 income for 60s!` }); }
      s.side[i] = makeSide(s);
    } else if (s.playTime - o.started > TUNING.sideObjectiveRotate) {
      s.side[i] = makeSide(s);
    }
  }
}

// ---------------------------------------------------------------------------
// Formatting (kept here so the sim and UI agree)

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
export function fmtNum(n: number, digits = 3): string {
  if (!isFinite(n)) return '∞';
  if (Math.abs(n) < 1000) {
    if (Math.abs(n) >= 100 || n === Math.floor(n)) return Math.round(n).toString();
    return n.toFixed(Math.abs(n) < 10 ? 2 : 1);
  }
  let i = 0;
  while (Math.abs(n) >= 1000 && i < SUFFIX.length - 1) { n /= 1000; i++; }
  return n.toPrecision(digits) + SUFFIX[i];
}
export function fmtMoney(n: number): string {
  if (Math.abs(n) < 10 && n !== Math.floor(n)) return `£${n.toFixed(2)}`;
  return `£${fmtNum(n)}`;
}
export function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = Math.floor(sec % 60);
  const p = (x: number) => x.toString().padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

/** Select which core cluster of a chip the upgrade panel shows. */
export function selectCluster(s: GameState, node: NodeId, cluster: number) {
  const ns = s.nodes.find((n) => n.id === node);
  if (ns && cluster >= 0 && cluster < ns.clusters.length) ns.cluster = cluster;
}
