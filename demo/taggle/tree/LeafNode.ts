import InnerNode from './InnerNode';

export default class LeafNode<T> {
  readonly type: 'leaf' = 'leaf';
  height = 20;
  parent: InnerNode = null;

  constructor(public readonly item: T) {
  }

  get length() {
    return 1;
  }

  get flatLength() {
    return 1;
  }

  get flatLeavesLength() {
    return 1;
  }

  get path() {
    return [this, ...this.parent.path];
  }

  toPathString() {
    return this.path.reverse().join('.');
  }

  toString() {
    return this.item.toString();
  }
}
