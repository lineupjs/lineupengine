import { setTransform } from '../ARowRenderer';
import { addScroll, defaultMode, IDelayedMode } from '../internal';
import { GridStyleManager, tableCSSClasses, tableIds } from '../style';
import {
  cssClass,
  CSS_CLASS_BODY,
  CSS_CLASS_FOOTER,
  CSS_CLASS_HEADER,
  CSS_CLASS_MULTI,
  CSS_CLASS_TBODY,
  CSS_CLASS_THEAD,
} from '../styles';

/**
 * basic interface of a table section
 */
export interface ITableSection {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly header: HTMLElement;
  readonly body: HTMLElement;

  init(): void;

  /**
   * show the section
   * @param {number} left visible left margin
   * @param {number} width visible width
   * @param {boolean} isGoingRight whether it was a shift to the right
   */
  show(left: number, width: number, isGoingRight: boolean): void;

  hide(): void;

  destroy(): void;
}

export interface ITableFactory<T extends ITableSection> {
  (header: HTMLElement, body: HTMLElement, tableId: string, style: GridStyleManager, ...extras: unknown[]): T;
}

export interface ISeparatorFactory<T extends ITableSection> {
  (header: HTMLElement, body: HTMLElement, style: GridStyleManager, ...extras: unknown[]): T;
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
   * sync -> execute within scroll listener
   * {number} -> execute within this delay using setTimeout
   * @default is chrome ? animation else 0
   */
  async: IDelayedMode;

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

  private readonly options: Readonly<IMultiTableRowRendererOptions> = {
    columnPadding: 0,
    async: defaultMode,
    minScrollDelta: 30,
  };

  constructor(public readonly node: HTMLElement, htmlId: string, options: Partial<IMultiTableRowRendererOptions> = {}) {
    Object.assign(this.options, options);
    const cleanHTMLId = htmlId.startsWith('#') ? htmlId.slice(1) : htmlId;
    // eslint-disable-next-line no-param-reassign
    node.id = cleanHTMLId;
    // eslint-disable-next-line no-param-reassign
    node.innerHTML = `<header id="header-${cleanHTMLId}" class="${CSS_CLASS_HEADER} ${cssClass(
      `header-${cleanHTMLId}`
    )}">
      <footer class="${CSS_CLASS_FOOTER} ${cssClass(`footer-${cleanHTMLId}`)}">&nbsp;</footer>
    </header>
    <main id="body-${cleanHTMLId}" class="${CSS_CLASS_BODY} ${cssClass(`body-${cleanHTMLId}`)}">
      <footer class="${CSS_CLASS_FOOTER}">&nbsp;</footer>
    </main>`;
    node.classList.add(cssClass(), CSS_CLASS_MULTI, 'lineup-engine');

    this.style = new GridStyleManager(this.node, cleanHTMLId);

    let old = addScroll(this.main, this.options.async, (act) => {
      if (
        Math.abs(old.left - act.left) < this.options.minScrollDelta &&
        Math.abs(old.width - act.width) < this.options.minScrollDelta
      ) {
        return;
      }
      const isGoingRight = act.left > old.left;
      old = act;
      this.onScrolledHorizontally(act.left, act.width, isGoingRight);
    });
  }

  private update() {
    this.onScrolledHorizontally(this.main.scrollLeft, this.main.clientWidth, false);

    let offset = 0;
    this.sections.forEach((s) => {
      // eslint-disable-next-line no-param-reassign
      s.body.style.left = `${offset}px`;
      // eslint-disable-next-line no-param-reassign
      s.header.style.left = `${offset}px`;
      offset += s.width + this.options.columnPadding;
    });
  }

  private onScrolledHorizontally(scrollLeft: number, clientWidth: number, isGoingRight: boolean) {
    let offset = 0;
    const scrollEnd = scrollLeft + clientWidth;
    this.sections.forEach((s) => {
      const end = offset + s.width;
      if (end < scrollLeft || offset > scrollEnd) {
        s.hide();
      } else {
        s.show(Math.max(0, scrollLeft - offset), Math.min(scrollEnd - offset, s.width), isGoingRight);
      }

      offset = end + this.options.columnPadding;
    });

    this.updateOffset();
  }

  private updateOffset() {
    const headerFooter = this.header.getElementsByTagName('footer')[0];
    const bodyFooter = this.main.getElementsByTagName('footer')[0];

    const maxHeight = this.sections.reduce((acc, d) => Math.max(acc, d.height), 0);
    const total = this.sections.reduce((a, c) => a + c.width + this.options.columnPadding, 0);

    setTransform(headerFooter, total, 0);
    setTransform(bodyFooter, total, maxHeight);
  }

  destroy(): void {
    this.sections.forEach((d) => d.destroy());
    this.node.remove();
  }

  private get doc(): Document {
    return this.node.ownerDocument;
  }

  private get header() {
    return this.node.getElementsByTagName('header')[0] as HTMLElement;
  }

  private get main() {
    return this.node.getElementsByTagName('main')[0] as HTMLElement;
  }

  /**
   * push another table to this instance
   * @param {ITableFactory<T extends ITableSection>} factory factory for the table
   * @param extras additional arguments to provide for the factory
   * @returns {T} the table instance
   */
  pushTable<T extends ITableSection>(factory: ITableFactory<T>, ...extras: unknown[]): T {
    const header = this.doc.createElement('article');
    const body = this.doc.createElement('article');

    const tableId = `${this.node.id}T${this.tableId}`;
    this.tableId += 1;
    const ids = tableIds(tableId);
    const cssClasses = tableCSSClasses(tableId);

    header.id = ids.thead;
    header.classList.add(CSS_CLASS_THEAD, cssClasses.thead);
    body.id = ids.tbody;
    body.classList.add(CSS_CLASS_TBODY, cssClasses.tbody);
    this.header.insertBefore(header, this.header.lastElementChild); // before the footer
    this.main.appendChild(body);

    const table = factory.call(this, header, body, tableId, this.style, ...extras);
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
  pushSeparator<T extends ITableSection>(factory: ISeparatorFactory<T>, ...extras: unknown[]): T {
    const header = this.doc.createElement('section');
    const body = this.doc.createElement('section');
    header.classList.add(cssClass('header-separator'));
    body.classList.add(cssClass('separator'));
    this.header.insertBefore(header, this.header.lastElementChild); // before the footer
    this.main.appendChild(body);

    const separator = factory.call(this, header, body, this.style, ...extras);
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
  remove(section: ITableSection): boolean {
    const index = this.sections.indexOf(section);
    if (index < 0) {
      return false;
    }
    this.sections.splice(index, 1);
    section.destroy();
    this.update();
    return true;
  }

  clear(): void {
    this.sections.splice(0, this.sections.length).forEach((s) => s.destroy());
    this.update();
  }

  /**
   * triggers and update because of a change in width of one or more table sections
   */
  widthChanged(): void {
    this.update();
  }
}
