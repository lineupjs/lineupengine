/**
 * Created by Samuel Gratzl on 19.07.2017.
 */
import {ABaseRenderer} from './ABaseRenderer';
import {IColumn, setColumn, StyleManager, TEMPLATE} from './style';
import {IExceptionContext} from './logic';

export interface IColumnRenderContext<T extends IColumn> extends IExceptionContext {
  readonly column: IExceptionContext;
  readonly columns: T[];
  readonly htmlId: string;
}

function setTemplate(root: HTMLElement) {
  root.innerHTML = TEMPLATE;
  return root;
}

export abstract class AColumnBaseRenderer<T extends IColumn> extends ABaseRenderer {
  protected visibleColumns = {
    first: 0,
    forcedFirst: 0,
    last: 0,
    forcedLast: 0
  };
  protected visibleFirstColumnPos = 0;

  private style: StyleManager;

  constructor(protected readonly root: HTMLElement) {
    super(<HTMLElement>setTemplate(root).querySelector('main > article'));
  }

  protected get header() {
    return <HTMLElement>this.root.querySelector('header > article');
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

  protected onScrolledHorizontally(_scrollLeft: number, _isGoingRight: boolean) {
    //TODO
  }

  /**
   * the current render context, upon change `recreate` the whole table
   * @returns {IRenderContext}
   */
  protected abstract get context(): IColumnRenderContext<T>;

  protected abstract createHeader(document: Document, column: T, ...extras: any[]): HTMLElement;

  protected abstract updateHeader(node: HTMLElement, column: T, ...extras: any[]): HTMLElement | void;

  protected abstract createColumn(document: Document, index: number, column: T, ...extras: any[]): HTMLElement;

  protected abstract updateColumn(node: HTMLElement, index: number, column: T, ...extras: any[]): HTMLElement | void;

  protected createRow(node: HTMLElement, index: number, ...extras: any[]): void {
    const {columns} = this.context;
    const document = node.ownerDocument;
    columns.forEach((column) => {
      const child = this.createColumn(document, index, column, ...extras);
      setColumn(child, column);
      node.appendChild(child);
    });
  }

  protected updateRow(node: HTMLElement, index: number, ...extras: any[]): void {
    const {columns} = this.context;
    columns.forEach((column, i) => {
      const child = <HTMLElement>node.children[i];
      const replacement = this.updateColumn(child, index, column, ...extras);
      if (replacement !== undefined && replacement !== child) { //have a replacement
        node.replaceChild(replacement, child);
      }
    });
  }
}

export default AColumnBaseRenderer;
