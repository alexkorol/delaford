const MAX_RECORDS = 100;

const serialise = (value) => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  try {
    return JSON.parse(JSON.stringify(value, (_key, entry) => {
      if (entry instanceof Error) {
        return {
          name: entry.name,
          message: entry.message,
          stack: entry.stack,
        };
      }
      return entry;
    }));
  } catch (_error) {
    return String(value);
  }
};

class ClientDiagnostics {
  static records = [];

  static sessionId = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  static contextProvider = null;

  static counters = {};

  static record(kind, details = {}) {
    ClientDiagnostics.counters[kind] = (ClientDiagnostics.counters[kind] || 0) + 1;
    const context = typeof ClientDiagnostics.contextProvider === 'function'
      ? ClientDiagnostics.contextProvider()
      : {};
    ClientDiagnostics.records.push({
      at: new Date().toISOString(),
      kind,
      details: serialise(details),
      context: serialise(context),
    });
    if (ClientDiagnostics.records.length > MAX_RECORDS) {
      ClientDiagnostics.records.splice(0, ClientDiagnostics.records.length - MAX_RECORDS);
    }

    if (typeof window !== 'undefined') {
      window.__verdigrisDiagnostics = ClientDiagnostics.snapshot;
      if (kind !== 'socket:message') {
        try {
          window.sessionStorage.setItem('verdigris:last-diagnostics', JSON.stringify(ClientDiagnostics.snapshot()));
        } catch (_error) {
          // Storage can be disabled; the in-memory ring buffer remains useful.
        }
      }
    }
  }

  static setContextProvider(provider) {
    ClientDiagnostics.contextProvider = typeof provider === 'function' ? provider : null;
  }

  static snapshot() {
    return {
      sessionId: ClientDiagnostics.sessionId,
      counters: { ...ClientDiagnostics.counters },
      records: ClientDiagnostics.records.map(record => ({ ...record })),
    };
  }

  static reset() {
    ClientDiagnostics.records = [];
    ClientDiagnostics.contextProvider = null;
    ClientDiagnostics.counters = {};
  }
}

export default ClientDiagnostics;
