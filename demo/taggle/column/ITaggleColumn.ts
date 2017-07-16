import {IColumn} from '../../../src/style';
import {LeafNode, InnerNode} from '../tree';

export interface ITaggleColumn extends IColumn {
  createHeader(document: Document): HTMLElement;

  createSingle(row: LeafNode<number>, index: number, document: Document): HTMLElement;
  updateSingle(node: HTMLElement, row: LeafNode<number>, index: number): HTMLElement;

  createGroup(row: InnerNode, index: number, document: Document): HTMLElement;
  updateGroup(node: HTMLElement, row: InnerNode, index: number): HTMLElement;
}

export default ITaggleColumn;
