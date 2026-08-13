# Quest progression

Quest progress is server-authored and persisted with the player. Definitions
live in `server/shared/quests.js` so server rules and the Vue journal use the
same titles, objectives, and reward copy.

## Campaign vertical slice

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

`proof-of-temper` begins immediately afterward. It requires a real elite kill,
guarantees one native Vessel only while that exact quest objective is current,
then verifies the same item entered the inventory and was truly equipped. It
awards the second passive point and ten House renown.

`the-pale-crown` is the first contextual campaign contract:

1. enter **Weir Crypt** specifically (another crypt-themed layout does not
   count);
2. defeat **The Pale Sovereign** in a crypt instance;
3. use the opened stairs to reach floor two of that crypt expedition.

Delve and kill events carry server-derived zone, layout, theme, depth, and
monster identity context. Objective criteria are matched only on the server
and are stripped from the client journal snapshot. The contract awards the
third passive point, 15 House renown, and the Scion deed
`Broke the Pale Sovereign's seal`.

`rot-in-the-reeds` continues the campaign into **Marsh of Reeds**. It requires
the exact named zone, the marsh boss **The Rotfather**, and an authoritative
return from that expedition to the surface. Capturing the departed zone before
the instance is torn down prevents another marsh-like realm—or a client-authored
message—from satisfying the return. The commission awards the fourth passive
point, 20 House renown, and the deed `Ended the rot beneath the reeds`.

Guest saves include the quest state. Account saves send it as `questsData`.
Malformed or unknown persisted quest entries are discarded and quest points
are clamped to the reserved 23-point quest budget.
