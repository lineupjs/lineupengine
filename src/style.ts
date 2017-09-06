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

  private extraScrollUpdater: ((scrollLeft: number) => void) | null = null;

  constructor(root: HTMLElement, private readonly id: string, defaultRowHeight: number) {
    this.node = root.ownerDocument.createElement('style');
    root.appendChild(this.node);
    if (isEdge) {
      root.classList.add('ms-edge');
    }
    this.stylesheet = <CSSStyleSheet>this.node.sheet;

    this.stylesheet.insertRule(`${id} > main > article > div {
      height: ${defaultRowHeight}px;
    }`, 0);
    this.stylesheet.insertRule(`${id} > main > article > div, ${id} > header > article {
      /*column rule*/
    }`, 1);

    const headerScroller = <HTMLElement>root.querySelector('header');
    const bodyScroller = <HTMLElement>root.querySelector('main');

    let isScrollBarConsidered = false;
    bodyScroller.addEventListener('scroll', () => {
      const left = bodyScroller.scrollLeft;
      if (!isScrollBarConsidered) {
        const scrollBarWidth = headerScroller.clientWidth - bodyScroller.clientWidth;
        (<HTMLElement>headerScroller.firstElementChild).style.width = `${bodyScroller.scrollWidth + scrollBarWidth}px`;
        isScrollBarConsidered = true;
      }
      headerScroller.scrollLeft = left;
      if (this.extraScrollUpdater) {
        this.extraScrollUpdater(left);
      }
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

  update(defaultRowHeight: number, columns: IColumn[], defaultWidth: number, unit: string = 'px') {
    this.stylesheet.deleteRule(0);
    this.stylesheet.insertRule(`${this.id} > main > article > div {
      height: ${defaultRowHeight}px;
    }`, 0);


    this.stylesheet.deleteRule(1);

    if (columns.length === 0) {
      //restore dummy rule
      this.stylesheet.insertRule(`${this.id} > main > article > div, ${this.id} > header > article {
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

      this.extraScrollUpdater = this.updateFrozenColumnsShift.bind(this, columns, unit);
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
    if (frozen.length <= 0 || isEdge) {
      return;
    }
    //create the correct left offset
    let offset = frozen[0].width;
    frozen.slice(1).forEach((c) => {
      this.stylesheet.insertRule(`${this.id} > main > article > div > .frozen[data-id="${c.id}"], ${this.id} > header > article .frozen[data-id="${c.id}"] {
  left: ${offset}${unit};
}`, 2);
      offset += c.width;
    });
  }

  private updateFrozenColumnsShift(columns: IColumn[], unit: string, scrollLeft: number) {
    if (!isEdge) {
      return;
    }

    const l = this.stylesheet.cssRules.length;
    for (let i = 2; i < l; ++i) {
      this.stylesheet.deleteRule(2);
    }

    const hasFrozen = columns.some((c) => c.frozen);
    if (!hasFrozen) {
      return;
    }
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
