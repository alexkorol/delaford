export const normaliseChatMessage = (incoming) => {
  if (typeof incoming === 'string') {
    return { type: 'normal', text: incoming };
  }

  if (!incoming || typeof incoming !== 'object') {
    return incoming;
  }

  if (Object.hasOwnProperty.call(incoming, 'text')) {
    return incoming;
  }

  if (Object.hasOwnProperty.call(incoming, 'data')) {
    return normaliseChatMessage(incoming.data);
  }

  return incoming;
};

export default {
  normaliseChatMessage,
};
