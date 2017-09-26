/**
 * Created by Samuel Gratzl on 19.07.2017.
 */
import {ARowRenderer} from './ARowRenderer';
import {GridStyleManager, IColumn, setTemplate} from './style';
import {IMixinClass} from './mixin';
import ACellAdapter, {ICellAdapterRenderContext} from './table/ACellAdapter';


export declare type ICellRenderContext<T extends IColumn> = ICellAdapterRenderContext<T>;

export abstract class ACellRenderer<T extends IColumn> extends ARowRenderer {

  protected readonly style: GridStyleManager;

  private readonly cell: ACellAdapter<T>;

  constructor(protected readonly root: HTMLElement, htmlId: string, ...mixinClasses: IMixinClass[]) {
    super(<HTMLElement>setTemplate(root).querySelector('main > article'), ...mixinClasses);
    root.classList.add('lineup-engine');

    this.style = new GridStyleManager(this.root, htmlId);

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
    this.cell = new LocalCell(this.header, this.style, undefined, ...mixinClasses);
  }

  protected get header() {
    return <HTMLElement>this.root.querySelector('header > article');
  }

  protected get headerScroller() {
    return <HTMLElement>this.root.querySelector('header');
  }

  protected addColumnMixin(mixinClass: IMixinClass, options?: any) {
    this.cell.addColumnMixin(mixinClass, options);
  }

  protected init() {

    this.cell.init();

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
    return this.cell.onScrolledHorizontally(scrollLeft, clientWidth, isGoingRight);
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

export default ACellRenderer;
