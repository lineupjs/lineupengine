/**
 * Created by Samuel Gratzl on 13.07.2017.
 */
import 'file-loader?name=taggle.html!extract-loader!html-loader!./index.html';
import {APrefetchRenderer, IRenderContext} from '../../src/APrefetchRenderer';
import {nonUniformContext} from '../../src/logic';
import {StyleManager, TEMPLATE} from '../../src/style';
import {fromArray, INode, LeafNode, InnerNode, EAggregationType} from './tree';
import Column, {computeHist} from './Column';
import './style.scss';

function setTemplate(root: HTMLElement) {
  root.innerHTML = TEMPLATE;
  return root;
}


export default class TestRenderer extends APrefetchRenderer {
  private readonly style: StyleManager;
  protected readonly _context: IRenderContext;

  private readonly columns: Column[];
  private flat: INode[] = [];

  private readonly defaultRowHeight: number;

  constructor(private readonly root: HTMLElement, numberOfRows = 100, numberOfColumns = 20) {
    super(<HTMLElement>setTemplate(root).querySelector(':scope > main > article'));
    root.id = 'taggle';
    root.classList.add('lineup-engine');
    const scroller = <HTMLElement>root.querySelector(':scope > main');

    this.defaultRowHeight = 20;
    const tree = this.createTree(numberOfRows, this.defaultRowHeight, 100);

    this.flat = tree.flatChildren();

    this.columns = [new Column(0, 'Number', false, 300)];

    const exceptions = nonUniformContext(this.flat.map((n) => n.height), this.defaultRowHeight);

    this._context = Object.assign({
      defaultRowHeight: this.defaultRowHeight,
      numberOfRows: this.flat.length,
      scroller
    }, exceptions);

    this.style = new StyleManager(root, `#taggle`, this._context.defaultRowHeight);

  }

  private createTree(numberOfRows: number, leafHeight: number, groupHeight: number): InnerNode {
    const arr = Array.from(new Array(numberOfRows).keys()).map(() => Math.random());
    const root = fromArray(arr, leafHeight, (row: number) => String(Math.floor(row*4)));

    root.children.forEach((n) => {
      const inner = <InnerNode>n;
      if (Math.random() < 0.25) {
        inner.aggregation = EAggregationType.AGGREGATED;
        inner.height = groupHeight;
        inner.aggregate = computeHist(inner.flatLeaves<number>());
      }
    });

    return root;
  }

  private getRow(index: number): INode {
    return this.flat[index];
  }


  run() {
    const header = <HTMLElement>this.root.querySelector(':scope > header');
    const headerNode = <HTMLElement>header.querySelector(':scope > article');

    this.style.update(this.columns, 100);
    this.columns.forEach((c) => headerNode.appendChild(c.createHeader(headerNode.ownerDocument)));

    //wait till layouted
    setTimeout(super.init.bind(this), 100, headerNode);
  }

  protected onScrolledHorizontally(scrollLeft: number) {
    this.style.updateFrozenColumnsShift(this.columns, scrollLeft);
  }

  protected get context(): IRenderContext {
    return this._context;
  }

  protected createRow(node: HTMLElement, index: number) {
    const row = this.getRow(index);
    const document = node.ownerDocument;

    this.columns.forEach((col, i) => {
      const child = row.type === 'leaf' ? col.createSingle(<LeafNode<number>>row, i, document) : col.createGroup(<InnerNode>row, i, document);
      node.appendChild(child);
    });

    node.dataset.type = row.type;
    if (row.height !== this.defaultRowHeight) {
      node.style.height = `${row.height}px`;
    }
  }

  protected updateRow(node: HTMLElement, index: number) {
    const row = this.getRow(index);
    const document = node.ownerDocument;

    const was = node.dataset.type;
    node.dataset.type = row.type;
    this.columns.forEach((col, i) => {
      const child = <HTMLElement>node.children[i];
      if (was !== row.type) {
        const replacement = row.type === 'leaf' ? col.createSingle(<LeafNode<number>>row, i, document) : col.createGroup(<InnerNode>row, i, document);
        node.replaceChild(replacement, child);
      } else {
        if (row.type === 'leaf') {
          col.updateSingle(child, <LeafNode<number>>row, i);
        } else {
          col.updateGroup(child, <InnerNode>row, i);
        }
      }
    });

    if (row.height !== this.defaultRowHeight) {
      node.style.height = `${row.height}px`;
    }
  }
}
