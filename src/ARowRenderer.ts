import {ABORTED, IAbortAblePromise, isAbortAble} from './abortAble';
import {defaultPhases, EAnimationMode, IAnimationContext, IAnimationItem, IPhase, noAnimationChange} from './animation';
import KeyFinder from './animation/KeyFinder';
import {IExceptionContext, range} from './logic';
import {EScrollResult, IMixin, IMixinAdapter, IMixinClass} from './mixin';
import {addScroll, removeScroll, IScrollInfo, IDelayedMode, defaultMode} from './internal';
import {cssClass} from './styles';

export declare type IRowRenderContext = IExceptionContext;

export interface IRowRendererOptions {
  /**
   * async update on scrolling
   * animation -> use requestAnimationFrame
   * immediate -> use setImmediate if available
   * sync -> execute within scroll listener
   * {number} -> execute within this delay using setTimeout
   * @default is chrome ? animation else 0
   */
  async: IDelayedMode;

  /**
   * minimal number of pixel the scrollbars has to move
   * @default 10
   */
  minScrollDelta: number;

  // min number of rows that should be added or removed
  batchSize: number;

  /**
   * class of mixins to use for optimized rendering
   */
  mixins: IMixinClass[];

  /**
   * add the scrolling hint class while scrolling to give a user feedback
   */
  scrollingHint: boolean;
}

/**
 * base class for creating a scalable table renderer based on rows
 */
export abstract class ARowRenderer {
  private readonly pool: HTMLElement[] = [];
  private readonly loadingPool: HTMLElement[] = [];
  private readonly loading = new Map<HTMLElement, IAbortAblePromise<void>>();

  private readonly fragment: DocumentFragment;

  /**
   * currently visible slice
   */
  protected readonly visible = {
    first: 0,
    forcedFirst: 0,
    last: -1,
    forcedLast: -1
  };
  /**
   * position of the first visible row in pixel
   * @type {number}
   */
  protected visibleFirstRowPos = 0;

  private readonly adapter: IMixinAdapter;
  private readonly mixins: IMixin[];
  private scrollListener: ((act: IScrollInfo) => void) | null = null;
  protected lastScrollInfo: IScrollInfo|null = null;

  private abortAnimation: () => void = () => undefined;

  protected readonly options: Readonly<IRowRendererOptions> = {
    async: defaultMode,
    minScrollDelta: 10,
    mixins: [],
    scrollingHint: false,
    batchSize: 5
  };

  constructor(protected readonly body: HTMLElement, options: Partial<IRowRendererOptions> = {}) {
    this.adapter = this.createAdapter();
    Object.assign(this.options, options);
    this.mixins = this.options.mixins.map((mixinClass) => new mixinClass(this.adapter));

    this.fragment = body.ownerDocument.createDocumentFragment();
  }

  protected abstract get idPrefix(): string;

  /**
   * register another mixin to this renderer
   * @param {IMixinClass} mixinClass the mixin class to instantitiate
   * @param options optional constructor options
   */
  protected addMixin(mixinClass: IMixinClass, options?: any) {
    this.mixins.push(new mixinClass(this.adapter, options));
  }

  private createAdapter(): IMixinAdapter {
    const r: any = {
      visible: this.visible,
      addAtBeginning: this.addAtBeginning.bind(this),
      addAtBottom: this.addAtBottom.bind(this),
      removeFromBeginning: this.removeFromBeginning.bind(this),
      removeFromBottom: this.removeFromBottom.bind(this),
      updateOffset: this.updateOffset.bind(this)
    };
    Object.defineProperties(r, {
      visibleFirstRowPos: {
        get: () => this.visibleFirstRowPos,
        enumerable: true
      },
      context: {
        get: () => this.context,
        enumerable: true
      },
      scrollOffset: {
        get: () => this.lastScrollInfo ? this.lastScrollInfo.top : 0,
        enumerable: true
      },
      scrollTotal: {
        get: () => this.lastScrollInfo ? this.lastScrollInfo.height : this.bodyScroller.clientHeight,
        enumerable: true
      }
    });
    return r;
  }

  /**
   * get the scrolling container i.e. parent of the body element
   * @returns {HTMLElement}
   */
  protected get bodyScroller() {
    return <HTMLElement>this.body.parentElement;
  }

