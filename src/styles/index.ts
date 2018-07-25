


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
