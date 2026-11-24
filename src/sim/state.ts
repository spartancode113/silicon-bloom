import type { ItemId, ModelId, NodeId, ResearchId, SectionId, TalentId } from './data';

export interface NodeState {
  id: NodeId;
  levels: Partial<Record<ItemId, number>>;
}

export type SideKind = 'levelSection' | 'tokensWindow' | 'queueCalm' | 'completeGoal';
export interface SideObjective {
  id: number;
  kind: SideKind;
  section?: SectionId;
  target: number;
  progress: number;
  started: number; // play time it appeared
  windowStart: number; // for tokensWindow
  reward: 'lab' | 'boost';
}

export interface GameState {
  version: 1;
  playTime: number; // seconds, only counts while unpaused
  cash: number;
  lab: number;
  nodes: NodeState[]; // owned chips, oldest first
  rigLevels: Partial<Record<ItemId, number>>; // upgrades shared by the rig
  selectedNode: NodeId;
  research: Partial<Record<ResearchId, number>>;
  clientIndex: number; // index into STAGE_1_CLIENTS
  goalIndex: number;
  goalProgress: number;
  goalsCompleted: number;
  stageComplete: boolean;
  stageCompleteTime: number | null;
  queue: number; // requests waiting
  burstClock: number;
  burstPeakQueue: number;
  wasBursting: boolean;
  talentOwned: TalentId[];
  talentSlots: Partial<Record<SectionId, TalentId>>;
  modelsOwned: ModelId[];
  model: ModelId;
  side: SideObjective[];
  sideSeq: number;
  rngSeed: number;
  boostUntil: number;
  servedRate: number; // smoothed tokens/s
  totals: { requests: number; tokens: number; earned: number };
}

export function newGame(seed = Date.now() % 100000): GameState {
  return {
    version: 1,
    playTime: 0,
    cash: 0,
    lab: 0,
    nodes: [{ id: 'n14', levels: {} }],
    rigLevels: {},
    selectedNode: 'n14',
    research: {},
    clientIndex: 0,
    goalIndex: 0,
    goalProgress: 0,
    goalsCompleted: 0,
    stageComplete: false,
    stageCompleteTime: null,
    queue: 6,
    burstClock: 0,
    burstPeakQueue: 0,
    wasBursting: false,
    talentOwned: [],
    talentSlots: {},
    modelsOwned: ['spark'],
    model: 'spark',
    side: [],
    sideSeq: 0,
    rngSeed: seed,
    boostUntil: 0,
    servedRate: 0,
    totals: { requests: 0, tokens: 0, earned: 0 },
  };
}
