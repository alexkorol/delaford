# Quest progression

Quest progress is server-authored and persisted with the player. Definitions
live in `server/shared/quests.js` so server rules and the Vue journal use the
same titles, objectives, and reward copy.

## First vertical slice

`aldwyns-charge` advances only in this order:

1. move through Delaford;
2. strike a hostile creature;
3. slay it;
4. pick up a real world item;
5. enter an Adventure realm.

The existing gameplay handlers report these events through
`notifyProgression`, which advances both the onboarding prompts and the quest
without letting either client author completion. On completion the server:

- adds one point to the quest portion of the 123-point passive-tree economy;
- records `Answered Aldwyn's Charge` on the living Scion;
- adds five authoritative House renown, idempotently by deed;
- force-saves player progress and pushes a live quest-journal update.

Guest saves include the quest state. Account saves send it as `questsData`.
Malformed or unknown persisted quest entries are discarded and quest points
are clamped to the reserved 23-point quest budget.
