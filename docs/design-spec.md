# Silicon Bloom: game design spec

**Status:** draft for sign-off, 2026-11-24
**Working title was:** Idle CPU
**Companion files:** glossary [CONTEXT.md](../CONTEXT.md) · decision log [design-decisions.md](design-decisions.md) · clients, Talent and Models [client-roster.md](client-roster.md)

## 1. The pitch

A calm, neon idle-tycoon game for the web browser. You start with one glowing CPU core answering tiny AI text requests. Every token you serve earns cash. You spend it on upgrades, find whatever is holding the system back, fix it, and watch your setup bloom from a single chip into a screen-filling AI data hall. The game ends when you've served all 25 clients, and your play time goes on the scoreboard.

**Design loop:** Start with one core → process requests → earn cash → find the bottleneck → upgrade it → scale up → serve every client → beat your best time.

**Feel:** relaxing, readable and satisfying. Nothing ever breaks and nothing is ever lost. The challenge is optimising, never punishing.

## 2. Platform and structure

- **Web browser only.** Full-screen, widescreen layout. Mobile is out of scope.
- **Free, forever.** No real money, ads, purchases or premium currency. Prices are in-game pounds sterling (£).
- **Start menu:** New Game · Resume Game · Scoreboard.
- **One Game** runs from a single core to completing client 25. Target length is about 60 to 90 minutes of play for a first game, faster with skill.
- **Timer:** counts play time only. It pauses whenever the game is paused or closed.
- **Scoreboard:** finished Games ranked by play time, stored in the browser.
- **Saving:** autosave to browser storage every few seconds and on tab close. Resume continues exactly where you left off.
- **Pausing:** the game keeps running in a background tab and pauses when the browser or tab is closed. There are no offline earnings, so a long absence can never be used to skip ahead.

## 3. Core simulation

The rig is a pipeline. Every stage of it is a **System** with a capacity, and the smallest capacity sets the pace.

```
Users (Demand) → Intake (Network) → Tokenizer → Compute (cores × clock, memory)
      → Output tokens/s → Billing (£ per token) → Cash
                ↑ Heat (Thermal) and ↑ Power draw (Power) constrain Compute
```

- **Income** = tokens served per second × price per token (× client pay multiplier).
- **Tokens per request** depend on the request type and the running Model.
- **Compute throughput** = cores × clock × efficiency. It's limited by memory bandwidth (tokens/s the memory can feed).
- **Heat:** every core and every GHz produces heat. Cooling removes it. If heat exceeds cooling, temperature rises to the throttle point and clock drops smoothly until heat equals cooling.
- **Power:** components draw watts. If draw exceeds supply capacity, active cores are capped proportionally.
- **Network:** intake bandwidth caps requests in per second. The excess waits in the Queue.
- **Demand:** users per second wanting service at this Stage. Raised by finishing client goals, Reach research in the Lab, and each new Stage.
- **No damage, ever.** Over a limit means throttling or queueing only. Queued requests are never lost.

### Upgrades interact
Each upgrade card states its trade-off ("2.50 → 2.65 GHz, runs hotter"). More clock means more heat and power. More cores means more heat, power and memory demand. A bigger Model means more pay per request but more memory and compute per request. Fixing one bottleneck usually reveals the next one, and that's the game.

### Bottlenecks are loud
- The System currently limiting throughput **flashes red** on the rig, and its gauge pulses.
- The matching Section shows a red dot, and the upgrade card that fixes it gets a red "BOTTLENECK" tag.
- A one-line tip explains why ("Chip at 92°: clock throttled 18%. Upgrade cooling.").
- When capacity exceeds Demand, the Users bar glows **amber** with a tip ("Your rig is faster than your users. Finish client goals or research Reach.").
- Fixing it is always the player's choice.

## 4. Stages

Five Stages, nested. Each completed Stage becomes the first unit of the next, keeps earning, and can still be upgraded. The camera zooms out at each transition. Each Stage introduces one new mechanic and one new request type.

| Stage | Holds | New mechanic | Request type | Key components |
|---|---|---|---|---|
| Chip | cores | heat vs clock | Text | cores, clock, cache/memory, heatsink, small PSU, intake |
| GPU Board | GPU sockets (your chip = GPU 1) | parallel units, memory bandwidth | Image | GPUs, VRAM, case fans, PSU, NIC |
| Server Rack | sleds of boards | interconnect between units | Code | sleds, interconnect, top-of-rack switch, PDU, liquid cooling |
| Server Row | racks | power distribution, airflow layout | Voice | racks, row switch, hot/cold aisles, row power |
| AI Data Hall | rows | energy sources | Video | rows, chillers, substation, solar farm + batteries, fibre uplink |

**Advancing:** finish the Stage's fifth client, then pay a large Cash cost to build the next Stage.

**Process Nodes (Chip generations):** 14nm → 7nm → 5nm → 3nm. Each node is its own chip layout. Newer nodes add component types (for example NPUs from 5nm). They're unlocked during the Chip Stage through client goals and Cash. Every owned node keeps earning, and a switcher lets you view and upgrade any of them. Nodes can never be decommissioned. In later Stages, better nodes mean better GPUs in board sockets.

**Level caps:** each upgrade caps at around level 100, which is that hardware's maximum output with no bottleneck. Older hardware is always profitable, just less so than new hardware.

## 5. Sections (upgrade panel)

