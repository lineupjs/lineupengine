/* eslint-disable class-methods-use-this */
import { uniformContext } from '../src';
import { ACellRenderer, ICellContext } from '../src/cell/ACellRenderer';
import '../src/style.scss';

/** @internal */
export default class CellRenderer extends ACellRenderer {
  protected readonly privateContext: ICellContext;

  constructor(root: HTMLElement, id: string, numberOfRows = 128, numberOfColumns = 128) {
    super(root);
    // eslint-disable-next-line no-param-reassign
    root.id = id;

    this.privateContext = {
      col: uniformContext(numberOfColumns, 50),
      row: uniformContext(numberOfRows, 50),
    };
  }

  run(): void {
    // wait till layouted
    setTimeout(super.init.bind(this), 100);
  }

  protected get context(): ICellContext {
    return this.privateContext;
  }

  protected createCell(doc: Document, row: number, col: number): HTMLElement {
    const node = doc.createElement('div');
    node.textContent = `${row}/${col}`;
    return node;
  }

  protected updateCell(node: HTMLElement, row: number, col: number): HTMLElement | void {
    // eslint-disable-next-line no-param-reassign
    node.textContent = `${row}/${col}`;
  }

  protected createRowHeader(doc: Document, row: number): HTMLElement {
    const node = doc.createElement('div');
    node.textContent = `#${row}`;
    return node;
  }

  protected updateRowHeader(node: HTMLElement, row: number): HTMLElement | void {
    // eslint-disable-next-line no-param-reassign
    node.textContent = `#${row}`;
  }

  protected createColumnHeader(doc: Document, col: number): HTMLElement {
    const node = doc.createElement('div');
    node.textContent = `#${col}`;
    return node;
  }

  protected updateColumnHeader(node: HTMLElement, col: number): HTMLElement | void {
    // eslint-disable-next-line no-param-reassign
    node.textContent = `#${col}`;
  }
}
