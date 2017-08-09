/**
 * Created by Samuel Gratzl on 19.07.2017.
 */
import {ARowRenderer} from './ARowRenderer';
import {IColumn, setColumn, StyleManager, TEMPLATE} from './style';
import {IExceptionContext, range, updateFrozen, frozenDelta} from './logic';
import {IMixinAdapter, IMixin, IMixinClass, EScrollResult} from './mixin';

const debug = false;

export interface ICellRenderContext<T extends IColumn> extends IExceptionContext {
  readonly column: IExceptionContext;
  readonly columns: T[];
  hasFrozenColumns?: boolean;
  readonly htmlId: string;
}

function setTemplate(root: HTMLElement) {
  root.innerHTML = TEMPLATE;
  return root;
}

export abstract class ACellRenderer<T extends IColumn> extends ARowRenderer {
  /**
   * pool of cells per column
   * @type {Array}
   */
  private readonly cellPool: HTMLElement[][] = [];

  protected readonly visibleColumns = {
    frozen: <number[]>[],
    first: 0,
    forcedFirst: 0,
    last: 0,
    forcedLast: 0
  };
  protected visibleFirstColumnPos = 0;

  protected style: StyleManager;

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
      scroller: this.headerScroller,
      syncFrozen: this.syncFrozen.bind(this)
    };
    Object.defineProperties(r, {
      visibleFirstRowPos: {
        get: () => this.visibleFirstColumnPos,
        enumerable: true
      },
      context: {
        get: () => this.context.column,
        enumerable: true
      },
    });
    return r;
  }

  protected init() {
    const context = this.context;

    this.style = new StyleManager(this.root, context.htmlId, context.defaultRowHeight);
    this.style.update(context.defaultRowHeight, context.columns, context.column.defaultRowHeight);

    context.columns.forEach(() => {
      //init pool
      this.cellPool.push([]);
    });

    const scroller = <HTMLElement>this.body.parentElement;

    //sync scrolling of header and body
    let oldLeft = scroller.scrollLeft;
    scroller.addEventListener('scroll', () => {
      const left = scroller.scrollLeft;
      if (oldLeft === left) {
        return;
      }
      const isGoingRight = left > oldLeft;
      oldLeft = left;
      this.onScrolledHorizontally(left, scroller.clientWidth, isGoingRight);
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

  private removeColumnFromStart(from: number, to: number, frozenShift: number = this.visibleColumns.frozen.length) {
    this.forEachRow((row: HTMLElement) => {
      this.removeCellFromStart(row, from, to, frozenShift);
    });
    if (debug) {
      this.verifyRows();
    }
  }

  private removeCellFromStart(row: HTMLElement, from: number, to: number, frozenShift: number) {
    for (let i = from; i <= to; ++i) {
      const node = <HTMLElement>(frozenShift === 0 ? row.firstElementChild : row.children[frozenShift]);
      node.remove();
      this.recycleCell(node, i);
    }
    if (debug) {
      verifyRow(row, -1, this.context.columns);
    }
  }

  private removeColumnFromEnd(from: number, to: number) {
    this.forEachRow((row: HTMLElement) => {
      this.removeCellFromEnd(row, from, to);
    });
    if (debug) {
      this.verifyRows();
    }
  }

  private removeCellFromEnd(row: HTMLElement, from: number, to: number) {
    for (let i = to; i >= from; --i) {
      const node = <HTMLElement>row.lastElementChild;
      node.remove();
      this.recycleCell(node, i);
    }
    if (debug) {
      verifyRow(row, -1, this.context.columns);
    }
  }

  private removeFrozenCells(row: HTMLElement, columnIndices: number[], shift: number) {
    for (const columnIndex of columnIndices) {
      const node = <HTMLElement>row.children[shift]!;
      node.remove();
      this.recycleCell(node, columnIndex);
    }
    if (debug) {
      verifyRow(row, -1, this.context.columns);
    }
  }

  private removeFrozenColumns(columnIndices: number[], shift: number) {
    this.forEachRow((row: HTMLElement) => {
      this.removeFrozenCells(row, columnIndices, shift);
    });
    if (debug) {
      this.verifyRows();
    }
  }

  private removeAllColumns(includingFrozen: boolean) {
    this.forEachRow((row: HTMLElement) => {
      this.removeAllCells(row, includingFrozen);
    });
    if (debug) {
      this.verifyRows();
    }
  }

  private removeAllCells(row: HTMLElement, includingFrozen: boolean, shift = this.visibleColumns.first) {
    const arr = <HTMLElement[]>Array.from(row.children);
    const frozen = this.visibleColumns.frozen;
    row.innerHTML = '';

    if (includingFrozen || frozen.length === 0) {
      for (const i of frozen) {
        this.recycleCell(arr.shift()!, i);
      }
    } else {
      // have frozen and keep them, so readd them
      for (const _ of frozen) {
        row.appendChild(arr.shift()!);
      }
    }
    arr.forEach((item, i) => {
      this.recycleCell(item, i + shift);
    });

    if (debug) {
      verifyRow(row, -1, this.context.columns);
    }
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
      if (r && r !== item) {
        setColumn(r, columnObj);
      }
      return r ? r : item;
    }
    const r = this.createCell(this.body.ownerDocument, row, columnObj, ...extras);
    setColumn(r, columnObj);
    return r;
  }

  private recycleCell(item: HTMLElement, column: number) {
    this.cellPool[column].push(item);
  }

  private addColumnAtStart(from: number, to: number, frozenShift: number = this.visibleColumns.frozen.length) {
    const {columns} = this.context;
    this.forEachRow((row: HTMLElement, rowIndex: number) => {
      this.addCellAtStart(row, rowIndex, from, to, frozenShift, columns);
    });
    if (debug) {
      this.verifyRows();
    }
  }

  private addCellAtStart(row: HTMLElement, rowIndex: number, from: number, to: number, frozenShift: number, columns: T[], ...extras: any[]) {
    if (debug) {
      verifyRow(row, rowIndex, this.context.columns);
    }
    for (let i = to; i >= from; --i) {
      const cell = this.selectCell(rowIndex, i, columns, ...extras);
      row.insertBefore(cell, frozenShift > 0 ? row.children[frozenShift] : row.firstChild);
    }
    if (debug) {
      verifyRow(row, rowIndex, this.context.columns);
    }
  }

  private insertFrozenCells(row: HTMLElement, rowIndex: number, columnIndices: number[], shift: number, columns: T[], ...extras: any[]) {
    const before = row.children[shift];
    for (const i of columnIndices) {
      const cell = this.selectCell(rowIndex, i, columns, ...extras);
      if (before) {
        row.insertBefore(cell, before);
      } else {
        row.appendChild(cell);
      }
    }
  }

  private insertFrozenColumns(columnIndices: number[], shift: number, ...extras: any[]) {
    const {columns} = this.context;
    this.forEachRow((row: HTMLElement, rowIndex: number) => {
      this.insertFrozenCells(row, rowIndex, columnIndices, shift, columns, ...extras);
    });
  }

  private addColumnAtEnd(from: number, to: number) {
    const {columns} = this.context;
    this.forEachRow((row: HTMLElement, rowIndex: number) => {
      this.addCellAtEnd(row, rowIndex, from, to, columns);
    });
    if (debug) {
      this.verifyRows();
    }
  }

  private verifyRows() {
    const {columns} = this.context;
    this.forEachRow((row, rowIndex) => verifyRow(row, rowIndex, columns));
  }

  private addCellAtEnd(row: HTMLElement, rowIndex: number, from: number, to: number, columns: T[], ...extras: any[]) {
    for (let i = from; i <= to; ++i) {
      const cell = this.selectCell(rowIndex, i, columns, ...extras);
      row.appendChild(cell);
    }
    if (debug) {
      verifyRow(row, rowIndex, this.context.columns);
    }
  }

  protected recreate() {
    const context = this.context;
    if (context.hasFrozenColumns === undefined) {
      context.hasFrozenColumns = context.columns.some((c) => c.frozen);
    }

    this.style.update(context.defaultRowHeight, context.columns, context.column.defaultRowHeight);

    //create all header columns
    {
      const fragment = this.columnFragment;
      const document = fragment.ownerDocument;
      this.header.innerHTML = '';
      context.columns.forEach((col) => {
        fragment.appendChild(this.createHeader(document, col));
      });
      this.header.appendChild(fragment);
    }


    const scroller = this.bodyScroller;
    const {first, last, firstRowPos} = range(scroller.scrollLeft, scroller.clientWidth, context.column.defaultRowHeight, context.column.exceptions, context.column.numberOfRows);

    this.visibleColumns.first = this.visibleColumns.forcedFirst = first;
    this.visibleColumns.last = this.visibleColumns.forcedLast = last;
    if (context.hasFrozenColumns) {
      const {target} = updateFrozen([], context.columns, first);
      this.visibleColumns.frozen = target;
    }

    super.recreate();
    this.updateColumnOffset(firstRowPos);
  }

  protected clearPool() {
    super.clearPool();
    this.cellPool.forEach((p) => p.splice(0, p.length));
  }

  private updateColumnOffset(firstColumnPos: number) {
    this.visibleFirstColumnPos = firstColumnPos;
    // TODO
  }

  protected createRow(node: HTMLElement, rowIndex: number, ...extras: any[]): void {
    const {columns, hasFrozenColumns} = this.context;
    const visible = this.visibleColumns;

    if (hasFrozenColumns) {
      for (const i of visible.frozen) {
        const cell = this.selectCell(rowIndex, i, columns, ...extras);
        node.appendChild(cell);
      }
    }
    for (let i = visible.first; i <= visible.last; ++i) {
      const cell = this.selectCell(rowIndex, i, columns, ...extras);
      node.appendChild(cell);
    }
  }

  protected updateRow(node: HTMLElement, rowIndex: number, ...extras: any[]): void {
    const {columns, hasFrozenColumns} = this.context;
    const visible = this.visibleColumns;

    //columns may not match anymore if it is a pooled item a long time ago
    const existing = <HTMLElement[]>Array.from(node.children);

    switch (existing.length) {
      case 0:
        if (hasFrozenColumns) {
          this.insertFrozenCells(node, rowIndex, visible.frozen, 0, columns, ...extras);
        }
        this.addCellAtEnd(node, rowIndex, visible.first, visible.last, columns, ...extras);
        break;
      case 1:
        const old = existing[0];
        const id = old.dataset.id!;
        const columnIndex = columns.findIndex((c) => c.id === id);
        node.removeChild(old);
        this.recycleCell(old, columnIndex);

        if (hasFrozenColumns) {
          this.insertFrozenCells(node, rowIndex, visible.frozen, 0, columns, ...extras);
        }
        this.addCellAtEnd(node, rowIndex, visible.first, visible.last, columns, ...extras);
        break;
      default: //>=2
        if (hasFrozenColumns) {
          //sync the frozen columns
          const currentFrozen = <number[]>[];
          for (const node of existing) {
            const id = node.dataset.id!;
            const col = columns.findIndex((c) => c.id === id);
            if (columns[col].frozen) {
              currentFrozen.push(col);
            } else {
              //just interested in the first frozen
              break;
            }
          }
          const {common, removed, added} = frozenDelta(currentFrozen, visible.frozen);
          //update the common ones
          existing.slice(0, common).forEach((child, i) => {
            const col = columns[currentFrozen[i]];
            const cell = this.updateCell(child, rowIndex, col , ...extras);
            if (cell && cell !== child) {
              setColumn(cell, col);
              node.replaceChild(cell, child);
            }
          });
          this.removeFrozenCells(node, removed, common);
          this.insertFrozenCells(node, rowIndex, added, common, columns, ...extras);
          //remove the ones already handled
          existing.splice(0, currentFrozen.length);
        }
        const firstId = existing[0].dataset.id!;
        const lastId = existing[existing.length - 1].dataset.id!;
        const firstIndex = columns.findIndex((c) => c.id === firstId);
        const lastIndex = columns.findIndex((c) => c.id === lastId);
        const frozenShift = visible.frozen.length;

        if (firstIndex === visible.first && lastIndex === visible.last) {
          //match update
          existing.forEach((child, i) => {
            const col = columns[i + visible.first];
            const cell = this.updateCell(child, rowIndex, col , ...extras);
            if (cell && cell !== child) {
              setColumn(cell, col);
              node.replaceChild(cell, child);
            }
          });
        } else if (visible.last > firstIndex || visible.first < lastIndex) {
          //no match at all
          this.removeAllCells(node, false, firstIndex);
          this.addCellAtStart(node, rowIndex, visible.first, visible.last, frozenShift, columns, ...extras);
        } else if (visible.first < firstIndex) {
          //some first rows missing and some last rows to much
          this.removeCellFromEnd(node, visible.last + 1, firstIndex);
          this.addCellAtStart(node, rowIndex, visible.first, firstIndex - 1, frozenShift, columns, ...extras);
        } else {
          //some last rows missing and some first rows to much
          this.removeCellFromStart(node, firstIndex, visible.first - 1, frozenShift);
          this.addCellAtEnd(node, rowIndex, lastIndex + 1, visible.last, columns, ...extras);
        }
    }
  }

  private syncFrozen(first: number) {
    const {columns, hasFrozenColumns} = this.context;
    const visible = this.visibleColumns;

    if (!hasFrozenColumns) {
      return 0;
    }
    if (first === 0) {
      if (visible.frozen.length > 0) {
        this.removeFrozenColumns(visible.frozen, 0);
        visible.frozen = [];
      }
      return 0;
    }
    const old = visible.frozen.length;
    const {target, added, removed} = updateFrozen(visible.frozen, columns, first);
    if (removed.length > 0) {
      this.removeFrozenColumns(removed, old - removed.length);
    }
    if (added.length > 0) {
      this.insertFrozenColumns(added, old - removed.length);
    }
    visible.frozen = target;
    return target.length;
  }

  private onScrolledHorizontallyImpl(scrollLeft: number, clientWidth: number): EScrollResult {
    const {column} = this.context;
    const {first, last, firstRowPos} = range(scrollLeft, clientWidth, column.defaultRowHeight, column.exceptions, column.numberOfRows);

    const visible = this.visibleColumns;
    visible.forcedFirst = first;
    visible.forcedLast = last;

    if ((first - visible.first) >= 0 && (last - visible.last) <= 0) {
      //nothing to do
      return EScrollResult.NONE;
    }

    let r: EScrollResult = EScrollResult.PARTIAL;

    const frozenShift = this.syncFrozen(first);

    if (first > visible.last || last < visible.first) {
      //no overlap, clean and draw everything
      //console.log(`ff added: ${last - first + 1} removed: ${visibleLast - visibleFirst + 1} ${first}:${last} ${offset}`);
      //removeRows(visibleFirst, visibleLast);
      this.removeAllColumns(false);
      this.addColumnAtEnd(first, last);
      r = EScrollResult.ALL;
    } else if (first < visible.first) {
      //some first rows missing and some last rows to much
      //console.log(`up added: ${visibleFirst - first + 1} removed: ${visibleLast - last + 1} ${first}:${last} ${offset}`);
      this.removeColumnFromEnd(last + 1, visible.last);
      this.addColumnAtStart(first, visible.first - 1, frozenShift);
    } else {
      //console.log(`do added: ${last - visibleLast + 1} removed: ${first - visibleFirst + 1} ${first}:${last} ${offset}`);
      //some last rows missing and some first rows to much
      this.removeColumnFromStart(visible.first, first - 1, frozenShift);
      this.addColumnAtEnd(visible.last + 1, last);
    }

    visible.first = first;
    visible.last = last;

    this.updateColumnOffset(firstRowPos);

    return r;
  }

}

function verifyRow(row: HTMLElement, index: number, columns: IColumn[]) {
  const cols = <HTMLElement[]>Array.from(row.children);
  //sort incrementally
  if (cols.length <= 1) {
    return;
  }
  const colObjs = cols.map((c) => columns.find((d) => d.id === c.dataset.id)!);
  console.assert(colObjs.every((d) => Boolean(d)), 'all columns must exist', index);
  console.assert(colObjs.every((d, i) => i === 0 || d.index >= colObjs[i - 1]!.index), 'all columns in ascending order', index);
  console.assert((new Set(colObjs)).size === colObjs.length, 'unique columns', colObjs);
}

export default ACellRenderer;
