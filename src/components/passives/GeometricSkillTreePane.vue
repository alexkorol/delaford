<template>
  <div class="geometric-skill-tree">
    <div class="ui-layer">
      <div class="hud-panel stats-panel">
        <h1>Verdigris Tree</h1>

        <div class="point-grid" aria-label="Passive points">
          <div>
            <span>Skill Points</span>
            <strong>{{ treeState.points.skill }}</strong>
          </div>
          <div>
            <span>Nodes</span>
            <strong>{{ treeState.activeNodes }}</strong>
          </div>
          <div>
            <span>Paths</span>
            <strong>{{ treeState.allocatedConduits }}</strong>
          </div>
        </div>

        <label class="sr-only" for="verdigris-search">Search</label>
        <input
          id="verdigris-search"
          v-model="searchTerm"
          class="search-input"
          type="search"
          placeholder="Search"
          @input="onSearchInput"
        >

        <div class="attribute-grid" aria-label="Allocated attributes">
          <span>STR <b>{{ treeState.stats.attrs.STR }}</b></span>
          <span>DEX <b>{{ treeState.stats.attrs.DEX }}</b></span>
          <span>INT <b>{{ treeState.stats.attrs.INT }}</b></span>
        </div>

        <div class="calling-readout" aria-label="Calling and armoury unlocks">
          <b>{{ treeState.stats.characterClass || 'No calling' }}</b>
          <span v-if="treeState.stats.unlocks.length">
            {{ treeState.stats.unlocks.map(flag => flag.replace(/_/g, ' ')).join(' · ') }}
          </span>
          <span v-else>The first class milestone marks your calling.</span>
        </div>

        <div class="derived-grid" aria-label="Derived passive stats">
          <span
            v-for="row in derivedRows"
            :key="row.key"
          >
            <b>{{ row.label }}</b>
            <strong>{{ row.value }}</strong>
          </span>
        </div>

        <div class="delta-list" aria-label="Recent changes">
          <p
            v-for="line in treeState.lastDeltas"
            :key="line"
          >
            {{ line }}
          </p>
        </div>
      </div>

      <div class="hud-panel details-panel">
        <header class="node-header">
          <span>{{ treeState.selectedNode.axisLabel }}</span>
          <strong>{{ treeState.selectedNode.name }}</strong>
          <small>
            Ring {{ treeState.selectedNode.ring }}
            / {{ treeState.selectedNode.type }}
            / Cost {{ treeState.selectedNode.cost }}
          </small>
        </header>

        <div class="tag-row" aria-label="Selected tags">
          <span
            v-for="tag in treeState.selectedNode.tags"
            :key="tag"
          >
            {{ tag }}
          </span>
        </div>

        <ul class="effect-list">
          <li
            v-for="effect in treeState.selectedNode.effects"
            :key="effect"
          >
            {{ effect }}
          </li>
        </ul>

        <div
          v-if="treeState.selectedNode.boostLines.length"
          class="boost-list"
        >
          <strong>Empowered Center</strong>
          <p
            v-for="line in treeState.selectedNode.boostLines"
            :key="line"
          >
            {{ line }}
          </p>
        </div>

        <button
          v-if="treeState.selectedNode.canRefund"
          type="button"
          class="btn danger"
          @click="refundSelectedNode"
        >
          Refund Node
        </button>

        <section class="bonus-panel" aria-label="Geometry bonuses">
          <header>Geometry</header>
          <div
            v-for="bonus in treeState.shapeBonuses"
            :key="bonus.id"
            class="bonus-row"
            :class="{ active: bonus.active }"
          >
            <strong>{{ bonus.name }}</strong>
            <span>{{ bonus.progress }}</span>
          </div>
        </section>

        <section class="log-panel" aria-label="Build log">
          <header>Log</header>
          <p
            v-for="entry in visibleLog"
            :key="entry"
          >
            {{ entry }}
          </p>
        </section>
      </div>

      <div
        v-if="treeState.pendingChoices.length"
        class="hud-panel choice-panel"
      >
        <header>{{ pendingTitle }}</header>
        <button
          v-for="choice in treeState.pendingChoices"
          :key="choice.choiceId"
          type="button"
          class="choice-btn"
          :class="{ current: choice.current }"
          @click="choosePending(choice)"
        >
          <strong>{{ choice.title }}</strong>
          <span>{{ choice.meta }}</span>
        </button>
        <button
          v-if="treeState.pending && treeState.pending.mode === 'conduit'"
          type="button"
          class="choice-btn danger"
          @click="refundPendingConduit"
        >
          <strong>Refund Conduit</strong>
          <span>{{ pendingRefundState }}</span>
        </button>
      </div>

      <div class="hud-panel controls-panel">
        <button
          class="btn"
          type="button"
          @click="undoTree"
        >
          Undo
        </button>
        <button
          class="btn"
          type="button"
          @click="resetTree"
        >
          Reset
        </button>
        <button
          class="btn"
          type="button"
          @click="centerView"
        >
          Center
        </button>
      </div>
    </div>

    <div
      ref="tooltip"
      class="tooltip"
    >
      <div class="tt-header"></div>
      <div class="tt-body"></div>
    </div>

    <div
      ref="canvasContainer"
      class="canvas-container"
    >
      <svg
        ref="mainSvg"
        class="main-svg"
        width="100%"
        height="100%"
      >
        <g ref="viewportGroup">
          <g ref="backgroundLayer"></g>
          <g ref="conduitsLayer"></g>
          <g ref="nodesLayer"></g>
        </g>
      </svg>
    </div>
  </div>
