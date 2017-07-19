/**
 * Created by Samuel Gratzl on 13.07.2017.
 */

import './style.scss';

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


function repeatStandard(count: number, width: string) {
  return `repeat(${count}, ${width})`;
}

function repeatEdge(count: number, width: string) {
  return `(${width})[${count}]`;
}

const repeat = isEdge ? repeatEdge : repeatStandard;

export function setColumn(node: HTMLElement, column: IColumn) {
  if (isEdge) {
    node.style.msGridColumn = column.index + 1;
  } else {
    (<any>node.style).gridColumnStart = column.id;
  }
  node.dataset.id = column.id;
}

export class StyleManager {
  private readonly stylesheet: CSSStyleSheet;
  private readonly node: HTMLStyleElement;

  constructor(parent: HTMLElement, private readonly id: string, defaultRowHeight: number) {
    this.node = parent.ownerDocument.createElement('style');
    parent.appendChild(this.node);
    if(isEdge) {
      parent.classList.add('ms-edge');
    }
    this.stylesheet = <CSSStyleSheet>this.node.sheet;

    this.stylesheet.insertRule(`${id} > main > article > div {
      height: ${defaultRowHeight}px;
    }`, 0);
    this.stylesheet.insertRule(`${id} > main > article > div, .lu > header > article {
      /*column rule*/
    }`, 1);
  }

  destroy() {
    this.node.remove();
  }

  private static columnWidths(columns: IColumn[], unit: string = 'px') {
    let lastWidth = 0;
    let count = 0;

    let r = '';
    columns.forEach(({width}) => {
      if (lastWidth !== width) {
        if (count > 0) {
          r += count === 1 ? `${lastWidth}${unit} ` : `${repeat(count, `${lastWidth}${unit}`)} `;
        }
        count = 1;
        lastWidth = width;
      } else {
        count++;
      }
    });

    if (count > 0) {
      r += count === 1 ? `${lastWidth}${unit}` : `${repeat(count, `${lastWidth}${unit}`)}`;
    }
    return r;
  }

  update(columns: IColumn[], defaultWidth: number, unit: string = 'px') {
    this.stylesheet.deleteRule(1);

    if (columns.length === 0) {
      //restore dummy rule
      this.stylesheet.insertRule(`${this.id} > main > article > div, .lu > header > article {
        /*column rule*/
      }`, 1);
    }

    const widths = StyleManager.columnWidths(columns, unit);

    let content = '';
    if (!isEdge) {
      content = `grid-template-columns: ${widths};
        grid-template-areas: "${columns.map((c) => c.id).join(' ')}";
        grid-auto-columns: ${defaultWidth}px;`;
    } else {
      content = `-ms-grid-columns: ${widths};`;
    }
    this.stylesheet.insertRule(`${this.id} > main > article > div, ${this.id} > header > article { ${content} }`, 1);

    this.updateFrozen(columns, unit);
  }

  private updateFrozen(columns: IColumn[], unit: string) {
    if (isEdge) {
      return;
    }
    const l = this.stylesheet.cssRules.length;
    for (let i = 2; i < l; ++i) {
      this.stylesheet.deleteRule(2);
    }
    const frozen = columns.filter((c) => c.frozen);
    if (frozen.length > 1 && !isEdge) {
      //create the correct left offset
      let offset = frozen[0].width;
      frozen.slice(1).forEach((c) => {
        this.stylesheet.insertRule(`${this.id} > main > article > div > .frozen[data-id="${c.id}"], ${this.id} > header > article .frozen[data-id="${c.id}"] {
    left: ${offset}${unit};
  }`, 2);
        offset += c.width;
      });
    }
  }

  updateFrozenColumnsShift(columns: IColumn[], scrollLeft: number, unit: string = 'px') {
    if (!isEdge) {
    return;
    }

    const l = this.stylesheet.cssRules.length;
    for (let i = 2; i < l; ++i) {
      this.stylesheet.deleteRule(2);
    }

    const hasFrozen = columns.some((c) => c.frozen);
    if (hasFrozen) {
      //create the correct left offset
      let offset = 0;
      let frozenWidth = 0;
      columns.forEach((c) => {
        if (c.frozen && offset < (scrollLeft + frozenWidth)) {
          this.stylesheet.insertRule(`${this.id} > main > article > div > .frozen[data-id="${c.id}"], ${this.id} > header > article .frozen[data-id="${c.id}"] {
    transform: translate(${scrollLeft - offset + frozenWidth}${unit}, 0);
  }`, 2);
          frozenWidth += c.width;
        }
        offset += c.width;
      });
    }
  }
}
