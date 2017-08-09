/**
 * Created by Samuel Gratzl on 13.07.2017.
 */
import {IExceptionContext, range} from './logic';
import {IAbortAblePromise, isAbortAble, ABORTED} from './abortAble';
import {IMixinAdapter, IMixin, IMixinClass, EScrollResult} from './mixin';

export declare type IRowRenderContext = IExceptionContext;

export abstract class ARowRenderer {
  private readonly pool: HTMLElement[] = [];
  private readonly loadingPool: HTMLElement[] = [];
  private readonly loading = new Map<HTMLElement, IAbortAblePromise<void>>();

  private readonly fragment: DocumentFragment;

  protected readonly visible = {
    first: 0,
    forcedFirst: 0,
    last: 0,
    forcedLast: 0
  };
  protected visibleFirstRowPos = 0;

  private readonly adapter: IMixinAdapter;
  private readonly mixins: IMixin[];

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
    scroller.addEventListener('scroll', () => {
      const top = scroller.scrollTop;
      if (oldTop === top) {
        return;
      }
      const isGoingDown = top > oldTop;
      oldTop = top;
      this.onScrolledVertically(top, scroller.clientHeight, isGoingDown);
    });
    this.recreate();
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
    const abort = <IAbortAblePromise<void>>result;
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

    const ex = this.context.exceptionsLookup;
    if (ex.has(index)) {
      item.style.height = `${ex.get(index)}px`;
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
    if (this.visible.first % 2 === 1) {
      //odd start patch for correct background
      this.body.classList.add('odd');
    } else {
      this.body.classList.remove('odd');
    }

    this.body.style.transform = `translate(0, ${firstRowPos.toFixed(0)}px)`;
    this.body.style.height = `${(totalHeight - firstRowPos).toFixed(0)}px`;
  }

  /**
   * removes all rows and recreates the table
   * @returns {void} nothing
   */
  protected recreate() {
    const context = this.context;

    this.removeAll();

    this.clearPool();

    this.updateOffset(0);
    const scroller = this.bodyScroller;
    const {first, last, firstRowPos} = range(scroller.scrollTop, scroller.clientHeight, context.defaultRowHeight, context.exceptions, context.numberOfRows);

    this.visible.first = this.visible.forcedFirst = first;
    this.visible.last = this.visible.forcedLast = last;

    this.addAtBottom(first, last);
    this.updateOffset(firstRowPos);
  }

  protected clearPool() {
    // clear pool
    this.pool.splice(0, this.pool.length);
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
