import {IExceptionContext, range} from '../logic';
import QuadTreeNode, {
  QuadTreeLeafNode, QuadTreeInnerNode, TOP_LEFT, BOTTOM_LEFT,
  TOP_RIGHT, BOTTOM_RIGHT
} from './internal/QuadTreeNode';
import './style.scss';

const template = `<header></header>
<aside></aside>
<main></main><style></style>`;


export interface ICellContext {
  row: IExceptionContext;
  col: IExceptionContext;
}

const leafCount = 4; //don't split further than 4x4 grids

export abstract class ACellRenderer {
  private readonly poolLeaves: HTMLElement[] = [];
  private readonly poolInner: HTMLElement[] = [];
  private readonly fragment: DocumentFragment;

  private tree: QuadTreeNode;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template;
    this.fragment = root.ownerDocument.createDocumentFragment();
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

  protected abstract createCell(doc: Document, row: number, col: number): HTMLElement;
  protected abstract updateCell(node: HTMLElement, row: number, col: number): HTMLElement | void;

  protected abstract createRowHeader(doc: Document, row: number): HTMLElement;
  protected abstract updateRowHeader(node: HTMLElement, row: number): HTMLElement | void;

  protected abstract createColumnHeader(doc: Document, col: number): HTMLElement;
  protected abstract updateColumnHeader(node: HTMLElement, col: number): HTMLElement | void;

  protected init() {
    const body = this.body;
    const rowHeader = this.rowHeader;
    const colHeader = this.colHeader;

    let oldTop = body.scrollTop;
    let oldLeft = body.scrollLeft;
    body.addEventListener('scroll', () => {
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
    });

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

      const leftSlice = ACellRenderer.sliceHeight(col, colFirst, inner.colMiddle);
      const rightSlice = colTotal - leftSlice;

      const topSlice = ACellRenderer.sliceHeight(row, rowFirst, inner.rowMiddle);
      const bottomSlice = rowTotal - topSlice;

      inner.children.push(build(TOP_LEFT, rowFirst, inner.rowMiddle, colFirst, inner.colMiddle, topSlice, leftSlice));
      inner.children.push(build(TOP_RIGHT, rowFirst, inner.rowMiddle, inner.colMiddle + 1, colLast, topSlice, rightSlice));
      inner.children.push(build(BOTTOM_LEFT, inner.rowMiddle + 1, rowLast, colFirst, inner.colMiddle, bottomSlice, leftSlice));
      inner.children.push(build(BOTTOM_RIGHT, inner.rowMiddle + 1, rowLast, inner.colMiddle + 1, colLast, bottomSlice, rightSlice));

      inner.children.forEach((c) => c.parent = inner);
      return inner;
    };

    return build(0, 0, row.numberOfRows - 1, 0, col.numberOfRows - 1, row.totalHeight, col.totalHeight);
  }

  protected recreate() {
    const {row, col} = this.context;
    this.tree = this.buildTree(row, col);
  }

  private onScroll(left: number, top: number, width: number, height: number, isGoingDown: boolean, isGoingRight: boolean) {
    const context = this.context;

    const col = range(left, width, context.col.defaultRowHeight, context.col.exceptions, context.col.numberOfRows);
    const row = range(top, height, context.row.defaultRowHeight, context.row.exceptions, context.row.numberOfRows);

    this.render(this.tree, this.body, row.first, row.last, col.first, col.last);
  }

  private renderLeaf(leaf: QuadTreeLeafNode, parent: HTMLElement) {
    const doc = this.doc;
    const children = <HTMLElement[]>Array.from(parent.children);
    parent.innerHTML = '';

    for(let row = leaf.rowFirst; row <= leaf.rowLast; ++row) {
      for(let col = leaf.colFirst; col <= leaf.colLast; ++col) {
        let item: HTMLElement;
        if (children.length > 0) {
          item = children.shift()!;
          const change = this.updateCell(item, row, col);
          if (change && change !== item) {
            children.unshift(item);
            item = change;
          }
        } else {
          item = this.createCell(doc, row, col);
        }
        (<any>item.style).gridArea = `${row - leaf.rowFirst + 1} / ${col - leaf.colFirst + 1}`;
        item.dataset.row = String(row);
        item.dataset.col = String(col);
        parent.appendChild(item);
      }
    }
    return parent;
  }

  private render(node: QuadTreeNode, parent: HTMLElement, rowFirst: number, rowLast: number, colFirst: number, colLast: number) {
    parent.dataset.node=node.type;
    parent.dataset.index=String(node.index);
    (<any>parent.style).gridArea = node.area;

    if (node.type === 'leaf') {
      return this.renderLeaf(<QuadTreeLeafNode>node, parent);
    }
    const inner = <QuadTreeInnerNode>node;

    const cache = <(HTMLElement|null)[]>[null, null, null, null];
    Array.from(parent.children).forEach((c) => {
      const n = <HTMLElement>c;
      cache[parseInt(n.dataset.index!, 10)] = n;
    });
    parent.innerHTML = '';

    const render = (index: number) => {
      const c = cache[index];
      if (c) { //assume up to date
        cache[index] = null; //mark as used
        return c;
      }
      const child = inner.children[index];
      let node: HTMLElement;
      if (child.type === 'inner') {
        node = this.poolInner.length > 0 ? this.poolInner.pop()! : this.doc.createElement('div');
      } else {
        node = this.poolLeaves.length > 0 ? this.poolLeaves.pop()! : this.doc.createElement('div');
      }
      return this.render(child, node, rowFirst, rowLast, colFirst, colLast);
    };

    const showLeft = !(inner.colFirst > colLast || inner.colMiddle < colFirst);
    const showRight = !(inner.colMiddle > colLast || inner.colLast < colFirst);
    const showTop = !(inner.rowFirst > rowLast || inner.rowMiddle < rowFirst);
    const showBottom  = !(inner.rowMiddle > rowLast || inner.rowLast < rowFirst);

    if (showLeft && showTop) {
      parent.appendChild(render(TOP_LEFT));
    }
    if (showRight && showTop) {
      parent.appendChild(render(TOP_RIGHT));
    }
    if (showLeft && showBottom) {
      parent.appendChild(render(BOTTOM_LEFT));
    }
    if (showRight && showBottom) {
      parent.appendChild(render(BOTTOM_RIGHT));
    }
    //recycle not used cached items
    cache.forEach((c) => {
      if (c) {
        this.recycle(c);
      }
    });
    return parent;
  }

  private recycle(node: HTMLElement) {
    if (node.dataset.node === 'leaf') {
      this.recycleLeaf(node);
      return;
    }
    //recycle all leaves
    const leaves = <HTMLElement[]>Array.from(node.querySelectorAll('[data-node=leaf]'));
    //recycle all inner nodes
    const inner = <HTMLElement[]>Array.from(node.querySelectorAll('[data-node=inner]'));
    node.innerHTML = '';
    leaves.forEach((node) => this.recycleLeaf(node));
    inner.forEach((node) => {
      node.innerHTML = '';
      this.poolInner.push(node);
    });
    this.poolInner.push(node);
  }

  private recycleLeaf(node: HTMLElement) {
    this.poolLeaves.push(node);
  }


  protected clearPool() {
    // clear pool
    this.poolInner.splice(0, this.poolInner.length);
    this.poolLeaves.splice(0, this.poolLeaves.length);
  }
}

export default ACellRenderer;
