// import manually import './style.scss';

/**
 * utility for custom generated CSS rules
 */

interface ICSSRule {
  id: string;
  selector: string;
  style: Partial<CSSStyleDeclaration>;
}

function assignStyles(target: CSSStyleDeclaration, source: Record<string, unknown>) {
  const targetObj = target as unknown as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    const v = source[key] as string;

    if (!v.endsWith(' !important')) {
      if (targetObj[key] !== v) {
         
        targetObj[key] = v;
      }
      continue;
    }

    // handle special important case
    const plain = v.slice(0, -' !important'.length);
    if (targetObj[key] === plain) {
      continue;
    }
     
    targetObj[key] = plain;
    // see https://gist.github.com/youssman/745578062609e8acac9f
    const hyphen = key.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();
    target.setProperty(hyphen, plain, 'important');
  }
}

export default class StyleManager {
  private readonly rules: ICSSRule[] = [];

  private readonly node: HTMLStyleElement;

  private testVerifyTimeout = -1;

  /**
   * the parent element to append this managed style
   * @param {HTMLElement} root
   */
  constructor(root: HTMLElement) {
    this.node = root.ownerDocument.createElement('style');
    this.node.appendChild(root.ownerDocument.createTextNode('')); // for webkit?
    root.appendChild(this.node);
  }

  destroy(): void {
    this.node.remove();
  }

  private verifySheet() {
    const { sheet } = this;
    if (!sheet) {
      if (this.testVerifyTimeout >= 0) {
        return;
      }
      // test till attached
       
      this.testVerifyTimeout = self.setTimeout(() => {
        this.testVerifyTimeout = -1;
        this.verifySheet();
      }, 20);
      return;
    }
    const rules = sheet.cssRules;
    if (
      rules.length === this.rules.length &&
      this.rules.every((d, i) => (rules[i] as CSSStyleRule).selectorText === d.selector)
    ) {
      // same
      return;
    }

    // console.warn('invalid sheet rules detected');

    const l = rules.length;
    for (let i = l - 1; i >= 0; i -= 1) {
      sheet.deleteRule(i);
    }

    // create all
    for (const rule of this.rules) {
      const index = sheet.insertRule(`${rule.selector} {}`, sheet.cssRules.length);
      const cssRule = sheet.cssRules[index] as CSSStyleRule;
      rule.selector = cssRule.selectorText;
      assignStyles(cssRule.style, rule.style);
    }
  }

  private get sheet() {
    return this.node.sheet as CSSStyleSheet | null;
  }

  private getSheetRule(index: number) {
    const { sheet } = this;
    return sheet ? (sheet.cssRules[index] as CSSStyleRule) : null;
  }

  /**
   * add a custom css rule
   * @param {string} id unique id of the rule for later identification
   * @param {string} selector the css selector
   * @param {Partial<CSSStyleDeclaration>} style the style attributes
   * @returns {string} the id again
   */
  addRule(id: string, selector: string, style: Partial<CSSStyleDeclaration>): string | null {
    this.verifySheet();
    const { sheet } = this;
    if (!sheet) {
      // upon next update
      this.rules.push({ id, selector, style });
      return null;
    }
    const index = sheet.insertRule(`${selector} {}`, sheet.cssRules.length);
    const rule = sheet.cssRules[index] as CSSStyleRule;
    this.rules.push({ id, selector: rule.selectorText, style });
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
  updateRule(id: string, selector: string, style: Partial<CSSStyleDeclaration>): string | null {
    this.verifySheet();
    const index = this.rules.findIndex((d) => d.id === id);
    if (index < 0) {
      return this.addRule(id, selector, style);
    }
    const stored = this.rules[index];
    stored.selector = selector;
    stored.style = style;

    const rule = this.getSheetRule(index);
    if (rule) {
      if (rule.selectorText.replace(/\s/gm, '') !== selector.replace(/\s/gm, '')) {
        // ignoring white space
        rule.selectorText = selector;
        stored.selector = rule.selectorText;
      }
      assignStyles(rule.style, style);
    }
    return id;
  }

  /**
   * deletes the given rule by id
   * @param {string} id the rule to delete
   */
  deleteRule(id: string): void {
    this.verifySheet();
    const index = this.rules.findIndex((d) => d.id === id);
    if (index < 0) {
      return;
    }
    this.rules.splice(index, 1);
    const { sheet } = this;
    if (sheet) {
      sheet.deleteRule(index);
    }
  }

  /**
   * get a list of all registered rule ids
   */
  protected get ruleNames(): string[] {
    return this.rules.map((d) => d.id);
  }
}
