# Silicon Bloom

A calm neon idle tycoon for the web browser. Start with one glowing CPU core answering tiny AI requests, find whatever is holding your rig back, fix it, and grow it into an AI data hall. Serve all 25 clients as fast as you can.

> Milestone 1: the full **Chip Stage** (14nm, 7nm, 5nm and 3nm chips, clients 1 to 5). GPU Board, Server Rack, Server Row and AI Data Hall come in later milestones.

## Play it locally

You need [Node.js](https://nodejs.org) 20 or newer and [Git](https://git-scm.com).

```bash
git clone https://github.com/spartancode113/silicon-bloom.git
cd silicon-bloom
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

To pick up new changes later: `git pull` then `npm install` then `npm run dev`. To try a branch before it's merged: `git fetch` then `git checkout <branch-name>`.

## How to play

- Click the chip to process your first requests by hand, then buy the **Auto-scheduler** and it runs itself.
- Whatever is limiting your rig **flashes red**, along with the upgrade that fixes it. Amber means you have spare capacity and need more users.
- Upgrades trade off: more clock means more heat and power. Fix one bottleneck and the next one appears.
- Finish client goals for cash, **Lab Points** and new **Talent** or **Models**. Spend Lab Points in the Lab, including research for newer chips.
- Every chip you fab keeps earning. Switch between them to upgrade any of them.
- The play timer only runs while the game is open and unpaused (Esc pauses). Your game autosaves in the browser.

## Developer commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the game with live reload |
| `npm test` | Run the simulation tests |
| `npm run typecheck` | Type-check everything |
| `npm run build` | Production build into `dist/` |
| `npm run balance` | A simulated player plays the Chip Stage and prints how long each client took |

## Where things live

- `src/sim/data.ts`: all game content and numbers (chips, upgrades, clients, models, talent, research). Balancing happens here.
- `src/sim/engine.ts`: the simulation (heat, power, memory, queue, demand, bottlenecks, goals).
- `src/ui/rig.ts`: the neon rig drawn on a canvas.
- `src/ui/panels.ts` and `src/main.ts`: panels, screens, input and the game loop.
- `docs/`: the design spec, decision log and client roster. `CONTEXT.md` is the shared glossary.