  protected get bodySizer(): HTMLElement {
    const parent = this.bodyScroller;
    const sizer = (<HTMLElement[]>Array.from(parent.children)).find((d) => d.tagName.toLowerCase() === 'footer');
    if (sizer) {
      return sizer;
    }
    const s = parent.ownerDocument.createElement('footer');
    s.classList.add(cssClass('footer'), cssClass(`footer-${this.idPrefix}`));
    parent.insertBefore(s, parent.firstChild);
    return s;
  }

  /**
   * the current render context, upon change `recreate` the whole table
   * @returns {IRowRenderContext}
   */
  protected abstract get context(): IRowRenderContext;

  /**
   * creates a new row
   * @param {HTMLElement} node the node of the row
   * @param {number} index the row index
   * @returns {IAbortAblePromise<void> | void} either an abortable or nothing
   */
  protected abstract createRow(node: HTMLElement, index: number): IAbortAblePromise<void> | void;

  /**
   * updates a row
   * @param {HTMLElement} node the node of the row
   * @param {number} index the row index
   * @returns {IAbortAblePromise<void> | void} either an abortable or nothing
   */
  protected abstract updateRow(node: HTMLElement, index: number): IAbortAblePromise<void> | void;

  /**
   * initializes the table and register the onscroll listener
   * @returns {void} nothing
   */
  protected init() {
    const scroller = this.bodyScroller;

    let old = addScroll(scroller, this.options.async, this.scrollListener = (act) => {
      this.lastScrollInfo = act;
      if (Math.abs(old.top - act.top) < this.options.minScrollDelta && Math.abs(old.height - act.height) < this.options.minScrollDelta) {
        return;
      }
      const isGoingDown = act.top > old.top;
      old = act;
      this.onScrolledVertically(act.top, act.height, isGoingDown);
      if (this.options.scrollingHint) {
        scroller.classList.remove(cssClass('scrolling'));
      }
    });
    if (this.options.scrollingHint) {
      addScroll(scroller, 'animation', () => scroller.classList.add(cssClass('scrolling')));
    }
    this.recreate();
  }


  /**
   * destroys this renderer and unregisters all event listeners
   */
  destroy() {
    removeScroll(this.bodyScroller, this.scrollListener!);
    this.body.remove();
  }

  private static cleanUp(item: HTMLElement) {
    if (item.style.height) {
      item.style.height = null;
    }
  }

  private select(index: number): {item: HTMLElement, result: IAbortAblePromise<void> | void} {
    let item: HTMLElement;
    let result: IAbortAblePromise<void> | void;
    if (this.pool.length > 0) {
      item = this.pool.pop()!;
      result = this.updateRow(item, index);
    } else if (this.loadingPool.length > 0) {
      item = this.loadingPool.pop()!;
      item.classList.remove(cssClass('loading'));
      result = this.createRow(item, index);
    } else {
      item = this.body.ownerDocument.createElement('div');
      result = this.createRow(item, index);
    }
    item.dataset.index = String(index);
    item.classList.add(cssClass('tr'), cssClass(`tr-${this.idPrefix}`));
    return {item, result};
  }

  private selectProxy() {
    let proxy: HTMLElement;
    if (this.loadingPool.length > 0) {
      proxy = this.loadingPool.pop()!;
    } else {
      proxy = this.body.ownerDocument.createElement('div');
      proxy.classList.add(cssClass('loading'), cssClass('tr'), cssClass(`tr-${this.idPrefix}`));
    }
    return proxy;
  }

  private recycle(item: HTMLElement) {
    ARowRenderer.cleanUp(item);
    // check if the original dom element is still being manipulated
    if (this.loading.has(item)) {
      const abort = this.loading.get(item)!;
      abort.abort();
    } else {
      this.pool.push(item);
    }
  }

  private proxy(item: HTMLElement, result: IAbortAblePromise<void> | void) {
    if (!isAbortAble(result)) {
      return item;
    }
    const abort = result;
    //lazy loading

    const real = item;
    const proxy = this.selectProxy();
    // copy attributes
    proxy.dataset.index = real.dataset.index;
    proxy.style.height = real.style.height;

    this.loading.set(proxy, abort);
    abort.then((result) => {
      if (result === ABORTED) {
        //aborted can recycle the real one
        ARowRenderer.cleanUp(real);
        this.pool.push(real);
      } else {
        //fully loaded
        this.body.replaceChild(real, proxy);
      }
      this.loading.delete(proxy);
      ARowRenderer.cleanUp(proxy);
      this.loadingPool.push(proxy);
    });
    return proxy;
  }

