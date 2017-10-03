/**
 * Created by Samuel Gratzl on 26.09.2017.
 */
import ARowRenderer from '../ARowRenderer';
import ACellAdapter, {ICellAdapterRenderContext} from './internal/ACellAdapter';
import {EScrollResult, IMixinClass} from '../mixin/index';
import {ITableSection} from './MultiTableRowRenderer';
import GridStyleManager from '../style/GridStyleManager';
import {IColumn} from '../style/index';

export declare type ICellRenderContext<T extends IColumn> = ICellAdapterRenderContext<T>;

export abstract class ACellTableSection<T extends IColumn> extends ARowRenderer implements ITableSection {
  private readonly cell: ACellAdapter<T>;

  constructor(protected readonly header: HTMLElement, body: HTMLElement, protected readonly tableId: string, protected readonly style: GridStyleManager, ...mixinClasses: IMixinClass[]) {
    super(body, ...mixinClasses);

    const that = this;

    class LocalCell extends ACellAdapter<T> {
      protected get context(): ICellAdapterRenderContext<T> {
        return that.context;
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

      protected forEachRow(callback: (row: HTMLElement, rowIndex: number) => void) {
        return that.forEachRow(callback);
      }
    }
    this.cell = new LocalCell(this.header, this.style, tableId, ...mixinClasses);
  }

  protected addColumnMixin(mixinClass: IMixinClass, options?: any) {
    this.cell.addColumnMixin(mixinClass, options);
  }

  abstract get id(): string;

  get width() {
    return this.context.column.totalHeight;
  }

  get hidden() {
    return this.header.classList.contains('loading');
  }

  set hidden(value: boolean) {
    const old = this.hidden;
    if (old === value) {
      return;
    }
    this.header.classList.toggle('loading', value);
    this.body.classList.toggle('loading', value);
    this.onVisibilityChanged(value);
  }

  protected onVisibilityChanged(_visible: boolean) {
    // hook
  }

  hide() {
    this.hidden = true;
  }

  show(scrollLeft: number, clientWidth: number, isGoingRight: boolean) {
    this.hidden = false;
    this.cell.onScrolledHorizontally(scrollLeft, clientWidth, isGoingRight);
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
    return this.cell.onScrolledHorizontally(scrollLeft, clientWidth, isGoingRight);
  }

  /**
   * the current render context, upon change `recreate` the whole table
   * @returns {ICellRenderContext}
   */
  protected abstract get context(): ICellRenderContext<T>;

  protected abstract createHeader(document: Document, column: T): HTMLElement;

  protected abstract updateHeader(node: HTMLElement, column: T): HTMLElement | void;

  protected abstract createCell(document: Document, index: number, column: T): HTMLElement;

  protected abstract updateCell(node: HTMLElement, index: number, column: T): HTMLElement | void;

  protected updateHeaders() {
    this.cell.updateHeaders();
  }

  protected recreate() {
    const scroller = this.bodyScroller;
    const oldLeft = scroller.scrollLeft;
    this.cell.recreate(oldLeft, scroller.clientWidth);

    super.recreate();
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
