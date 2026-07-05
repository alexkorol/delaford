import PF from 'pathfinding';
import UI from '@shared/ui.js';
import config from '@server/config.js';
import blockedMouse from '@/assets/graphics/ui/mouse/blocked.png';
import moveToMouse from '@/assets/graphics/ui/mouse/moveTo.png';
import bus from './utilities/bus.js';
import MovementController, { centerOfTile } from './utilities/movement-controller.js';
import SpriteAnimator from './utilities/sprite-animator.js';
import { PLAYER_SPRITE_CONFIG } from './config/animation.js';
import { now } from './config/movement.js';

const INITIAL_VIEWPORT = {
  x: config.map.viewport.x,
  y: config.map.viewport.y,
};
const INITIAL_CENTER = {
  x: Math.floor(INITIAL_VIEWPORT.x / 2),
  y: Math.floor(INITIAL_VIEWPORT.y / 2),
};

class Map {
  constructor(data, images) {
    this.foreground = data.map.foreground;
    this.background = data.map.background;

    this.images = [];
    this.npcs = [];
    this.monsters = [];
    this.config = config;
    this.defaultViewport = { ...INITIAL_VIEWPORT };
    this.defaultCenter = { ...INITIAL_CENTER };
    this.viewportOverride = null;
    this.minViewport = { x: 5, y: 4 };

    this.droppedItems = [];
    this.players = [];
    this.player = null;

    // Transient combat feedback (floating damage numbers, hit flashes)
    this.combatFeedback = [];

    this.path = {
      grid: null, // a 0/1 grid of blocked tiles
      finder: new PF.DijkstraFinder({
        diagonalMovement: PF.DiagonalMovement.IfAtMostOneObstacle,
      }),
      current: {
        name: '',
        length: 0, // Number of steps in current path
        path: {
          walking: [], // Current path walking
          set: [], // Current path from last walk-loop
        },
        step: 0, // Steps player has taken to walk
        walkable: false, // Did we click on a blocked tile?
        interrupted: false, // Did we click-to-walk elsewhere while walking current loop?
      },
    };

    // Mouse type and coordinates
    this.mouse = {
      x: null,
      y: null,
      type: null,
      selection: new Image(),
    };

    // Canvas
    this.scale = 2;
    this.canvas = document.querySelector('.main-canvas');
    this.context = this.canvas.getContext('2d');
    this.bufferCanvas = document.createElement('canvas');
    this.bufferContext = this.bufferCanvas.getContext('2d');
    this.resizeRaf = null;
    this.configureCanvas = this.configureCanvas.bind(this);
    this.handleResize = this.handleResize.bind(this);

    this.delta = {
      elapsed: 0,
    };

    this.camera = {
      offsetX: 0,
      offsetY: 0,
    };

    // Setup map
    this.setImages(images);
    this.setPlayer(data.player);
    this.setNPCs(data.npcs);
    this.setMonsters(data.monsters);
    this.setDroppedItems(data.droppedItems);
  }

  ensureAnimation(actor) {
    if (!actor) {
      return null;
    }

    if (!actor.animation) {
      actor.animation = {
        state: PLAYER_SPRITE_CONFIG.defaultState || 'idle',
        direction: PLAYER_SPRITE_CONFIG.defaultDirection || 'down',
        sequence: 0,
        startedAt: now(),
        duration: 0,
        speed: 1,
        skillId: null,
        holdState: null,
      };
    }

    if (!actor.animationController || !(actor.animationController instanceof SpriteAnimator)) {
      actor.animationController = new SpriteAnimator(PLAYER_SPRITE_CONFIG);
    }

    actor.animationController.applyServerState(actor.animation);
    return actor.animationController;
  }

  getViewportMetrics() {
    const { viewport, tileset } = this.config.map;
    return {
      viewport,
      tileSize: tileset.tile.width,
      tileCrop: {
        x: this.player.x - Math.floor(0.5 * viewport.x),
        y: this.player.y - Math.floor(0.5 * viewport.y),
      },
    };
  }

  worldToScreen(position, metrics = null) {
    const viewportMetrics = metrics || this.getViewportMetrics();
    const { tileSize, tileCrop } = viewportMetrics;

    return {
      x: Math.round(position.x - (tileCrop.x * tileSize) - this.camera.offsetX),
      y: Math.round(position.y - (tileCrop.y * tileSize) - this.camera.offsetY),
    };
  }

