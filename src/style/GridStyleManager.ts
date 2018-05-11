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
  // node.style.gridColumnStart = column.id;
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

    // update frozen and sync header with body
    addScroll(bodyScroller, 'animation', (act) => {
      const old = headerScroller.scrollLeft;
      const newValue = act.left;
      if (old !== newValue) {
        headerScroller.scrollLeft = newValue;
      }

      // shift for different scrollbar in header and body
      const delta = act.width - headerScroller.clientWidth;
      if (Math.abs(delta) < 2) { // current value is good
        return;
      }
      const deltaScroll = bodyScroller.scrollWidth - headerScroller.scrollWidth;
      self.setTimeout(() => {
        this.updateRule('__scollBarFix', `
          ${this.id} > header {
            margin-right: ${-delta}px;
          }
        `, false);
        this.updateRule('__scollBarFix2', `
          ${this.id} > header :last-child {
            border-right: ${deltaScroll}px solid transparent;
          }`);
      }, 0);
    });
  }

  /**
   * computes a compatible grid layout pattern based on the given columns
   * @param {{width: number}[]} columns
   * @param {string} unit
   * @return {string}
   */
  static columnWidths(columns: {width: number}[], unit: string = 'px') {
    function repeatStandard(count: number, width: string) {
      return `repeat(${count}, ${width})`;
    }

    const repeat = repeatStandard;

    let lastWidth = 0;
    let count = 0;

    let r = '';
    columns.forEach(({width}) => {
      if (lastWidth === width) {
        count++;
        return;
      }
      if (count > 0) {
        r += count === 1 ? `${lastWidth}${unit} ` : `${repeat(count, `${lastWidth}${unit}`)} `;
      }
      count = 1;
      lastWidth = width;
    });

    if (count > 0) {
      r += count === 1 ? `${lastWidth}${unit}` : `${repeat(count, `${lastWidth}${unit}`)}`;
    }
    return r;
  }

  static gridColumn(columns: {id: string, width: number}[], unit: string = 'px') {
    const widths = GridStyleManager.columnWidths(columns, unit);

    return `grid-template-columns: ${widths};
      grid-template-areas: "${columns.map((c) => c.id).join(' ')}";`;
  }

  /**
   * updates the column widths and default row height for a table
   * @param {number} defaultRowHeight
   * @param {IColumn[]} columns
   * @param {(index: number) => number} padding padding between columns
   * @param {string} tableId optional tableId in case of multiple tables within the same engine
   * @param {string} unit
   */
  update(defaultRowHeight: number, columns: IColumn[], padding: (index: number) => number, tableId?: string, unit: string = 'px') {
    const selectors = tableId !== undefined ? this.tableIds(tableId, true) : {
      header: `${this.id} > header > article`,
      body: `${this.id} > main > article`
    };

    this.updateRule(`__heightsRule${selectors.body}`, `${selectors.body} > div {
      height: ${defaultRowHeight}px;
    }`, false);

    this.updateColumns(columns, selectors, unit);
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

  private updateColumns(columns: IColumn[], selectors: ISelectors, unit: string = 'px') {
    const prefix = `__col${selectors.body}_`;
    const rules = this.ruleNames.reduce((a, b) => a + (b.startsWith(prefix) ? 1 : 0), 0);


    let frozen = 0;
    columns.forEach((c, i) => {
      const rule = `${selectors.body} > div > [data-id="${c.id}"], ${selectors.header} [data-id="${c.id}"] {
        width: ${c.width}${unit};
        ${c.frozen ? `left: ${frozen}px;`: ''}
      }`;
      if (c.frozen) {
        frozen += c.width; // ignore padding since it causes problems regarding white background + padding(i);
      }
      this.updateRule(`${prefix}${i}`, rule, false);
    });
    for (let i = columns.length - 1; i < rules; ++i) {
      this.deleteRule(`${prefix}${i}`, false);
    }
  }
}
