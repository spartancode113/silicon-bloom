# Client roster (draft for review)

25 clients, five per Stage, served one at a time. Each client sends one kind of request, has a quirk that changes how those requests behave, and a short chain of Goals. Finishing a client's last Goal pays a reward: odd-numbered clients give **Talent**, even-numbered clients give a **Model**. The fifth client in each Stage unlocks the next Stage. Client 25 ends the game and stops the clock.

Numbers are placeholders to show the shape; real values come from balancing the prototype. "Pushes" says which Section the client makes you care about.

Request types arrive one per Stage: **Text** (Chip), **Image** (GPU Board), **Code** (Server Rack), **Voice** (Server Row), **Video** (AI Data Hall).

---

## Stage 1: Chip (Text requests)

**1. Nana Byte's Soup Line**
A grandmother's chatbot that only talks about soup. Any other topic and it politely steers back to leek and potato.
Quirk: tiny requests, very patient users. Perfect for learning the loop.
Pushes: Compute
Goals: click through your first 10 requests · buy your first upgrade · serve 200 requests · reach 5 tokens/s
Reward: Talent, **Pip Adeyemi**

**2. Haiku Harbour**
A poets' collective. Every reply must be exactly 17 tokens, no more, no less.
Quirk: fixed-size requests that pay ×1.5 per token, but only if latency stays low.
Pushes: Compute (clock speed)
Goals: serve 500 haikus · reach 2.0 GHz · keep the queue under 5 for 60 seconds
Reward: Model, **Pebble 1B**

**3. Midnight Mixtape**
An AI DJ writing playlist blurbs. Quiet all "day", then a huge rush at midnight.
Quirk: demand arrives in bursts, so intake and queueing matter.
Pushes: Network
Goals: survive 2 midnight rushes with no queue over 50 · level request intake 5 times · serve 2,000 requests
Reward: Talent, **Dot Marchetti**

**4. Sir Reginald's Etiquette Engine**
A butler bot that cannot say anything in fewer than 200 words. "Most gracious user, regarding your query about the weather…"
Quirk: very long replies, so lots of tokens per request and lots of heat.
Pushes: Thermal
Goals: serve 1M tokens · keep the chip under 80° for 2 minutes at full load · unlock the 7nm node
Reward: Model, **Quill 3B**

**5. Goldfish Memory Co.**
A note-taking app that forgets everything and resends the whole conversation every time.
Quirk: huge context per request, so memory becomes the bottleneck. The power draw spikes too.
Pushes: Power and memory
Goals: level memory 10 times · run at 90% of PSU capacity without throttling · unlock the 5nm node · serve 10,000 requests
Reward: Talent, **Big Sal Mwangi**. Unlocks **GPU Board**.

## Stage 2: GPU Board (Image requests)

**6. PawTrait Studio**
Turns blurry pet photos into royal oil paintings. The corgis are wearing crowns.
Quirk: first image client. Heavy compute per request, slow but well paid.
Pushes: Compute (GPU cores)
Goals: install a second GPU · serve 1,000 portraits · reach 50 images/minute
Reward: Model, **Sparrow 7B**

**7. Meme Forge**
Generates memes the instant something trends. Usually about cats, occasionally about your data centre.
Quirk: unpredictable viral spikes of 10× demand for 20 seconds.
Pushes: Network (NIC)
Goals: absorb 5 viral spikes · level the NIC 10 times · serve 20,000 memes
Reward: Talent, **Juniper Okoro**

**8. Captain Caption**
Writes subtitles for every video on a streaming site, live, forever.
Quirk: constant, steady load that never stops, so sustained heat matters more than peak speed.
Pushes: Thermal (case fans)
Goals: hold full load for 5 minutes without throttling · fill all fan slots · serve 5M tokens
Reward: Model, **Lantern 13B**

**9. Doodle Dojo**
A drawing tutor for children. Millions of tiny requests that are mostly "draw a dog".
Quirk: tiny images, enormous user count. Demand is the challenge, not compute.
Pushes: Demand (Reach research)
Goals: reach 500 users/s · research Reach twice · serve 100,000 requests
Reward: Talent, **Professor Wren Halvorsen**

