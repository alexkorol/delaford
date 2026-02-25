<template>
  <div class="geometric-skill-tree">
    <div class="ui-layer" ref="uiLayer">
      <div class="hud-panel stats-panel">
        <h1>Flower of Life</h1>
        <div class="stat-row">
          <span>Harmony (Nodes)</span>
          <span class="stat-value" ref="nodePointsDisplay">20</span>
        </div>
        <div class="stat-row">
          <span>Flow (Arcs)</span>
          <span class="stat-value" ref="arcPointsDisplay">15</span>
        </div>
        <div class="hud-hints">
          <strong>Left Click Node:</strong> Toggle (Awaken/Refund)<br>
          <strong>Click Ghost Path:</strong> Confirm Choice<br>
          <strong>Click Arcs:</strong> Channel Flow
        </div>
      </div>
      <div class="hud-panel controls-panel">
        <button class="btn" type="button" @click="resetTree">Rebirth</button>
        <button class="btn" type="button" @click="centerView">Center</button>
      </div>
      <div ref="choiceHint" class="choice-hint">Choose a path to connect</div>
    </div>

    <div ref="tooltip" class="tooltip">
      <div class="tt-header"></div>
      <div class="tt-body"></div>
    </div>

    <div ref="canvasContainer" class="canvas-container">
      <svg ref="mainSvg" class="main-svg" width="100%" height="100%">
        <g ref="viewportGroup" id="viewport-group">
          <g ref="arcsLayer"></g>
          <g ref="straightLayer"></g>
          <g ref="nodesLayer"></g>
        </g>
      </svg>
    </div>
  </div>
</template>

<script>
const RADIUS = 80;

class Hex {
  constructor(q, r) {
    this.q = q;
    this.r = r;
  }

  getKey() {
    return `${this.q},${this.r}`;
  }

  toPixel() {
    const x = RADIUS * (this.q + this.r / 2);
    const y = RADIUS * (this.r * Math.sqrt(3) / 2);
    return { x, y };
  }

  static neighbor(hex, i) {
    const dirs = [
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: -1, r: 1 },
      { q: -1, r: 0 },
      { q: 0, r: -1 },
      { q: 1, r: -1 },
    ];
    const d = dirs[i % 6];
    return new Hex(hex.q + d.q, hex.r + d.r);
  }
}

class Node {
  constructor(hex, type = 'small') {
    this.hex = hex;
    this.id = hex.getKey();
    this.type = type;
    this.active = false;
    this.connections = [];
    this.data = { name: 'Cosmic Point', desc: 'A point of power.' };
  }
}

class Connection {
  constructor(nodeA, nodeB) {
    const sorted = [nodeA.id, nodeB.id].sort();
    this.id = `${sorted[0]}:${sorted[1]}`;
    this.fromId = sorted[0];
    this.toId = sorted[1];
    this.straight = false;
    this.curve1 = false;
    this.curve2 = false;
  }
}

class SkillTree {
  constructor(options) {
    const { layers, tooltipEl, choiceHintEl, nodePointsEl, arcPointsEl } = options;
    this.nodes = new Map();
    this.connections = new Map();
    this.points = { nodes: 20, arcs: 15 };
    this.startId = '0,0';
    this.pendingNodeId = null;

    this.choiceHintEl = choiceHintEl;
    this.nodePointsEl = nodePointsEl;
    this.arcPointsEl = arcPointsEl;

    this.generateTree(3);

    this.renderer = new SVGRenderer(this, { layers, tooltipEl });
    this.renderer.draw();
    this.updateUI();
  }

  generateTree(layers) {
    const center = new Hex(0, 0);
    this.addNode(center, 'center');
    this.nodes.get(center.getKey()).active = true;

    for (let l = 1; l <= layers; l += 1) {
      let cursor = new Hex(0, 0);
      for (let k = 0; k < l; k += 1) cursor = Hex.neighbor(cursor, 4);

      for (let i = 0; i < 6; i += 1) {
        for (let j = 0; j < l; j += 1) {
          let type = 'small';
          if (l === layers) type = 'keystone';
          this.addNode(cursor, type);
          this.connectNeighbors(cursor);
          cursor = Hex.neighbor(cursor, i);
        }
      }
    }
  }

