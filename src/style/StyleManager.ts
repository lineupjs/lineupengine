// import manually import './style.scss';

/**
 * utility for custom generated CSS rules
 */

interface ICSSRule {
  id: string;
  selector: string;
  style: Partial<CSSStyleDeclaration>;
}

function assignStyles(target: any, source: any) {
  for (const key of Object.keys(source)) {
    const v = <string>source[key];

    if (target[key] === v) {
      continue;
    }
    target[key] = v;
  }
}

export default class StyleManager {
  private readonly rules: ICSSRule[] = [];
  private readonly node: HTMLStyleElement;

  /**
   * the parent element to append this managed style
   * @param {HTMLElement} root
   */
  constructor(root: HTMLElement) {
    this.node = root.ownerDocument.createElement('style');
    this.node.appendChild(root.ownerDocument.createTextNode('')); // for webkit?
    root.appendChild(this.node);
  }

  destroy() {
    this.node.remove();
  }

  private verifySheet() {
    const sheet = this.sheet;
    if (sheet.rules.length === this.rules.length && this.rules.every((d, i) => (<CSSStyleRule>sheet.rules[i]).selectorText === d.selector)) {
      // same
      return;
    }

    console.warn('invalid sheet rules detected');

    const l = sheet.rules.length;
    for (let i = 0; i < l; ++i) {
      sheet.deleteRule(i);
    }

    // create all
    for (const rule of this.rules) {
      const index = sheet.insertRule(`${rule.selector} {}`, sheet.rules.length);
      const cssRule = <CSSStyleRule>sheet.rules[index];
      assignStyles(cssRule.style, rule.style);
    }
  }

  private get sheet() {
    return (<CSSStyleSheet>this.node.sheet);
  }

  private getSheetRule(index: number) {
    const sheet = this.sheet;
    return <CSSStyleRule>sheet.rules[index];
  }

  /**
   * add a custom css rule
   * @param {string} id unique id of the rule for later identification
   * @param {string} selector the css selector
   * @param {Partial<CSSStyleDeclaration>} style the style attributes
   * @returns {string} the id again
   */
  addRule(id: string, selector: string, style: Partial<CSSStyleDeclaration>) {
    this.verifySheet();
    const sheet = this.sheet;
    const index = sheet.insertRule(`${selector} {}`, sheet.rules.length);
    const rule = this.getSheetRule(index);
    this.rules.push({id, selector: rule.selectorText, style});
    assignStyles(rule.style, style);
    return id;
  }

  /**
   * updates or add a rule, see @addRule
   * @param {string} id unique id of the rule for later identification
   * @param {string} selector the css selector
   * @param {Partial<CSSStyleDeclaration>} style the style attributes
   * @returns {string} the id again
   */
  updateRule(id: string, selector: string, style: Partial<CSSStyleDeclaration>) {
    this.verifySheet();
    const index = this.rules.findIndex((d) => d.id === id);
    if (index < 0) {
      return this.addRule(id, selector, style);
    }
    const rule = this.getSheetRule(index);
    if (rule.selectorText.replace(/\s/gm, '') !== selector.replace(/\s/gm, '')) { //ignoring white space
      rule.selectorText = selector;
      this.rules[index].selector = rule.selectorText;
    }
    assignStyles(rule.style, style);
    return id;
  }

  /**
   * deletes the given rule by id
   * @param {string} id the rule to delete
   */
  deleteRule(id: string) {
    this.verifySheet();
    const index = this.rules.findIndex((d) => d.id === id);
    if (index < 0) {
      return;
    }
    this.rules.splice(index, 1);
    this.sheet.deleteRule(index);
  }

  /**
   * get a list of all registered rule ids
   * @returns {string[]}
   */
  protected get ruleNames() {
    return this.rules.map((d) => d.id);
  }
}
