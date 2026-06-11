<template>
  <div class="flower-pane">
    <div class="flower-pane__tree">
      <div class="flower-pane__controls">
        <input
          v-model.trim="searchQuery"
          type="search"
          class="flower-pane__search-input"
          placeholder="Search skill tree nodes or effects..."
          aria-label="Search skill tree nodes"
        >
        <div class="flower-pane__filters">
          <label
            v-for="type in nodeTypes"
            :key="type"
            class="flower-pane__filter"
          >
            <input
              type="checkbox"
              :checked="typeFilters[type]"
              @change="toggleTypeFilter(type, $event.target.checked)"
            >
            <span>{{ formatNodeType(type) }}</span>
          </label>
        </div>
        <ul
          v-if="searchActive && searchResults.length"
          class="flower-pane__search-results"
        >
          <li
            v-for="node in searchResults"
            :key="node.id"
          >
            <button
              type="button"
              :class="{
                'flower-pane__search-result': true,
                'flower-pane__search-result--allocated': node.allocated,
                'flower-pane__search-result--available': node.available,
              }"
              @click="handleSelect(node.id)"
            >
              <span class="flower-pane__search-result-label">{{ node.label }}</span>
              <span class="flower-pane__search-result-summary">{{ node.summary }}</span>
            </button>
          </li>
        </ul>
        <p
          v-else-if="searchActive"
          class="flower-pane__search-empty"
        >No nodes match your filters.</p>
      </div>
      <div class="flower-pane__tree-visual">
        <FlowerOfLifeTree
          :view-box="layout.viewBox"
          :nodes="renderNodes"
          :connections="renderConnections"
          :selected-id="selectedNodeId"
          :petal-guides="petalGuides"
          @select="handleSelect"
        />
      </div>
    </div>

    <aside class="flower-pane__sidebar">
      <section class="flower-pane__summary">
        <header>Petal Ledger</header>
        <div class="flower-pane__petal-meter">
          <span class="flower-pane__petal-count">
            <strong>{{ spentPetals }}</strong>
            <span class="flower-pane__petal-label">spent</span>
          </span>
          <span class="flower-pane__petal-separator">/</span>
          <span class="flower-pane__petal-count">
            <strong>{{ petalSummary.total }}</strong>
            <span class="flower-pane__petal-label">earned</span>
          </span>
        </div>
        <p class="flower-pane__petal-available">
          {{ availablePetals }} petal{{ availablePetals === 1 ? '' : 's' }} available
        </p>
      </section>

      <section class="flower-pane__milestones">
        <header>Milestones</header>
        <ul>
          <li
            v-for="gate in petalGates"
            :key="gate.id"
            :class="{
              'flower-pane__milestone': true,
              'flower-pane__milestone--complete': gate.evaluation.achieved,
            }"
          >
            <div class="flower-pane__milestone-header">
              <span class="flower-pane__milestone-title">{{ gate.label }}</span>
              <span class="flower-pane__milestone-status">
                {{ gate.evaluation.achieved ? 'Claimed' : 'Locked' }}
              </span>
            </div>
            <p class="flower-pane__milestone-description">{{ gate.description }}</p>
            <div class="flower-pane__milestone-footer">
              <span class="flower-pane__milestone-reward">+{{ gate.reward }} petal</span>
              <template v-if="gate.evaluation.type === 'level'">
                <span class="flower-pane__milestone-meta">
                  Level {{ gate.evaluation.currentLevel || 1 }} / {{ gate.evaluation.requiredLevel }}
                </span>
              </template>
              <template v-else-if="gate.supportsManual">
                <label class="flower-pane__milestone-toggle">
                  <input
                    type="checkbox"
                    :checked="gate.manualValue"
                    @change="toggleManualGate(gate, $event.target.checked)"
                  >
                  <span>Mark complete</span>
                </label>
              </template>
              <template v-else-if="gate.evaluation.reason">
                <span class="flower-pane__milestone-meta">{{ gate.evaluation.reason }}</span>
              </template>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-if="selectedNode"
        class="flower-pane__details"
      >
        <header class="flower-pane__details-header">
          <div>
            <h3>{{ selectedNode.label }}</h3>
            <p class="flower-pane__details-summary">{{ selectedNode.summary }}</p>
          </div>
          <span class="flower-pane__details-cost">
            Cost: {{ selectedNode.cost }} petal{{ selectedNode.cost === 1 ? '' : 's' }}
          </span>
        </header>
        <p class="flower-pane__details-description">{{ selectedNode.description }}</p>
        <ul class="flower-pane__details-rewards">
          <li
            v-for="reward in selectedNode.rewards"
            :key="reward"
          >{{ reward }}</li>
        </ul>

        <div class="flower-pane__requirements">
          <h4>Requirements</h4>
          <ul>
            <li
              v-for="requirement in selectedNode.gateStates"
              :key="requirement.id"
              :class="{
                'flower-pane__requirement': true,
                'flower-pane__requirement--met': requirement.achieved,
              }"
            >
              <span class="flower-pane__requirement-label">{{ formatRequirement(requirement) }}</span>
            </li>
            <li
              v-if="selectedNode.requires && selectedNode.requires.length"
              :class="{
                'flower-pane__requirement': true,
                'flower-pane__requirement--met': selectedNode.prerequisitesMet,
              }"
            >
              <span class="flower-pane__requirement-label">
                Requires: {{ selectedNode.requires.map(id => nodeLabels[id] || id).join(', ') }}
              </span>
            </li>
          </ul>
        </div>

        <div
          v-if="selectedNode.blockedReason && !selectedNode.allocated"
          class="flower-pane__hint"
        >
          {{ selectedNode.blockedReason }}
        </div>

        <div
          v-if="!canRefundSelected && selectedNode.allocated && nodeDependents.length"
          class="flower-pane__hint flower-pane__hint--warning"
        >
          Remove dependent nodes first: {{ nodeDependents.map(node => node.label).join(', ') }}
        </div>

        <div
          v-if="actionFeedback"
          :class="[
            'flower-pane__feedback',
            `flower-pane__feedback--${actionFeedbackType}`,
          ]"
        >
          {{ actionFeedback }}
        </div>

        <div class="flower-pane__actions">
          <button
            type="button"
            class="flower-pane__action"
            :disabled="!canAllocateSelected"
            @click="allocateSelected"
          >
            Allocate
          </button>
          <button
            type="button"
            class="flower-pane__action"
            :disabled="!canRefundSelected"
            @click="refundSelected"
          >
            Refund
          </button>
        </div>
      </section>

      <footer class="flower-pane__footer">
        <button
          type="button"
          class="flower-pane__reset"
          :disabled="!canReset"
          @click="resetTree"
        >
          Reset Skill Tree
        </button>
      </footer>
    </aside>
  </div>
