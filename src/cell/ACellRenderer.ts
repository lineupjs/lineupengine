import {IExceptionContext} from '../logic';

const template = `<header></header>
<aside></aside>
<main></main><style></style>`;

type Slice = [number, number];

abstract class AQuadTreeNode {
  parent: QuadTreeInnerNode|null  = null;

  constructor(public readonly index: number, public readonly rowFirst: number, public readonly rowLast: number, public readonly colFirst: number, public readonly colLast: number, public readonly rowTotal: number, public readonly colTotal: number) {

  }

  get rowCount() {
    //since inclusive
    return this.rowLast - this.rowFirst + 1;
  }

  get colCount() {
    return this.colLast - this.colFirst + 1;
  }

  get width() {
    return this.rowTotal;
  }

  get height() {
    return this.colTotal;
  }

  get id() {
    let id = '${this.index}';
    let p = this.parent;
    while (p !== null) {
      id = `${p.index}-${id}`;
    }
    return id;
  }
}

class QuadTreeLeafNode {

}

class QuadTreeInnerNode {
  /**
   * 1 | 2
   * 3 | 4
   */
  readonly children: QuadTreeNode[] = [];
}

type QuadTreeNode = QuadTreeInnerNode|QuadTreeLeafNode;

export interface ICellContext {
  row: IExceptionContext;
  col: IExceptionContext;
}

const leafCount = 4; //don't split further than 4x4 grids

export abstract class ACellRenderer {
  private readonly pool: HTMLElement[] = [];
  private readonly fragment: DocumentFragment;

  protected readonly visible = {
    rowFirst: 0,
    rowLast: 0,
    colFirst: 0,
    colLast: 0
  };

  private tree: QuadTreeNode;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template;
    this.fragment = body.ownerDocument.createDocumentFragment();
  }

  protected abstract get context(): ICellContext;

  private get doc() {
    return this.root.ownerDocument;
  }
  private get body(): HTMLElement {
    return <HTMLElement>this.root.children[2]!;
  }

  private get colHeader(): HTMLElement {
    return <HTMLElement>this.root.firstElementChild!;
  }

  private get rowHeader(): HTMLElement {
    return <HTMLElement>this.root.children[1]!;
  }

  protected createCell(doc: Document, row: number, col: number): HTMLElement {
    const node = document.createElement('div');
    node.textContent = `Cell#${row}/${col}`;
    return node;
  }
  protected updateCell(node: HTMLElement, row: number, col: number): HTMLElement | void {
    node.textContent = `Cell#${row}/${col}`;
  }

  protected createRowHeader(doc: Document, row: number): HTMLElement {
    const node = document.createElement('div');
    node.textContent = `Row#${row}`;
    return node;
  }
  protected updateRowHeader(node: HTMLElement, row: number): HTMLElement | void {
    node.textContent = `Row${row}`;
  }

  protected createColumnHeader(doc: Document, col: number): HTMLElement {
    const node = document.createElement('div');
    node.textContent = `Col#${col}`;
    return node;
  }
  protected updateColumnHeader(node: HTMLElement, col: number): HTMLElement | void {
    node.textContent = `Col${col}`;
  }

  protected init() {
    const body = this.body;
    const rowHeader = this.rowHeader;
    const colHeader = this.colHeader;

    let oldTop = body.scrollTop;
    let oldLeft = body.scrollLeft;
    body.addEventListener('scroll', (evt) => {
      const left = body.scrollLeft;
      const top = body.scrollTop;
      if (oldTop === top && oldLeft === left) {
        return;
      }
      const isGoingDown = top > oldTop;
      const isGoingRight = left > oldLeft;

      oldTop = top;
      oldLeft = left;

      rowHeader.scrollTop = top;
      colHeader.scrollLeft = left;

      this.onScroll(left, top, body.clientWidth, body.clientHeight, isGoingDown, isGoingRight);
    }

    this.recreate();
  }

  private static sliceHeight(ctx: IExceptionContext, start: number, end: number) {
    let height = (end - start + 1) * ctx.defaultRowHeight;
    for (const ex of ctx.exceptions) {
      if (ex.index < start) {
        continue;
      }
      if (ex.index > end) {
        break;
      }
      height += ex.height - ctx.defaultRowHeight; //change to exception height
    }
    return height;
  }

  private buildTree(row: IExceptionContext, col: IExceptionContext) {
    const build = (index: number, rowFirst: number, rowLast: number, colFirst: number, colLast: number, rowTotal: number, colTotal: number) {
      const rowCount = rowLast - rowFirst + 1;
      const colCount = colLast - colFirst + 1;
      if (rowCount <= leafCount && colCount <= leafCount) {
        return new QuadTreeLeafNode(index, rowFirst, rowLast, colFirst, colLast, rowTotal, colTotal);
      }
      const inner = new QuadTreeInnerNode(index, rowFirst, rowLast, colFirst, colLast, rowTotal, colTotal);

      const rowMiddle =  Math.floor(rowCount / 2);
      const colMiddle = Math.floor(colCount / 2);

      const leftSlice = ACellRenderer.sliceHeight(col, colFirst, colMiddle);
      const rightSlice = colTotal - leftSlice;

      const topSlice = ACellRenderer.sliceHeight(row, rowFirst, rowMiddle);
      const bottomSlice = rowTotal - topSlice;

      inner.children.push(build(0, rowFirst, rowMiddle, colFirst, colMiddle, topSlice, leftSlice));
      inner.children.push(build(1, rowFirst, rowMiddle, colMiddle + 1, colLast, topSlice, rightSlice));
      inner.children.push(build(2, rowMiddle + 1, rowLast, colFirst, colMiddle, bottomSlice, leftSlice));
      inner.children.push(build(3, rowMiddle + 1, rowLast, colMiddle + 1, colLast, bottomSlice, rightSlice));

      inner.children.forEach((c) => c.parent = inner);
      return inner;
    }

    return build(0, 0, row.numberOfRows - 1, 0, col.numberOfRows - 1, row.totalHeight, col.totalHeight);
  }

  protected recreate() {
    const {row, col} = this.context;
    this.tree = this.buildTree(row, col);
  }

  private onScroll(left: number, top: number, width: number, height: number, isGoingDown: boolean, isGoingRight: boolean) {
    const context = this.context;
    const visible = this.visible;

    //TODO
  }

  private renderLeaf(node: HTMLElement, leaf: QuadTreeLeafNode) {
    const parent = this.doc.createElement('div');
    parent.dataset.tree = leaf.id;
    for(let row = leaf.rowFirst; row <= leaf.rowLast; ++row) {
      for(let col = leaf.colFirst; col <= leaf.colLast; ++col) {
        parent.appendChild(this.select(row, col));
      }
    }
    node.appendChild(parent);
  }


  protected clearPool() {
    // clear pool
    this.pool.splice(0, this.pool.length);
  }

  private static cleanUp(item: HTMLElement) {
    if (item.style.height) {
      item.style.height = null;
    }
    if (item.style.width) {
      item.style.width = null;
    }
  }

  private select(row: number, col: number): HTMLElement {
    let item: HTMLElement;
    if (this.pool.length > 0) {
      item = this.pool.pop()!;
      item = this.updateCell(item, row, col) || item;
    } else {
      item = this.createCell(this.doc, row, col);
    }
    item.dataset.row = String(row);
    item.dataset.col = String(col);
    return item;
  }

  private recycle(item: HTMLElement) {
    ACellRenderer.cleanUp(item);
    this.pool.push(item);
  }
}

export default ACellRenderer;