</template>

<script>
import {
  VERDIGRIS_AXIS_META,
  VerdigrisGeometricTree,
  axisColor,
  createDerivedRows,
  edgeKey,
  formatAttrs,
  nodeRadius,
  round,
} from '@/core/passives/verdigris-geometric-tree.js';
import {
  VERDIGRIS_SKILL_TREE_POINTS,
  VERDIGRIS_SKILL_TREE_SOURCES,
  VERDIGRIS_SKILL_TREE_TOTALS,
} from '@/core/passives/verdigris-skill-tree.js';
import Socket from '@/core/utilities/socket.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SEARCH_DIM_OPACITY = '0.18';

// 1 point per level after the first plus server-awarded quest points, capped
// at the lifetime maximum. Quest points arrive top-level on the player;
// older snapshots carried them inside the quests object.
const earnedPointsForPlayer = (player) => {
  // An allocation costs 2 points (node + its path), so grant at least 2 — a
  // fresh character must be able to make their first pick immediately, not
  // stare at a dead pane. From level 2 on it's one point per level, meeting
  // the authored level budget exactly at the cap.
  const fromLevels = Math.min(
    Math.max(2, Math.floor(Number(player?.level) || 1)),
    VERDIGRIS_SKILL_TREE_SOURCES.levels,
  );
  const questPoints = Number(player?.questPoints ?? player?.quests?.questPoints) || 0;
  const fromQuests = Math.min(
    Math.max(0, Math.floor(questPoints)),
    VERDIGRIS_SKILL_TREE_SOURCES.quests,
  );
  return Math.min(VERDIGRIS_SKILL_TREE_POINTS.skill, fromLevels + fromQuests);
};

const makeSvgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      el.setAttribute('class', value);
    } else {
      el.setAttribute(key, value);
    }
  });
  return el;
};

const formatNodeType = value => String(value || '')
  .replace(/-/g, ' ')
  .replace(/\b\w/g, char => char.toUpperCase());

const nodeIcon = node => ({
  origin: 'O',
  notable: '*',
  mastery: 'M',
  waystone: 'W',
  socket: '◇',
  class: 'C',
  sign: '✦',
  gateway: 'G',
  keystone: '!',
}[node.type] || VERDIGRIS_AXIS_META[node.axis]?.short.slice(0, 1) || '+');

const conduitPath = (from, to, option) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const offset = option.side * Math.min(42, Math.max(20, length * 0.34));
  const mid = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };
  const control = {
    x: mid.x + (-dy / length) * offset,
    y: mid.y + (dx / length) * offset,
  };
  return `M ${round(from.x)} ${round(from.y)} Q ${round(control.x)} ${round(control.y)} ${round(to.x)} ${round(to.y)}`;
};

class SVGRenderer {
  constructor(tree, options) {
    this.tree = tree;
    this.layers = options.layers;
    this.tooltipEl = options.tooltipEl;
    this.onChange = options.onChange || (() => {});
    this.cache = { nodes: new Map(), conduits: new Map() };
  }

  draw() {
    Object.values(this.layers).forEach((layer) => {
      layer.innerHTML = '';
    });
    this.cache.nodes.clear();
    this.cache.conduits.clear();
    this.drawBackground();
    this.drawConduits();
    this.drawNodes();
    this.update();
  }

  drawBackground() {
    const length = VERDIGRIS_SKILL_TREE_TOTALS.layers * 88;
    [
      ['INT', { x: 0, y: -length }],
      ['DEX', { x: -length * 0.866, y: length * 0.5 }],
      ['STR', { x: length * 0.866, y: length * 0.5 }],
    ].forEach(([axis, end]) => {
      const group = makeSvgEl('g', { className: 'axis-guide' });
      group.style.setProperty('--axis-color', axisColor(axis));
      group.appendChild(makeSvgEl('line', {
        x1: 0,
        y1: 0,
        x2: end.x,
        y2: end.y,
        className: 'axis-line',
      }));
      const label = makeSvgEl('text', {
        x: end.x,
        y: end.y,
        className: 'axis-label',
      });
      label.textContent = VERDIGRIS_AXIS_META[axis].short;
      group.appendChild(label);
      this.layers.background.appendChild(group);
    });
  }

