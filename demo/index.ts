/**
 * Created by Samuel Gratzl on 13.07.2017.
 */
import 'file-loader?name=demo.html!extract-loader!html-loader!./index.html';
import {APrefetchRenderer, IRenderContext, abortAble} from '../src/APrefetchRenderer';
import {uniformContext} from '../src/logic';
import {StyleManager, IColumn, setColumn, TEMPLATE} from '../src/style';

function setTemplate(root: HTMLElement) {
  root.innerHTML = TEMPLATE;
  return root;
}

function resolveIn(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

class Column<T> implements IColumn {
  constructor(public readonly index: number, public readonly name: string, public readonly frozen: boolean = false, public readonly width = 100) {

  }

  get id() {
    return `col${this.index}`;
  }

  common(document: Document) {
    const d = document.createElement('div');
    if (this.frozen) {
      d.classList.add('frozen');
    }
    d.dataset.id = this.id;
    setColumn(d, this);
    return d;
  }

  header(document: Document) {
    const d = this.common(document);
    d.textContent = this.name;
    return d;
  }

  cell(row: T, document: Document) {
    return this.update(this.common(document), row);
  }

  update(node: HTMLElement, row: T) {
    node.textContent = `${this.name}@${row.toString()}`;
    return node;
  }
}

export default class TestRenderer extends APrefetchRenderer {
  private readonly style: StyleManager;
  protected readonly _context: IRenderContext;

  private readonly columns: Column<number>[];

  constructor(private readonly root: HTMLElement, id: string, numberOfRows = 100, numberOfColumns = 20) {
    super(<HTMLElement>setTemplate(root).querySelector(':scope > main > article'));
    root.id = id;
    root.classList.add('lineup-engine');
    const scroller = <HTMLElement>root.querySelector(':scope > main');


    const defaultRowHeight = 20;

    this.columns = [];
    for (let i = 0; i < numberOfColumns; ++i) {
      this.columns.push(new Column(i, i.toString(36), i % 4 === 0));
    }
    const exceptions = uniformContext(numberOfRows, defaultRowHeight);

    this._context = Object.assign({
      scroller
    }, exceptions);

    this.style = new StyleManager(root, `#${id}`, this._context.defaultRowHeight);

  }


  run() {
    const header = <HTMLElement>this.root.querySelector(':scope > header');
    const headerNode = <HTMLElement>header.querySelector(':scope > article');

    this.style.update(this.columns, 100);
    this.columns.forEach((c) => headerNode.appendChild(c.header(headerNode.ownerDocument)));

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
    this.columns.forEach((col, i) => node.appendChild(col.cell(index, node.ownerDocument)));
  }

  protected updateRow(node: HTMLElement, index: number) {
    return abortAble(resolveIn(2000)).then(() => {
      this.columns.forEach((col, i) => col.update(<HTMLElement>node.children[i], index));
    });
  }
}
