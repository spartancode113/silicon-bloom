// Static game content. Balancing means editing the numbers here, not code.

export type SectionId = 'compute' | 'thermal' | 'power' | 'network';
export const SECTIONS: { id: SectionId; name: string }[] = [
  { id: 'compute', name: 'Compute' },
  { id: 'thermal', name: 'Thermal' },
  { id: 'power', name: 'Power' },
  { id: 'network', name: 'Network' },
];

export type NodeId = 'n14' | 'n7' | 'n5' | 'n3';

export interface NodeDef {
  id: NodeId;
  label: string; // "14nm"
  chipName: string;
  tokPerCoreGHz: number; // tokens/s produced by one core at 1 GHz
  baseClock: number; // GHz
  clockStep: number; // GHz per clock level
  coresPerCluster: number;
  maxClusters: number;
  heatPerCoreGHz: number; // W per core at 1 GHz (scales with clock^1.5)
  powerPerCoreGHz: number; // W per core per GHz
  idlePower: number; // W
  memBase: number; // tokens/s one cluster's memory can feed at level 0
  coolBase: number; // W removed at level 0
  psuBase: number; // W supplied at level 0
  costMult: number; // multiplies every upgrade price on this node
  unlockCost: number; // £ to fab this chip
  research?: string; // Lab research required before fabbing
}

export const NODES: NodeDef[] = [
  { id: 'n14', label: '14nm', chipName: 'CHIP-14', tokPerCoreGHz: 3, baseClock: 1.2, clockStep: 0.08, coresPerCluster: 6, maxClusters: 4, heatPerCoreGHz: 6, powerPerCoreGHz: 8, idlePower: 5, memBase: 6, coolBase: 10, psuBase: 20, costMult: 1, unlockCost: 0 },
  { id: 'n7', label: '7nm', chipName: 'CHIP-07', tokPerCoreGHz: 9, baseClock: 1.8, clockStep: 0.1, coresPerCluster: 8, maxClusters: 4, heatPerCoreGHz: 7, powerPerCoreGHz: 9, idlePower: 10, memBase: 60, coolBase: 40, psuBase: 80, costMult: 25, unlockCost: 800, research: 'node7' },
  { id: 'n5', label: '5nm', chipName: 'CHIP-05', tokPerCoreGHz: 24, baseClock: 2.4, clockStep: 0.12, coresPerCluster: 8, maxClusters: 4, heatPerCoreGHz: 8, powerPerCoreGHz: 10, idlePower: 20, memBase: 500, coolBase: 150, psuBase: 300, costMult: 400, unlockCost: 20000, research: 'node5' },
  { id: 'n3', label: '3nm', chipName: 'CHIP-03', tokPerCoreGHz: 60, baseClock: 3.0, clockStep: 0.14, coresPerCluster: 12, maxClusters: 4, heatPerCoreGHz: 9, powerPerCoreGHz: 11, idlePower: 40, memBase: 4000, coolBase: 600, psuBase: 1200, costMult: 2500, unlockCost: 100000, research: 'node3' },
];

export const nodeDef = (id: NodeId): NodeDef => NODES.find((n) => n.id === id)!;

export type ItemId =
  | 'cluster' | 'cores' | 'clock' | 'memory' | 'l3' | 'npu'
  | 'heatsink' | 'fan'
  | 'psu' | 'vrm' | 'gating'
  | 'scheduler' | 'intake' | 'uplink';

export interface ItemDef {
  id: ItemId;
  name: string;
  section: SectionId;
  scope: 'cluster' | 'node' | 'rig'; // per core cluster, per chip, or shared by the whole rig
  baseCost: number;
  growth: number;
  maxLevel: (node?: NodeDef) => number;
  minNode?: NodeId; // only exists on this node or newer
  tradeoff: string;
}

