import Socket from '#server/socket.js';
import axios from 'axios';
import world from '#server/core/world.js';
import { maybeStartTutorial } from '#server/core/tutorial.js';
import { publicSceneMetadata } from '#server/core/world-transitions.js';
import { maybeStartQuest } from '#server/core/services/quest-service.js';

class Authentication {
  /**
   * Log the player in, get the JWT token and then their profile
   *
   * @param {object} data The username/password sent to the login endpoint
   * @returns {object} Their player profile and token
   */
  static async login(data) {
    const token = await Authentication.getToken(data.data);
    const player = await Authentication.getProfile(token);
    return { player, token };
  }

  /**
   * Logs the player in and returns their JWT token
   *
   * @param {object} data The player credentials
   */
  static getToken(data) {
    const url = `${process.env.SITE_URL}/api/auth/login`;

    return new Promise((resolve, reject) => {
      axios
        .post(url, data)
        .then((r) => {
          resolve(r.data.access_token);
        })
        .catch(() => {
          reject(
            new Error('Username and password are incorrect.'),
          );
        });
    });
  }

  /**
   * Gets the player profile upon login
   *
   * @param {string} token Their JWT authentication token
   */
  static getProfile(token) {
    const url = `${process.env.SITE_URL}/api/auth/me`;
    const config = {
      headers: { Authorization: `Bearer ${token}` },
    };

    return new Promise((resolve, reject) => {
      axios
        .post(url, null, config)
        .then(r => resolve(r.data))
        .catch((error) => {
          console.log(error.response);
          reject(error.response);
        });
    });
  }

  /**
   * Logs the player out and saves the data.
   *
   * @param {string} token Their JWT authentication token
   */
  static async logout(token) {
    const url = `${process.env.SITE_URL}/api/auth/logout`;

    const config = {
      headers: { Authorization: `Bearer ${token}` },
    };

    return new Promise((resolve, reject) => {
      axios
        .post(url, {}, config)
        .then((r) => {
          resolve(r.data);
        })
        .catch((error) => {
          reject(error.message);
        });
    });
  }

  /**
   * Adds the player to world and logs them in
   *
   * @param {object} player The player who has just joined the server
   */
  static addPlayer(player) {
    world.addPlayer(player);
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
    Socket.broadcast('player:joined', recipients, recipients, { meta });

    // Give the client a moment to mount the chat before the guide speaks
    setTimeout(() => maybeStartTutorial(player), 2500);
  }
}

export default Authentication;
