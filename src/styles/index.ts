


const PREFIX = 'le';

/**
 * @internal
 * @param suffix suffix to suffix
 */
export function cssClass(suffix?: string) {
  if (!suffix) {
    return PREFIX;
  }
  return `${PREFIX}-${suffix}`;
}

export const CSS_CLASS_LOADING = cssClass('loading');
export const CSS_CLASS_FROZEN = cssClass('frozen');
export const CSS_CLASS_HIDDEN = cssClass('hidden');
export const CSS_CLASS_MULTI = cssClass('multi');
export const CSS_CLASS_EVEN = cssClass('even');
export const CSS_CLASS_SHIFTED = cssClass('shifted');
export const CSS_CLASS_SCROLLBAR_TESTER = cssClass('scrollbar-tester');

export const CSS_CLASS_HEADER = cssClass('header');
export const CSS_CLASS_BODY = cssClass('body');
export const CSS_CLASS_FOOTER = cssClass('footer');

export const CSS_CLASS_THEAD = cssClass('thead');
export const CSS_CLASS_TBODY = cssClass('tbody');

export const CSS_CLASS_TR = cssClass('tr');
export const CSS_CLASS_TH = cssClass('th');
export const CSS_CLASS_TD = cssClass('td');

export const CSS_CLASS_SCROLLING = cssClass('scrolling');
export const CSS_CLASS_ROW_ANIMATION = cssClass('row-animation');
