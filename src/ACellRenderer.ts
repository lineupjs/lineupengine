/**
 * Created by Samuel Gratzl on 19.07.2017.
 */
import {ARowRenderer} from './ARowRenderer';
import {IColumn, setColumn, StyleManager, TEMPLATE} from './style';
import {IExceptionContext, range} from './logic';
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
  /**
   * pool of cels per column
   * @type {Array}
   */
  private readonly cellPool: HTMLElement[][] = [];

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

  private readonly columnFragment: DocumentFragment;

  constructor(protected readonly root: HTMLElement, ...mixinClasses: IMixinClass[]) {
    super(<HTMLElement>setTemplate(root).querySelector('main > article'), ...mixinClasses);
    root.classList.add('lineup-engine');

    this.columnAdapter = this.createColumnAdapter();
    this.columnMixins = mixinClasses.map((mixinClass) => new mixinClass(this.columnAdapter));

    this.columnFragment = root.ownerDocument.createDocumentFragment();

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
    this.style.update(this.context.columns, context.column.defaultRowHeight);

    //create all header columns
    {
      const fragment = this.columnFragment;
      const document = fragment.ownerDocument;
      context.columns.forEach((col) => {
        fragment.appendChild(this.createHeader(document, col));
        //init pool
        this.cellPool.push([]);
      });
      this.header.appendChild(fragment);
    }


    const scroller = <HTMLElement>this.body.parentElement;

    //sync scrolling of header and body
    let oldLeft = scroller.scrollLeft;
    scroller.addEventListener('scroll', () => {
      const left = scroller.scrollLeft;
      if (oldLeft !== left) {
        const isGoingRight = left > oldLeft;
        oldLeft = left;
        this.onScrolledHorizontally(left, scroller.clientWidth, isGoingRight);
      }
    });

    super.init();
  }

  protected onScrolledHorizontally(scrollLeft: number, clientWidth: number, isGoingRight: boolean) {
    const scrollResult = this.onScrolledHorizontallyImpl(scrollLeft, clientWidth);
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
    this.forEachRow((row: HTMLElement) => {
      this.removeCellFromStart(row, from, to);
    });
  }

  private removeCellFromStart(row: HTMLElement, from: number, to: number) {
    for (let i = from; i <= to; ++i) {
      const node = <HTMLElement>row.firstElementChild;
      row.removeChild(node);
      this.recycleCell(node, i);
    }
  }

  private removeColumnFromEnd(from: number, to: number) {
    this.forEachRow((row: HTMLElement) => {
      this.removeCellFromEnd(row, from, to);
    });
  }

  private removeCellFromEnd(row: HTMLElement, from: number, to: number) {
    for (let i = to; i >= from; --i) {
      const node = <HTMLElement>row.lastElementChild;
      row.removeChild(node);
      this.recycleCell(node, i);
    }
  }

  private removeAllColumns() {
    this.forEachRow((row: HTMLElement) => {
      this.removeAllCells(row);
    });
  }

  private removeAllCells(row: HTMLElement, shift = this.visibleColumns.first) {
    const arr = <HTMLElement[]>Array.from(row.children);
    row.innerHTML = '';
    arr.forEach((item, i) => {
      this.recycleCell(item, i + shift);
    });
  }

  private forEachRow(callback: (row: HTMLElement, rowIndex: number) => void) {
    const rows = Array.from(this.body.children);
    const fragment = this.columnFragment;
    this.body.innerHTML = '';
    rows.forEach((row: HTMLElement, index) => {
      if (!row.classList.contains('loading')) {
        //skip loading ones
        callback(row, index + this.visible.first);
      }
      fragment.appendChild(row);
    });
    this.body.appendChild(fragment);
  }

  private selectCell(row: number, column: number, columns: T[], ...extras: any[]): HTMLElement {
    const pool = this.cellPool[column];
    const columnObj = columns[column];
    if (pool.length > 0) {
      const item = pool.pop()!;
      const r = this.updateCell(item, row, columnObj, ...extras);
      return r ? r : item;
    } else {
      const r = this.createCell(this.body.ownerDocument, row, columnObj, ...extras);
      setColumn(r, columnObj);
      return r;
    }
  }

  private recycleCell(item: HTMLElement, column: number) {
    this.cellPool[column].push(item);
  }

  private addColumnAtStart(from: number, to: number) {
    const {columns} = this.context;
    this.forEachRow((row: HTMLElement, rowIndex: number) => {
      this.addCellAtStart(row, rowIndex, from, to, columns);
    });
  }

  private addCellAtStart(row: HTMLElement, rowIndex: number, from: number, to: number, columns: T[], ...extras: any[]) {
    for (let i = from; i <= to; ++i) {
      const cell = this.selectCell(rowIndex, i, columns, ...extras);
      row.insertBefore(cell, row.firstChild);
    }
  }

  private addColumnAtEnd(from: number, to: number) {
    const {columns} = this.context;
    this.forEachRow((row: HTMLElement, rowIndex: number) => {
      this.addCellAtEnd(row, rowIndex, from, to, columns);
    });
  }

  private addCellAtEnd(row: HTMLElement, rowIndex: number, from: number, to: number, columns: T[], ...extras: any[]) {
    for (let i = from; i <= to; ++i) {
      const cell = this.selectCell(rowIndex, i, columns, ...extras);
      row.appendChild(cell);
    }
  }

  protected recreate() {
    const context = this.context;

    const scroller = this.bodyScroller;
    const {first, last, firstRowPos} = range(scroller.scrollLeft, scroller.clientWidth, context.column.defaultRowHeight, context.column.exceptions, context.column.numberOfRows);

    this.visibleColumns.first = this.visibleColumns.forcedFirst = first;
    this.visibleColumns.last = this.visibleColumns.forcedLast = last;

    super.recreate();
    this.updateColumnOffset(firstRowPos);
  }

  private updateColumnOffset(firstColumnPos: number) {
    this.visibleFirstColumnPos = firstColumnPos;
    // TODO
  }

  protected createRow(node: HTMLElement, rowIndex: number, ...extras: any[]): void {
    const {columns} = this.context;
    const visible = this.visibleColumns;

    for (let i = visible.first; i <= visible.last; ++i) {
      const cell = this.selectCell(rowIndex, i, columns, ...extras);
      node.appendChild(cell);
    }
  }

  protected updateRow(node: HTMLElement, rowIndex: number, ...extras: any[]): void {
    const {columns} = this.context;
    const visible = this.visibleColumns;

    //columns may not match anymore if it is a pooled item a long time ago
    const existing = <HTMLElement[]>Array.from(node.children);

    switch (existing.length) {
      case 0:
        this.addCellAtStart(node, rowIndex, visible.first, visible.last, columns, ...extras);
        break;
      case 1:
        const old = existing[0];
        const id = old.dataset.id!;
        const columnIndex = columns.findIndex((c) => c.id === id);
        node.removeChild(old);
        this.recycleCell(old, columnIndex);
        this.addCellAtStart(node, rowIndex, visible.first, visible.last, columns, ...extras);
        break;
      default: //>=2
        const firstId = existing[0].dataset.id!;
        const lastId = existing[existing.length - 1].dataset.id!;
        const firstIndex = columns.findIndex((c) => c.id === firstId);
        const lastIndex = columns.findIndex((c) => c.id === lastId);

        if (firstIndex === visible.first && lastIndex === visible.last) {
          //match update
          existing.forEach((child, i) => {
            const cell = this.updateCell(child, rowIndex, columns[i + visible.first], ...extras);
            if (cell && cell !== child) {
              node.replaceChild(cell, child);
            }
          });
        } else if (visible.last > firstIndex || visible.first < lastIndex) {
          //no match at all
          this.removeAllCells(node, firstIndex);
          this.addCellAtStart(node, rowIndex, visible.first, visible.last, columns, ...extras);
        } else if (visible.first < firstIndex) {
          //some first rows missing and some last rows to much
          this.removeCellFromEnd(node, visible.last + 1, firstIndex);
          this.addCellAtStart(node, rowIndex, visible.first, firstIndex - 1, columns, ...extras);
        } else {
          //some last rows missing and some first rows to much
          this.removeCellFromStart(node, firstIndex, visible.first - 1);
          this.addCellAtEnd(node, rowIndex, lastIndex + 1, visible.last, columns, ...extras);
        }
    }
  }

  private onScrolledHorizontallyImpl(scrollLeft: number, clientWidth: number): EScrollResult {
    const column = this.context.column;
    const {first, last, firstRowPos} = range(scrollLeft, clientWidth, column.defaultRowHeight, column.exceptions, column.numberOfRows);

    const visible = this.visibleColumns;
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
      this.removeAllColumns();
      this.addColumnAtEnd(first, last);
      r = EScrollResult.ALL;
    } else if (first < visible.first) {
      //some first rows missing and some last rows to much
      //console.log(`up added: ${visibleFirst - first + 1} removed: ${visibleLast - last + 1} ${first}:${last} ${offset}`);
      this.removeColumnFromEnd(last + 1, visible.last);
      this.addColumnAtStart(first, visible.first - 1);
    } else {
      //console.log(`do added: ${last - visibleLast + 1} removed: ${first - visibleFirst + 1} ${first}:${last} ${offset}`);
      //some last rows missing and some first rows to much
      this.removeColumnFromStart(visible.first, first - 1);
      this.addColumnAtEnd(visible.last + 1, last);
    }

    visible.first = first;
    visible.last = last;

    this.updateColumnOffset(firstRowPos);
    return r;
  }
}

export default ACellRenderer;
