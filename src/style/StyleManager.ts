/**
 * Created by Samuel Gratzl on 13.07.2017.
 */

// import manually import './style.scss';

export const isEdge = typeof CSS !== 'undefined' && CSS.supports('(-ms-ime-align:auto)');

/**
 * utility for custom generated CSS rules
 */
export default class StyleManager {
  private readonly rules = new Map<string, string>();
  private readonly node: HTMLStyleElement;

  constructor(root: HTMLElement) {
    this.node = root.ownerDocument.createElement('style');
    root.appendChild(this.node);
    if (isEdge) {
      root.classList.add('ms-edge');
    }
  }

  destroy() {
    this.node.remove();
  }

  private recreate() {
    this.node.innerHTML = Array.from(this.rules.values()).join('\n');
  }

  addRule(id: string, rule: string) {
    // append
    this.rules.set(id, rule);
    this.recreate();
    return id;
  }

  updateRule(id: string, rule: string) {
    this.rules.set(id, rule);
    this.recreate();
    return id;
  }

  deleteRule(id: string) {
    const r = this.rules.get(id);
    if (!r) {
      return;
    }
    this.rules.delete(id);
    this.recreate();
  }

  protected get ruleNames() {
    return Array.from(this.rules.keys());
  }
}
