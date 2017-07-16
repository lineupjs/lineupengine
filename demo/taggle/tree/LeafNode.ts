import InnerNode from './InnerNode';
import ANode from './ANode';

export default class LeafNode<T> extends ANode {
  readonly type: 'leaf' = 'leaf';
  height = 20;

  constructor(public readonly item: T) {
    super();
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

  toString() {
    return this.item.toString();
  }
}
