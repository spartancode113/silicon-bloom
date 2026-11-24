# Silicon Bloom

Silicon Bloom (working title was Idle CPU) is a relaxing idle tycoon web game: grow a single CPU core into an AI data center by processing AI requests, finding bottlenecks and upgrading them.

## Language

### Progression

**Stage**:
One of the five scales of infrastructure, in order: Chip, GPU Board, Server Rack, Server Row, AI Data Hall. Each completed stage becomes one piece of the next.
_Avoid_: Level, tier, site

**Process Node**:
A chip generation within the Chip stage: 14nm, 7nm, 5nm, 3nm. Each node is its own chip layout; newer nodes add new component types (e.g. NPUs). Every owned node keeps earning; the player can switch between nodes to upgrade them but never decommission one.
_Avoid_: Chip version, chip level

**Game**:
One playthrough from a single core to completing all 25 clients. It ends when the last client is done; the play time goes on the **Scoreboard**.
_Avoid_: Run, cycle, season

**Scoreboard**:
Ranking of finished Games by time taken to complete all 25 clients.

### Work and money

**Request**:
One unit of AI work sent by users, such as a text-generation prompt. Request types are introduced gradually, each stressing a different system.
_Avoid_: Job (a Job is a client target), task

**Queue**:
Requests waiting because a downstream system is at capacity. Queued requests wait; they are never lost.

**Cash**:
In-game money, shown in pounds sterling (£), earned from tokens served and spent on upgrades. Never bought with real money.


**Lab Points**:
Currency earned by completing client goals, spent in the Lab on research.

**Demand**:
How many users per second want service at the current Stage. Raised by client goals, Reach research and new Stages. Capacity above Demand sits idle (amber); Demand above capacity queues (red bottleneck).

### Clients

**Client**:
A quirky customer with a fixed list of individual goals. Only one client is active at a time; each Stage has five. Completing goals earns cash and Lab Points and nudges the player to upgrade in a particular direction.
_Avoid_: Customer, contract

**Goal**:
One target set by a client (e.g. "process 750 requests", "upgrade cores 5 times").
_Avoid_: Quest, mission, objective

**Users**:
The people sending requests. How many can be served depends on the hardware; users served and token output together set income.

**Tokens**:
The output the hardware generates for each request. Income is earned per token.

**Talent**:
A named engineer unlocked by finishing a client. Placed in one Section's slot for a boost; swappable.
_Avoid_: Crew, card

**Model**:
The AI model the rig is running; one at a time, switchable. Bigger Models earn more per request but need more memory and compute. Some clients require a minimum Model size. Unlocked by finishing clients.
_Avoid_: Card

### Simulation

**System**:
One part of the infrastructure the player upgrades: compute cores, clock speed, memory, cooling, power, network bandwidth. Systems interact (more clock speed means more heat and power draw).

**Section**:
One of the four upgrade groups present at every Stage: Compute, Thermal, Power, Network. Each lists the components on the current hardware, which the player levels up.
_Avoid_: Tab, category

**Bottleneck**:
The system currently limiting throughput. Always flagged loudly (flashing red) on the component and on the upgrade that fixes it. Fixing it is optional.

**Throttling**:
Reduced performance of the affected components when a limit (heat, power, bandwidth) is exceeded. Throttling is the only penalty: nothing is ever damaged or lost.
_Avoid_: Damage, failure, overload

## Relationships

- A **Stage** contains many units of the previous **Stage** (a GPU Board holds Chips).
- The Chip **Stage** has several **Process Nodes**; the player switches between them.
- A **Client** has many **Goals**; completing a **Goal** pays **Cash** and **Lab Points**.
- A **Bottleneck** causes **Throttling** or a growing **Queue**, which lowers income.

## Example dialogue

> **Dev:** "Cooling is maxed out at 83°. Does the chip break?"
> **Designer:** "No. It throttles: clock drops, tokens per second drop, income drops, and Cooling flashes red as the **Bottleneck** until the player upgrades it."

## Flagged ambiguities

- "Job" appears in the style reference as a client target ("Job 1/5"). Resolved: we call these **Goals**, and "Job" is not used.
