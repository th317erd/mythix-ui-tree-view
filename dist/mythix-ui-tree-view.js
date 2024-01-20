import {
  MythixUIComponent,
  Components,
  Utils,
} from '@cdn/mythix-ui-core@1';

const ITEM_ELEMENT_TYPE = 'li';

export class MythixUITreeView extends MythixUIComponent {
  static tagName = 'mythix-tree-view';

  get $forEach() {
    return Array.prototype.find.call(this.children, (child) => child.matches('mythix-for-each.mythix-tree-view-children-container'));
  }

  set attr$data([ value ]) {
    let $forEach = this.$forEach;
    if (!$forEach)
      return;

    $forEach.setAttribute('of', 'data');
  }

  createShadowDOM() {
  }

  mounted() {
    let tabIndex = this.attr('tabindex');
    if (Utils.isNOE(tabIndex)) {
      tabIndex = Components.getLargestDocumentTabIndex() + 1;
      this.attr('tabindex', tabIndex);
    }

    let currentFocusedItem = null;

    Object.defineProperties(this, {
      '_currentFocusedItem': {
        enumerable:   false,
        configurable: true,
        get:          () => currentFocusedItem,
        set:          (newValue) => {
          currentFocusedItem = newValue;

          this.updateHasFocusClasses(newValue);
        },
      },
    });

    Object.defineProperties(this, {
      'itemTemplate': {
        writable:     true,
        enumerable:   false,
        configurable: true,
        value:        this.getChildrenAsFragment(true) || this.itemTemplate || this.getRawTemplate('mythix-tree-view-item'),
      },
    });

    let $forEach = (this.ownerDocument || document).createElement('mythix-for-each');
    $forEach.addEventListener('item:rendered', this.onForEachItemRendered);
    $forEach.itemTemplate = this.itemTemplate;
    $forEach.setAttribute('of', this.attr('data'));
    $forEach.classList.add('mythix-tree-view-children-container');

    this.appendChild($forEach);

    document.addEventListener('click', this.onClick);
    document.addEventListener('keydown', this.onKeyDown, { capture: true });
  }

