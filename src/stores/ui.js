import { defineStore } from 'pinia';
import {
  FLOWER_OF_LIFE_DEFAULT_PROGRESS,
  FLOWER_OF_LIFE_NODE_MAP,
  FLOWER_OF_LIFE_DEPENDENT_MAP,
} from '@shared/passives/flower-of-life.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const createFlowerOfLifeState = () => clone(FLOWER_OF_LIFE_DEFAULT_PROGRESS);

export const useUiStore = defineStore('ui', {
  state: () => ({
    account: {
      username: '',
      password: '',
    },
    guestAccount: false,
    rememberMe: false,
    settings: {
      fps: 60,
      soundEffects: true,
    },
    action: {
      label: '',
      object: '',
    },
    passives: {
      flowerOfLife: createFlowerOfLifeState(),
    },
  }),
  getters: {
    flowerOfLifeState: (state) => {
      if (!state.passives.flowerOfLife) {
        state.passives.flowerOfLife = createFlowerOfLifeState();
      }
      return state.passives.flowerOfLife;
    },
    flowerOfLifeAllocated: (state) => {
      if (!state.passives.flowerOfLife) {
        state.passives.flowerOfLife = createFlowerOfLifeState();
      }
      return state.passives.flowerOfLife.allocatedNodes;
    },
  },
  actions: {
    setAction(payload) {
      this.action = {
        label: payload.label,
        object: payload.object,
      };
    },
    setGuestAccount(payload) {
      this.guestAccount = payload;
    },
    setRememberMe(payload) {
      this.rememberMe = Boolean(payload);
      if (!this.rememberMe) {
        this.account = { username: '', password: '' };
      }
    },
    rememberAccountUsername(payload = {}) {
      if (!this.account || typeof this.account !== 'object') {
        this.account = { username: '', password: '' };
      }

      this.account = {
        username: this.rememberMe ? (payload.username || '') : '',
        password: '',
      };
    },
    setSettings(payload = {}) {
      this.settings = {
        fps: Number(payload.fps) || 60,
        soundEffects: payload.soundEffects !== false,
      };
    },
    ensureFlowerState() {
      if (!this.passives.flowerOfLife) {
        this.passives.flowerOfLife = createFlowerOfLifeState();
      }
      return this.passives.flowerOfLife;
    },
    resetFlowerOfLife(timestamp = Date.now()) {
      this.passives.flowerOfLife = {
        ...createFlowerOfLifeState(),
        lastResetAt: timestamp,
      };
    },
    allocateFlowerNode({ nodeId }) {
      if (!nodeId || !FLOWER_OF_LIFE_NODE_MAP[nodeId]) {
        return false;
      }
      const flower = this.ensureFlowerState();
      if (flower.allocatedNodes.includes(nodeId)) {
        return false;
      }
      const node = FLOWER_OF_LIFE_NODE_MAP[nodeId];
      if (Array.isArray(node.requires)) {
        const missing = node.requires.some((req) => !flower.allocatedNodes.includes(req));
        if (missing) {
          return false;
        }
      }
      flower.allocatedNodes.push(nodeId);
      return true;
    },
    refundFlowerNode({ nodeId }) {
      const flower = this.ensureFlowerState();
      if (!nodeId || !flower.allocatedNodes.includes(nodeId)) {
        return false;
      }
      const dependents = FLOWER_OF_LIFE_DEPENDENT_MAP[nodeId] || [];
      if (dependents.some((dep) => flower.allocatedNodes.includes(dep))) {
        return false;
      }
      flower.allocatedNodes = flower.allocatedNodes.filter((id) => id !== nodeId);
      return true;
    },
    setFlowerManualMilestone({ gateId, value }) {
      const flower = this.ensureFlowerState();
      if (!flower.manualMilestones) {
        flower.manualMilestones = {};
      }
      flower.manualMilestones[gateId] = Boolean(value);
    },
  },
  persist: {
    paths: ['account', 'guestAccount', 'rememberMe', 'settings', 'passives.flowerOfLife'],
  },
});
