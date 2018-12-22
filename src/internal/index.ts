export * from './scroll';

/**
 * clear node clearing
 * @param node
 * @internal
 */
export function clear(node: Node) {
  while (node.lastChild) {
    node.removeChild(node.lastChild);
  }
}
