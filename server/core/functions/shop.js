import Query from '#server/core/data/query.js';
import Socket from '#server/socket.js';
import UI from '#shared/ui.js';
import config from '#server/config.js';
import { shops } from '#server/core/data/foreground/index.js';
import world from '#server/core/world.js';

const { player } = config;

const normaliseQuantity = (quantity) => {
  const numeric = Number(quantity);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.floor(numeric));
};

const getStackQuantity = (item) => {
  if (!item) {
    return 0;
  }

  const numeric = Number(item?.qty);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return Math.max(0, Math.floor(numeric));
};

class Shop {
  constructor(shopId, playerUuid, itemId, type, quantity) {
    // Our player's reference and index
    this.playerIndex = world.players.findIndex(p => p.uuid === playerUuid);
    if (this.playerIndex === -1) {
      throw new Error('Player not found in world.');
    }
    this.inventory = world.players[this.playerIndex].inventory;

    // How many spaces available in the player's inventory?
    this.slotsAvailable = player.slots.inventory - this.inventory.slots.length;

    // What item we are buying/selling?
    this.itemId = itemId;

    // Object index references
    this.shopIndex = world.shops.findIndex(i => i.npcId === shopId);
    if (this.shopIndex === -1) {
      throw new Error('Shop not found in world.');
    }
    this.shop = world.shops[this.shopIndex].inventory; // Shop's inventory
    this.coinIndex = this.inventory.slots.findIndex(e => e.id === 'coins');
    this.shopItemIndex = this.shop.findIndex(q => q.id === this.itemId);
    this.shopType = world.shops[this.shopIndex].type;

    // Is our item stackable?
    this.itemFull = Query.getItemData(this.itemId);
    if (!this.itemFull) {
      throw new Error('Item not found.');
    }
    this.stackable = this.itemFull.stackable === true;
    this.price = Number.isFinite(this.itemFull.price) ? this.itemFull.price : 0;
    this.ableToBuyAll = false;
    this.requestedQuantity = normaliseQuantity(quantity);

    // Is this item prohibited from being sold?
    this.prohibited = this.itemFull.prohibited === true;

    // Get the quantity of how much we are able to buy
    this.quantity = this.getTrueStockableQuantity(quantity);
    this.quantityToSell = this.getSellableQuantity(quantity);

    // Do we have enough space? Money?
    this.insufficient = {
      space: false,
      funds: false,
    };

    // Are buying or selling? Change to source of items based on action
    this.source = (type === 'buy' ? this.shop : this.inventory.slots);

    // The item we are acting on
    this.item = this.source.find(e => e.id === this.itemId);
  }

  /**
   * Load the store data
   *
   * @return {object}
   */
  static load() {
    return shops.map((definition) => {
      const s = {
        ...definition,
        displays: Array.isArray(definition.displays)
          ? definition.displays.map(display => ({ ...display }))
          : [],
      };
      // Accept both source definitions and already formatted stale data.
      s.inventory = definition.inventory.map((item, index) => Shop.formatData({
        item: item.item || item.id,
        stock: Number.isFinite(item.stock) ? item.stock : item.qty,
      }, index));
      // Take stock of original items sold in general stores
      s.originalStock = s.inventory.map(q => q.id);
      return s;
    });
  }

  /**
   * How many items can we sell?
   *
   * @param {integer} quantity The quantity we are selling
   * @return {integer}
   */
  getSellableQuantity(quantity) {
    const requestedQuantity = normaliseQuantity(quantity);
    if (requestedQuantity <= 0) {
      return 0;
    }

    if (this.stackable) {
      const stack = this.getInventoryStack();
      return Math.min(requestedQuantity, getStackQuantity(stack));
    }

    // How many items (to sell) do we have in our inventory?
    const howManyItems = this.inventory.slots.filter(e => e && e.id === this.itemId).length;

    return Math.min(requestedQuantity, howManyItems);
  }

  /**
   * Return the number of items we can buy based on the store's in-stock quantity
   *
   * @param {integer} quantity The number of items we want to buy from context-menu
   * @return {boolean}
   */
  getTrueStockableQuantity(quantity) {
    const requestedQuantity = normaliseQuantity(quantity);
    if (requestedQuantity <= 0) {
      return 0;
    }

    if (this.shopItemIndex === -1) return 0;
    // Is our in-stock quantity higher than what we want to buy?
    const stockQuantity = getStackQuantity(this.shop[this.shopItemIndex]);
    const moreThanWeHave = stockQuantity >= requestedQuantity;

    // If not, we will be able to buy all (ig: in-stock = 10, buy 5)
    this.ableToBuyAll = moreThanWeHave === true;

    // If we want to buy more than we have, use the user-clicked
    // quantity otherwise lets buy the items in-stock quantity.
    return moreThanWeHave ? requestedQuantity : stockQuantity;
  }

