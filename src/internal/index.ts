export * from './scroll';

/**
 * clear node clearing
 * @param node
 * @internal
 */
export function clear<T extends Node>(node: T) {
  while (node.lastChild) {
    node.removeChild(node.lastChild);
  }
  return node;
}
