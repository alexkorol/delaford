export const normaliseHouseName = (value) => String(value || '')
  .trim()
  .replace(/^(?:house\s+)+/i, '')
  .trim();
