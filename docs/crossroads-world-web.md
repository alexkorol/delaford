# The Crossroads & the Weathering — world redesign

Status: implementing (2026-07-12). Replaces the static Delaford Village +
wilderness-ring world with a trading-hub town and a procedurally generated,
House-charted web of zones.

## The one rule the lore runs on

**Walked ground holds; forsaken ground weathers.**

Every mechanic in this redesign is that sentence applied somewhere:

| Mechanic | Why (in-world) |
|---|---|
| The Crossroads is global and permanent | Everyone still walking the world walks through it daily |
| No combat or death in the Crossroads | Truce-ground: no blade drawn where the roads cross |
| Zones are private to a player/party | A chart is only good for the House that walked the ground |
| Zones persist ~15 minutes after you leave | Ground remembers footsteps for about a quarter hour |
| Zones re-roll after that | The green closes over unwalked ground and the country re-makes itself |
| A map boss gates the next zone | No road holds past a living Warden |
| Daily login gold | The wagon comes in with the dawn market carrying the House's road purse |
| Deposits are permanent, scions die | Gold nailed under the wagon boards goes home; the House outlives the hand that earned it |

## Lore

The world of Verdigris does not keep its shape. Bronze left in the rain grows
a green skin; land left unwalked does the same. They call it the
**Weathering**: fields silt over in a season, forests wander off their maps,
a barrow dug into one hillside surfaces years later out of another. Nobody
agrees on when it began, because the records themselves went strange with
everything else.

There was a kingdom here once — the plough still turns up its milestones and
its church bells. It did not fall to war. Its towns starved standing up,
because the roads between them stopped holding: you cannot keep a town you
cannot feed. The people who lived were the ones already on wheels — carters,
drovers, tinkers, salt merchants — and their descendants are the **Houses**.
Not noble houses; wagon houses. A House's whole estate is its wagon, its
ledger, its charts, and its living names.

The **Crossroads** is where the four great roads still cross true: the **Tin
Road** running north into the old quarry country, the **Salt Road** east
through the fens toward a sea nobody has confirmed in living memory, the
**Chalk Road** south over the downs and their graves, and the **Copper Road**
west into the burnt hills that gave the world its verdigris. Roads hold where
they are walked, and everything that still walks, walks through here — so the
Crossroads holds. Four waymark stones square the market ground. By a custom
older than any living House, it is truce-ground: **no blade drawn where the
roads cross.** The day blood spoils the bazaar is the day the last safe
ground in the world stops being worth walking to.

Each dawn the wagons come in and take their pitches around the waymarks. The
wagon *is* the House: the ledger-chest bolted under the driver's bench, the
iron-bound stores chest the quartermaster issues arms from, the tilt-canvas
stitched with the House mark. When a scion sets out, the House counts a
**road purse** into their hand — coin for the day's walking. Coin sent back
gets nailed under the boards and goes home: a scion's gold can die with them
in a ditch, or it can outlive them in the House ledger.

Past the last waymark the land only holds its shape in the walking of it. A
House **wayfinder** charts the country as its scions walk it — but a chart is
a record of footsteps, and it answers only to the House that laid them.
Strangers reading a stolen chart find fog and a country that has already
moved. Walk together, and the ground learns both your steps: that is why a
party shares one chart.

And every stretch of country out there has its **Warden** — the thing the
weathered land raises up to keep it. Wolves grown wrong, a king the barrow
refused to keep, whatever the fen wants that week. No road holds past a
living Warden. Put it down, and the country behind it lies still long enough
for the chartline to run one stage deeper.

Leave a charted stretch alone past a quarter hour, though, and the green
closes over your footprints. Next time out, the country will have re-made
itself, Warden and all. The Houses do not call this losing ground. They call
it the same harvest growing back.

## World structure

