/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */
import { IAbortAblePromise, IAsyncUpdate } from './abortAble';
import { IAnimationContext } from './animation';
import { ARowRenderer, IRowRendererOptions, setTransform } from './ARowRenderer';
import { addScroll } from './internal';
import { EScrollResult, IMixinClass } from './mixin';
import { GridStyleManager, IColumn, setTemplate } from './style';
import { cssClass } from './styles';
import { ACellAdapter, ICellAdapterRenderContext, IVisibleColumns } from './table/internal/ACellAdapter';

export declare type ICellRenderContext<T extends IColumn> = ICellAdapterRenderContext<T>;

/**
 * a @see ARowRenderer which manages multiple columns per row
 */
export abstract class ACellRenderer<T extends IColumn> extends ARowRenderer {
  protected readonly style: GridStyleManager;

  private readonly cell: ACellAdapter<T>;

  constructor(protected readonly root: HTMLElement, htmlId: string, options: Partial<IRowRendererOptions> = {}) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    super(setTemplate(root, htmlId).querySelector<HTMLElement>('main > article')!, options);
    root.classList.add(cssClass(), 'lineup-engine');

    this.style = new GridStyleManager(this.root, htmlId);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
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

    this.cell = new LocalCell(this.header, this.style, this.style.id, options.mixins || []);
  }

  protected get idPrefix(): string {
    return this.style.id;
  }

  /**
   * get the header root element
   */
  protected get header(): HTMLElement {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.root.querySelector<HTMLElement>('header > article')!;
  }

  /**
   * get the header scrolling element, i.e its parent
   */
  protected get headerScroller(): HTMLElement {
    return this.root.getElementsByTagName('header')[0] as HTMLElement;
  }

  protected get visibleColumns(): IVisibleColumns {
    return this.cell.visibleColumns;
  }

  protected get visibleFirstColumnPos(): number {
    return this.cell.visibleFirstColumnPos;
  }

  /**
   * add another column mixin
   * @param {IMixinClass} mixinClass mixing class to instantiate
   * @param options optional options
   */
  protected addColumnMixin(mixinClass: IMixinClass, options?: unknown): void {
    this.cell.addColumnMixin(mixinClass, options);
  }

  /**
   * initialized this renderer
   */
  protected init(): void {
    this.cell.init();

    const scroller = this.body.parentElement as HTMLElement;

    let old = addScroll(scroller, this.options.async, (act) => {
      if (
        Math.abs(old.left - act.left) < this.options.minScrollDelta &&
        Math.abs(old.width - act.width) < this.options.minScrollDelta
      ) {
        return;
      }
      const isGoingRight = act.left > old.left;
      old = act;
      this.onScrolledHorizontally(act.left, act.width, isGoingRight);
    });

    super.init();
  }

  destroy(): void {
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
  protected abstract createCell(document: Document, index: number, column: T): HTMLElement | IAsyncUpdate<HTMLElement>;

  /**
   * updates the given cell node with the given row index and column
   * @param {HTMLElement} node node to update
   * @param {number} index row index to use
   * @param {T} column column to use
   * @returns {HTMLElement | void} an optional new replacement node for the header
   */
  protected abstract updateCell(
    node: HTMLElement,
    index: number,
    column: T
  ): HTMLElement | IAsyncUpdate<HTMLElement> | void;

  /**
   * trigger to update all headers
   */
  protected updateHeaders(): void {
    this.cell.updateHeaders();
  }

  protected handleCellReady(item: HTMLElement, ready: IAbortAblePromise<void>, column = -1): HTMLElement {
    return this.cell.handleCellReady(item, ready, column);
  }

  protected recycleCell(item: HTMLElement, column = -1): void {
    this.cell.recycleCell(item, column);
  }

  /**
   * triggers to update all column widths
   */
  protected updateColumnWidths(): void {
    const { context } = this;
    this.style.update(
      context.defaultRowHeight - context.padding(-1),
      context.columns,
      context.column.padding,
      0,
      this.idPrefix
    );
  }

  protected updateSizer(firstRowPos: number): void {
    const ctx = this.context;
    const { totalHeight } = ctx;
    const totalWidth = ctx.column.totalHeight;

    this.updateShifts(firstRowPos, this.cell.leftShift());
    this.bodySizer.style.transform = `translate(${Math.max(0, totalWidth - 1).toFixed(0)}px, ${Math.max(
      0,
      totalHeight - 1
    ).toFixed(0)}px)`;
  }

  protected updateShifts(top: number, _left: number): void {
    setTransform(this.body, 0 /* left.toFixed(0) */, top.toFixed(0));
  }

  /**
   * triggers to recreate the whole table
   * @param {IAnimationContext} ctx optional animation context
   */
  protected recreate(ctx?: IAnimationContext): void {
    const scroller = this.bodyScroller;
    const oldLeft = scroller.scrollLeft;
    this.cell.recreate(oldLeft, scroller.clientWidth);

    super.recreate(ctx);
    // restore left
    scroller.scrollLeft = oldLeft;
  }

  protected clearPool(): void {
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
