/**
 * Created by Samuel Gratzl on 13.07.2017.
 */
import 'file-loader?name=taggle.html!extract-loader!html-loader!./index.html';
import {APrefetchRenderer, IRenderContext} from '../../src/APrefetchRenderer';
import {nonUniformContext} from '../../src/logic';
import {StyleManager, TEMPLATE} from '../../src/style';
import {fromArray, INode, LeafNode, InnerNode, EAggregationType} from './tree';
import {StringColumn, computeHist, ITaggleColumn, NumberColumn} from './column';
import './style.scss';

function setTemplate(root: HTMLElement) {
  root.innerHTML = TEMPLATE;
  return root;
}


export default class TestRenderer extends APrefetchRenderer {
  private readonly style: StyleManager;
  protected _context: IRenderContext;

  private readonly columns: ITaggleColumn[];
  private readonly tree: InnerNode;
  private flat: INode[] = [];

  private readonly defaultRowHeight: number;

  constructor(private readonly root: HTMLElement, numberOfRows = 1000) {
    super(<HTMLElement>setTemplate(root).querySelector(':scope > main > article'));
    root.id = 'taggle';
    root.classList.add('lineup-engine');
    const scroller = <HTMLElement>root.querySelector(':scope > main');

    this.defaultRowHeight = 20;
    this.tree = this.createTree(numberOfRows, this.defaultRowHeight, 100);


    this.columns = [new StringColumn(0, 'String', true, 200), new NumberColumn(1, 'Number', false, 200)];
    this.style = new StyleManager(root, `#taggle`, this.defaultRowHeight);

    this.rebuild();
  }

  private createTree(numberOfRows: number, leafHeight: number, groupHeight: number): InnerNode {
    const arr = Array.from(new Array(numberOfRows).keys()).map(() => Math.random());
    const root = fromArray(arr, leafHeight, (row: number) => String(Math.floor(Math.random()*5)));

    root.children.sort((a: any, b: any) => a.name.localeCompare(b.name));
    root.children.forEach((n) => {
      const inner = <InnerNode>n;
      if (Math.random() < 0.3) {
        inner.aggregation = EAggregationType.AGGREGATED;
      }

      inner.aggregatedHeight = groupHeight;
      inner.aggregate = computeHist(inner.flatLeaves<number>());
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
      const child = row.type === 'leaf' ? col.createSingle(<LeafNode<number>>row, index, document) : col.createGroup(<InnerNode>row, index, document);
      node.appendChild(child);
    });

    node.dataset.type = row.type;
    if (row.height !== this.defaultRowHeight) {
      node.style.height = `${row.height}px`;
    }

    node.onclick = (evt) => {
      const rowNode = <HTMLElement>evt.currentTarget;
      const index = parseInt(rowNode.dataset.index, 10);
      const row = this.getRow(index);
      if (row.type === 'leaf') {
        row.parent.aggregation = EAggregationType.AGGREGATED;
      } else {
        row.aggregation = EAggregationType.UNIFORM;
      }
      this.rebuild();
      this.recreate();
    };
  }

  private rebuild() {
    this.flat = this.tree.flatChildren();
    const exceptions = nonUniformContext(this.flat.map((n) => n.height), this.defaultRowHeight);
    const scroller = <HTMLElement>this.root.querySelector(':scope > main');

    this._context = Object.assign({
      defaultRowHeight: this.defaultRowHeight,
      numberOfRows: this.flat.length,
      scroller
    }, exceptions);
  }

  protected updateRow(node: HTMLElement, index: number) {
    const row = this.getRow(index);
    const document = node.ownerDocument;

    const was = node.dataset.type;
    node.dataset.type = row.type;
    this.columns.forEach((col, i) => {
      const child = <HTMLElement>node.children[i];
      if (was !== row.type) {
        const replacement = row.type === 'leaf' ? col.createSingle(<LeafNode<number>>row, index, document) : col.createGroup(<InnerNode>row, index, document);
        node.replaceChild(replacement, child);
      } else {
        if (row.type === 'leaf') {
          col.updateSingle(child, <LeafNode<number>>row, index);
        } else {
          col.updateGroup(child, <InnerNode>row, index);
        }
      }
    });

    if (row.height !== this.defaultRowHeight) {
      node.style.height = `${row.height}px`;
    }
  }
}
