/**
 * World-web events: reading a road's Wayfinder's Chart and travelling to a
 * charted zone node (docs/crossroads-world-web.md).
 */
import world from '#server/core/world.js';
import zoneService from '#server/core/services/zone-service.js';
import { ROADS } from '#server/core/world-web.js';

const getPlayerBySocket = ws => world.players.find(player => player.socket_id === ws.id);

const ROAD_IDS = new Set(ROADS.map(road => road.id));

export default {
  'world:road:chart': ({ data }, ws) => {
    const player = getPlayerBySocket(ws);
    if (!player) return;
    const roadId = data?.roadId;
    if (!ROAD_IDS.has(roadId)) return;
    zoneService.openRoadChart(player, roadId);
  },

  'world:zone:enter': async ({ data }, ws) => {
    const player = getPlayerBySocket(ws);
    if (!player) return;
    await zoneService.enterZoneNode(player, data?.nodeId);
  },
};