  isWithinViewport(entity, metrics = null, padding = 1) {
    if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) {
      return false;
    }

    const viewportMetrics = metrics || this.getViewportMetrics();
    const { viewport, tileCrop } = viewportMetrics;
    const minX = tileCrop.x - padding;
    const maxX = tileCrop.x + viewport.x + padding;
    const minY = tileCrop.y - padding;
    const maxY = tileCrop.y + viewport.y + padding;

    return entity.x >= minX
      && entity.x <= maxX
      && entity.y >= minY
      && entity.y <= maxY;
  }

  update(deltaSeconds) {
    this.delta.elapsed += deltaSeconds;

    const { tileset } = this.config.map;
    const tileSize = tileset.tile.width;

    if (this.player && this.player.movement) {
      const renderPosition = this.player.movement.update({ deltaSeconds });
      const tileCenter = centerOfTile(this.player.x, this.player.y, tileSize);

      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
      const offsetX = clamp(renderPosition.x - tileCenter.x, -tileSize, tileSize);
      const offsetY = clamp(renderPosition.y - tileCenter.y, -tileSize, tileSize);

      this.camera.offsetX = offsetX;
      this.camera.offsetY = offsetY;

      if (this.player.animationController) {
        this.player.animationController.update(deltaSeconds);
        this.player.animation = { ...this.player.animationController.toJSON() };
      } else {
        this.ensureAnimation(this.player);
      }
    } else {
      this.camera.offsetX = 0;
      this.camera.offsetY = 0;
    }

    if (Array.isArray(this.players)) {
      this.players.forEach((player) => {
        if (player.movement) {
          player.movement.update({ deltaSeconds });
        }

        if (player.animationController) {
          player.animationController.update(deltaSeconds);
          player.animation = { ...player.animationController.toJSON() };
        } else {
          this.ensureAnimation(player);
        }
      });
    }

    if (Array.isArray(this.npcs)) {
      this.npcs.forEach((npc) => {
        if (npc.movement) {
          npc.movement.update({ deltaSeconds });
        }

        if (npc.animationController) {
          npc.animationController.update(deltaSeconds);
          npc.animation = { ...npc.animationController.toJSON() };
        } else {
          this.ensureAnimation(npc);
        }
      });
    }

    if (Array.isArray(this.monsters)) {
      this.monsters.forEach((monster) => {
        if (monster.movement) {
          monster.movement.update({ deltaSeconds });
        }

        if (monster.animationController) {
          monster.animationController.update(deltaSeconds);
          monster.animation = { ...monster.animationController.toJSON() };
        } else {
          this.ensureAnimation(monster);
        }
      });
    }
  }

  /**
   * Set the player
   *
   * @param {object} player The player themselves
   */
  setPlayer(player, meta = {}) {
    const existing = this.player || null;
    const controller = existing && existing.movement
      ? existing.movement
      : new MovementController().initialise(player.x, player.y);

    const step = player.movementStep || null;
    if (step) {
      controller.applyServerStep(player.x, player.y, step, {
        sentAt: meta.sentAt || null,
        receivedAt: now(),
      });
    } else {
      controller.hardSync(player.x, player.y);
    }

    const animator = player.animationController
      || (existing && existing.animationController)
      || null;

    this.player = {
      ...(existing || {}),
      ...player,
      movement: controller,
      animationController: animator,
    };

    this.ensureAnimation(this.player);
  }

  /**
   * The NPCs of the map
   *
   * @param {object} npcs The world NPCS
   */
  setNPCs(npcs, meta = {}) {
    const existing = new window.Map(
      this.npcs
        .map((npc) => {
          const key = npc && (npc.uuid || npc.id);
          if (!key) {
            return null;
          }
          return [key, npc];
        })
        .filter((entry) => entry !== null),
    );

    const movementEntries = Array.isArray(meta.movements) ? meta.movements : [];
    const movementLookup = new window.Map(
      movementEntries
        .map((entry) => {
          const key = entry && (entry.uuid || entry.id);
          if (!key) {
            return null;
          }
          return [key, entry.movementStep || null];
        })
        .filter((entry) => entry !== null),
    );

    const animationEntries = Array.isArray(meta.animations) ? meta.animations : [];
    const animationLookup = new window.Map(
      animationEntries
        .map((entry) => {
          const key = entry && (entry.uuid || entry.id);
          if (!key) {
            return null;
          }
          return [key, entry.animation || null];
        })
        .filter((entry) => entry !== null),
    );

    this.npcs = (npcs || []).map((npc) => {
      const key = npc && (npc.uuid || npc.id);
      const previous = key ? existing.get(key) : null;
      const controller = previous && previous.movement
        ? previous.movement
        : new MovementController().initialise(npc.x, npc.y);

      const step = npc.movementStep || movementLookup.get(key) || null;
      const animation = npc.animation
        || animationLookup.get(key)
        || (previous && previous.animation)
        || null;

      if (step) {
        controller.applyServerStep(npc.x, npc.y, step, {
          sentAt: meta.sentAt || null,
          receivedAt: now(),
        });
      } else {
        controller.hardSync(npc.x, npc.y);
      }

      const animator = npc.animationController
        || (previous && previous.animationController)
        || null;

      const updated = {
        ...npc,
        movement: controller,
        animationController: animator,
        animation,
      };

      this.ensureAnimation(updated);
      return updated;
    });
  }

  setMonsters(monsters, meta = {}) {
    const existing = new window.Map(
      (this.monsters || [])
        .map((monster) => {
          const key = monster && (monster.uuid || monster.id);
          if (!key) {
            return null;
          }
          return [key, monster];
        })
        .filter((entry) => entry !== null),
    );

    const movementEntries = Array.isArray(meta.movements) ? meta.movements : [];
    const movementLookup = new window.Map(
      movementEntries
        .map((entry) => {
          const key = entry && (entry.uuid || entry.id);
          if (!key) {
            return null;
          }
          return [key, entry.movementStep || null];
        })
        .filter((entry) => entry !== null),
    );

    const animationEntries = Array.isArray(meta.animations) ? meta.animations : [];
    const animationLookup = new window.Map(
      animationEntries
        .map((entry) => {
          const key = entry && (entry.uuid || entry.id);
          if (!key) {
            return null;
          }
          return [key, entry.animation || null];
        })
        .filter((entry) => entry !== null),
    );

    this.monsters = (monsters || []).map((monster) => {
      const key = monster && (monster.uuid || monster.id);
      const previous = key ? existing.get(key) : null;
      const controller = previous && previous.movement
        ? previous.movement
        : new MovementController().initialise(monster.x, monster.y);

      const step = monster.movementStep
        || movementLookup.get(key)
        || null;

      if (step) {
        controller.applyServerStep(monster.x, monster.y, step, {
          sentAt: meta.sentAt || null,
          receivedAt: now(),
        });
      } else {
        controller.hardSync(monster.x, monster.y);
      }

      const animator = previous && previous.animationController
        ? previous.animationController
        : new SpriteAnimator(PLAYER_SPRITE_CONFIG);

      const updated = {
        ...monster,
        movement: controller,
        animationController: animator,
      };

      const animationState = animationLookup.has(key)
        ? animationLookup.get(key)
        : monster.animation || null;

      if (animationState) {
        updated.animation = animationState;
        animator.applyServerState(animationState);
      } else if (updated.animation) {
        animator.applyServerState(updated.animation);
      } else {
        this.ensureAnimation(updated);
      }

      return updated;
    });
  }

  /**
   * Record a combat hit for visual feedback and update the local
   * target health immediately (ahead of the next state broadcast).
   *
   * @param {object} payload The combat:hit event payload
   */
  registerCombatHit(payload = {}) {
    if (!payload || !payload.targetId) {
      return;
    }

    const at = now();

    if (payload.targetType === 'monster') {
      const index = (this.monsters || []).findIndex((monster) => monster.uuid === payload.targetId);
      if (index !== -1) {
        const monster = this.monsters[index];
        if (payload.health && monster.stats && monster.stats.resources) {
          monster.stats.resources.health = {
            ...monster.stats.resources.health,
            ...payload.health,
          };
        }
        monster.lastHitAt = at;
        this.monsters.splice(index, 1, monster);
      }
    } else if (payload.targetType === 'player') {
      // Tint the struck player (self or others) rather than hiding the sprite.
      if (this.player && this.player.uuid === payload.targetId) {
        this.player.lastHitAt = at;
      }
      const index = (this.players || []).findIndex((player) => player.uuid === payload.targetId);
      if (index !== -1) {
        const player = this.players[index];
        player.lastHitAt = at;
        this.players.splice(index, 1, player);
      }
    }

    this.combatFeedback.push({
      targetId: payload.targetId,
      targetType: payload.targetType || 'monster',
      amount: Number.isFinite(payload.amount) ? payload.amount : 0,
      died: Boolean(payload.died),
      startedAt: at,
    });
  }

  /**
   * The items dropped on the map
   *
   * @param {object} items The items dropped on the map
   */
  setDroppedItems(items) {
    this.droppedItems = items;
  }

  /**
   * Set the images that was downloaded
   *
   * @param {Image} images Images of the player and terrain
   */
  setImages(images) {
    let normalized = [];
    if (Array.isArray(images)) {
      normalized = images;
    } else if (images && typeof images === 'object') {
      normalized = Object.values(images);
    }

    if (normalized.length < 8) {
      console.warn('[Map] setImages received unexpected payload; falling back to placeholders.', normalized);
    }

    const fallback = (index) => normalized[index] || new Image();

    const playerImage = fallback(0);
    const npcsImage = fallback(1);
    const objectImage = fallback(2);
    const terrainImage = fallback(3);
    const weaponsImage = fallback(4);
    const armorImage = fallback(5);
    const jewelryImage = fallback(6);
    const generalImage = fallback(7);
    const dungeonImage = fallback(8);
    const monstersImage = normalized[9] || npcsImage;

    // Image and data
    this.images = {
      playerImage,
      npcsImage,
      monstersImage,
      objectImage,
      terrainImage,
      weaponsImage,
      armorImage,
      jewelryImage,
      generalImage,
      dungeonImage,
    };

    // Tell client images are loaded
    bus.$emit('game:images:loaded');

    // Set image and config
    this.build();
  }

  /**
   * Starts to setup board canvas
   *
   * @param {array} board The tile index of the board
   * @param {array} images The image board assets
   */
  build() {
    const terrain = this.images.terrainImage;
    const objects = this.images.objectImage;

    this.config.map.tileset.width = terrain.width;
    this.config.map.tileset.height = terrain.height;

    this.config.map.objects.width = objects.width;
    this.config.map.objects.height = objects.height;

    this.setUpCanvas();
  }

  /**
   * Sets canvas dimensions and constructs it
   */
  setUpCanvas() {
    this.configureCanvas();
    window.removeEventListener('resize', this.handleResize);
    window.addEventListener('resize', this.handleResize, { passive: true });
    this.handleResize();
  }

  getActiveViewport() {
    return this.viewportOverride || this.defaultViewport;
  }

  getCanvasDimensions(viewport = this.getActiveViewport()) {
    const { tileset } = this.config.map;
    const tileWidth = tileset.tile.width;
    const tileHeight = tileset.tile.height;
    const scale = this.scale || 1;
    const nativeWidth = tileWidth * viewport.x;
    const nativeHeight = tileHeight * viewport.y;

    return {
      width: nativeWidth,
      height: nativeHeight,
      displayWidth: nativeWidth * scale,
      displayHeight: nativeHeight * scale,
      scale,
    };
  }

  setViewportDimensions(viewport = {}) {
    const nextX = Number.isFinite(viewport.x) && viewport.x > 0
      ? Math.floor(viewport.x)
      : this.defaultViewport.x;
    const nextY = Number.isFinite(viewport.y) && viewport.y > 0
      ? Math.floor(viewport.y)
      : this.defaultViewport.y;

    this.viewportOverride = {
      x: nextX,
      y: nextY,
    };

    return this.configureCanvas();
  }

  /**
   * Configure the canvas paramters correctly
   */
  configureCanvas() {
    if (!this.canvas || !this.context) {
      return;
    }

    const { tileset } = this.config.map;
    const viewportConfig = this.config.map.viewport;
    const container = this.canvas ? this.canvas.parentElement : null;
    const tileWidth = tileset.tile.width;
    const tileHeight = tileset.tile.height;

    const activeViewport = this.getActiveViewport();
    const viewportX = activeViewport.x;
    const viewportY = activeViewport.y;

    viewportConfig.x = viewportX;
    viewportConfig.y = viewportY;

    this.config.map.player.x = Math.floor(viewportX / 2);
    this.config.map.player.y = Math.floor(viewportY / 2);

    const nativeWidth = tileWidth * viewportX;
    const nativeHeight = tileHeight * viewportY;
    const scale = this.scale || 1;
    const displayWidth = nativeWidth * scale;
    const displayHeight = nativeHeight * scale;

    this.bufferCanvas.width = nativeWidth;
    this.bufferCanvas.height = nativeHeight;

    this.canvas.width = displayWidth;
    this.canvas.height = displayHeight;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.maxWidth = '100%';
    this.canvas.style.maxHeight = '100%';

    if (container) {
      container.style.setProperty('--map-native-width', `${nativeWidth}px`);
      container.style.setProperty('--map-native-height', `${nativeHeight}px`);
      container.style.setProperty('--map-display-width', `${displayWidth}px`);
      container.style.setProperty('--map-display-height', `${displayHeight}px`);
      container.style.setProperty('--map-aspect-ratio', `${nativeWidth} / ${nativeHeight}`);
    }

    this.context.imageSmoothingEnabled = false;
    this.bufferContext.imageSmoothingEnabled = false;

    const dimensions = this.getCanvasDimensions({ x: viewportX, y: viewportY });
    bus.$emit('game:map:dimensions', dimensions);
    return dimensions;
  }

  handleResize() {
    if (this.resizeRaf) {
      window.cancelAnimationFrame(this.resizeRaf);
    }

    this.resizeRaf = window.requestAnimationFrame(() => {
      this.resizeRaf = null;
      this.configureCanvas();
    });
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    if (this.resizeRaf) {
      window.cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = null;
    }
    if (this.canvas) {
      this.canvas.style.width = '';
      this.canvas.style.height = '';
      this.canvas.style.maxWidth = '';
      this.canvas.style.maxHeight = '';
      const container = this.canvas.parentElement;
      if (container) {
        container.style.removeProperty('--map-native-width');
        container.style.removeProperty('--map-native-height');
        container.style.removeProperty('--map-display-width');
        container.style.removeProperty('--map-display-height');
        container.style.removeProperty('--map-aspect-ratio');
      }
    }
    this.viewportOverride = null;
    this.config.map.viewport.x = this.defaultViewport.x;
    this.config.map.viewport.y = this.defaultViewport.y;
    this.config.map.player.x = this.defaultCenter.x;
    this.config.map.player.y = this.defaultCenter.y;
  }

  /**
   * Paint the map based on player's position
   */
  drawMap() {
    const ctx = this.bufferContext || this.context;
    const targetCanvas = this.bufferCanvas || this.canvas;
    if (!ctx || !targetCanvas) {
      return;
    }

    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    const {
      viewport,
      tileSize,
      tileCrop,
    } = this.getViewportMetrics();

    const { tileset, size, objects } = this.config.map;
    const { offsetX, offsetY } = this.camera;

    // Tile sheets by zero-based global id (gid - 1):
    // terrain 0..251 | objects 252..539 | dungeon 540..
    const dungeonImage = this.images.dungeonImage;
    const sheets = [
      {
        from: 540,
        image: dungeonImage,
        columns: dungeonImage && dungeonImage.width ? dungeonImage.width / tileSize : 16,
      },
      {
        from: 252,
        image: this.images.objectImage,
        columns: objects.width / tileSize,
      },
      {
        from: 0,
        image: this.images.terrainImage,
        columns: tileset.width / tileSize,
      },
    ];

    const resolveSheet = (zeroId) => {
      for (let i = 0; i < sheets.length; i += 1) {
        if (zeroId >= sheets[i].from) {
          return sheets[i];
        }
      }
      return sheets[sheets.length - 1];
    };

    const drawTile = (zeroId, drawX, drawY) => {
      if (zeroId < 0) {
        return;
      }
      const sheet = resolveSheet(zeroId);
      if (!sheet.image || !sheet.columns) {
        return;
      }
      const local = zeroId - sheet.from;
      ctx.drawImage(
        sheet.image,
        Math.floor(local % sheet.columns) * tileSize,
        Math.floor(local / sheet.columns) * tileSize,
        tileSize,
        tileSize,
        drawX,
        drawY,
        tileSize,
        tileSize,
      );
    };

    for (let column = -1; column <= viewport.y + 1; column += 1) {
      for (let row = -1; row <= viewport.x + 1; row += 1) {
        const worldColumn = column + tileCrop.y;
        const worldRow = row + tileCrop.x;

        if (worldColumn >= 0 && worldColumn < size.y && worldRow >= 0 && worldRow < size.x) {
          const tileToFind = (worldColumn * size.x) + worldRow;
          const backgroundIndex = this.background[tileToFind];
          const foregroundIndex = this.foreground[tileToFind];

          if (backgroundIndex !== undefined) {
            const drawX = Math.round((row * tileSize) - offsetX);
            const drawY = Math.round((column * tileSize) - offsetY);

            drawTile(backgroundIndex - 1, drawX, drawY);
            drawTile(foregroundIndex - 1, drawX, drawY);
          }
        }
      }
    }
  }

  /**
   * Draw dropped items on the map
   */
  drawItems() {
    const ctx = this.bufferContext || this.context;
    if (!ctx) {
      return;
    }

    const metrics = this.getViewportMetrics();
    const { tileSize } = metrics;
    const nearbyItems = this.droppedItems.filter((item) => this.isWithinViewport(item, metrics));

    // Get relative X,Y coordinates to paint on viewport
    nearbyItems.forEach((item) => {
      const itemCenter = centerOfTile(item.x, item.y, tileSize);
      const topLeft = {
        x: itemCenter.x - (tileSize / 2),
        y: itemCenter.y - (tileSize / 2),
      };
      const screenPosition = this.worldToScreen(topLeft, metrics);

      // Get item information and get proper quantity index for graphic
      const info = UI.getItemData(item.id);
      let qtyIndex = 0;
      if (item.qty > 1 && info.graphics.quantityLevel) {
        const qLevels = info.graphics.quantityLevel;
        while (qtyIndex < qLevels.length - 1 && qLevels[qtyIndex] < item.qty) {
          qtyIndex += 1;
        }
      }

      // Get the correct tileset to draw upon
      const itemTileset = () => {
        switch (info.graphics.tileset) {
        case 'general':
          return this.images.generalImage;
        case 'jewelry':
          return this.images.jewelryImage;
        case 'armor':
          return this.images.armorImage;
        default:
        case 'weapons':
          return this.images.weaponsImage;
        }
      };

      ctx.drawImage(
        itemTileset(),
        ((info.graphics.column + qtyIndex) * 32), // Number in Item tileset
        (info.graphics.row * 32), // Y-axis of tileset
        tileSize,
        tileSize,
        screenPosition.x,
        screenPosition.y,
        tileSize,
        tileSize,
      );
    }, this);
  }

  /**
   * Draw the player on the board
   */
  drawPlayer() {
    const ctx = this.bufferContext || this.context;
    if (!ctx) {
      return;
    }

    const center = this.getViewportCenter();
    const tileSize = this.config.map.tileset.tile.width;
    const drawX = Math.round(center.x - (tileSize / 2));
    const drawY = Math.round(center.y - (tileSize / 2));

    const animator = this.ensureAnimation(this.player);
    const frame = animator ? animator.getCurrentFrame() : { column: 0, row: 0 };
    const sourceX = frame.column * tileSize;
    const sourceY = frame.row * tileSize;

    ctx.drawImage(
      this.images.playerImage,
      sourceX,
      sourceY,
      tileSize,
      tileSize,
      drawX,
      drawY,
      tileSize,
      tileSize,
    );

    this.drawHitTint(ctx, drawX, drawY, tileSize, this.player && this.player.lastHitAt, now());
  }

  /**
   * Draw the other players on the screen
   */
  drawPlayers() {
    const ctx = this.bufferContext || this.context;
    if (!ctx) {
      return;
    }

    const metrics = this.getViewportMetrics();
    const { tileSize } = metrics;
    const nearbyPlayers = this.players.filter((player) => this.isWithinViewport(player, metrics));

    nearbyPlayers.forEach((player) => {
      const centerPosition = player.movement
        ? player.movement.getPosition()
        : centerOfTile(player.x, player.y, tileSize);

      const topLeft = {
        x: centerPosition.x - (tileSize / 2),
        y: centerPosition.y - (tileSize / 2),
      };

      const screenPosition = this.worldToScreen(topLeft, metrics);

      const animator = this.ensureAnimation(player);
      const frame = animator ? animator.getCurrentFrame() : { column: 0, row: 0 };
      const sourceX = frame.column * tileSize;
      const sourceY = frame.row * tileSize;

      ctx.drawImage(
        this.images.playerImage,
        sourceX,
        sourceY,
        tileSize,
        tileSize,
        screenPosition.x,
        screenPosition.y,
        tileSize,
        tileSize,
      );

      this.drawHitTint(ctx, screenPosition.x, screenPosition.y, tileSize, player.lastHitAt, now());
    });
  }

  /**
   * Draw the monsters on the game viewport canvas
   */
  drawMonsters() {
    const ctx = this.bufferContext || this.context;
    if (!ctx || !Array.isArray(this.monsters) || !this.player) {
      return;
    }

    const metrics = this.getViewportMetrics();
    const nearbyMonsters = this.monsters.filter((monster) => this.isWithinViewport(monster, metrics));

    if (!nearbyMonsters.length) {
      return;
    }

    const { tileSize } = metrics;
    const spriteSheet = this.images.monstersImage || this.images.npcsImage;

    const timestamp = now();

    nearbyMonsters.forEach((monster) => {
      const health = monster.stats && monster.stats.resources
        ? monster.stats.resources.health
        : null;

      // The dead are not drawn; the server respawns them later
      if (health && health.current <= 0) {
        return;
      }

      const centerPosition = monster.movement
        ? monster.movement.getPosition()
        : centerOfTile(monster.x, monster.y, tileSize);

      const topLeft = {
        x: centerPosition.x - (tileSize / 2),
        y: centerPosition.y - (tileSize / 2),
      };

      const screenPosition = this.worldToScreen(topLeft, metrics);
      const fallbackColumn = Number.isFinite(monster.column) ? monster.column : 0;
      const fallbackRow = Number.isFinite(monster.row) ? monster.row : 0;
      const sourceX = fallbackColumn * tileSize;
      const sourceY = fallbackRow * tileSize;

      ctx.drawImage(
        spriteSheet,
        sourceX,
        sourceY,
        tileSize,
        tileSize,
        screenPosition.x,
        screenPosition.y,
        tileSize,
        tileSize,
      );

      // Soft, sprite-inset tint when recently hit (never hides the sprite)
      this.drawHitTint(ctx, screenPosition.x, screenPosition.y, tileSize, monster.lastHitAt, timestamp);

      // Health bar once the monster has taken damage
      if (health && Number.isFinite(health.max) && health.max > 0 && health.current < health.max) {
        const barWidth = tileSize - 8;
        const barHeight = 3;
        const barX = screenPosition.x + 4;
        const barY = screenPosition.y - (barHeight + 2);
        const fraction = Math.max(0, Math.min(1, health.current / health.max));

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        ctx.fillStyle = fraction > 0.4 ? '#5fd35f' : '#e04f4f';
        ctx.fillRect(barX, barY, Math.round(barWidth * fraction), barHeight);
        ctx.restore();
      }
    });
  }

  /**
   * Draw floating damage numbers for recent combat hits
   */
  /**
   * A brief, subtle red tint over a sprite that was recently hit. Kept inset
   * from the tile edges and eased to zero so it reads as a body flash rather
   * than a jarring full-tile square, and it never hides the sprite.
   *
   * @param {CanvasRenderingContext2D} ctx Target context
   * @param {number} x Sprite top-left screen x
   * @param {number} y Sprite top-left screen y
   * @param {number} tileSize Tile size in px
   * @param {number} lastHitAt Timestamp of the last hit (ms)
   * @param {number} timestamp Current frame timestamp (ms)
   */
  drawHitTint(ctx, x, y, tileSize, lastHitAt, timestamp) {
    const HIT_TINT_DURATION = 180;
    if (!lastHitAt) {
      return;
    }
    const elapsed = timestamp - lastHitAt;
    if (elapsed < 0 || elapsed >= HIT_TINT_DURATION) {
      return;
    }

    const progress = elapsed / HIT_TINT_DURATION;
    const alpha = 0.42 * (1 - progress);
    const inset = Math.max(2, Math.round(tileSize * 0.12));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgb(255, 72, 72)';
    ctx.fillRect(x + inset, y + inset, tileSize - inset * 2, tileSize - inset * 2);
    ctx.restore();
  }

  drawCombatFeedback() {
    const ctx = this.bufferContext || this.context;
    if (!ctx || !Array.isArray(this.combatFeedback) || !this.combatFeedback.length || !this.player) {
      return;
    }

    const metrics = this.getViewportMetrics();
    const { tileSize } = metrics;
    const timestamp = now();
    const duration = 900;

    this.combatFeedback = this.combatFeedback.filter(
      (entry) => timestamp - entry.startedAt < duration,
    );

    this.combatFeedback.forEach((entry) => {
      let actor = null;
      if (entry.targetType === 'player') {
        actor = this.player.uuid === entry.targetId
          ? this.player
          : (this.players || []).find((player) => player.uuid === entry.targetId);
      } else {
        actor = (this.monsters || []).find((monster) => monster.uuid === entry.targetId);
      }

      if (!actor) {
        return;
      }

      const centerPosition = actor.movement
        ? actor.movement.getPosition()
        : centerOfTile(actor.x, actor.y, tileSize);
      const screenPosition = this.worldToScreen(centerPosition, metrics);

      const progress = Math.max(0, Math.min(1, (timestamp - entry.startedAt) / duration));
      const rise = (tileSize * 0.6) + (progress * 18);
      const alpha = 1 - progress;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '600 12px "GameFont", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillStyle = entry.targetType === 'player' ? '#ff5252' : '#ffd54f';

      const label = entry.amount > 0 ? `-${entry.amount}` : '0';
      const textX = screenPosition.x;
      const textY = screenPosition.y - rise;
      ctx.strokeText(label, textX, textY);
      ctx.fillText(label, textX, textY);
      ctx.restore();
    });
  }

  /**
   * Draw the NPCs on the game viewport canvas
   */
  drawNPCs() {
    const ctx = this.bufferContext || this.context;
    if (!ctx) {
      return;
    }

    const metrics = this.getViewportMetrics();
    const { tileSize } = metrics;
    const nearbyNPCs = this.npcs.filter((npc) => this.isWithinViewport(npc, metrics));

    nearbyNPCs.forEach((npc) => {
      const centerPosition = npc.movement
        ? npc.movement.getPosition()
        : centerOfTile(npc.x, npc.y, tileSize);

      const topLeft = {
        x: centerPosition.x - (tileSize / 2),
        y: centerPosition.y - (tileSize / 2),
      };

      const screenPosition = this.worldToScreen(topLeft, metrics);

      const animator = this.ensureAnimation(npc);
      const frame = animator ? animator.getCurrentFrame() : null;
      const fallbackColumn = Number.isFinite(npc.column) ? npc.column : 0;
      const sourceX = frame ? frame.column * tileSize : (fallbackColumn * tileSize);
      const sourceY = frame ? frame.row * tileSize : 0;

      ctx.drawImage(
        this.images.npcsImage,
        sourceX,
        sourceY,
        tileSize,
        tileSize,
        screenPosition.x,
        screenPosition.y,
        tileSize,
        tileSize,
      );
    });
  }

  /**
   * Set the coordinates to where the mouse currently is (if on canvas)
   *
   * @param {integer} x Mouse's x-axis on the canvas viewport
   * @param {integer} y Mouses's y-axus on the canvas viewport
   */
  setMouseCoordinates(x, y) {
    const data = {
      mouse: {
        type: [moveToMouse, blockedMouse], // To add: Use, Attack
        current: 0,
      },
    };

    const tile = {
      background: UI.getTileOverMouse(
        this.background,
        this.player.x,
        this.player.y,
        x,
        y,
      ),
      foreground: UI.getTileOverMouse(
        this.foreground,
        this.player.x,
        this.player.y,
        x,
        y,
      ),
    };

    let isWalkable = UI.tileWalkable(tile.background);
    if (tile.foreground > -1) {
      isWalkable = UI.tileWalkable(tile.foreground, 'foreground');
    }

    this.path.current.walkable = isWalkable;

    if (!isWalkable) {
      data.mouse.current = 1;
    }

    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.type = data.mouse.current;
    this.mouse.selection.src = data.mouse.type[data.mouse.current];
  }

  /**
   * Draw the mouse selection on the canvas's viewport
   */
  drawMouse() {
    const ctx = this.bufferContext || this.context;
    if (!ctx) {
      return;
    }
    if (this.mouse.x === null || this.mouse.y === null) {
      return;
    }

    const metrics = this.getViewportMetrics();
    const { tileSize, tileCrop } = metrics;

    const topLeft = {
      x: (this.mouse.x + tileCrop.x) * tileSize,
      y: (this.mouse.y + tileCrop.y) * tileSize,
    };

    const screenPosition = this.worldToScreen(topLeft, metrics);

    ctx.drawImage(
      this.mouse.selection,
      screenPosition.x,
      screenPosition.y,
      tileSize,
      tileSize,
    );
  }

  getViewportCenter() {
    const { viewport, tileSize } = this.getViewportMetrics();

    return {
      x: Math.floor(viewport.x / 2) * tileSize + (tileSize / 2),
      y: Math.floor(viewport.y / 2) * tileSize + (tileSize / 2),
    };
  }
}

export default Map;