  private create(index: number) {
    const {item, result} = this.select(index);

    const {exceptionsLookup: ex, padding} = this.context;
    if (ex.has(index)) {
      item.style.height = `${ex.get(index)! - padding(index)}px`;
    }

    return this.proxy(item, result);
  }

  private removeAll() {
    const arr = <HTMLElement[]>Array.from(this.body.children);
    this.body.innerHTML = '';
    arr.forEach((item) => {
      this.recycle(item);
    });
  }


  /**
   * triggers and visual update of all visible rows
   */
  protected update() {
    const first = this.visible.first;
    const fragment = this.fragment;
    const items = <HTMLElement[]>Array.from(this.body.children);
    this.body.innerHTML = '';
    items.forEach((item: HTMLElement, i) => {
      if (this.loading.has(item)) {
        // still loading
        return;
      }
      const abort = this.updateRow(item, i + first);

      fragment.appendChild(this.proxy(item, abort));
    });
    this.body.appendChild(fragment);
  }

  /**
   * utility to execute a function for each visible row
   * @param {(row: HTMLElement, rowIndex: number) => void} callback callback to execute
   * @param {boolean} inplace whether the DOM changes should be performed inplace instead of in a fragment
   */
  protected forEachRow(callback: (row: HTMLElement, rowIndex: number) => void, inplace: boolean = false) {
    const rows = <HTMLElement[]>Array.from(this.body.children);
    const fragment = this.fragment;
    if (!inplace) {
      this.body.innerHTML = '';
    }
    rows.forEach((row: HTMLElement, index) => {
      if (!row.classList.contains(cssClass('loading')) && row.dataset.animation !== 'update_remove' && row.dataset.animation !== 'hide') {
        //skip loading ones and temporary ones
        callback(row, index + this.visible.first);
      }
      if (!inplace) {
        fragment.appendChild(row);
      }
    });
    if (!inplace) {
      this.body.appendChild(fragment);
    }
  }

  private removeFromBeginning(from: number, to: number) {
    return this.remove(from, to, true);
  }

  private removeFromBottom(from: number, to: number) {
    return this.remove(from, to, false);
  }

  private remove(from: number, to: number, fromBeginning: boolean) {
    if (to < from) {
      return;
    }
    // console.log('remove', fromBeginning, (to - from) + 1, this.body.childElementCount - ((to - from) + 1));
    for (let i = from; i <= to; ++i) {
      const item = <HTMLElement>(fromBeginning ? this.body.firstChild : this.body.lastChild);
      item.remove();
      this.recycle(item);
    }
  }

  private addAtBeginning(from: number, to: number) {
    if (to < from) {
      return;
    }
    // console.log('add', (to - from) + 1, this.body.childElementCount + ((to - from) + 1));
    if (from === to) {
      this.body.insertBefore(this.create(from), this.body.firstChild);
      return;
    }
    const fragment = this.fragment;
    for (let i = from; i <= to; ++i) {
      fragment.appendChild(this.create(i));
    }
    this.body.insertBefore(fragment, this.body.firstChild);
  }

  private addAtBottom(from: number, to: number) {
    if (to < from) {
      return;
    }
    // console.log('add_b', (to - from) + 1, this.body.childElementCount + ((to - from) + 1));
    if (from === to) {
      this.body.appendChild(this.create(from));
      return;
    }
    const fragment = this.fragment;
    for (let i = from; i <= to; ++i) {
      fragment.appendChild(this.create(i));
    }
    this.body.appendChild(fragment);
  }

  protected updateOffset(firstRowPos: number) {
    this.visibleFirstRowPos = firstRowPos;

    //odd start patch for correct background
    this.body.classList.toggle(cssClass('odd'), this.visible.first % 2 === 1);
    this.updateSizer(firstRowPos);
  }

