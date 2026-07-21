import terrainTileset from '../assets/tiles/terrain.png';
import objectsTileset from '../assets/tiles/objects.png';
import dungeonTileset from '../assets/tiles/dungeon.png';

import monsterImage from '../assets/graphics/actors/monsters.png';
import npcImage from '../assets/graphics/actors/npcs.png';
import playerImage from '../assets/graphics/actors/players/human.png';
import weaponsImage from '../assets/graphics/items/weapons.png';
import armorImage from '../assets/graphics/items/armor.png';
import jewelryImage from '../assets/graphics/items/jewelry.png';
import generalImage from '../assets/graphics/items/general.png';

import bus from './utilities/bus.js';

import Socket from './utilities/socket.js';
import MovementController from './utilities/movement-controller.js';
import SpriteAnimator from './utilities/sprite-animator.js';
import { PLAYER_SPRITE_CONFIG } from './config/animation.js';
import { DEFAULT_FACING_DIRECTION, DEFAULT_SKILL_IDS } from '@shared/combat.js';
import { getSkillExecutionProfile } from '@shared/skills/index.js';
import { createCharacterState, syncShortcuts } from '@shared/stats/index.js';
import {
  PLAYER_MOVE_SAMPLE_MS,
  directionVector,
  occupiedTile,
  playerMovementDelta,
  roundPosition,
} from '@shared/movement.js';
import { now } from './config/movement.js';

import Map from './map.js';

const resolveFacingDirection = (direction, fallback = DEFAULT_FACING_DIRECTION) => {
  if (!direction) {
    return fallback;
  }

  const mapping = {
    'up-right': 'right',
    'down-right': 'right',
    'up-left': 'left',
    'down-left': 'left',
  };

  const normalised = mapping[direction] || direction;
  if (['up', 'down', 'left', 'right'].includes(normalised)) {
    return normalised;
  }

  return fallback;
};

class Client {
  constructor(data) {
    // The map payload received from server
    this.map = data.map;
    this.background = data.map.background;
    this.foreground = data.map.foreground;

    // Entities on map
    const playerData = { ...data.player };
    playerData.inventory = playerData.inventory.slots;
    playerData.movement = new MovementController().initialise(playerData.x, playerData.y);
    playerData.animation = playerData.animation
      || this.createInitialAnimation({
        direction: resolveFacingDirection(
          playerData.animation && playerData.animation.direction,
        ),
      });
    playerData.animationController = new SpriteAnimator(PLAYER_SPRITE_CONFIG);
    playerData.animationController.applyServerState(playerData.animation);

    const attributeSources = playerData.stats && playerData.stats.attributes
      ? playerData.stats.attributes.sources
      : playerData.attributes;
    const resourceOverrides = playerData.stats && playerData.stats.resources
      ? playerData.stats.resources
      : {
        health: playerData.hp || playerData.health || {},
        mana: playerData.mana || playerData.mp || {},
      };
    const lifecycle = playerData.stats && playerData.stats.lifecycle
      ? playerData.stats.lifecycle
      : playerData.lifecycle || {};

    const statsState = createCharacterState({
      level: playerData.level,
      attributes: attributeSources || {},
      resources: resourceOverrides || {},
      lifecycle,
    });

    syncShortcuts(statsState, playerData);

    this.player = playerData;
    this.players = [];
    this.droppedItems = data.droppedItems;
    this.npcs = data.npcs;
    this.monsters = data.monsters || [];
    this.sceneId = (data.scene && data.scene.id) || data.sceneId || null;
    this.sceneName = (data.scene && data.scene.name) || '';
    this.sceneMetadata = data.scene && data.scene.metadata ? data.scene.metadata : {};
    this.cachedImages = null;

    // Tell client to draw mouse on canvas
    bus.$on('DRAW:MOUSE', ({ x, y }) => {
      if (this.map && typeof this.map.setMouseCoordinates === 'function') {
        this.map.setMouseCoordinates(x, y);
      }
    });
  }

  /**
   * Build the local Map based on data from server
   */
  async buildMap() {
    const images = await this.ensureAssets();

    const data = {
      droppedItems: this.droppedItems,
      map: this.map,
      npcs: this.npcs,
      monsters: this.monsters,
      player: this.player,
    };

    this.map = new Map(data, images);
    this.monsters = this.map.monsters;
    this.emitMapDimensions();
    return 200;
  }

