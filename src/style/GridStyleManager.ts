import {IColumn} from './IColumn';
import StyleManager from './StyleManager';
import {addScroll} from '../internal';

export const TEMPLATE = `
  <header>
    <article></article>
  </header>
  <main>
    <footer>&nbsp;</footer>
    <article></article>
  </main>`;


export function setTemplate(root: HTMLElement) {
  root.innerHTML = TEMPLATE;
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
  header: string;
  body: string;
}

/**
 * utility for custom generated CSS rules with a focus on dynamically generated grid layouts
 */
export default class GridStyleManager extends StyleManager {

  constructor(root: HTMLElement, public readonly id: string) {
    super(root);

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

      root.classList.toggle('le-shifted', act.left > 0);

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
        this.updateRule('__scollBarFix', `
          ${this.hashedId} > header {
            margin-right: ${-delta}px;
          }
        `, false);
        this.updateRule('__scollBarFix2', `
          ${this.hashedId} > header > :last-child {
            border-right: ${deltaScroll}px solid transparent;
          }`);
      }, 0);
    });
  }

  get hashedId() {
    return this.id.startsWith('#') ? this.id : `#${this.id}`;
  }

  /**
   * updates the column widths and default row height for a table
   * @param {number} defaultRowHeight
   * @param {IColumn[]} columns
   * @param {number} frozenShift shift frozen colums
   * @param {string} tableId optional tableId in case of multiple tables within the same engine
   * @param {string} unit
   */
  update(defaultRowHeight: number, columns: IColumn[], frozenShift: number, tableId?: string, unit: string = 'px') {
    const selectors = tableId !== undefined ? this.tableIds(tableId, true) : {
      header: `${this.id} > header > article`,
      body: `${this.id} > main > article`
    };

    this.updateRule(`__heightsRule${selectors.body}`, `${selectors.body} > div {
      height: ${defaultRowHeight}px;
    }`, false);

    this.updateColumns(columns, selectors, frozenShift, unit);
    this.updateRules();
  }

  /**
   * removes a given tableId if not needed anymore
   * @param {string} tableId tableId to remove
   */
  remove(tableId: string) {
    const selectors = this.tableIds(tableId, true);
    this.deleteRule(`__heightsRule${selectors.body}`, false);
    this.deleteRule(`__widthRule${selectors.body}`, false);

    const prefix = `__col${selectors.body}_`;
    const rules = this.ruleNames.reduce((a, b) => a + (b.startsWith(prefix) ? 1 : 0), 0);
    // reset
    for (let i = 0; i < rules; ++i) {
      this.deleteRule(`${prefix}${i}`, false);
    }
    this.updateRules();
  }

  /**
   * generates the HTML Ids used for the header and body article of a table
   * @param {string} tableId base table id
   * @param {boolean} asSelector flag whether to prepend with # for CSS selector
   * @return {{header: string; body: string}} the table ids used for header and body
   */
  tableIds(tableId: string, asSelector: boolean = false) {
    const cleanId = this.id.startsWith('#') ? this.id.slice(1) : this.id;
    return {
      header: `${asSelector ? '#' : ''}${cleanId}_H${tableId}`,
      body: `${asSelector ? '#' : ''}${cleanId}_B${tableId}`
    };
  }

  private updateColumns(columns: IColumn[], selectors: ISelectors, frozenShift: number, unit: string = 'px') {
    const prefix = `__col${selectors.body}_`;
    const rules = this.ruleNames.reduce((a, b) => a + (b.startsWith(prefix) ? 1 : 0), 0);


    let frozen = 0;
    let ruleCounter = 0;
    columns.forEach((c) => {
      let rule = `${selectors.body} > div > [data-id="${c.id}"], ${selectors.header} [data-id="${c.id}"] {
        width: ${c.width}${unit};
        ${c.frozen ? `left: ${frozen}px;`: ''}
      }`;
      if (frozenShift !== 0 && c.frozen) {
        // shift just for the body
        const shiftRule = `${selectors.body} > div > [data-id="${c.id}"] {
          width: ${c.width}${unit};
          left: ${frozen + frozenShift}px;
        }`;
        rule = `${selectors.header} [data-id="${c.id}"] {
          width: ${c.width}${unit};
          left: ${frozen}px;
        }`;
        this.updateRule(`${prefix}${ruleCounter++}`, shiftRule, false);
      }
      if (c.frozen) {
        frozen += c.width; // ignore padding since it causes problems regarding white background + padding(i);
      }
      this.updateRule(`${prefix}${ruleCounter++}`, rule, false);
    });
    for (let i = ruleCounter - 1; i < rules; ++i) {
      this.deleteRule(`${prefix}${i}`, false);
    }
  }
}
