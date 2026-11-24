import { beforeEach, describe, expect, it } from 'vitest';
import {
  bottlenecks, buy, buyLabSlot, canFab, canResearch, clickProcess, demandNow, currentGoal, doResearch, fabNode, level, resetUtilCache, rigStats, tick,
  type GameEvent,
} from './engine';
import { newGame, type GameState } from './state';
import { serialise, deserialise } from '../save';

let s: GameState;
beforeEach(() => { resetUtilCache(); s = newGame(1); });

const run = (secs: number, ev: GameEvent[] = []) => { for (let t = 0; t < secs; t += 0.1) tick(s, 0.1, ev); };
const finishLab = () => run(Math.max(0, ...s.labJobs.map((j) => j.started + j.duration - s.playTime)) + 0.2);

describe('early game', () => {
  it('only earns from clicks until the Auto-scheduler is bought', () => {
    run(5);
    expect(s.cash).toBe(0);
    expect(clickProcess(s)).toBe(true);
    expect(s.cash).toBeGreaterThan(0);
  });

  it('processes automatically after the first upgrade, and clicks stop doing anything', () => {
    for (let i = 0; i < 10; i++) clickProcess(s);
    s.cash += 5;
    expect(buy(s, 'scheduler', undefined, 1)).toBe(1);
    const before = s.cash;
    run(10);
    expect(s.cash).toBeGreaterThan(before);
    expect(clickProcess(s)).toBe(false);
  });

  it('completes the click goal and moves on', () => {
    for (let i = 0; i < 10; i++) { run(1); clickProcess(s); }
    expect(s.goalIndex).toBe(1);
    expect(currentGoal(s)?.spec.kind).toBe('buy');
  });
});

describe('simulation', () => {
  it('throttles the clock when heat exceeds cooling, and never breaks anything', () => {
    s.nodes[0].clusters = [{ cores: 5, clock: 40 }];
    const n = rigStats(s).nodes[0];
    expect(n.heat).toBeGreaterThan(n.cool);
    expect(n.thermalFactor).toBeLessThan(1);
    expect(n.effClock).toBeLessThan(n.clock);
    expect(n.computeTok).toBeGreaterThan(0);
  });

  it('caps compute when power draw exceeds the PSU', () => {
    s.nodes[0].clusters = [{ cores: 5, clock: 20 }];
    s.nodes[0].levels = { heatsink: 60 };
    const n = rigStats(s).nodes[0];
    expect(n.powerFactor).toBeLessThan(1);
  });

  it('upgrading cooling removes the thermal throttle', () => {
    s.nodes[0].clusters = [{ cores: 3, clock: 10 }];
    const hot = rigStats(s).nodes[0];
    s.nodes[0].levels.heatsink = 30;
    const cool = rigStats(s).nodes[0];
    expect(cool.thermalFactor).toBeGreaterThan(hot.thermalFactor);
  });

  it('queues requests instead of losing them when the rig is too slow', () => {
    s.rigLevels.scheduler = 1;
    s.goalsCompleted = 8; // lots of demand
    s.rigLevels.intake = 40;
    run(20);
    expect(s.queue).toBeGreaterThan(5);
  });
});

describe('bottlenecks', () => {
  it('flags the scheduler first in a new game', () => {
    expect(bottlenecks(s, rigStats(s))[0].system).toBe('scheduler');
  });

  it('flags intake when users outnumber what the network lets in', () => {
    s.rigLevels.scheduler = 1;
    s.goalsCompleted = 6; s.demandLevel = 6;
    const b = bottlenecks(s, rigStats(s));
    expect(b.some((x) => x.system === 'intake' && x.severity === 'red')).toBe(true);
  });

  it('shows amber spare capacity when demand is the limit', () => {
    s.rigLevels.scheduler = 1;
    s.nodes[0].clusters = [{ cores: 5, memory: 30 }];
    s.nodes[0].levels = { heatsink: 30, psu: 30 };
    s.rigLevels.uplink = 30;
    s.queue = 0;
    const b = bottlenecks(s, rigStats(s));
    expect(b.some((x) => x.system === 'demand' && x.severity === 'amber')).toBe(true);
  });
});

describe('process nodes', () => {
  it('needs Lab research and cash before a new chip can be fabbed', () => {
    expect(canFab(s, 'n7').ok).toBe(false);
    s.lab = 10;
    expect(doResearch(s, 'node7')).toBe(true);
    s.cash = 1e6;
    expect(canFab(s, 'n7').ok).toBe(false); // still researching
    finishLab();
    s.cash = 1e6;
    expect(fabNode(s, 'n7')).toBe(true);
    expect(s.nodes.map((n) => n.id)).toEqual(['n14', 'n7']);
    expect(level(s, 'cores', 'n7')).toBe(0);
  });

  it('older chips keep earning alongside newer ones', () => {
    s.lab = 10; doResearch(s, 'node7'); finishLab(); s.cash = 1e6; fabNode(s, 'n7');
    const r = rigStats(s);
    expect(r.nodes.every((n) => n.cap > 0)).toBe(true);
    expect(r.nodeCapTotal).toBeCloseTo(r.nodes[0].cap + r.nodes[1].cap);
  });
});

