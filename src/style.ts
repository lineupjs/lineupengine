/**
 * Created by Samuel Gratzl on 13.07.2017.
 */

// import manually import './style.scss';

export const isEdge = typeof CSS !== 'undefined' && CSS.supports('(-ms-ime-align:auto)');

export interface IColumn {
  readonly index: number;
  readonly id: string;
  readonly width: number;
  readonly frozen: boolean;
}

export const TEMPLATE = `
  <header>
    <article></article>
  </header>
  <main>
    <article></article>
  </main>`;


export function setTemplate(root: HTMLElement) {
  root.innerHTML = TEMPLATE;
  return root;
}

function repeatStandard(count: number, width: string) {
  return `repeat(${count}, ${width})`;
}

function repeatEdge(count: number, width: string) {
  return `(${width})[${count}]`;
}

const repeat = isEdge ? repeatEdge : repeatStandard;

export function setColumn(node: HTMLElement, column: { index: number, id: string }) {
  if (isEdge) {
    node.style.msGridColumn = column.index + 1;
  } else {
    (<any>node.style).gridColumnStart = column.id;
  }
  node.dataset.id = column.id;
}

interface ISelectors {
  header: string;
  body: string;
}

export class StyleManager {
  private readonly stylesheet: CSSStyleSheet;
  private readonly rules = new Map<string, { rule: CSSRule, index: number }>();
  private readonly node: HTMLStyleElement;

  private readonly extraScrollUpdater: ((scrollLeft: number) => void)[] = [];

  constructor(root: HTMLElement, private readonly id: string) {
    this.node = root.ownerDocument.createElement('style');
    root.appendChild(this.node);
    if (isEdge) {
      root.classList.add('ms-edge');
    }
    this.stylesheet = <CSSStyleSheet>this.node.sheet;

    this.addRule('__heightsRule0', `${id} > main > article > div {
      height: 20px;
    }`);
    const headerScroller = <HTMLElement>root.querySelector('header');
    const bodyScroller = <HTMLElement>root.querySelector('main');

    let isScrollBarConsidered = false;
    bodyScroller.addEventListener('scroll', () => {
      const left = bodyScroller.scrollLeft;
      if (!isScrollBarConsidered) {
        const scrollBarWidth = headerScroller.clientWidth - bodyScroller.clientWidth;
        // TODO doesn't work in multi ranking case
        (<HTMLElement>headerScroller.lastElementChild).style.width = `${bodyScroller.scrollWidth + scrollBarWidth}px`;
        isScrollBarConsidered = true;
      }
      headerScroller.scrollLeft = left;
      this.extraScrollUpdater.forEach((u) => u(left));
    });
  }

  destroy() {
    this.node.remove();
  }

