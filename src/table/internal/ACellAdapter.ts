/**
 * Created by Samuel Gratzl on 19.07.2017.
 */
import {frozenDelta, IExceptionContext, range, updateFrozen} from '../../logic';
import {EScrollResult, IMixin, IMixinAdapter, IMixinClass} from '../../mixin';
import GridStyleManager, {setColumn} from '../../style/GridStyleManager';
import {IColumn} from '../../style/IColumn';

const debug = false;

export interface ICellAdapterRenderContext<T extends IColumn> extends IExceptionContext {
  readonly column: IExceptionContext;
  readonly columns: T[];
  hasFrozenColumns?: boolean;
}

export abstract class ACellAdapter<T extends IColumn> {
  /**
   * pool of cells per column
   * @type {Array}
   */
  private readonly cellPool: HTMLElement[][] = [];

  protected readonly visibleColumns = {
    frozen: <number[]>[], // column indices that are visible even tho they would be out of range
    first: 0,
    forcedFirst: 0,
    last: -1,
    forcedLast: -1
  };
  protected visibleFirstColumnPos = 0;

  private readonly columnAdapter: IMixinAdapter;
  private readonly columnMixins: IMixin[];

  private readonly columnFragment: DocumentFragment;

  constructor(protected readonly header: HTMLElement, protected readonly style: GridStyleManager, private readonly tableId?: string, ...mixinClasses: IMixinClass[]) {

    this.columnAdapter = this.createColumnAdapter();
    this.columnMixins = mixinClasses.map((mixinClass) => new mixinClass(this.columnAdapter));

    this.columnFragment = header.ownerDocument.createDocumentFragment();
  }

  protected get headerScroller() {
    return <HTMLElement>this.header.parentElement!;
  }

