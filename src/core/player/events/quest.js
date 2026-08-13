export default {
  'player:quests:update': (incoming, context) => {
    if (!context || !context.game || !context.game.player) {
      return;
    }
    const payload = incoming && incoming.data ? incoming.data : {};
    if (payload.quests && typeof payload.quests === 'object') {
      context.game.player.quests = payload.quests;
    }
  },
};