**10. RetroPixel Revival**
Upscales old 8-bit game sprites into glorious HD. Purists are furious.
Quirk: needs **Sparrow 7B or larger**. Upscaling is VRAM-hungry.
Pushes: Compute (VRAM)
Goals: run a 7B+ model · fill all 4 GPU sockets · serve 50,000 upscales
Reward: Model, **Kestrel 22B**. Unlocks **Server Rack**.

## Stage 3: Server Rack (Code requests)

**11. Bugsy & Daughters Debugging**
A family-run code-fixing service. Bugsy writes the bugs, the daughters fix them.
Quirk: first code client. Long contexts, short answers.
Pushes: Compute (sleds)
Goals: install a second sled · serve 100,000 fixes · reach 100k tokens/s
Reward: Talent, **Mags Oyelaran**

**12. Clause & Effect Legal**
Reads 400-page contracts and summarises them in one sentence. The sentence is always "it depends".
Quirk: enormous inputs that have to move between sleds, so the interconnect matters.
Pushes: Network (interconnect)
Goals: level the interconnect 10 times · keep sled links under 90% · serve 50M tokens
Reward: Model, **Harbor 34B**

**13. Spreadsheet Whisperer**
Fixes everyone's broken formulas. Busiest on the last day of every month.
Quirk: month-end surges every 3 minutes.
Pushes: Power (PDU)
Goals: handle 3 month-end surges without power throttling · level the PDU 10 times · serve 500,000 requests
Reward: Talent, **Tomás "Two Fans" Ferreira**

**14. Lunar Logistics**
Plans delivery routes for robot couriers on the Moon. Latency is a big deal, the Moon is far away.
Quirk: pays ×2 only when each request finishes fast.
Pushes: Thermal (liquid cooling, to hold max clock)
Goals: install liquid cooling · keep average latency low for 3 minutes · serve 200M tokens
Reward: Model, **Atlas 70B**

**15. The Infinite Novel**
An author whose fantasy series has no ending. Every request is "continue".
Quirk: needs **Atlas 70B or larger**. Each request produces a staggering number of tokens.
Pushes: everything at once (a full-rack test)
Goals: run a 70B+ model · fill the rack · serve 1B tokens
Reward: Talent, **Ada Kowalczuk-Reyes**. Unlocks **Server Row**.

## Stage 4: Server Row (Voice requests)

**16. Chatterbox Appliances**
Smart toasters, kettles and fridges that all want to talk to you. The fridge has opinions.
Quirk: first voice client. Huge numbers of short, real-time requests.
Pushes: Compute (racks)
Goals: install a second rack · serve 1M voice requests · reach 5,000 users/s
Reward: Model, **Monsoon 120B**

**17. Echo Valley Radio**
A 24/7 AI radio station with a host who never sleeps and never stops telling the same joke.
Quirk: one endless stream that must never stutter.
Pushes: Thermal (hot/cold aisle containment)
Goals: build aisle containment · hold full load for 10 minutes · serve 5B tokens
Reward: Talent, **Kit Nakamura-Lowe**

**18. Calm Line Support**
A customer support hotline whose AI is unnervingly serene. Peak hours are brutal.
Quirk: daily peak cycles, so the row's power budget has to stretch.
Pushes: Power (row power distribution)
Goals: survive 3 peak hours with no power throttling · level row power 15 times · serve 10M calls
Reward: Model, **Zenith 180B**

**19. Polyglot Parrot**
Translates everything into 140 languages, including three that it made up.
Quirk: each request fans out into many parallel jobs across racks.
Pushes: Network (row switch)
Goals: level the row switch 15 times · keep switch load under 90% · serve 20B tokens
Reward: Talent, **Bea "Packet" Lindqvist**

**20. StadiumCast**
Live commentary for every sport on Earth at once, including competitive cheese rolling.
Quirk: needs **Zenith 180B or larger**. Match-day spikes are enormous.
Pushes: everything (a full-row test)
Goals: run a 180B+ model · fill the row · absorb 3 match-day spikes
Reward: Model, **Aurora 400B**. Unlocks **AI Data Hall**.

## Stage 5: AI Data Hall (Video requests)

**21. Dreamreel Pictures**
A film studio that generates movie trailers for films that don't exist yet.
Quirk: first video client. Each request is gigantic.
Pushes: Compute (rows)
Goals: build a second row · serve 1M trailers · reach 1M tokens/s
Reward: Talent, **Imogen Achterberg**

