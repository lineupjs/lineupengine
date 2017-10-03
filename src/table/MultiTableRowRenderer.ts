import {GridStyleManager} from '../style/index';
import {IExceptionContext, nonUniformContext, range, uniformContext} from '../logic';
import {EScrollResult} from '../mixin/index';

export interface ITableSection {
  readonly id: string;
  readonly width: number;

  init(): void;

  /**
   * show the section
   * @param {number} left left margin
   * @param {number} width visible width
   * @param {boolean} isGoingRight whether it was a shift to the right
   */
  show(left: number, width: number, isGoingRight: boolean): void;

  hide(): void;

  destroy(): void;
}

export interface ITableFactory<T extends ITableSection> {
  (header: HTMLElement, body: HTMLElement, tableId: string, style: GridStyleManager, ...extras: any[]): T;
}

export interface ISeparatorFactory<T extends ITableSection> {
  (header: HTMLElement, body: HTMLElement, style: GridStyleManager, ...extras: any[]): T;
}


export default class MultiTableRowRenderer {

  readonly style: GridStyleManager;
  private tableId = 0;

  private readonly sections: ITableSection[] = [];

  private readonly visible = {
    first: 0,
    forcedFirst: 0,
    last: 0,
    forcedLast: 0
  };

  private context: IExceptionContext = uniformContext(0, 500);

  constructor(public readonly node: HTMLElement, htmlId: string) {
    node.innerHTML = `<header></header><main></main>`;
    node.classList.add('lineup-engine', 'lineup-multi-engine');

    this.style = new GridStyleManager(this.node, htmlId);

    const main = this.main;
    let oldLeft = main.scrollLeft;
    main.addEventListener('scroll', () => {
      const left = main.scrollLeft;
      if (left === oldLeft) {
        return;
      }
      const isGoingRight = left > oldLeft;
      oldLeft = left;
      this.onScrolledHorizontally(left, main.clientWidth, isGoingRight);
    });
  }

  private update() {
    this.context = nonUniformContext(this.sections.map((d) => d.width));

    this.updateGrid();

    this.onScrolledHorizontally(this.main.scrollLeft, this.main.clientWidth, false);
  }

  private updateGrid() {
    const content = GridStyleManager.gridColumn(this.sections, this.context.defaultRowHeight);
    this.style.updateRule(`multiTableRule`, `${this.style.id} > header, ${this.style.id} > main { ${content} }`);
  }

  private onScrolledHorizontally(scrollLeft: number, clientWidth: number, isGoingRight: boolean) {
    const {first, last} = range(scrollLeft, clientWidth, this.context.defaultRowHeight, this.context.exceptions, this.context.numberOfRows);

    const visible = this.visible;
    visible.forcedFirst = first;
    visible.forcedLast = last;

    if ((first - visible.first) >= 0 && (last - visible.last) <= 0) {
      //nothing to do
      return EScrollResult.NONE;
    }

    let offset = 0;
    this.sections.forEach((s, i) => {
      if (i >= first && i <= last) {
        s.show(Math.max(0, scrollLeft - offset), Math.min(clientWidth - offset, s.width), isGoingRight);
      } else {
        s.hide();
      }
      offset += s.width;
    });

    visible.first = first;
    visible.last = last;
    return EScrollResult.PARTIAL;
  }

  destroy() {
    this.sections.forEach((d) => d.destroy());
    this.node.remove();
  }

  private get doc() {
    return this.node.ownerDocument;
  }

  private get header() {
    return <HTMLElement>this.node.querySelector('header');
  }

  private get main() {
    return <HTMLElement>this.node.querySelector('main');
  }

  pushTable<T extends ITableSection>(factory: ITableFactory<T>, ...extras: any[]) {
    const header = this.doc.createElement('article');
    const body = this.doc.createElement('article');
    const tableId = `T${this.tableId++}`;
    const ids = this.style.tableIds(tableId);
    header.id = ids.header;
    body.id = ids.body;
    this.header.appendChild(header);
    this.main.appendChild(body);

    const table = factory(header, body, tableId, this.style, ...extras);
    table.init();
    this.sections.push(table);
    this.update();
    return table;
  }

  pushSeparator<T extends ITableSection>(factory: ISeparatorFactory<T>, ...extras: any[]) {
    const header = this.doc.createElement('section');
    const body = this.doc.createElement('section');
    this.header.appendChild(header);
    this.main.appendChild(body);

    const separator = factory(header, body, this.style, ...extras);
    separator.init();
    this.sections.push(separator);
    this.update();
    return separator;
  }

  remove(section: ITableSection) {
    const index = this.sections.indexOf(section);
    if (index < 0) {
      return false;
    }
    this.sections.splice(index, 1);
    section.destroy();
    this.update();
    return true;
  }

  widthChanged() {
    this.update();
  }

}
