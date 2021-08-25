import { IExceptionContext } from '../logic';

/**
 * utility class for optimized row context access
 */
export default class KeyFinder {
  private readonly cache: number[] = [];

  private lastFilled = 0;

  private readonly key2index = new Map<string, number>();

  /**
   * constructor for fast key based row access
   * @param {IExceptionContext} context context to use
   * @param {(rowIndex: number) => string} key key function
   */
  constructor(public readonly context: IExceptionContext, public readonly key: (rowIndex: number) => string) {
    this.context.exceptions.forEach((e) => {
      this.cache[e.index] = e.y;
      this.key2index.set(key(e.index), e.index);
    });
  }

  private findValidStart(before: number) {
    for (let i = before - 1; i >= 0; i -= 1) {
      if (this.cache[i] !== undefined) {
        return i;
      }
    }
    return -1;
  }

  /**
   * returns the position of the given given or -1 if not found
   * @param {string} key
   */
  posByKey(key: string): { index: number; pos: number } {
    const index = this.key2index.get(key);
    if (index != null) {
      return { index, pos: this.pos(index) };
    }
    return this.fillCacheTillKey(key);
  }

  /**
   * returns the position of the given index
   * @param {number} index index to look for
   */
  pos(index: number): number {
    if (this.context.exceptions.length === 0) {
      // fast pass
      return index * this.context.defaultRowHeight;
    }
    const cached = this.cache[index];
    if (cached !== undefined) {
      return cached;
    }
    // need to compute it
    // find the starting point where to start counting
    const start = this.findValidStart(index);
    if (start < 0) {
      this.fillCache(0, index, 0);
    } else {
      this.fillCache(start + 1, index, this.cache[start] + this.heightOf(start));
    }
    return this.cache[index];
  }

  private fillCache(
    first: number,
    last: number,
    offset: number,
    callback?: (index: number, key: string, pos: number) => void
  ) {
    if (last <= this.lastFilled) {
      // everything already there
      if (!callback) {
        return;
      }
      for (let i = first; i <= last; i += 1) {
        callback(i, this.key(i), this.cache[i]);
      }
      return;
    }
    let pos = offset;
    for (let i = first; i <= last; i += 1) {
      this.cache[i] = pos;
      const key = this.key(i);
      this.key2index.set(key, i);
      if (callback) {
        callback(i, key, pos);
      }
      pos += this.heightOf(i);
    }
  }

  /**
   * returns the height of the row identified by index
   * @param {number} index
   */
  heightOf(index: number): number {
    const lookup = this.context.exceptionsLookup;
    return lookup.get(index) ?? this.context.defaultRowHeight;
  }

  /**
   * see heightOf but ignores padding and optional null in case of default height
   * @param {number} index row index
   * @param {boolean} returnDefault return null if default height
   * @returns {number}
   */
  exceptionHeightOf(index: number, returnDefault?: boolean): number | null;
  exceptionHeightOf(index: number, returnDefault: true): number;
  exceptionHeightOf(index: number, returnDefault = false): number | null {
    const padding = this.context.padding(index);
    const lookup = this.context.exceptionsLookup;
    const entry = lookup.get(index);
    if (entry != null) {
      return entry - padding;
    }
    return returnDefault ? this.context.defaultRowHeight - padding : null;
  }

  /**
   * padding of the given index
   * @param {number} index
   * @returns {number}
   */
  padding(index: number): number {
    return this.context.padding(index);
  }

  private fillCacheTillKey(target: string) {
    let pos = 0;
    for (let i = this.lastFilled; i < this.context.numberOfRows; i += 1, this.lastFilled += 1) {
      const c = this.cache[i];
      if (c !== undefined) {
        pos = c + this.heightOf(i);
        continue;
      }
      // new one fill up
      const key = this.key(i);
      this.cache[i] = pos;
      this.key2index.set(key, i);
      if (key === target) {
        return { index: i, pos };
      }
      pos += this.heightOf(i);
    }
    return { index: -1, pos: -1 };
  }

  /**
   * computes the positions and keys for a range of given indices
   * @param {number} first first row index
   * @param {number} last last row index
   * @param {number} offset pos offset for the first row index
   * @param {(index: number, key: string, pos: number) => void} callback callback for each identified index
   */
  positions(
    first: number,
    last: number,
    offset: number,
    callback?: (index: number, key: string, pos: number) => void
  ): void {
    this.fillCache(first, last, offset, callback);
  }
}