export const ITEMS: ItemDef[] = [
  { id: 'scheduler', name: 'Auto-scheduler', section: 'compute', scope: 'rig', baseCost: 3, growth: 1, maxLevel: () => 1, tradeoff: 'processes requests for you' },
  { id: 'cores', name: 'Cores', section: 'compute', scope: 'cluster', baseCost: 3, growth: 1.9, maxLevel: (n) => (n ? n.coresPerCluster - 1 : 0), tradeoff: 'more cores, more heat and power' },
  { id: 'clock', name: 'Clock speed', section: 'compute', scope: 'cluster', baseCost: 2, growth: 1.25, maxLevel: () => 40, tradeoff: 'faster, runs hotter' },
  { id: 'cluster', name: 'Core cluster', section: 'compute', scope: 'node', baseCost: 120, growth: 9, maxLevel: (n) => (n ? n.maxClusters - 1 : 0), tradeoff: 'new core block; shares heat and power' },
  { id: 'memory', name: 'Memory', section: 'compute', scope: 'cluster', baseCost: 4, growth: 1.6, maxLevel: () => 60, tradeoff: "feeds this cluster's cores" },
  { id: 'l3', name: 'L3 cache', section: 'compute', scope: 'node', baseCost: 30, growth: 1.45, maxLevel: () => 30, minNode: 'n7', tradeoff: 'boosts memory, draws power' },
  { id: 'npu', name: 'NPU', section: 'compute', scope: 'node', baseCost: 80, growth: 1.42, maxLevel: () => 40, minNode: 'n5', tradeoff: 'AI accelerator, adds heat' },
  { id: 'heatsink', name: 'Heatsink', section: 'thermal', scope: 'node', baseCost: 3, growth: 1.6, maxLevel: () => 60, tradeoff: 'removes more heat' },
  { id: 'fan', name: 'Fan speed', section: 'thermal', scope: 'node', baseCost: 6, growth: 1.38, maxLevel: () => 30, tradeoff: 'more airflow, small power draw' },
  { id: 'psu', name: 'PSU', section: 'power', scope: 'node', baseCost: 3, growth: 1.6, maxLevel: () => 60, tradeoff: 'more watts available' },
  { id: 'vrm', name: 'Voltage regulator', section: 'power', scope: 'node', baseCost: 12, growth: 1.4, maxLevel: () => 30, tradeoff: 'less power per token' },
  { id: 'gating', name: 'Power gating', section: 'power', scope: 'node', baseCost: 200, growth: 1.45, maxLevel: () => 25, minNode: 'n3', tradeoff: 'idle parts sleep, less draw' },
  { id: 'intake', name: 'Request intake', section: 'network', scope: 'rig', baseCost: 2, growth: 1.6, maxLevel: () => 100, tradeoff: 'more requests in per second' },
  { id: 'uplink', name: 'Uplink bandwidth', section: 'network', scope: 'rig', baseCost: 4, growth: 1.6, maxLevel: () => 100, tradeoff: 'more tokens out per second' },
];

export const itemDef = (id: ItemId): ItemDef => ITEMS.find((i) => i.id === id)!;

// ---------- Models ----------

export type ModelId = 'spark' | 'pebble' | 'quill';
export interface ModelDef {
  id: ModelId;
  name: string;
  size: string;
  tokPerReq: number; // tokens produced per text request
  priceMult: number; // £ per token multiplier
  computeCost: number; // compute needed per token (relative)
  memCost: number; // memory needed per token (relative)
  blurb: string;
}
export const MODELS: ModelDef[] = [
  { id: 'spark', name: 'Spark', size: '0.5B', tokPerReq: 6, priceMult: 1, computeCost: 1, memCost: 1, blurb: 'Tiny and cool. Low pay.' },
  { id: 'pebble', name: 'Pebble', size: '1B', tokPerReq: 8, priceMult: 1.9, computeCost: 1.5, memCost: 1.7, blurb: 'A little smarter, a little hungrier for memory.' },
  { id: 'quill', name: 'Quill', size: '3B', tokPerReq: 12, priceMult: 3.6, computeCost: 2.4, memCost: 3.2, blurb: 'A good writer. Pays far more, needs lots of memory.' },
];
export const modelDef = (id: ModelId): ModelDef => MODELS.find((m) => m.id === id)!;

// ---------- Talent ----------

export type TalentId = 'pip' | 'dot' | 'sal';
export interface TalentDef {
  id: TalentId;
  name: string;
  section: SectionId;
  bio: string;
  boostText: string;
}
export const TALENT: TalentDef[] = [
  { id: 'pip', name: 'Pip Adeyemi', section: 'compute', bio: 'Eager intern who overclocks everything, including the kettle.', boostText: '+10% clock speed' },
  { id: 'dot', name: 'Dot Marchetti', section: 'network', bio: 'Ex-nightclub promoter. Queue whisperer.', boostText: '+15% request intake' },
  { id: 'sal', name: 'Big Sal Mwangi', section: 'power', bio: 'Gentle giant electrician. Names every PSU.', boostText: '−10% power draw' },
];
export const talentDef = (id: TalentId): TalentDef => TALENT.find((t) => t.id === id)!;

// ---------- Lab research ----------

