import { ABORTED, IAbortAblePromise, isAbortAble } from './abortAble';
import {
  defaultPhases,
  EAnimationMode,
  IAnimationContext,
  IAnimationItem,
  IPhase,
  noAnimationChange,
} from './animation';
import KeyFinder from './animation/KeyFinder';
import { addScroll, clear, defaultMode, IDelayedMode, IScrollInfo, removeScroll } from './internal';
import { isScrollEventWaiting } from './internal/scroll';
import { IExceptionContext, range } from './logic';
import { EScrollResult, IMixin, IMixinAdapter, IMixinClass } from './mixin';
import {
  cssClass,
  CSS_CLASS_EVEN,
  CSS_CLASS_FOOTER,
  CSS_CLASS_LOADING,
  CSS_CLASS_ROW_ANIMATION,
  CSS_CLASS_SCROLLING,
  CSS_CLASS_TR,
} from './styles';

export declare type IRowRenderContext = IExceptionContext;

export function isLoadingCell(node: HTMLElement): boolean {
  return node.classList.contains(CSS_CLASS_LOADING);
}

export interface IRowRendererOptions {
  /**
   * async update on scrolling
   * animation -> use requestAnimationFrame
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

  /**
   * min number of rows that should be added or removed
   * @default 10
   */
  batchSize: number;

  /**
   * number of pixels the viewport is virtually larger
   * @default 200
   */
  viewportOversize: number;

  /**
   * class of mixins to use for optimized rendering
   */
  mixins: IMixinClass[];

  /**
   * add the scrolling hint class while scrolling to give a user feedback
   */
  scrollingHint: boolean;

  /**
   * whether background striping should be enabled
   */
  striped: boolean;
}

/**
 * base class for creating a scalable table renderer based on rows
 */
export abstract class ARowRenderer {
  private readonly pool: HTMLElement[] = [];

  private readonly loadingPool: HTMLElement[] = [];

  private readonly loading = new WeakMap<HTMLElement, IAbortAblePromise<void>>();

  private readonly fragment: DocumentFragment;

  /**
   * currently visible slice
   */
  protected readonly visible = {
    first: 0,
    forcedFirst: 0,
    last: -1,
    forcedLast: -1,
  };

  /**
   * position of the first visible row in pixel
   * @type {number}
   */
  protected visibleFirstRowPos = 0;

  private readonly adapter: IMixinAdapter;

  private readonly mixins: IMixin[];

  private scrollListener: ((act: IScrollInfo) => void) | null = null;

  protected lastScrollInfo: IScrollInfo | null = null;

  private abortAnimation: () => void = () => undefined;

  protected readonly options: Readonly<IRowRendererOptions> = {
    async: defaultMode,
    minScrollDelta: 10,
    mixins: [],
    scrollingHint: false,
    batchSize: 10,
    striped: false,
    viewportOversize: 200,
  };

  constructor(
    protected readonly body: HTMLElement,
    options: Partial<IRowRendererOptions> = {}
  ) {
    this.adapter = this.createAdapter();
    Object.assign(this.options, options);
    this.mixins = this.options.mixins.map((MixinClass) => new MixinClass(this.adapter));

    this.fragment = body.ownerDocument.createDocumentFragment();
  }

  protected abstract get idPrefix(): string;

  /**
   * register another mixin to this renderer
   * @param {IMixinClass} MixinClass the mixin class to instantiate
   * @param options optional constructor options
   */
  protected addMixin(MixinClass: IMixinClass, options?: unknown): void {
    this.mixins.push(new MixinClass(this.adapter, options));
  }

