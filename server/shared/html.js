/**
 * HTML helpers for server-authored labels.
 *
 * Context-menu labels are intentionally raw HTML (they carry the rarity
 * colour <span>). Any dynamic text spliced into them MUST go through
 * escapeHtml first: the v-html sink in ContextMenu.vue renders whatever it
 * receives verbatim.
 */
export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/**
 * Legacy databases can hold House/scion names recorded before markup
 * validation existed. Strip everything outside the supported name alphabet
 * so old records render harmlessly; fall back when nothing usable remains.
 */
export const sanitiseChronicleName = (value, fallback = 'Wayfarer') => {
  const cleaned = String(value || '')
    .replace(/[^A-Za-z0-9 '\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
};