export type ResearchId = 'billing' | 'reach' | 'efficiency' | 'node7' | 'node5' | 'node3';
export interface ResearchDef {
  id: ResearchId;
  name: string;
  maxLevel: number;
  cost: (level: number) => number; // Lab Points
  time: (level: number) => number; // seconds of play to finish this level
  requires?: ResearchId;
  text: string;
}
export const RESEARCH: ResearchDef[] = [
  { id: 'billing', name: 'Token pricing', maxLevel: 10, cost: (l) => 1 + l, time: (l) => 40 + 30 * l, text: '+15% £ per token per level' },
  { id: 'reach', name: 'Reach', maxLevel: 10, cost: (l) => 1 + l, time: (l) => 40 + 30 * l, text: '+25% user demand per level' },
  { id: 'efficiency', name: 'Efficiency', maxLevel: 8, cost: (l) => 1 + l, time: (l) => 50 + 35 * l, text: '−6% heat and power per level' },
  { id: 'node7', name: '7nm process', maxLevel: 1, cost: () => 2, time: () => 90, text: 'Lets you fab a 7nm chip' },
  { id: 'node5', name: '5nm process', maxLevel: 1, cost: () => 4, time: () => 150, requires: 'node7', text: 'Lets you fab a 5nm chip with an NPU' },
  { id: 'node3', name: '3nm process', maxLevel: 1, cost: () => 6, time: () => 210, requires: 'node5', text: 'Lets you fab a 3nm chip with power gating' },
];
// Lab bench slots: research runs in parallel, one job per slot.
export const LAB_START_SLOTS = 2;
export const LAB_SLOT_COSTS = [2500, 40000]; // £ for slot 3, then slot 4

export const researchDef = (id: ResearchId): ResearchDef => RESEARCH.find((r) => r.id === id)!;

// ---------- Clients and goals ----------

export type GoalSpec =
  | { kind: 'manual'; n: number }
  | { kind: 'buy'; item: ItemId }
  | { kind: 'served'; n: number }
  | { kind: 'tokens'; n: number }
  | { kind: 'tokRate'; n: number }
  | { kind: 'clock'; ghz: number }
  | { kind: 'queueUnder'; n: number; secs: number }
  | { kind: 'sectionUpgrades'; section: SectionId; n: number }
  | { kind: 'itemUpgrades'; item: ItemId; n: number }
  | { kind: 'coolUnderLoad'; temp: number; secs: number }
  | { kind: 'ownNode'; node: NodeId }
  | { kind: 'powerHigh'; ratio: number; secs: number }
  | { kind: 'burstsCalm'; n: number; maxQueue: number };

export interface GoalDef {
  spec: GoalSpec;
  cash: number;
  lab: number;
}

export type Reward = ({ talent: TalentId } | { model: ModelId }) & { stageComplete?: true };

export interface ClientQuirk {
  fixedTokens?: number; // every request is exactly this many tokens
  tokenMult?: number; // multiplies tokens per request
  payMult?: number; // £ per token multiplier
  payNeedsQueueUnder?: number; // payMult only while queue below this
  bursts?: { every: number; length: number; mult: number; base: number };
  demandMult?: number; // this client's users relative to normal
  memMult?: number; // memory needed per token
  powerMult?: number;
}

export interface ClientDef {
  id: number;
  name: string;
  blurb: string;
  quirkText: string;
  pushes: string;
  quirk: ClientQuirk;
  goals: GoalDef[];
  reward: Reward;
}

