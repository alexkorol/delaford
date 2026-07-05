/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = relativePath => readFileSync(
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
  'utf8',
);

describe('WIZARD HUD orbs', () => {
  it('renders the orb art without visible redundant text or bar overlays', () => {
    const source = readSource('src/components/hud/HudOrb.vue');

    expect(source).not.toContain('hud-orb__plaque');
    expect(source).not.toContain('hud-orb__bar');
    expect(source).not.toContain('hud-orb__overlay');
    expect(source).not.toContain('hud-orb__orb-label');
    expect(source).toContain('class="hud-orb__canvas"');
  });

  it('uses a wide crop that includes the WIZARD statue composition', () => {
    const source = readSource('src/core/hud/wizard-orb-renderer.js');

    expect(source).toContain('crop = 3.25');
    expect(source).toContain('uCropOffset');
    expect(source).toContain('hp: -0.52');
    expect(source).toContain('mp: 0.52');
  });

  it('keeps the WIZARD orb canvas transparent outside the art cutout', () => {
    const renderer = readSource('src/core/hud/wizard-orb-renderer.js');
    const shader = readSource('src/assets/shaders/wizard-orb.frag');

    expect(renderer).toContain('alpha: true');
    expect(renderer).toContain('premultipliedAlpha: false');
    expect(renderer).toContain('outColor = vec4(0.0);');
    expect(shader).toContain('float matteValue = max(art.r, max(art.g, art.b));');
    expect(shader).toContain('float matteLift = max(luma(art), satur(art) * 0.32);');
    expect(shader).toContain('smoothstep(0.09, 0.24, matteValue)');
    expect(shader).toContain('float alpha = clamp(max(orbAlpha, artAlpha), 0.0, 1.0);');
    expect(shader).toContain('outColor = vec4(col, alpha);');
  });

  it('keeps chat affordances above the taller orb HUD', () => {
    const source = readSource('src/components/layout/GameContainer.vue');

    expect(source).toContain('--hud-orb-size: clamp(136px, 11vw, 168px);');
    expect(source).toContain('--hud-chat-inset: 12px;');
    expect(source).toContain('--hud-chat-clearance: calc(var(--hud-orb-size) * 0.78);');
    expect(source).toContain('.game-container__chat-peek {\n  position: absolute;');
    expect(source).toContain('.game-container__chat-overlay {\n  position: absolute;');
    expect(source).toContain('bottom: calc(var(--hud-chat-inset) + var(--hud-chat-clearance));');
  });

  it('makes the message log dock draggable inside the playfield', () => {
    const source = readSource('src/components/layout/GameContainer.vue');

    expect(source).toContain('ref="stageShellRef"');
    expect(source).toContain('class="game-container__chat-drag-handle"');
    expect(source).toContain('class="game-container__chat-peek-move"');
    expect(source).toContain('@pointerdown.stop.prevent="beginChatDrag"');
    expect(source).toContain('@mousedown.stop.prevent="beginChatDrag"');
    expect(source).toContain('@click="handleChatPeekMainClick"');
    expect(source).toContain('@dblclick.stop.prevent="resetChatDock"');
    expect(source).toContain('class="game-container__chat-dock-cycle"');
    expect(source).toContain('@click.stop="handleChatCycleClick"');
    expect(source).toContain('const chatPosition = ref(null);');
    expect(source).toContain('const chatDockIndex = ref(0);');
    expect(source).toContain('const hudRef = ref(null);');
    expect(source).toContain('const chatDragMoved = ref(false);');
    expect(source).toContain('const suppressChatCycleClick = ref(false);');
    expect(source).toContain('const setDefaultChatDock = () => {');
    expect(source).toContain('const beginChatDrag = (event) => {');
    expect(source).toContain('const dockChatToIndex = (index) => {');
    expect(source).toContain('const cycleChatDock = () => {');
    expect(source).toContain('const handleChatCycleClick = () => {');
    expect(source).toContain('const handleChatPeekMainClick = (event) => {');
    expect(source).toContain('const usingMouseFallback = event.type === \'mousedown\';');
    expect(source).toContain('const moveEventNames = usingMouseFallback ? [\'mousemove\'] : [\'pointermove\'];');
    expect(source).toContain('moveEventNames.forEach(name => window.addEventListener(name, handleMove));');
    expect(source).toContain('suppressChatCycleClick.value = true;');
    expect(source).toContain('left: `${chatPosition.value.x}px`');
    expect(source).toContain('top: `${chatPosition.value.y}px`');
  });

  it('uses a compact HUD and quickbar at narrow desktop widths', () => {
    const container = readSource('src/components/layout/GameContainer.vue');
    const hud = readSource('src/components/layout/GameHUD.vue');
    const quickbar = readSource('src/components/hud/Quickbar.vue');

    expect(container).toContain('@media (width > 639px) and (width <= 1100px)');
    expect(container).toContain('--hud-orb-size: clamp(112px, 12vw, 136px);');
    expect(hud).toContain('@media (width <= 1100px)');
    expect(hud).toContain('min-height: clamp(52px, calc(var(--hud-orb-size, 136px) * 0.46), 64px);');
    expect(hud).toContain('background: transparent;');
    expect(hud).toContain('flex: 0 1 auto;');
    expect(container).toContain('grid-template-rows: minmax(0, 1fr);');
    expect(container).toContain('.game-container__hud {\n  position: absolute;');
    // PoE-style rebuild: full fixed bar, corner hotkey, cooldown sweep, and
    // right-click remap (no occluding remap button).
    expect(quickbar).toContain('slotEntries()');
    expect(quickbar).toContain('@media (width <= 1100px)');
    expect(quickbar).toContain('height: 40px;');
    expect(quickbar).toContain('quickbar__slot--empty');
    expect(quickbar).toContain('quickbar__sweep');
    expect(quickbar).toContain('@contextmenu.prevent="$emit(\'request-remap\'');
    expect(quickbar).toContain('flex-basis: 36px;');
    expect(quickbar).toContain('clip: rect(0 0 0 0);');
  });
});