  addColumnMixin(mixinClass: IMixinClass, options?: any) {
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

  init() {
    const context = this.context;
    this.style.update(context.defaultRowHeight - context.padding(-1), context.columns, context.column.defaultRowHeight - context.column.padding(-1), context.column.padding, this.tableId);

    context.columns.forEach(() => {
      //init pool
      this.cellPool.push([]);
    });
  }

  onScrolledHorizontally(scrollLeft: number, clientWidth: number, isGoingRight: boolean) {
    const scrollResult = this.onScrolledHorizontallyImpl(scrollLeft, clientWidth);
    this.columnMixins.forEach((mixin) => mixin.onScrolled(isGoingRight, scrollResult));
    return scrollResult;
  }

  /**
   * the current render context, upon change `recreate` the whole table
   * @returns {ICellRenderContext}
   */
  protected abstract get context(): ICellAdapterRenderContext<T>;

  protected abstract createHeader(document: Document, column: T): HTMLElement;

  protected abstract updateHeader(node: HTMLElement, column: T): HTMLElement | void;

  protected abstract createCell(document: Document, index: number, column: T): HTMLElement;

  protected abstract updateCell(node: HTMLElement, index: number, column: T): HTMLElement | void;

  protected abstract forEachRow(callback: (row: HTMLElement, rowIndex: number)=>void): void;

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

  private selectCell(row: number, column: number, columns: T[]): HTMLElement {
    const pool = this.cellPool[column];
    const columnObj = columns[column];
    if (pool.length > 0) {
      const item = pool.pop()!;
      const r = this.updateCell(item, row, columnObj);
      if (r && r !== item) {
        setColumn(r, columnObj);
      }
      return r ? r : item;
    }
    const r = this.createCell(this.header.ownerDocument, row, columnObj);
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

  private addCellAtStart(row: HTMLElement, rowIndex: number, from: number, to: number, frozenShift: number, columns: T[]) {
    if (debug) {
      verifyRow(row, rowIndex, this.context.columns);
    }
    for (let i = to; i >= from; --i) {
      const cell = this.selectCell(rowIndex, i, columns);
      row.insertBefore(cell, frozenShift > 0 ? row.children[frozenShift] : row.firstChild);
    }
    if (debug) {
      verifyRow(row, rowIndex, this.context.columns);
    }
  }

  private insertFrozenCells(row: HTMLElement, rowIndex: number, columnIndices: number[], shift: number, columns: T[]) {
    const before = row.children[shift];
    for (const i of columnIndices) {
      const cell = this.selectCell(rowIndex, i, columns);
      if (before) {
        row.insertBefore(cell, before);
      } else {
        row.appendChild(cell);
      }
    }
  }

  private insertFrozenColumns(columnIndices: number[], shift: number) {
    const {columns} = this.context;
    this.forEachRow((row: HTMLElement, rowIndex: number) => {
      this.insertFrozenCells(row, rowIndex, columnIndices, shift, columns);
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

  private addCellAtEnd(row: HTMLElement, rowIndex: number, from: number, to: number, columns: T[]) {
    for (let i = from; i <= to; ++i) {
      const cell = this.selectCell(rowIndex, i, columns);
      row.appendChild(cell);
    }
    if (debug) {
      verifyRow(row, rowIndex, this.context.columns);
    }
  }

  updateHeaders() {
    const {columns} = this.context;
    Array.from(this.header.children).forEach((node: HTMLElement, i) => {
      this.updateHeader(node, columns[i]);
    });
  }

  recreate(left: number, width: number) {
    const context = this.context;
    if (context.hasFrozenColumns === undefined) {
      context.hasFrozenColumns = context.columns.some((c) => c.frozen);
    }

    this.style.update(context.defaultRowHeight - context.padding(-1), context.columns, context.column.defaultRowHeight - context.column.padding(-1),context.column.padding, this.tableId);


    this.clearPool();
    // init pool
    for (let i = this.cellPool.length; i < context.columns.length; ++i) {
      this.cellPool.push([]);
    }

    //create all header columns
    {
      const fragment = this.columnFragment;
      const document = fragment.ownerDocument;
      this.header.innerHTML = '';
      context.columns.forEach((col) => {
        const n = this.createHeader(document, col);
        setColumn(n, col);
        fragment.appendChild(n);
      });
      this.header.appendChild(fragment);
    }

    const {first, last, firstRowPos} = range(left, width, context.column.defaultRowHeight, context.column.exceptions, context.column.numberOfRows);

    this.visibleColumns.first = this.visibleColumns.forcedFirst = first;
    this.visibleColumns.last = this.visibleColumns.forcedLast = last;
    if (context.hasFrozenColumns) {
      const {target} = updateFrozen([], context.columns, first);
      this.visibleColumns.frozen = target;
    } else {
      this.visibleColumns.frozen = [];
    }
    this.updateColumnOffset(firstRowPos);
  }

  clearPool() {
    this.cellPool.forEach((p) => p.splice(0, p.length));
  }

  private updateColumnOffset(firstColumnPos: number) {
    this.visibleFirstColumnPos = firstColumnPos;
    // TODO
  }

  createRow(node: HTMLElement, rowIndex: number): void {
    const {columns} = this.context;
    const visible = this.visibleColumns;

    if (visible.frozen.length > 0) {
      for (const i of visible.frozen) {
        const cell = this.selectCell(rowIndex, i, columns);
        node.appendChild(cell);
      }
    }
    for (let i = visible.first; i <= visible.last; ++i) {
      const cell = this.selectCell(rowIndex, i, columns);
      node.appendChild(cell);
    }
  }

  updateRow(node: HTMLElement, rowIndex: number): void {
    const {columns} = this.context;
    const visible = this.visibleColumns;

    //columns may not match anymore if it is a pooled item a long time ago
    const existing = <HTMLElement[]>Array.from(node.children);

    switch (existing.length) {
      case 0:
        if (visible.frozen.length > 0) {
          this.insertFrozenCells(node, rowIndex, visible.frozen, 0, columns);
        }
        this.addCellAtEnd(node, rowIndex, visible.first, visible.last, columns);
        break;
      case 1:
        const old = existing[0];
        const id = old.dataset.id!;
        const columnIndex = columns.findIndex((c) => c.id === id);
        node.removeChild(old);
        if (columnIndex >= 0) {
          this.recycleCell(old, columnIndex);
        }

        if (visible.frozen.length > 0) {
          this.insertFrozenCells(node, rowIndex, visible.frozen, 0, columns);
        }
        this.addCellAtEnd(node, rowIndex, visible.first, visible.last, columns);
        break;
      default:
        this.mergeColumns(node, rowIndex, existing);
        break;
    }
  }

  private mergeColumns(node: HTMLElement, rowIndex: number, existing: HTMLElement[]) {
    const {columns} = this.context;
    const visible = this.visibleColumns;


    node.innerHTML = '';

    const ids = new Map(existing.map((e) => (<[string, HTMLElement]>[e.dataset.id!, e])));

    const updateImpl = (i: number) => {
      const col = columns[i];
      const existing = ids.get(col.id);
      if (!existing) {
        const cell = this.selectCell(rowIndex, i, columns);
        node.appendChild(cell);
        return;
      }
      const cell = this.updateCell(existing, rowIndex, col);
      if (cell && cell !== existing) {
        setColumn(cell, col);;
      }
      node.appendChild(cell || existing);
    };

    visible.frozen.forEach(updateImpl);
    for(let i = visible.first; i <= visible.last; ++i) {
      updateImpl(i);
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

export default ACellAdapter;

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
