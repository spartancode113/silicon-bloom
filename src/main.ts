import './style.css';
import type { ItemId, ModelId, NodeId, ResearchId, SectionId, TalentId } from './sim/data';
import { talentDef } from './sim/data';
import {
  assignTalent, bottlenecks, buy, clickProcess, doResearch, fabNode, resetUtilCache, rigStats, setModel, tick,
  type GameEvent, type RigStats,
} from './sim/engine';
import { newGame, type GameState } from './sim/state';
import { addScore, hasSave, loadGame, loadScores, saveGame } from './save';
import { RigRenderer } from './ui/rig';
import * as P from './ui/panels';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const el = {
  top: $('#topbar'),
  nav: $('#nav'),
  canvas: $<HTMLCanvasElement>('#rig'),
  screen: $('#screen'),
  toasts: $('#toasts'),
  client: $('#client'),
  sideObj: $('#side-objectives'),
  tip: $('#tip'),
  tabs: $('#tabs'),
  nodes: $('#nodes'),
  amount: $('#amount'),
  cards: $('#cards'),
  overlay: $('#overlay'),
};

const SIM_DT = 0.1;
let game: GameState = loadGame() ?? newGame();
let paused = true; // the start menu is up
let overlay: 'menu' | 'scores' | 'paused' | 'stage' | null = 'menu';
let confirmNew = false;
const ui: P.UiState = { screen: 'rig', section: 'compute', buyAmount: 1 };
const rig = new RigRenderer(el.canvas);
let stats: RigStats = rigStats(game);
const events: GameEvent[] = [];

// ---------------------------------------------------------------------------
// Simulation loop. Runs on a timer (not animation frames) so a background tab
// keeps playing. Closing the browser stops it; there are no offline earnings.

let last = performance.now();
let acc = 0;
setInterval(() => {
  const now = performance.now();
  acc += Math.min(600, (now - last) / 1000); // catch up at most 10 minutes per wake
  last = now;
  if (paused) { acc = 0; return; }
  let steps = 0;
  while (acc >= SIM_DT && steps < 6000) {
    stats = tick(game, SIM_DT, events);
    acc -= SIM_DT;
    steps++;
  }
  flushEvents();
}, 100);

setInterval(() => { if (!paused) saveGame(game); }, 5000);
const saveNow = () => { if (overlay !== 'menu') saveGame(game); };
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
window.addEventListener('pagehide', saveNow);

function flushEvents() {
  while (events.length) {
    const e = events.shift()!;
    toast(e.text, e.kind);
    if (e.kind === 'stage') {
      addScore({ time: game.stageCompleteTime ?? game.playTime, label: 'Chip Stage', date: new Date().toISOString() });
      saveGame(game);
      overlay = 'stage';
      paused = true;
    }
  }
}

function toast(text: string, kind: GameEvent['kind']) {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = text;
  el.toasts.prepend(t);
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 5000);
  while (el.toasts.children.length > 5) el.toasts.lastElementChild?.remove();
}

// ---------------------------------------------------------------------------
// Render loop

let lastFrame = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (paused) stats = rigStats(game);
  const bn = bottlenecks(game, stats);
  rig.draw(game, stats, bn, paused ? dt * 0.25 : dt);
  render(bn);
  requestAnimationFrame(frame);
}