  protected updateSizer(firstRowPos: number) {
    const {totalHeight} = this.context;
    this.body.style.transform = `translate(0, ${firstRowPos.toFixed(0)}px)`;
    this.bodySizer.style.transform = `translate(0, ${Math.max(0, totalHeight - 1).toFixed(0)}px)`;
  }

  /**
   * removes all rows and recreates the table
   * @param {IAnimationContext} ctx optional animation context to create a transition between the previous and the current tables
   * @returns {void} nothing
   */
  protected recreate(ctx?: IAnimationContext) {
    this.abortAnimation();
    if (ctx) {
      return this.recreateAnimated(ctx);
    }
    return this.recreatePure();
  }

  private recreatePure() {
    const context = this.context;

    const scroller = this.bodyScroller;

    //update first to avoid resetting scrollTop
    this.updateOffset(0);

    this.removeAll();
    this.clearPool();

    const {first, last, firstRowPos} = range(scroller.scrollTop, scroller.clientHeight, context.defaultRowHeight, context.exceptions, context.numberOfRows);

    this.visible.first = this.visible.forcedFirst = first;
    this.visible.last = this.visible.forcedLast = last;

    if (first < 0) {
      // empty
      this.updateOffset(0);
      return;
    }
    this.addAtBottom(first, last);
    this.updateOffset(firstRowPos);
  }


  private recreateAnimated(ctx: IAnimationContext) {
    const lookup = new Map<string, {n: HTMLElement, pos: number, i: number}>();
    const prev = new KeyFinder(ctx.previous, ctx.previousKey);
    const cur = new KeyFinder(this.context, ctx.currentKey);
    const next = range(this.bodyScroller.scrollTop, this.bodyScroller.clientHeight, cur.context.defaultRowHeight, cur.context.exceptions, cur.context.numberOfRows);

    {
      const rows = <HTMLElement[]>Array.from(this.body.children);
      const old = Object.assign({}, this.visible);
      //store the current rows in a lookup and clear

      this.body.innerHTML = ``;

      prev.positions(old.first, Math.min(old.last, old.first + rows.length), this.visibleFirstRowPos, (i, key, pos) => {
        const n = rows[i];
        if (n) { // shouldn't happen that it is not there
          lookup.set(key, {n, pos, i});
        }
        // else {
        //  console.error(i, key, pos, rows);
        //}
      });
    }

    this.visible.first = this.visible.forcedFirst = next.first;
    this.visible.last = this.visible.forcedLast = next.last;

    const fragment = this.fragment;
    const animation: IAnimationItem[] = [];

    let nodeY = next.firstRowPos;
    cur.positions(next.first, next.last, next.firstRowPos, (i, key, pos) => {
      let node: HTMLElement;
      let mode: EAnimationMode = EAnimationMode.UPDATE;
      let previous: {
        index: number | -1;
        y: number;
        height: number | null;
      };
      if (lookup.has(key)) {
        // still visible
        const item = lookup.get(key)!;
        lookup.delete(key);

        // update height

        item.n.dataset.index = String(i);
        node = this.proxy(item.n, this.updateRow(item.n, i));
        previous = {
          index: item.i,
          y: item.pos,
          height: prev.exceptionHeightOf(item.i, true)
        };
      } else {
        // need a new row
        const old = prev.posByKey(key);
        // maybe not visible  before so keep in place
        node = this.create(i);

        mode = old.index < 0 ? EAnimationMode.SHOW : EAnimationMode.UPDATE_CREATE;
        previous = {
          index: old.index,
          y: old.pos >= 0 ? old.pos : pos,
          height: old.index < 0 ? cur.exceptionHeightOf(i, true) : prev.exceptionHeightOf(old.index, true)
        };
      }
      animation.push({
        node,
        key,
        mode,
        previous,
        nodeY,
        nodeYCurrentHeight: pos,
        current: {
          index: i,
          y: pos,
          height: cur.exceptionHeightOf(i)
        }
      });
      node.style.transform = `translate(0, ${nodeY - pos}px)`;
      nodeY += previous.height! + (previous.index < 0 ? cur.padding(i) : prev.padding(previous.index));

      fragment.appendChild(node);
    });

    let nodeYCurrentHeight = next.endPos;
    // items that are going to be removed
    lookup.forEach((item, key) => {
      // calculate their next position
      const r = cur.posByKey(key);

      // maybe not visible anymore, keep in place
      const nextPos = r.pos >= 0 ? r.pos : item.pos;
      const node = item.n;
      // located at addedPos
      // should end up at nextPos
      // was previously at item.pos
      node.style.transform = `translate(0, ${item.pos - nodeY}px)`;
      fragment.appendChild(node);

      const prevHeight = prev.exceptionHeightOf(item.i, true);

      animation.push({
        node: item.n,
        key,
        mode: r.index < 0 ? EAnimationMode.HIDE : EAnimationMode.UPDATE_REMOVE,
        previous: {
          index: item.i,
          y: item.pos,
          height: prevHeight
        },
        nodeY,
        nodeYCurrentHeight,
        current: {
          index: r.index,
          y: nextPos,
          height: r.index < 0 ? null : cur.exceptionHeightOf(r.index)
        }
      });
      nodeYCurrentHeight += r.index < 0 ? cur.context.defaultRowHeight : (cur.exceptionHeightOf(r.index, true)! + cur.padding(r.index));
      nodeY += prevHeight! + prev.padding(item.i);
    });

    this.updateOffset(next.firstRowPos);

    this.animate(animation, ctx.phases || defaultPhases, prev, cur, fragment);
  }