  private createAdapter(): IMixinAdapter {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;
    return {
      visible: this.visible,
      addAtBeginning: (from, to) => this.addAtBeginning(from, to),
      addAtBottom: this.addAtBottom.bind(this),
      removeFromBeginning: (from, to) => this.removeFromBeginning(from, to),
      removeFromBottom: this.removeFromBottom.bind(this),
      updateOffset: this.updateOffset.bind(this),
      isScrollEventWaiting: () => isScrollEventWaiting(this.bodyScroller, this.options.async),
      get visibleFirstRowPos() {
        return that.visibleFirstRowPos;
      },
      get context() {
        return that.context;
      },
      get scrollOffset() {
        return that.lastScrollInfo ? that.lastScrollInfo.top : 0;
      },
      get scrollTotal() {
        return that.lastScrollInfo ? that.lastScrollInfo.height : that.bodyScroller.clientHeight;
      },
    };
  }

  /**
   * get the scrolling container i.e. parent of the body element
   * @returns {HTMLElement}
   */
  protected get bodyScroller(): HTMLElement {
    return this.body.parentElement as HTMLElement;
  }

  protected get bodySizer(): HTMLElement {
    const parent = this.bodyScroller;
    const sizer = (Array.from(parent.children) as HTMLElement[]).find((d) => d.tagName.toLowerCase() === 'footer');
    if (sizer) {
      return sizer;
    }
    const s = parent.ownerDocument.createElement('footer');
    s.classList.add(CSS_CLASS_FOOTER, cssClass(`footer-${this.idPrefix}`));
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
  protected init(): void {
    const scroller = this.bodyScroller;

    let old = addScroll(
      scroller,
      this.options.async,
      (this.scrollListener = (act) => {
        this.lastScrollInfo = act;
        if (
          Math.abs(old.top - act.top) < this.options.minScrollDelta &&
          Math.abs(old.height - act.height) < this.options.minScrollDelta
        ) {
          return;
        }
        const isGoingDown = act.top > old.top;
        old = act;
        this.onScrolledVertically(act.top, act.height, isGoingDown);
        if (this.options.scrollingHint) {
          this.body.classList.remove(CSS_CLASS_SCROLLING);
        }
      })
    );
    if (this.options.scrollingHint) {
      addScroll(scroller, 'animation', () => this.body.classList.add(CSS_CLASS_SCROLLING));
    }
    this.recreate();
  }

  /**
   * destroys this renderer and unregisters all event listeners
   */
  destroy(): void {
    if (this.scrollListener) {
      removeScroll(this.bodyScroller, this.scrollListener);
    }
    this.body.remove();
  }

  private static cleanUp(item: HTMLElement) {
     
    item.style.height = '';
  }

  private select(index: number): { item: HTMLElement; result: IAbortAblePromise<void> | void } {
    let item: HTMLElement | undefined = this.pool.pop();
    let result: IAbortAblePromise<void> | void;
    if (item != null) {
      result = this.updateRow(item, index);
    } else {
      item = this.loadingPool.pop();
      if (item != null) {
        item.classList.remove(CSS_CLASS_LOADING);
        result = this.createRow(item, index);
      } else {
        item = this.body.ownerDocument.createElement('div');
        item.classList.add(CSS_CLASS_TR, cssClass(`tr-${this.idPrefix}`));
        result = this.createRow(item, index);
      }
    }
    item.dataset.index = String(index);
    if (this.options.striped) {
      item.classList.toggle(CSS_CLASS_EVEN, index % 2 === 0);
    }
    return { item, result };
  }

  private selectProxy() {
    let proxy = this.loadingPool.pop();
    if (proxy == null) {
      proxy = this.body.ownerDocument.createElement('div');
      proxy.classList.add(CSS_CLASS_LOADING, CSS_CLASS_TR, cssClass(`tr-${this.idPrefix}`));
    }
    return proxy;
  }

  private recycle(item: HTMLElement) {
    ARowRenderer.cleanUp(item);
    // check if the original dom element is still being manipulated
    const abort = this.loading.get(item);
    if (abort != null) {
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
    // lazy loading

    const real = item;
    const proxy = this.selectProxy();
    // copy attributes
    proxy.dataset.index = real.dataset.index;
    proxy.style.height = real.style.height;

    this.loading.set(proxy, abort);
    abort.then(
      (abortResult) => {
        if (abortResult === ABORTED) {
          // aborted can recycle the real one
          ARowRenderer.cleanUp(real);
          this.pool.push(real);
        } else {
          // fully loaded
          this.body.replaceChild(real, proxy);
        }
        this.loading.delete(proxy);
        ARowRenderer.cleanUp(proxy);
        this.loadingPool.push(proxy);
      },
      () => {
        // handle as aborted
        // aborted can recycle the real one
        ARowRenderer.cleanUp(real);
        this.pool.push(real);

        this.loading.delete(proxy);
        ARowRenderer.cleanUp(proxy);
        this.loadingPool.push(proxy);
      }
    );
    return proxy;
  }

  private create(index: number) {
    const { item, result } = this.select(index);

    const { exceptionsLookup: ex, padding } = this.context;
    const exceptionHeight = ex.get(index);
    if (exceptionHeight != null) {
      item.style.height = `${exceptionHeight - padding(index)}px`;
    }

    return this.proxy(item, result);
  }

  private removeAll(perform = true) {
    const b = this.body;
    if (!perform) {
      return Array.from(b.children) as HTMLElement[];
    }
    const toRecycle: HTMLElement[] = [];
    while (b.lastElementChild) {
      const i = b.lastElementChild as HTMLElement;
      b.removeChild(i);
      this.recycle(i);
      toRecycle.push(i);
    }
    return toRecycle;
  }

  /**
   * triggers and visual update of all visible rows
   */
  protected update(): void {
    const { first } = this.visible;
    const { fragment } = this;
    const items = Array.from(this.body.children) as HTMLElement[];
    clear(this.body);
    items.forEach((item: HTMLElement, i) => {
      if (this.loading.has(item)) {
        // still loading
        fragment.appendChild(item);
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
   * @param {boolean} inPlace whether the DOM changes should be performed in place instead of in a fragment
   */
  protected forEachRow(callback: (row: HTMLElement, rowIndex: number) => void, inPlace = false): void {
    const rows = Array.from(this.body.children) as HTMLElement[];
    const { fragment } = this;
    if (!inPlace) {
      clear(this.body);
    }
    rows.forEach((row: HTMLElement, index) => {
      if (!isLoadingCell(row) && row.dataset.animation !== 'update_remove' && row.dataset.animation !== 'hide') {
        // skip loading ones and temporary ones
        callback(row, index + this.visible.first);
      }
      if (!inPlace) {
        fragment.appendChild(row);
      }
    });
    if (!inPlace) {
      this.body.appendChild(fragment);
    }
  }

  private removeFromBeginning(from: number, to: number, perform = true) {
    return this.remove(from, to, true, perform);
  }

  private removeFromBottom(from: number, to: number, perform = true) {
    return this.remove(from, to, false, perform);
  }

  private remove(from: number, to: number, fromBeginning: boolean, perform = true) {
    if (to < from) {
      return [];
    }
    const b = this.body;
    const toRecycle: HTMLElement[] = [];
    // console.log('remove', fromBeginning, (to - from) + 1, this.body.childElementCount - ((to - from) + 1));
    let act = (fromBeginning ? b.firstChild : b.lastChild) as HTMLElement;
    for (let i = from; i <= to; i += 1) {
      const item = act;
      act = (fromBeginning ? act.nextSibling : act.previousSibling) as HTMLElement;

      if (perform) {
        b.removeChild(item);
        this.recycle(item);
      }
      toRecycle.push(item);
    }
    return toRecycle;
  }

  private addAtBeginning(from: number, to: number, perform = true) {
    if (to < from) {
      return null;
    }
    // console.log('add', (to - from) + 1, this.body.childElementCount + ((to - from) + 1));
    const { fragment } = this;
    if (from === to && perform) {
      this.body.insertBefore(this.create(from), this.body.firstChild);
      return null;
    }
    for (let i = from; i <= to; i += 1) {
      fragment.appendChild(this.create(i));
    }
    if (perform) {
      this.body.insertBefore(fragment, this.body.firstChild);
    }
    return fragment;
  }

  private addAtBottom(from: number, to: number, perform = true) {
    if (to < from) {
      return null;
    }
    // console.log('add_b', (to - from) + 1, this.body.childElementCount + ((to - from) + 1));
    if (from === to && perform) {
      this.body.appendChild(this.create(from));
      return null;
    }
    const { fragment } = this;
    for (let i = from; i <= to; i += 1) {
      fragment.appendChild(this.create(i));
    }
    if (perform) {
      this.body.appendChild(fragment);
    }
    return fragment;
  }

  protected updateOffset(firstRowPos: number): void {
    this.visibleFirstRowPos = firstRowPos;

    this.updateSizer(firstRowPos);
  }

  protected updateSizer(firstRowPos: number): void {
    const { totalHeight } = this.context;
    setTransform(this.body, 0, firstRowPos.toFixed(0));
    setTransform(this.bodySizer, 0, Math.max(0, totalHeight - 1).toFixed(0));
  }

  /**
   * removes all rows and recreates the table
   * @param {IAnimationContext} ctx optional animation context to create a transition between the previous and the current tables
   * @returns {void} nothing
   */
  protected recreate(ctx?: IAnimationContext): void {
    this.abortAnimation();
    if (ctx) {
      return this.recreateAnimated(ctx);
    }
    return this.recreatePure();
  }

  private recreatePure() {
    const { context } = this;

    const scroller = this.bodyScroller;

    // update first to avoid resetting scrollTop
    this.updateOffset(0);

    this.removeAll();
    this.clearPool();

    const { first, last, firstRowPos } = range(
      scroller.scrollTop,
      scroller.clientHeight,
      context.defaultRowHeight,
      context.exceptions,
      context.numberOfRows
    );

    this.visible.first = first;
    this.visible.forcedFirst = first;
    this.visible.last = last;
    this.visible.forcedLast = last;

    if (first < 0) {
      // empty
      this.updateOffset(0);
      return;
    }
    this.addAtBottom(first, last);
    this.updateOffset(firstRowPos);
  }

  private recreateAnimated(ctx: IAnimationContext) {
    const lookup = new Map<string, { n: HTMLElement; pos: number; i: number }>();
    const prev = new KeyFinder(ctx.previous, ctx.previousKey);
    const cur = new KeyFinder(this.context, ctx.currentKey);
    const next = range(
      this.bodyScroller.scrollTop,
      this.bodyScroller.clientHeight,
      cur.context.defaultRowHeight,
      cur.context.exceptions,
      cur.context.numberOfRows
    );

    {
      const rows = Array.from(this.body.children) as HTMLElement[];
      const old = { ...this.visible };
      // store the current rows in a lookup and clear

      clear(this.body);

      prev.positions(old.first, Math.min(old.last, old.first + rows.length), this.visibleFirstRowPos, (i, key, pos) => {
        const n = rows[i];
        if (n) {
          // shouldn't happen that it is not there
          lookup.set(key, { n, pos, i });
        }
        // else {
        //  console.error(i, key, pos, rows);
        // }
      });
    }

    this.visible.first = next.first;
    this.visible.forcedFirst = next.first;
    this.visible.last = next.last;
    this.visible.forcedLast = next.last;

    const { fragment } = this;
    const animation: IAnimationItem[] = [];

    let nodeY = next.firstRowPos;
    cur.positions(next.first, next.last, next.firstRowPos, (i, key, pos) => {
      let node: HTMLElement;
      let mode: EAnimationMode = EAnimationMode.UPDATE;
      let previous: {
        index: number | -1;
        y: number;
        height: number;
      };
      const item = lookup.get(key);
      if (item != null) {
        // still visible
        lookup.delete(key);

        // update height

        item.n.dataset.index = String(i);
        node = this.proxy(item.n, this.updateRow(item.n, i));
        previous = {
          index: item.i,
          y: item.pos,
          height: prev.exceptionHeightOf(item.i, true),
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
          height: old.index < 0 ? cur.exceptionHeightOf(i, true) : prev.exceptionHeightOf(old.index, true),
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
          height: cur.exceptionHeightOf(i),
        },
      });
      node.style.transform = `translate(0, ${nodeY - pos}px)`;
      nodeY += previous.height + (previous.index < 0 ? cur.padding(i) : prev.padding(previous.index));

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
          height: prevHeight,
        },
        nodeY,
        nodeYCurrentHeight,
        current: {
          index: r.index,
          y: nextPos,
          height: r.index < 0 ? null : cur.exceptionHeightOf(r.index),
        },
      });
      nodeYCurrentHeight +=
        r.index < 0 ? cur.context.defaultRowHeight : cur.exceptionHeightOf(r.index, true) + cur.padding(r.index);
      nodeY += prevHeight + prev.padding(item.i);
    });

    this.updateOffset(next.firstRowPos);

    this.animate(animation, ctx.phases || defaultPhases, prev, cur, fragment);
  }

  private animate(
    animation: IAnimationItem[],
    phases: IPhase[],
    previousFinder: KeyFinder,
    currentFinder: KeyFinder,
    fragment: DocumentFragment
  ) {
    let activeAnimation = animation;
    if (activeAnimation.length <= 0) {
      this.body.appendChild(fragment);
      return;
    }

    let currentTimer = -1;
    let actPhase = 0;

    const executePhase = (phase: IPhase, items = activeAnimation) => {
      items.forEach((anim) => phase.apply(anim, previousFinder, currentFinder));
    };

    const run = () => {
      // dummy log for forcing dom update
       
      console.assert(activeAnimation[0].node.offsetTop >= 0, 'dummy log for forcing dom update');
      executePhase(phases[actPhase]);
      actPhase += 1;
      // shifted by one since already added through ++
      if (actPhase < phases.length) {
        // schedule the next one
        const next = phases[actPhase];
         
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
      activeAnimation.forEach(({ node, mode }) => {
        if (mode !== EAnimationMode.UPDATE_REMOVE && mode !== EAnimationMode.HIDE) {
          return;
        }
        node.remove();
         
        node.style.transform = '';
        this.recycle(node);
      });
      this.abortAnimation = () => undefined;
      currentTimer = -1;
    };

    // execute all phases having a delay of zero
    while (phases[actPhase].delay === 0) {
      executePhase(phases[actPhase]);
      actPhase += 1;
    }
    // after the initial one
    const { body } = this;
    this.body.appendChild(fragment);

    const dummyAnimation: IAnimationItem[] = [];
    activeAnimation = activeAnimation.filter((d) => {
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

    if (activeAnimation.length === 0) {
      return;
    }

    body.classList.add(CSS_CLASS_ROW_ANIMATION);
    new Set(activeAnimation.map((d) => d.mode)).forEach((mode) => {
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
  protected clearPool(): void {
    // clear pool
    this.pool.splice(0, this.pool.length);
  }

  /**
   * triggers a revalidation of the current scrolling offset
   */
  protected revalidate(): void {
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
    const shift = this.options.viewportOversize;

    const shiftTop = Math.max(0, scrollTop - shift);

    const scrollResult = this.onScrolledImpl(shiftTop, clientHeight + shift + (scrollTop - shiftTop));
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
      return { first: current, firstRowPos: currentFirstRow };
    }
    const first = Math.max(0, current - (this.options.batchSize - currentDelta));

    const { exceptionsLookup, defaultRowHeight } = this.context;
    let firstRowPos = currentFirstRow;
    for (let i = first; i < current; i += 1) {
      firstRowPos -= exceptionsLookup.get(i) ?? defaultRowHeight;
    }
    return { first, firstRowPos };
  }

  private onScrolledImpl(scrollTop: number, clientHeight: number): EScrollResult {
    const { context } = this;
    let { first, last, firstRowPos } = range(
      scrollTop,
      clientHeight,
      context.defaultRowHeight,
      context.exceptions,
      context.numberOfRows
    );

    const { visible } = this;
    visible.forcedFirst = first;
    visible.forcedLast = last;

    if (first - visible.first >= 0 && last - visible.last <= 0) {
      // nothing to do
      return EScrollResult.NONE;
    }

    let r: EScrollResult = EScrollResult.SOME;

    let toRecycle: HTMLElement[] | undefined;
    let toAdd: DocumentFragment | undefined | null;
    let toAddBottom = false;

    if (first > visible.last || last < visible.first) {
      // no overlap, clean and draw everything
      // console.log(`ff added: ${last - first + 1} removed: ${visibleLast - visibleFirst + 1} ${first}:${last} ${offset}`);
      // removeRows(visibleFirst, visibleLast);

      toRecycle = this.removeAll(false);
      toAdd = this.addAtBottom(first, last, false);
      toAddBottom = true;
      r = EScrollResult.ALL;
    } else if (first < visible.first) {
      // some first rows missing and some last rows to much
      // console.log(`up added: ${visibleFirst - first + 1} removed: ${visibleLast - last + 1} ${first}:${last} ${offset}`);
      const toRemove = visible.last - (last + 1);
      if (toRemove >= this.options.batchSize) {
        toRecycle = this.removeFromBottom(last + 1, visible.last, false);
      } else {
        last = visible.last;
      }

      const shift = this.shiftFirst(first, firstRowPos, visible.first - 1 - first);
      first = shift.first;
      firstRowPos = shift.firstRowPos;
      toAdd = this.addAtBeginning(first, visible.first - 1, false);
      toAddBottom = false;
      r = EScrollResult.SOME_TOP;
    } else {
      // console.log(`do added: ${last - visibleLast + 1} removed: ${first - visibleFirst + 1} ${first}:${last} ${offset}`);
      // some last rows missing and some first rows to much
      const toRemove = first - 1 - visible.first;
      if (toRemove >= this.options.batchSize) {
        toRecycle = this.removeFromBeginning(visible.first, first - 1, false);
      } else {
        first = visible.first;
        firstRowPos = this.visibleFirstRowPos;
      }

      last = this.shiftLast(last, last - visible.last + 1);

      toAdd = this.addAtBottom(visible.last + 1, last, false);
      toAddBottom = true;
      r = EScrollResult.SOME_BOTTOM;
    }

    visible.first = first;
    visible.last = last;

    this.updateOffset(firstRowPos);
    this.manipulate(toRecycle, toAdd, toAddBottom);
    return r;
  }

  private manipulate(
    toRecycle: HTMLElement[] | undefined,
    toAdd: DocumentFragment | undefined | null,
    bottom: boolean
  ) {
    if (toRecycle) {
      for (const item of toRecycle) {
        item.remove();
        this.recycle(item);
      }
    }
    if (!toAdd) {
      return;
    }
    if (bottom) {
      this.body.appendChild(toAdd);
    } else {
      this.body.insertBefore(toAdd, this.body.firstChild);
    }
  }
}

export default ARowRenderer;

export function setTransform(elem: HTMLElement, x: number | string, y: number | string): void {
  const text = `translate(${x}px, ${y}px)`;
  const anyElem = elem as { __transform__?: string };
   
  if (anyElem.__transform__ === text) {
    return;
  }
   
  anyElem.__transform__ = text;
   
  elem.style.transform = text;
}