  drawConduits() {
    this.tree.conduits.forEach((conduit) => {
      const from = this.tree.nodes.get(conduit.fromId);
      const to = this.tree.nodes.get(conduit.toId);
      if (!from || !to) return;

      conduit.options.forEach((option) => {
        const group = makeSvgEl('g', { className: 'conduit-group' });
        const d = conduitPath(from.pos, to.pos, option);
        const hit = makeSvgEl('path', { d, className: 'conduit-hit' });
        const line = makeSvgEl('path', { d, className: 'conduit-path' });

        hit.addEventListener('click', (event) => {
          event.stopPropagation();
          this.tree.handleConduitClick(conduit.id, option.id);
          this.onChange();
        });
        hit.addEventListener('mouseenter', event => this.showConduitTooltip(event, conduit, option));
        hit.addEventListener('mousemove', event => this.placeTooltip(event));
        hit.addEventListener('mouseleave', () => this.hideTooltip());

        group.appendChild(hit);
        group.appendChild(line);
        this.layers.conduits.appendChild(group);
        this.cache.conduits.set(`${conduit.id}|${option.id}`, { line, hit });
      });
    });
  }

  drawNodes() {
    this.tree.nodes.forEach((node) => {
      const group = makeSvgEl('g', {
        transform: `translate(${node.pos.x},${node.pos.y})`,
        className: `node-group type-${node.type}`,
        'data-node-id': node.id,
      });
      group.style.setProperty('--node-axis', axisColor(node.axis));

      const shell = makeSvgEl('circle', { r: nodeRadius(node) + 4, className: 'node-shell' });
      const ring = makeSvgEl('circle', { r: nodeRadius(node) + 8, className: 'node-ring' });
      const core = makeSvgEl('circle', { r: Math.max(4, nodeRadius(node) - 2), className: 'node-core' });
      const icon = makeSvgEl('text', { y: 0, className: 'node-icon' });
      icon.textContent = nodeIcon(node);

      group.appendChild(ring);
      group.appendChild(shell);
      group.appendChild(core);
      group.appendChild(icon);

      group.addEventListener('click', (event) => {
        event.stopPropagation();
        this.tree.handleNodeClick(node.id);
        this.onChange();
      });
      group.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.tree.refundNode(node.id);
        this.onChange();
      });
      group.addEventListener('mouseenter', event => this.showNodeTooltip(event, node));
      group.addEventListener('mousemove', event => this.placeTooltip(event));
      group.addEventListener('mouseleave', () => this.hideTooltip());

      this.layers.nodes.appendChild(group);
      this.cache.nodes.set(node.id, { group, shell, core, ring });
    });
  }

  update() {
    const pendingChoices = new Set(this.tree.pending?.choices || []);
    const searchTerm = this.tree.searchTerm;

    this.tree.conduits.forEach((conduit) => {
      const conduitVisible = this.tree.isConduitVisible(conduit);
      conduit.options.forEach((option) => {
        const cache = this.cache.conduits.get(`${conduit.id}|${option.id}`);
        if (!cache) return;
        const { line, hit } = cache;
        line.style.display = conduitVisible ? '' : 'none';
        hit.style.display = conduitVisible ? '' : 'none';
        line.setAttribute('class', 'conduit-path');
        line.style.setProperty('--path-color', option.color);
        line.style.setProperty('--path-depth', conduit.depth);

        const choiceId = this.tree.choiceId(conduit.id, option.id);
        if (conduit.allocatedVariant === option.id) {
          line.classList.add('allocated');
        } else if (conduit.allocated) {
          line.classList.add('swap-option');
        } else if (pendingChoices.has(choiceId)) {
          line.classList.add('pending');
        } else if (this.tree.isAvailableConduit(conduit, option.id)) {
          line.classList.add('available');
        }
      });
    });

    this.tree.nodes.forEach((node) => {
      const cache = this.cache.nodes.get(node.id);
      if (!cache) return;
      const { group, shell, core, ring } = cache;
      group.classList.remove('active', 'available', 'pending', 'selected', 'empowered');
      group.style.display = this.tree.isNodeVisible(node) ? '' : 'none';
      group.style.opacity = this.matchesSearch(node, searchTerm) ? '1' : SEARCH_DIM_OPACITY;

      const empowered = this.tree.empoweredNodes.has(node.id);
      shell.setAttribute('r', nodeRadius(node, empowered) + 4);
      core.setAttribute('r', Math.max(4, nodeRadius(node, empowered) - 2));
      ring.setAttribute('r', nodeRadius(node, empowered) + 8);

      if (node.active) group.classList.add('active');
      if (!node.active && this.tree.isAvailableNode(node)) group.classList.add('available');
      if (this.tree.pending?.mode === 'node' && this.tree.pending.nodeId === node.id) group.classList.add('pending');
      if (this.tree.selectedNodeId === node.id) group.classList.add('selected');
      if (empowered) group.classList.add('empowered');
    });
  }

  matchesSearch(node, term) {
    if (!term) return true;
    const haystack = `${node.name} ${node.axis} ${node.type} ${node.tags.join(' ')} ${node.effects.join(' ')}`.toLowerCase();
    return haystack.includes(term);
  }

  showNodeTooltip(event, node) {
    if (!this.tooltipEl) return;
    this.tooltipEl.querySelector('.tt-header').innerText = node.name;
    this.tooltipEl.querySelector('.tt-body').innerText = [
      `${formatNodeType(node.type)} / ring ${node.ring} / ${VERDIGRIS_AXIS_META[node.axis]?.label || 'Hybrid'}`,
      ...node.effects,
      `Cost: ${node.cost}`,
    ].join('\n');
    this.tooltipEl.style.setProperty('--tip-axis', axisColor(node.axis));
    this.tooltipEl.style.display = 'block';
    this.placeTooltip(event);
  }

  showConduitTooltip(event, conduit, option) {
    if (!this.tooltipEl) return;
    const state = conduit.allocatedVariant === option.id
      ? 'Allocated'
      : conduit.allocated
        ? 'Alternate'
        : this.tree.isAvailableConduit(conduit, option.id)
          ? 'Available'
          : 'Locked';
    this.tooltipEl.querySelector('.tt-header').innerText = option.name;
    this.tooltipEl.querySelector('.tt-body').innerText = `${state} conduit\n${formatAttrs(option.attrs)}`;
    this.tooltipEl.style.setProperty('--tip-axis', option.color);
    this.tooltipEl.style.display = 'block';
    this.placeTooltip(event);
  }

  placeTooltip(event) {
    if (!this.tooltipEl || this.tooltipEl.style.display !== 'block') return;
    const x = Math.min(Math.max(event.clientX + 16, 12), window.innerWidth - 300);
    const y = Math.min(Math.max(event.clientY + 16, 12), window.innerHeight - 180);
    this.tooltipEl.style.left = `${x}px`;
    this.tooltipEl.style.top = `${y}px`;
  }

  hideTooltip() {
    if (this.tooltipEl) this.tooltipEl.style.display = 'none';
  }
}

