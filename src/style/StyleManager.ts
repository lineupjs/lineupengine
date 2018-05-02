// import manually import './style.scss';

/**
 * utility for custom generated CSS rules
 */
export default class StyleManager {
  private readonly rules = new Map<string, string>();
  private readonly node: HTMLStyleElement;

  /**
   * the parent element to append this managed style
   * @param {HTMLElement} root
   */
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

  /**
   * add a custom css rule
   * @param {string} id unique id of the rule for later identification
   * @param {string} rule the css rule itself
   * @returns {string} the id again
   */
  addRule(id: string, rule: string) {
    // append
    this.rules.set(id, rule);
    this.recreate();
    return id;
  }

  /**
   * updates or add a rule, see @addRule
   * @param {string} id unique id of the rule for later identification
   * @param {string} rule the css rule itself
   * @returns {string} the id again
   */
  updateRule(id: string, rule: string) {
    this.rules.set(id, rule);
    this.recreate();
    return id;
  }

  /**
   * deletes the given rule by id
   * @param {string} id the rule to delete
   */
  deleteRule(id: string) {
    const r = this.rules.get(id);
    if (!r) {
      return;
    }
    this.rules.delete(id);
    this.recreate();
  }

  /**
   * get a list of all registered rule ids
   * @returns {string[]}
   */
  protected get ruleNames() {
    return Array.from(this.rules.keys());
  }
}
