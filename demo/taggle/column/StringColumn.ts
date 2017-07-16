import {LeafNode, InnerNode} from '../tree';
import AColumn from './AColumn';

export default class StringColumn extends AColumn {
  constructor(index: number, name: string, frozen: boolean = false, width = 100) {
    super(index, name, frozen, width);
  }

  common(document: Document) {
    const d = super.common(document);
    d.classList.add('string');
    return d;
  }

  createSingle(row: LeafNode<number>, index: number, document: Document) {
    const n = this.common(document);
    return this.updateSingle(n, row, index);
  }

  updateSingle(node: HTMLElement, row: LeafNode<number>, index: number) {
    node.textContent = `${row.parent.name}#${row.parent.children.indexOf(row)}`;
    return node;
  }

  createGroup(row: InnerNode, index: number, document: Document) {
    const n = this.common(document);
    return this.updateGroup(n, row, index);
  }

  updateGroup(node: HTMLElement, row: InnerNode, index: number) {
    node.textContent = `Group ${row.name} #${row.length}`;
    return node;
  }
}

