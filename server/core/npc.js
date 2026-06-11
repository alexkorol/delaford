import Socket from '#server/socket.js';
import * as emoji from 'node-emoji';
import createNpcMovementHandler from '#server/core/entities/npc/movement-handler.js';
import npcs from './data/npcs.js';
import world from './world.js';

class NPC {
  constructor(data) {
    this.movement = createNpcMovementHandler(this);
    this.id = data.id;
    this.name = data.name;

    // Examine text
    this.examine = data.examine;

    // What actions can be performed on them?
    this.actions = data.actions;

    // Where they will spawn on world restarts
    this.spawn = {
      x: data.spawn.x,
      y: data.spawn.y,
    };

    // Where are they right now?
    this.x = data.spawn.x;
    this.y = data.spawn.y;

    // How far they can walk from spawn location
    this.range = data.spawn.range;

    // When they last performed an action
    this.lastAction = 0;

    // What column they are on in tileset
    this.column = data.graphic.column;

    this.movementStep = {
      sequence: 0,
      startedAt: Date.now(),
      duration: 0,
      direction: null,
      blocked: false,
    };

    this.facing = this.movement.resolveFacing(null);
    this.animation = this.createInitialAnimation();
  }

  resolveFacing(direction, fallback) {
    return this.movement.resolveFacing(direction, fallback);
  }

  setFacing(direction) {
    return this.movement.setFacing(direction);
  }

  createInitialAnimation(overrides = {}) {
    return this.movement.createInitialAnimation(overrides);
  }

  setAnimationState(state, options = {}) {
    return this.movement.setAnimationState(state, options);
  }

  /**
   * Load the NPCs into the game world
   *
   * @param {this} context The server context
   */
  static load(context) {
    npcs.forEach((npc) => {
      world.addNpc(new NPC(npc));
    }, context);

    console.log(`${emoji.get('walking')}  Loading NPCs...`);
  }

  /**
   * Simulate NPC movement every cycle
   */
  static movement() {
    world.npcs.forEach((npc) => {
      npc.movement.performRandomMovement(world);
    });

    const meta = {
      movements: world.npcs.map((npc) => ({
        id: npc.id,
        uuid: npc.uuid || null,
        movementStep: npc.movementStep,
      })),
      animations: world.npcs.map((npc) => ({
        id: npc.id,
        uuid: npc.uuid || null,
        animation: npc.animation || null,
      })),
    };

    // NPCs only exist in the town scene; keep instance players out of it
    Socket.broadcast('npc:movement', world.npcs, world.getScenePlayers(world.defaultTownId), { meta });
  }
}

export default NPC;
