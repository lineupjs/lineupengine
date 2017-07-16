import {LeafNode, InnerNode} from '../tree';
import AColumn from './AColumn';

export default class NumberColumn extends AColumn {
  constructor(index: number, name: string, frozen: boolean = false, width = 100) {
    super(index, name, frozen, width);
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

export function computeHist(leaves: LeafNode<number>[]) {
  const bins = [0, 0, 0, 0, 0];

  leaves.forEach((leaf) => {
    const bin = Math.floor(leaf.item * 5) % 5;
    bins[bin] ++;
  });

  return bins;
}