**22. Sunbeam Forecasting**
Weather forecasts for every street on the planet, every minute.
Quirk: its busiest time is daytime, which is exactly when solar power is cheapest.
Pushes: Power (solar farm and batteries)
Goals: build the solar farm · run 50% of the hall on solar · serve 100B tokens
Reward: Model, **Halo 1T**

**23. Museum of Tomorrow**
Interactive holograms of every historical figure, all answering questions at once. Napoleon is very defensive about his height.
Quirk: enormous heat density.
Pushes: Thermal (chillers)
Goals: install 4 chillers · keep the hall under 30° · serve 500B tokens
Reward: Talent, **Dr Femi Castellanos**

**24. Orbital Academy**
A personal tutor for every student on Earth, and soon the Moon.
Quirk: needs **Halo 1T or larger**. Constant, gigantic demand.
Pushes: Network (fibre uplink)
Goals: run a 1T+ model · level the uplink 20 times · reach 1M users/s
Reward: Model, **Cosmos 2T**

**25. Everyone, Everywhere**
The final client: the whole planet, all at once, asking everything.
Quirk: every request type mixed together. Every system has to be balanced.
Pushes: everything
Goals: serve 1T tokens · reach 10M users/s · run Cosmos 2T at full load with no bottleneck for 60 seconds
Reward: **game complete**, the clock stops and your time goes on the scoreboard.

---

## Talent (12)

Each goes in one of the four Section slots for a boost. Swap freely.

| # | Name | Personality | Best in | Boost |
|---|------|-------------|---------|-------|
| 1 | Pip Adeyemi | Eager intern who overclocks everything, including the kettle | Compute | +10% clock |
| 3 | Dot Marchetti | Ex-nightclub promoter, queue whisperer | Network | +15% request intake |
| 5 | Big Sal Mwangi | Gentle giant electrician, names every PSU | Power | −10% power draw |
| 7 | Juniper Okoro | Sysadmin who answers in packet loss statistics | Network | +15% bandwidth |
| 9 | Prof. Wren Halvorsen | Retired teacher, makes users feel welcome | Demand | +20% Demand growth |
| 11 | Mags Oyelaran | Chief engineer, refuses to use a mouse | Compute | +15% cores efficiency |
| 13 | Tomás "Two Fans" Ferreira | Keeps a fan pointed at himself at all times | Thermal | +15% cooling |
| 15 | Ada Kowalczuk-Reyes | Systems architect, sees bottlenecks in her dreams | Any | +8% everything |
| 17 | Kit Nakamura-Lowe | Airflow artist, arranges racks like bonsai | Thermal | +20% cooling |
| 19 | Bea "Packet" Lindqvist | Network engineer, communicates only via ping | Network | +20% switch capacity |
| 21 | Imogen Achterberg | Hardware tinkerer with a soldering iron collection | Compute | +20% compute |
| 23 | Dr Femi Castellanos | Climate scientist turned chiller whisperer | Power | +20% solar output |


## Models (12)

You run one Model at a time and can switch. Bigger models earn more per request but need more memory and compute, so they can create new bottlenecks. Some clients require a minimum size.

| # | Model | Size | Feel |
|---|-------|------|------|
| start | Spark 0.5B | tiny | What you start with. Cheap, cool, low pay. |
| 2 | Pebble 1B | small | A little smarter, barely warmer. |
| 4 | Quill 3B | small | Good writer, pays noticeably more. |
| 6 | Sparrow 7B | medium | First "real" model. Needed by RetroPixel. |
| 8 | Lantern 13B | medium | Long replies, memory hungry. |
| 10 | Kestrel 22B | medium | Fast for its size. |
| 12 | Harbor 34B | large | Big context, loves interconnect bandwidth. |
| 14 | Atlas 70B | large | Needed by The Infinite Novel. |
| 16 | Monsoon 120B | large | Excellent at voice. |
| 18 | Zenith 180B | huge | Needed by StadiumCast. |
| 20 | Aurora 400B | huge | Data Hall class. |
| 22 | Halo 1T | colossal | Needed by Orbital Academy. |
| 24 | Cosmos 2T | colossal | The final model. |