  private animate(animation: IAnimationItem[], phases: IPhase[], previousFinder: KeyFinder, currentFinder: KeyFinder, fragment: DocumentFragment) {
    if (animation.length <= 0) {
      this.body.appendChild(fragment);
      return;
    }

    let currentTimer: any = -1;
    let actPhase = 0;

    const executePhase = (phase: IPhase, items = animation) => {
      items.forEach((anim) => phase.apply(anim, previousFinder, currentFinder));
    };

    const run = () => {
      //dummy log for forcing dom update
      console.assert(animation[0]!.node.offsetTop >= 0, 'dummy log for forcing dom update');
      executePhase(phases[actPhase++]);

      // shifted by one since already added through ++
      if (actPhase < phases.length) {
        // schedule the next one
        const next = phases[actPhase]!;
        currentTimer = self.setTimeout(run, next.delay);
        return;
      }

      // last one
      const body = this.body.classList;
      Array.from(body).forEach((v) => {
        if (v.startsWith(cssClass()) && v.endsWith('-animation')) {
          body.remove(v);
        }
      });
      // clean up
      animation.forEach(({node, mode}) => {
        if (mode !== EAnimationMode.UPDATE_REMOVE && mode !== EAnimationMode.HIDE) {
          return;
        }
        node.remove();
        node.style.transform = null;
        this.recycle(node);
      });
      this.abortAnimation = () => undefined;
      currentTimer = -1;
    };

    // execute all phases having a delay of zero
    while (phases[actPhase].delay === 0) {
      executePhase(phases[actPhase++]);
    }
    // after the initial one
    const body = this.body;
    this.body.appendChild(fragment);

    const dummyAnimation: IAnimationItem[] = [];
    animation = animation.filter((d) => {
      if (noAnimationChange(d, previousFinder.context.defaultRowHeight, currentFinder.context.defaultRowHeight)) {
        dummyAnimation.push(d);
        return false;
      }
      return true;
    });

    if (dummyAnimation.length > 0) {
      // execute all phases for them
      phases.slice(actPhase).forEach((phase) => executePhase(phase, dummyAnimation));
    }

    if (animation.length === 0) {
      return;
    }

    body.classList.add(cssClass('row-animation'));
    (new Set(animation.map((d) => d.mode))).forEach((mode) => {
      // add class but map to UPDATE only
      body.classList.add(cssClass(`${EAnimationMode[mode].toLowerCase().split('_')[0]}-animation`));
    });

    this.abortAnimation = () => {
      if (currentTimer <= 0) {
        return;
      }
      // abort by removing
      clearTimeout(currentTimer);
      currentTimer = -1;
      // run the last phase
      actPhase = phases.length - 1;
      run();
    };

    // next tick such that DOM will be updated
    currentTimer = self.setTimeout(run, phases[actPhase].delay);
  }

  /**
   * clears the row pool used for faster creation
   */
  protected clearPool() {
    // clear pool
    this.pool.splice(0, this.pool.length);
  }

