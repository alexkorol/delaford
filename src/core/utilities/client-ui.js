import { useUiStore } from '@/stores/ui.js';

export const plainContextLabel = label => (
  String(label || '').replace(/<[^>]*>/g, '')
);

class ClientUI {
  /**
   * Update the client action with latest mouseover
   *
   * @param {object} incoming The data regarding the mouseover event
   */
  static displayFirstAction(incoming) {
    const { count } = incoming.data.data;
    if (count === -1) return;
    let label = plainContextLabel(incoming.data.data.firstItem.label);
    if (count > 0) label += ` / ${count} other options`;
    const store = useUiStore();
    store.setAction({
      object: incoming.data.data.firstItem,
      label,
    });
  }
}

export default ClientUI;
