

import {EAggregationType, INode, LeafNode, InnerNode} from './';

export function flatLeaves(root: INode, result: LeafNode[] = []) {
  if (root.type === 'leaf') {
    result.push(root);
    return result;
  }
  return root.children.reduce((r, child) => flatLeaves(child, r), result);
}

export function flat(root: INode, result: INode[] = []) {
  if (root.type === 'leaf' || (root.type === 'inner' && root.aggregation === EAggregationType.AGGREGATED)) {
    result.push(root);
    return result;
  }
  return root.children.reduce((r, child) => flat(child, r), result);
}


export function fromArray<T>(rows: T[], rowHeight: number, grouper?: (row: T) => string): InnerNode {
  const root = new InnerNode('');

  const leaves = rows.map((r) => {
    const n = new LeafNode((r));
    n.height = rowHeight;
    n.parent = root;
    return n;
  });

  if (grouper) {
    const g = new Map<string, InnerNode>();
    leaves.forEach((n) => {
      const group = grouper(n.item);
      let gg: InnerNode;
      if (!g.has(group)) {
        gg = new InnerNode(group);
        gg.parent = root;
        g.set(group, gg);
      } else {
        gg = g.get(group);
      }
      n.parent = gg;
      gg.children.push(n);
    });

    g.forEach((gg) => root.children.push(gg));
  } else {
    root.children = leaves;
  }

  return root;
}