  /**
   * Start loading assets from server
   */
  async ensureAssets() {
    if (this.cachedImages) {
      return this.cachedImages;
    }

    this.cachedImages = await Promise.all(this.loadAssets());
    return this.cachedImages;
  }

  async start(force = false) {
    if (force) {
      this.cachedImages = await Promise.all(this.loadAssets());
      return this.cachedImages;
    }

    return this.ensureAssets();
  }

  /**
   * Start building the map itself
   */
  async setUp() {
    const images = await this.ensureAssets();
    this.map.setImages(images);
    this.map.setPlayer(this.player);
    this.map.setNPCs(this.npcs);
    this.map.setMonsters(this.monsters);
    this.map.setDroppedItems(this.droppedItems);
  }

  async loadScene(scenePayload, playerState = {}) {
    if (!scenePayload || !scenePayload.map) {
      return;
    }

    if (playerState && typeof playerState.x === 'number') {
      this.player.x = playerState.x;
    }
    if (playerState && typeof playerState.y === 'number') {
      this.player.y = playerState.y;
    }
    if (playerState && typeof playerState.sceneId === 'string') {
      this.sceneId = playerState.sceneId;
    }

    this.sceneName = scenePayload.name || this.sceneName || '';

    if (scenePayload.metadata) {
      this.sceneMetadata = scenePayload.metadata;
    }

    this.droppedItems = scenePayload.droppedItems || [];
    this.npcs = scenePayload.npcs || [];
    this.monsters = scenePayload.monsters || [];

    if (!this.player.movement) {
      this.player.movement = new MovementController().initialise(this.player.x, this.player.y);
    } else if (typeof this.player.movement.hardSync === 'function') {
      this.player.movement.hardSync(this.player.x, this.player.y);
    }

    // Scene changed: any client-side movement predictions belong to the old
    // map. A stale queue here jammed at the 6-entry cap and ate all WASD
    // input after entering or leaving an instance.
    this.resetOptimisticMovement();

    this.players = [];

    const images = await this.ensureAssets();

    if (this.map && typeof this.map.destroy === 'function') {
      this.map.destroy();
    }

    const data = {
      droppedItems: this.droppedItems,
      map: scenePayload.map,
      npcs: this.npcs,
      monsters: this.monsters,
      player: this.player,
    };

    this.map = new Map(data, images);
    this.background = scenePayload.map.background;
    this.foreground = scenePayload.map.foreground;
    this.monsters = this.map.monsters;
    this.emitMapDimensions();
  }

  /**
 * Load assets by passing them through
 * a new instance of Image() and resolve the array
 *
 * @return {array}
 */
  loadAssets() {
    const assets = [
      playerImage,
      npcImage,
      objectsTileset,
      terrainTileset,
      weaponsImage,
      armorImage,
      jewelryImage,
      generalImage,
      dungeonTileset,
      monsterImage,
    ];

    const images = Object.values(assets).map((asset) => this.constructor.uploadImage(asset));

    return images;
  }

  emitMapDimensions() {
    if (!this.map || !this.map.config) {
      return;
    }

    const mapConfig = this.map.config?.map || null;
    const tileConfig = mapConfig?.tileset?.tile || { width: 32, height: 32 };
    const viewportConfig = mapConfig?.viewport || { x: 24, y: 15 };

    const calculatedWidth = (tileConfig.width || 0) * (viewportConfig.x || 0);
    const calculatedHeight = (tileConfig.height || 0) * (viewportConfig.y || 0);

    const fallbackWidth = 32 * 24;
    const fallbackHeight = 32 * 15;

    const width = calculatedWidth || fallbackWidth;
    const height = calculatedHeight || fallbackHeight;
    const scale = Number.isFinite(this.map.scale) ? this.map.scale : 1;

    bus.$emit('game:map:dimensions', {
      width,
      height,
      scale,
      displayWidth: width * scale,
      displayHeight: height * scale,
    });
  }