class ViewController {
  constructor(options) {
    this.canvas = options.canvas;
    this.svg = options.svg;
    this.group = options.group;
    this.x = 0;
    this.y = 0;
    this.scale = 0.72;
    this.dragging = false;
    this.last = { x: 0, y: 0 };

    this.handlePointerDown = event => this.onPointerDown(event);
    this.handlePointerMove = event => this.onPointerMove(event);
    this.handlePointerUp = event => this.onPointerUp(event);
    this.handleWheel = event => this.onWheel(event);
    this.handleResize = () => this.center();

    this.bind();
    this.center();
    setTimeout(() => this.center(), 80);
  }

  bind() {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('resize', this.handleResize);
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('resize', this.handleResize);
  }

  onPointerDown(event) {
    if (event.target.closest('.node-group') || event.target.classList.contains('conduit-hit')) return;
    this.dragging = true;
    this.canvas.classList.add('dragging');
    this.canvas.setPointerCapture(event.pointerId);
    this.last = { x: event.clientX, y: event.clientY };
  }

  onPointerMove(event) {
    if (!this.dragging) return;
    this.x += event.clientX - this.last.x;
    this.y += event.clientY - this.last.y;
    this.last = { x: event.clientX, y: event.clientY };
    this.transform();
  }

  onPointerUp(event) {
    if (!this.dragging) return;
    this.dragging = false;
    this.canvas.classList.remove('dragging');
    try {
      this.canvas.releasePointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture may already be released by the browser.
    }
  }

  onWheel(event) {
    event.preventDefault();
    const next = this.scale * (event.deltaY > 0 ? 0.92 : 1.08);
    this.scale = Math.min(Math.max(next, 0.24), 2.2);
    this.transform();
  }

  center() {
    const rect = this.svg.getBoundingClientRect();
    this.x = (rect.width || window.innerWidth) / 2;
    this.y = (rect.height || window.innerHeight) / 2 + 10;
    this.transform();
  }

  transform() {
    this.group.setAttribute('transform', `translate(${round(this.x)},${round(this.y)}) scale(${round(this.scale)})`);
  }
}

const initialTreeState = () => ({
  points: {
    skill: 0,
  },
    stats: {
      attrs: { STR: 0, DEX: 0, INT: 0 },
      derived: {},
      characterClass: null,
      unlocks: [],
  },
  selectedNode: {
    id: '0,0',
    name: 'Origin',
    type: 'origin',
    axis: 'HYBRID',
    axisLabel: 'Hybrid',
    cost: 0,
    ring: 0,
    active: true,
    effects: ['Starting point.'],
    tags: ['HYB', 'origin'],
    boostLines: [],
    canRefund: false,
  },
  shapeBonuses: [],
  log: [],
  lastDeltas: [],
  pending: null,
  pendingChoices: [],
  activeNodes: 1,
  allocatedConduits: 0,
  searchTerm: '',
});

