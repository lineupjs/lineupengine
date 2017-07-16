import {LeafNode, InnerNode, INode, EAggregationType} from '../tree';
import AColumn from './AColumn';

const CARET_NO = '<i class="fa fa-fw"></i>';
const CARET_DOWN = '<i class="fa fa-fw fa-caret-down"></i>';
const CARET_RIGHT = '<i class="fa fa-fw fa-caret-right"></i>';

export default class HierarchyColumn extends AColumn {
  constructor(index: number, private readonly rebuilder: ()=>void) {
    super(index, '', true, 60);
  }

  common(document: Document) {
    const d = super.common(document);
    d.classList.add('hierarchy');
    return d;
  }

  createSingle(row: LeafNode<number>, index: number, document: Document) {
    const n = this.common(document);
    return this.updateSingle(n, row, index);
  }

  private hierarchy(row: INode) {
    const p = row.parents;
    p.reverse();
    p.shift();
    return p.map((pi: InnerNode) => pi.isFirstChild ? CARET_DOWN : CARET_NO).join('');
  }

  private toggle(row: InnerNode, n: HTMLElement, index: number) {
    n.onclick = () => {
      const p = <InnerNode[]>row.path;
      p.reverse();
      const toggle = p[index + 1];
      toggle.aggregation = toggle.aggregation === EAggregationType.UNIFORM ? EAggregationType.AGGREGATED : EAggregationType.UNIFORM;
      this.rebuilder();
    };
  }


  updateSingle(node: HTMLElement, row: LeafNode<number>, index: number) {
    node.innerHTML = row.isFirstChild ? this.hierarchy(row.parent) + CARET_DOWN : '';
    Array.from(node.children).forEach(this.toggle.bind(this, row.parent));
    return node;
  }

  createGroup(row: InnerNode, index: number, document: Document) {
    const n = this.common(document);
    return this.updateGroup(n, row, index);
  }

  updateGroup(node: HTMLElement, row: InnerNode, index: number) {
    node.innerHTML = this.hierarchy(row) + CARET_RIGHT;
    Array.from(node.children).forEach(this.toggle.bind(this, row));
    return node;
  }
}