  addNode(hex, type) {
    const key = hex.getKey();
    if (!this.nodes.has(key)) this.nodes.set(key, new Node(hex, type));
  }

  connectNeighbors(hex) {
    for (let i = 0; i < 6; i += 1) {
      const nHex = Hex.neighbor(hex, i);
      if (this.nodes.has(nHex.getKey())) {
        const nodeA = this.nodes.get(hex.getKey());
        const nodeB = this.nodes.get(nHex.getKey());
        this.createConnection(nodeA, nodeB);
      }
    }
  }

  createConnection(n1, n2) {
    const conn = new Connection(n1, n2);
    if (!this.connections.has(conn.id)) {
      this.connections.set(conn.id, conn);
      if (!n1.connections.includes(n2.id)) n1.connections.push(n2.id);
      if (!n2.connections.includes(n1.id)) n2.connections.push(n1.id);
    }
  }

  isConnectedToStart(targetId, simulate = {}) {
    if (targetId === this.startId) return true;
    if (simulate.disableNode === targetId) return false;

    const queue = [this.startId];
    const visited = new Set([this.startId]);

    while (queue.length > 0) {
      const currId = queue.shift();
      if (currId === targetId) return true;
      const currNode = this.nodes.get(currId);

      for (const neighborId of currNode.connections) {
        if (visited.has(neighborId)) continue;
        if (neighborId === simulate.disableNode) continue;

        const neighbor = this.nodes.get(neighborId);
        const connId = [currId, neighborId].sort().join(':');
        const conn = this.connections.get(connId);

        const isNodeActive = neighbor.active;
        const isConnActive = conn.straight && simulate.disableStraight !== connId;

        if (isNodeActive && isConnActive) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    return false;
  }

  handleNodeClick(id) {
    const node = this.nodes.get(id);

    if (this.pendingNodeId === id) {
      this.pendingNodeId = null;
      this.refresh();
      return;
    }
    if (this.pendingNodeId) this.pendingNodeId = null;

    if (node.active) {
      this.deactivateNode(id);
      return;
    }

    this.attemptActivateNode(id);
  }

  attemptActivateNode(id) {
    const node = this.nodes.get(id);
    if (this.points.nodes <= 0) {
      alert('Not enough Node Points.');
      return;
    }

    const potentialSources = [];

    for (const nid of node.connections) {
      const n = this.nodes.get(nid);
      if (n.active) {
        const c = this.connections.get([id, nid].sort().join(':'));
        potentialSources.push({ node: n, conn: c });
      }
    }

    if (potentialSources.length === 0) {
      alert('Must be adjacent to an active node.');
      return;
    }

    if (potentialSources.length === 1) {
      this.finalizeActivation(node, potentialSources[0].conn);
    } else {
      this.pendingNodeId = id;
      this.refresh();
      if (this.choiceHintEl) {
        this.choiceHintEl.style.display = 'block';
        setTimeout(() => { if (this.choiceHintEl) this.choiceHintEl.style.display = 'none'; }, 3000);
      }
    }
  }

  confirmPath(connId) {
    const conn = this.connections.get(connId);
    if (!this.pendingNodeId) return;

    const targetNode = this.nodes.get(this.pendingNodeId);

    if (conn.fromId !== this.pendingNodeId && conn.toId !== this.pendingNodeId) return;

    this.finalizeActivation(targetNode, conn);
    this.pendingNodeId = null;
  }

  finalizeActivation(node, conn) {
    const costArc = !conn.straight;

    if (costArc) {
      if (this.points.arcs <= 0) {
        alert('Not enough Flow (Arc Points) to build connection.');
        return;
      }
      conn.straight = true;
      this.points.arcs -= 1;
    }

    node.active = true;
    this.points.nodes -= 1;
    this.refresh();
  }

  deactivateNode(id) {
    if (id === this.startId) return;
    const node = this.nodes.get(id);

    const otherActive = Array.from(this.nodes.values()).filter(n => n.active && n.id !== id);
    for (const other of otherActive) {
      if (!this.isConnectedToStart(other.id, { disableNode: id })) {
        alert('Cannot refund: This node supports other paths.');
        return;
      }
    }

    node.active = false;
    this.points.nodes += 1;

    for (const nid of node.connections) {
      const c = this.connections.get([id, nid].sort().join(':'));
      if (c.straight) {
        c.straight = false;
        this.points.arcs += 1;
        if (c.curve1) {
          c.curve1 = false;
          this.points.arcs += 1;
        }
        if (c.curve2) {
          c.curve2 = false;
          this.points.arcs += 1;
        }
      }
    }

    this.refresh();
  }

  toggleArc(connId, curveIndex) {
    const conn = this.connections.get(connId);
    if (!conn.straight) return;

    const prop = curveIndex === 1 ? 'curve1' : 'curve2';

    if (conn[prop]) {
      conn[prop] = false;
      this.points.arcs += 1;
    } else if (this.points.arcs > 0) {
      conn[prop] = true;
      this.points.arcs -= 1;
    } else {
      alert('Not enough Flow.');
    }
    this.refresh();
  }

  reset() {
    this.pendingNodeId = null;
    this.nodes.forEach((n) => { if (n.id !== this.startId) n.active = false; });
    this.connections.forEach((c) => { c.straight = false; c.curve1 = false; c.curve2 = false; });
    this.points = { nodes: 20, arcs: 15 };
    this.refresh();
  }

  refresh() {
    this.renderer.update();
    this.updateUI();
  }

  updateUI() {
    if (this.nodePointsEl) this.nodePointsEl.innerText = this.points.nodes;
    if (this.arcPointsEl) this.arcPointsEl.innerText = this.points.arcs;
  }
}

class SVGRenderer {
  constructor(tree, options) {
    const { layers, tooltipEl } = options;
    this.tree = tree;
    this.layers = layers;
    this.tooltipEl = tooltipEl;
    this.cache = { nodes: new Map(), straight: new Map(), arcs: new Map() };
  }

  draw() {
    this.tree.connections.forEach((conn) => {
      const n1 = this.tree.nodes.get(conn.fromId);
      const n2 = this.tree.nodes.get(conn.toId);
      const p1 = n1.hex.toPixel();
      const p2 = n2.hex.toPixel();

      const gStraight = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const straightLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      straightLine.setAttribute('x1', p1.x);
      straightLine.setAttribute('y1', p1.y);
      straightLine.setAttribute('x2', p2.x);
      straightLine.setAttribute('y2', p2.y);
      straightLine.setAttribute('class', 'straight-path');

      const straightHit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      straightHit.setAttribute('x1', p1.x);
      straightHit.setAttribute('y1', p1.y);
      straightHit.setAttribute('x2', p2.x);
      straightHit.setAttribute('y2', p2.y);
      straightHit.setAttribute('class', 'hit-area');
      straightHit.onclick = (e) => {
        e.stopPropagation();
        if (this.tree.pendingNodeId) {
          this.tree.confirmPath(conn.id);
        }
      };

      gStraight.appendChild(straightLine);
      gStraight.appendChild(straightHit);
      this.layers.straight.appendChild(gStraight);
      this.cache.straight.set(conn.id, straightLine);

      const gArcs = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const createArc = (sweep, index) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = `M ${p1.x} ${p1.y} A ${RADIUS} ${RADIUS} 0 0 ${sweep} ${p2.x} ${p2.y}`;
        path.setAttribute('d', d);
        path.setAttribute('class', 'curve-path');
        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hit.setAttribute('d', d);
        hit.setAttribute('class', 'hit-area');
        hit.onclick = (e) => { e.stopPropagation(); this.tree.toggleArc(conn.id, index); };
        return { path, hit };
      };
      const c1 = createArc(0, 1);
      const c2 = createArc(1, 2);

      gArcs.appendChild(c1.path);
      gArcs.appendChild(c1.hit);
      gArcs.appendChild(c2.path);
      gArcs.appendChild(c2.hit);
      this.layers.arcs.appendChild(gArcs);
      this.cache.arcs.set(conn.id, { c1: c1.path, c2: c2.path });
    });

    this.tree.nodes.forEach((node) => {
      const pos = node.hex.toPixel();
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
      g.setAttribute('class', `node-group type-${node.type}`);

      g.onclick = (e) => { e.stopPropagation(); this.tree.handleNodeClick(node.id); };
      g.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); this.tree.deactivateNode(node.id); };
      g.onmouseenter = (e) => this.showTooltip(e, node);
      g.onmouseleave = () => this.hideTooltip();

      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bg.setAttribute('r', node.type === 'keystone' ? 12 : 6);
      bg.setAttribute('class', 'node-bg');
      const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      fill.setAttribute('r', node.type === 'keystone' ? 8 : 4);
      fill.setAttribute('class', 'node-fill');

      g.appendChild(bg);
      g.appendChild(fill);
      this.layers.nodes.appendChild(g);
      this.cache.nodes.set(node.id, g);
    });
    this.update();
  }

  update() {
    const pendingId = this.tree.pendingNodeId;

    this.tree.nodes.forEach((node) => {
      const el = this.cache.nodes.get(node.id);
      el.classList.remove('active', 'available', 'pending');

      if (node.active) {
        el.classList.add('active');
      } else if (node.id === pendingId) {
        el.classList.add('pending');
      } else {
        const isAvail = this.tree.points.nodes > 0 && node.connections.some(nid => this.tree.nodes.get(nid).active);
        if (isAvail) el.classList.add('available');
      }
    });

    this.tree.connections.forEach((conn) => {
      const elStraight = this.cache.straight.get(conn.id);
      const elArcs = this.cache.arcs.get(conn.id);

      elStraight.classList.remove('active', 'ghost');
      elArcs.c1.classList.remove('active', 'available');
      elArcs.c2.classList.remove('active', 'available');

      if (conn.straight) {
        elStraight.classList.add('active');
        if (conn.curve1) elArcs.c1.classList.add('active');
        else elArcs.c1.classList.add('available');

        if (conn.curve2) elArcs.c2.classList.add('active');
        else elArcs.c2.classList.add('available');
      } else if (pendingId && (conn.fromId === pendingId || conn.toId === pendingId)) {
        const otherId = conn.fromId === pendingId ? conn.toId : conn.fromId;
        if (this.tree.nodes.get(otherId).active) {
          elStraight.classList.add('ghost');
        }
      }
    });
  }

  showTooltip(e, node) {
    if (!this.tooltipEl) return;
    this.tooltipEl.querySelector('.tt-header').innerText = node.data.name;
    this.tooltipEl.querySelector('.tt-body').innerText = node.data.desc;
    this.tooltipEl.style.display = 'block';
    this.tooltipEl.style.left = `${e.clientX + 15}px`;
    this.tooltipEl.style.top = `${e.clientY + 15}px`;
  }

  hideTooltip() {
    if (this.tooltipEl) this.tooltipEl.style.display = 'none';
  }
}