</template>

<script>
import { mapActions, mapStores } from 'pinia';
import FlowerOfLifeTree from './FlowerOfLifeTree.vue';
import { useUiStore } from '@/stores/ui.js';
import {
  FLOWER_OF_LIFE_LAYOUT,
  FLOWER_OF_LIFE_NODES,
  FLOWER_OF_LIFE_CONNECTIONS,
  FLOWER_OF_LIFE_NODE_MAP,
  FLOWER_OF_LIFE_DEPENDENT_MAP,
  FLOWER_OF_LIFE_PETAL_GATES,
  FLOWER_OF_LIFE_DEFAULT_PROGRESS,
  computeAvailablePetalCount,
  evaluateGate,
  sumAllocatedCost,
} from '@shared/passives/flower-of-life.js';

export default {
  name: 'FlowerOfLifePane',
  components: {
    FlowerOfLifeTree,
  },
  props: {
    game: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      selectedNodeId: 'heart-of-bloom',
      layout: FLOWER_OF_LIFE_LAYOUT,
      searchQuery: '',
      typeFilters: {
        keystone: true,
        major: true,
        notable: true,
        minor: true,
      },
      actionFeedback: '',
      actionFeedbackType: 'info',
      feedbackTimeoutId: null,
    };
  },
  computed: {
    ...mapStores(useUiStore),
    player() {
      return this.game && this.game.player ? this.game.player : {};
    },
    flowerProgress() {
      return this.uiStore?.flowerOfLifeState || FLOWER_OF_LIFE_DEFAULT_PROGRESS;
    },
    allocatedSet() {
      return new Set(this.flowerProgress.allocatedNodes || []);
    },
    petalSummary() {
      return computeAvailablePetalCount(this.player, this.flowerProgress);
    },
    spentPetals() {
      return sumAllocatedCost(this.flowerProgress.allocatedNodes || []);
    },
    availablePetals() {
      return Math.max(0, this.petalSummary.total - this.spentPetals);
    },
    nodeTypes() {
      return ['keystone', 'major', 'notable', 'minor'];
    },
    activeTypeFilters() {
      return this.nodeTypes.filter(type => this.typeFilters[type]);
    },
    filterSignature() {
      return this.activeTypeFilters.slice().sort().join('|');
    },
    searchActive() {
      return this.searchQuery.trim().length > 0;
    },
    filterActive() {
      const active = this.activeTypeFilters.length;
      return active > 0 && active < this.nodeTypes.length;
    },
    renderNodes() {
      const query = this.searchQuery.trim().toLowerCase();
      const searchActive = query.length > 0;
      const activeTypes = new Set(this.activeTypeFilters);
      const filterActive = this.filterActive;
      const hasFilterContext = searchActive || filterActive;

      return FLOWER_OF_LIFE_NODES.map((node) => {
        const angle = (node.angle || 0) * (Math.PI / 180);
        const radius = (node.ring || 0) * this.layout.ringSpacing;
        const x = this.layout.center + (radius * Math.cos(angle));
        const y = this.layout.center - (radius * Math.sin(angle));
        const displayRadius = this.layout.radii[node.type] || this.layout.radii.default;
        const allocated = this.allocatedSet.has(node.id);
        const cost = Math.max(0, Number(node.cost) || 0);
        const gateStates = (node.gates || []).map(gate => evaluateGate(gate, {
          player: this.player,
          progress: this.flowerProgress,
        }));
        const gatesSatisfied = gateStates.every(state => state.achieved);
        const prerequisitesMet = (node.requires || []).every(req => this.allocatedSet.has(req));
        const hasPetals = this.availablePetals >= cost;
        const available = !allocated && prerequisitesMet && gatesSatisfied && hasPetals;
        const locked = !allocated && (!prerequisitesMet || !gatesSatisfied);
        const unmetGate = gateStates.find(state => !state.achieved);
        let blockedReason = null;
        if (!prerequisitesMet) {
          blockedReason = 'Allocate prerequisite nodes first.';
        } else if (unmetGate && !unmetGate.achieved) {
          blockedReason = unmetGate.reason;
        } else if (!allocated && !hasPetals) {
          blockedReason = 'Earn additional petals to allocate this node.';
        }

        const searchableText = [node.label, node.summary, node.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const matchesQuery = !searchActive || searchableText.includes(query);
        const matchesType = !filterActive || activeTypes.has(node.type);
        const matches = matchesQuery && matchesType;
        const searchIndex = searchActive && matchesQuery ? searchableText.indexOf(query) : -1;
        const highlighted = matches && hasFilterContext;
        const dimmed = hasFilterContext && !matches;
        const shortLabel = node.label.replace(/^Petal of\s+/i, '').replace(/^Bloom\s+/i, '').trim() || node.label;

        return {
          ...node,
          x,
          y,
          displayRadius,
          allocated,
          available,
          locked,
          gateStates,
          prerequisitesMet,
          blockedReason,
          insufficientPetals: !allocated && prerequisitesMet && gatesSatisfied && !hasPetals,
          cost,
          shortLabel,
          highlighted,
          dimmed,
          searchMatch: matches && searchActive,
          searchRank: searchIndex >= 0 ? searchIndex : Number.MAX_SAFE_INTEGER,
        };
      });
    },
    renderNodesMap() {
      return this.renderNodes.reduce((acc, node) => {
        acc[node.id] = node;
        return acc;
      }, {});
    },
    renderConnections() {
      return FLOWER_OF_LIFE_CONNECTIONS.map((connection) => {
        const from = this.renderNodesMap[connection.from];
        const to = this.renderNodesMap[connection.to];
        if (!from || !to) {
          return null;
        }
        const active = from.allocated && to.allocated;
        const reachable = (from.allocated || from.available) && (to.allocated || to.available);
        return {
          ...connection,
          from,
          to,
          active,
          reachable,
          dimmed: from.dimmed && to.dimmed,
          highlighted: (!from.dimmed || !to.dimmed) && (from.highlighted || to.highlighted),
        };
      }).filter(Boolean);
    },
    searchResults() {
      if (!this.searchActive) {
        return [];
      }

      return this.renderNodes
        .filter(node => node.searchMatch)
        .sort((a, b) => {
          if (a.searchRank !== b.searchRank) {
            return a.searchRank - b.searchRank;
          }
          if (a.type !== b.type) {
            return this.nodeTypes.indexOf(a.type) - this.nodeTypes.indexOf(b.type);
          }
          return a.label.localeCompare(b.label);
        })
        .slice(0, 8);
    },
    selectedNode() {
      if (this.renderNodesMap[this.selectedNodeId]) {
        return this.renderNodesMap[this.selectedNodeId];
      }
      return this.renderNodes[0] || null;
    },
    nodeLabels() {
      return Object.keys(FLOWER_OF_LIFE_NODE_MAP).reduce((acc, key) => {
        const node = FLOWER_OF_LIFE_NODE_MAP[key];
        acc[key] = node && node.label ? node.label : key;
        return acc;
      }, {});
    },
    nodeDependents() {
      if (!this.selectedNode) {
        return [];
      }
      const dependents = FLOWER_OF_LIFE_DEPENDENT_MAP[this.selectedNode.id] || [];
      return dependents
        .filter(id => this.allocatedSet.has(id))
        .map(id => FLOWER_OF_LIFE_NODE_MAP[id])
        .filter(Boolean);
    },
    canAllocateSelected() {
      const node = this.selectedNode;
      if (!node) {
        return false;
      }
      return node.available;
    },
    canRefundSelected() {
      const node = this.selectedNode;
      if (!node || !node.allocated) {
        return false;
      }
      const dependents = FLOWER_OF_LIFE_DEPENDENT_MAP[node.id] || [];
      return dependents.every(id => !this.allocatedSet.has(id));
    },
    canReset() {
      return (this.flowerProgress.allocatedNodes || []).length > 0;
    },
    petalGates() {
      return FLOWER_OF_LIFE_PETAL_GATES.map((gate) => {
        const evaluation = evaluateGate(gate, {
          player: this.player,
          progress: this.flowerProgress,
        });
        const manualValue = Boolean(this.flowerProgress.manualMilestones && this.flowerProgress.manualMilestones[gate.id]);
        return {
          ...gate,
          evaluation,
          supportsManual: evaluation.manual,
          manualValue,
        };
      });
    },
    petalGuides() {
      const center = this.layout.center || (this.layout.viewBox / 2);
      const radius = this.layout.guideRadius || (this.layout.ringSpacing * 2.2);
      const spokes = [0, 60, 120, 180, 240, 300];
      const guides = spokes.map((angle) => {
        const radians = (angle * Math.PI) / 180;
        return {
          x: center + (radius * Math.cos(radians)),
          y: center - (radius * Math.sin(radians)),
          r: radius,
        };
      });
      guides.unshift({ x: center, y: center, r: radius });
      return guides;
    },
  },
  watch: {
    searchQuery() {
      this.focusFirstMatch();
    },
    filterSignature() {
      this.focusFirstMatch();
    },
  },
  beforeUnmount() {
    this.clearFeedbackTimeout();
  },
  methods: {
    ...mapActions(useUiStore, [
      'allocateFlowerNode',
      'refundFlowerNode',
      'resetFlowerOfLife',
      'setFlowerManualMilestone',
    ]),
    toggleTypeFilter(type, checked) {
      const next = { ...this.typeFilters, [type]: checked };
      const active = this.nodeTypes.filter(key => next[key]);
      if (active.length === 0) {
        this.nodeTypes.forEach((key) => {
          next[key] = true;
        });
      }
      this.typeFilters = next;
    },
    formatNodeType(type) {
      switch (type) {
        case 'keystone':
          return 'Keystone';
        case 'major':
          return 'Major';
        case 'notable':
          return 'Notable';
        case 'minor':
          return 'Minor';
        default:
          return type.charAt(0).toUpperCase() + type.slice(1);
      }
    },
    focusFirstMatch() {
      const current = this.renderNodesMap[this.selectedNodeId];
      if (current && !current.dimmed) {
        return;
      }
      const first = this.renderNodes.find(node => !node.dimmed);
      if (first) {
        this.selectedNodeId = first.id;
      }
    },
    clearFeedbackTimeout() {
      if (this.feedbackTimeoutId) {
        clearTimeout(this.feedbackTimeoutId);
        this.feedbackTimeoutId = null;
      }
    },
    setFeedback(message, type = 'info') {
      this.clearFeedbackTimeout();
      this.actionFeedback = message;
      this.actionFeedbackType = type;
      this.feedbackTimeoutId = setTimeout(() => {
        this.actionFeedback = '';
        this.actionFeedbackType = 'info';
        this.feedbackTimeoutId = null;
      }, 4000);
    },
    formatRequirement(requirement) {
      if (!requirement) {
        return '';
      }
      if (!requirement.achieved && requirement.reason) {
        return requirement.reason;
      }
      if (requirement.type === 'level' && requirement.requiredLevel) {
        return `Level ${requirement.requiredLevel}+`;
      }
      if (requirement.type === 'quest') {
        return 'Quest complete';
      }
      if (requirement.type === 'manual') {
        return 'Marked complete';
      }
      return 'Unlocked';
    },
    handleSelect(nodeId) {
      if (nodeId) {
        this.selectedNodeId = nodeId;
      }
    },
    allocateSelected() {
      if (!this.selectedNode) {
        this.setFeedback('Select a node to allocate.', 'warning');
        return;
      }

      if (!this.canAllocateSelected) {
        const reason = this.selectedNode.blockedReason || 'Requirements not met.';
        const type = this.selectedNode.insufficientPetals ? 'warning' : 'error';
        this.setFeedback(`Cannot allocate ${this.selectedNode.label}: ${reason}`, type);
        return;
      }

      const success = this.allocateFlowerNode({ nodeId: this.selectedNode.id });
      if (success) {
        this.setFeedback(`Allocated ${this.selectedNode.label}.`, 'success');
      } else {
        const reason = this.selectedNode.blockedReason || 'Requirements not met.';
        const type = this.selectedNode.insufficientPetals ? 'warning' : 'error';
        this.setFeedback(`Cannot allocate ${this.selectedNode.label}: ${reason}`, type);
      }
    },
    refundSelected() {
      if (!this.selectedNode) {
        this.setFeedback('Select a node to refund.', 'warning');
        return;
      }

      if (!this.canRefundSelected) {
        const reason = this.selectedNode.allocated
          ? 'Remove dependent nodes first.'
          : 'Node is not allocated.';
        this.setFeedback(`Cannot refund ${this.selectedNode.label}: ${reason}`, 'error');
        return;
      }

      const success = this.refundFlowerNode({ nodeId: this.selectedNode.id });
      if (success) {
        this.setFeedback(`Refunded ${this.selectedNode.label}.`, 'success');
      } else {
        this.setFeedback(`Cannot refund ${this.selectedNode.label}.`, 'error');
      }
    },
    resetTree() {
      if (!this.canReset) {
        this.setFeedback('No allocated petals to reset.', 'warning');
        return;
      }
      this.resetFlowerOfLife();
      this.selectedNodeId = 'heart-of-bloom';
      this.setFeedback('Skill tree reset. All petals refunded.', 'success');
      this.focusFirstMatch();
    },
    toggleManualGate(gate, value) {
      this.setFlowerManualMilestone({ gateId: gate.id, value });
    },
  },
};
</script>

