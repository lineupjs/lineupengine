import {addScroll} from '../internal';
import {cssClass, CSS_CLASS_BODY, CSS_CLASS_FOOTER, CSS_CLASS_HEADER, CSS_CLASS_SCROLLBAR_TESTER, CSS_CLASS_SHIFTED, CSS_CLASS_TBODY, CSS_CLASS_THEAD} from '../styles';
import StyleManager from './StyleManager';

export function setTemplate(root: HTMLElement, id: string) {
  id = id.startsWith('#') ? id.slice(1) : id;
  root.innerHTML = `
  <header id="header-${id}" class="${CSS_CLASS_HEADER} ${cssClass(`header-${id}`)}">
    <article class="${CSS_CLASS_THEAD} ${cssClass(`thead-${id}`)}"></article>
  </header>
  <main id="body-${id}" class="${CSS_CLASS_BODY} ${cssClass(`body-${id}`)}">
    <footer class="${CSS_CLASS_FOOTER}">&nbsp;</footer>
    <article class="${CSS_CLASS_TBODY} ${cssClass(`tbody-${id}`)}"></article>
  </main>`;
  return root;
}

/**
 * column base interface
 */
export interface IColumn {
  readonly index: number;
  readonly id: string;
  readonly width: number;
  /**
   * boolean flag whether when scrolling the column should be sticky
   */
  readonly frozen: boolean;
}

interface ISelectors {
  thead: string;
  tbody: string;
  tr: string;
  th: string;
  td: string;
}

/**
 * generates the HTML Ids used for the header and body article of a table
 * @param {string} tableId base table id
 * @param {boolean} asSelector flag whether to prepend with # for CSS selector
 * @return {ISelectors} the table ids used for header and body
 */
export function tableIds(tableId: string) {
  return {
    thead: `thead-${tableId}`,
    tbody: `tbody-${tableId}`,
    tr: `tr-${tableId}`,
    th: `th-${tableId}`,
    td: `td-${tableId}`
  };
}

export function tableCSSClasses(tableId: string) {
  const ids = tableIds(tableId);
  return {
    thead: cssClass(ids.thead),
    tbody: cssClass(ids.tbody),
    tr: cssClass(ids.tr),
    th: cssClass(ids.th),
    td: cssClass(ids.td)
  };
}

/**
 * utility for custom generated CSS rules with a focus on dynamically generated grid layouts
 */
export default class GridStyleManager extends StyleManager {

  readonly id: string;

  readonly ids: ISelectors;
  readonly cssClasses: ISelectors;

  constructor(root: HTMLElement, id: string) {
    super(root);
    this.id = id.startsWith('#') ? id.slice(1) : id;

    this.ids = tableIds(this.id);
    this.cssClasses = tableCSSClasses(this.id);

    const headerScroller = <HTMLElement>root.getElementsByTagName('header')[0];
    const bodyScroller = <HTMLElement>root.getElementsByTagName('main')[0];

    // async since style needs to be added to dom first
    self.setTimeout(() => {
      const {width} = measureScrollbar(root);
      this.updateRule('__scollBarFix2', `#header-${this.id} > article:last-of-type`, {
        borderRight: `${width}px solid transparent`
      });
    }, 20);

    let old = headerScroller.scrollLeft;

    // update frozen and sync header with body
    addScroll(bodyScroller, 'animation', (act) => {
      const newValue = act.left;
      if (old !== newValue) {
        old = headerScroller.scrollLeft = newValue;
      }
      root.classList.toggle(CSS_CLASS_SHIFTED, act.left > 0);
    });
  }

  /**
   * updates the column widths and default row height for a table
   * @param {number} defaultRowHeight
   * @param {IColumn[]} columns
   * @param {number} frozenShift shift frozen colums
   * @param {string} tableId optional tableId in case of multiple tables within the same engine
   * @param {string} unit
   */
  update(defaultRowHeight: number, columns: IColumn[], padding: (index: number) => number, frozenShift: number, tableId: string, unit: string = 'px') {
    const ids = tableIds(tableId);
    const selectors = tableCSSClasses(tableId);

    const total = `${columns.reduce((a, b, i) => a + b.width + padding(i), 0)}${unit}`;

    this.updateRule(`__heightsRule${selectors.tr}`, `.${selectors.tr}`, {
      height: `${defaultRowHeight}px`,
      width: total
    });

    this.updateRule(`__heightsRule${selectors.tbody}`, `#${ids.tbody}`, {
      width: total
    });

    this.updateColumns(columns, padding, selectors, frozenShift, unit);
  }

  /**
   * removes a given tableId if not needed anymore
   * @param {string} tableId tableId to remove
   */
  remove(tableId: string) {
    const selectors = tableCSSClasses(tableId);
    this.deleteRule(`__heightsRule${selectors.tr}`);
    this.deleteRule(`__heightsRule${selectors.tbody}`);

    const prefix = `__col${selectors.td}_`;
    const rules = this.ruleNames.reduce((a, b) => a + (b.startsWith(prefix) ? 1 : 0), 0);
    // reset
    for (let i = 0; i < rules; ++i) {
      this.deleteRule(`${prefix}${i}`);
    }
  }

  private updateColumns(columns: IColumn[], padding: (index: number) => number, cssSelectors: ISelectors, frozenShift: number, unit: string = 'px') {
    const prefix = `__col${cssSelectors.td}_`;
    const rules = new Set(this.ruleNames.filter((d) => d.startsWith(prefix)));

    let acc = 0;
    columns.forEach((c, i) => {
      const th = `.${cssSelectors.th}[data-id="${c.id}"]`;
      const thStyles: Partial<CSSStyleDeclaration> = {
        width: `${c.width}${unit}`
      };
      const td = `.${cssSelectors.td}[data-id="${c.id}"]`;
      const tdStyles: Partial<CSSStyleDeclaration> = {
        transform: `translateX(${acc}${unit})`,
        width: `${c.width}${unit}`
      };

      if (c.frozen) {
        thStyles.left = `${acc}px`;

        this.updateRule(`${prefix}${td}F`, `.${cssSelectors.td}.${CSS_CLASS_SHIFTED}[data-id="${c.id}"]`, {
          transform: `translateX(0)`,
          left: `${acc + frozenShift}${unit}`
        });
        rules.delete(`${prefix}${td}F`);
      }

      this.updateRule(`${prefix}${th}`, th, thStyles);
      rules.delete(`${prefix}${th}`);
      this.updateRule(`${prefix}${td}`, td, tdStyles);
      rules.delete(`${prefix}${td}`);
      acc += c.width + padding(i);
    });

    rules.forEach((d) => this.deleteRule(d));
  }
}
/**
 * based on Slick grid implementation
 * @param doc
 */
function measureScrollbar(root: HTMLElement) {
  const body = root.ownerDocument!.body;
  body.insertAdjacentHTML('beforeend', `
    <div class="${CSS_CLASS_SCROLLBAR_TESTER}"><div></div></div>
  `);
  const elem = <HTMLElement>body.lastElementChild!;

  const width = elem.offsetWidth - elem.clientWidth;
  const height = elem.offsetHeight - elem.clientHeight;

  elem.remove();

  return {width, height};
}