  /**
   * Return the true quantity of items we are buying based on
   * the number of slots availabe in player's inventory
   *
   * @return {integer}
   */
  getTrueBuyingQuantity() {
    if (this.quantity <= 0) {
      return 0;
    }

    if (this.stackable && this.getInventoryStack()) {
      return this.quantity;
    }

    const simulatedInventory = [...this.inventory.slots];
    let quantityThatFits = 0;
    const attempts = this.stackable ? 1 : this.quantity;

    for (let index = 0; index < attempts; index += 1) {
      const openSlot = UI.getOpenSlot(simulatedInventory, 'inventory', this.itemFull);
      if (openSlot === false && openSlot !== 0) {
        break;
      }

      quantityThatFits += this.stackable ? this.quantity : 1;
      simulatedInventory.push({
        ...this.itemFull,
        id: this.itemId,
        qty: this.stackable ? this.quantity : 1,
        slot: openSlot,
      });

      if (this.stackable) {
        break;
      }
    }

    if (quantityThatFits < this.quantity) {
      this.insufficient.space = true;
    }

    return quantityThatFits;
  }

  /**
   * Return the player's inventory stack for this shop item, when one exists.
   *
   * @return {object|undefined}
   */
  getInventoryStack() {
    return this.inventory.slots.find(item => item && item.id === this.itemId);
  }

  /**
   * Check to see if our item is in stock
   *
   * @return {boolean}
   */
  itemInStock() {
    if (this.shopItemIndex === -1) return false;
    if (!this.shop[this.shopItemIndex]) return false;

    return this.shop[this.shopItemIndex].qty > 0;
  }

  /**
   * Is this store a speciality type?
   * (Ludovicus's Axes, etc)
   *
   * @return {boolean}
   */
  isSpeciality() {
    return this.shopType === 'speciality';
  }

  /**
   * Is this store a general store?
   *
   * @return {boolean}
   */
  isGeneralStore() {
    return this.shopType === 'general';
  }

  /**
   * Can we sell this item based on inventory space, store requirements or anything else?
   *
   * @return {boolean}
   */
  canWeSell() {
    let willWeSell = false;
    let msg = '';
    if (this.prohibited) {
      willWeSell = false;
      msg = 'You cannot sell this item.';
    } else if (this.quantityToSell <= 0) {
      willWeSell = false;
      msg = 'You do not have that item.';
    } else if (!this.spaceInInventory()) {
      willWeSell = false;
      msg = 'Not enough space in inventory.';
    } else if (this.isSpeciality()) {
      willWeSell = this.shop.map(q => q.id).includes(this.itemId);
      if (!willWeSell) {
        msg = 'You cannot sell this item to the store.';
      } else {
        willWeSell = true;
      }
    } else if (!this.shopCanReceiveSale()) {
      willWeSell = false;
      msg = 'The store has no room for that item.';
    } else {
      willWeSell = true;
    }

    // If we can't, lets give them the reason why not
    if (!willWeSell) {
      Socket.emit('game:send:message', {
        player: { socket_id: world.players[this.playerIndex].socket_id },
        text: msg,
      });
    }

    return willWeSell;
  }

  /**
   * Sell an item to the shop
   */
  sell() {
    if (this.canWeSell()) {
      const quantitySold = this.removeSoldItemsFromInventory();
      if (quantitySold <= 0) {
        return {
          inventory: this.inventory.slots,
          shopItems: this.shop,
        };
      }

      this.addSoldItemsToShop(quantitySold);
      this.coinIndex = this.inventory.slots.findIndex(e => e.id === 'coins');

      const saleValue = this.price * quantitySold;
      if (saleValue <= 0) {
        return {
          inventory: this.inventory.slots,
          shopItems: this.shop,
        };
      }

      // Add coins to our coins in inventory
      if (this.hasCoinsInInventory()) {
        this.inventory.slots[this.coinIndex].qty += saleValue;
      } else {
        // If not, lets give them their coins to the inventory
        this.inventory.add('coins', saleValue);
      }
    }

    return {
      inventory: this.inventory.slots,
      shopItems: this.shop,
    };
  }