export default {
  name: 'GeometricSkillTreePane',
  props: {
    game: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      searchTerm: '',
      treeState: initialTreeState(),
    };
  },
  computed: {
    derivedRows() {
      return createDerivedRows(this.treeState.stats.derived);
    },
    pendingTitle() {
      if (!this.treeState.pending) return '';
      return this.treeState.pending.mode === 'conduit' ? 'Edit Conduit' : 'Choose Conduit';
    },
    pendingRefundState() {
      if (!this.treeState.pending || this.treeState.pending.mode !== 'conduit') return '';
      const conduit = this.skillTree?.conduits.get(this.treeState.pending.conduitId);
      return conduit && this.skillTree.canRefundConduit(conduit.id) ? 'Available' : 'Blocked';
    },
    visibleLog() {
      return this.treeState.log.length ? this.treeState.log : ['Build log empty.'];
    },
  },
  mounted() {
    this.skillTree = new VerdigrisGeometricTree({
      availablePoints: earnedPointsForPlayer(this.game?.player),
    });

    // Restore saved allocations — a fresh tree on every open threw away the
    // player's build the moment the pane closed.
    const saved = this.game?.player?.passiveTree;
    const savedConduits = saved && Array.isArray(saved.conduits) ? saved.conduits : [];
    const hasRealAllocations = saved
      && Array.isArray(saved.nodes)
      && (saved.nodes.some(id => id !== '0,0') || savedConduits.length > 0);
    if (hasRealAllocations) {
      this.skillTree.restore({
        nodes: saved.nodes,
        conduits: savedConduits,
        points: saved.points && typeof saved.points === 'object' ? saved.points : { skill: 0 },
        log: Array.isArray(saved.log) ? saved.log : [],
        selectedNodeId: saved.selectedNodeId,
        classOrder: saved.classOrder,
      });
      // Reconcile points earned since the save: spent stays spent, newly
      // earned points become available. earned may legitimately be 0.
      if (Number.isFinite(saved.earned)) {
        this.skillTree.initialPoints = Math.max(0, saved.earned);
      }
      this.skillTree.setAvailablePoints(earnedPointsForPlayer(this.game?.player));
    }

    this.treeState = this.skillTree.toState();

    this.renderer = new SVGRenderer(this.skillTree, {
      layers: {
        background: this.$refs.backgroundLayer,
        conduits: this.$refs.conduitsLayer,
        nodes: this.$refs.nodesLayer,
      },
      tooltipEl: this.$refs.tooltip,
      onChange: () => this.syncTreeState(),
    });
    this.renderer.draw();

    this.viewController = new ViewController({
      canvas: this.$refs.canvasContainer,
      svg: this.$refs.mainSvg,
      group: this.$refs.viewportGroup,
    });
  },
  beforeUnmount() {
    this.persistTree();
    if (this.viewController) this.viewController.destroy();
  },
  watch: {
    'game.player.level': function watchLevel(level) {
      if (!this.skillTree) return;
      this.skillTree.setAvailablePoints(earnedPointsForPlayer({
        ...this.game?.player,
        level,
      }));
      this.syncTreeState();
    },
    'game.player.quests.questPoints': function watchQuestPoints() {
      if (!this.skillTree) return;
      this.skillTree.setAvailablePoints(earnedPointsForPlayer(this.game?.player));
      this.syncTreeState();
    },
    'game.player.questPoints': function watchTopLevelQuestPoints() {
      if (!this.skillTree) return;
      this.skillTree.setAvailablePoints(earnedPointsForPlayer(this.game?.player));
      this.syncTreeState();
    },
  },
  methods: {
    syncTreeState() {
      if (!this.skillTree) return;
      this.treeState = this.skillTree.toState();
      if (this.renderer) this.renderer.update();
      this.persistTree();
    },
    persistTree() {
      if (!this.skillTree) return;
      const snapshot = this.skillTree.snapshot();
      delete snapshot.log; // build log is cosmetic; don't persist it
      snapshot.earned = this.skillTree.initialPoints;
      // Mirror onto the shared player object so an immediate close/reopen
      // restores even before the server acknowledges. `game` is the live
      // client-state singleton, not parent-owned display data.
      if (this.game && this.game.player) {
        // eslint-disable-next-line vue/no-mutating-props
        this.game.player.passiveTree = snapshot;
        // eslint-disable-next-line vue/no-mutating-props
        this.game.player.passiveTreeStats = this.skillTree.stats;
      }
      Socket.emit('player:skilltree:save', { snapshot });
    },
    onSearchInput() {
      if (!this.skillTree) return;
      this.skillTree.setSearchTerm(this.searchTerm);
      this.syncTreeState();
    },
    choosePending(choice) {
      if (!this.skillTree) return;
      this.skillTree.handleConduitClick(choice.conduitId, choice.optionId);
      this.syncTreeState();
    },
    refundPendingConduit() {
      const conduitId = this.treeState.pending?.conduitId;
      if (!this.skillTree || !conduitId) return;
      this.skillTree.refundConduit(conduitId);
      this.syncTreeState();
    },
    refundSelectedNode() {
      const nodeId = this.treeState.selectedNode?.id;
      if (!this.skillTree || !nodeId) return;
      this.skillTree.refundNode(nodeId);
      this.syncTreeState();
    },
    undoTree() {
      if (!this.skillTree) return;
      this.skillTree.undo();
      this.syncTreeState();
    },
    resetTree() {
      if (!this.skillTree) return;
      this.skillTree.reset();
      this.searchTerm = '';
      this.skillTree.setSearchTerm('');
      this.syncTreeState();
    },
    centerView() {
      if (this.viewController) this.viewController.center();
    },
  },
};
</script>