<style lang="scss" scoped>
.flower-pane {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
  gap: 1.5rem;
  color: #f5f5f5;
}

.flower-pane__tree {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.flower-pane__controls {
  background: rgba(12, 12, 24, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.flower-pane__search-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: #f5f5f5;
  font-size: 0.9rem;
}

.flower-pane__search-input:focus {
  outline: none;
  border-color: #ffd54f;
  box-shadow: 0 0 0 2px rgba(255, 213, 79, 0.2);
}

.flower-pane__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.8rem;
}

.flower-pane__filter {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: rgba(255, 255, 255, 0.8);
}

.flower-pane__filter input {
  accent-color: #ffd54f;
}

.flower-pane__search-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 180px;
  overflow-y: auto;
}

.flower-pane__search-result {
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.flower-pane__search-result:hover {
  background: rgba(255, 255, 255, 0.08);
}

.flower-pane__search-result--allocated {
  border-color: rgba(255, 167, 38, 0.6);
}

.flower-pane__search-result--available {
  border-color: rgba(139, 195, 74, 0.6);
}

.flower-pane__search-result-label {
  font-weight: 600;
  font-size: 0.85rem;
}

.flower-pane__search-result-summary {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.75);
}

.flower-pane__search-empty {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
}

.flower-pane__tree-visual {
  flex: 1;
  min-height: 0;
  display: flex;
}

