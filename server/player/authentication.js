import Socket from '#server/socket.js';
import world from '#server/core/world.js';
import { maybeStartTutorial } from '#server/core/tutorial.js';
import { publicSceneMetadata } from '#server/core/world-transitions.js';
import { maybeStartQuest } from '#server/core/services/quest-service.js';
import identityRegistry from '#server/core/services/identity-registry.js';
import playerTemplate from '#server/core/data/helpers/player.json' with { type: 'json' };
import { publicPlayerProjection } from '#server/core/entities/player/public-projection.js';
import UI from '#shared/ui.js';
import config from '#server/config.js';

// Persisted or template coordinates can be stale relative to the current town
// layout (a decor tile may now occupy them). Under continuous movement a
// player wedged in a blocked tile can never move again, so admission snaps
// any non-walkable position to the scene's spawn point.
const snapToSceneSpawnIfBlocked = (player) => {
  const scene = world.getSceneForPlayer(player);
  const spawn = scene?.metadata?.spawnPoints?.[0];
  const map = scene?.map;
  if (!spawn || !map || !Array.isArray(map.background)) {
    return;
  }

  const tileX = Math.round(Number(player.x));
  const tileY = Math.round(Number(player.y));
  const width = config.map.size.x;
  const height = config.map.size.y;
  const inBounds = Number.isFinite(tileX) && Number.isFinite(tileY)
    && tileX >= 0 && tileY >= 0 && tileX < width && tileY < height;
  const index = (tileY * width) + tileX;
  const background = inBounds ? map.background[index] : null;
  const foreground = inBounds ? map.foreground[index] : null;
  const walkable = inBounds
    && Number.isFinite(background)
    && UI.tileWalkable(background - 1, 'background')
    && (!foreground || UI.tileWalkable(foreground - 1, 'foreground'));

  if (!walkable) {
    player.x = spawn.x;
    player.y = spawn.y;
  }
};

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
   * End an account session. Local-first accounts (token "local:<uuid>") and
   * guests (token "none") have no remote session to end; the disconnect
   * teardown may still call this for them, so it must be a safe no-op.
   */
  static async logout(token) {
    if (!token || token === 'none' || token.startsWith('local:')) {
      return;
    }
    // A remote SITE_URL account API is not bundled in local-first mode.
    // If one is configured, ending its session is best-effort.
    if (!process.env.SITE_URL) {
      return;
    }
    const { default: axios } = await import('axios');
    await axios.post(`${process.env.SITE_URL}/api/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /**
   * Adds the player to world and logs them in
   *
   * @param {object} player The player who has just joined the server
   */
  static addPlayer(player) {
    world.addPlayer(player);
    snapToSceneSpawnIfBlocked(player);
    maybeStartQuest(player);

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
