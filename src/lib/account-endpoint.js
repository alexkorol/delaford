export const accountEndpoint = (socketUrl) => {
  if (!socketUrl) return '/api/accounts';

  try {
    const serverUrl = new URL(socketUrl);
    serverUrl.protocol = serverUrl.protocol === 'wss:' ? 'https:' : 'http:';
    return `${serverUrl.origin}/api/accounts`;
  } catch {
    return '/api/accounts';
  }
};