```
                        [ Tin Road — north ]
                     tier 1 → tier 2 → tier 3 → …
                              ↑ (Warden of each zone
                              |  unlocks its children)
[ Copper Road ] ← THE CROSSROADS → [ Salt Road — east ]
   west                |
                        [ Chalk Road — south ]
```

- **Four roads**, one per compass gate out of the Crossroads. Each road is a
  branching chain of **zone nodes**: tier 1 is unlocked from the start; a
  node's children unlock when its Warden dies. Tiers deepen indefinitely
  (nodes are generated lazily), so each road is an effectively endless,
  branching, procedurally named country.
- **Node identity is deterministic per House**: `hash(houseId, road, tier,
  index)` seeds the node's name, art template, layout, branching, and Warden.
  Your House's Salt Road is not my House's Salt Road.
- **Zone instances** are generated with the existing `generateInstance`
  pipeline (template × layout recipes), at `depth = tier` for monster/loot
  scaling. Each fresh instantiation gets a fresh map seed — when the green
  closes over a zone, the next visit is a new layout of the same node.
- **Roads have terroir**: Tin = stone/dungeon country, Salt = marsh/grove
  fen, Chalk = crypt/tomb downs, Copper = volcanic/sand burnt hills. Layouts
  (warren/clearings/gauntlet) mix within a road.

### Zone lifecycle

- Key: `zone:<houseId>:<nodeId>` in `world.zones`.
- Enter via the road gate → **Wayfinder's Chart** pane (that road's charted
  nodes; locked children shown greyed with their Warden note) → travel.
- Entering an already-live zone re-enters the same scene: dead monsters stay
  dead, dropped loot stays down.
- A sweeper marks zones `emptySince` when the last player leaves and destroys
  them after `ZONE_LINGER_MS` (default 15 min). Re-entry clears the timer.
- Party = shared chart: entering moves the whole party (existing party
  plumbing). Only the owner house's scions and their party get in — there is
  no way for strangers to enter your zone.
- In-zone exits: the entry waymark returns to the Crossroads; the **onward
  gate(s)** past the Warden's ground lead to the child node(s) — but no road
  holds past a living Warden (gate refuses while the Warden lives).
- Warden death → `house_world_progress` row, children unlocked, announcement.

### The Crossroads (scene `town:crossroads`)

- Type `town`, `metadata.sanctuary: true` — no damage can land, nothing dies.
- Central plaza with the four waymark stones and the fountain (kept at
  38,115 — the amenity contract), bazaar stalls (general + arms traders, the
  countinghouse tent for personal storage), four road gates N/E/S/W.
- **Wagon ring**: pitches around the plaza. When a House's first scion logs
  in, its wagon (an NPC entity — quartermaster at the House pitch) appears at
  a deterministic pitch; it leaves when the House's last scion does. Scions
  spawn at their House's wagon: logging in *is* the wagon rolling in for the
  day's market.

### The wagon (meta-progress interface)

Pane `wagon`, opened at your own House's wagon:

- **Road purse** — first set-out of the day auto-claims the existing daily
  gold (House hall level scales it), with the wagon-arrival framing.
- **Ledger** — treasury balance; deposit carried gold (moved here from the
  bank pane; the countinghouse keeps item storage only).
- **Stores** — outfitting stock gated by House prestige (renown) and economy
  (forge upgrades): bronze kit always; iron at renown/forge tier 2; steel at
  tier 3. Purchases are paid **from the treasury** — the House outfits its
  scion, the scion doesn't shop.
- **Improvements** — the existing hall/forge/archives upgrades, buyable at
  the wagon instead of only at the login screen.

## Compatibility notes

- Old wilderness ring (Old Wood, Fenmire, graveyard, Barrow Depths, Ember
  Ruins) is removed; stale persisted `sceneId`s already fall back to the
  default town, and login snaps town positions to the House wagon.
- `instance:enterSolo` (Adventure menu protocol) stays for the playtest
  harness; the client menu is replaced by the Wayfinder's Chart.
- `ZONE_LINGER_MS` env var shortens the linger for tests.