export const STAGE_1_CLIENTS: ClientDef[] = [
  {
    id: 1,
    name: "Nana Byte's Soup Line",
    blurb: 'A chatbot that only talks about soup. Any other topic and it steers back to leek and potato.',
    quirkText: 'Tiny requests, very patient users.',
    pushes: 'Compute',
    quirk: {},
    goals: [
      { spec: { kind: 'manual', n: 10 }, cash: 0.5, lab: 0 },
      { spec: { kind: 'buy', item: 'scheduler' }, cash: 1, lab: 1 },
      { spec: { kind: 'served', n: 100 }, cash: 5, lab: 1 },
      { spec: { kind: 'tokRate', n: 7 }, cash: 10, lab: 1 },
    ],
    reward: { talent: 'pip' },
  },
  {
    id: 2,
    name: 'Haiku Harbour',
    blurb: 'A poets’ collective. Every reply must be exactly 17 tokens.',
    quirkText: 'A small, picky crowd. Fixed 17-token requests, paying ×1.5 while the queue stays under 5.',
    pushes: 'Clock speed',
    quirk: { fixedTokens: 17, payMult: 1.5, payNeedsQueueUnder: 5, demandMult: 0.45 },
    goals: [
      { spec: { kind: 'served', n: 250 }, cash: 20, lab: 1 },
      { spec: { kind: 'clock', ghz: 2.0 }, cash: 40, lab: 1 },
      { spec: { kind: 'queueUnder', n: 5, secs: 30 }, cash: 60, lab: 1 },
    ],
    reward: { model: 'pebble' },
  },
  {
    id: 3,
    name: 'Midnight Mixtape',
    blurb: 'An AI DJ writing playlist blurbs. Quiet all day, then a rush at midnight.',
    quirkText: 'Demand comes in bursts: a 2.5× rush for 15 s every minute.',
    pushes: 'Network',
    quirk: { bursts: { every: 60, length: 15, mult: 2, base: 0.8 } },
    goals: [
      { spec: { kind: 'itemUpgrades', item: 'intake', n: 3 }, cash: 80, lab: 1 },
      { spec: { kind: 'burstsCalm', n: 2, maxQueue: 150 }, cash: 150, lab: 1 },
      { spec: { kind: 'served', n: 3000 }, cash: 250, lab: 1 },
    ],
    reward: { talent: 'dot' },
  },
  {
    id: 4,
    name: "Sir Reginald's Etiquette Engine",
    blurb: 'A butler bot that cannot say anything in fewer than 200 words.',
    quirkText: 'Replies are 5× longer: lots of tokens, lots of heat.',
    pushes: 'Thermal',
    quirk: { tokenMult: 5 },
    goals: [
      { spec: { kind: 'tokens', n: 40000 }, cash: 400, lab: 1 },
      { spec: { kind: 'ownNode', node: 'n7' }, cash: 800, lab: 2 },
      { spec: { kind: 'coolUnderLoad', temp: 80, secs: 60 }, cash: 1500, lab: 1 },
    ],
    reward: { model: 'quill' },
  },
  {
    id: 5,
    name: 'Goldfish Memory Co.',
    blurb: 'A note-taking app that forgets everything and resends the whole conversation every time.',
    quirkText: 'Every token needs 2.5× the memory, and power draw is 30% higher.',
    pushes: 'Memory and Power',
    quirk: { memMult: 2.5, powerMult: 1.3 },
    goals: [
      { spec: { kind: 'itemUpgrades', item: 'memory', n: 4 }, cash: 5000, lab: 1 },
      { spec: { kind: 'ownNode', node: 'n5' }, cash: 20000, lab: 2 },
      { spec: { kind: 'powerHigh', ratio: 0.9, secs: 30 }, cash: 50000, lab: 1 },
      { spec: { kind: 'ownNode', node: 'n3' }, cash: 200000, lab: 2 },
      { spec: { kind: 'served', n: 25000 }, cash: 500000, lab: 2 },
    ],
    reward: { talent: 'sal', stageComplete: true },
  },
];

// Names of the clients still to come, shown locked on the Clients screen.
export const FUTURE_CLIENTS: { stage: string; names: string[] }[] = [
  { stage: 'GPU Board', names: ['PawTrait Studio', 'Meme Forge', 'Captain Caption', 'Doodle Dojo', 'RetroPixel Revival'] },
  { stage: 'Server Rack', names: ['Bugsy & Daughters Debugging', 'Clause & Effect Legal', 'Spreadsheet Whisperer', 'Lunar Logistics', 'The Infinite Novel'] },
  { stage: 'Server Row', names: ['Chatterbox Appliances', 'Echo Valley Radio', 'Calm Line Support', 'Polyglot Parrot', 'StadiumCast'] },
  { stage: 'AI Data Hall', names: ['Dreamreel Pictures', 'Sunbeam Forecasting', 'Museum of Tomorrow', 'Orbital Academy', 'Everyone, Everywhere'] },
];

// ---------- Tuning constants ----------

export const TUNING = {
  pricePerToken: 0.2, // £
  baseDemand: 1.0, // requests/s at the very start
  demandPerGoal: 1.35, // demand multiplier per completed goal
  reachPerLevel: 0.25,
  billingPerLevel: 0.15,
  efficiencyPerLevel: 0.06,
  intakeBase: 1.6, // requests/s at level 0
  intakeGrowth: 1.5,
  uplinkBase: 12, // tokens/s at level 0
  uplinkGrowth: 1.5,
  throttleTemp: 85,
  idleTemp: 30,
  queueCapSeconds: 30, // queue holds at most this many seconds of demand
  sideObjectiveRotate: 600, // seconds of play
  boostSeconds: 60,
  demandRampSeconds: 40, // demand eases up to the next goal's level over this long
  capacityStep: 1.5, // heatsink, PSU and memory: each level is a big step, so a fix lasts
  slack: 0.88, // a limit must bite by more than 8% before it flashes red
};
