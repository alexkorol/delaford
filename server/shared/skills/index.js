import { DEFAULT_SKILL_IDS } from '../combat.js';
import { createSkillDefinition, createQuickbarSlot } from './schema.js';

const SKILL_DEFINITIONS = [
  createSkillDefinition({
    id: DEFAULT_SKILL_IDS.primary,
    name: 'Bronze Arc',
    label: 'Bronze Arc',
    icon: 'blade-sweep',
    category: 'combat',
    description: 'Carve a broad weapon arc through the three tiles ahead.',
    animation: { state: 'attack', duration: 420, holdState: 'idle' },
    quickbar: { slot: 0, hotkey: '1', binding: DEFAULT_SKILL_IDS.primary, group: 'combat' },
    modifiers: { globalCooldownMs: 350 },
    tags: ['starter', 'melee'],
  }),
  createSkillDefinition({
    id: DEFAULT_SKILL_IDS.dash,
    name: 'Ghostroad Step',
    label: 'Ghostroad Step',
    icon: 'phantom-step',
    category: 'mobility',
    description: 'Slip three tiles along the ghostroad, stopping before danger.',
    animation: { state: 'dash', duration: 320, holdState: 'run' },
    quickbar: { slot: 1, hotkey: '2', binding: DEFAULT_SKILL_IDS.dash, group: 'movement' },
    behaviour: { movement: { distance: 3 } },
    cooldown: 8,
    tags: ['movement'],
  }),
  createSkillDefinition({
    id: DEFAULT_SKILL_IDS.ability1,
    name: 'Cinder Fan',
    label: 'Cinder Fan',
    icon: 'ember-volley',
    category: 'combat',
    description: 'Hurl a searing cinder down the facing lane to strike at range.',
    animation: { state: 'attack', duration: 520, holdState: 'idle' },
    quickbar: { slot: 2, hotkey: '3', group: 'ability' },
    behaviour: { projectile: { range: 5, travelTimeMs: 280 } },
    cooldown: 6,
    resourceCost: { mana: 12 },
    tags: ['ranged', 'burst'],
  }),
  createSkillDefinition({
    id: DEFAULT_SKILL_IDS.ability2,
    name: 'Rimebreak',
    label: 'Rimebreak',
    icon: 'frost-nova',
    category: 'control',
    description: 'Break a ring of rime around you, damaging and slowing nearby foes.',
    animation: { state: 'attack', duration: 600, holdState: 'idle' },
    quickbar: { slot: 3, hotkey: '4', group: 'ability' },
    behaviour: { area: { radius: 2, slowMultiplier: 0.6, durationMs: 5000 } },
    cooldown: 12,
    resourceCost: { mana: 20 },
    tags: ['area', 'crowd-control'],
  }),
  createSkillDefinition({
    id: DEFAULT_SKILL_IDS.ability3,
    name: 'Cairn Ward',
    label: 'Cairn Ward',
    icon: 'stoneguard',
    category: 'defence',
    description: 'Raise an old-stone ward that hardens your armour for six seconds.',
    animation: { state: 'attack', duration: 400, holdState: 'idle' },
    quickbar: { slot: 4, hotkey: '5', group: 'ability' },
    behaviour: { buff: { armourBonus: 12, durationMs: 6000 } },
    cooldown: 18,
    resourceCost: { mana: 10 },
    tags: ['buff'],
  }),
  createSkillDefinition({
    id: DEFAULT_SKILL_IDS.ability4,
    name: 'Dawn Rite',
    label: 'Dawn Rite',
    icon: 'celestial-mend',
    category: 'support',
    description: 'Call the first light into your wounds and restore lost health.',
    animation: { state: 'attack', duration: 520, holdState: 'idle' },
    quickbar: { slot: 5, hotkey: '6', group: 'support' },
    behaviour: { heal: { base: 18, scaling: 'intelligence', range: 5 } },
    cooldown: 20,
    resourceCost: { mana: 22 },
    tags: ['support', 'healing'],
  }),
];

const SKILL_REGISTRY = new Map(SKILL_DEFINITIONS.map((skill) => [skill.id, skill]));

export const getSkillDefinition = (skillId) => {
  if (!skillId) {
    return null;
  }
  return SKILL_REGISTRY.get(skillId) || null;
};

const QUICKBAR_TEMPLATE = [
  { slotIndex: 0, hotkey: '1', skillId: DEFAULT_SKILL_IDS.primary },
  { slotIndex: 1, hotkey: '2', skillId: DEFAULT_SKILL_IDS.dash },
  { slotIndex: 2, hotkey: '3', skillId: DEFAULT_SKILL_IDS.ability1 },
  { slotIndex: 3, hotkey: '4', skillId: DEFAULT_SKILL_IDS.ability2 },
  { slotIndex: 4, hotkey: '5', skillId: DEFAULT_SKILL_IDS.ability3 },
  { slotIndex: 5, hotkey: '6', skillId: DEFAULT_SKILL_IDS.ability4 },
  { slotIndex: 6, hotkey: '7', skillId: null },
  { slotIndex: 7, hotkey: '8', skillId: null },
];

export const createQuickbarSlots = () => QUICKBAR_TEMPLATE.map(
  (descriptor) => createQuickbarSlot(descriptor, getSkillDefinition),
);

export const getSkillExecutionProfile = (skillId) => {
  const skill = getSkillDefinition(skillId);
  if (!skill) {
    return null;
  }

  const animation = skill.animation || {};
  return {
    skill,
    animationState: animation.state || 'attack',
    duration: animation.duration,
    holdState: animation.holdState,
    modifiers: skill.modifiers || {},
  };
};

export const listSkills = () => [...SKILL_DEFINITIONS];
export const listQuickbarTemplate = () => QUICKBAR_TEMPLATE.map((entry) => ({ ...entry }));

export default {
  listSkills,
  listQuickbarTemplate,
  createQuickbarSlots,
  getSkillDefinition,
  getSkillExecutionProfile,
};