  /**
   * triggers a revalidation of the current scrolling offest
   */
  protected revalidate() {
    const scroller = this.bodyScroller;
    this.onScrolledVertically(scroller.scrollTop, scroller.clientHeight, true);
    this.updateOffset(this.visibleFirstRowPos);
  }

  /**
   * scrolling vertically
   * @param {number} scrollTop top scrolling
   * @param {number} clientHeight visible height
   * @param {boolean} isGoingDown hint whether the scrollTop increases
   * @return {EScrollResult} full in case of a full rebuild or partial update
   */
  protected onScrolledVertically(scrollTop: number, clientHeight: number, isGoingDown: boolean): EScrollResult {
    const scrollResult = this.onScrolledImpl(scrollTop, clientHeight);
    for (const mixin of this.mixins) {
      mixin.onScrolled(isGoingDown, scrollResult);
    }
    return scrollResult;
  }

  private shiftLast(current: number, currentDelta: number) {
    const b = this.options.batchSize;
    if (currentDelta >= b) {
      return current;
    }
    const total = this.context.numberOfRows;
    return Math.min(total - 1, current + (this.options.batchSize - currentDelta));
  }

  private shiftFirst(current: number, currentFirstRow: number, currentDelta: number) {
    const b = this.options.batchSize;
    if (currentDelta >= b || current <= 0) {
      return {first: current, firstRowPos: currentFirstRow};
    }
    const first = Math.max(0, current - (this.options.batchSize - currentDelta));

    const {exceptionsLookup, defaultRowHeight} = this.context;
    let firstRowPos = currentFirstRow;
    for(let i = first; i < current; ++i) {
      if (exceptionsLookup.has(i)) {
        firstRowPos -= exceptionsLookup.get(i)!;
      } else {
        firstRowPos -= defaultRowHeight;
      }
    }
    return {first, firstRowPos};
  }

  private onScrolledImpl(scrollTop: number, clientHeight: number): EScrollResult {
    const context = this.context;
    let {first, last, firstRowPos} = range(scrollTop, clientHeight, context.defaultRowHeight, context.exceptions, context.numberOfRows);

    const visible = this.visible;
    visible.forcedFirst = first;
    visible.forcedLast = last;

    if ((first - visible.first) >= 0 && (last - visible.last) <= 0) {
      //nothing to do
      return EScrollResult.NONE;
    }

    let r: EScrollResult = EScrollResult.SOME;

    if (first > visible.last || last < visible.first) {
      //no overlap, clean and draw everything
      //console.log(`ff added: ${last - first + 1} removed: ${visibleLast - visibleFirst + 1} ${first}:${last} ${offset}`);
      //removeRows(visibleFirst, visibleLast);

      this.removeAll();
      this.addAtBottom(first, last);
      r = EScrollResult.ALL;
    } else if (first < visible.first) {
      //some first rows missing and some last rows to much
      //console.log(`up added: ${visibleFirst - first + 1} removed: ${visibleLast - last + 1} ${first}:${last} ${offset}`);
      const toRemove = visible.last - (last + 1);
      if (toRemove >= this.options.batchSize) {
        this.removeFromBottom(last + 1, visible.last);
      } else {
        last = visible.last;
      }

      const shift = this.shiftFirst(first, firstRowPos, visible.first - 1 - first);
      first = shift.first;
      firstRowPos = shift.firstRowPos;
      this.addAtBeginning(first, visible.first - 1);
      r = EScrollResult.SOME_TOP;
    } else {
      //console.log(`do added: ${last - visibleLast + 1} removed: ${first - visibleFirst + 1} ${first}:${last} ${offset}`);
      //some last rows missing and some first rows to much
      const toRemove = first - 1 - visible.first;
      if (toRemove >= this.options.batchSize) {
        this.removeFromBeginning(visible.first, first - 1);
      } else {
        first = visible.first;
        firstRowPos = this.visibleFirstRowPos;
      }

      last = this.shiftLast(last, last - visible.last + 1);

      this.addAtBottom(visible.last + 1, last);
      r = EScrollResult.SOME_BOTTOM;
    }

    visible.first = first;
    visible.last = last;

    this.updateOffset(firstRowPos);
    return r;
  }
}

export default ARowRenderer;
