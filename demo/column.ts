import { IColumn } from '../src';
import '../src/style.scss';
import { CSS_CLASS_FROZEN } from '../src/styles';

/** @internal */
export class Column<T> implements IColumn {
  constructor(
    public readonly index: number,
    public readonly name: string,
    public readonly frozen: boolean = false,
    public readonly width = 100
  ) {}

  get id() {
    return `col${this.index}`;
  }

  common(document: Document) {
    const d = document.createElement('div');
    if (this.frozen) {
      d.classList.add(CSS_CLASS_FROZEN);
    }
    d.dataset.id = this.id;
    return d;
  }

  header(document: Document) {
    const d = this.common(document);
    d.textContent = this.name;
    return d;
  }

  cell(row: T, document: Document) {
    return this.update(this.common(document), row);
  }

  update(node: HTMLElement, row: T) {
    node.textContent = `${this.name}@${row.toString()}`;
    return node;
  }
}
