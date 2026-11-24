import { beforeEach, describe, expect, it } from 'vitest';
import {
  bottlenecks, buy, canFab, clickProcess, currentGoal, doResearch, fabNode, level, resetUtilCache, rigStats, tick,
  type GameEvent,
} from './engine';
import { newGame, type GameState } from './state';
import { serialise, deserialise } from '../save';

let s: GameState;
beforeEach(() => { resetUtilCache(); s = newGame(1); });

const run = (secs: number, ev: GameEvent[] = []) => { for (let t = 0; t < secs; t += 0.1) tick(s, 0.1, ev); };

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
    s.goalsCompleted = 6;
    const b = bottlenecks(s, rigStats(s));
    expect(b.some((x) => x.system === 'intake' && x.severity === 'red')).toBe(true);
  });

  it('shows amber spare capacity when demand is the limit', () => {
    s.rigLevels.scheduler = 1;
    s.nodes[0].clusters = [{ cores: 5 }];
    s.nodes[0].levels = { memory: 30, heatsink: 30, psu: 30 };
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
    expect(fabNode(s, 'n7')).toBe(true);
    expect(s.nodes.map((n) => n.id)).toEqual(['n14', 'n7']);
    expect(level(s, 'cores', 'n7')).toBe(0);
  });

  it('older chips keep earning alongside newer ones', () => {
    s.lab = 10; doResearch(s, 'node7'); s.cash = 1e6; fabNode(s, 'n7');
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
    expect(buy(s, 'cluster', 'n14', 10)).toBe(1); // 14nm holds 2
  });
});

describe('saving', () => {
  it('moves cores and clock from old saves into the first cluster', () => {
    const old = JSON.parse(serialise(s));
    old.nodes = [{ id: 'n14', levels: { cores: 4, clock: 9, memory: 3 } }];
    const back = deserialise(JSON.stringify(old))!;
    expect(back.nodes[0].clusters[0]).toEqual({ cores: 4, clock: 9 });
    expect(back.nodes[0].levels).toEqual({ memory: 3 });
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
