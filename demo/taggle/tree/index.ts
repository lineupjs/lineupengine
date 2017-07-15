import LeafNode from './LeafNode';
import InnerNode from './InnerNode';

export {default as LeafNode} from './LeafNode';
export {default as InnerNode} from './InnerNode';
export {fromArray} from './utils';

export enum EAggregationType {
  AGGREGATED,
  NON_UNIFORM,
  UNIFORM
}

export declare type INode = LeafNode<any> | InnerNode;
