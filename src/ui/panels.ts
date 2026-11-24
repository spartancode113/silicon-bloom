// DOM panels: top bar, right-hand panel and the full-screen overlays.
// Each region re-renders only when its HTML changes, so buttons stay clickable.
import {
  FUTURE_CLIENTS, MODELS, NODES, RESEARCH, SECTIONS, STAGE_1_CLIENTS, TALENT, TUNING,
  modelDef, nodeDef, talentDef,
  type ClientDef, type GoalDef, type ItemId, type NodeId, type SectionId,
} from '../sim/data';
import {
  canFab, canResearch, costOf, currentClient, fmtMoney, fmtNum, fmtTime, goalTarget, goalText, goalValue,
  itemsFor, level, maxLevelOf, sideText,
  type Bottleneck, type RigStats,
} from '../sim/engine';
import type { GameState } from '../sim/state';
import type { ScoreEntry } from '../save';

export type Screen = 'rig' | 'clients' | 'lab' | 'team';
export interface UiState {
  screen: Screen;
  section: SectionId;
  buyAmount: 1 | 10 | 'max';
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const cache = new Map<HTMLElement, string>();
export function setHtml(el: HTMLElement, html: string) {
  if (cache.get(el) === html) return;
  cache.set(el, html);
  el.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Top bar

export function topBar(s: GameState, r: RigStats, paused: boolean): string {
  const income = s.servedRate * r.price;
  const boost = s.playTime < s.boostUntil ? `<span class="pill boost">×2 income ${Math.ceil(s.boostUntil - s.playTime)}s</span>` : '';
  return `
    <div class="brand"><span class="logo-dot"></span>SILICON BLOOM</div>
    <div class="stat"><label>Stage</label><b>Chip</b></div>
    <div class="stat"><label>Income</label><b class="green">${fmtMoney(income)}/s</b></div>
    <div class="stat big"><label>Cash</label><b class="green">${fmtMoney(s.cash)}</b></div>
    <div class="stat"><label>Lab Points</label><b class="magenta">${s.lab}</b></div>
    <div class="stat"><label>Model</label><b>${modelDef(s.model).name} ${modelDef(s.model).size}</b></div>
    ${boost}
    <div class="spacer"></div>
    <div class="stat timer"><label>Play time</label><b>${fmtTime(s.playTime)}</b></div>
    <button class="icon-btn" data-action="pause" title="Pause (Esc)">${paused ? '▶' : '❚❚'}</button>
    <button class="icon-btn" data-action="menu" title="Main menu">☰</button>`;
}

export function navBar(ui: UiState, bn: Bottleneck[]): string {
  const dot = (screen: Screen) => {
    if (screen === 'rig' && bn.some((b) => b.severity === 'red')) return '<i class="dot red"></i>';
    if (screen === 'lab' && bn.some((b) => b.system === 'demand')) return '<i class="dot amber"></i>';
    return '';
  };
  const item = (screen: Screen, icon: string, name: string) =>
    `<button class="nav-item ${ui.screen === screen ? 'active' : ''}" data-action="screen" data-screen="${screen}">${dot(screen)}<span class="nav-icon">${icon}</span>${name}</button>`;
  return item('rig', '◈', 'Rig') + item('clients', '◎', 'Clients') + item('lab', '⚗', 'Lab') + item('team', '☆', 'Team');
}

// ---------------------------------------------------------------------------
// Right panel

function progressBar(frac: number, cls = '') {
  return `<div class="bar ${cls}"><div style="width:${Math.max(0, Math.min(1, frac)) * 100}%"></div></div>`;
}

function goalProgressText(s: GameState, g: GoalDef): string {
  const v = goalValue(s, g), t = goalTarget(g);
  const sp = g.spec;
  if (sp.kind === 'buy' || sp.kind === 'ownNode') return v >= 1 ? 'done' : '';
  if (sp.kind === 'clock') return `${v.toFixed(2)} / ${t.toFixed(1)} GHz`;
  if (sp.kind === 'queueUnder' || sp.kind === 'coolUnderLoad' || sp.kind === 'powerHigh') return `${Math.floor(v)} / ${t}s`;
  return `${fmtNum(Math.min(v, t))} / ${fmtNum(t)}`;
}

export function clientCard(s: GameState): string {
  const c = currentClient(s);
  if (!c) {
    return `<div class="card client done"><div class="eyebrow">Chip Stage complete</div><h3>All five clients served</h3>
      <p class="muted">The GPU Board arrives in the next milestone. Keep tinkering if you like.</p></div>`;
  }
  // Compact: the current goal in full, the rest as numbered steps (full list on the Clients screen).
  const g = c.goals[s.goalIndex];
  const steps = c.goals.map((_, i) => `<i class="${i < s.goalIndex ? 'done' : i === s.goalIndex ? 'active' : ''}">${i < s.goalIndex ? '✓' : i + 1}</i>`).join('');
  return `<div class="card client">
    <div class="client-top"><div class="eyebrow">Client ${c.id} / 25 · ${esc(c.pushes)}</div><div class="steps">${steps}</div></div>
    <h3>${esc(c.name)}</h3>
    <p class="quirk" title="${esc(c.blurb)}">${esc(c.quirkText)}</p>
    ${g ? `<div class="goal-now"><div><span class="eyebrow">Goal ${s.goalIndex + 1}</span> ${esc(goalText(g))}</div>
      <div class="goal-row">${progressBar(goalValue(s, g) / goalTarget(g))}<small>${goalProgressText(s, g)}</small></div></div>` : ''}
    <div class="reward">Reward: ${rewardText(c)}</div>
  </div>`;
}

function rewardText(c: ClientDef): string {
  const r = c.reward;
  const base = 'talent' in r ? `Talent · ${esc(talentDef(r.talent).name)}` : `Model · ${modelDef(r.model).name} ${modelDef(r.model).size}`;
  return r.stageComplete ? `${base} · completes the Chip Stage` : base;
}

export function sideCard(s: GameState): string {
  if (!s.side.length) return '';
  const rows = s.side.map((o) => {
    const left = Math.max(0, TUNING.sideObjectiveRotate - (s.playTime - o.started));
    return `<li title="Swaps for a new one in ${fmtTime(left)}"><div class="side-top"><span>${esc(sideText(o))}</span><em>${o.reward === 'lab' ? '+1 LP' : '×2 60s'}</em></div>
      ${progressBar(o.progress / o.target, 'thin')}</li>`;
  }).join('');
  return `<div class="side"><div class="eyebrow">Side objectives</div><ul class="side-list">${rows}</ul></div>`;
}

export function tipBanner(bn: Bottleneck[]): string {
  const b = bn[0];
  if (!b) return `<div class="tip ok">● All systems balanced. Nice.</div>`;
  return `<div class="tip ${b.severity}"><b>${b.severity === 'red' ? 'BOTTLENECK' : 'SPARE CAPACITY'}</b> ${esc(b.tip)}</div>`;
}

export function sectionTabs(ui: UiState, bn: Bottleneck[]): string {
  return SECTIONS.map((sec) => {
    const red = bn.some((b) => b.severity === 'red' && b.section === sec.id);
    return `<button class="tab ${ui.section === sec.id ? 'active' : ''} ${red ? 'alert' : ''}" data-action="section" data-section="${sec.id}">
      ${sec.name}${red ? '<i class="dot red"></i>' : ''}</button>`;
  }).join('');
}

export function nodeSwitcher(s: GameState, bn: Bottleneck[]): string {
  const chips = NODES.map((n) => {
    const owned = s.nodes.some((x) => x.id === n.id);
    if (owned) {
      const red = bn.some((b) => b.node === n.id && b.severity === 'red');
      return `<button class="node-chip ${n.id} ${s.selectedNode === n.id ? 'active' : ''}" data-action="node" data-node="${n.id}">
        ${n.label}${red ? '<i class="dot red"></i>' : ''}</button>`;
    }
    const f = canFab(s, n.id);
    const prevOwned = NODES.indexOf(n) === 0 || s.nodes.some((x) => x.id === NODES[NODES.indexOf(n) - 1].id);
    if (!prevOwned) return `<button class="node-chip locked" disabled>${n.label} 🔒</button>`;
    return `<button class="node-chip fab ${f.ok ? 'ready' : ''}" data-action="fab" data-node="${n.id}" ${f.ok ? '' : 'disabled'} title="${esc(f.reason)}">
      Fab ${n.label}<small>${f.ok ? fmtMoney(n.unlockCost) : esc(f.reason)}</small></button>`;
  }).join('');
  return `<div class="nodes">${chips}</div>`;
}

export function buyToggle(ui: UiState): string {
  const opt = (v: UiState['buyAmount'], label: string) =>
    `<button class="${ui.buyAmount === v ? 'active' : ''}" data-action="amount" data-amount="${v}">${label}</button>`;
  return `<div class="amount">Buy ${opt(1, '×1')}${opt(10, '×10')}${opt('max', 'Max')}</div>`;
}

function itemValue(s: GameState, item: ItemId, node: NodeId, lvl: number): string {
  const d = nodeDef(node);
  const ns = s.nodes.find((n) => n.id === node);
  const lv = (i: ItemId) => (i === item ? lvl : ns?.levels[i] ?? 0);
  switch (item) {
    case 'scheduler': return lvl ? 'auto' : 'manual';
    case 'cores': return `${1 + lvl}`;
    case 'clock': return `${(d.baseClock + d.clockStep * lvl).toFixed(2)}`;
    case 'memory': return fmtNum(d.memBase * Math.pow(1.15, lvl) * Math.pow(1.06, lv('l3')));
    case 'l3': return `×${Math.pow(1.06, lvl).toFixed(2)}`;
    case 'npu': return `+${lvl * 12}%`;
    case 'heatsink': case 'fan': return fmtNum(d.coolBase * Math.pow(1.15, lv('heatsink')) * Math.pow(1.05, lv('fan')));
    case 'psu': return fmtNum(d.psuBase * Math.pow(1.15, lvl));
    case 'vrm': return `−${(lvl * 1.5).toFixed(1)}%`;
    case 'gating': return `−${lvl * 2}%`;
    case 'intake': return fmtNum(TUNING.intakeBase * Math.pow(TUNING.intakeGrowth, lvl));
    case 'uplink': return fmtNum(TUNING.uplinkBase * Math.pow(TUNING.uplinkGrowth, lvl));
  }
}
const UNIT: Partial<Record<ItemId, string>> = {
  cores: 'cores', clock: 'GHz', memory: 'tok/s', heatsink: 'W cooling', fan: 'W cooling', psu: 'W', intake: 'req/s', uplink: 'tok/s',
  vrm: 'power', gating: 'power', npu: 'compute', l3: 'memory',
};

export function upgradeCards(s: GameState, ui: UiState, bn: Bottleneck[]): string {
  const node = nodeDef(s.selectedNode);
  const items = itemsFor(node, ui.section).filter((i) => !(i.id === 'scheduler' && level(s, 'scheduler') > 0));
  const flagged = (id: ItemId, scope: 'node' | 'rig') => bn.some((b) => {
    if (b.severity !== 'red' || !b.item) return false;
    if (scope === 'node' && b.node !== s.selectedNode) return false;
    if (b.item === id) return true;
    if (b.item === 'heatsink' && id === 'fan') return true;
    if ((b.item === 'cores' || b.item === 'clock') && (id === 'cores' || id === 'clock' || id === 'npu')) return true;
    if (b.item === 'memory' && id === 'l3') return true;
    if (b.item === 'psu' && (id === 'vrm' || id === 'gating')) return true;
    return false;
  });
  const cards = items.map((it) => {
    const nodeId = it.scope === 'node' ? s.selectedNode : undefined;
    const lvl = level(s, it.id, nodeId);
    const max = maxLevelOf(it.id, nodeId ?? s.selectedNode);
    const maxed = lvl >= max;
    let n = 0, cost = 0, cash = s.cash;
    const want = ui.buyAmount === 'max' ? 1000 : ui.buyAmount;
    while (n < want && lvl + n < max) {
      const c = costOf(s, it.id, nodeId, lvl + n);
      if (c > cash && n > 0) break;
      if (c > cash && n === 0) { cost = c; break; }
      cash -= c; cost += c; n++;
    }
    const shownN = Math.max(1, n);
    const afford = n > 0 && cost <= s.cash;
    const red = flagged(it.id, it.scope);
    const cur = itemValue(s, it.id, s.selectedNode, lvl);
    const next = itemValue(s, it.id, s.selectedNode, Math.min(max, lvl + shownN));
    const scope = it.scope === 'node' ? `<span class="scope">${node.label}</span>` : '<span class="scope rig">RIG</span>';
    return `<div class="up-card ${red ? 'red' : ''} ${maxed ? 'maxed' : ''}">
      ${red ? '<div class="flag">BOTTLENECK</div>' : ''}
      <div class="up-head">${scope}<b>${esc(it.name)}</b><span class="up-lv">LV ${lvl}${max < 1000 ? `/${max}` : ''}</span></div>
      <div class="up-val">${maxed ? `<span>${cur}</span>` : `${cur} → <span>${next}</span>`} <small>${UNIT[it.id] ?? ''}</small></div>
      <div class="up-trade">${esc(it.tradeoff)}</div>
      <button class="buy ${afford ? '' : 'poor'}" data-action="buy" data-item="${it.id}" ${maxed || !afford ? 'disabled' : ''}>
        ${maxed ? 'MAXED' : `${shownN > 1 ? `×${shownN} ` : ''}${fmtMoney(cost)}`}</button>
    </div>`;
  }).join('');
  return `<div class="cards">${cards}</div>`;
}

// ---------------------------------------------------------------------------
// Full-screen overlays

export function clientsScreen(s: GameState): string {
  const list = STAGE_1_CLIENTS.map((c, i) => {
    const state = i < s.clientIndex ? 'done' : i === s.clientIndex ? 'active' : 'locked';
    const goals = c.goals.map((g, gi) => {
      const done = i < s.clientIndex || (i === s.clientIndex && gi < s.goalIndex);
      return `<li class="${done ? 'done' : ''}">${done ? '✓' : '○'} ${esc(goalText(g))}</li>`;
    }).join('');
    return `<div class="client-row ${state}">
      <div class="num">${state === 'done' ? '✓' : c.id}</div>
      <div class="body"><h4>${esc(c.name)}</h4>${state === 'active' ? '<span class="pill">SERVING NOW</span>' : state === 'done' ? '<span class="pill done">DONE</span>' : '<span class="pill locked">UP NEXT</span>'}
        ${state === 'active' ? `<p class="blurb">${esc(c.blurb)}</p>` : ''}<p class="quirk" title="${esc(c.blurb)}">${esc(c.quirkText)}</p>
        <ul class="goals-mini">${goals}</ul>
        <div class="reward">Reward: ${rewardText(c)}</div></div></div>`;
  }).join('');
  const future = FUTURE_CLIENTS.map((f) => `<div class="future"><h4>${f.stage}</h4>${f.names.map((n) => `<span class="locked-name">🔒 ${esc(n)}</span>`).join('')}</div>`).join('');
  return `<div class="screen-head"><h2>Clients</h2><p class="muted">One client at a time. Finish all five to complete the Chip Stage.</p></div>
    <div class="client-grid">${list}</div><h3 class="sub">Coming in later stages</h3><div class="future-grid">${future}</div>`;
}

export function labScreen(s: GameState): string {
  const cards = RESEARCH.map((r) => {
    const lvl = s.research[r.id] ?? 0;
    const maxed = lvl >= r.maxLevel;
    const locked = r.requires && !(s.research[r.requires] ?? 0);
    const can = canResearch(s, r.id);
    const pips = Array.from({ length: r.maxLevel }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
    return `<div class="lab-card ${maxed ? 'maxed' : ''} ${locked ? 'locked' : ''}">
      <div class="lab-top"><h4>${esc(r.name)}</h4><span class="lab-lv">${r.maxLevel > 1 ? `LV ${lvl}/${r.maxLevel}` : maxed ? 'DONE' : 'ONE-OFF'}</span></div>
      <p>${esc(r.text)}</p>
      <div class="pips">${pips}</div>
      <button class="buy lab ${can ? '' : 'poor'}" data-action="research" data-research="${r.id}" ${can ? '' : 'disabled'}>
        ${maxed ? 'DONE' : locked ? `Needs ${esc(RESEARCH.find((x) => x.id === r.requires)!.name)}` : `${r.cost(lvl)} LP`}</button></div>`;
  }).join('');
  return `<div class="screen-head"><h2>Lab</h2><p class="muted">Spend Lab Points from client goals and side objectives. Research lasts for this game.</p>
    <div class="lp">${s.lab} Lab Points</div></div><div class="lab-grid">${cards}</div>`;
}

export function teamScreen(s: GameState): string {
  const slots = SECTIONS.map((sec) => {
    const t = s.talentSlots[sec.id];
    return `<div class="slot"><div class="eyebrow">${sec.name}</div>${t
      ? `<div class="avatar">${initials(talentDef(t).name)}</div><div><b>${esc(talentDef(t).name)}</b><small class="green">${esc(talentDef(t).boostText)}</small></div>
         <button class="ghost x" data-action="unassign" data-section="${sec.id}" title="Remove">✕</button>`
      : '<div class="avatar empty">+</div><div><small class="muted">Empty slot</small></div>'}</div>`;
  }).join('');
  const roster = TALENT.map((t) => {
    const owned = s.talentOwned.includes(t.id);
    const placed = Object.values(s.talentSlots).includes(t.id);
    const from = STAGE_1_CLIENTS.find((c) => 'talent' in c.reward && c.reward.talent === t.id);
    return `<div class="talent ${owned ? '' : 'locked'}"><div class="avatar">${owned ? initials(t.name) : '?'}</div>
      <div><b>${owned ? esc(t.name) : 'Locked'}</b><p>${owned ? esc(t.bio) : `Finish ${esc(from?.name ?? 'a client')}`}</p>
      <small class="green">${esc(t.boostText)} · ${SECTIONS.find((x) => x.id === t.section)!.name}</small></div>
      ${owned ? `<button data-action="assign" data-talent="${t.id}" ${placed ? 'disabled' : ''}>${placed ? 'On the rig' : 'Assign'}</button>` : ''}</div>`;
  }).join('');
  const models = MODELS.map((m) => {
    const owned = s.modelsOwned.includes(m.id);
    const running = s.model === m.id;
    return `<div class="model ${owned ? '' : 'locked'} ${running ? 'running' : ''}">
      <div class="model-text"><h4>${m.name} <span>${m.size}</span></h4><p>${owned ? esc(m.blurb) : 'Unlocked by a client'}</p>
      <div class="stats"><span>${m.tokPerReq} tok/req</span><span>pay ×${m.priceMult}</span><span>compute ×${m.computeCost}</span><span>memory ×${m.memCost}</span></div></div>
      ${owned ? `<button data-action="model" data-model="${m.id}" ${running ? 'disabled' : ''}>${running ? 'RUNNING' : 'Run this model'}</button>` : '<button disabled>🔒 Locked</button>'}</div>`;
  }).join('');
  return `<div class="screen-head"><h2>Team &amp; Models</h2><p class="muted">Talent boosts one Section each. Bigger models pay more per request but need more compute and memory.</p></div>
    <h3 class="sub">On the rig</h3><div class="slots">${slots}</div>
    <div class="team-cols"><div><h3 class="sub">Talent</h3><div class="talent-list">${roster}</div></div>
    <div><h3 class="sub">Models</h3><div class="model-list">${models}</div></div></div>`;
}

const initials = (n: string) => n.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).slice(0, 2).join('');

export function startMenu(hasSave: boolean, confirmNew: boolean): string {
  return `<div class="menu-card">
    <div class="menu-chip"><div class="menu-core"></div></div>
    <h1>SILICON BLOOM</h1>
    <p class="tagline">Grow one glowing core into an AI data hall.</p>
    ${confirmNew
      ? `<p class="warn">This replaces your saved game. Start over?</p>
         <button class="primary" data-action="new-confirm">Yes, new game</button><button data-action="new-cancel">Cancel</button>`
      : `<button class="primary" data-action="resume" ${hasSave ? '' : 'disabled'}>Resume game</button>
         <button class="${hasSave ? '' : 'primary'}" data-action="new">New game</button>
         <button data-action="scores">Scoreboard</button>`}
    <p class="fine">Your time only counts while the game is running. It pauses when closed.</p></div>`;
}

export function scoreboard(scores: ScoreEntry[]): string {
  const rows = scores.length
    ? scores.map((e, i) => `<tr><td>${i + 1}</td><td>${fmtTime(e.time)}</td><td>${esc(e.label)}</td><td>${esc(e.date.slice(0, 10))}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">No finished runs yet. Complete the Chip Stage to set a time.</td></tr>';
  return `<div class="menu-card wide"><h2>Scoreboard</h2><p class="muted">Fastest play time. The full game ends at client 25; for now the Chip Stage is timed.</p>
    <table class="scores"><thead><tr><th>#</th><th>Time</th><th>Completed</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table>
    <button data-action="menu-back">Back</button></div>`;
}

export function pausedCard(): string {
  return `<div class="menu-card"><h2>Paused</h2><p class="muted">The clock is stopped.</p>
    <button class="primary" data-action="pause">Resume</button><button data-action="menu">Main menu</button></div>`;
}

export function stageCompleteCard(s: GameState): string {
  return `<div class="menu-card"><div class="eyebrow">Stage complete</div><h2>Chip Stage done in ${fmtTime(s.stageCompleteTime ?? s.playTime)}</h2>
    <p class="muted">Your time is on the scoreboard. The GPU Board, where your chips become GPUs, arrives in the next milestone.</p>
    <button class="primary" data-action="close-modal">Keep tinkering</button><button data-action="menu">Main menu</button></div>`;
}