  unmounted() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('click', this.onClick);
  }

  onForEachItemRendered(event) {
    if (!event.relatedTarget || event.relatedTarget.nodeType !== Node.ELEMENT_NODE)
      return;

    Utils.metadata(event.relatedTarget, 'mythix-tree-view:item', event.context.item)
  }

  setItemTemplate(element) {
    this.itemTemplate = element;
  }

  renderItemChildren(item) {
    let children = item && item.children;
    if (Utils.isNOE(children))
      return '';

    let $forEach  = (this.ownerDocument || document).createElement('mythix-for-each');
    let template  = this.itemTemplate;
    if (template)
      $forEach.setItemTemplate(template.cloneNode(true));

    $forEach.items = children;
    $forEach.classList.add('mythix-tree-view-children-container');

    $forEach.addEventListener('item:rendered', this.onForEachItemRendered);

    return $forEach;
  }

  itemClasses(item) {
    let children = item && item.children;
    return this.classes({
      'mythix-tree-view-has-children': Utils.isNotNOE(children),
    });
  }

  getClickItem(event) {
    return event.target.closest(ITEM_ELEMENT_TYPE);
  }

  isTopLevelItem($item) {
    let $forEach = this.$forEach;
    if (!$forEach)
      return false;

    return (Array.prototype.indexOf.call($forEach.children, $item) >= 0);
  }

  closeAll(...except) {
    let anyClosed = false;

    const isException = (element) => {
      return except.some((exceptElem) => element && element.contains(exceptElem));
    };

    this.select(`${ITEM_ELEMENT_TYPE}.mythix-tree-view-children-container.mythix-tree-view-expanded`).forEach((element) => {
      if (isException(element))
        return;

      anyClosed = true;
      element.classList.remove('mythix-tree-view-expanded');
    });

    return anyClosed;
  }

  getParentContainers($item) {
    let parentNode  = Utils.getParentNode($item);
    let containers  = [];

    while (parentNode) {
      if (parentNode === this)
        break;

      if (typeof parentNode.matches === 'function' && parentNode.matches(`${ITEM_ELEMENT_TYPE}.mythix-tree-view-children-container`))
        containers.push(parentNode);

      parentNode = Utils.getParentNode(parentNode);
    }

    return containers;
  }

  updateHasFocusClasses($item) {
    if (!$item)
      return;

    this.select('.mythix-tree-view-has-focus').removeClass('mythix-tree-view-has-focus');
    $item.classList.add('mythix-tree-view-has-focus');

    let $parentContainers = this.getParentContainers($item);
    $parentContainers.forEach(($parentContainer) => {
      $parentContainer.classList.add('mythix-tree-view-has-focus');
    });
  }

  openToItem($item, force) {
    let $parentContainers = this.getParentContainers($item);

    this.closeAll($item, ...$parentContainers);

    let isOpening = false;
    if (force == null)
      isOpening = !(($item || $parentContainers[0] || {}).matches('.mythix-tree-view-expanded'));
    else if (force === false)
      isOpening = false;
    else if (force)
      isOpening = true;

    const openOrCloseItem = (isOpening, $item) => {
      if (isOpening)
        $item.classList.add('mythix-tree-view-expanded');
      else
        $item.classList.remove('mythix-tree-view-expanded');
    };

    $parentContainers.reverse().forEach(($parentContainer) => {
      openOrCloseItem(isOpening, $parentContainer);
    });

    if ($item)
      openOrCloseItem(isOpening, $item);

    return isOpening;
  }

  dispatchSelectedEvent($item) {
    let event = new Event('selected');

    event.relatedTarget = $item;
    event.item          = Utils.metadata($item, 'mythix-tree-view:item');

    this.dispatchEvent(event);
  }

  activateItem($item) {
    this._currentFocusedItem = $item;

    if (this.isExpandableItem($item)) {
      this.openToItem($item);
    } else {
      this.dispatchSelectedEvent($item);
      this.closeAll();
    }
  }

  isExpandableItem($item) {
    return !!this.findChildItemContainer($item);
  }

  findChildItemContainer($item) {
    if (!$item || !$item.children)
      return;

    return $item.querySelector(':scope > mythix-for-each.mythix-tree-view-children-container');
  }

  isItemVisible($item) {
    let parentNode = Utils.getParentNode($item);

    while (parentNode) {
      if (parentNode === this)
        return true;

      if (typeof parentNode.matches === 'function' && parentNode.matches(`${ITEM_ELEMENT_TYPE}:not(.mythix-tree-view-expanded)`))
        break;

      parentNode = Utils.getParentNode(parentNode);
    }

    return false;
  }

  selectVisibleItems() {
    let items = this.select(ITEM_ELEMENT_TYPE);
    return items.filter(($item) => this.isItemVisible($item));
  }

  findPreviousItem($item, wrapAround) {
    let items = this.selectVisibleItems();
    let index = items.indexOf($item);
    if (index < 0) {
      if (!$item)
        index = items.length;
      else
        return;
    }

    let $previousItem = items[index - 1];
    if (!$previousItem && wrapAround)
      $previousItem = items[items.length - 1];

    return $previousItem;
  }

  findNextItem($item, wrapAround) {
    let items = this.selectVisibleItems();
    let index = items.indexOf($item);
    if (index < 0) {
      if (!$item)
        index = -1;
      else
        return;
    }

    let $nextItem = items[index + 1];
    if (!$nextItem && wrapAround)
      $nextItem = items[0];

    return $nextItem;
  }

  onKeyDown(event) {
    if (!this.matches(':focus'))
      return;

    let handled = false;
    let $item   = this._currentFocusedItem;

    if (event.code === 'ArrowDown') {
      let $nextItem = this.findNextItem($item, true);
      this._currentFocusedItem = $nextItem;

      handled = true;
    } else if (event.code === 'ArrowUp') {
      let $previousItem = this.findPreviousItem($item, true);
      this._currentFocusedItem = $previousItem;

      handled = true;
    } else if ($item && (event.code === 'Enter' || event.code === 'Space')) {
      this.activateItem($item);
      handled = true;
    }

    if (handled) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }

  onClick(event) {
    if (!this.contains(event.target))
      return;

    this.focus();

    let $item = this.getClickItem(event);
    if (!$item)
      return;

    //console.log('IS LEVEL: ', { topLevel: this.isTopLevelItem($item), expandable: this.isExpandableItem($item), item: $item });

    this.activateItem($item);
  }
}

MythixUITreeView.register();
