import {IAnimationContext} from './animation';
import {ARowRenderer, IRowRendererOptions} from './ARowRenderer';
import {EScrollResult, IMixinClass} from './mixin';
import {GridStyleManager, IColumn, setTemplate} from './style';
import ACellAdapter, {ICellAdapterRenderContext} from './table/internal/ACellAdapter';
import {addScroll} from './internal';
import {cssClass} from './styles';


export declare type ICellRenderContext<T extends IColumn> = ICellAdapterRenderContext<T>;

/**
 * a @see ARowRenderer which manages multiple columns per row
 */
export abstract class ACellRenderer<T extends IColumn> extends ARowRenderer {

  protected readonly style: GridStyleManager;

  private readonly cell: ACellAdapter<T>;

  constructor(protected readonly root: HTMLElement, htmlId: string, options: Partial<IRowRendererOptions> = {}) {
    super(<HTMLElement>setTemplate(root, htmlId).querySelector('main > article'), options);
    root.classList.add(cssClass(), 'lineup-engine');

    this.style = new GridStyleManager(this.root, htmlId);

    const that = this;

    class LocalCell extends ACellAdapter<T> {
      protected get context(): ICellAdapterRenderContext<T> {
        return that.context;
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

      protected updateCell(node: HTMLElement, index: number, column: T) {
        return that.updateCell(node, index, column);
      }

      protected updateColumnOffset(firstColumnPos: number) {
        super.updateColumnOffset(firstColumnPos);
        that.updateOffset(that.visibleFirstRowPos);
      }

      protected forEachRow(callback: (row: HTMLElement, rowIndex: number) => void) {
        return that.forEachRow(callback);
      }
    }

    this.cell = new LocalCell(this.header, this.style, this.style.id, ... (options.mixins || []));
  }

  protected get idPrefix() {
    return this.style.id;
  }

  /**
   * get the header root element
   * @returns {HTMLElement}
   */
  protected get header() {
    return <HTMLElement>this.root.querySelector('header > article');
  }

  /**
   * get the header scrolling element, i.e its parent
   * @returns {HTMLElement}
   */
  protected get headerScroller() {
    return <HTMLElement>this.root.querySelector('header');
  }

  /**
   * add another column mixin
   * @param {IMixinClass} mixinClass mixing class to instantiate
   * @param options optional options
   */
  protected addColumnMixin(mixinClass: IMixinClass, options?: any) {
    this.cell.addColumnMixin(mixinClass, options);
  }

  /**
   * initialized this renderer
   */
  protected init() {

    this.cell.init();

    const scroller = <HTMLElement>this.body.parentElement;

    let old = addScroll(scroller, this.options.async, (act) => {
      if (Math.abs(old.left - act.left) < this.options.minScrollDelta && Math.abs(old.width - act.width) < this.options.minScrollDelta) {
        return;
      }
      const isGoingRight = act.left > old.left;
      old = act;
      this.onScrolledHorizontally(act.left, act.width, isGoingRight);
    });

    super.init();
  }

  destroy() {
    super.destroy();
    this.root.remove();
  }

  /**
   * will be called when scrolled horizontally
   * @param {number} scrollLeft
   * @param {number} clientWidth
   * @param {boolean} isGoingRight
   * @returns {EScrollResult}
   */
  protected onScrolledHorizontally(scrollLeft: number, clientWidth: number, isGoingRight: boolean): EScrollResult {
    return this.cell.onScrolledHorizontally(scrollLeft, clientWidth, isGoingRight);
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
  protected abstract createHeader(document: Document, column: T): HTMLElement;

  /**
   * updates the given header node with the given column
   * @param {HTMLElement} node node to update
   * @param {T} column the column to represents
   * @returns {HTMLElement | void} an optional new replacement node for the header
   */
  protected abstract updateHeader(node: HTMLElement, column: T): HTMLElement | void;

  /**
   * create a new cell node fo the given row index and column
   * @param {Document} document document the create nodes of
   * @param {number} index the current row index
   * @param {T} column the current column
   * @returns {HTMLElement} the node representing the cell
   */
  protected abstract createCell(document: Document, index: number, column: T): HTMLElement;

  /**
   * updates the given cell node with the given row index and column
   * @param {HTMLElement} node node to update
   * @param {number} index row index to use
   * @param {T} column column to use
   * @returns {HTMLElement | void} an optional new replacement node for the header
   */
  protected abstract updateCell(node: HTMLElement, index: number, column: T): HTMLElement | void;

  /**
   * trigger to update all headers
   */
  protected updateHeaders() {
    this.cell.updateHeaders();
  }

  /**
   * triggers to update all column widths
   */
  protected updateColumnWidths() {
    const context = this.context;
    this.style.update(context.defaultRowHeight - context.padding(-1), context.columns, context.column.padding, -this.cell.leftShift(), this.idPrefix);
  }

  protected updateSizer(firstRowPos: number) {
    const ctx = this.context;
    const totalHeight = ctx.totalHeight;
    const totalWidth = ctx.column.totalHeight;

    this.body.style.transform = `translate(${this.cell.leftShift().toFixed(0)}px, ${firstRowPos.toFixed(0)}px)`;
    this.bodySizer.style.transform = `translate(${Math.max(0, totalWidth - 1).toFixed(0)}px, ${Math.max(0, totalHeight - 1).toFixed(0)}px)`;
  }

  /**
   * triggers to recreate the whole table
   * @param {IAnimationContext} ctx optional animation context
   */
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
  }

  protected updateRow(node: HTMLElement, rowIndex: number): void {
    this.cell.updateRow(node, rowIndex);
  }
}

export default ACellRenderer;
