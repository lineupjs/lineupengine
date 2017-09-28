import {GridStyleManager} from '../style/index';
import {IExceptionContext, nonUniformContext, range, uniformContext} from '../logic';
import {EScrollResult} from '../mixin/index';

export interface ITableSection {
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
    node.classList.add('lineup-engine');

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

  private show(first: number, last: number, offsets: number[], visibleFrom: number, visibleWidth: number, isGoingRight: boolean) {
    for (let i = first; i <= last; ++i) {
      const elem = this.sections[i];
      elem.show(Math.max(0, visibleFrom - offsets[i]), Math.min(visibleWidth - offsets[i], elem.width), isGoingRight);
    }
  }

  private hide(first: number, last: number) {
    for (let i = first; i <= last; ++i) {
      this.sections[i].hide();
    }
  }

  private update() {
    this.context = nonUniformContext(this.sections.map((d) => d.width));

    this.onScrolledHorizontally(this.main.scrollLeft, this.main.clientWidth, false);
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

    let acc = 0;
    const offsets = this.sections.map((s) => {
      const bak = acc;
      acc += s.width;
      return bak;
    });

    let r: EScrollResult = EScrollResult.PARTIAL;

    if (first > visible.last || last < visible.first) {
      //no overlap, clean and draw everything
      this.hide(this.visible.first, this.visible.last);
      this.show(first, last, offsets, scrollLeft, clientWidth, isGoingRight);
      r = EScrollResult.ALL;
    } else if (first < visible.first) {
      //some first rows missing and some last rows to much
      //console.log(`up added: ${visibleFirst - first + 1} removed: ${visibleLast - last + 1} ${first}:${last} ${offset}`);
      this.hide(last + 1, visible.last);
      this.show(first, visible.first - 1, offsets, scrollLeft, clientWidth, isGoingRight);
      this.sections[last].show(scrollLeft - offsets[last], clientWidth - offsets[last], isGoingRight);
    } else {
      //console.log(`do added: ${last - visibleLast + 1} removed: ${first - visibleFirst + 1} ${first}:${last} ${offset}`);
      //some last rows missing and some first rows to much
      this.hide(visible.first, first - 1);
      this.show(visible.last + 1, last, offsets, scrollLeft, clientWidth, isGoingRight);

      this.sections[first].show(Math.max(0, scrollLeft - offsets[first]), Math.min(clientWidth - offsets[first], this.sections[first].width), isGoingRight);
    }

    visible.first = first;
    visible.last = last;
    return r;
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