describe('core clusters', () => {
  it('buying a cluster adds a new block of cores that shares the chip\'s heat', () => {
    s.cash = 1e6;
    const before = rigStats(s).nodes[0];
    expect(buy(s, 'cluster', 'n14', 1)).toBe(1);
    expect(s.nodes[0].clusters.length).toBe(2);
    expect(s.nodes[0].cluster).toBe(1); // panel jumps to the new cluster
    const after = rigStats(s).nodes[0];
    expect(after.cores).toBe(before.cores + 1);
    expect(after.heat).toBeGreaterThan(before.heat);
  });

  it('cores and clock upgrades apply to the selected cluster only', () => {
    s.cash = 1e6;
    buy(s, 'cluster', 'n14', 1);
    buy(s, 'cores', 'n14', 2);
    expect(s.nodes[0].clusters[1].cores).toBe(2);
    expect(s.nodes[0].clusters[0].cores ?? 0).toBe(0);
    expect(level(s, 'cores', 'n14', 0)).toBe(0);
  });

  it('a chip cannot hold more clusters than its design allows', () => {
    s.cash = 1e12;
    expect(buy(s, 'cluster', 'n14', 10)).toBe(3); // every chip holds 4
  });
});

describe('lab queue', () => {
  it('research takes time and runs two at once', () => {
    s.lab = 50;
    expect(doResearch(s, 'billing')).toBe(true);
    expect(s.research.billing ?? 0).toBe(0);
    expect(canResearch(s, 'billing')).toBe(false); // one level at a time
    expect(doResearch(s, 'reach')).toBe(true);
    expect(doResearch(s, 'efficiency')).toBe(false); // both slots busy
    finishLab();
    expect(s.research.billing).toBe(1);
    expect(s.research.reach).toBe(1);
    expect(s.labJobs).toHaveLength(0);
  });

  it('extra slots cost cash and let more run at once', () => {
    s.lab = 50;
    expect(buyLabSlot(s)).toBe(false);
    s.cash = 1e6;
    expect(buyLabSlot(s)).toBe(true);
    expect(buyLabSlot(s)).toBe(true);
    expect(buyLabSlot(s)).toBe(false); // four is the most
    for (const id of ['billing', 'reach', 'efficiency', 'node7'] as const) expect(doResearch(s, id)).toBe(true);
  });
});

describe('pacing', () => {
  it('demand eases up after a goal instead of jumping', () => {
    const before = demandNow(s).demand;
    s.goalsCompleted = 1;
    expect(demandNow(s).demand).toBeCloseTo(before);
    run(60);
    expect(demandNow(s).demand).toBeGreaterThan(before * 1.3);
  });
});

describe('per-cluster memory', () => {
  it('each cluster has its own memory, and a starved cluster is flagged by itself', () => {
    s.rigLevels.scheduler = 1;
    s.cash = 1e12;
    buy(s, 'cluster', 'n14', 1); // adds C2 and selects it
    s.nodes[0].clusters[0] = { cores: 5, clock: 10, memory: 0 };
    s.nodes[0].clusters[1] = { memory: 12 };
    s.nodes[0].levels = { heatsink: 30, psu: 30 };
    s.queue = 1000; s.goalsCompleted = 0;
    const r = rigStats(s);
    const [c1, c2] = r.nodes[0].clusters;
    expect(c2.memCap).toBeGreaterThan(c1.memCap);
    const mem = bottlenecks(s, r).find((b) => b.system === 'memory');
    expect(mem?.cluster).toBe(0);
    // Upgrading memory on C2 leaves C1 untouched.
    expect(level(s, 'memory', 'n14', 0)).toBe(0);
    buy(s, 'memory', 'n14', 1, [], 1);
    expect(level(s, 'memory', 'n14', 1)).toBe(13);
    expect(level(s, 'memory', 'n14', 0)).toBe(0);
  });
});

describe('saving', () => {
  it('moves cores and clock from old saves into the first cluster', () => {
    const old = JSON.parse(serialise(s));
    old.nodes = [{ id: 'n14', levels: { cores: 4, clock: 9, memory: 3 } }];
    const back = deserialise(JSON.stringify(old))!;
    expect(back.nodes[0].clusters[0]).toEqual({ cores: 4, clock: 9, memory: 3 });
    expect(back.nodes[0].levels).toEqual({});
  });

  it('round-trips the game state', () => {
    s.cash = 123; s.playTime = 456;
    const back = deserialise(serialise(s))!;
    expect(back.cash).toBe(123);
    expect(back.playTime).toBe(456);
  });

  it('rejects garbage', () => {
    expect(deserialise('nope')).toBeNull();
  });
});
