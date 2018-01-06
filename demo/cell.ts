import 'file-loader?name=cell.html!extract-loader!html-loader!./cell.html';
import {uniformContext} from '../src';
import {ACellRenderer, ICellContext} from '../src/cell/ACellRenderer';
import '../src/style.scss';

/** @internal */
export default class CellRenderer extends ACellRenderer {
  protected readonly _context: ICellContext;

  constructor(root: HTMLElement, id: string, numberOfRows = 128, numberOfColumns = 128) {
    super(root);
    root.id = id;

    this._context = {
      col: uniformContext(numberOfColumns, 50),
      row: uniformContext(numberOfRows, 50)
    };
  }

  run() {
    //wait till layouted
    setTimeout(super.init.bind(this), 100);
  }

  protected get context() {
    return this._context;
  }

  protected createCell(doc: Document, row: number, col: number): HTMLElement {
    const node = doc.createElement('div');
    node.textContent = `${row}/${col}`;
    return node;
  }

  protected updateCell(node: HTMLElement, row: number, col: number): HTMLElement | void {
    node.textContent = `${row}/${col}`;
  }

  protected createRowHeader(doc: Document, row: number): HTMLElement {
    const node = doc.createElement('div');
    node.textContent = `#${row}`;
    return node;
  }

  protected updateRowHeader(node: HTMLElement, row: number): HTMLElement | void {
    node.textContent = `#${row}`;
  }

  protected createColumnHeader(doc: Document, col: number): HTMLElement {
    const node = doc.createElement('div');
    node.textContent = `#${col}`;
    return node;
  }

  protected updateColumnHeader(node: HTMLElement, col: number): HTMLElement | void {
    node.textContent = `#${col}`;
  }
}
