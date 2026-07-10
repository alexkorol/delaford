import Socket from '#server/socket.js';
import chroniclesRepository from '#server/core/repositories/chronicles-repository.js';
import { beginScionSession, sendChronicleState } from '#server/core/services/chronicles.js';

const sendError = (ws, reason) => {
  Socket.emit('chronicles:error', {
    player: { socket_id: ws.id },
    reason,
  });
};

export default {
  'chronicles:house:found': ({ data }, ws) => {
    const accountId = ws.chronicleAuth?.accountId;
    const result = chroniclesRepository.foundHouse(accountId, data?.name);
    if (!result.ok) return sendError(ws, result.reason);
    return sendChronicleState(ws);
  },

  'chronicles:scion:create': ({ data }, ws) => {
    const accountId = ws.chronicleAuth?.accountId;
    const result = chroniclesRepository.createScion(accountId, data?.houseId, data?.name);
    if (!result.ok) return sendError(ws, result.reason);
    return sendChronicleState(ws, { createdScionId: result.scionId });
  },

  'chronicles:scion:set-out': async ({ data }, ws) => {
    const result = await beginScionSession(ws, data?.scionId);
    if (!result.ok) sendError(ws, result.reason);
  },
};