function render(bn: ReturnType<typeof bottlenecks>) {
  P.setHtml(el.top, P.topBar(game, stats, paused && overlay === 'paused'));
  P.setHtml(el.nav, P.navBar(ui, bn));
  P.setHtml(el.client, P.clientCard(game));
  P.setHtml(el.sideObj, P.sideCard(game));
  P.setHtml(el.tip, P.tipBanner(bn));
  P.setHtml(el.tabs, P.sectionTabs(ui, bn));
  P.setHtml(el.nodes, P.nodeSwitcher(game, bn));
  P.setHtml(el.amount, P.buyToggle(ui));
  P.setHtml(el.cards, P.upgradeCards(game, ui, bn));

  const screenHtml = ui.screen === 'clients' ? P.clientsScreen(game)
    : ui.screen === 'lab' ? P.labScreen(game)
    : ui.screen === 'team' ? P.teamScreen(game) : '';
  el.screen.classList.toggle('open', ui.screen !== 'rig');
  P.setHtml(el.screen, screenHtml ? `<button class="close" data-action="screen" data-screen="rig">✕</button>${screenHtml}` : '');

  const ov = overlay === 'menu' ? P.startMenu(hasSaveCached, confirmNew)
    : overlay === 'scores' ? P.scoreboard(loadScores())
    : overlay === 'paused' ? P.pausedCard()
    : overlay === 'stage' ? P.stageCompleteCard(game) : '';
  el.overlay.classList.toggle('open', !!ov);
  el.overlay.classList.toggle('menu', overlay === 'menu' || overlay === 'scores');
  P.setHtml(el.overlay, ov);
}

let hasSaveCached = hasSave();

// ---------------------------------------------------------------------------
// Input

function startPlaying() {
  overlay = null;
  paused = false;
  last = performance.now();
  acc = 0;
}

const actions: Record<string, (d: DOMStringMap) => void> = {
  screen: (d) => { ui.screen = d.screen as P.Screen; },
  section: (d) => { ui.section = d.section as SectionId; },
  node: (d) => { game.selectedNode = d.node as NodeId; },
  amount: (d) => { ui.buyAmount = d.amount === 'max' ? 'max' : (Number(d.amount) as 1 | 10); },
  buy: (d) => {
    const n = ui.buyAmount === 'max' ? 1000 : ui.buyAmount;
    buy(game, d.item as ItemId, game.selectedNode, n, events);
    stats = rigStats(game);
    flushEvents();
  },
  fab: (d) => { if (fabNode(game, d.node as NodeId, events)) { stats = rigStats(game); flushEvents(); } },
  research: (d) => { if (doResearch(game, d.research as ResearchId)) toast('Research complete.', 'info'); },
  model: (d) => { setModel(game, d.model as ModelId); stats = rigStats(game); },
  assign: (d) => { const t = d.talent as TalentId; assignTalent(game, talentDef(t).section, t); },
  unassign: (d) => { assignTalent(game, d.section as SectionId, null); },
  pause: () => {
    if (overlay === 'paused') { startPlaying(); return; }
    if (overlay) return;
    paused = true; overlay = 'paused'; saveGame(game);
  },
  menu: () => { saveGame(game); hasSaveCached = true; paused = true; overlay = 'menu'; confirmNew = false; },
  'menu-back': () => { overlay = 'menu'; },
  scores: () => { overlay = 'scores'; },
  resume: () => { const g = loadGame(); if (g) { game = g; resetUtilCache(); stats = rigStats(game); } startPlaying(); },
  new: () => { if (hasSaveCached) confirmNew = true; else beginNew(); },
  'new-confirm': () => beginNew(),
  'new-cancel': () => { confirmNew = false; },
  'close-modal': () => { startPlaying(); },
};

function beginNew() {
  game = newGame();
  resetUtilCache();
  stats = rigStats(game);
  confirmNew = false;
  ui.screen = 'rig';
  ui.section = 'compute';
  saveGame(game);
  hasSaveCached = true;
  startPlaying();
}

document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target || (target as HTMLButtonElement).disabled) return;
  const fn = actions[target.dataset.action!];
  if (fn) { fn(target.dataset); render(bottlenecks(game, stats)); }
});

el.canvas.addEventListener('pointerdown', (e) => {
  if (paused) return;
  const r = el.canvas.getBoundingClientRect();
  const id = rig.chipAt(e.clientX - r.left, e.clientY - r.top);
  if (!id) return;
  game.selectedNode = id;
  if (clickProcess(game, events)) { rig.flashClick(); rig.burstFromChip(id); flushEvents(); }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (ui.screen !== 'rig') ui.screen = 'rig';
    else actions.pause({});
  }
});

const resize = () => rig.resize();
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
