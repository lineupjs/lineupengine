import {IExceptionContext, nonUniformContext, range, uniformContext} from '../logic';
import {EScrollResult} from '../mixin';
import {GridStyleManager} from '../style/index';
import {addScroll} from '../internal';

/**
 * basic interface of a table section
 */
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

export interface IMultiTableRowRendererOptions {
  /**
   * column padding to use between columns
   * @default 0
   */
  columnPadding: number;
  /**
   * async update on scrolling
   * animation -> use requestAnimationFrame
   * immediate -> use setImmediate if available
   * sync -> execute within scroll listener
   * {number} -> execute within this delay using setTimeout
   * @default is chrome ? animation else 0
   */
  async: number | 'animation' | 'sync' | 'immediate';

  /**
   * minimal number of pixel the scrollbars has to move
   * @default 30
   */
  minScrollDelta: number;
}

/**
 * manager of multiple columns separated by separators each an own row renderer
 */
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

  private readonly options: Readonly<IMultiTableRowRendererOptions> = {
    columnPadding: 0,
    async: Boolean((<any>window).chrome) ? 'animation' : 0, // animation frame on chrome
    minScrollDelta: 30
  };

  private context: IExceptionContext = uniformContext(0, 500);

  constructor(public readonly node: HTMLElement, htmlId: string, options: Partial<IMultiTableRowRendererOptions> = {}) {
    Object.assign(this.options, options);
    node.innerHTML = `<header></header><main></main>`;
    node.classList.add('lineup-engine', 'lineup-multi-engine');

    this.style = new GridStyleManager(this.node, htmlId);

    let old = addScroll(this.main, this.options.async, (act) => {
      if (Math.abs(old.left - act.left) < this.options.minScrollDelta && Math.abs(old.width - act.width) < this.options.minScrollDelta) {
        return;
      }
      const isGoingRight = act.left > old.left;
      old = act;
      this.onScrolledHorizontally(act.left, act.width, isGoingRight);
    });
  }

  private update() {
    this.context = nonUniformContext(this.sections.map((d) => d.width), NaN, this.options.columnPadding);

    this.updateGrid();

    this.onScrolledHorizontally(this.main.scrollLeft, this.main.clientWidth, false);
  }

  private updateGrid() {
    const content = GridStyleManager.gridColumn(this.sections);
    this.style.updateRule(`multiTableRule`, `${this.style.id} > header, ${this.style.id} > main { ${content} }`);
  }

  private onScrolledHorizontally(scrollLeft: number, clientWidth: number, isGoingRight: boolean) {
    const {first, last} = range(scrollLeft, clientWidth, this.context.defaultRowHeight, this.context.exceptions, this.context.numberOfRows);

    const visible = this.visible;
    visible.forcedFirst = first;
    visible.forcedLast = last;

    let offset = 0;
    this.sections.forEach((s, i) => {
      if (i >= first && i <= last) {
        s.show(Math.max(0, scrollLeft - offset), Math.min(scrollLeft + clientWidth - offset, s.width), isGoingRight);
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

  /**
   * push another table to this instance
   * @param {ITableFactory<T extends ITableSection>} factory factory for the table
   * @param extras additional arguments to provide for the factory
   * @returns {T} the table instance
   */
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

  /**
   * push another separator to the manager
   * @param {ISeparatorFactory<T extends ITableSection>} factory the factory to create the separator
   * @param extras optional additional arguments
   * @returns {T} the new created separator
   */
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

  /**
   * removes a given table section
   * @param {ITableSection} section section to remove
   * @returns {boolean} successful flag
   */
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

  clear() {
    this.sections.splice(0, this.sections.length).forEach((s) => s.destroy());
    this.update();
  }

  /**
   * triggers and update because of a change in width of one or more table sections
   */
  widthChanged() {
    this.update();
  }

}
