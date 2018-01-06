// import manually import './style.scss';

/**
 * utility for custom generated CSS rules
 */
export default class StyleManager {
  private readonly rules = new Map<string, string>();
  private readonly node: HTMLStyleElement;

  constructor(root: HTMLElement) {
    this.node = root.ownerDocument.createElement('style');
    root.appendChild(this.node);
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
