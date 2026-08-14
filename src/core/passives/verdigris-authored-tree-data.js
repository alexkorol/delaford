// Generated from Z:/Code/WIZARD/tools/geometric_skilltree/assets/tree-data.js by tools/port-wizard-tree-data.mjs.
// Do not hand-edit; update the WIZARD authored data and rerun the port.
export default {
  "schemaVersion": 1,
  "phase": 4,
  "mainRingDepth": 10,
  "startPoints": {
    "skill": 140
  },
  "metadata": {
    "generatedFrom": "tools/geometric_skilltree/scripts/author-tree.mjs (hand-authored tables)",
    "generatedAt": "2026-07-12",
    "intent": "Phase 4 authored tree: every seat is deliberate data. Zero hash-generated content."
  },
  "patternTuning": {
    "wave": {
      "minLength": 2,
      "minPercent": 10,
      "crestPercent": 20,
      "meridianEndpointPercent": 28,
      "amplitudePercentPerUnit": 12,
      "amplitudeMax": 3
    },
    "flow": {
      "minLength": 3,
      "minPercent": 25,
      "maxPercent": 100,
      "maxLength": 8
    },
    "loops": {
      "maxRadius": 3
    },
    "vesica": {
      "lensShare": 0.5,
      "piscisLensShare": 0.75
    },
    "rods": {
      "minLength": 3,
      "endpointBonus": 4,
      "endpointPercent": 8
    },
    "crossroads": {
      "minDegree": 4,
      "perExtra": 3
    },
    "symmetry": {
      "mirrorAttrsPerPair": 0.8,
      "trineAttrsPerTriple": 2,
      "mandalaAttrsPerSet": 3
    },
    "grandOrbit": {
      "attrsPerRing": 2
    },
    "enclosure": {
      "guardPerNode": 12
    }
  },
  "seats": {
    "0,0": {
      "id": "0,0",
      "q": 0,
      "r": 0,
      "ring": 0,
      "type": "origin",
      "axis": "hybrid",
      "effects": [
        "Starting point. No passive bonus."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "origin",
      "status": "final",
      "notes": "",
      "name": "Origin"
    },
    "-1,1": {
      "id": "-1,1",
      "q": -1,
      "r": 1,
      "ring": 1,
      "type": "small",
      "axis": "str",
      "effects": [
        "+9% increased Attack Damage",
        "Hold the haft like it owes you money."
      ],
      "stat": "attackDamage",
      "amount": 9,
      "tags": [],
      "clusterId": "str-spoke",
      "status": "review",
      "notes": "",
      "name": "Firm Grip"
    },
    "0,1": {
      "id": "0,1",
      "q": 0,
      "r": 1,
      "ring": 1,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+12 to Spirit",
        "Every service starts with a lit taper and a steady voice."
      ],
      "stat": "spirit",
      "amount": 12,
      "tags": [],
      "clusterId": "ritualist-spoke",
      "status": "review",
      "notes": "",
      "name": "First Rite"
    },
    "1,0": {
      "id": "1,0",
      "q": 1,
      "r": 0,
      "ring": 1,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% increased Rite Damage",
        "A clean opening: rites hit harder from the first day."
      ],
      "stat": "spellDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "int-spoke",
      "status": "review",
      "notes": "",
      "name": "First Lesson"
    },
    "1,-1": {
      "id": "1,-1",
      "q": 1,
      "r": -1,
      "ring": 1,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+10% increased Ailment Effect",
        "Small wounds, patiently kept open."
      ],
      "stat": "ailmentEffect",
      "amount": 10,
      "tags": [],
      "clusterId": "nightwork-spoke",
      "status": "review",
      "notes": "",
      "name": "First Cut"
    },
    "0,-1": {
      "id": "0,-1",
      "q": 0,
      "r": -1,
      "ring": 1,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+24 to Evasion",
        "Begin by not being where the blow lands."
      ],
      "stat": "evasion",
      "amount": 24,
      "tags": [],
      "clusterId": "dex-spoke",
      "status": "review",
      "notes": "",
      "name": "Light Step"
    },
    "-1,0": {
      "id": "-1,0",
      "q": -1,
      "r": 0,
      "ring": 1,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+10% increased Projectile Damage",
        "Everything in camp can be thrown once."
      ],
      "stat": "projectileDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "skirmisher-spoke",
      "status": "review",
      "notes": "",
      "name": "First Throw"
    },
    "-2,2": {
      "id": "-2,2",
      "q": -2,
      "r": 2,
      "ring": 2,
      "type": "small",
      "axis": "str",
      "effects": [
        "+18 to Life"
      ],
      "stat": "life",
      "amount": 18,
      "tags": [],
      "clusterId": "str-spoke",
      "status": "review",
      "notes": "",
      "name": "Broad Back"
    },
    "-1,2": {
      "id": "-1,2",
      "q": -1,
      "r": 2,
      "ring": 2,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+14% increased Ailment Effect",
        "Adds 3 Ember Damage to hits",
        "The kiln teaches: keep them burning."
      ],
      "stat": "ailmentEffect",
      "amount": 14,
      "tags": [],
      "clusterId": "kiln-line-named",
      "status": "review",
      "notes": "",
      "name": "Stoked Coals"
    },
    "0,2": {
      "id": "0,2",
      "q": 0,
      "r": 2,
      "ring": 2,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+8% increased Rite Damage"
      ],
      "stat": "spellDamage",
      "amount": 8,
      "tags": [],
      "clusterId": "ritualist-spoke",
      "status": "review",
      "notes": "",
      "name": "Votive Candle"
    },
    "1,1": {
      "id": "1,1",
      "q": 1,
      "r": 1,
      "ring": 2,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+16% increased Companion Damage",
        "+10 to Spirit",
        "Your first companion costs no upkeep (design text)"
      ],
      "stat": "minionDamage",
      "amount": 16,
      "tags": [],
      "clusterId": "procession-named",
      "status": "review",
      "notes": "",
      "name": "Called to Serve"
    },
    "2,0": {
      "id": "2,0",
      "q": 2,
      "r": 0,
      "ring": 2,
      "type": "small",
      "axis": "int",
      "effects": [
        "+12 to Spirit"
      ],
      "stat": "spirit",
      "amount": 12,
      "tags": [],
      "clusterId": "int-spoke",
      "status": "review",
      "notes": "",
      "name": "Copied Notes"
    },
    "2,-1": {
      "id": "2,-1",
      "q": 2,
      "r": -1,
      "ring": 2,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+16% increased Rite Damage",
        "+6% to River Resistance",
        "Numbed enemies take +8% from your rites (design text)"
      ],
      "stat": "spellDamage",
      "amount": 16,
      "tags": [],
      "clusterId": "drowned-study-named",
      "status": "review",
      "notes": "",
      "name": "Cold Reading"
    },
    "2,-2": {
      "id": "2,-2",
      "q": 2,
      "r": -2,
      "ring": 2,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+8% to Gloam Resistance"
      ],
      "stat": "gloam_res",
      "amount": 8,
      "tags": [],
      "clusterId": "nightwork-spoke",
      "status": "review",
      "notes": "",
      "name": "Dark Lantern"
    },
    "1,-2": {
      "id": "1,-2",
      "q": 1,
      "r": -2,
      "ring": 2,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+14% increased Ailment Effect",
        "+30 to Evasion",
        "Your poisons ignore half of Gloam resistance (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 14,
      "tags": [],
      "clusterId": "unlit-road-named",
      "status": "review",
      "notes": "",
      "name": "Dirty Fighting"
    },
    "0,-2": {
      "id": "0,-2",
      "q": 0,
      "r": -2,
      "ring": 2,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+8% increased Evasion"
      ],
      "stat": "evasion_increased",
      "amount": 8,
      "tags": [],
      "clusterId": "dex-spoke",
      "status": "review",
      "notes": "",
      "name": "Practiced Fall"
    },
    "-1,-1": {
      "id": "-1,-1",
      "q": -1,
      "r": -1,
      "ring": 2,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+14% increased Projectile Damage",
        "+30 to Accuracy",
        "Your shots from higher ground Jolt (design text)"
      ],
      "stat": "projectileDamage",
      "amount": 14,
      "tags": [],
      "clusterId": "high-paths-named",
      "status": "review",
      "notes": "",
      "name": "Head for Heights"
    },
    "-2,0": {
      "id": "-2,0",
      "q": -2,
      "r": 0,
      "ring": 2,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+8% increased Projectile Damage"
      ],
      "stat": "projectileDamage",
      "amount": 8,
      "tags": [],
      "clusterId": "skirmisher-spoke",
      "status": "review",
      "notes": "",
      "name": "Belt of Knives"
    },
    "-2,1": {
      "id": "-2,1",
      "q": -2,
      "r": 1,
      "ring": 2,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+16% increased Attack Damage",
        "+8% increased Ailment Effect",
        "Your hits against Bleeding enemies cannot be Blocked (design text)"
      ],
      "stat": "attackDamage",
      "amount": 16,
      "tags": [],
      "clusterId": "red-field-named",
      "status": "review",
      "notes": "",
      "name": "Drawn Blood"
    },
    "-3,3": {
      "id": "-3,3",
      "q": -3,
      "r": 3,
      "ring": 3,
      "type": "mastery",
      "axis": "str",
      "effects": [
        "+14% increased Attack Damage",
        "+25 to Guard",
        "You cannot be pushed back while attacking (design text)",
        "The doctrine is short: advance."
      ],
      "stat": "attackDamage",
      "amount": 14,
      "tags": [],
      "clusterId": "str-spoke",
      "status": "review",
      "notes": "",
      "name": "Iron Doctrine"
    },
    "-2,3": {
      "id": "-2,3",
      "q": -2,
      "r": 3,
      "ring": 3,
      "type": "small",
      "axis": "str",
      "effects": [
        "Adds 3 Ember Damage to hits"
      ],
      "stat": "emberkiss",
      "amount": 3,
      "tags": [],
      "clusterId": "kiln-approach",
      "status": "review",
      "notes": "",
      "name": "Dry Tinder"
    },
    "-1,3": {
      "id": "-1,3",
      "q": -1,
      "r": 3,
      "ring": 3,
      "type": "small",
      "axis": "str",
      "effects": [
        "+8% increased Attack Damage",
        "+4% increased Attack Damage against Scalded enemies (design text)"
      ],
      "stat": "attackDamage",
      "amount": 8,
      "tags": [],
      "clusterId": "kiln-approach",
      "status": "review",
      "notes": "",
      "name": "Warm Bronze"
    },
    "0,3": {
      "id": "0,3",
      "q": 0,
      "r": 3,
      "ring": 3,
      "type": "mastery",
      "axis": "hybrid",
      "effects": [
        "+14% increased Companion Damage",
        "+15 to Spirit",
        "Your banners and standing rites reach 15% further (design text)",
        "The order is old; the war is older."
      ],
      "stat": "minionDamage",
      "amount": 14,
      "tags": [],
      "clusterId": "ritualist-spoke",
      "status": "review",
      "notes": "",
      "name": "Order of Service"
    },
    "1,2": {
      "id": "1,2",
      "q": 1,
      "r": 2,
      "ring": 3,
      "type": "small",
      "axis": "int",
      "effects": [
        "+8% increased Rite Damage"
      ],
      "stat": "spellDamage",
      "amount": 8,
      "tags": [],
      "clusterId": "procession-approach",
      "status": "review",
      "notes": "",
      "name": "Censer Smoke"
    },
    "2,1": {
      "id": "2,1",
      "q": 2,
      "r": 1,
      "ring": 3,
      "type": "small",
      "axis": "int",
      "effects": [
        "+8% increased Companion Damage",
        "Companions near your banner gain +5% speed (design text)"
      ],
      "stat": "minionDamage",
      "amount": 8,
      "tags": [],
      "clusterId": "procession-approach",
      "status": "review",
      "notes": "",
      "name": "Standard Pole"
    },
    "3,0": {
      "id": "3,0",
      "q": 3,
      "r": 0,
      "ring": 3,
      "type": "mastery",
      "axis": "int",
      "effects": [
        "+14% increased Rite Damage",
        "+20 to Ward",
        "Your Ward recharge begins 20% sooner",
        "The school of counting what cannot be touched."
      ],
      "stat": "spellDamage",
      "amount": 14,
      "tags": [],
      "clusterId": "int-spoke",
      "status": "review",
      "notes": "",
      "name": "Blue Arithmetic"
    },
    "3,-1": {
      "id": "3,-1",
      "q": 3,
      "r": -1,
      "ring": 3,
      "type": "small",
      "axis": "int",
      "effects": [
        "+8% increased Rite Damage"
      ],
      "stat": "spellDamage",
      "amount": 8,
      "tags": [],
      "clusterId": "drowned-approach",
      "status": "review",
      "notes": "",
      "name": "Wet Ink"
    },
    "3,-2": {
      "id": "3,-2",
      "q": 3,
      "r": -2,
      "ring": 3,
      "type": "small",
      "axis": "int",
      "effects": [
        "+8% to River Resistance",
        "+6 to Ward while near water in spirit (design text)"
      ],
      "stat": "river_resistance",
      "amount": 8,
      "tags": [],
      "clusterId": "drowned-approach",
      "status": "review",
      "notes": "",
      "name": "River Stone"
    },
    "3,-3": {
      "id": "3,-3",
      "q": 3,
      "r": -3,
      "ring": 3,
      "type": "mastery",
      "axis": "hybrid",
      "effects": [
        "+16% increased Ailment Effect",
        "+1% to Critical Chance",
        "Your marks last 20% longer (design text)",
        "The trade taught after dark, to those who already know a trade."
      ],
      "stat": "ailmentEffect",
      "amount": 16,
      "tags": [],
      "clusterId": "nightwork-spoke",
      "status": "review",
      "notes": "",
      "name": "Second Shadow"
    },
    "2,-3": {
      "id": "2,-3",
      "q": 2,
      "r": -3,
      "ring": 3,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+22 to Evasion"
      ],
      "stat": "evasion",
      "amount": 22,
      "tags": [],
      "clusterId": "unlit-approach",
      "status": "review",
      "notes": "",
      "name": "Muffled Steps"
    },
    "1,-3": {
      "id": "1,-3",
      "q": 1,
      "r": -3,
      "ring": 3,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+1% to Critical Chance",
        "+8% Ailment Effect against unhurt enemies (design text)"
      ],
      "stat": "critChance",
      "amount": 1,
      "tags": [],
      "clusterId": "unlit-approach",
      "status": "review",
      "notes": "",
      "name": "Thin Blade"
    },
    "0,-3": {
      "id": "0,-3",
      "q": 0,
      "r": -3,
      "ring": 3,
      "type": "mastery",
      "axis": "dex",
      "effects": [
        "+14% increased Evasion",
        "+40 to Accuracy",
        "+4% increased Movement Speed",
        "Ground read well is worth more than armour."
      ],
      "stat": "evasion_increased",
      "amount": 14,
      "tags": [],
      "clusterId": "dex-spoke",
      "status": "review",
      "notes": "",
      "name": "Fieldcraft"
    },
    "-1,-2": {
      "id": "-1,-2",
      "q": -1,
      "r": -2,
      "ring": 3,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+8% increased Projectile Damage"
      ],
      "stat": "projectileDamage",
      "amount": 8,
      "tags": [],
      "clusterId": "high-approach",
      "status": "review",
      "notes": "",
      "name": "Sling Practice"
    },
    "-2,-1": {
      "id": "-2,-1",
      "q": -2,
      "r": -1,
      "ring": 3,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+22 to Evasion",
        "+4% Movement Speed on rough ground (design text)"
      ],
      "stat": "evasion",
      "amount": 22,
      "tags": [],
      "clusterId": "high-approach",
      "status": "review",
      "notes": "",
      "name": "Sure Footing"
    },
    "-3,0": {
      "id": "-3,0",
      "q": -3,
      "r": 0,
      "ring": 3,
      "type": "mastery",
      "axis": "hybrid",
      "effects": [
        "+12% increased Projectile Damage",
        "+6% increased Attack Speed",
        "Moving between attacks adds +8% damage to the next one (design text)",
        "The steps are taught to drummers first."
      ],
      "stat": "projectileDamage",
      "amount": 12,
      "tags": [],
      "clusterId": "skirmisher-spoke",
      "status": "review",
      "notes": "",
      "name": "War Dance"
    },
    "-3,1": {
      "id": "-3,1",
      "q": -3,
      "r": 1,
      "ring": 3,
      "type": "small",
      "axis": "str",
      "effects": [
        "+8% increased Attack Damage"
      ],
      "stat": "attackDamage",
      "amount": 8,
      "tags": [],
      "clusterId": "red-approach",
      "status": "review",
      "notes": "",
      "name": "Nicked Bronze"
    },
    "-3,2": {
      "id": "-3,2",
      "q": -3,
      "r": 2,
      "ring": 3,
      "type": "small",
      "axis": "str",
      "effects": [
        "+8% increased Ailment Effect",
        "Bleeds you inflict on moving enemies worsen (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 8,
      "tags": [],
      "clusterId": "red-approach",
      "status": "review",
      "notes": "",
      "name": "Open Vein"
    },
    "-4,4": {
      "id": "-4,4",
      "q": -4,
      "r": 4,
      "ring": 4,
      "type": "small",
      "axis": "str",
      "effects": [
        "+8% increased Physical Damage"
      ],
      "stat": "physical_increased",
      "amount": 8,
      "tags": [],
      "clusterId": "str-spoke",
      "status": "review",
      "notes": "",
      "name": "Scarred Knuckles"
    },
    "-3,4": {
      "id": "-3,4",
      "q": -3,
      "r": 4,
      "ring": 4,
      "type": "small",
      "axis": "str",
      "effects": [
        "+20 to Guard"
      ],
      "stat": "guard",
      "amount": 20,
      "tags": [],
      "clusterId": "kiln-approach",
      "status": "review",
      "notes": "",
      "name": "Charcoal Burner"
    },
    "-2,4": {
      "id": "-2,4",
      "q": -2,
      "r": 4,
      "ring": 4,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+35 to Guard",
        "+10% to Ember Resistance",
        "When a Scald on an enemy expires, gain 15 Guard for four seconds (design text)"
      ],
      "stat": "guard",
      "amount": 35,
      "tags": [],
      "clusterId": "kiln-line-named",
      "status": "review",
      "notes": "",
      "name": "Banked Fire"
    },
    "-1,4": {
      "id": "-1,4",
      "q": -1,
      "r": 4,
      "ring": 4,
      "type": "small",
      "axis": "str",
      "effects": [
        "+8% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 8,
      "tags": [],
      "clusterId": "kiln-approach",
      "status": "review",
      "notes": "",
      "name": "First Spark"
    },
    "0,4": {
      "id": "0,4",
      "q": 0,
      "r": 4,
      "ring": 4,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+10% to Ember Resistance"
      ],
      "stat": "ember_res",
      "amount": 10,
      "tags": [],
      "clusterId": "ritualist-spoke",
      "status": "review",
      "notes": "",
      "name": "Ash Blessing"
    },
    "1,3": {
      "id": "1,3",
      "q": 1,
      "r": 3,
      "ring": 4,
      "type": "small",
      "axis": "int",
      "effects": [
        "+18 to Ward"
      ],
      "stat": "ward",
      "amount": 18,
      "tags": [],
      "clusterId": "procession-approach",
      "status": "review",
      "notes": "",
      "name": "Anointed Brow"
    },
    "2,2": {
      "id": "2,2",
      "q": 2,
      "r": 2,
      "ring": 4,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+35 to Ward",
        "+8% increased Rite Damage",
        "Your Ward also shelters companions at half value (design text)"
      ],
      "stat": "ward",
      "amount": 35,
      "tags": [],
      "clusterId": "procession-named",
      "status": "review",
      "notes": "",
      "name": "Warded Vestments"
    },
    "3,1": {
      "id": "3,1",
      "q": 3,
      "r": 1,
      "ring": 4,
      "type": "small",
      "axis": "int",
      "effects": [
        "+4% increased Rite Speed"
      ],
      "stat": "castSpeed",
      "amount": 4,
      "tags": [],
      "clusterId": "procession-approach",
      "status": "review",
      "notes": "",
      "name": "Hymn Cadence"
    },
    "4,0": {
      "id": "4,0",
      "q": 4,
      "r": 0,
      "ring": 4,
      "type": "small",
      "axis": "int",
      "effects": [
        "+5% increased Rite Speed"
      ],
      "stat": "castSpeed",
      "amount": 5,
      "tags": [],
      "clusterId": "int-spoke",
      "status": "review",
      "notes": "",
      "name": "Steady Hand of the Scribe"
    },
    "4,-1": {
      "id": "4,-1",
      "q": 4,
      "r": -1,
      "ring": 4,
      "type": "small",
      "axis": "int",
      "effects": [
        "+8% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 8,
      "tags": [],
      "clusterId": "drowned-approach",
      "status": "review",
      "notes": "",
      "name": "Shiver Script"
    },
    "4,-2": {
      "id": "4,-2",
      "q": 4,
      "r": -2,
      "ring": 4,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+16% increased Ailment Effect",
        "+10% increased Rite Damage",
        "Numb you inflict slows 10% deeper (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 16,
      "tags": [],
      "clusterId": "drowned-study-named",
      "status": "review",
      "notes": "",
      "name": "Undertow"
    },
    "4,-3": {
      "id": "4,-3",
      "q": 4,
      "r": -3,
      "ring": 4,
      "type": "small",
      "axis": "int",
      "effects": [
        "+18 to Ward"
      ],
      "stat": "ward",
      "amount": 18,
      "tags": [],
      "clusterId": "drowned-approach",
      "status": "review",
      "notes": "",
      "name": "Cold Margin"
    },
    "4,-4": {
      "id": "4,-4",
      "q": 4,
      "r": -4,
      "ring": 4,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+25 to Evasion"
      ],
      "stat": "evasion",
      "amount": 25,
      "tags": [],
      "clusterId": "nightwork-spoke",
      "status": "review",
      "notes": "",
      "name": "Soft Boots"
    },
    "3,-4": {
      "id": "3,-4",
      "q": 3,
      "r": -4,
      "ring": 4,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+8% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 8,
      "tags": [],
      "clusterId": "unlit-approach",
      "status": "review",
      "notes": "",
      "name": "Bitter Paste"
    },
    "2,-4": {
      "id": "2,-4",
      "q": 2,
      "r": -4,
      "ring": 4,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+18% increased Ailment Effect",
        "+1% to Critical Chance",
        "Poison you inflict stacks one deeper (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 18,
      "tags": [],
      "clusterId": "unlit-road-named",
      "status": "review",
      "notes": "",
      "name": "Venom Ledger"
    },
    "1,-4": {
      "id": "1,-4",
      "q": 1,
      "r": -4,
      "ring": 4,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+8% to Gloam Resistance"
      ],
      "stat": "gloam_res",
      "amount": 8,
      "tags": [],
      "clusterId": "unlit-approach",
      "status": "review",
      "notes": "",
      "name": "Gutter Wisdom"
    },
    "0,-4": {
      "id": "0,-4",
      "q": 0,
      "r": -4,
      "ring": 4,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5% increased Attack Speed"
      ],
      "stat": "attackSpeed",
      "amount": 5,
      "tags": [],
      "clusterId": "dex-spoke",
      "status": "review",
      "notes": "",
      "name": "Quick Breath"
    },
    "-1,-3": {
      "id": "-1,-3",
      "q": -1,
      "r": -3,
      "ring": 4,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+4% increased Attack Speed"
      ],
      "stat": "attackSpeed",
      "amount": 4,
      "tags": [],
      "clusterId": "high-approach",
      "status": "review",
      "notes": "",
      "name": "Dry Bowstring"
    },
    "-2,-2": {
      "id": "-2,-2",
      "q": -2,
      "r": -2,
      "ring": 4,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+16% increased Projectile Damage",
        "+8% to Storm Resistance",
        "Jolted enemies take +10% from your projectiles (design text)"
      ],
      "stat": "projectileDamage",
      "amount": 16,
      "tags": [],
      "clusterId": "high-paths-named",
      "status": "review",
      "notes": "",
      "name": "Storm Line"
    },
    "-3,-1": {
      "id": "-3,-1",
      "q": -3,
      "r": -1,
      "ring": 4,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+35 to Accuracy"
      ],
      "stat": "accuracy_flat",
      "amount": 35,
      "tags": [],
      "clusterId": "high-approach",
      "status": "review",
      "notes": "",
      "name": "Wind Reading"
    },
    "-4,0": {
      "id": "-4,0",
      "q": -4,
      "r": 0,
      "ring": 4,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+5% increased Attack Speed"
      ],
      "stat": "attackSpeed",
      "amount": 5,
      "tags": [],
      "clusterId": "skirmisher-spoke",
      "status": "review",
      "notes": "",
      "name": "Loose Shoulders"
    },
    "-4,1": {
      "id": "-4,1",
      "q": -4,
      "r": 1,
      "ring": 4,
      "type": "small",
      "axis": "str",
      "effects": [
        "+20 to Guard"
      ],
      "stat": "guard",
      "amount": 20,
      "tags": [],
      "clusterId": "red-approach",
      "status": "review",
      "notes": "",
      "name": "Braced Stance"
    },
    "-4,2": {
      "id": "-4,2",
      "q": -4,
      "r": 2,
      "ring": 4,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+18% increased Physical Damage",
        "+15 to Life",
        "Your heavy hits break Guard 20% harder (design text)"
      ],
      "stat": "physical_increased",
      "amount": 18,
      "tags": [],
      "clusterId": "red-field-named",
      "status": "review",
      "notes": "",
      "name": "Shield Splitter"
    },
    "-4,3": {
      "id": "-4,3",
      "q": -4,
      "r": 3,
      "ring": 4,
      "type": "small",
      "axis": "str",
      "effects": [
        "+8% increased Attack Damage"
      ],
      "stat": "attackDamage",
      "amount": 8,
      "tags": [],
      "clusterId": "red-approach",
      "status": "review",
      "notes": "",
      "name": "Follow Through"
    },
    "-5,5": {
      "id": "-5,5",
      "q": -5,
      "r": 5,
      "ring": 5,
      "type": "waystone",
      "axis": "str",
      "effects": [
        "+30 to Guard",
        "Loops closed around this Waystone empower their center +25% further",
        "Your Evasion is 10% lower while you hold the line (design text)",
        "Half the column rests here; half never needed to."
      ],
      "stat": "guard",
      "amount": 30,
      "tags": [],
      "clusterId": "str-spoke",
      "status": "review",
      "notes": "",
      "name": "The Iron Milestone",
      "patternHook": {
        "effect": "loop-boost",
        "value": 0.25
      }
    },
    "-4,5": {
      "id": "-4,5",
      "q": -4,
      "r": 5,
      "ring": 5,
      "type": "small",
      "axis": "str",
      "effects": [
        "+10% to Ember Resistance"
      ],
      "stat": "ember_res",
      "amount": 10,
      "tags": [],
      "clusterId": "kiln-waist",
      "status": "review",
      "notes": "",
      "name": "Kiln Watch"
    },
    "-3,5": {
      "id": "-3,5",
      "q": -3,
      "r": 5,
      "ring": 5,
      "type": "socket",
      "axis": "str",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "kiln-line-sockets",
      "status": "review",
      "notes": "",
      "name": "The Kiln Line Socket"
    },
    "-2,5": {
      "id": "-2,5",
      "q": -2,
      "r": 5,
      "ring": 5,
      "type": "small",
      "axis": "str",
      "effects": [
        "+4% increased Attack Speed",
        "Your attack rhythm feeds the fire: +3% Ailment Effect (design text)"
      ],
      "stat": "attackSpeed",
      "amount": 4,
      "tags": [],
      "clusterId": "kiln-waist",
      "status": "review",
      "notes": "",
      "name": "Bellows Rhythm"
    },
    "-1,5": {
      "id": "-1,5",
      "q": -1,
      "r": 5,
      "ring": 5,
      "type": "small",
      "axis": "str",
      "effects": [
        "Adds 5 Ember Damage to hits"
      ],
      "stat": "emberkiss",
      "amount": 5,
      "tags": [],
      "clusterId": "kiln-waist",
      "status": "review",
      "notes": "",
      "name": "Cinder Bed"
    },
    "0,5": {
      "id": "0,5",
      "q": 0,
      "r": 5,
      "ring": 5,
      "type": "waystone",
      "axis": "hybrid",
      "effects": [
        "+20 to Spirit",
        "Enclosures you close around this Waystone guard 50% more",
        "Your rites cost 5% more Spirit (design text)",
        "Offerings pile at its foot. Take nothing."
      ],
      "stat": "spirit",
      "amount": 20,
      "tags": [],
      "clusterId": "ritualist-spoke",
      "status": "review",
      "notes": "",
      "name": "The Votive Milestone",
      "patternHook": {
        "effect": "enclosure-boost",
        "value": 0.5
      }
    },
    "1,4": {
      "id": "1,4",
      "q": 1,
      "r": 4,
      "ring": 5,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10 to Spirit"
      ],
      "stat": "spirit",
      "amount": 10,
      "tags": [],
      "clusterId": "procession-waist",
      "status": "review",
      "notes": "",
      "name": "Waymarker Ribbon"
    },
    "2,3": {
      "id": "2,3",
      "q": 2,
      "r": 3,
      "ring": 5,
      "type": "socket",
      "axis": "int",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "procession-sockets",
      "status": "review",
      "notes": "",
      "name": "The Procession Socket"
    },
    "3,2": {
      "id": "3,2",
      "q": 3,
      "r": 2,
      "ring": 5,
      "type": "small",
      "axis": "int",
      "effects": [
        "+18 to Life",
        "Companions heal when you do, at half value (design text)"
      ],
      "stat": "life",
      "amount": 18,
      "tags": [],
      "clusterId": "procession-waist",
      "status": "review",
      "notes": "",
      "name": "Shared Bread"
    },
    "4,1": {
      "id": "4,1",
      "q": 4,
      "r": 1,
      "ring": 5,
      "type": "small",
      "axis": "int",
      "effects": [
        "+4% increased Rite Speed"
      ],
      "stat": "castSpeed",
      "amount": 4,
      "tags": [],
      "clusterId": "procession-waist",
      "status": "review",
      "notes": "",
      "name": "Chant Rhythm"
    },
    "5,0": {
      "id": "5,0",
      "q": 5,
      "r": 0,
      "ring": 5,
      "type": "waystone",
      "axis": "int",
      "effects": [
        "+30 to Ward",
        "Waves passing through this Waystone count +1 length",
        "Ward recharge is 10% slower",
        "Half the journey up the blue road, marked in lapis."
      ],
      "stat": "ward",
      "amount": 30,
      "tags": [],
      "clusterId": "int-spoke",
      "status": "review",
      "notes": "",
      "name": "The Blue Milestone",
      "patternHook": {
        "effect": "wave-length",
        "value": 1
      }
    },
    "5,-1": {
      "id": "5,-1",
      "q": 5,
      "r": -1,
      "ring": 5,
      "type": "small",
      "axis": "int",
      "effects": [
        "+4% increased Rite Speed"
      ],
      "stat": "castSpeed",
      "amount": 4,
      "tags": [],
      "clusterId": "drowned-waist",
      "status": "review",
      "notes": "",
      "name": "Ford Knowledge"
    },
    "5,-2": {
      "id": "5,-2",
      "q": 5,
      "r": -2,
      "ring": 5,
      "type": "socket",
      "axis": "int",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "drowned-study-sockets",
      "status": "review",
      "notes": "",
      "name": "The Drowned Study Socket"
    },
    "5,-3": {
      "id": "5,-3",
      "q": 5,
      "r": -3,
      "ring": 5,
      "type": "small",
      "axis": "int",
      "effects": [
        "+9% increased Ailment Effect",
        "Your Numb spreads to enemies touching its victim (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 9,
      "tags": [],
      "clusterId": "drowned-waist",
      "status": "review",
      "notes": "",
      "name": "Numb Fingers"
    },
    "5,-4": {
      "id": "5,-4",
      "q": 5,
      "r": -4,
      "ring": 5,
      "type": "small",
      "axis": "int",
      "effects": [
        "+9% increased Rite Damage"
      ],
      "stat": "spellDamage",
      "amount": 9,
      "tags": [],
      "clusterId": "drowned-waist",
      "status": "review",
      "notes": "",
      "name": "Drift Nets"
    },
    "5,-5": {
      "id": "5,-5",
      "q": 5,
      "r": -5,
      "ring": 5,
      "type": "waystone",
      "axis": "hybrid",
      "effects": [
        "+12% increased Ailment Effect",
        "Flows passing through this Waystone count +1 length",
        "You show your position when you strike: +5% damage taken for two seconds (design text)",
        "A marker stone with the lamp long stolen."
      ],
      "stat": "ailmentEffect",
      "amount": 12,
      "tags": [],
      "clusterId": "nightwork-spoke",
      "status": "review",
      "notes": "",
      "name": "The Unlit Milestone",
      "patternHook": {
        "effect": "flow-length",
        "value": 1
      }
    },
    "4,-5": {
      "id": "4,-5",
      "q": 4,
      "r": -5,
      "ring": 5,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+8% increased Evasion"
      ],
      "stat": "evasion_increased",
      "amount": 8,
      "tags": [],
      "clusterId": "unlit-waist",
      "status": "review",
      "notes": "",
      "name": "Wire and Bell"
    },
    "3,-5": {
      "id": "3,-5",
      "q": 3,
      "r": -5,
      "ring": 5,
      "type": "socket",
      "axis": "dex",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "unlit-road-sockets",
      "status": "review",
      "notes": "",
      "name": "The Unlit Road Socket"
    },
    "2,-5": {
      "id": "2,-5",
      "q": 2,
      "r": -5,
      "ring": 5,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+9% increased Ailment Effect",
        "Your vials refill on kill (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 9,
      "tags": [],
      "clusterId": "unlit-waist",
      "status": "review",
      "notes": "",
      "name": "Milked Fangs"
    },
    "1,-5": {
      "id": "1,-5",
      "q": 1,
      "r": -5,
      "ring": 5,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+35 to Accuracy"
      ],
      "stat": "accuracy_flat",
      "amount": 35,
      "tags": [],
      "clusterId": "unlit-waist",
      "status": "review",
      "notes": "",
      "name": "Dark Adapted"
    },
    "0,-5": {
      "id": "0,-5",
      "q": 0,
      "r": -5,
      "ring": 5,
      "type": "waystone",
      "axis": "dex",
      "effects": [
        "+45 to Evasion",
        "Rods ending on this Waystone empower both endpoints twice",
        "You cannot Block while you keep this pace (design text)",
        "Runners touch the stone and do not stop."
      ],
      "stat": "evasion",
      "amount": 45,
      "tags": [],
      "clusterId": "dex-spoke",
      "status": "review",
      "notes": "",
      "name": "The Swift Milestone",
      "patternHook": {
        "effect": "rod-double"
      }
    },
    "-1,-4": {
      "id": "-1,-4",
      "q": -1,
      "r": -4,
      "ring": 5,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+4% increased Movement Speed"
      ],
      "stat": "move",
      "amount": 4,
      "tags": [],
      "clusterId": "high-waist",
      "status": "review",
      "notes": "",
      "name": "Goat Track"
    },
    "-2,-3": {
      "id": "-2,-3",
      "q": -2,
      "r": -3,
      "ring": 5,
      "type": "socket",
      "axis": "dex",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "high-paths-sockets",
      "status": "review",
      "notes": "",
      "name": "The High Paths Socket"
    },
    "-3,-2": {
      "id": "-3,-2",
      "q": -3,
      "r": -2,
      "ring": 5,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+9% increased Ailment Effect",
        "Your Jolts last one second longer (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 9,
      "tags": [],
      "clusterId": "high-waist",
      "status": "review",
      "notes": "",
      "name": "Static Prickle"
    },
    "-4,-1": {
      "id": "-4,-1",
      "q": -4,
      "r": -1,
      "ring": 5,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+9% increased Projectile Damage"
      ],
      "stat": "projectileDamage",
      "amount": 9,
      "tags": [],
      "clusterId": "high-waist",
      "status": "review",
      "notes": "",
      "name": "Long Shot Tables"
    },
    "-5,0": {
      "id": "-5,0",
      "q": -5,
      "r": 0,
      "ring": 5,
      "type": "waystone",
      "axis": "hybrid",
      "effects": [
        "+16% increased Projectile Damage",
        "Waves and flows may both claim conduits touching this Waystone",
        "-10% increased Reach",
        "Soldiers bet knives against the stone. The stone keeps them."
      ],
      "stat": "projectileDamage",
      "amount": 16,
      "tags": [],
      "clusterId": "skirmisher-spoke",
      "status": "review",
      "notes": "",
      "name": "The Thrown Milestone",
      "patternHook": {
        "effect": "shared-claim"
      }
    },
    "-5,1": {
      "id": "-5,1",
      "q": -5,
      "r": 1,
      "ring": 5,
      "type": "small",
      "axis": "str",
      "effects": [
        "+8% increased Physical Damage"
      ],
      "stat": "physical_increased",
      "amount": 8,
      "tags": [],
      "clusterId": "red-waist",
      "status": "review",
      "notes": "",
      "name": "Whetstone Habit"
    },
    "-5,2": {
      "id": "-5,2",
      "q": -5,
      "r": 2,
      "ring": 5,
      "type": "socket",
      "axis": "str",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "red-field-sockets",
      "status": "review",
      "notes": "",
      "name": "The Red Field Socket"
    },
    "-5,3": {
      "id": "-5,3",
      "q": -5,
      "r": 3,
      "ring": 5,
      "type": "small",
      "axis": "str",
      "effects": [
        "+4% increased Attack Speed"
      ],
      "stat": "attackSpeed",
      "amount": 4,
      "tags": [],
      "clusterId": "red-waist",
      "status": "review",
      "notes": "",
      "name": "Corded Forearms"
    },
    "-5,4": {
      "id": "-5,4",
      "q": -5,
      "r": 4,
      "ring": 5,
      "type": "small",
      "axis": "str",
      "effects": [
        "+20 to Life",
        "Bleeding enemies feed your Second Breath (design text)"
      ],
      "stat": "life",
      "amount": 20,
      "tags": [],
      "clusterId": "red-waist",
      "status": "review",
      "notes": "",
      "name": "Taste of Iron"
    },
    "-6,6": {
      "id": "-6,6",
      "q": -6,
      "r": 6,
      "ring": 6,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+24% increased Attack Damage",
        "+20 to Life",
        "Allies behind you take 10% less damage (design text)"
      ],
      "stat": "attackDamage",
      "amount": 24,
      "tags": [],
      "clusterId": "str-spoke",
      "status": "review",
      "notes": "",
      "name": "Oath of the Front Line"
    },
    "-5,6": {
      "id": "-5,6",
      "q": -5,
      "r": 6,
      "ring": 6,
      "type": "small",
      "axis": "str",
      "effects": [
        "+25 to Guard"
      ],
      "stat": "guard",
      "amount": 25,
      "tags": [],
      "clusterId": "kiln-oath",
      "status": "review",
      "notes": "",
      "name": "Fired Clay"
    },
    "-4,6": {
      "id": "-4,6",
      "q": -4,
      "r": 6,
      "ring": 6,
      "type": "small",
      "axis": "str",
      "effects": [
        "+20 to Ward"
      ],
      "stat": "ward",
      "amount": 20,
      "tags": [],
      "clusterId": "kiln-oath",
      "status": "review",
      "notes": "",
      "name": "Glaze Line"
    },
    "-3,6": {
      "id": "-3,6",
      "q": -3,
      "r": 6,
      "ring": 6,
      "type": "keystone",
      "axis": "str",
      "effects": [
        "All of your damage is dealt as Ember",
        "You deal no Physical, River, Storm, or Gloam damage",
        "Scalds you inflict burn 30% hotter (design text)",
        "What the kiln takes, the kiln keeps."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "kiln-line-named",
      "status": "review",
      "notes": "",
      "name": "Oath of Ash"
    },
    "-2,6": {
      "id": "-2,6",
      "q": -2,
      "r": 6,
      "ring": 6,
      "type": "small",
      "axis": "str",
      "effects": [
        "+9% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 9,
      "tags": [],
      "clusterId": "kiln-oath",
      "status": "review",
      "notes": "",
      "name": "Coal Tally"
    },
    "-1,6": {
      "id": "-1,6",
      "q": -1,
      "r": 6,
      "ring": 6,
      "type": "small",
      "axis": "str",
      "effects": [
        "+9% increased Attack Damage",
        "Hits against Scalded enemies gain +6% damage (design text)"
      ],
      "stat": "attackDamage",
      "amount": 9,
      "tags": [],
      "clusterId": "kiln-oath",
      "status": "review",
      "notes": "",
      "name": "Second Stoke"
    },
    "0,6": {
      "id": "0,6",
      "q": 0,
      "r": 6,
      "ring": 6,
      "type": "notable",
      "axis": "hybrid",
      "effects": [
        "+24% increased Companion Damage",
        "+12% increased Rite Damage",
        "Companions within your banner strike 10% faster (design text)"
      ],
      "stat": "minionDamage",
      "amount": 24,
      "tags": [],
      "clusterId": "ritualist-spoke",
      "status": "review",
      "notes": "",
      "name": "Battle Liturgy"
    },
    "1,5": {
      "id": "1,5",
      "q": 1,
      "r": 5,
      "ring": 6,
      "type": "small",
      "axis": "int",
      "effects": [
        "+22 to Ward"
      ],
      "stat": "ward",
      "amount": 22,
      "tags": [],
      "clusterId": "procession-oath",
      "status": "review",
      "notes": "",
      "name": "Oath Beads"
    },
    "2,4": {
      "id": "2,4",
      "q": 2,
      "r": 4,
      "ring": 6,
      "type": "small",
      "axis": "int",
      "effects": [
        "+9% increased Rite Damage"
      ],
      "stat": "spellDamage",
      "amount": 9,
      "tags": [],
      "clusterId": "procession-oath",
      "status": "review",
      "notes": "",
      "name": "Litany Page"
    },
    "3,3": {
      "id": "3,3",
      "q": 3,
      "r": 3,
      "ring": 6,
      "type": "keystone",
      "axis": "int",
      "effects": [
        "Your rites cost Life instead of Spirit",
        "Your Spirit is reserved in full to your banners and standing rites",
        "Blood is the older currency."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "procession-named",
      "status": "review",
      "notes": "",
      "name": "The Tithe"
    },
    "4,2": {
      "id": "4,2",
      "q": 4,
      "r": 2,
      "ring": 6,
      "type": "small",
      "axis": "int",
      "effects": [
        "+9% increased Companion Damage"
      ],
      "stat": "minionDamage",
      "amount": 9,
      "tags": [],
      "clusterId": "procession-oath",
      "status": "review",
      "notes": "",
      "name": "Bearer Training"
    },
    "5,1": {
      "id": "5,1",
      "q": 5,
      "r": 1,
      "ring": 6,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% to Gloam Resistance",
        "Wither cannot cross the circle while you stand still (design text)"
      ],
      "stat": "gloam_res",
      "amount": 10,
      "tags": [],
      "clusterId": "procession-oath",
      "status": "review",
      "notes": "",
      "name": "Salt Circle"
    },
    "6,0": {
      "id": "6,0",
      "q": 6,
      "r": 0,
      "ring": 6,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+26% increased Rite Damage",
        "+15 to Spirit",
        "Rites you repeat within four seconds gain +10% effect (design text)"
      ],
      "stat": "spellDamage",
      "amount": 26,
      "tags": [],
      "clusterId": "int-spoke",
      "status": "review",
      "notes": "",
      "name": "Third Reading"
    },
    "6,-1": {
      "id": "6,-1",
      "q": 6,
      "r": -1,
      "ring": 6,
      "type": "small",
      "axis": "int",
      "effects": [
        "+40 to Accuracy"
      ],
      "stat": "accuracy_flat",
      "amount": 40,
      "tags": [],
      "clusterId": "drowned-oath",
      "status": "review",
      "notes": "",
      "name": "Sounding Line"
    },
    "6,-2": {
      "id": "6,-2",
      "q": 6,
      "r": -2,
      "ring": 6,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% increased Rite Damage"
      ],
      "stat": "spellDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "drowned-oath",
      "status": "review",
      "notes": "",
      "name": "Undercurrent"
    },
    "6,-3": {
      "id": "6,-3",
      "q": 6,
      "r": -3,
      "ring": 6,
      "type": "keystone",
      "axis": "int",
      "effects": [
        "Your hits never deal critical strikes",
        "You deal 35% more damage to Numbed enemies",
        "Advantage is for gamblers. The river always collects."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "drowned-study-named",
      "status": "review",
      "notes": "",
      "name": "Cold Arithmetic"
    },
    "6,-4": {
      "id": "6,-4",
      "q": 6,
      "r": -4,
      "ring": 6,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% to River Resistance"
      ],
      "stat": "river_resistance",
      "amount": 10,
      "tags": [],
      "clusterId": "drowned-oath",
      "status": "review",
      "notes": "",
      "name": "Blue Lips"
    },
    "6,-5": {
      "id": "6,-5",
      "q": 6,
      "r": -5,
      "ring": 6,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% increased Ailment Effect",
        "Marks you write cost no Spirit (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 10,
      "tags": [],
      "clusterId": "drowned-oath",
      "status": "review",
      "notes": "",
      "name": "Reed Pen"
    },
    "6,-6": {
      "id": "6,-6",
      "q": 6,
      "r": -6,
      "ring": 6,
      "type": "notable",
      "axis": "hybrid",
      "effects": [
        "+12% to Gloam Resistance",
        "+18% increased Ailment Effect",
        "Wither you inflict stacks one deeper (design text)"
      ],
      "stat": "gloam_res",
      "amount": 12,
      "tags": [],
      "clusterId": "nightwork-spoke",
      "status": "review",
      "notes": "",
      "name": "Collector of Debts"
    },
    "5,-6": {
      "id": "5,-6",
      "q": 5,
      "r": -6,
      "ring": 6,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+28 to Evasion"
      ],
      "stat": "evasion",
      "amount": 28,
      "tags": [],
      "clusterId": "unlit-oath",
      "status": "review",
      "notes": "",
      "name": "Cellar Route"
    },
    "4,-6": {
      "id": "4,-6",
      "q": 4,
      "r": -6,
      "ring": 6,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+4% increased Attack Speed"
      ],
      "stat": "attackSpeed",
      "amount": 4,
      "tags": [],
      "clusterId": "unlit-oath",
      "status": "review",
      "notes": "",
      "name": "Rasp and File"
    },
    "3,-6": {
      "id": "3,-6",
      "q": 3,
      "r": -6,
      "ring": 6,
      "type": "keystone",
      "axis": "dex",
      "effects": [
        "You deal 40% more damage to enemies that have not hurt you recently",
        "Enemies that have hurt you recently take 15% less from you",
        "The best work is never witnessed twice."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "unlit-road-named",
      "status": "review",
      "notes": "",
      "name": "Quiet Work"
    },
    "2,-6": {
      "id": "2,-6",
      "q": 2,
      "r": -6,
      "ring": 6,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+10% increased Ailment Effect",
        "Poison from this dose slows (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 10,
      "tags": [],
      "clusterId": "unlit-oath",
      "status": "review",
      "notes": "",
      "name": "Black Dose"
    },
    "1,-6": {
      "id": "1,-6",
      "q": 1,
      "r": -6,
      "ring": 6,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+10% to Gloam Resistance"
      ],
      "stat": "gloam_res",
      "amount": 10,
      "tags": [],
      "clusterId": "unlit-oath",
      "status": "review",
      "notes": "",
      "name": "Shrouded Lantern"
    },
    "0,-6": {
      "id": "0,-6",
      "q": 0,
      "r": -6,
      "ring": 6,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+60 to Accuracy",
        "+12% increased Attack Speed",
        "Your first hit on an unhurt enemy always lands (design text)"
      ],
      "stat": "accuracy_flat",
      "amount": 60,
      "tags": [],
      "clusterId": "dex-spoke",
      "status": "review",
      "notes": "",
      "name": "Read the Wind"
    },
    "-1,-5": {
      "id": "-1,-5",
      "q": -1,
      "r": -5,
      "ring": 6,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+28 to Evasion"
      ],
      "stat": "evasion",
      "amount": 28,
      "tags": [],
      "clusterId": "high-oath",
      "status": "review",
      "notes": "",
      "name": "Cliff Nest"
    },
    "-2,-4": {
      "id": "-2,-4",
      "q": -2,
      "r": -4,
      "ring": 6,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+10% to Storm Resistance"
      ],
      "stat": "storm_res",
      "amount": 10,
      "tags": [],
      "clusterId": "high-oath",
      "status": "review",
      "notes": "",
      "name": "Copper Vane"
    },
    "-3,-3": {
      "id": "-3,-3",
      "q": -3,
      "r": -3,
      "ring": 6,
      "type": "keystone",
      "axis": "dex",
      "effects": [
        "Your hits deal up to 40% more damage to distant enemies",
        "Your hits deal 25% less damage to enemies within reach",
        "The mountain teaches patience; the valley pays for it."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "high-paths-named",
      "status": "review",
      "notes": "",
      "name": "The Long Arc"
    },
    "-4,-2": {
      "id": "-4,-2",
      "q": -4,
      "r": -2,
      "ring": 6,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+10% increased Projectile Damage",
        "Your shots recover on kill (design text)"
      ],
      "stat": "projectileDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "high-oath",
      "status": "review",
      "notes": "",
      "name": "Second Quiver"
    },
    "-5,-1": {
      "id": "-5,-1",
      "q": -5,
      "r": -1,
      "ring": 6,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+4% increased Attack Speed"
      ],
      "stat": "attackSpeed",
      "amount": 4,
      "tags": [],
      "clusterId": "high-oath",
      "status": "review",
      "notes": "",
      "name": "Downdraft Timing"
    },
    "-6,0": {
      "id": "-6,0",
      "q": -6,
      "r": 0,
      "ring": 6,
      "type": "notable",
      "axis": "hybrid",
      "effects": [
        "+24% increased Projectile Damage",
        "+5% increased Movement Speed",
        "Thrown hits while moving gain +10% damage (design text)"
      ],
      "stat": "projectileDamage",
      "amount": 24,
      "tags": [],
      "clusterId": "skirmisher-spoke",
      "status": "review",
      "notes": "",
      "name": "Running Volley"
    },
    "-6,1": {
      "id": "-6,1",
      "q": -6,
      "r": 1,
      "ring": 6,
      "type": "small",
      "axis": "str",
      "effects": [
        "+9% increased Attack Damage"
      ],
      "stat": "attackDamage",
      "amount": 9,
      "tags": [],
      "clusterId": "red-oath",
      "status": "review",
      "notes": "",
      "name": "Broken Teeth"
    },
    "-6,2": {
      "id": "-6,2",
      "q": -6,
      "r": 2,
      "ring": 6,
      "type": "small",
      "axis": "str",
      "effects": [
        "+25 to Guard"
      ],
      "stat": "guard",
      "amount": 25,
      "tags": [],
      "clusterId": "red-oath",
      "status": "review",
      "notes": "",
      "name": "Shield Wall Scars"
    },
    "-6,3": {
      "id": "-6,3",
      "q": -6,
      "r": 3,
      "ring": 6,
      "type": "keystone",
      "axis": "str",
      "effects": [
        "Your hits cannot be evaded",
        "You never deal critical strikes",
        "A straight line, swung hard, wins wars."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "red-field-named",
      "status": "review",
      "notes": "",
      "name": "No Flourish"
    },
    "-6,4": {
      "id": "-6,4",
      "q": -6,
      "r": 4,
      "ring": 6,
      "type": "small",
      "axis": "str",
      "effects": [
        "+10% increased Ailment Effect",
        "Your Bleeds stack on Bleeding enemies (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 10,
      "tags": [],
      "clusterId": "red-oath",
      "status": "review",
      "notes": "",
      "name": "Red Work"
    },
    "-6,5": {
      "id": "-6,5",
      "q": -6,
      "r": 5,
      "ring": 6,
      "type": "small",
      "axis": "str",
      "effects": [
        "Adds 4 Physical Damage to hits"
      ],
      "stat": "heavy",
      "amount": 4,
      "tags": [],
      "clusterId": "red-oath",
      "status": "review",
      "notes": "",
      "name": "Heavy Footfall"
    },
    "-7,7": {
      "id": "-7,7",
      "q": -7,
      "r": 7,
      "ring": 7,
      "type": "class",
      "axis": "str",
      "effects": [
        "+12% increased Attack Damage",
        "Unlocks: tower shields become usable",
        "Unlocks: 2x2 War-call seat",
        "The first calling marks your class; every calling milestone grants its armoury unlock."
      ],
      "stat": "attackDamage",
      "amount": 12,
      "tags": [],
      "clusterId": "str-spoke",
      "status": "review",
      "notes": "",
      "name": "Champion"
    },
    "-6,7": {
      "id": "-6,7",
      "q": -6,
      "r": 7,
      "ring": 7,
      "type": "small",
      "axis": "str",
      "effects": [
        "+9% increased Guard"
      ],
      "stat": "guard_increased",
      "amount": 9,
      "tags": [],
      "clusterId": "kiln-high",
      "status": "review",
      "notes": "",
      "name": "Kiln Door"
    },
    "-5,7": {
      "id": "-5,7",
      "q": -5,
      "r": 7,
      "ring": 7,
      "type": "small",
      "axis": "str",
      "effects": [
        "+4% increased Attack Speed"
      ],
      "stat": "attackSpeed",
      "amount": 4,
      "tags": [],
      "clusterId": "kiln-high",
      "status": "review",
      "notes": "",
      "name": "Furnace Shift"
    },
    "-4,7": {
      "id": "-4,7",
      "q": -4,
      "r": 7,
      "ring": 7,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+20% increased Ailment Effect",
        "Adds 5 Ember Damage to hits",
        "Scalds you inflict last twice as long (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 20,
      "tags": [],
      "clusterId": "kiln-line-named",
      "status": "review",
      "notes": "",
      "name": "Long Firing"
    },
    "-3,7": {
      "id": "-3,7",
      "q": -3,
      "r": 7,
      "ring": 7,
      "type": "small",
      "axis": "str",
      "effects": [
        "+20 to Life"
      ],
      "stat": "life",
      "amount": 20,
      "tags": [],
      "clusterId": "kiln-high",
      "status": "review",
      "notes": "",
      "name": "Slag Heap"
    },
    "-2,7": {
      "id": "-2,7",
      "q": -2,
      "r": 7,
      "ring": 7,
      "type": "small",
      "axis": "str",
      "effects": [
        "Adds 6 Ember Damage to hits",
        "Your hits shed light; the unlit cannot hide from you (design text)"
      ],
      "stat": "emberkiss",
      "amount": 6,
      "tags": [],
      "clusterId": "kiln-high",
      "status": "review",
      "notes": "",
      "name": "Red Glow"
    },
    "-1,7": {
      "id": "-1,7",
      "q": -1,
      "r": 7,
      "ring": 7,
      "type": "small",
      "axis": "str",
      "effects": [
        "+12% to Ember Resistance"
      ],
      "stat": "ember_res",
      "amount": 12,
      "tags": [],
      "clusterId": "kiln-high",
      "status": "review",
      "notes": "",
      "name": "Quench Trough"
    },
    "0,7": {
      "id": "0,7",
      "q": 0,
      "r": 7,
      "ring": 7,
      "type": "class",
      "axis": "hybrid",
      "effects": [
        "+12% increased Companion Damage",
        "Unlocks: banners become usable",
        "Unlocks: one martial companion-of-war",
        "Unlocks: 4x4 Reliquary",
        "The first calling marks your class; every calling milestone grants its armoury unlock."
      ],
      "stat": "minionDamage",
      "amount": 12,
      "tags": [],
      "clusterId": "ritualist-spoke",
      "status": "review",
      "notes": "",
      "name": "Ritualist"
    },
    "1,6": {
      "id": "1,6",
      "q": 1,
      "r": 6,
      "ring": 7,
      "type": "small",
      "axis": "int",
      "effects": [
        "+8% increased Ward"
      ],
      "stat": "ward_pct",
      "amount": 8,
      "tags": [],
      "clusterId": "procession-high",
      "status": "review",
      "notes": "",
      "name": "Long Watch"
    },
    "2,5": {
      "id": "2,5",
      "q": 2,
      "r": 5,
      "ring": 7,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% increased Companion Damage"
      ],
      "stat": "minionDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "procession-high",
      "status": "review",
      "notes": "",
      "name": "Drummer Boy"
    },
    "3,4": {
      "id": "3,4",
      "q": 3,
      "r": 4,
      "ring": 7,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+22% increased Companion Damage",
        "+20 to Ward",
        "Companions within your banner cannot be Withered (design text)"
      ],
      "stat": "minionDamage",
      "amount": 22,
      "tags": [],
      "clusterId": "procession-named",
      "status": "review",
      "notes": "",
      "name": "Processional Guard"
    },
    "4,3": {
      "id": "4,3",
      "q": 4,
      "r": 3,
      "ring": 7,
      "type": "small",
      "axis": "int",
      "effects": [
        "+4% increased Rite Speed"
      ],
      "stat": "castSpeed",
      "amount": 4,
      "tags": [],
      "clusterId": "procession-high",
      "status": "review",
      "notes": "",
      "name": "Relay of Torches"
    },
    "5,2": {
      "id": "5,2",
      "q": 5,
      "r": 2,
      "ring": 7,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% to Ember Resistance"
      ],
      "stat": "ember_res",
      "amount": 10,
      "tags": [],
      "clusterId": "procession-high",
      "status": "review",
      "notes": "",
      "name": "Sacred Ash"
    },
    "6,1": {
      "id": "6,1",
      "q": 6,
      "r": 1,
      "ring": 7,
      "type": "small",
      "axis": "int",
      "effects": [
        "+12 to Spirit",
        "Your rites are not interrupted by light hits (design text)"
      ],
      "stat": "spirit",
      "amount": 12,
      "tags": [],
      "clusterId": "procession-high",
      "status": "review",
      "notes": "",
      "name": "Column Discipline"
    },
    "7,0": {
      "id": "7,0",
      "q": 7,
      "r": 0,
      "ring": 7,
      "type": "class",
      "axis": "int",
      "effects": [
        "+15% increased Rite Damage",
        "Unlocks: a second curio slot",
        "Unlocks: rite-foci gain +1 socket",
        "Unlocks: 2x2 Attendant focus seat",
        "The first calling marks your class; every calling milestone grants its armoury unlock."
      ],
      "stat": "spellDamage",
      "amount": 15,
      "tags": [],
      "clusterId": "int-spoke",
      "status": "review",
      "notes": "",
      "name": "Archmage"
    },
    "7,-1": {
      "id": "7,-1",
      "q": 7,
      "r": -1,
      "ring": 7,
      "type": "small",
      "axis": "int",
      "effects": [
        "+24 to Ward"
      ],
      "stat": "ward",
      "amount": 24,
      "tags": [],
      "clusterId": "drowned-high",
      "status": "review",
      "notes": "",
      "name": "Flooded Stacks"
    },
    "7,-2": {
      "id": "7,-2",
      "q": 7,
      "r": -2,
      "ring": 7,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% increased Rite Damage"
      ],
      "stat": "spellDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "drowned-high",
      "status": "review",
      "notes": "",
      "name": "Cold Catalogue"
    },
    "7,-3": {
      "id": "7,-3",
      "q": 7,
      "r": -3,
      "ring": 7,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+24% increased Rite Damage",
        "+15% increased Ailment Effect",
        "Your marks persist on enemies that leave your sight (design text)"
      ],
      "stat": "spellDamage",
      "amount": 24,
      "tags": [],
      "clusterId": "drowned-study-named",
      "status": "review",
      "notes": "",
      "name": "Drowned Archive"
    },
    "7,-4": {
      "id": "7,-4",
      "q": 7,
      "r": -4,
      "ring": 7,
      "type": "small",
      "axis": "int",
      "effects": [
        "+1% to Critical Chance",
        "Advantage against Numbed enemies is doubled (design text)"
      ],
      "stat": "critChance",
      "amount": 1,
      "tags": [],
      "clusterId": "drowned-high",
      "status": "review",
      "notes": "",
      "name": "Ice Lens"
    },
    "7,-5": {
      "id": "7,-5",
      "q": 7,
      "r": -5,
      "ring": 7,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 10,
      "tags": [],
      "clusterId": "drowned-high",
      "status": "review",
      "notes": "",
      "name": "Slow Water"
    },
    "7,-6": {
      "id": "7,-6",
      "q": 7,
      "r": -6,
      "ring": 7,
      "type": "small",
      "axis": "int",
      "effects": [
        "+12% to River Resistance"
      ],
      "stat": "river_resistance",
      "amount": 12,
      "tags": [],
      "clusterId": "drowned-high",
      "status": "review",
      "notes": "",
      "name": "Depth Marks"
    },
    "7,-7": {
      "id": "7,-7",
      "q": 7,
      "r": -7,
      "ring": 7,
      "type": "class",
      "axis": "hybrid",
      "effects": [
        "+12% increased Ailment Effect",
        "Unlocks: trap and mark tools become equippable",
        "Unlocks: venom vial slot",
        "Unlocks: 4x4 Preparation Case",
        "The first calling marks your class; every calling milestone grants its armoury unlock."
      ],
      "stat": "ailmentEffect",
      "amount": 12,
      "tags": [],
      "clusterId": "nightwork-spoke",
      "status": "review",
      "notes": "",
      "name": "Nightblade"
    },
    "6,-7": {
      "id": "6,-7",
      "q": 6,
      "r": -7,
      "ring": 7,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+9% increased Evasion"
      ],
      "stat": "evasion_increased",
      "amount": 9,
      "tags": [],
      "clusterId": "unlit-high",
      "status": "review",
      "notes": "",
      "name": "Rooftop Line"
    },
    "5,-7": {
      "id": "5,-7",
      "q": 5,
      "r": -7,
      "ring": 7,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+12% to Gloam Resistance"
      ],
      "stat": "gloam_res",
      "amount": 12,
      "tags": [],
      "clusterId": "unlit-high",
      "status": "review",
      "notes": "",
      "name": "Grave Dust"
    },
    "4,-7": {
      "id": "4,-7",
      "q": 4,
      "r": -7,
      "ring": 7,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+22% increased Ailment Effect",
        "+8% increased Attack Speed",
        "Your traps arm instantly (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 22,
      "tags": [],
      "clusterId": "unlit-road-named",
      "status": "review",
      "notes": "",
      "name": "Tools of the Trade"
    },
    "3,-7": {
      "id": "3,-7",
      "q": 3,
      "r": -7,
      "ring": 7,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+10% increased Ailment Effect",
        "Your second poison on a target is 25% stronger (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 10,
      "tags": [],
      "clusterId": "unlit-high",
      "status": "review",
      "notes": "",
      "name": "Twice-Dipped"
    },
    "2,-7": {
      "id": "2,-7",
      "q": 2,
      "r": -7,
      "ring": 7,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+1% to Critical Chance"
      ],
      "stat": "critChance",
      "amount": 1,
      "tags": [],
      "clusterId": "unlit-high",
      "status": "review",
      "notes": "",
      "name": "Silent Count"
    },
    "1,-7": {
      "id": "1,-7",
      "q": 1,
      "r": -7,
      "ring": 7,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5% increased Attack Speed"
      ],
      "stat": "attackSpeed",
      "amount": 5,
      "tags": [],
      "clusterId": "unlit-high",
      "status": "review",
      "notes": "",
      "name": "Pick and Tension"
    },
    "0,-7": {
      "id": "0,-7",
      "q": 0,
      "r": -7,
      "ring": 7,
      "type": "class",
      "axis": "dex",
      "effects": [
        "+12% increased Evasion",
        "Unlocks: a second weapon set for swapping",
        "Unlocks: dual-wielding one-handers",
        "Unlocks: 2x2 Quick Rig seat",
        "The first calling marks your class; every calling milestone grants its armoury unlock."
      ],
      "stat": "evasion_increased",
      "amount": 12,
      "tags": [],
      "clusterId": "dex-spoke",
      "status": "review",
      "notes": "",
      "name": "Acrobat"
    },
    "-1,-6": {
      "id": "-1,-6",
      "q": -1,
      "r": -6,
      "ring": 7,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+10% increased Projectile Damage"
      ],
      "stat": "projectileDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "high-high",
      "status": "review",
      "notes": "",
      "name": "Pass Warden"
    },
    "-2,-5": {
      "id": "-2,-5",
      "q": -2,
      "r": -5,
      "ring": 7,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+12% to Storm Resistance"
      ],
      "stat": "storm_res",
      "amount": 12,
      "tags": [],
      "clusterId": "high-high",
      "status": "review",
      "notes": "",
      "name": "Hail Shrug"
    },
    "-3,-4": {
      "id": "-3,-4",
      "q": -3,
      "r": -4,
      "ring": 7,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+8% increased Movement Speed",
        "+18% increased Projectile Damage",
        "Moving downhill, your shots pierce (design text)"
      ],
      "stat": "move",
      "amount": 8,
      "tags": [],
      "clusterId": "high-paths-named",
      "status": "review",
      "notes": "",
      "name": "Ridge Runner"
    },
    "-4,-3": {
      "id": "-4,-3",
      "q": -4,
      "r": -3,
      "ring": 7,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5% increased Movement Speed",
        "Sprinting charges your next shot with Storm (design text)"
      ],
      "stat": "move",
      "amount": 5,
      "tags": [],
      "clusterId": "high-high",
      "status": "review",
      "notes": "",
      "name": "Skyline Sprint"
    },
    "-5,-2": {
      "id": "-5,-2",
      "q": -5,
      "r": -2,
      "ring": 7,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+45 to Accuracy"
      ],
      "stat": "accuracy_flat",
      "amount": 45,
      "tags": [],
      "clusterId": "high-high",
      "status": "review",
      "notes": "",
      "name": "Far Eye"
    },
    "-6,-1": {
      "id": "-6,-1",
      "q": -6,
      "r": -1,
      "ring": 7,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+9% increased Evasion"
      ],
      "stat": "evasion_increased",
      "amount": 9,
      "tags": [],
      "clusterId": "high-high",
      "status": "review",
      "notes": "",
      "name": "Light Pack"
    },
    "-7,0": {
      "id": "-7,0",
      "q": -7,
      "r": 0,
      "ring": 7,
      "type": "class",
      "axis": "hybrid",
      "effects": [
        "+12% increased Projectile Damage",
        "Unlocks: thrown weapons count as melee AND projectile",
        "Unlocks: belt fetish slot",
        "Unlocks: 4x4 Spoils Roll",
        "The first calling marks your class; every calling milestone grants its armoury unlock."
      ],
      "stat": "projectileDamage",
      "amount": 12,
      "tags": [],
      "clusterId": "skirmisher-spoke",
      "status": "review",
      "notes": "",
      "name": "Reaver"
    },
    "-7,1": {
      "id": "-7,1",
      "q": -7,
      "r": 1,
      "ring": 7,
      "type": "small",
      "axis": "str",
      "effects": [
        "+5% increased Attack Speed"
      ],
      "stat": "attackSpeed",
      "amount": 5,
      "tags": [],
      "clusterId": "red-high",
      "status": "review",
      "notes": "",
      "name": "Drummed Advance"
    },
    "-7,2": {
      "id": "-7,2",
      "q": -7,
      "r": 2,
      "ring": 7,
      "type": "small",
      "axis": "str",
      "effects": [
        "+8% increased Reach"
      ],
      "stat": "reach_increased",
      "amount": 8,
      "tags": [],
      "clusterId": "red-high",
      "status": "review",
      "notes": "",
      "name": "Pike Discipline"
    },
    "-7,3": {
      "id": "-7,3",
      "q": -7,
      "r": 3,
      "ring": 7,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+24% increased Attack Damage",
        "+10% increased Ailment Effect",
        "Kills against Bleeding enemies heal you 15 Life (design text)"
      ],
      "stat": "attackDamage",
      "amount": 24,
      "tags": [],
      "clusterId": "red-field-named",
      "status": "review",
      "notes": "",
      "name": "Red Harvest"
    },
    "-7,4": {
      "id": "-7,4",
      "q": -7,
      "r": 4,
      "ring": 7,
      "type": "small",
      "axis": "str",
      "effects": [
        "+9% increased Guard"
      ],
      "stat": "guard_increased",
      "amount": 9,
      "tags": [],
      "clusterId": "red-high",
      "status": "review",
      "notes": "",
      "name": "Muddy Ground"
    },
    "-7,5": {
      "id": "-7,5",
      "q": -7,
      "r": 5,
      "ring": 7,
      "type": "small",
      "axis": "str",
      "effects": [
        "+10% increased Attack Damage",
        "Each Bleeding enemy adds +2% Attack Damage (design text)"
      ],
      "stat": "attackDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "red-high",
      "status": "review",
      "notes": "",
      "name": "Crimson Tally"
    },
    "-7,6": {
      "id": "-7,6",
      "q": -7,
      "r": 6,
      "ring": 7,
      "type": "small",
      "axis": "str",
      "effects": [
        "+10% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 10,
      "tags": [],
      "clusterId": "red-high",
      "status": "review",
      "notes": "",
      "name": "Butcher Economy"
    },
    "-8,8": {
      "id": "-8,8",
      "q": -8,
      "r": 8,
      "ring": 8,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+20% increased Guard",
        "+15% increased Attack Damage",
        "While you have not moved recently, +15% Poise (design text)"
      ],
      "stat": "guard_increased",
      "amount": 20,
      "tags": [],
      "clusterId": "str-spoke",
      "status": "review",
      "notes": "",
      "name": "The Standing Order"
    },
    "-7,8": {
      "id": "-7,8",
      "q": -7,
      "r": 8,
      "ring": 8,
      "type": "small",
      "axis": "str",
      "effects": [
        "+11% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 11,
      "tags": [],
      "clusterId": "kiln-sign",
      "status": "review",
      "notes": "",
      "name": "Overfire"
    },
    "-6,8": {
      "id": "-6,8",
      "q": -6,
      "r": 8,
      "ring": 8,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+15% to Ember Resistance",
        "+18% increased Ailment Effect",
        "Enemies that survive your Scald take +20% Ember from you (design text)"
      ],
      "stat": "ember_res",
      "amount": 15,
      "tags": [],
      "clusterId": "kiln-line-named",
      "status": "review",
      "notes": "",
      "name": "Patience of the Kiln"
    },
    "-5,8": {
      "id": "-5,8",
      "q": -5,
      "r": 8,
      "ring": 8,
      "type": "small",
      "axis": "str",
      "effects": [
        "+30 to Guard"
      ],
      "stat": "guard",
      "amount": 30,
      "tags": [],
      "clusterId": "kiln-sign",
      "status": "review",
      "notes": "",
      "name": "Kilnstone Rings"
    },
    "-4,8": {
      "id": "-4,8",
      "q": -4,
      "r": 8,
      "ring": 8,
      "type": "sign",
      "axis": "str",
      "effects": [
        "Born under the Kiln: your Scalds never expire on enemies below half Life",
        "You take 20% increased River damage",
        "Only one Sign may mark a life."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "kiln-line-named",
      "status": "review",
      "notes": "",
      "name": "Sign of the Kiln"
    },
    "-3,8": {
      "id": "-3,8",
      "q": -3,
      "r": 8,
      "ring": 8,
      "type": "small",
      "axis": "str",
      "effects": [
        "+10% increased Rite Damage",
        "Your rites char what they touch: +4% Ailment Effect (design text)"
      ],
      "stat": "spellDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "kiln-sign",
      "status": "review",
      "notes": "",
      "name": "Ash Ink"
    },
    "-2,8": {
      "id": "-2,8",
      "q": -2,
      "r": 8,
      "ring": 8,
      "type": "small",
      "axis": "str",
      "effects": [
        "Adds 6 Ember Damage to hits"
      ],
      "stat": "emberkiss",
      "amount": 6,
      "tags": [],
      "clusterId": "kiln-sign",
      "status": "review",
      "notes": "",
      "name": "Ember Tithe"
    },
    "-1,8": {
      "id": "-1,8",
      "q": -1,
      "r": 8,
      "ring": 8,
      "type": "small",
      "axis": "str",
      "effects": [
        "+10% increased Attack Damage"
      ],
      "stat": "attackDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "kiln-sign",
      "status": "review",
      "notes": "",
      "name": "Firing Order"
    },
    "0,8": {
      "id": "0,8",
      "q": 0,
      "r": 8,
      "ring": 8,
      "type": "notable",
      "axis": "hybrid",
      "effects": [
        "+20% increased Companion Damage",
        "+20 to Ward",
        "Your companion shares your resistances (design text)"
      ],
      "stat": "minionDamage",
      "amount": 20,
      "tags": [],
      "clusterId": "ritualist-spoke",
      "status": "review",
      "notes": "",
      "name": "Keeper of the Column"
    },
    "1,7": {
      "id": "1,7",
      "q": 1,
      "r": 7,
      "ring": 8,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% increased Rite Damage"
      ],
      "stat": "spellDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "procession-sign",
      "status": "review",
      "notes": "",
      "name": "Night Office"
    },
    "2,6": {
      "id": "2,6",
      "q": 2,
      "r": 6,
      "ring": 8,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+20% increased Ward",
        "+10 to Spirit",
        "Your Ward does not break from Gloam while a rite is maintained (design text)"
      ],
      "stat": "ward_pct",
      "amount": 20,
      "tags": [],
      "clusterId": "procession-named",
      "status": "review",
      "notes": "",
      "name": "Vigil Unbroken"
    },
    "3,5": {
      "id": "3,5",
      "q": 3,
      "r": 5,
      "ring": 8,
      "type": "small",
      "axis": "int",
      "effects": [
        "+25 to Ward"
      ],
      "stat": "ward",
      "amount": 25,
      "tags": [],
      "clusterId": "procession-sign",
      "status": "review",
      "notes": "",
      "name": "Lantern Oil"
    },
    "4,4": {
      "id": "4,4",
      "q": 4,
      "r": 4,
      "ring": 8,
      "type": "sign",
      "axis": "int",
      "effects": [
        "Born under the Lantern: your Ward recharges even while you take damage",
        "Your Ward is 30% smaller",
        "Only one Sign may mark a life."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "procession-named",
      "status": "review",
      "notes": "",
      "name": "Sign of the Lantern"
    },
    "5,3": {
      "id": "5,3",
      "q": 5,
      "r": 3,
      "ring": 8,
      "type": "small",
      "axis": "int",
      "effects": [
        "+12 to Spirit"
      ],
      "stat": "spirit",
      "amount": 12,
      "tags": [],
      "clusterId": "procession-sign",
      "status": "review",
      "notes": "",
      "name": "Keeper Keys"
    },
    "6,2": {
      "id": "6,2",
      "q": 6,
      "r": 2,
      "ring": 8,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% increased Companion Damage",
        "Your companion taunts when you raise a banner (design text)"
      ],
      "stat": "minionDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "procession-sign",
      "status": "review",
      "notes": "",
      "name": "Vested Authority"
    },
    "7,1": {
      "id": "7,1",
      "q": 7,
      "r": 1,
      "ring": 8,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% to Gloam Resistance"
      ],
      "stat": "gloam_res",
      "amount": 10,
      "tags": [],
      "clusterId": "procession-sign",
      "status": "review",
      "notes": "",
      "name": "Incense Coils"
    },
    "8,0": {
      "id": "8,0",
      "q": 8,
      "r": 0,
      "ring": 8,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+18% increased Ward",
        "+12% increased Rite Damage",
        "You keep 10% of Ward when a hit would empty it (design text)"
      ],
      "stat": "ward_pct",
      "amount": 18,
      "tags": [],
      "clusterId": "int-spoke",
      "status": "review",
      "notes": "",
      "name": "Unwritten Chapter"
    },
    "8,-1": {
      "id": "8,-1",
      "q": 8,
      "r": -1,
      "ring": 8,
      "type": "small",
      "axis": "int",
      "effects": [
        "+11% increased Rite Damage"
      ],
      "stat": "spellDamage",
      "amount": 11,
      "tags": [],
      "clusterId": "drowned-sign",
      "status": "review",
      "notes": "",
      "name": "Silt Ledger"
    },
    "8,-2": {
      "id": "8,-2",
      "q": 8,
      "r": -2,
      "ring": 8,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+12% to River Resistance",
        "+18% increased Rite Damage",
        "Frozen enemies shatter for River damage around them (design text)"
      ],
      "stat": "river_resistance",
      "amount": 12,
      "tags": [],
      "clusterId": "drowned-study-named",
      "status": "review",
      "notes": "",
      "name": "Silt and Silver"
    },
    "8,-3": {
      "id": "8,-3",
      "q": 8,
      "r": -3,
      "ring": 8,
      "type": "small",
      "axis": "int",
      "effects": [
        "+11% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 11,
      "tags": [],
      "clusterId": "drowned-sign",
      "status": "review",
      "notes": "",
      "name": "Frozen Margin"
    },
    "8,-4": {
      "id": "8,-4",
      "q": 8,
      "r": -4,
      "ring": 8,
      "type": "sign",
      "axis": "int",
      "effects": [
        "Born under the River: enemies you Numb are also Marked",
        "Your Scalds expire twice as fast",
        "Only one Sign may mark a life."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "drowned-study-named",
      "status": "review",
      "notes": "",
      "name": "Sign of the River"
    },
    "8,-5": {
      "id": "8,-5",
      "q": 8,
      "r": -5,
      "ring": 8,
      "type": "small",
      "axis": "int",
      "effects": [
        "+26 to Ward",
        "Enemies that cross toward you are slowed (design text)"
      ],
      "stat": "ward",
      "amount": 26,
      "tags": [],
      "clusterId": "drowned-sign",
      "status": "review",
      "notes": "",
      "name": "The Weir"
    },
    "8,-6": {
      "id": "8,-6",
      "q": 8,
      "r": -6,
      "ring": 8,
      "type": "small",
      "axis": "int",
      "effects": [
        "+5% increased Rite Speed"
      ],
      "stat": "castSpeed",
      "amount": 5,
      "tags": [],
      "clusterId": "drowned-sign",
      "status": "review",
      "notes": "",
      "name": "Pale Reflection"
    },
    "8,-7": {
      "id": "8,-7",
      "q": 8,
      "r": -7,
      "ring": 8,
      "type": "small",
      "axis": "int",
      "effects": [
        "+12% to River Resistance"
      ],
      "stat": "river_resistance",
      "amount": 12,
      "tags": [],
      "clusterId": "drowned-sign",
      "status": "review",
      "notes": "",
      "name": "Winter Ledgers"
    },
    "8,-8": {
      "id": "8,-8",
      "q": 8,
      "r": -8,
      "ring": 8,
      "type": "notable",
      "axis": "hybrid",
      "effects": [
        "+20% increased Ailment Effect",
        "+1.5% to Critical Chance",
        "Poisons you inflict on marked enemies deal 15% more (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 20,
      "tags": [],
      "clusterId": "nightwork-spoke",
      "status": "review",
      "notes": "",
      "name": "Ledger of Grudges"
    },
    "7,-8": {
      "id": "7,-8",
      "q": 7,
      "r": -8,
      "ring": 8,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+11% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 11,
      "tags": [],
      "clusterId": "unlit-sign",
      "status": "review",
      "notes": "",
      "name": "Adder Pit"
    },
    "6,-8": {
      "id": "6,-8",
      "q": 6,
      "r": -8,
      "ring": 8,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+2% to Critical Chance",
        "+15% increased Ailment Effect",
        "Your first strike from hiding always poisons (design text)"
      ],
      "stat": "critChance",
      "amount": 2,
      "tags": [],
      "clusterId": "unlit-road-named",
      "status": "review",
      "notes": "",
      "name": "The Second Knife"
    },
    "5,-8": {
      "id": "5,-8",
      "q": 5,
      "r": -8,
      "ring": 8,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+32 to Evasion"
      ],
      "stat": "evasion",
      "amount": 32,
      "tags": [],
      "clusterId": "unlit-sign",
      "status": "review",
      "notes": "",
      "name": "False Papers"
    },
    "4,-8": {
      "id": "4,-8",
      "q": 4,
      "r": -8,
      "ring": 8,
      "type": "sign",
      "axis": "dex",
      "effects": [
        "Born under the Adder: your poisons spread on kill",
        "You cannot Block",
        "Only one Sign may mark a life."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "unlit-road-named",
      "status": "review",
      "notes": "",
      "name": "Sign of the Adder"
    },
    "3,-8": {
      "id": "3,-8",
      "q": 3,
      "r": -8,
      "ring": 8,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+12% to Gloam Resistance"
      ],
      "stat": "gloam_res",
      "amount": 12,
      "tags": [],
      "clusterId": "unlit-sign",
      "status": "review",
      "notes": "",
      "name": "Cold Trail"
    },
    "2,-8": {
      "id": "2,-8",
      "q": 2,
      "r": -8,
      "ring": 8,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+4 to all Attributes",
        "Goods you find are worth 10% more (design text)"
      ],
      "stat": "attrs",
      "amount": 4,
      "tags": [],
      "clusterId": "unlit-sign",
      "status": "review",
      "notes": "",
      "name": "The Fence"
    },
    "1,-8": {
      "id": "1,-8",
      "q": 1,
      "r": -8,
      "ring": 8,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+1% to Critical Chance"
      ],
      "stat": "critChance",
      "amount": 1,
      "tags": [],
      "clusterId": "unlit-sign",
      "status": "review",
      "notes": "",
      "name": "Knife Oath"
    },
    "0,-8": {
      "id": "0,-8",
      "q": 0,
      "r": -8,
      "ring": 8,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+22% increased Evasion",
        "+5% increased Movement Speed",
        "Evading a hit hastens your next action by 10% (design text)"
      ],
      "stat": "evasion_increased",
      "amount": 22,
      "tags": [],
      "clusterId": "dex-spoke",
      "status": "review",
      "notes": "",
      "name": "Between Raindrops"
    },
    "-1,-7": {
      "id": "-1,-7",
      "q": -1,
      "r": -7,
      "ring": 8,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+11% increased Projectile Damage"
      ],
      "stat": "projectileDamage",
      "amount": 11,
      "tags": [],
      "clusterId": "high-sign",
      "status": "review",
      "notes": "",
      "name": "Storm Shelf"
    },
    "-2,-6": {
      "id": "-2,-6",
      "q": -2,
      "r": -6,
      "ring": 8,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+12% to Storm Resistance",
        "+18% increased Projectile Damage",
        "Your Jolts chain once to the nearest enemy (design text)"
      ],
      "stat": "storm_res",
      "amount": 12,
      "tags": [],
      "clusterId": "high-paths-named",
      "status": "review",
      "notes": "",
      "name": "Thunder Counting"
    },
    "-3,-5": {
      "id": "-3,-5",
      "q": -3,
      "r": -5,
      "ring": 8,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+11% increased Ailment Effect",
        "Once per fight, your Jolt becomes a strike (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 11,
      "tags": [],
      "clusterId": "high-sign",
      "status": "review",
      "notes": "",
      "name": "Lightning Bottle"
    },
    "-4,-4": {
      "id": "-4,-4",
      "q": -4,
      "r": -4,
      "ring": 8,
      "type": "sign",
      "axis": "dex",
      "effects": [
        "Born under the Storm: your Jolts stack twice as high",
        "You are always the tallest thing on the field: +15% damage taken from Storm",
        "Only one Sign may mark a life."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "high-paths-named",
      "status": "review",
      "notes": "",
      "name": "Sign of the Storm"
    },
    "-5,-3": {
      "id": "-5,-3",
      "q": -5,
      "r": -3,
      "ring": 8,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+50 to Accuracy"
      ],
      "stat": "accuracy_flat",
      "amount": 50,
      "tags": [],
      "clusterId": "high-sign",
      "status": "review",
      "notes": "",
      "name": "Anemometer Habit"
    },
    "-6,-2": {
      "id": "-6,-2",
      "q": -6,
      "r": -2,
      "ring": 8,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+32 to Evasion"
      ],
      "stat": "evasion",
      "amount": 32,
      "tags": [],
      "clusterId": "high-sign",
      "status": "review",
      "notes": "",
      "name": "High Camp"
    },
    "-7,-1": {
      "id": "-7,-1",
      "q": -7,
      "r": -1,
      "ring": 8,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+12% to Storm Resistance"
      ],
      "stat": "storm_res",
      "amount": 12,
      "tags": [],
      "clusterId": "high-sign",
      "status": "review",
      "notes": "",
      "name": "Peak Silence"
    },
    "-8,0": {
      "id": "-8,0",
      "q": -8,
      "r": 0,
      "ring": 8,
      "type": "notable",
      "axis": "hybrid",
      "effects": [
        "+12% increased Attack Speed",
        "+15% increased Projectile Damage",
        "Your throws return to hand on kill (design text)"
      ],
      "stat": "attackSpeed",
      "amount": 12,
      "tags": [],
      "clusterId": "skirmisher-spoke",
      "status": "review",
      "notes": "",
      "name": "Storm of Handles"
    },
    "-8,1": {
      "id": "-8,1",
      "q": -8,
      "r": 1,
      "ring": 8,
      "type": "small",
      "axis": "str",
      "effects": [
        "+28 to Life"
      ],
      "stat": "life",
      "amount": 28,
      "tags": [],
      "clusterId": "red-sign",
      "status": "review",
      "notes": "",
      "name": "Bull Pens"
    },
    "-8,2": {
      "id": "-8,2",
      "q": -8,
      "r": 2,
      "ring": 8,
      "type": "notable",
      "axis": "str",
      "effects": [
        "Adds 8 Physical Damage to hits",
        "+15% increased Attack Damage",
        "Your stuns last 25% longer (design text)"
      ],
      "stat": "heavy",
      "amount": 8,
      "tags": [],
      "clusterId": "red-field-named",
      "status": "review",
      "notes": "",
      "name": "The Weight Behind It"
    },
    "-8,3": {
      "id": "-8,3",
      "q": -8,
      "r": 3,
      "ring": 8,
      "type": "small",
      "axis": "str",
      "effects": [
        "+11% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 11,
      "tags": [],
      "clusterId": "red-sign",
      "status": "review",
      "notes": "",
      "name": "Gore Furrow"
    },
    "-8,4": {
      "id": "-8,4",
      "q": -8,
      "r": 4,
      "ring": 8,
      "type": "sign",
      "axis": "str",
      "effects": [
        "Born under the Bull: your actions cannot be interrupted while your Poise holds",
        "You cannot dodge or give ground",
        "Only one Sign may mark a life."
      ],
      "stat": null,
      "amount": 0,
      "tags": [],
      "clusterId": "red-field-named",
      "status": "review",
      "notes": "",
      "name": "Sign of the Bull"
    },
    "-8,5": {
      "id": "-8,5",
      "q": -8,
      "r": 5,
      "ring": 8,
      "type": "small",
      "axis": "str",
      "effects": [
        "+10% increased Attack Damage",
        "Enemies you stun are trampled for extra Physical (design text)"
      ],
      "stat": "attackDamage",
      "amount": 10,
      "tags": [],
      "clusterId": "red-sign",
      "status": "review",
      "notes": "",
      "name": "Trampled Line"
    },
    "-8,6": {
      "id": "-8,6",
      "q": -8,
      "r": 6,
      "ring": 8,
      "type": "small",
      "axis": "str",
      "effects": [
        "+30 to Guard"
      ],
      "stat": "guard",
      "amount": 30,
      "tags": [],
      "clusterId": "red-sign",
      "status": "review",
      "notes": "",
      "name": "Horn Scar"
    },
    "-8,7": {
      "id": "-8,7",
      "q": -8,
      "r": 7,
      "ring": 8,
      "type": "small",
      "axis": "str",
      "effects": [
        "+10% increased Physical Damage"
      ],
      "stat": "physical_increased",
      "amount": 10,
      "tags": [],
      "clusterId": "red-sign",
      "status": "review",
      "notes": "",
      "name": "Red Clay Underfoot"
    },
    "-9,9": {
      "id": "-9,9",
      "q": -9,
      "r": 9,
      "ring": 9,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+40 to Life",
        "+18% increased Attack Damage",
        "Second Breath begins 25% sooner (design text)"
      ],
      "stat": "life",
      "amount": 40,
      "tags": [],
      "clusterId": "str-spoke",
      "status": "review",
      "notes": "",
      "name": "Last Out of the Breach"
    },
    "-8,9": {
      "id": "-8,9",
      "q": -8,
      "r": 9,
      "ring": 9,
      "type": "small",
      "axis": "str",
      "effects": [
        "+11% increased Guard"
      ],
      "stat": "guard_increased",
      "amount": 11,
      "tags": [],
      "clusterId": "kiln-deep",
      "status": "review",
      "notes": "",
      "name": "Deep Kiln"
    },
    "-7,9": {
      "id": "-7,9",
      "q": -7,
      "r": 9,
      "ring": 9,
      "type": "notable",
      "axis": "str",
      "effects": [
        "Adds 10 Ember Damage to hits",
        "+15% increased Attack Speed while any enemy is Scalded (design text)",
        "The hottest fire makes no smoke."
      ],
      "stat": "emberkiss",
      "amount": 10,
      "tags": [],
      "clusterId": "kiln-line-named",
      "status": "review",
      "notes": "",
      "name": "White Heat"
    },
    "-6,9": {
      "id": "-6,9",
      "q": -6,
      "r": 9,
      "ring": 9,
      "type": "small",
      "axis": "str",
      "effects": [
        "+12% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 12,
      "tags": [],
      "clusterId": "kiln-deep",
      "status": "review",
      "notes": "",
      "name": "Salted Flame"
    },
    "-5,9": {
      "id": "-5,9",
      "q": -5,
      "r": 9,
      "ring": 9,
      "type": "small",
      "axis": "str",
      "effects": [
        "+14% to Ember Resistance",
        "You cannot be Scalded while at full Life (design text)"
      ],
      "stat": "ember_res",
      "amount": 14,
      "tags": [],
      "clusterId": "kiln-deep",
      "status": "review",
      "notes": "",
      "name": "Old Burn Scars"
    },
    "-4,9": {
      "id": "-4,9",
      "q": -4,
      "r": 9,
      "ring": 9,
      "type": "socket",
      "axis": "str",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "kiln-line-sockets",
      "status": "review",
      "notes": "",
      "name": "The Kiln Line Deep Socket"
    },
    "-3,9": {
      "id": "-3,9",
      "q": -3,
      "r": 9,
      "ring": 9,
      "type": "small",
      "axis": "str",
      "effects": [
        "+25 to Life"
      ],
      "stat": "life",
      "amount": 25,
      "tags": [],
      "clusterId": "kiln-deep",
      "status": "review",
      "notes": "",
      "name": "Clay Sweat"
    },
    "-2,9": {
      "id": "-2,9",
      "q": -2,
      "r": 9,
      "ring": 9,
      "type": "small",
      "axis": "str",
      "effects": [
        "Adds 6 Ember Damage to hits"
      ],
      "stat": "emberkiss",
      "amount": 6,
      "tags": [],
      "clusterId": "kiln-deep",
      "status": "review",
      "notes": "",
      "name": "Charmaster Habit"
    },
    "-1,9": {
      "id": "-1,9",
      "q": -1,
      "r": 9,
      "ring": 9,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+5% increased Attack Speed"
      ],
      "stat": "attackSpeed",
      "amount": 5,
      "tags": [],
      "clusterId": "kiln-deep",
      "status": "review",
      "notes": "",
      "name": "Roaring Draft"
    },
    "0,9": {
      "id": "0,9",
      "q": 0,
      "r": 9,
      "ring": 9,
      "type": "notable",
      "axis": "hybrid",
      "effects": [
        "+26% increased Rite Damage",
        "+20 to Spirit",
        "Rites you maintain persist 3 seconds after you fall (design text)"
      ],
      "stat": "spellDamage",
      "amount": 26,
      "tags": [],
      "clusterId": "ritualist-spoke",
      "status": "review",
      "notes": "",
      "name": "The Long Procession"
    },
    "1,8": {
      "id": "1,8",
      "q": 1,
      "r": 8,
      "ring": 9,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+10% increased Ward"
      ],
      "stat": "ward_pct",
      "amount": 10,
      "tags": [],
      "clusterId": "procession-deep",
      "status": "review",
      "notes": "",
      "name": "Deep Sanctum"
    },
    "2,7": {
      "id": "2,7",
      "q": 2,
      "r": 7,
      "ring": 9,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+28% increased Companion Damage",
        "You may keep one additional companion-of-war (design text)",
        "The line behind you is also the line beside you."
      ],
      "stat": "minionDamage",
      "amount": 28,
      "tags": [],
      "clusterId": "procession-named",
      "status": "review",
      "notes": "",
      "name": "Second Congregation"
    },
    "3,6": {
      "id": "3,6",
      "q": 3,
      "r": 6,
      "ring": 9,
      "type": "small",
      "axis": "int",
      "effects": [
        "+11% increased Rite Damage"
      ],
      "stat": "spellDamage",
      "amount": 11,
      "tags": [],
      "clusterId": "procession-deep",
      "status": "review",
      "notes": "",
      "name": "Old Devotions"
    },
    "4,5": {
      "id": "4,5",
      "q": 4,
      "r": 5,
      "ring": 9,
      "type": "small",
      "axis": "int",
      "effects": [
        "+12% to Gloam Resistance"
      ],
      "stat": "gloam_res",
      "amount": 12,
      "tags": [],
      "clusterId": "procession-deep",
      "status": "review",
      "notes": "",
      "name": "Ossuary Quiet"
    },
    "5,4": {
      "id": "5,4",
      "q": 5,
      "r": 4,
      "ring": 9,
      "type": "socket",
      "axis": "int",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "procession-sockets",
      "status": "review",
      "notes": "",
      "name": "The Procession Deep Socket"
    },
    "6,3": {
      "id": "6,3",
      "q": 6,
      "r": 3,
      "ring": 9,
      "type": "small",
      "axis": "int",
      "effects": [
        "+11% increased Companion Damage",
        "Your companion picks up what you leave behind (design text)"
      ],
      "stat": "minionDamage",
      "amount": 11,
      "tags": [],
      "clusterId": "procession-deep",
      "status": "review",
      "notes": "",
      "name": "Warden of Relics"
    },
    "7,2": {
      "id": "7,2",
      "q": 7,
      "r": 2,
      "ring": 9,
      "type": "small",
      "axis": "int",
      "effects": [
        "+28 to Ward"
      ],
      "stat": "ward",
      "amount": 28,
      "tags": [],
      "clusterId": "procession-deep",
      "status": "review",
      "notes": "",
      "name": "Undercroft Lamp"
    },
    "8,1": {
      "id": "8,1",
      "q": 8,
      "r": 1,
      "ring": 9,
      "type": "small",
      "axis": "int",
      "effects": [
        "+14 to Spirit"
      ],
      "stat": "spirit",
      "amount": 14,
      "tags": [],
      "clusterId": "procession-deep",
      "status": "review",
      "notes": "",
      "name": "Breviary Margin"
    },
    "9,0": {
      "id": "9,0",
      "q": 9,
      "r": 0,
      "ring": 9,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+30% increased Rite Damage",
        "+30 to Ward",
        "Rites cost 5% less Spirit (design text)"
      ],
      "stat": "spellDamage",
      "amount": 30,
      "tags": [],
      "clusterId": "int-spoke",
      "status": "review",
      "notes": "",
      "name": "Deep Shelf"
    },
    "9,-1": {
      "id": "9,-1",
      "q": 9,
      "r": -1,
      "ring": 9,
      "type": "small",
      "axis": "int",
      "effects": [
        "+12% increased Rite Damage"
      ],
      "stat": "spellDamage",
      "amount": 12,
      "tags": [],
      "clusterId": "drowned-deep",
      "status": "review",
      "notes": "",
      "name": "Deep Shelf Reading"
    },
    "9,-2": {
      "id": "9,-2",
      "q": 9,
      "r": -2,
      "ring": 9,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+24% increased Ailment Effect",
        "+15 to Ward",
        "Numb builds to Freeze 20% sooner (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 24,
      "tags": [],
      "clusterId": "drowned-study-named",
      "status": "review",
      "notes": "",
      "name": "Patient Current"
    },
    "9,-3": {
      "id": "9,-3",
      "q": 9,
      "r": -3,
      "ring": 9,
      "type": "small",
      "axis": "int",
      "effects": [
        "+10% to Gloam Resistance"
      ],
      "stat": "gloam_res",
      "amount": 10,
      "tags": [],
      "clusterId": "drowned-deep",
      "status": "review",
      "notes": "",
      "name": "Black Water"
    },
    "9,-4": {
      "id": "9,-4",
      "q": 9,
      "r": -4,
      "ring": 9,
      "type": "small",
      "axis": "int",
      "effects": [
        "+12% increased Ailment Effect",
        "Enemies Frozen by you thaw 50% slower (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 12,
      "tags": [],
      "clusterId": "drowned-deep",
      "status": "review",
      "notes": "",
      "name": "The Undertaker Current"
    },
    "9,-5": {
      "id": "9,-5",
      "q": 9,
      "r": -5,
      "ring": 9,
      "type": "socket",
      "axis": "int",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "drowned-study-sockets",
      "status": "review",
      "notes": "",
      "name": "The Drowned Study Deep Socket"
    },
    "9,-6": {
      "id": "9,-6",
      "q": 9,
      "r": -6,
      "ring": 9,
      "type": "small",
      "axis": "int",
      "effects": [
        "+30 to Ward"
      ],
      "stat": "ward",
      "amount": 30,
      "tags": [],
      "clusterId": "drowned-deep",
      "status": "review",
      "notes": "",
      "name": "Silver Silt"
    },
    "9,-7": {
      "id": "9,-7",
      "q": 9,
      "r": -7,
      "ring": 9,
      "type": "small",
      "axis": "int",
      "effects": [
        "+5% increased Rite Speed"
      ],
      "stat": "castSpeed",
      "amount": 5,
      "tags": [],
      "clusterId": "drowned-deep",
      "status": "review",
      "notes": "",
      "name": "Cold Authority"
    },
    "9,-8": {
      "id": "9,-8",
      "q": 9,
      "r": -8,
      "ring": 9,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+14 to Spirit"
      ],
      "stat": "spirit",
      "amount": 14,
      "tags": [],
      "clusterId": "drowned-deep",
      "status": "review",
      "notes": "",
      "name": "Drowned Notes"
    },
    "9,-9": {
      "id": "9,-9",
      "q": 9,
      "r": -9,
      "ring": 9,
      "type": "notable",
      "axis": "hybrid",
      "effects": [
        "+15% to Gloam Resistance",
        "+22% increased Ailment Effect",
        "Enemies that kill your allies are marked for you (design text)"
      ],
      "stat": "gloam_res",
      "amount": 15,
      "tags": [],
      "clusterId": "nightwork-spoke",
      "status": "review",
      "notes": "",
      "name": "The Long Memory"
    },
    "8,-9": {
      "id": "8,-9",
      "q": 8,
      "r": -9,
      "ring": 9,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+10% increased Evasion"
      ],
      "stat": "evasion_increased",
      "amount": 10,
      "tags": [],
      "clusterId": "unlit-deep",
      "status": "review",
      "notes": "",
      "name": "Deep Cellars"
    },
    "7,-9": {
      "id": "7,-9",
      "q": 7,
      "r": -9,
      "ring": 9,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+14% to Gloam Resistance",
        "+20% increased Ailment Effect",
        "Wither you inflict cannot be cleansed (design text)"
      ],
      "stat": "gloam_res",
      "amount": 14,
      "tags": [],
      "clusterId": "unlit-road-named",
      "status": "review",
      "notes": "",
      "name": "Widow Work"
    },
    "6,-9": {
      "id": "6,-9",
      "q": 6,
      "r": -9,
      "ring": 9,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+12% increased Ailment Effect"
      ],
      "stat": "ailmentEffect",
      "amount": 12,
      "tags": [],
      "clusterId": "unlit-deep",
      "status": "review",
      "notes": "",
      "name": "Old Poisoner Notes"
    },
    "5,-9": {
      "id": "5,-9",
      "q": 5,
      "r": -9,
      "ring": 9,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+14% to Gloam Resistance",
        "Wither you suffer drains 30% slower (design text)"
      ],
      "stat": "gloam_res",
      "amount": 14,
      "tags": [],
      "clusterId": "unlit-deep",
      "status": "review",
      "notes": "",
      "name": "Wither Root"
    },
    "4,-9": {
      "id": "4,-9",
      "q": 4,
      "r": -9,
      "ring": 9,
      "type": "socket",
      "axis": "dex",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "unlit-road-sockets",
      "status": "review",
      "notes": "",
      "name": "The Unlit Road Deep Socket"
    },
    "3,-9": {
      "id": "3,-9",
      "q": 3,
      "r": -9,
      "ring": 9,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+1% to Critical Chance"
      ],
      "stat": "critChance",
      "amount": 1,
      "tags": [],
      "clusterId": "unlit-deep",
      "status": "review",
      "notes": "",
      "name": "Last Candle"
    },
    "2,-9": {
      "id": "2,-9",
      "q": 2,
      "r": -9,
      "ring": 9,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+35 to Evasion"
      ],
      "stat": "evasion",
      "amount": 35,
      "tags": [],
      "clusterId": "unlit-deep",
      "status": "review",
      "notes": "",
      "name": "Smuggler Hollow"
    },
    "1,-9": {
      "id": "1,-9",
      "q": 1,
      "r": -9,
      "ring": 9,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+6 to Dexterity"
      ],
      "stat": "dex",
      "amount": 6,
      "tags": [],
      "clusterId": "unlit-deep",
      "status": "review",
      "notes": "",
      "name": "Night Ledger"
    },
    "0,-9": {
      "id": "0,-9",
      "q": 0,
      "r": -9,
      "ring": 9,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+25% to Advantage Bonus",
        "+50 to Accuracy",
        "Hits against enemies that just missed you gain +1% Critical Chance (design text)"
      ],
      "stat": "crit_bonus_flat",
      "amount": 25,
      "tags": [],
      "clusterId": "dex-spoke",
      "status": "review",
      "notes": "",
      "name": "No Second Chance"
    },
    "-1,-8": {
      "id": "-1,-8",
      "q": -1,
      "r": -8,
      "ring": 9,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+12% increased Projectile Damage"
      ],
      "stat": "projectileDamage",
      "amount": 12,
      "tags": [],
      "clusterId": "high-deep",
      "status": "review",
      "notes": "",
      "name": "Deep Ravine Line"
    },
    "-2,-7": {
      "id": "-2,-7",
      "q": -2,
      "r": -7,
      "ring": 9,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+70 to Accuracy",
        "+15% increased Projectile Damage",
        "Your misses at long range are rerolled once (design text)"
      ],
      "stat": "accuracy_flat",
      "amount": 70,
      "tags": [],
      "clusterId": "high-paths-named",
      "status": "review",
      "notes": "",
      "name": "Eye of the Slinger"
    },
    "-3,-6": {
      "id": "-3,-6",
      "q": -3,
      "r": -6,
      "ring": 9,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5% increased Movement Speed"
      ],
      "stat": "move",
      "amount": 5,
      "tags": [],
      "clusterId": "high-deep",
      "status": "review",
      "notes": "",
      "name": "Thin Air Lungs"
    },
    "-4,-5": {
      "id": "-4,-5",
      "q": -4,
      "r": -5,
      "ring": 9,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+14% to Storm Resistance",
        "You cannot be Jolted while moving (design text)"
      ],
      "stat": "storm_res",
      "amount": 14,
      "tags": [],
      "clusterId": "high-deep",
      "status": "review",
      "notes": "",
      "name": "Thunder Bones"
    },
    "-5,-4": {
      "id": "-5,-4",
      "q": -5,
      "r": -4,
      "ring": 9,
      "type": "socket",
      "axis": "dex",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "high-paths-sockets",
      "status": "review",
      "notes": "",
      "name": "The High Paths Deep Socket"
    },
    "-6,-3": {
      "id": "-6,-3",
      "q": -6,
      "r": -3,
      "ring": 9,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+10% increased Evasion"
      ],
      "stat": "evasion_increased",
      "amount": 10,
      "tags": [],
      "clusterId": "high-deep",
      "status": "review",
      "notes": "",
      "name": "Eagle Feathers"
    },
    "-7,-2": {
      "id": "-7,-2",
      "q": -7,
      "r": -2,
      "ring": 9,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+6 to Dexterity"
      ],
      "stat": "dex",
      "amount": 6,
      "tags": [],
      "clusterId": "high-deep",
      "status": "review",
      "notes": "",
      "name": "Summit Ledger"
    },
    "-8,-1": {
      "id": "-8,-1",
      "q": -8,
      "r": -1,
      "ring": 9,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+50 to Accuracy"
      ],
      "stat": "accuracy_flat",
      "amount": 50,
      "tags": [],
      "clusterId": "high-deep",
      "status": "review",
      "notes": "",
      "name": "Anchor Cairn"
    },
    "-9,0": {
      "id": "-9,0",
      "q": -9,
      "r": 0,
      "ring": 9,
      "type": "notable",
      "axis": "hybrid",
      "effects": [
        "+28% increased Projectile Damage",
        "+40 to Accuracy",
        "Missed throws can be recovered where they landed (design text)"
      ],
      "stat": "projectileDamage",
      "amount": 28,
      "tags": [],
      "clusterId": "skirmisher-spoke",
      "status": "review",
      "notes": "",
      "name": "Nothing Wasted"
    },
    "-9,1": {
      "id": "-9,1",
      "q": -9,
      "r": 1,
      "ring": 9,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+11% increased Attack Damage"
      ],
      "stat": "attackDamage",
      "amount": 11,
      "tags": [],
      "clusterId": "red-deep",
      "status": "review",
      "notes": "",
      "name": "Deep Field Ruts"
    },
    "-9,2": {
      "id": "-9,2",
      "q": -9,
      "r": 2,
      "ring": 9,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+45 to Life",
        "+16% increased Attack Damage",
        "Each enemy in reach adds +4% to your damage (design text)"
      ],
      "stat": "life",
      "amount": 45,
      "tags": [],
      "clusterId": "red-field-named",
      "status": "review",
      "notes": "",
      "name": "Wading In"
    },
    "-9,3": {
      "id": "-9,3",
      "q": -9,
      "r": 3,
      "ring": 9,
      "type": "small",
      "axis": "str",
      "effects": [
        "+30 to Life"
      ],
      "stat": "life",
      "amount": 30,
      "tags": [],
      "clusterId": "red-deep",
      "status": "review",
      "notes": "",
      "name": "Old Standard Pole"
    },
    "-9,4": {
      "id": "-9,4",
      "q": -9,
      "r": 4,
      "ring": 9,
      "type": "small",
      "axis": "str",
      "effects": [
        "+12% increased Ailment Effect",
        "Your Bleeds remember: reapplying restores full duration (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 12,
      "tags": [],
      "clusterId": "red-deep",
      "status": "review",
      "notes": "",
      "name": "Marrow Memory"
    },
    "-9,5": {
      "id": "-9,5",
      "q": -9,
      "r": 5,
      "ring": 9,
      "type": "socket",
      "axis": "str",
      "effects": [
        "An empty seat carved for a whorl-stone.",
        "Does nothing while empty; carved stones arrive with the stone-carver."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "socket"
      ],
      "clusterId": "red-field-sockets",
      "status": "review",
      "notes": "",
      "name": "The Red Field Deep Socket"
    },
    "-9,6": {
      "id": "-9,6",
      "q": -9,
      "r": 6,
      "ring": 9,
      "type": "small",
      "axis": "str",
      "effects": [
        "+10% increased Reach"
      ],
      "stat": "reach_increased",
      "amount": 10,
      "tags": [],
      "clusterId": "red-deep",
      "status": "review",
      "notes": "",
      "name": "Sheaf of Spears"
    },
    "-9,7": {
      "id": "-9,7",
      "q": -9,
      "r": 7,
      "ring": 9,
      "type": "small",
      "axis": "str",
      "effects": [
        "+5% increased Attack Speed"
      ],
      "stat": "attackSpeed",
      "amount": 5,
      "tags": [],
      "clusterId": "red-deep",
      "status": "review",
      "notes": "",
      "name": "Threshing Rhythm"
    },
    "-9,8": {
      "id": "-9,8",
      "q": -9,
      "r": 8,
      "ring": 9,
      "type": "small",
      "axis": "str",
      "effects": [
        "+32 to Guard"
      ],
      "stat": "guard",
      "amount": 32,
      "tags": [],
      "clusterId": "red-deep",
      "status": "review",
      "notes": "",
      "name": "Salted Earth"
    },
    "-10,10": {
      "id": "-10,10",
      "q": -10,
      "r": 10,
      "ring": 10,
      "type": "gateway",
      "axis": "str",
      "effects": [
        "Shared gate for the Vanguard Oath outer circle.",
        "Unlock condition: allocate this gate and complete any inner six-node circle."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "gateway",
        "Vanguard Oath"
      ],
      "clusterId": "str-spoke",
      "status": "review",
      "notes": "",
      "name": "Vanguard Oath Gate"
    },
    "-9,10": {
      "id": "-9,10",
      "q": -9,
      "r": 10,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+5 to Strength"
      ],
      "stat": "str",
      "amount": 5,
      "tags": [],
      "clusterId": "kiln-frontier",
      "status": "review",
      "notes": "",
      "name": "Kiln Road East"
    },
    "-8,10": {
      "id": "-8,10",
      "q": -8,
      "r": 10,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+5 to Intelligence"
      ],
      "stat": "int",
      "amount": 5,
      "tags": [],
      "clusterId": "kiln-frontier",
      "status": "review",
      "notes": "",
      "name": "Kiln Road West"
    },
    "-7,10": {
      "id": "-7,10",
      "q": -7,
      "r": 10,
      "ring": 10,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+26% increased Ailment Effect",
        "Enemies you kill while Scalded ignite their nearest ally (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 26,
      "tags": [],
      "clusterId": "kiln-line-named",
      "status": "review",
      "notes": "",
      "name": "The Last Firing"
    },
    "-6,10": {
      "id": "-6,10",
      "q": -6,
      "r": 10,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+5 to Strength"
      ],
      "stat": "str",
      "amount": 5,
      "tags": [],
      "clusterId": "kiln-frontier",
      "status": "review",
      "notes": "",
      "name": "Cartload of Coal"
    },
    "-5,10": {
      "id": "-5,10",
      "q": -5,
      "r": 10,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+22 to Life",
        "Rest here: Second Breath is 10% faster (design text)"
      ],
      "stat": "life",
      "amount": 22,
      "tags": [],
      "clusterId": "kiln-frontier",
      "status": "review",
      "notes": "",
      "name": "Warm Hearthstone"
    },
    "-4,10": {
      "id": "-4,10",
      "q": -4,
      "r": 10,
      "ring": 10,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+22% increased Guard",
        "+12% to Ember Resistance",
        "Ground you stand on cannot burn you (design text)"
      ],
      "stat": "guard_increased",
      "amount": 22,
      "tags": [],
      "clusterId": "kiln-line-named",
      "status": "review",
      "notes": "",
      "name": "Ash Garden"
    },
    "-3,10": {
      "id": "-3,10",
      "q": -3,
      "r": 10,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+5 to Intelligence"
      ],
      "stat": "int",
      "amount": 5,
      "tags": [],
      "clusterId": "kiln-frontier",
      "status": "review",
      "notes": "",
      "name": "Potter Marks"
    },
    "-2,10": {
      "id": "-2,10",
      "q": -2,
      "r": 10,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+3 to all Attributes"
      ],
      "stat": "attrs",
      "amount": 3,
      "tags": [],
      "clusterId": "kiln-frontier",
      "status": "review",
      "notes": "",
      "name": "Cracked Amphora"
    },
    "-1,10": {
      "id": "-1,10",
      "q": -1,
      "r": 10,
      "ring": 10,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+5 to Strength"
      ],
      "stat": "str",
      "amount": 5,
      "tags": [],
      "clusterId": "kiln-frontier",
      "status": "review",
      "notes": "",
      "name": "Fired Brick Path"
    },
    "0,10": {
      "id": "0,10",
      "q": 0,
      "r": 10,
      "ring": 10,
      "type": "gateway",
      "axis": "hybrid",
      "effects": [
        "Shared gate for the Seer's Annex outer circle.",
        "Unlock condition: allocate this gate and complete any inner six-node circle."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "gateway",
        "Seer's Annex"
      ],
      "clusterId": "ritualist-spoke",
      "status": "review",
      "notes": "",
      "name": "Seer's Annex Gate"
    },
    "1,9": {
      "id": "1,9",
      "q": 1,
      "r": 9,
      "ring": 10,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+5 to Intelligence"
      ],
      "stat": "int",
      "amount": 5,
      "tags": [],
      "clusterId": "procession-frontier",
      "status": "review",
      "notes": "",
      "name": "Pilgrim Steps"
    },
    "2,8": {
      "id": "2,8",
      "q": 2,
      "r": 8,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+3 to all Attributes",
        "Pause here: your next rite costs nothing (design text)"
      ],
      "stat": "attrs",
      "amount": 3,
      "tags": [],
      "clusterId": "procession-frontier",
      "status": "review",
      "notes": "",
      "name": "Roadside Shrine"
    },
    "3,7": {
      "id": "3,7",
      "q": 3,
      "r": 7,
      "ring": 10,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+50 to Ward",
        "Ward gained from this passive counts as a rite for your keystones (design text)"
      ],
      "stat": "ward",
      "amount": 50,
      "tags": [],
      "clusterId": "procession-named",
      "status": "review",
      "notes": "",
      "name": "The Empty Reliquary"
    },
    "4,6": {
      "id": "4,6",
      "q": 4,
      "r": 6,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+5 to Intelligence"
      ],
      "stat": "int",
      "amount": 5,
      "tags": [],
      "clusterId": "procession-frontier",
      "status": "review",
      "notes": "",
      "name": "Prayer Flags"
    },
    "5,5": {
      "id": "5,5",
      "q": 5,
      "r": 5,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+12 to Spirit"
      ],
      "stat": "spirit",
      "amount": 12,
      "tags": [],
      "clusterId": "procession-frontier",
      "status": "review",
      "notes": "",
      "name": "Alms Bowl"
    },
    "6,4": {
      "id": "6,4",
      "q": 6,
      "r": 4,
      "ring": 10,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+30 to Spirit",
        "+12% increased Companion Damage",
        "Kills during your rites feed 5 Spirit back (design text)"
      ],
      "stat": "spirit",
      "amount": 30,
      "tags": [],
      "clusterId": "procession-named",
      "status": "review",
      "notes": "",
      "name": "Feast After Service"
    },
    "7,3": {
      "id": "7,3",
      "q": 7,
      "r": 3,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+5 to Strength"
      ],
      "stat": "str",
      "amount": 5,
      "tags": [],
      "clusterId": "procession-frontier",
      "status": "review",
      "notes": "",
      "name": "Stone Lantern Row"
    },
    "8,2": {
      "id": "8,2",
      "q": 8,
      "r": 2,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+20 to Ward"
      ],
      "stat": "ward",
      "amount": 20,
      "tags": [],
      "clusterId": "procession-frontier",
      "status": "review",
      "notes": "",
      "name": "Vigil Bench"
    },
    "9,1": {
      "id": "9,1",
      "q": 9,
      "r": 1,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+5 to Intelligence"
      ],
      "stat": "int",
      "amount": 5,
      "tags": [],
      "clusterId": "procession-frontier",
      "status": "review",
      "notes": "",
      "name": "The Quiet Mile"
    },
    "10,0": {
      "id": "10,0",
      "q": 10,
      "r": 0,
      "ring": 10,
      "type": "gateway",
      "axis": "int",
      "effects": [
        "Shared gate for the Genius Circle outer circle.",
        "Unlock condition: allocate this gate and complete any inner six-node circle."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "gateway",
        "Genius Circle"
      ],
      "clusterId": "int-spoke",
      "status": "review",
      "notes": "",
      "name": "Genius Circle Gate"
    },
    "10,-1": {
      "id": "10,-1",
      "q": 10,
      "r": -1,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+5 to Intelligence"
      ],
      "stat": "int",
      "amount": 5,
      "tags": [],
      "clusterId": "drowned-frontier",
      "status": "review",
      "notes": "",
      "name": "River Road North"
    },
    "10,-2": {
      "id": "10,-2",
      "q": 10,
      "r": -2,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+3 to all Attributes"
      ],
      "stat": "attrs",
      "amount": 3,
      "tags": [],
      "clusterId": "drowned-frontier",
      "status": "review",
      "notes": "",
      "name": "Ferry Toll"
    },
    "10,-3": {
      "id": "10,-3",
      "q": 10,
      "r": -3,
      "ring": 10,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+30% increased Rite Damage",
        "Once rung, your next rite Numbs everything it touches (design text)"
      ],
      "stat": "spellDamage",
      "amount": 30,
      "tags": [],
      "clusterId": "drowned-study-named",
      "status": "review",
      "notes": "",
      "name": "The Sunken Bell"
    },
    "10,-4": {
      "id": "10,-4",
      "q": 10,
      "r": -4,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+5 to Dexterity",
        "You are hard to mark in the mist (design text)"
      ],
      "stat": "dex",
      "amount": 5,
      "tags": [],
      "clusterId": "drowned-frontier",
      "status": "review",
      "notes": "",
      "name": "Mist Bank"
    },
    "10,-5": {
      "id": "10,-5",
      "q": 10,
      "r": -5,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+5 to Intelligence"
      ],
      "stat": "int",
      "amount": 5,
      "tags": [],
      "clusterId": "drowned-frontier",
      "status": "review",
      "notes": "",
      "name": "Cold Jetty"
    },
    "10,-6": {
      "id": "10,-6",
      "q": 10,
      "r": -6,
      "ring": 10,
      "type": "notable",
      "axis": "int",
      "effects": [
        "+45 to Ward",
        "+10% increased Ailment Effect",
        "Marked enemies cannot see past the reeds (design text)"
      ],
      "stat": "ward",
      "amount": 45,
      "tags": [],
      "clusterId": "drowned-study-named",
      "status": "review",
      "notes": "",
      "name": "Court of Reeds"
    },
    "10,-7": {
      "id": "10,-7",
      "q": 10,
      "r": -7,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+20 to Ward"
      ],
      "stat": "ward",
      "amount": 20,
      "tags": [],
      "clusterId": "drowned-frontier",
      "status": "review",
      "notes": "",
      "name": "Waterline Steps"
    },
    "10,-8": {
      "id": "10,-8",
      "q": 10,
      "r": -8,
      "ring": 10,
      "type": "small",
      "axis": "int",
      "effects": [
        "+5 to Dexterity"
      ],
      "stat": "dex",
      "amount": 5,
      "tags": [],
      "clusterId": "drowned-frontier",
      "status": "review",
      "notes": "",
      "name": "Heron Watch"
    },
    "10,-9": {
      "id": "10,-9",
      "q": 10,
      "r": -9,
      "ring": 10,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+5 to Intelligence"
      ],
      "stat": "int",
      "amount": 5,
      "tags": [],
      "clusterId": "drowned-frontier",
      "status": "review",
      "notes": "",
      "name": "The Far Shore"
    },
    "10,-10": {
      "id": "10,-10",
      "q": 10,
      "r": -10,
      "ring": 10,
      "type": "gateway",
      "axis": "hybrid",
      "effects": [
        "Shared gate for the Spellblade Annex outer circle.",
        "Unlock condition: allocate this gate and complete any inner six-node circle."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "gateway",
        "Spellblade Annex"
      ],
      "clusterId": "nightwork-spoke",
      "status": "review",
      "notes": "",
      "name": "Spellblade Annex Gate"
    },
    "9,-10": {
      "id": "9,-10",
      "q": 9,
      "r": -10,
      "ring": 10,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+5 to Dexterity"
      ],
      "stat": "dex",
      "amount": 5,
      "tags": [],
      "clusterId": "unlit-frontier",
      "status": "review",
      "notes": "",
      "name": "Unlit Mile One"
    },
    "8,-10": {
      "id": "8,-10",
      "q": 8,
      "r": -10,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5 to Dexterity"
      ],
      "stat": "dex",
      "amount": 5,
      "tags": [],
      "clusterId": "unlit-frontier",
      "status": "review",
      "notes": "",
      "name": "Hooded Marker"
    },
    "7,-10": {
      "id": "7,-10",
      "q": 7,
      "r": -10,
      "ring": 10,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+60 to Evasion",
        "You may pass one enemy without being noticed, once per fight (design text)"
      ],
      "stat": "evasion",
      "amount": 60,
      "tags": [],
      "clusterId": "unlit-road-named",
      "status": "review",
      "notes": "",
      "name": "The Unlit Door"
    },
    "6,-10": {
      "id": "6,-10",
      "q": 6,
      "r": -10,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5 to Intelligence",
        "Road signs mean more to you than most (design text)"
      ],
      "stat": "int",
      "amount": 5,
      "tags": [],
      "clusterId": "unlit-frontier",
      "status": "review",
      "notes": "",
      "name": "Thieves Cant"
    },
    "5,-10": {
      "id": "5,-10",
      "q": 5,
      "r": -10,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+24 to Evasion"
      ],
      "stat": "evasion",
      "amount": 24,
      "tags": [],
      "clusterId": "unlit-frontier",
      "status": "review",
      "notes": "",
      "name": "Ditch Shadow"
    },
    "4,-10": {
      "id": "4,-10",
      "q": 4,
      "r": -10,
      "ring": 10,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+24% increased Ailment Effect",
        "Poison on Withered enemies deals Gloam instead (design text)"
      ],
      "stat": "ailmentEffect",
      "amount": 24,
      "tags": [],
      "clusterId": "unlit-road-named",
      "status": "review",
      "notes": "",
      "name": "Nightsoil Trade"
    },
    "3,-10": {
      "id": "3,-10",
      "q": 3,
      "r": -10,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5 to Dexterity"
      ],
      "stat": "dex",
      "amount": 5,
      "tags": [],
      "clusterId": "unlit-frontier",
      "status": "review",
      "notes": "",
      "name": "Owl Hours"
    },
    "2,-10": {
      "id": "2,-10",
      "q": 2,
      "r": -10,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+3 to all Attributes"
      ],
      "stat": "attrs",
      "amount": 3,
      "tags": [],
      "clusterId": "unlit-frontier",
      "status": "review",
      "notes": "",
      "name": "Buried Cache"
    },
    "1,-10": {
      "id": "1,-10",
      "q": 1,
      "r": -10,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5 to Dexterity"
      ],
      "stat": "dex",
      "amount": 5,
      "tags": [],
      "clusterId": "unlit-frontier",
      "status": "review",
      "notes": "",
      "name": "The Cold Stile"
    },
    "0,-10": {
      "id": "0,-10",
      "q": 0,
      "r": -10,
      "ring": 10,
      "type": "gateway",
      "axis": "dex",
      "effects": [
        "Shared gate for the Ranger's Writ outer circle.",
        "Unlock condition: allocate this gate and complete any inner six-node circle."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "gateway",
        "Ranger's Writ"
      ],
      "clusterId": "dex-spoke",
      "status": "review",
      "notes": "",
      "name": "Ranger's Writ Gate"
    },
    "-1,-9": {
      "id": "-1,-9",
      "q": -1,
      "r": -9,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5 to Dexterity"
      ],
      "stat": "dex",
      "amount": 5,
      "tags": [],
      "clusterId": "high-frontier",
      "status": "review",
      "notes": "",
      "name": "High Path One"
    },
    "-2,-8": {
      "id": "-2,-8",
      "q": -2,
      "r": -8,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+3 to all Attributes"
      ],
      "stat": "attrs",
      "amount": 3,
      "tags": [],
      "clusterId": "high-frontier",
      "status": "review",
      "notes": "",
      "name": "Rope Bridge"
    },
    "-3,-7": {
      "id": "-3,-7",
      "q": -3,
      "r": -7,
      "ring": 10,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+30% increased Projectile Damage",
        "You can see marks at any distance (design text)"
      ],
      "stat": "projectileDamage",
      "amount": 30,
      "tags": [],
      "clusterId": "high-paths-named",
      "status": "review",
      "notes": "",
      "name": "The Watching Peak"
    },
    "-4,-6": {
      "id": "-4,-6",
      "q": -4,
      "r": -6,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5 to Dexterity",
        "Enemies chase you uphill at their peril (design text)"
      ],
      "stat": "dex",
      "amount": 5,
      "tags": [],
      "clusterId": "high-frontier",
      "status": "review",
      "notes": "",
      "name": "Scree Slope"
    },
    "-5,-5": {
      "id": "-5,-5",
      "q": -5,
      "r": -5,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5 to Dexterity"
      ],
      "stat": "dex",
      "amount": 5,
      "tags": [],
      "clusterId": "high-frontier",
      "status": "review",
      "notes": "",
      "name": "Kestrel Post"
    },
    "-6,-4": {
      "id": "-6,-4",
      "q": -6,
      "r": -4,
      "ring": 10,
      "type": "notable",
      "axis": "dex",
      "effects": [
        "+22% increased Evasion",
        "+12% to Storm Resistance",
        "Projectiles aimed at you drift in the wind (design text)"
      ],
      "stat": "evasion_increased",
      "amount": 22,
      "tags": [],
      "clusterId": "high-paths-named",
      "status": "review",
      "notes": "",
      "name": "Gale Shelter"
    },
    "-7,-3": {
      "id": "-7,-3",
      "q": -7,
      "r": -3,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+24 to Evasion"
      ],
      "stat": "evasion",
      "amount": 24,
      "tags": [],
      "clusterId": "high-frontier",
      "status": "review",
      "notes": "",
      "name": "Windbreak Wall"
    },
    "-8,-2": {
      "id": "-8,-2",
      "q": -8,
      "r": -2,
      "ring": 10,
      "type": "small",
      "axis": "dex",
      "effects": [
        "+5 to Strength"
      ],
      "stat": "str",
      "amount": 5,
      "tags": [],
      "clusterId": "high-frontier",
      "status": "review",
      "notes": "",
      "name": "Old Signal Fire"
    },
    "-9,-1": {
      "id": "-9,-1",
      "q": -9,
      "r": -1,
      "ring": 10,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+5 to Dexterity"
      ],
      "stat": "dex",
      "amount": 5,
      "tags": [],
      "clusterId": "high-frontier",
      "status": "review",
      "notes": "",
      "name": "The Last Ridge"
    },
    "-10,0": {
      "id": "-10,0",
      "q": -10,
      "r": 0,
      "ring": 10,
      "type": "gateway",
      "axis": "hybrid",
      "effects": [
        "Shared gate for the Skirmish Annex outer circle.",
        "Unlock condition: allocate this gate and complete any inner six-node circle."
      ],
      "stat": null,
      "amount": 0,
      "tags": [
        "gateway",
        "Skirmish Annex"
      ],
      "clusterId": "skirmisher-spoke",
      "status": "review",
      "notes": "",
      "name": "Skirmish Annex Gate"
    },
    "-10,1": {
      "id": "-10,1",
      "q": -10,
      "r": 1,
      "ring": 10,
      "type": "small",
      "axis": "hybrid",
      "effects": [
        "+5 to Strength"
      ],
      "stat": "str",
      "amount": 5,
      "tags": [],
      "clusterId": "red-frontier",
      "status": "review",
      "notes": "",
      "name": "Red Field Gate Road"
    },
    "-10,2": {
      "id": "-10,2",
      "q": -10,
      "r": 2,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+5 to Strength"
      ],
      "stat": "str",
      "amount": 5,
      "tags": [],
      "clusterId": "red-frontier",
      "status": "review",
      "notes": "",
      "name": "Broken Cart Axle"
    },
    "-10,3": {
      "id": "-10,3",
      "q": -10,
      "r": 3,
      "ring": 10,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+30% increased Attack Damage",
        "Enemies that see your standard Bleed easier (design text)"
      ],
      "stat": "attackDamage",
      "amount": 30,
      "tags": [],
      "clusterId": "red-field-named",
      "status": "review",
      "notes": "",
      "name": "The Red Standard"
    },
    "-10,4": {
      "id": "-10,4",
      "q": -10,
      "r": 4,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+3 to all Attributes",
        "The crows remember who fed them (design text)"
      ],
      "stat": "attrs",
      "amount": 3,
      "tags": [],
      "clusterId": "red-frontier",
      "status": "review",
      "notes": "",
      "name": "Crow Fence"
    },
    "-10,5": {
      "id": "-10,5",
      "q": -10,
      "r": 5,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+5 to Strength"
      ],
      "stat": "str",
      "amount": 5,
      "tags": [],
      "clusterId": "red-frontier",
      "status": "review",
      "notes": "",
      "name": "Boot Churn"
    },
    "-10,6": {
      "id": "-10,6",
      "q": -10,
      "r": 6,
      "ring": 10,
      "type": "notable",
      "axis": "str",
      "effects": [
        "+55 to Life",
        "+10% increased Ailment Effect",
        "Your Bleeds close only when their victim falls (design text)"
      ],
      "stat": "life",
      "amount": 55,
      "tags": [],
      "clusterId": "red-field-named",
      "status": "review",
      "notes": "",
      "name": "Field Surgeon Scorn"
    },
    "-10,7": {
      "id": "-10,7",
      "q": -10,
      "r": 7,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+22 to Life"
      ],
      "stat": "life",
      "amount": 22,
      "tags": [],
      "clusterId": "red-frontier",
      "status": "review",
      "notes": "",
      "name": "Rust Bloom"
    },
    "-10,8": {
      "id": "-10,8",
      "q": -10,
      "r": 8,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+22 to Guard"
      ],
      "stat": "guard",
      "amount": 22,
      "tags": [],
      "clusterId": "red-frontier",
      "status": "review",
      "notes": "",
      "name": "Old Rampart Line"
    },
    "-10,9": {
      "id": "-10,9",
      "q": -10,
      "r": 9,
      "ring": 10,
      "type": "small",
      "axis": "str",
      "effects": [
        "+5 to Strength"
      ],
      "stat": "str",
      "amount": 5,
      "tags": [],
      "clusterId": "red-frontier",
      "status": "review",
      "notes": "",
      "name": "The Long Furrow"
    }
  }
};
