

import {ACellRenderer, ICellContext} from '../src/cell/ACellRenderer';
import {uniformContext} from '../src';

export default class CellRenderer extends ACellRenderer {
  protected readonly _context: ICellContext;

  constructor(root: HTMLElement, id: string, numberOfRows = 100, numberOfColumns = 100) {
    super(root);
    root.id = id;

    this._context = {
      col: uniformContext(numberOfColumns, 20),
      row: uniformContext(numberOfRows, 20)
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
    node.textContent = `Cell#${row}/${col}`;
    return node;
  }
  protected updateCell(node: HTMLElement, row: number, col: number): HTMLElement | void {
    node.textContent = `Cell#${row}/${col}`;
  }

  protected createRowHeader(doc: Document, row: number): HTMLElement {
    const node = doc.createElement('div');
    node.textContent = `Row#${row}`;
    return node;
  }
  protected updateRowHeader(node: HTMLElement, row: number): HTMLElement | void {
    node.textContent = `Row${row}`;
  }

  protected createColumnHeader(doc: Document, col: number): HTMLElement {
    const node = doc.createElement('div');
    node.textContent = `Col#${col}`;
    return node;
  }
  protected updateColumnHeader(node: HTMLElement, col: number): HTMLElement | void {
    node.textContent = `Col${col}`;
  }
}