  /**
   * Is the player buying a store-stocked item?
   *
   * @return {boolean}
   */
  buyingStoreProduct() {
    return (world.shops[this.shopIndex].originalStock || []).includes(this.itemId);
  }

  /**
   * Buy an item from the shop
   */
  buy() {
    // Save quantity before a purchase
    const qtyBeforePurchase = this.shopItemIndex === -1
      ? 0
      : getStackQuantity(this.shop[this.shopItemIndex]);
    // How many items can we buy based on inventory space
    let isBuying = this.getTrueBuyingQuantity();
    // How much gold do we have?
    let playerGold = 0;

    if (this.inventory.slots[this.coinIndex]) {
      playerGold = this.inventory.slots[this.coinIndex].qty;
    }
    if (this.price > 0 && playerGold < this.price) {
      this.insufficient.funds = true;
      this.checkPurchase(qtyBeforePurchase);
      return {
        inventory: this.inventory.slots,
        shopItems: this.shop,
      };
    }

    if (this.price > 0 && playerGold < this.price * isBuying) {
      this.insufficient.funds = true;
      isBuying = Math.floor(playerGold / this.price);
    }

    if (isBuying <= 0) {
      this.checkPurchase(qtyBeforePurchase);
      return {
        inventory: this.inventory.slots,
        shopItems: this.shop,
      };
    }

    const quantityBought = this.addPurchasedItemsToInventory(isBuying);
    if (quantityBought <= 0) {
      this.insufficient.space = true;
      this.checkPurchase(qtyBeforePurchase);
      return {
        inventory: this.inventory.slots,
        shopItems: this.shop,
      };
    }

    // If we completed one round of purchasing
    if (quantityBought > 0) {
      const toSpend = this.price * quantityBought;
      const moneyLeft = playerGold - toSpend;
      // Update our new money total
      if (this.price > 0 && this.inventory.slots[this.coinIndex]) {
        if (moneyLeft > 0) {
          this.inventory.slots[this.coinIndex].qty = moneyLeft;
        } else {
      // A quantity of zero still renders the item sprite.
      // In the case that we have no money left, we should remove
      // the whole coin sprite from the inventory
          this.inventory.slots.splice(this.coinIndex, 1);
        }
      }

      // Substract the quantity of the items we have bought
      const shopQty = this.shop[this.shopItemIndex].qty;
      const qtyAfterPurchase = shopQty - quantityBought;

      if (qtyAfterPurchase > 0 || this.buyingStoreProduct()) {
        this.shop[this.shopItemIndex].qty = Math.max(0, qtyAfterPurchase);
      } else {
        // Remove sprite with quantity equals to zero only
        // when item's origin is from a player.
        this.shop.splice(this.shopItemIndex, 1);
      }
    }

    // Check to see if purchases can be
    // made and give message accordingly
    this.checkPurchase(qtyBeforePurchase);

    return {
      inventory: this.inventory.slots,
      shopItems: this.shop,
    };
  }

  /**
   * The purchase did not meet all requirements
   */
  checkPurchase(quantity) {
    let msg = '';
    if (quantity < 1 && this.buyingStoreProduct()) {
      msg = 'No more in stock.';
    } else if (this.insufficient.funds) {
      msg = 'Not enough gold to purchase.';
    } else if (this.insufficient.space) {
      msg = 'You were not able to buy all of the items.';
    }

    if (msg !== '') {
      Socket.emit('game:send:message', {
        player: { socket_id: world.players[this.playerIndex].socket_id },
        text: msg,
      });
    }
  }

  /**
   * Get the value for an item to player
   */
  value() {
    Socket.emit('game:send:message', {
      player: { socket_id: world.players[this.playerIndex].socket_id },
      text: this.prohibited
        ? 'How can you value that which has infinite value?'
        : `${this.itemFull.name}: ${this.price} coins.`,
    });
  }

  /**
   * Has the player succesffuly made a sale?
   *
   * @param {object} response The sale to be analyzed
   * @return {boolean}
   */
  static successfulSale(response) {
    return response !== undefined && Object.prototype.hasOwnProperty.call(response, 'inventory');
  }

  /**
   * Does the player have enough space in their inventory?
   *
   * @return {boolean}
   */
  spaceInInventory() {
    return this.hasCoinsInInventory()
      || this.slotsAvailable > 0
      || this.saleFreesInventorySlot();
  }