  /**
   * New up an Image() and sets the source to image
   *
   * @param {string} path The path of the asset
   */
  static uploadImage(path) {
    const asset = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(403);
      image.src = path;
    });

    return asset;
  }

  createInitialAnimation(overrides = {}) {
    const defaultDirection = PLAYER_SPRITE_CONFIG.defaultDirection || DEFAULT_FACING_DIRECTION;
    return {
      state: overrides.state || PLAYER_SPRITE_CONFIG.defaultState || 'idle',
      direction: resolveFacingDirection(overrides.direction, defaultDirection),
      sequence: Number.isFinite(overrides.sequence) ? overrides.sequence : 0,
      startedAt: Number.isFinite(overrides.startedAt) ? overrides.startedAt : now(),
      duration: Number.isFinite(overrides.duration) ? overrides.duration : 0,
      speed: Number.isFinite(overrides.speed) ? overrides.speed : 1,
      skillId: overrides.skillId || null,
      holdState: overrides.holdState || null,
    };
  }

  ensureAnimationController(actor) {
    if (!actor) {
      return null;
    }

    if (!actor.animation) {
      actor.animation = this.createInitialAnimation();
    }

    if (!actor.animationController || !(actor.animationController instanceof SpriteAnimator)) {
      actor.animationController = new SpriteAnimator(PLAYER_SPRITE_CONFIG);
    }

    actor.animationController.applyServerState(actor.animation);
    return actor.animationController;
  }

  resolveFacing(direction, fallback = DEFAULT_FACING_DIRECTION) {
    return resolveFacingDirection(direction, fallback);
  }

  updateActorAnimation(actor, animation, options = {}) {
    if (!actor) {
      return;
    }

    const controller = this.ensureAnimationController(actor);
    if (!controller) {
      return;
    }

    if (!animation) {
      if (options.forceSync) {
        actor.animation = { ...controller.toJSON() };
      }
      return;
    }

    const payload = { ...animation };
    payload.direction = this.resolveFacing(
      payload.direction || (actor.animation && actor.animation.direction),
      this.resolveFacing(null),
    );

    const applied = controller.applyServerState(payload);
    if (applied !== false || options.forceSync) {
      actor.animation = { ...controller.toJSON() };
    }
  }

  setLocalAnimation(state, options = {}) {
    const actor = options.actor || this.getOptimisticActor();
    if (!actor) {
      return;
    }

    const controller = this.ensureAnimationController(actor);
    if (!controller) {
      return;
    }

    const direction = this.resolveFacing(
      options.direction || (actor.animation && actor.animation.direction),
    );

    controller.setState(state, {
      direction,
      duration: options.duration,
      speed: options.speed,
      skillId: options.skillId,
      local: true,
    });

    actor.animation = { ...controller.toJSON() };
  }

  setLocalIdle(direction = null) {
    const actor = this.getOptimisticActor();
    if (!actor) {
      return;
    }

    const facing = this.resolveFacing(direction || (actor.animation && actor.animation.direction));
    this.setLocalAnimation('idle', { actor, direction: facing });
  }

  getFacingDirection(actor = this.getOptimisticActor()) {
    if (actor && actor.animation && actor.animation.direction) {
      return actor.animation.direction;
    }
    return this.resolveFacing(null);
  }

  getOptimisticActor() {
    if (this.map && this.map.player) {
      return this.map.player;
    }
    return this.player;
  }

  move(direction, options = {}) {
    if (!direction || !this.player) {
      return;
    }

    const payload = {
      id: this.player.uuid,
      direction,
    };

    Socket.emit('player:move', payload);

    if (this.findLivingMonsterAtStep(direction)) {
      this.resetOptimisticMovement();
      const profile = getSkillExecutionProfile(DEFAULT_SKILL_IDS.primary) || {};
      this.setLocalAnimation(profile.animationState || 'attack', {
        direction,
        skillId: DEFAULT_SKILL_IDS.primary,
        duration: profile.duration,
      });
      return;
    }

    if (options.optimistic === false) {
      return;
    }

    this.applyOptimisticMovement(direction);
  }

  stopMoving() {
    if (!this.player) {
      return;
    }

    Socket.emit('player:move', {
      id: this.player.uuid,
      stopped: true,
    });
    this.setLocalIdle();
  }

  findLivingMonsterAtStep(direction) {
    const delta = directionVector(direction);
    const actor = this.getOptimisticActor();
    if (!delta || !actor || !Array.isArray(this.monsters)) {
      return null;
    }

    const basePosition = Array.isArray(actor.optimisticQueue) && actor.optimisticQueue.length > 0
      ? actor.optimisticQueue[actor.optimisticQueue.length - 1]
      : actor.optimisticPosition || { x: actor.x, y: actor.y };

    const baseTile = occupiedTile(basePosition);
    const targetX = baseTile.x + delta.x;
    const targetY = baseTile.y + delta.y;

    return this.monsters.find((monster) => {
      // Monsters glide at float positions; they occupy the tile they round
      // to. Exact equality here made the client predict a step ONTO an
      // occupied tile, and the server's rejection snapped the player back —
      // the jarring "bump" on monster contact.
      if (!monster
        || Math.round(monster.x) !== targetX
        || Math.round(monster.y) !== targetY) {
        return false;
      }

      const health = monster.stats && monster.stats.resources
        ? monster.stats.resources.health
        : null;
      return !health || health.current > 0;
    }) || null;
  }

  applyOptimisticMovement(direction) {
    const delta = playerMovementDelta(direction);
    if (!delta) {
      return;
    }

    const actor = this.getOptimisticActor();
    if (!actor) {
      return;
    }

    if (!actor.movement) {
      actor.movement = new MovementController().initialise(actor.x, actor.y);
      if (this.map && this.map.player === actor) {
        this.map.player.movement = actor.movement;
      }
    }

    if (!Array.isArray(actor.optimisticQueue)) {
      actor.optimisticQueue = [];
    }

    const basePosition = actor.optimisticQueue.length > 0
      ? actor.optimisticQueue[actor.optimisticQueue.length - 1]
      : actor.optimisticPosition || { x: actor.x, y: actor.y };

    const baseX = typeof basePosition.x === 'number' ? basePosition.x : actor.x;
    const baseY = typeof basePosition.y === 'number' ? basePosition.y : actor.y;

    const targetX = roundPosition(baseX + delta.x);
    const targetY = roundPosition(baseY + delta.y);

    const facing = this.resolveFacing(direction, this.getFacingDirection(actor));

    const step = {
      x: targetX,
      y: targetY,
      direction,
      duration: PLAYER_MOVE_SAMPLE_MS,
      issuedAt: now(),
      started: false,
    };

    actor.optimisticQueue.push(step);
    actor.optimisticPosition = { x: targetX, y: targetY };
    actor.optimisticTarget = { x: targetX, y: targetY };
    actor.optimisticFacing = facing;

    this.setLocalAnimation('run', { actor, direction: facing, duration: step.duration });

    this.startNextOptimisticStep(actor);
  }

  startNextOptimisticStep(actor = this.getOptimisticActor()) {
    const subject = actor;

    if (!subject || !subject.movement) {
      return;
    }

    if (!Array.isArray(subject.optimisticQueue) || subject.optimisticQueue.length === 0) {
      return;
    }

    const controller = subject.movement;
    if (controller.isMoving()) {
      return;
    }

    const step = subject.optimisticQueue[0];
    if (step.started) {
      return;
    }
    controller.startMove(step.x, step.y, { duration: step.duration });
    step.started = true;
  }

  advanceOptimisticMovement() {
    const actor = this.getOptimisticActor();
    if (!actor || !actor.movement) {
      return;
    }

    if (actor.optimisticScheduler) {
      clearTimeout(actor.optimisticScheduler);
      actor.optimisticScheduler = null;
    }

    if (!Array.isArray(actor.optimisticQueue) || actor.optimisticQueue.length === 0) {
      this.setLocalIdle();
      return;
    }

    const controller = actor.movement;

    if (!controller.isMoving()) {
      this.startNextOptimisticStep(actor);
    }

    const activeStep = actor.optimisticQueue[0];
    if (activeStep && !activeStep.started && !controller.isMoving()) {
      this.startNextOptimisticStep(actor);
    }

    if (controller.isMoving() && activeStep && activeStep.started) {
      const delay = Math.max(16, Math.max(0, (controller.lastUpdate + controller.eta) - now()));
      actor.optimisticScheduler = setTimeout(() => {
        actor.optimisticScheduler = null;
        this.advanceOptimisticMovement();
      }, delay);
    } else if (!controller.isMoving()) {
      this.setLocalIdle(actor.optimisticFacing || this.getFacingDirection(actor));
    }
  }

  resetOptimisticMovement() {
    const actor = this.getOptimisticActor();
    if (!actor) {
      return;
    }

    if (actor.optimisticScheduler) {
      clearTimeout(actor.optimisticScheduler);
      actor.optimisticScheduler = null;
    }

    actor.optimisticQueue = [];
    actor.optimisticPosition = { x: actor.x, y: actor.y };
    actor.optimisticTarget = null;
    actor.optimisticFacing = null;

    if (actor.movement && typeof actor.movement.hardSync === 'function') {
      actor.movement.hardSync(actor.x, actor.y);
    }

    this.setLocalIdle();
  }
}

export default Client;
