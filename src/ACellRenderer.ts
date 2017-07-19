/**
 * Created by Samuel Gratzl on 19.07.2017.
 */
import {ARowRenderer} from './ARowRenderer';
import {IColumn, setColumn, StyleManager, TEMPLATE} from './style';
import {IExceptionContext} from './logic';
import {IMixinAdapter, IMixin, IMixinClass, EScrollResult} from './mixin';

export interface ICellRenderContext<T extends IColumn> extends IExceptionContext {
  readonly column: IExceptionContext;
  readonly columns: T[];
  readonly htmlId: string;
}

function setTemplate(root: HTMLElement) {
  root.innerHTML = TEMPLATE;
  return root;
}

export abstract class ACellRenderer<T extends IColumn> extends ARowRenderer {
  protected readonly visibleColumns = {
    first: 0,
    forcedFirst: 0,
    last: 0,
    forcedLast: 0
  };
  protected visibleFirstColumnPos = 0;

  private style: StyleManager;

  private readonly columnAdapter: IMixinAdapter;
  private readonly columnMixins: IMixin[];

  constructor(protected readonly root: HTMLElement, ...mixinClasses: IMixinClass[]) {
    super(<HTMLElement>setTemplate(root).querySelector('main > article'), ...mixinClasses);
    root.classList.add('lineup-engine');

    this.columnAdapter = this.createColumnAdapter();
    this.columnMixins = mixinClasses.map((mixinClass) => new mixinClass(this.columnAdapter));

  }

  protected get header() {
    return <HTMLElement>this.root.querySelector('header > article');
  }

  protected get headerScroller() {
    return <HTMLElement>this.root.querySelector('header');
  }

   protected addColumnMixin(mixinClass: IMixinClass, options?: any) {
    this.columnMixins.push(new mixinClass(this.columnAdapter, options));
  }

  private createColumnAdapter(): IMixinAdapter {
    const r: any = {
      visible: this.visibleColumns,
      addAtBeginning: this.addColumnAtStart.bind(this),
      addAtBottom: this.addColumnAtEnd.bind(this),
      removeFromBeginning: this.removeColumnFromStart.bind(this),
      removeFromBottom: this.removeColumnFromEnd.bind(this),
      updateOffset: this.updateColumnOffset.bind(this),
      scroller: this.headerScroller
    };
    Object.defineProperties(r, {
      visibleFirstRowPos: {
        get: () => this.visibleFirstColumnPos,
        enumerable: true
      },
      context: {
        get: () => this.context.column,
        enumerable: true
      }
    });
    return r;
  }

  protected init() {
    const context = this.context;

    this.style = new StyleManager(this.root, context.htmlId, context.defaultRowHeight);
    this.style.update(this.context.columns, 150);

    this.visibleColumns.last = this.visibleColumns.forcedLast = context.column.numberOfRows - 1;

    //create all header columns
    const header = this.header;
    const document = header.ownerDocument;
    context.columns.forEach((col) => {
      header.appendChild(this.createHeader(document, col));
    });


    const scroller = <HTMLElement>this.body.parentElement;

    //sync scrolling of header and body
    let oldTop = scroller.scrollTop;
    scroller.addEventListener('scroll', () => {
      const top = scroller.scrollTop;
      if (oldTop !== top) {
        const isGoingDown = top > oldTop;
        oldTop = top;
        this.onScrolledVertically(top, scroller.clientHeight, isGoingDown);
      }
    });

    super.init();
  }

  protected updateColumnOffset(firstColumnPos: number) {
    this.visibleFirstColumnPos = firstColumnPos;
    // TODO
  }

  protected onScrolledHorizontally(scrollLeft: number, isGoingRight: boolean) {
    const scrollResult = this.onScrolledHorizontallyImpl(scrollLeft);
    this.columnMixins.forEach((mixin) => mixin.onScrolled(isGoingRight, scrollResult));
    return scrollResult;
  }

  /**
   * the current render context, upon change `recreate` the whole table
   * @returns {ICellRenderContext}
   */
  protected abstract get context(): ICellRenderContext<T>;

  protected abstract createHeader(document: Document, column: T, ...extras: any[]): HTMLElement;

  protected abstract updateHeader(node: HTMLElement, column: T, ...extras: any[]): HTMLElement | void;

  protected abstract createCell(document: Document, index: number, column: T, ...extras: any[]): HTMLElement;

  protected abstract updateCell(node: HTMLElement, index: number, column: T, ...extras: any[]): HTMLElement | void;


  private removeColumnFromStart(from: number, to: number) {
    return this.removeColumn(from, to, true);
  }

  private removeColumnFromEnd(from: number, to: number) {
    return this.removeColumn(from, to, false);
  }

  private removeColumn(_from: number, _to: number, _fromBeginning: boolean) {
    //TODO
  }

  protected addColumnAtStart(_from: number, _to: number) {
    //TODO
  }

  protected addColumnAtEnd(_from: number, _to: number) {
    //TODO
  }

  protected createRow(node: HTMLElement, index: number, ...extras: any[]): void {
    const {columns} = this.context;
    const document = node.ownerDocument;
    columns.forEach((column) => {
      const child = this.createCell(document, index, column, ...extras);
      setColumn(child, column);
      node.appendChild(child);
    });
  }

  protected updateRow(node: HTMLElement, index: number, ...extras: any[]): void {
    const {columns} = this.context;
    columns.forEach((column, i) => {
      const child = <HTMLElement>node.children[i];
      const replacement = this.updateCell(child, index, column, ...extras);
      if (replacement !== undefined && replacement !== child) { //have a replacement
        node.replaceChild(replacement, child);
      }
    });
  }

  private onScrolledHorizontallyImpl(_scrollLeft: number): EScrollResult {
    //TODO
    return EScrollResult.ALL;
  }
}

export default ACellRenderer;