class ViewController {
  constructor(options) {
    const { canvas, svg, group, tooltipEl } = options;
    this.canvas = canvas;
    this.svg = svg;
    this.group = group;
    this.tooltipEl = tooltipEl;

    this.x = 0;
    this.y = 0;
    this.scale = 0.9;

    this.isDrag = false;
    this.last = { x: 0, y: 0 };

    this.handleMouseMove = (e) => this.onMouseMove(e);
    this.handleMouseUp = () => { this.isDrag = false; };
    this.handleWheel = (e) => this.onWheel(e);
    this.handleResize = () => this.center();

    this.center();
    setTimeout(() => this.center(), 100);
    window.addEventListener('resize', this.handleResize);
    this.events();
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('wheel', this.handleWheel);
    }
  }

  center() {
    const rect = this.svg?.getBoundingClientRect() || {};
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;

    if (w > 0 && h > 0) {
      this.x = w / 2;
      this.y = h / 2;
    }
    this.transform();
  }

  events() {
    if (!this.canvas) return;
    this.handleMouseDown = (e) => {
      if (e.target === this.canvas || e.target.tagName === 'svg') {
        this.isDrag = true;
        this.last = { x: e.clientX, y: e.clientY };
      }
    };

    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  onMouseMove(e) {
    if (this.isDrag) {
      this.x += e.clientX - this.last.x;
      this.y += e.clientY - this.last.y;
      this.last = { x: e.clientX, y: e.clientY };
      this.transform();
    }
    if (this.tooltipEl && this.tooltipEl.style.display === 'block') {
      this.tooltipEl.style.left = `${e.clientX + 15}px`;
      this.tooltipEl.style.top = `${e.clientY + 15}px`;
    }
  }

  onWheel(e) {
    e.preventDefault();
    this.scale = Math.min(Math.max(0.2, this.scale + e.deltaY * -0.001), 4);
    this.transform();
  }

  transform() {
    if (this.group) {
      this.group.setAttribute('transform', `translate(${this.x},${this.y}) scale(${this.scale})`);
    }
  }
}

