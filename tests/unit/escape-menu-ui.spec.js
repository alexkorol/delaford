/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = relativePath => readFileSync(
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
  'utf8',
);

describe('Escape game menu', () => {
  it('provides a complete navigation surface instead of an empty close action', () => {
    const menu = readSource('src/components/ui/panes/EscapeMenu.vue');

    expect(menu).toContain('Game Menu');
    expect(menu).toContain('Resume');
    expect(menu).toContain('data-pane-autofocus');
    expect(menu).toContain('this.$refs.resumeButton.focus()');
    expect(menu).toContain("{ pane: 'stats', label: 'Character', hotkey: 'C' }");
    expect(menu).toContain("{ pane: 'inventory', label: 'Inventory', hotkey: 'I' }");
    expect(menu).toContain("{ pane: 'quests', label: 'Quests', hotkey: 'J' }");
    expect(menu).toContain("{ pane: 'flowerOfLife', label: 'Skill Tree', hotkey: 'P' }");
    expect(menu).toContain("{ pane: 'settings', label: 'Settings', hotkey: '' }");
    expect(menu).toContain("$emit('open-pane', 'logout')");
  });

  it('opens on Escape only after higher-priority panels have closed', () => {
    const delaford = readSource('src/Delaford.vue');

    expect(delaford).toContain("escapeMenu: { component: EscapeMenu, title: 'Verdigris' }");
    expect(delaford).toContain("if (this.layout.activePane === 'escapeMenu')");
    expect(delaford).toContain("this.openPane('escapeMenu');");
    expect(delaford).toContain("element.querySelector('[data-pane-autofocus]')");
    expect(delaford).toContain('window.requestAnimationFrame(() => this.focusActivePane())');
    expect(delaford).toContain('this.requestPane(paneHotkeys[key]);');
    expect(delaford).toContain("j: 'quests'");
    expect(delaford).not.toContain("q: 'quests'");
    expect(delaford.indexOf("if (this.layout.activePane)"))
      .toBeLessThan(delaford.indexOf("this.openPane('escapeMenu');"));
  });
});