  /**
   * Does this sale free a slot before coins need to be inserted?
   *
   * @return {boolean}
   */
  saleFreesInventorySlot() {
    if (this.quantityToSell <= 0) {
      return false;
    }

    if (!this.stackable) {
      return true;
    }

    const stack = this.getInventoryStack();
    return Boolean(stack) && this.quantityToSell >= getStackQuantity(stack);
  }

  /**
   * Can the shop inventory accept this sold item?
   *
   * @return {boolean}
   */
  shopCanReceiveSale() {
    if (this.shop.findIndex(q => q && q.id === this.itemId) !== -1) {
      return true;
    }

    if (!this.isGeneralStore()) {
      return false;
    }

    const openSlot = UI.getOpenSlot(this.shop, 'trade');
    return openSlot !== false || openSlot === 0;
  }

  /**
   * Does the player have coins in their inventory?
   *
   * @return {boolean}
   */
  hasCoinsInInventory() {
    return this.coinIndex > -1;
  }

  /**
   * Add purchased items to the player's inventory and return the true quantity added.
   *
   * @param {integer} quantity The intended quantity to buy
   * @return {integer}
   */
  addPurchasedItemsToInventory(quantity) {
    if (quantity <= 0) {
      return 0;
    }

    if (this.stackable) {
      const existingStack = this.getInventoryStack();
      if (existingStack) {
        existingStack.qty = getStackQuantity(existingStack) + quantity;
        return quantity;
      }

      const beforeStack = this.getInventoryStack();
      this.inventory.add(this.itemId, quantity);
      const afterStack = this.getInventoryStack();
      if (!beforeStack && afterStack) {
        return getStackQuantity(afterStack);
      }
      return 0;
    }

    const beforeCount = this.inventory.slots.filter(item => item && item.id === this.itemId).length;
    this.inventory.add(this.itemId, quantity);
    const afterCount = this.inventory.slots.filter(item => item && item.id === this.itemId).length;
    return Math.max(0, afterCount - beforeCount);
  }

  /**
   * Remove sold items from inventory and return the true quantity removed.
   *
   * @return {integer}
   */
  removeSoldItemsFromInventory() {
    if (this.quantityToSell <= 0) {
      return 0;
    }

    if (this.stackable) {
      const stackIndex = this.inventory.slots.findIndex(item => item && item.id === this.itemId);
      if (stackIndex === -1) {
        return 0;
      }

      const stack = this.inventory.slots[stackIndex];
      const quantitySold = Math.min(this.quantityToSell, getStackQuantity(stack));
      if (quantitySold >= getStackQuantity(stack)) {
        this.inventory.slots.splice(stackIndex, 1);
      } else {
        stack.qty = getStackQuantity(stack) - quantitySold;
      }
      return quantitySold;
    }

    let quantitySold = 0;
    for (let index = 0; index < this.quantityToSell; index += 1) {
      const itemIndex = this.inventory.slots.findIndex(z => z && z.id === this.itemId);
      if (itemIndex === -1) {
        break;
      }

      this.inventory.slots.splice(itemIndex, 1);
      quantitySold += 1;
    }

    return quantitySold;
  }

  /**
   * Place sold items back into the shop inventory.
   *
   * @param {integer} quantity The quantity sold by the player
   */
  addSoldItemsToShop(quantity) {
    if (quantity <= 0) {
      return;
    }

    const existingIndex = this.shop.findIndex(q => q && q.id === this.itemId);
    if (existingIndex !== -1) {
      this.shop[existingIndex].qty = getStackQuantity(this.shop[existingIndex]) + quantity;
      this.shopItemIndex = existingIndex;
      return;
    }

    if (!this.isGeneralStore()) {
      return;
    }

    const openSlot = UI.getOpenSlot(this.shop, 'trade');
    if (openSlot === false && openSlot !== 0) {
      return;
    }

    this.shop.push({
      id: this.itemId,
      qty: quantity,
      slot: openSlot,
    });
    this.shopItemIndex = this.shop.length - 1;
  }

  /**
   * Return the inventory data from the source to a common format for ItemGrid
   *
   * @param {object} data The shop data
   * @param {integer} i The iteration in the inventory
   * @return {object}
   */
  static formatData(data, i) {
    return {
      id: data.item,
      qty: data.stock,
      slot: i,
    };
  }
}

export default Shop;