export default {
  name: 'GeometricSkillTreePane',
  props: {
    game: {
      type: Object,
      default: null,
    },
  },
  mounted() {
    this.skillTree = new SkillTree({
      layers: {
        arcs: this.$refs.arcsLayer,
        straight: this.$refs.straightLayer,
        nodes: this.$refs.nodesLayer,
      },
      tooltipEl: this.$refs.tooltip,
      choiceHintEl: this.$refs.choiceHint,
      nodePointsEl: this.$refs.nodePointsDisplay,
      arcPointsEl: this.$refs.arcPointsDisplay,
    });

    this.viewController = new ViewController({
      canvas: this.$refs.canvasContainer,
      svg: this.$refs.mainSvg,
      group: this.$refs.viewportGroup,
      tooltipEl: this.$refs.tooltip,
    });
  },
  beforeUnmount() {
    if (this.viewController) {
      this.viewController.destroy();
    }
  },
  methods: {
    resetTree() {
      if (this.skillTree) this.skillTree.reset();
    },
    centerView() {
      if (this.viewController) this.viewController.center();
    },
  },
};
</script>

<style lang="scss">
  .geometric-skill-tree {
    --bg-color: #0b0d12;
    --node-center: #fff;
  --node-inactive: #1f242e;
  --node-available: #3b4c66;
  --node-active: #d4b483;
  --node-pending: #ffd700;
  --path-inactive: #1a1f29;
  --path-active: #d4b483;
  --path-ghost: rgba(255, 255, 255, 0.4);
  --arc-inactive: rgba(255, 255, 255, 0.05);
  --arc-available: rgba(100, 200, 255, 0.3);
  --arc-active: #ffd700;

  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-color);
  font-family: 'GameFont', sans-serif;
  color: #e0e0e0;
  user-select: none;

  .ui-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
  }

  .hud-panel {
    position: absolute;
    background: rgba(11, 13, 18, 0.95);
    border: 1px solid #333;
    border-radius: 4px;
    padding: 15px;
    pointer-events: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
  }

  .stats-panel {
    top: 20px;
    left: 20px;
    min-width: 220px;
  }

  .controls-panel {
    bottom: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
  }

  h1 {
    margin: 0 0 15px 0;
    font-size: 16px;
    color: var(--node-active);
    text-transform: uppercase;
    letter-spacing: 3px;
    text-align: center;
    border-bottom: 1px solid #333;
    padding-bottom: 10px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;
    color: #888;
  }

  .stat-value {
    font-weight: bold;
    color: #fff;
  }

  .btn {
    background: #1a1f29;
    border: 1px solid #444;
    color: #ccc;
    padding: 8px 20px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .btn:hover {
    background: var(--node-active);
    color: #000;
  }

  .hud-hints {
    margin-top: 15px;
    font-size: 11px;
    color: #666;
    border-top: 1px solid #333;
    padding-top: 10px;
    line-height: 1.6;
  }

  .straight-path {
    fill: none;
    stroke: var(--path-inactive);
    stroke-width: 4;
    stroke-linecap: round;
    transition: all 0.3s;
  }

  .straight-path.active {
    stroke: var(--path-active);
    filter: drop-shadow(0 0 3px var(--path-active));
  }

  .straight-path.ghost {
    stroke: var(--path-ghost);
    stroke-dasharray: 10, 5;
    animation: dash 1s linear infinite;
    cursor: pointer;
  }

  .straight-path.ghost:hover {
    stroke: #fff;
    stroke-width: 6;
  }

  @keyframes dash {
    to {
      stroke-dashoffset: -15;
    }
  }

  .curve-path {
    fill: none;
    stroke: var(--arc-inactive);
    stroke-width: 2;
    transition: all 0.3s;
    pointer-events: stroke;
    cursor: pointer;
  }

  .curve-path.available {
    stroke: var(--arc-available);
    stroke-width: 3;
  }

  .curve-path.available:hover {
    stroke: #fff;
    stroke-width: 4;
  }

  .curve-path.active {
    stroke: var(--arc-active);
    stroke-width: 3;
    filter: drop-shadow(0 0 4px var(--arc-active));
  }

  .hit-area {
    stroke: transparent;
    stroke-width: 20;
    fill: none;
    cursor: pointer;
  }

  .node-group {
    cursor: pointer;
  }

  .node-group circle {
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    transform-origin: center;
    transform-box: fill-box;
  }

  .node-group:hover circle.node-fill {
    transform: scale(1.4);
  }

  .node-bg {
    fill: var(--bg-color);
    stroke: var(--node-inactive);
    stroke-width: 2;
  }

  .node-fill {
    fill: var(--node-inactive);
  }

  .node-group.active .node-fill {
    fill: var(--node-active);
    filter: drop-shadow(0 0 5px var(--node-active));
  }

  .node-group.active .node-bg {
    stroke: var(--node-active);
  }

  .node-group.available .node-bg {
    stroke: var(--node-available);
  }

  .node-group.available .node-fill {
    fill: var(--node-available);
  }

  .node-group.type-center .node-fill {
    fill: var(--node-center);
    filter: drop-shadow(0 0 10px var(--node-center));
  }

  .node-group.pending .node-bg {
    stroke: var(--node-pending);
    stroke-dasharray: 4 2;
  }

  .node-group.pending .node-fill {
    fill: var(--node-pending);
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }

    50% {
      transform: scale(1.2);
      opacity: 0.8;
    }

    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .tooltip {
    position: absolute;
    display: none;
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid #444;
    padding: 12px;
    border-radius: 2px;
    pointer-events: none;
    z-index: 100;
    min-width: 200px;
  }

  .tt-header {
    color: var(--node-active);
    font-weight: bold;
    margin-bottom: 5px;
    font-size: 14px;
  }

  .tt-body {
    color: #aaa;
    font-size: 12px;
    line-height: 1.4;
  }

  .choice-hint {
    position: absolute;
    background: rgba(255, 215, 0, 0.2);
    border: 1px solid #ffd700;
    color: #ffd700;
    padding: 10px;
    border-radius: 4px;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    display: none;
    font-weight: bold;
    z-index: 20;
  }

  .canvas-container {
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  .canvas-container:active {
    cursor: grabbing;
  }

  .main-svg {
    width: 100%;
    height: 100%;
  }
}
</style>
