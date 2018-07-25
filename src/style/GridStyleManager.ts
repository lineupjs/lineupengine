import {IColumn} from './IColumn';
import StyleManager from './StyleManager';
import {addScroll} from '../internal';
import {cssClass} from '../styles';

export function setTemplate(root: HTMLElement, id: string) {
  id = id.startsWith('#') ? id.slice(1) : id;
  root.innerHTML =  `
  <header id="header-${id}" class="${cssClass('header')} ${cssClass(`header-${id}`)}">
    <article class="${cssClass('thead')} ${cssClass(`thead-${id}`)}"></article>
  </header>
  <main id="body-${id}" class="${cssClass('body')} ${cssClass(`body-${id}`)}">
    <footer class="${cssClass('footer')}">&nbsp;</footer>
    <article class="${cssClass('tbody')} ${cssClass(`tbody-${id}`)}"></article>
  </main>`;
  return root;
}

/**
 * sets the needed grid columns settings such that the given node is aligned with the given column
 * @param {HTMLElement} node the column node
 * @param {{index: number; id: string}} column the column meta data
 */
export function setColumn(node: HTMLElement, column: {index: number, id: string}) {
  node.dataset.id = column.id;
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

    const headerScroller = <HTMLElement>root.querySelector('header');
    const bodyScroller = <HTMLElement>root.querySelector('main');

    let oldDelta = 0;
    let oldDeltaScroll = 0;

    // update frozen and sync header with body
    addScroll(bodyScroller, 'animation', (act) => {
      const old = headerScroller.scrollLeft;
      const newValue = act.left;
      if (old !== newValue) {
        headerScroller.scrollLeft = newValue;
      }

      root.classList.toggle(cssClass('shifted'), act.left > 0);

      // shift for different scrollbar in header and body
      const delta = act.width - headerScroller.clientWidth;
      if (Math.abs(delta) < 2) { // current value is good
        return;
      }
      const deltaScroll = bodyScroller.scrollWidth - headerScroller.scrollWidth;

      if (oldDelta === delta && oldDeltaScroll === deltaScroll) {
        return;
      }
      oldDelta = delta;
      oldDeltaScroll = deltaScroll;

      self.setTimeout(() => {
        this.updateRule('__scollBarFix', `#header-${this.id}`, {
          marginRight: `${-delta}px`
        });
        this.updateRule('__scollBarFix2', `#header-${this.id} > :last-child`, {
          borderRight: `${deltaScroll}px solid transparent`
        });
      }, 0);
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
  update(defaultRowHeight: number, columns: IColumn[], frozenShift: number, tableId: string, unit: string = 'px') {
    const selectors = tableCSSClasses(tableId);

    this.updateRule(`__heightsRule${selectors.tr}`, `.${selectors.tr}`, {
      height: `${defaultRowHeight}px`
    });

    this.updateColumns(columns, selectors, frozenShift, unit);
  }

  /**
   * removes a given tableId if not needed anymore
   * @param {string} tableId tableId to remove
   */
  remove(tableId: string) {
    const selectors = tableCSSClasses(tableId);
    this.deleteRule(`__heightsRule${selectors.tr}`);
    this.deleteRule(`__widthRule${selectors.tr}`);

    const prefix = `__col${selectors.td}_`;
    const rules = this.ruleNames.reduce((a, b) => a + (b.startsWith(prefix) ? 1 : 0), 0);
    // reset
    for (let i = 0; i < rules; ++i) {
      this.deleteRule(`${prefix}${i}`);
    }
  }

  private updateColumns(columns: IColumn[], cssSelectors: ISelectors, frozenShift: number, unit: string = 'px') {
    const prefix = `__col${cssSelectors.td}_`;
    const rules = this.ruleNames.reduce((a, b) => a + (b.startsWith(prefix) ? 1 : 0), 0);


    let frozen = 0;
    let ruleCounter = 0;
    columns.forEach((c) => {
      let ruleSelector = `.${cssSelectors.td}[data-id="${c.id}"], .${cssSelectors.th}[data-id="${c.id}"]`;
      const ruleStyle: Partial<CSSStyleDeclaration> = {
        width: `${c.width}${unit}`
      };
      if (c.frozen) {
        ruleStyle.left = `${frozen}px`;
      }
      if (frozenShift !== 0 && c.frozen) {
        // shift just for the body
        this.updateRule(`${prefix}${ruleCounter++}`, `.${cssSelectors.tr}[data-id="${c.id}"]`, {
          width: `${c.width}${unit}`,
          left: `${frozen + frozenShift}px`
        });
        ruleSelector = `.${cssSelectors.th}[data-id="${c.id}"]`;
        ruleStyle.left = `${frozen}px`;
      }
      if (c.frozen) {
        frozen += c.width; // ignore padding since it causes problems regarding white background + padding(i);
      }
      this.updateRule(`${prefix}${ruleCounter++}`, ruleSelector, ruleStyle);
    });
    for (let i = ruleCounter; i < rules; ++i) {
      this.deleteRule(`${prefix}${i - 1}`);
    }
  }
}