<style lang="scss">
.geometric-skill-tree {
  --bg-color: #0d0f0e;
  --node-center: #f8efd0;
  --node-inactive: #20241f;
  --node-available: #556147;
  --node-active: #c8aa66;
  --node-pending: #e2c765;
  --path-inactive: rgba(255, 238, 192, 0.08);
  --path-active: #b8954d;
  --path-ghost: rgba(226, 199, 101, 0.62);
  --panel-border: rgba(196, 159, 86, 0.36);

  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 42%, rgba(85, 97, 71, 0.18), transparent 42%),
    radial-gradient(circle at 20% 86%, rgba(184, 149, 77, 0.12), transparent 38%),
    linear-gradient(180deg, #121611, var(--bg-color));
  color: #e9dfc2;
  font-family: 'GameFont', sans-serif;
  user-select: none;

  .ui-layer {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
  }

  .hud-panel {
    position: absolute;
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    background:
      linear-gradient(180deg, rgba(35, 30, 22, 0.96), rgba(14, 13, 10, 0.95)),
      radial-gradient(circle at 50% 0, rgba(200, 170, 102, 0.12), transparent 70%);
    box-shadow:
      inset 0 1px 0 rgba(255, 238, 192, 0.08),
      inset 0 -1px 0 rgba(0, 0, 0, 0.65),
      0 4px 20px rgba(0, 0, 0, 0.8);
    pointer-events: auto;
  }

  .stats-panel {
    top: 16px;
    left: 16px;
    display: grid;
    width: 286px;
    max-height: calc(100% - 32px);
    gap: 12px;
    overflow: auto;
    padding: 14px;
  }

  .details-panel {
    top: 16px;
    right: 16px;
    display: grid;
    width: 320px;
    max-height: calc(100% - 32px);
    gap: 12px;
    overflow: auto;
    padding: 14px;
  }

  .choice-panel {
    right: 352px;
    bottom: 16px;
    display: grid;
    width: min(360px, calc(100% - 384px));
    max-height: 44%;
    gap: 8px;
    overflow: auto;
    padding: 12px;
  }

  .controls-panel {
    right: 16px;
    bottom: 16px;
    display: flex;
    gap: 8px;
    padding: 10px;
  }

  h1,
  header {
    margin: 0;
    color: var(--node-active);
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-shadow: 1px 1px 0 #000;
  }

  h1 {
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(196, 159, 86, 0.24);
    text-align: center;
  }

  .point-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;

    div {
      display: grid;
      gap: 3px;
      padding: 7px;
      border: 1px solid rgba(196, 159, 86, 0.2);
      background: rgba(0, 0, 0, 0.22);
    }

    span {
      color: #9e9479;
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    strong {
      color: #f8efd0;
      font-size: 14px;
    }
  }

  .search-input {
    width: 100%;
    padding: 8px 9px;
    border: 1px solid rgba(196, 159, 86, 0.28);
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.32);
    color: #f8efd0;
    outline: none;
  }

  .search-input:focus {
    border-color: rgba(226, 199, 101, 0.74);
  }

  .attribute-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;

    span {
      display: grid;
      gap: 3px;
      justify-items: center;
      padding: 6px 4px;
      border: 1px solid rgba(196, 159, 86, 0.22);
      background: rgba(0, 0, 0, 0.22);
      color: #8f846b;
      font-size: 10px;
      letter-spacing: 0.08em;
    }

    b {
      color: #f4dc93;
      font-size: 13px;
    }
  }

  .calling-readout {
    display: grid;
    gap: 3px;
    padding: 7px 8px;
    border: 1px solid rgba(196, 159, 86, 0.24);
    background: rgba(0, 0, 0, 0.24);
    color: #9f9478;
    font-size: 9px;
    line-height: 1.35;
    text-transform: capitalize;

    b {
      color: #f1d67f;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
  }

  .derived-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;

    span {
      display: flex;
      min-width: 0;
      justify-content: space-between;
      gap: 6px;
      padding: 5px 6px;
      border: 1px solid rgba(196, 159, 86, 0.18);
      background: rgba(0, 0, 0, 0.18);
      color: #b8ad8f;
      font-size: 11px;
    }

    b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      color: #f1d77b;
      white-space: nowrap;
    }
  }

  .delta-list,
  .log-panel {
    display: grid;
    gap: 6px;
  }

  .delta-list p,
  .log-panel p,
  .boost-list p {
    margin: 0;
    color: rgba(226, 218, 196, 0.76);
    font-size: 11px;
    line-height: 1.45;
  }

  .node-header {
    display: grid;
    gap: 4px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(196, 159, 86, 0.22);

    span {
      color: rgba(133, 178, 191, 0.82);
      font-size: 10px;
    }

    strong {
      color: #fff1c2;
      font-size: 16px;
      line-height: 1.18;
      text-transform: none;
    }

    small {
      color: rgba(239, 229, 203, 0.68);
      font-size: 11px;
      letter-spacing: 0;
      text-transform: none;
    }
  }

  .tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;

    span {
      padding: 3px 6px;
      border: 1px solid rgba(196, 159, 86, 0.22);
      border-radius: 2px;
      background: rgba(0, 0, 0, 0.22);
      color: rgba(235, 226, 203, 0.78);
      font-size: 10px;
    }
  }

  .effect-list {
    display: grid;
    gap: 7px;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      padding-left: 9px;
      border-left: 2px solid rgba(200, 170, 102, 0.34);
      color: #d8c99d;
      font-size: 12px;
      line-height: 1.45;
    }
  }

  .boost-list {
    display: grid;
    gap: 6px;
    padding: 9px;
    border: 1px solid rgba(106, 168, 111, 0.34);
    background: rgba(31, 54, 38, 0.28);

    strong {
      color: #a9d58c;
      font-size: 12px;
    }
  }

  .bonus-panel,
  .log-panel {
    display: grid;
    gap: 7px;
    padding-top: 10px;
    border-top: 1px solid rgba(196, 159, 86, 0.2);
  }

  .bonus-row {
    display: grid;
    gap: 3px;
    padding: 7px;
    border: 1px solid rgba(196, 159, 86, 0.18);
    background: rgba(0, 0, 0, 0.2);
    opacity: 0.58;

    &.active {
      border-color: rgba(122, 190, 128, 0.52);
      background: rgba(37, 64, 42, 0.32);
      opacity: 1;
    }

    strong {
      color: #f1d77b;
      font-size: 12px;
    }

    span {
      color: rgba(226, 218, 196, 0.72);
      font-size: 11px;
    }
  }

  .btn,
  .choice-btn {
    border: 1px solid rgba(196, 159, 86, 0.36);
    background: #1a1710;
    color: #d8c99d;
    cursor: pointer;
    transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
  }

  .btn {
    padding: 8px 14px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .choice-btn {
    display: grid;
    gap: 3px;
    width: 100%;
    padding: 9px 10px;
    text-align: left;

    strong {
      font-size: 12px;
    }

    span {
      color: rgba(216, 201, 157, 0.72);
      font-size: 11px;
    }

    &.current {
      border-color: rgba(122, 190, 128, 0.58);
      background: rgba(34, 58, 39, 0.42);
    }
  }

  .btn:hover,
  .choice-btn:hover {
    border-color: rgba(226, 199, 101, 0.8);
    background: var(--node-active);
    color: #000;
  }

  .btn.danger,
  .choice-btn.danger {
    border-color: rgba(188, 89, 75, 0.56);
    color: #f0a28f;
  }

  .axis-guide {
    color: var(--axis-color);
    opacity: 0.34;
  }

  .axis-line {
    stroke: currentcolor;
    stroke-width: 1.2;
    stroke-dasharray: 10 10;
  }

  .axis-label {
    fill: currentcolor;
    font-size: 12px;
    font-weight: 700;
    paint-order: stroke;
    stroke: rgba(0, 0, 0, 0.85);
    stroke-width: 4px;
    text-anchor: middle;
  }

  .conduit-path {
    fill: none;
    stroke: var(--path-inactive);
    stroke-linecap: round;
    stroke-width: calc(2.2px + var(--path-depth, 0) * 1px);
    opacity: 0.44;
    pointer-events: none;
    transition: stroke 160ms ease, stroke-width 160ms ease, opacity 160ms ease;
  }

  .conduit-path.available {
    stroke: color-mix(in srgb, var(--path-color) 52%, #d9d0bc);
    stroke-dasharray: 7 8;
    opacity: 0.52;
  }

  .conduit-path.pending {
    stroke: var(--path-ghost);
    stroke-width: 4px;
    stroke-dasharray: 6 7;
    opacity: 0.9;
    filter: drop-shadow(0 0 4px rgba(226, 199, 101, 0.45));
  }

  .conduit-path.allocated {
    stroke: var(--path-color);
    stroke-width: calc(4.2px + var(--path-depth, 0) * 1.5px);
    opacity: 1;
    filter: drop-shadow(0 0 5px var(--path-color));
  }

  .conduit-path.swap-option {
    stroke: color-mix(in srgb, var(--path-color) 32%, #847b68);
    stroke-dasharray: 3 10;
    opacity: 0.28;
  }

  .conduit-hit {
    fill: none;
    stroke: transparent;
    stroke-width: 20;
    cursor: pointer;
    pointer-events: stroke;
  }

  .conduit-hit:hover + .conduit-path {
    opacity: 0.9;
    stroke-width: 4.5px;
  }

  .node-group {
    --node-axis: var(--node-active);

    cursor: pointer;
    transition: opacity 160ms ease;
  }

  .node-shell,
  .node-core,
  .node-ring {
    transition: fill 180ms ease, stroke 180ms ease, r 180ms ease, opacity 180ms ease, transform 180ms ease;
    transform-box: fill-box;
    transform-origin: center;
  }

  .node-shell {
    fill: var(--bg-color);
    stroke: var(--node-inactive);
    stroke-width: 2;
  }

  .node-core {
    fill: var(--node-inactive);
    stroke: rgba(0, 0, 0, 0.35);
    stroke-width: 1;
  }

  .node-ring {
    fill: none;
    stroke: transparent;
    stroke-width: 1.4;
  }

  .node-group.available .node-shell {
    stroke: color-mix(in srgb, var(--node-axis) 52%, var(--node-available));
    filter: drop-shadow(0 0 4px rgba(144, 186, 113, 0.34));
  }

  .node-group.available .node-core {
    fill: color-mix(in srgb, var(--node-axis) 36%, var(--node-available));
  }

  .node-group.active .node-shell {
    stroke: var(--node-axis);
  }

  .node-group.active .node-core {
    fill: color-mix(in srgb, var(--node-axis) 72%, var(--node-active));
    filter: drop-shadow(0 0 6px var(--node-axis));
  }

  .node-group.pending .node-shell {
    stroke: var(--node-pending);
    stroke-dasharray: 4 2;
  }

  .node-group.selected .node-ring,
  .node-group.empowered .node-ring {
    stroke: #fff5ce;
    opacity: 0.95;
  }

  .node-group.empowered .node-ring {
    stroke-dasharray: 5 5;
    filter: drop-shadow(0 0 6px var(--node-axis));
    animation: verdigris-ring-spin 5.2s linear infinite;
  }

  .node-group.type-origin .node-core {
    fill: var(--node-center);
    filter: drop-shadow(0 0 10px var(--node-center));
  }

  .node-group.type-keystone .node-shell,
  .node-group.type-sign .node-shell,
  .node-group.type-class .node-shell,
  .node-group.type-waystone .node-shell,
  .node-group.type-gateway .node-shell {
    stroke-width: 3;
  }

  .node-group.type-socket .node-core {
    fill: rgba(7, 8, 10, 0.92);
  }

  .node-group:hover .node-shell {
    transform: scale(1.12);
  }

  .node-icon {
    fill: rgba(255, 245, 216, 0.84);
    font-family: 'GameFont', sans-serif;
    font-size: 8px;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
    text-shadow: 1px 1px 0 #000;
  }

  .tooltip {
    position: absolute;
    z-index: 100;
    display: none;
    min-width: 220px;
    max-width: 286px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--tip-axis, #c8aa66) 52%, rgba(196, 159, 86, 0.4));
    border-radius: 2px;
    background: rgba(12, 11, 9, 0.96);
    pointer-events: none;
    white-space: pre-line;
  }

  .tt-header {
    margin-bottom: 6px;
    color: var(--tip-axis, var(--node-active));
    font-size: 14px;
    font-weight: 700;
  }

  .tt-body {
    color: #c9bea0;
    font-size: 12px;
    line-height: 1.4;
  }

  .canvas-container {
    width: 100%;
    height: 100%;
    cursor: grab;
    touch-action: none;
  }

  .canvas-container.dragging {
    cursor: grabbing;
  }

  .main-svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
}

@keyframes verdigris-ring-spin {
  to {
    stroke-dashoffset: -60;
  }
}

@media (width <= 920px) {
  .geometric-skill-tree {
    .stats-panel,
    .details-panel {
      width: 248px;
    }

    .choice-panel {
      right: 280px;
      width: min(320px, calc(100% - 312px));
    }
  }
}

@media (width <= 720px) {
  .geometric-skill-tree {
    .stats-panel {
      right: 12px;
      left: 12px;
      width: auto;
      max-height: 38%;
    }

    .details-panel {
      top: auto;
      right: 12px;
      bottom: 72px;
      left: 12px;
      width: auto;
      max-height: 34%;
    }

    .choice-panel {
      right: 12px;
      bottom: 72px;
      left: 12px;
      width: auto;
      max-height: 38%;
    }

    .controls-panel {
      right: 12px;
      left: 12px;
      justify-content: flex-end;
    }

    .derived-grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
