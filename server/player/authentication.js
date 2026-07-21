import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import { maybeStartTutorial } from '#server/core/tutorial.js';
import { publicSceneMetadata } from '#server/core/world-transitions.js';
import identityRegistry from '#server/core/services/identity-registry.js';
import playerTemplate from '#server/core/data/helpers/player.json' with { type: 'json' };
import { publicPlayerProjection } from '#server/core/entities/player/public-projection.js';

class Authentication {
  /**
   * Log the player in, get the JWT token and then their profile
   *
   * @param {object} data The username/password sent to the login endpoint
   * @returns {object} Their player profile and token
   */
  static async login(data) {
    const account = identityRegistry.authenticateLogin(data.data || {});
    if (!account) throw new Error('Username and password are incorrect.');
    const player = { ...JSON.parse(JSON.stringify(playerTemplate)), ...account };
    return { player, token: `local:${player.uuid}` };
  }

  /**
   * Adds the player to world and logs them in
   *
   * @param {object} player The player who has just joined the server
   */
  static addPlayer(player) {
    world.addPlayer(player);

    const scene = world.getSceneForPlayer(player);

    const block = {
      player,
      map: scene.map,
      npcs: scene.npcs,
      monsters: Array.isArray(scene.monsters)
        ? scene.monsters.map((monster) => (monster && typeof monster.toJSON === 'function'
          ? monster.toJSON()
          : monster))
        : [],
      droppedItems: scene.items,
      scene: {
        id: scene.id,
        name: scene.name,
        type: scene.type,
        seed: scene.metadata && scene.metadata.seed,
        metadata: publicSceneMetadata(scene.metadata || {}),
      },
      quickStart: player.quickStart === true,
    };

    // Tell the client they are logging in
    Socket.emit('player:login', block);

    // Tell the world someone logged in
    const meta = {
      players: world.getScenePlayers(scene.id).map((p) => ({
        uuid: p.uuid,
        movementStep: p.movementStep,
      })),
    };

    const recipients = world.getScenePlayers(scene.id);
    Socket.broadcast('player:joined', recipients.map(publicPlayerProjection), recipients, { meta });

    // Give the client a moment to mount the chat before the guide speaks
    setTimeout(() => maybeStartTutorial(player), 2500);
  }
}

export default Authentication;
