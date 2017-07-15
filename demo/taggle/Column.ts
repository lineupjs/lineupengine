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
    node.dataset.group = row.parent.name;
    const bar = <HTMLElement>node.children[0];
    bar.style.width = `${Math.round(row.item * 100)}%`;
    bar.textContent = row.item.toFixed(2);
    return node;
  }

  createGroup(row: InnerNode, index: number, document: Document) {
    const n = this.common(document);
    n.innerHTML = `<div class="bin"></div><div class="bin"></div><div class="bin"></div><div class="bin"></div><div class="bin"></div>`;
    return this.updateGroup(n, row, index);
  }

  updateGroup(node: HTMLElement, row: InnerNode, index: number) {
    node.dataset.group = row.name;
    const hist = <number[]>row.aggregate;
    const max = Math.max(...hist);
    hist.forEach((bin, i) => {
      const binNode = <HTMLElement>node.children[i];
      binNode.style.transform = `translateY(${Math.round((max-bin)*100 / max)}%)`;
      binNode.textContent = `#${bin}`;
    });
    return node;
  }
}


export class StringColumn extends Column {
  createSingle(row: LeafNode<number>, index: number, document: Document) {
    const n = this.common(document);
    return this.updateSingle(n, row, index);
  }

  common(document: Document) {
    const d = super.common(document);
    d.classList.add('string');
    return d;
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


export function computeHist(leaves: LeafNode<number>[]) {
  const bins = [0, 0, 0, 0, 0];

  leaves.forEach((leaf) => {
    const bin = Math.floor(leaf.item * 5) % 5;
    bins[bin] ++;
  });

  return bins;
}
