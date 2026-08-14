const MAX_EVENTS = 200;
const events = [];

export const recordRuntimeEvent = (kind, details = {}) => {
  events.push({
    at: new Date().toISOString(),
    kind,
    details,
  });
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
};

export const recentRuntimeEvents = (limit = 50) => (
  events.slice(-Math.max(0, limit)).map(event => ({ ...event }))
);

export const resetRuntimeEvents = () => {
  events.length = 0;
};

export default {
  recordRuntimeEvent,
  recentRuntimeEvents,
  resetRuntimeEvents,
};
