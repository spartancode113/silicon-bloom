import { newGame, type GameState } from './sim/state';
import { nodeDef } from './sim/data';

const SAVE_KEY = 'silicon-bloom/save/v1';
const SCORES_KEY = 'silicon-bloom/scores/v1';

export function serialise(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialise(text: string | null): GameState | null {
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    if (!data || data.version !== 1 || typeof data.playTime !== 'number') return null;
    // Fill any fields added since the save was written.
    const s: GameState = { ...newGame(), ...data };
    if (typeof data.demandLevel !== 'number') s.demandLevel = s.goalsCompleted;
    // Saves from before core clusters: move chip cores/clock into cluster 1.
    for (const n of s.nodes) {
      if (!Array.isArray(n.clusters)) {
        const def = nodeDef(n.id);
        n.clusters = [{ cores: Math.min(n.levels.cores ?? 0, def.coresPerCluster - 1), clock: n.levels.clock ?? 0 }];
        n.cluster = 0;
        delete n.levels.cores;
        delete n.levels.clock;
      }
    }
    return s;
  } catch {
    return null;
  }
}

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function saveGame(s: GameState) {
  try { storage()?.setItem(SAVE_KEY, serialise(s)); } catch { /* storage full or blocked */ }
}

export function loadGame(): GameState | null {
  try { return deserialise(storage()?.getItem(SAVE_KEY) ?? null); } catch { return null; }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export interface ScoreEntry {
  time: number; // play seconds
  label: string; // what was completed
  date: string; // ISO date
}

export function loadScores(): ScoreEntry[] {
  try {
    const raw = storage()?.getItem(SCORES_KEY);
    const list = raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function addScore(e: ScoreEntry) {
  const list = [...loadScores(), e].sort((a, b) => a.time - b.time).slice(0, 20);
  try { storage()?.setItem(SCORES_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
