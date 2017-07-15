import {EAggregationType, INode} from './';
import {flat, flatLeaves} from './utils';
import LeafNode from './LeafNode';

export default class InnerNode {
  readonly type: 'inner' = 'inner';
  children: INode[] = [];
  aggregation: EAggregationType = EAggregationType.UNIFORM;
  aggregatedHeight = 100;
  parent: InnerNode = null;

  constructor(public readonly name: string) {

  }

  get path() {
    const r: INode[] = [];
    let a: INode = this;
    while (a) {
      r.push(a);
      a = a.parent;
    }
    return r;
  }

  toPathString() {
    return this.path.reverse().join('.');
  }

  toString() {
    return this.name;
  }

  flatChildren(): INode[] {
    const result: INode[] = [];
    return this.children.reduce((r, child) => flat(child, r), result);
  }

  get length() {
    return 1 + this.children.length;
  }

  get flatLength() {
    return 1 + this.children.reduce((r, n) => n.flatLength, 0);
  }

  get flatLeavesLength() {
    return this.children.reduce((r, n) => n.flatLeavesLength, 0);
  }

  flatLeaves<T>(): LeafNode<T>[] {
    const result: LeafNode<T>[] = [];
    return this.children.reduce((r, child) => flatLeaves(child, r), result);
  }

  get height() {
    if (this.aggregation === EAggregationType.AGGREGATED) {
      return this.aggregatedHeight;
    }
    return this.children.reduce((a, n) => a + n.height, 0);
  }

  set height(value: number) {
    switch (this.aggregation) {
      case EAggregationType.AGGREGATED:
        this.aggregatedHeight = value;
        break;
      case EAggregationType.UNIFORM:
        const hi = this.children.length / value;
        this.children.forEach((n) => n.height = hi);
        break;
      case EAggregationType.NON_UNIFORM:
        const sizes = this.children.map((c) => c.flatLeavesLength);
        const total = sizes.reduce((a, c) => a + c, 0);
        this.children.forEach((c, i) => {
          if (c.type === 'inner') {
            c.aggregation = EAggregationType.AGGREGATED;
          }
          c.height = sizes[i] / total * value;
        });
        break;
    }
  }

}