.flower-pane__tree-visual > * {
  flex: 1;
}

.flower-pane__sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  font-family: "GameFont", sans-serif;
}

.flower-pane__summary,
.flower-pane__milestones,
.flower-pane__details,
.flower-pane__footer {
  background: rgba(12, 12, 24, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

.flower-pane__summary header,
.flower-pane__milestones header,
.flower-pane__details-header h3 {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  color: #ffe082;
}

.flower-pane__petal-meter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
}

.flower-pane__petal-count {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.flower-pane__petal-count strong {
  font-size: 1.6rem;
  color: #ffd54f;
}

.flower-pane__petal-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  opacity: 0.75;
}

.flower-pane__petal-separator {
  font-size: 1.2rem;
  opacity: 0.6;
}

.flower-pane__petal-available {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.75);
}

.flower-pane__milestones ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.flower-pane__milestone {
  padding: 0.75rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.flower-pane__milestone--complete {
  border-color: rgba(139, 195, 74, 0.6);
  background: rgba(139, 195, 74, 0.1);
}

.flower-pane__milestone-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.85rem;
}

.flower-pane__milestone-title {
  font-weight: 600;
}

.flower-pane__milestone-status {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.6);
}

.flower-pane__milestone-description {
  margin: 0.25rem 0 0.5rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
}

