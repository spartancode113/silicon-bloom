# Silicon Bloom design decisions

Running log of settled design decisions from the design interview. Glossary lives in [../CONTEXT.md](../CONTEXT.md). Style reference: [reference/style-reference-rig-screen.png](../reference/style-reference-rig-screen.png).

## Round 1 (2026-11-24)

1. **Platform**: web browser game only. Mobile is not a consideration; if it ever happens it would be a web wrapper.
2. **Tapping**: lots of manual tapping early, steadily reduced as automation is bought. Play then becomes waiting for cash to buy the next item. Taps never give bonus boosts.
3. **Pacing**: a Cycle (one run to prestige) lasts roughly 30 to 60 minutes, varying with what the player buys.
4. **Bottlenecks**: loud and obvious. The limiting component flashes red and points the player to the upgrade that fixes it. Fixing it is optional; ignoring it costs income (e.g. no cooling upgrade means CPU throttles, tokens drop, income drops).
5. **Limits**: no damage ever. Exceeding a limit throttles only the affected parts; excess requests queue. Progress is always safe.
6. **Requests**: start with simple text generation, add request types gradually, each stressing a different system.
7. **Clients**: each client has individual goals that steer upgrades in a direction. Goals pay revenue and Lab Points; Lab Points buy upgrades and unlocks.
8. **Chip stage**: nested zoom-out between stages. Within the Chip stage, each unlocked Process Node (7nm, 5nm, 3nm...) shows its own chip board with more component types; the player can switch between them. Open to revisiting.
9. **Art**: calm neon, pretty, components clearly drawn. Style reference is a dense, glowing schematic look (see reference image): visible cores, memory, PSU, fans and radiator, request flow lines, labelled readouts.
10. **Monetisation**: not yet answered.

## Round 2 (2026-11-24)

Reference screenshots of a similar game are in `../reference/` (chip, GPU board and rack stages, clients screen, cards screen). They guide the art style and feel only; Idle CPU uses its own layout, names and content.

1. **Layout**: full-screen, widescreen browser layout. Starts mostly empty and fills up as infrastructure grows.
2. **Money**: completely free, never any real-money purchases. All prices are in-game currency shown in pounds sterling (£). No premium/gem currency.
3. **Process Nodes**: every owned node keeps earning. Each upgrade has a level cap (around 100) that represents max output with no bottlenecks. The switcher lets you return to upgrade older nodes, never to decommission them. Older hardware is always profitable, just less so.
4. **Clients**: one active client at a time, so early systems are never overwhelmed. 25 clients, 5 per Stage.
5. **Income**: hardware decides how many users can be served and the token output; users served and token output together decide income.
6. **Demand**: users never run out, but demand can be lower than capacity. Design proposal pending (round 3).
7. **Currencies**: Cash (£), Lab Points, and Parameters (prestige currency).
8. **Upgrade sections**: one long list per section; the same four sections exist at every Stage, and the items within each section level up. Which four is pending (round 3).
9. **Offline**: no offline progress. The game pauses when the browser is closed and keeps running while open in a background tab. (Overrides the original brief's "offline earnings"; confirmation pending.)
10. **Saving**: browser autosave only.

## Round 3 (2026-11-24)

1. **Offline**: confirmed, no offline earnings at all. The game pauses while closed, so a long absence can never hand the player enough cash to skip the game. A small welcome-back bonus is welcome (proposal in round 4).
2. **Upgrade sections**: four clickable sections, Compute, Thermal, Power, Network, at every Stage. Players level up the components already on the hardware. New component types (e.g. NPUs) are not bought in a section: they arrive with a new Process Node or GPU generation and then appear as extra items in the relevant section.
3. **Demand**: accepted. Each Stage has a Demand level (users/s). Client goals and "Reach" research raise it; each Stage raises the baseline. Spare capacity shows the Users bar amber with a tip; excess users queue and the hardware is the red bottleneck.
4. **Stage contents**: accepted (Chip: heat vs clock; GPU Board: parallel units and memory bandwidth; Rack: interconnect; Row: power distribution and airflow; Data Hall: energy sources incl. solar).
5. **Stage transitions**: nested. Finishing a Stage's five clients unlocks the next Stage for a large Cash cost; existing hardware becomes the first unit of the new Stage, keeps earning and stays upgradable to its cap.
6. **Lab**: resets at prestige (overrides the brief's "permanent improvements"). Permanent progress comes from prestige instead.
7. **Cards**: no card system required. Completing big client jobs must unlock something: talent and bigger/better AI models usable for later clients. Design delegated (proposal in round 4).
8. **Prestige**: design delegated (proposal in round 4).
9. **Daily rewards and objectives**: delegated, but outline to stephen before building (round 4).
10. **Shop**: removed.
11. **Early play**: the player clicks to process requests only until the first chip upgrade; after that processing is automatic.

## Round 4 (2026-11-24)

1. **Welcome-back**: "Warm boot" ×2 income for 3 minutes after an absence of 1 hour or more, same size regardless of time away. (Interaction with the scoreboard timer pending, round 5.)
2. **Prestige removed** from this version. It is an end-game replayability feature for later. Instead the game has an end: completing all 25 clients. A start menu offers New Game, Resume Game and Scoreboard; the scoreboard ranks time taken to complete the 25 clients. Parameters and the Training tree are dropped with prestige (design kept in round 4 notes for later).
3. **Talent and Models** replace cards: each client's final goal unlocks one, alternating. One Talent slot per Section; one Model running at a time, bigger models earn more but need more memory/compute; some clients require a minimum model size. Roster drafted in client-roster.md.
4. **Prestige design** (for later): unlock after first Server Rack client, Parameters from tokens served, House Models v2/v3..., keeps Parameters/Training/House Models.
5. **Daily rewards and objectives**: delegated to Claude.
6. **Prototype**: must be genuinely playable. Process Nodes are 14nm, 7nm, 5nm and 3nm. Include the features discussed (exact scope pending, round 5).
7. **Code**: in a GitHub repository, and also runnable locally on stephen's laptop.
8. **Clients**: Claude drafts a creative roster for review (client-roster.md).
9. **Name**: "Idle CPU" is only a working title. Name options pending.

## Round 5 (2026-11-24)

1. **Name**: delegated to Claude. Chosen: **Silicon Bloom** (no existing game found under that name; "Tokenworks" is a crypto project). Repository name: `silicon-bloom`.
2. **Timer**: counts play time only, pausing whenever the game is paused or closed.
3. **Daily rewards and Warm boot**: removed to keep the scoreboard fair. Replaced by rotating in-game side objectives.
4. **Scope**: the whole game as a prototype to refine, built in playable milestones.
5. **Repository**: stephen creates an empty GitHub repo; Claude pushes code; runnable locally via npm.

Full spec: design-spec.md.
