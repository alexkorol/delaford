const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

export const permittedDevelopmentOrigin = (origin, requestHostname) => {
  if (!origin || !requestHostname) return null;

  try {
    const parsed = new URL(origin);
    const sameHost = parsed.hostname === requestHostname
      || loopbackHosts.has(parsed.hostname) && loopbackHosts.has(requestHostname);
    return parsed.port === '5173' && sameHost ? origin : null;
  } catch {
    return null;
  }
};