.flower-pane__milestone-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
}

.flower-pane__milestone-reward {
  color: #ffd54f;
  font-weight: 600;
}

.flower-pane__milestone-meta {
  color: rgba(255, 255, 255, 0.6);
}

.flower-pane__milestone-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  font-size: 0.75rem;
}

.flower-pane__milestone-toggle input {
  accent-color: #ffd54f;
}

.flower-pane__details-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.flower-pane__details-summary {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
}

.flower-pane__details-cost {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
}

.flower-pane__details-description {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.75);
  margin: 0.75rem 0;
}

.flower-pane__details-rewards {
  list-style: disc;
  margin: 0 0 0 1.25rem;
  padding: 0;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.85);
}

.flower-pane__requirements h4 {
  margin: 1rem 0 0.5rem;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.7);
}

.flower-pane__requirements ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.flower-pane__requirement {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.flower-pane__requirement--met {
  color: #8bc34a;
}

.flower-pane__hint {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.75);
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.flower-pane__hint--warning {
  color: #ffab91;
  background: rgba(255, 171, 145, 0.1);
}

.flower-pane__feedback {
  margin-top: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.05);
  border-left: 4px solid #ffd54f;
  color: rgba(255, 255, 255, 0.85);
}

.flower-pane__feedback--success {
  border-color: #8bc34a;
  background: rgba(139, 195, 74, 0.15);
}

.flower-pane__feedback--error {
  border-color: #ef5350;
  background: rgba(239, 83, 80, 0.15);
}

.flower-pane__feedback--warning {
  border-color: #ffb74d;
  background: rgba(255, 183, 77, 0.15);
  color: rgba(255, 244, 214, 0.9);
}

.flower-pane__actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.75rem;
}

.flower-pane__action {
  flex: 1;
  padding: 0.6rem 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, rgba(255, 215, 64, 0.9), rgba(255, 171, 64, 0.9));
  color: #1a1a1a;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.flower-pane__action:disabled {
  cursor: not-allowed;
  filter: grayscale(0.7);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.flower-pane__action:not(:disabled):hover {
  transform: translateY(-1px);
}

.flower-pane__footer {
  display: flex;
  justify-content: flex-end;
}

.flower-pane__reset {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.flower-pane__reset:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.flower-pane__reset:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.15);
}

@media (width <= 1024px) {
  .flower-pane {
    grid-template-columns: 1fr;
  }

  .flower-pane__tree {
    max-width: 480px;
    margin: 0 auto;
  }
}
</style>