  static columnWidths(columns: { width: number }[], unit: string = 'px') {
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

  remove(tableId: string) {
    const selectors = this.tableIds(tableId, true);
    this.deleteRule(`__heightsRule${selectors.body}`);
    this.deleteRule(`__widthRule${selectors.body}`);

    const prefix = `__frozen${selectors.body}_`;
    const rules = Array.from(this.rules.keys()).reduce((a, b) => a + (b.startsWith(prefix) ? 1 : 0), 0);
    // reset
    for (let i = 0; i < rules; ++i) {
      this.deleteRule(`${prefix}${i}`);
    }
  }

  tableIds(tableId: string, asSelector: boolean = false) {
    const cleanId = this.id.startsWith('#') ? this.id.slice(1) : this.id;
    return {header: `${asSelector ? '#': ''}${cleanId}_H${tableId}`, body: `${asSelector ? '#': ''}${cleanId}_B${tableId}`};
  }

  update(defaultRowHeight: number, columns: IColumn[], defaultWidth: number, tableId?: string, unit: string = 'px') {
    const selectors = tableId !== undefined ? this.tableIds(tableId, true) : { header: `${this.id} > header > article`, body: `${this.id} > main > article`};

    this.updateRule(`__heightsRule${selectors.body}`, `${selectors.body} > div {
      height: ${defaultRowHeight}px;
    }`);

    if (columns.length === 0) {
      //restore dummy rule
      this.deleteRule(`__widthRule${selectors.body}`);
      return;
    }

    const widths = StyleManager.columnWidths(columns, unit);

    let content = '';
    if (!isEdge) {
      content = `grid-template-columns: ${widths};
        grid-template-areas: "${columns.map((c) => c.id).join(' ')}";
        grid-auto-columns: ${defaultWidth}px;`;
    } else {
      content = `-ms-grid-columns: ${widths};`;

      this.extraScrollUpdater.push(this.updateFrozenColumnsShift.bind(this, columns, selectors, unit));
    }
    this.updateRule(`__widthRule${selectors.body}`, `${selectors.body} > div, ${selectors.header} { ${content} }`);

    this.updateFrozen(columns, selectors, unit);
  }

  private updateFrozen(columns: IColumn[], selectors: ISelectors, unit: string) {
    if (isEdge) {
      return;
    }
    const prefix = `__frozen${selectors.body}_`;
    const rules = Array.from(this.rules.keys()).reduce((a, b) => a + (b.startsWith(prefix) ? 1 : 0), 0);
    const frozen = columns.filter((c) => c.frozen);
    if (frozen.length <= 0 || isEdge) {
      // reset
      for (let i = 0; i < rules; ++i) {
        this.deleteRule(`${prefix}${i}`);
      }
      return;
    }
    //create the correct left offset
    let offset = frozen[0].width;
    frozen.slice(1).forEach((c, i) => {
      const rule = `${selectors.body} > div > .frozen[data-id="${c.id}"], ${selectors.header} .frozen[data-id="${c.id}"] {
        left: ${offset}${unit};
      }`;
      offset += c.width;
      this.updateRule(`${prefix}${i}`, rule);
    });
    for (let i = frozen.length - 1; i < rules; ++i) {
      this.deleteRule(`${prefix}${i}`);
    }
  }

  private updateFrozenColumnsShift(columns: IColumn[], selectors: ISelectors, unit: string, scrollLeft: number) {
    if (!isEdge) {
      return;
    }

    const prefix = `__frozen${selectors.body}_`;
    const rules = Array.from(this.rules.keys()).reduce((a, b) => a + (b.startsWith(prefix) ? 1 : 0), 0);
    const hasFrozen = columns.some((c) => c.frozen);
    if (!hasFrozen) {
      for (let i = 0; i < rules; ++i) {
        this.deleteRule(`${prefix}${i}`);
      }
      return;
    }
    //create the correct left offset
    let offset = 0;
    let frozenWidth = 0;
    let nextFrozen = 0;
    columns.forEach((c) => {
      if (c.frozen && offset < (scrollLeft + frozenWidth)) {
        const rule = `${selectors.body} > div > .frozen[data-id="${c.id}"], ${selectors.header} .frozen[data-id="${c.id}"] {
          transform: translate(${scrollLeft - offset + frozenWidth}${unit}, 0);
        }`;
        this.updateRule(`${prefix}${nextFrozen++}`, rule);
        frozenWidth += c.width;
      }
      offset += c.width;
    });

    for (let i = nextFrozen; i < rules; ++i) {
      this.deleteRule(`${prefix}${i}`);
    }
  }

  addRule(id: string, rule: string) {
    // append
    const l = this.stylesheet.cssRules.length;
    this.stylesheet.insertRule(rule, l);
    this.rules.set(id, {rule: this.stylesheet.cssRules[l], index: l});
    return id;
  }

  private findIndex(guess: number, rule: CSSRule) {
    const guessed = this.stylesheet.cssRules[guess];
    if (guessed === rule) {
      return guess;
    }
    return Array.from(this.stylesheet.cssRules).indexOf(rule);
  }

  updateRule(id: string, rule: string) {
    const r = this.rules.get(id);
    if (!r) {
      return this.addRule(id, rule);
    }
    r.index = this.findIndex(r.index, r.rule);
    this.stylesheet.deleteRule(r.index);
    this.stylesheet.insertRule(rule, r.index);
    r.rule = this.stylesheet.cssRules[r.index];
    return id;
  }

  deleteRule(id: string) {
    const r = this.rules.get(id);
    if (!r) {
      return;
    }
    r.index = this.findIndex(r.index, r.rule);
    this.stylesheet.deleteRule(r.index);
    this.rules.delete(id);
  }
}
