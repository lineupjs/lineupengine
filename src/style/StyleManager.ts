/**
 * Created by Samuel Gratzl on 13.07.2017.
 */

// import manually import './style.scss';

export const isEdge = typeof CSS !== 'undefined' && CSS.supports('(-ms-ime-align:auto)');

/**
 * utility for custom generated CSS rules
 */
export default class StyleManager {
  private readonly rules = new Map<string, { rule: CSSRule, index: number }>();
  private readonly node: HTMLStyleElement;

  constructor(root: HTMLElement) {
    this.node = root.ownerDocument.createElement('style');
    root.appendChild(this.node);
    if (isEdge) {
      root.classList.add('ms-edge');
    }
  }

  private get stylesheet() {
    const r = <CSSStyleSheet>this.node.sheet;
    if(this.rules.size > 0 && r.cssRules.length === 0) {
      // recreate
      this.rules.forEach((v) => {
        v.index = r.cssRules.length;
        r.insertRule(v.rule.cssText);
        v.rule = r.cssRules.item(v.index);
      });
    }
    return r;
  }

  destroy() {
    this.node.remove();
  }

  addRule(id: string, rule: string) {
    // append
    const l = this.stylesheet.cssRules.length;
    this.stylesheet.insertRule(rule, l);
    this.rules.set(id, {rule: this.stylesheet.cssRules[l], index: l});
    return id;
  }

  private findIndex(guess: number, rule: CSSRule) {
    const guessed = this.stylesheet.cssRules[guess];
    if (guessed === rule) {
      return guess;
    }
    return Array.from(this.stylesheet.cssRules).indexOf(rule);
  }

  updateRule(id: string, rule: string) {
    const r = this.rules.get(id);
    if (!r) {
      // add if not yet existing
      return this.addRule(id, rule);
    }
    r.index = this.findIndex(r.index, r.rule);
    this.stylesheet.deleteRule(r.index);
    this.stylesheet.insertRule(rule, r.index);
    r.rule = this.stylesheet.cssRules[r.index];
    return id;
  }

  deleteRule(id: string) {
    const r = this.rules.get(id);
    if (!r) {
      return;
    }
    r.index = this.findIndex(r.index, r.rule);
    this.stylesheet.deleteRule(r.index);
    this.rules.delete(id);
  }

  protected get ruleNames() {
    return Array.from(this.rules.keys());
  }
}
