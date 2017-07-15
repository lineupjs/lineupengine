import {IColumn, setColumn, TEMPLATE} from '../../src/style';
import {LeafNode, InnerNode} from './tree';

export default class Column implements IColumn {
  constructor(public readonly index: number, public readonly name: string, public readonly frozen: boolean = false, public readonly width = 100) {

  }

  get id() {
    return `col${this.index}`;
  }

  common(document: Document) {
    const d = document.createElement('div');
    if (this.frozen) {
      d.classList.add('frozen');
    }
    d.dataset.id = this.id;
    setColumn(d, this);
    return d;
  }

  createHeader(document: Document) {
    const d = this.common(document);
    d.textContent = this.name;
    return d;
  }

  createSingle(row: LeafNode<number>, index: number, document: Document) {
    const n = this.common(document);
    n.innerHTML = `<div class="bar"></div>`;
    return this.updateSingle(n, row, index);
  }

  updateSingle(node: HTMLElement, row: LeafNode<number>, index: number) {
    const bar = <HTMLElement>node.children[0];
    bar.style.width = `${Math.round(row.item * 100)}%`;
    bar.textContent = row.item.toFixed(2);
    return node;
  }

  createGroup(row: InnerNode, index: number, document: Document) {
    return this.updateGroup(this.common(document), row, index);
  }

  updateGroup(node: HTMLElement, row: InnerNode, index: number) {
    node.textContent = `Group(${row.length})@${index.toString()}`;
    return node;
  }
}