Four clickable Sections exist at every Stage: **Compute, Thermal, Power, Network.** Each is one list of the components on the current hardware, and you level them up. New components appear in a Section when a new Process Node, GPU generation or Stage adds them. They aren't bought inside the Section.

Each upgrade card shows: component, level, current → next value, the trade-off line, price, and a red BOTTLENECK tag when relevant. A Section switcher picks which node or unit you're upgrading.

## 6. Clients and Goals

- 25 clients, five per Stage, **one active at a time**. Roster in [client-roster.md](client-roster.md).
- Each client sends one request type with a quirk (bursts, long replies, latency bonuses, minimum Model size…).
- Each client has 3 to 4 **Goals**. Goals pay Cash and Lab Points and raise Demand.
- Finishing a client's last Goal unlocks a reward, alternating between **Talent** and **Model**.
- The fifth client of a Stage unlocks the next Stage. Client 25 ends the game.
- A **Clients screen** shows the path of all clients in this Stage, the current one's quirk, goal progress and an ETA.

## 7. The Lab

- Spend **Lab Points** on research during a Game. Nothing carries over between Games.
- Research lines: **Billing** (higher £ per token), **Reach** (more Demand), **Efficiency** (cooler, less power per token), **Automation** (scheduler, auto-buy), and **Node research** (prerequisite for 7nm, 5nm and 3nm).
- The Lab shows a "NEW" ticker on the rig when research becomes affordable.

## 8. Talent and Models

**Talent** (12 named engineers). Each has one slot per Section and gives a % boost (e.g. +15% cooling). They can be swapped freely. They're unlocked from odd-numbered clients.

**Models** (start with Spark 0.5B, then 12 more up to Cosmos 2T). One runs at a time and can be switched freely. Bigger Models produce more tokens per request at a higher price, but need more memory and compute, so switching up can create a new bottleneck. Some clients require a minimum size. They're unlocked from even-numbered clients.

## 9. Side objectives

These replace daily rewards, keeping the scoreboard fair.
- Three side objectives are always shown. When one completes, a new one rolls in, and one rotates every ~10 minutes of play if untouched.
- They're short and specific: "Level Thermal 5 times", "Serve 100k tokens in 2 minutes", "Keep the queue empty for 60 seconds".
- Rewards are Lab Points or a 60-second ×2 income burst.
- There are no login streaks or welcome-back bonuses, because a scoreboard timer and rewards for time away don't mix.

## 10. Early game

1. A new Game shows one 14nm core and a trickle of glowing text-request packets queuing at the chip.
2. The player **clicks** to process requests and earn their first pounds (client 1, Goal 1).
3. The **first upgrade** (the scheduler) makes processing automatic. From then on there's no clicking to earn, only decisions. Clicks never give bonuses.
4. Within the first few minutes heat appears, then the first red bottleneck. The player learns the loop.

## 11. Screen layout (widescreen)

- **Top bar:** game name/menu, Stage name, income/s, Cash, Lab Points, play timer, side objectives toggle.
- **Centre (most of the screen):** the rig. It starts as one small chip in a large dark space and fills the screen as you grow. Request packets flow in from Users at the bottom, through intake and compute, out to Billing, then to Cash. Gauges sit around it: Clock, Memory, Power, Thermal, Users.
- **Right panel:** current client and goal progress, then Section tabs and upgrade cards.
- **Left rail:** Rig · Clients · Lab · Team & Models (navigation).
- **Bottom ticker:** tips, bottleneck explanations, "NEW" notices.

## 12. Art direction

- Calm neon schematic: a near-black background with fine grid lines, glowing cyan, green, amber and magenta parts, soft bloom, labelled readouts in a technical monospace font.
- Components are drawn so they read as hardware: cores as tile grids, fans spinning at speed proportional to load, radiators, PSUs, racks with sled lights.
- Requests are small glowing packets, and their flow speed and density visibly increase as the rig improves.
- Bottlenecks pulse red. Spare capacity glows amber. Healthy parts glow green or cyan.
- Slow ambient motion everywhere, nothing frantic.
- Reference screenshots set the mood only. Silicon Bloom has its own layout, names and content.

## 13. Technical approach

- **Language:** TypeScript, built with Vite.
- **Rendering:** HTML canvas (2D) for the rig, packets and glow. HTML/CSS for panels and menus.
- **Simulation:** a fixed-step tick (e.g. 10 per second) that's separate from rendering, with deterministic maths, so balancing can be tested without a browser.
- **Data-driven content:** clients, components, nodes, Talent, Models and research defined in data files, so balancing means editing numbers, not code.
- **Saving:** versioned save in browser storage.
- **Repository:** GitHub, and runnable locally with `npm install` then `npm run dev`.

## 14. Build plan

The whole game is built as a prototype to refine, delivered in playable milestones, each a pull request you can run locally:

1. **Foundation and Chip Stage:** start menu, timer, autosave, simulation core, bottleneck system, Chip Stage with 14/7/5/3nm nodes, clients 1 to 5, Lab basics, side objectives.
2. **GPU Board and Server Rack:** nesting and zoom transitions, image and code requests, clients 6 to 15, Talent and Models.
3. **Server Row and AI Data Hall:** voice and video, solar and energy, clients 16 to 25, end screen and scoreboard.
4. **Balance pass:** tune the numbers to hit the target game length.

## 15. Deferred (not in this version)

- **Prestige ("Train the next model"):** an end-game replayability feature for later. The design notes are kept in design-decisions.md round 4.
- Mobile, sound and music, accounts or online leaderboards.
