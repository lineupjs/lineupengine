/**
 * Created by Samuel Gratzl on 13.07.2017.
 */
import {IExceptionContext, range} from './logic';
import {ABORTED, IAbortAblePromise, isAbortAble} from './abortAble';
import {EScrollResult, IMixin, IMixinAdapter, IMixinClass} from './mixin';
import KeyFinder from './animation/KeyFinder';
import {IAnimationContext, IAnimationInfo} from './animation/index';

export declare type IRowRenderContext = IExceptionContext;

export abstract class ARowRenderer {
  private readonly pool: HTMLElement[] = [];
  private readonly loadingPool: HTMLElement[] = [];
  private readonly loading = new Map<HTMLElement, IAbortAblePromise<void>>();

  private readonly fragment: DocumentFragment;

  protected readonly visible = {
    first: 0,
    forcedFirst: 0,
    last: -1,
    forcedLast: -1
  };
  protected visibleFirstRowPos = 0;

  private readonly adapter: IMixinAdapter;
  private readonly mixins: IMixin[];
  private scrollListener: ()=>void;

  private abortAnimation: ()=>void = () => undefined;

  constructor(protected readonly body: HTMLElement, ...mixinClasses: IMixinClass[]) {
    this.adapter = this.createAdapter();
    this.mixins = mixinClasses.map((mixinClass) => new mixinClass(this.adapter));

    this.fragment = body.ownerDocument.createDocumentFragment();
  }

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
      updateOffset: this.updateOffset.bind(this),
      scroller: this.bodyScroller
    };
    Object.defineProperties(r, {
      visibleFirstRowPos: {
        get: () => this.visibleFirstRowPos,
        enumerable: true
      },
      context: {
        get: () => this.context,
        enumerable: true
      }
    });
    return r;
  }

  protected get bodyScroller() {
    return <HTMLElement>this.body.parentElement;
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

    //sync scrolling of header and body
    let oldTop = scroller.scrollTop;
    this.scrollListener = () => {
      const top = scroller.scrollTop;
      if (oldTop === top) {
        return;
      }
      const isGoingDown = top > oldTop;
      oldTop = top;
      this.onScrolledVertically(top, scroller.clientHeight, isGoingDown);
    };
    scroller.addEventListener('scroll', this.scrollListener);
    this.recreate();
  }

  destroy() {
    this.bodyScroller.removeEventListener('scroll', this.scrollListener);
    this.body.remove();
  }

  private static cleanUp(item: HTMLElement) {
    if (item.style.height) {
      item.style.height = null;
    }
  }

  private select(index: number): { item: HTMLElement, result: IAbortAblePromise<void> | void } {
    let item: HTMLElement;
    let result: IAbortAblePromise<void> | void;
    if (this.pool.length > 0) {
      item = this.pool.pop()!;
      result = this.updateRow(item, index);
    } else if (this.loadingPool.length > 0) {
      item = this.loadingPool.pop()!;
      item.classList.remove('loading');
      result = this.createRow(item, index);
    } else {
      item = this.body.ownerDocument.createElement('div');
      result = this.createRow(item, index);
    }
    item.dataset.index = String(index);
    return {item, result};
  }

  private selectProxy() {
    let proxy: HTMLElement;
    if (this.loadingPool.length > 0) {
      proxy = this.loadingPool.pop()!;
    } else {
      proxy = this.body.ownerDocument.createElement('div');
      proxy.classList.add('loading');
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


  protected update() {
    const first = this.visible.first;
    const fragment = this.fragment;
    const items = Array.from(this.body.children);
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

  protected forEachRow(callback: (row: HTMLElement, rowIndex: number) => void, inplace: boolean = false) {
    const rows = Array.from(this.body.children);
    const fragment = this.fragment;
    if (!inplace) {
      this.body.innerHTML = '';
    }
    rows.forEach((row: HTMLElement, index) => {
      if (!row.classList.contains('loading')) {
        //skip loading ones
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
    for (let i = from; i <= to; ++i) {
      const item = <HTMLElement>(fromBeginning ? this.body.firstChild : this.body.lastChild);
      item.remove();
      this.recycle(item);
    }
  }

  private addAtBeginning(from: number, to: number) {
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

  private updateOffset(firstRowPos: number) {
    const {totalHeight} = this.context;
    this.visibleFirstRowPos = firstRowPos;

    //odd start patch for correct background
    this.body.classList.toggle('odd', this.visible.first % 2 === 1);

    this.body.style.transform = `translate(0, ${firstRowPos.toFixed(0)}px)`;
    this.body.style.height = `${(totalHeight - firstRowPos).toFixed(0)}px`;
  }

  /**
   * removes all rows and recreates the table
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
    const old = Object.assign({}, this.visible);
    const prev = new KeyFinder(ctx.previous, ctx.previousKey);
    const cur = new KeyFinder(this.context, ctx.currentKey);
    const scroller = this.bodyScroller;
    const next = range(scroller.scrollTop, scroller.clientHeight, cur.context.defaultRowHeight, cur.context.exceptions, cur.context.numberOfRows);

    {
      const rows = <HTMLElement[]>Array.from(this.body.children);
      prev.positions(old.first, old.last, this.visibleFirstRowPos, (i, key, pos) => {
        lookup.set(key, {n: rows[i], pos, i});
      });
      this.body.innerHTML = ``;
    }

    this.visible.first = this.visible.forcedFirst = next.first;
    this.visible.last = this.visible.forcedLast = next.last;

    const fragment = this.fragment;
    const animatedRows: IAnimationInfo[] = [];
    cur.positions(next.first, next.last, next.firstRowPos, (i, key, pos) => {
      let node: HTMLElement;
      let oldPos: number;
      let oldIndex = -1;
      if (lookup.has(key)) {
        // still visible
        const item = lookup.get(key)!;
        lookup.delete(key);
        node = this.proxy(item.n, this.updateRow(item.n, i));
        oldPos = item.pos;
        oldIndex = item.i;
      } else {
        // need a new row
        const old = prev.posByKey(key);
        oldPos = old.pos;
        if (oldPos < 0) {
          // was not visible before
          oldPos = ctx.appearPosition ? ctx.appearPosition(i, prev) : cur.context.totalHeight;
        }
        oldIndex = old.index;
        node = this.create(i);
      }
      //locate at target but shift to the old position
      node.style.transform = `translate(0, ${oldPos - pos}px)`;
      if (ctx.animate) {
        ctx.animate(node, i, oldIndex, 'before');
      }
      fragment.appendChild(node);
      animatedRows.push({node, currentIndex: i, previousIndex: oldIndex, target: -1});
    });

    const removeAfterwards: IAnimationInfo[] = [];
    let addedPos = next.endPos;
    // items that are going to be removed
    lookup.forEach((item, key) => {
      // calculate their next position
      const r = cur.posByKey(key);
      let nextPos =r.pos;
      const node = item.n;
      if (nextPos < 0) {
        nextPos = ctx.removePosition? ctx.removePosition(item.i, cur) : cur.context.totalHeight;
      }
      // located at addedPos
      // should end up at nextPos
      // was previously at item.pos
      node.style.transform = `translate(0, ${item.pos - addedPos}px)`;
      node.classList.add('le-row-removed');
      if (ctx.removeAnimate) {
        ctx.removeAnimate(node, r.index, item.i, 'before');
      }
      fragment.appendChild(node);
      removeAfterwards.push({node, target: (nextPos - addedPos), previousIndex: item.i, currentIndex: r.index});
      addedPos += prev.heightOf(item.i);
    });

    // add to DOM
    this.body.classList.add('le-row-animation');
    this.body.appendChild(fragment);
    this.updateOffset(next.firstRowPos);

    let currentTimer: any = -1;

    const remove = () => {
      this.body.classList.remove('le-row-animation');
      animatedRows.forEach(({node, currentIndex, previousIndex}) => {
        node.style.transform = null;
        if (ctx.animate) {
          ctx.animate(node, currentIndex, previousIndex, 'cleanup');
        }
      });
      removeAfterwards.forEach(({node, currentIndex, previousIndex}) => {
        node.remove();
        node.style.transform = null;
        node.classList.remove('le-row-removed');
        if (ctx.removeAnimate) {
          ctx.removeAnimate(node, currentIndex, previousIndex, 'cleanup');
        }
        this.recycle(node);
      });
      currentTimer = -1;
    };

    this.abortAnimation = () => {
      if (currentTimer <= 0) {
        return;
      }
      // abort by removing
      clearTimeout(currentTimer);
      remove();
    };

    const reset = () => {
      // trigger animation
      animatedRows.forEach(({node, currentIndex, previousIndex}) => {
        node.style.transform = null;
        if (ctx.animate) {
          ctx.animate(node, currentIndex, previousIndex, 'after');
        }
      });
      removeAfterwards.forEach(({node, target, currentIndex, previousIndex}) => {
        node.style.transform = `translate(0,${target}px)`;
        if (ctx.removeAnimate) {
          ctx.removeAnimate(node, currentIndex, previousIndex, 'after');
        }
      });
      // reset for next time
      currentTimer = setTimeout(remove, ctx.cleanUpAfter || 1100);
    };

    // next tick such that DOM will be updated
    currentTimer = setTimeout(reset, 200);
  }

  protected clearPool() {
    // clear pool
    this.pool.splice(0, this.pool.length);
  }

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
    this.mixins.forEach((mixin) => mixin.onScrolled(isGoingDown, scrollResult));
    return scrollResult;
  }

  private onScrolledImpl(scrollTop: number, clientHeight: number): EScrollResult {
    const context = this.context;
    const {first, last, firstRowPos} = range(scrollTop, clientHeight, context.defaultRowHeight, context.exceptions, context.numberOfRows);

    const visible = this.visible;
    visible.forcedFirst = first;
    visible.forcedLast = last;

    if ((first - visible.first) >= 0 && (last - visible.last) <= 0) {
      //nothing to do
      return EScrollResult.NONE;
    }

    let r: EScrollResult = EScrollResult.PARTIAL;

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
      this.removeFromBottom(last + 1, visible.last);
      this.addAtBeginning(first, visible.first - 1);
    } else {
      //console.log(`do added: ${last - visibleLast + 1} removed: ${first - visibleFirst + 1} ${first}:${last} ${offset}`);
      //some last rows missing and some first rows to much
      this.removeFromBeginning(visible.first, first - 1);
      this.addAtBottom(visible.last + 1, last);
    }

    visible.first = first;
    visible.last = last;

    this.updateOffset(firstRowPos);
    return r;
  }
}

export default ARowRenderer;
