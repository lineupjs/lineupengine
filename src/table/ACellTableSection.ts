import {IAnimationContext} from '../animation';
import ARowRenderer, {IRowRendererOptions, setTransform} from '../ARowRenderer';
import {EScrollResult, IMixinClass} from '../mixin';
import GridStyleManager from '../style/GridStyleManager';
import {IColumn} from '../style';
import ACellAdapter, {ICellAdapterRenderContext} from './internal/ACellAdapter';
import {ITableSection} from './MultiTableRowRenderer';
import {cssClass} from '../styles';
import {IAsyncUpdate} from '../abortAble';

export declare type ICellRenderContext<T extends IColumn> = ICellAdapterRenderContext<T>;

/**
 * base class for a cell renderer as table section
 */
export abstract class ACellTableSection<T extends IColumn> extends ARowRenderer implements ITableSection {
  private readonly cell: ACellAdapter<T>;

  constructor(public readonly header: HTMLElement, public readonly body: HTMLElement, protected readonly tableId: string, protected readonly style: GridStyleManager, options: Partial<IRowRendererOptions> = {}) {
    super(body, options);

    const that = this;

    class LocalCell extends ACellAdapter<T> {
      protected get context(): ICellAdapterRenderContext<T> {
        return that.context;
      }

      protected get body() {
        return that.body;
      }

      protected get lastScrollInfo() {
        return that.lastScrollInfo;
      }

      protected createHeader(document: Document, column: T) {
        return that.createHeader(document, column);
      }

      protected updateHeader(node: HTMLElement, column: T) {
        return that.updateHeader(node, column);
      }

      protected createCell(document: Document, index: number, column: T) {
        return that.createCell(document, index, column);
      }

      protected updateColumnOffset(firstColumnPos: number) {
        super.updateColumnOffset(firstColumnPos);
        that.updateOffset(that.visibleFirstRowPos);
      }

      protected updateCell(node: HTMLElement, index: number, column: T) {
        return that.updateCell(node, index, column);
      }

      protected forEachRow(callback: (row: HTMLElement, rowIndex: number) => void) {
        return that.forEachRow(callback);
      }
    }

    this.cell = new LocalCell(this.header, this.style, tableId, ...(options.mixins || []));
  }

  protected addColumnMixin(mixinClass: IMixinClass, options?: any) {
    this.cell.addColumnMixin(mixinClass, options);
  }

  protected get idPrefix() {
    return this.tableId;
  }

  abstract get id(): string;

  get width() {
    return this.context.column.totalHeight;
  }

  protected get visibleColumns() {
    return this.cell.visibleColumns;
  }

  protected get visibleFirstColumnPos() {
    return this.cell.visibleFirstColumnPos;
  }

  get height() {
    return this.context.totalHeight;
  }

  get hidden() {
    return this.header.classList.contains(cssClass('loading'));
  }

  protected updateSizer(firstRowPos: number) {
    this.updateShifts(firstRowPos, this.cell.leftShift());
    // no sizer update since centrally managed
  }

  protected updateShifts(top: number, _left: number) {
    setTransform(this.body, 0 /*left.toFixed(0)*/, top.toFixed(0));
  }

  set hidden(value: boolean) {
    const old = this.hidden;
    if (old === value) {
      return;
    }
    this.header.classList.toggle(cssClass('loading'), value);
    this.body.classList.toggle(cssClass('loading'), value);
    this.header.classList.toggle(cssClass('hidden'), value);
    this.body.classList.toggle(cssClass('hidden'), value);
    this.onVisibilityChanged(!value);
  }

  /**
   * hook when the visibility changes
   * @param {boolean} _visible current visibility
   */
  protected onVisibilityChanged(_visible: boolean) {
    // hook
  }

  hide() {
    this.hidden = true;
  }

  show(scrollLeft: number, clientWidth: number, isGoingRight: boolean) {
    const wasHidden = this.hidden;
    this.hidden = false;
    if (wasHidden) { // full update
      this.revalidate();
    } else {
      this.onScrolledHorizontally(scrollLeft, clientWidth, isGoingRight);
    }
  }

  init() {
    this.hide(); // hide by default
    this.cell.init();
    super.init();
  }

  destroy() {
    super.destroy();
    this.header.remove();
    this.style.remove(this.tableId);
  }

  protected onScrolledVertically(scrollTop: number, clientHeight: number, isGoingDown: boolean): EScrollResult {
    if (this.hidden) {
      return EScrollResult.NONE;
    }
    return super.onScrolledVertically(scrollTop, clientHeight, isGoingDown);
  }

  protected onScrolledHorizontally(scrollLeft: number, clientWidth: number, isGoingRight: boolean) {
    const r = this.cell.onScrolledHorizontally(scrollLeft, clientWidth, isGoingRight);
    this.updateSizer(this.visibleFirstRowPos);
    return r;
  }

  /**
   * the current render context, upon change `recreate` the whole table
   * @returns {ICellRenderContext}
   */
  protected abstract get context(): ICellRenderContext<T>;

  /**
   * create a new header node for the given column
   * @param {Document} document document to create nodes of
   * @param {T} column the column to create the header for
   * @returns {HTMLElement} the node representing the header
   */
  protected abstract createHeader(document: Document, column: T): HTMLElement | IAsyncUpdate<HTMLElement>;

  /**
   * updates the given header node with the given column
   * @param {HTMLElement} node node to update
   * @param {T} column the column to represents
   * @returns {HTMLElement | void} an optional new replacement node for the header
   */
  protected abstract updateHeader(node: HTMLElement, column: T): HTMLElement | IAsyncUpdate<HTMLElement> | void;

  /**
   * create a new cell node fo the given row index and column
   * @param {Document} document document the create nodes of
   * @param {number} index the current row index
   * @param {T} column the current column
   * @returns {HTMLElement} the node representing the cell
   */
  protected abstract createCell(document: Document, index: number, column: T): HTMLElement| IAsyncUpdate<HTMLElement>;

  /**
   * updates the given cell node with the given row index and column
   * @param {HTMLElement} node node to update
   * @param {number} index row index to use
   * @param {T} column column to use
   * @returns {HTMLElement | void} an optional new replacement node for the header
   */
  protected abstract updateCell(node: HTMLElement, index: number, column: T): HTMLElement | IAsyncUpdate<HTMLElement> | void;


  /**
   * triggers updating the header
   */
  protected updateHeaders() {
    this.cell.updateHeaders();
  }

  /**
   * trigger an update all all column widths
   */
  protected updateColumnWidths() {
    const context = this.context;
    this.style.update(context.defaultRowHeight - context.padding(-1), context.columns, context.column.padding, -this.cell.leftShift(), this.tableId);
  }

  protected recreate(ctx?: IAnimationContext) {
    const scroller = this.bodyScroller;
    const oldLeft = scroller.scrollLeft;
    this.cell.recreate(oldLeft, scroller.clientWidth);

    super.recreate(ctx);
    // restore left
    scroller.scrollLeft = oldLeft;
  }

  protected clearPool() {
    super.clearPool();
    this.cell.clearPool();
  }

  protected createRow(node: HTMLElement, rowIndex: number): void {
    this.cell.createRow(node, rowIndex);
    node.classList.add(this.style.cssClasses.tr);
  }

  protected updateRow(node: HTMLElement, rowIndex: number): void {
    this.cell.updateRow(node, rowIndex);
  }
}
