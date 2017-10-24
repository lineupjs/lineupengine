/**
 * Created by Samuel Gratzl on 05.10.2017.
 */
import {IExceptionContext} from '../logic';


export default class KeyFinder {
  private readonly cache: number[] = [];
  private readonly key2index = new Map<string, number>();

  constructor(public readonly context: IExceptionContext, public readonly key: (rowIndex: number)=>string) {
    this.context.exceptions.forEach((e) => {
      this.cache[e.index] = e.y;
    });
  }

  private findValidStart(before: number) {
    for (let i = before - 1; i>=0; --i) {
      if (this.cache[i] !== undefined) {
        return i;
      }
    }
    return -1;
  }


  /**
   *
   * @param {string} key
   * @return {number} -1 if not found
   */
  posByKey(key: string) {
    if (this.key2index.has(key)) {
      const index = this.key2index.get(key)!;
      return {index, pos: this.pos(index)};
    }
    return this.fillCacheTillKey(key);
  }

  pos(index: number) {
    if (this.context.exceptions.length === 0) {
      // fast pass
      return index * this.context.defaultRowHeight;
    }
    const cached = this.cache[index];
    if (cached !== undefined) {
      return cached;
    }
    //need to compute it
    // find the starting point where to start counting
    const start = this.findValidStart(index);
    if (start < 0) {
      this.fillCache(0, index, 0);
    } else {
      this.fillCache(start, index, this.cache[start]);
    }
    return this.cache[index]!;
  }

  private fillCache(first: number, last: number, offset: number, callback?: (index: number, key: string, pos: number)=>void) {
    let pos = offset;
    for(let i = first; i <= last; ++i) {
      this.cache[i] = pos;
      const key = this.key(i);
      this.key2index.set(key, i);
      if (callback) {
        callback(i, key, pos);
      }
      pos += this.heightOf(i);
    }
  }

  heightOf(index: number) {
    const lookup = this.context.exceptionsLookup;
    return  lookup.has(index) ? lookup.get(index)! : this.context.defaultRowHeight;
  }

  exceptionHeightOf(index: number) {
    const lookup = this.context.exceptionsLookup;
    return  lookup.has(index) ? lookup.get(index)! : null;
  }

  private fillCacheTillKey(target: string) {
    let pos = 0;
    for(let i = 0; i < this.context.numberOfRows; ++i) {
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
        return {index: i, pos};
      }
      pos += this.heightOf(i);
    }
    return {index: -1, pos: -1};
  }

  positions(first: number, last: number, offset: number, callback?: (index: number, key: string, pos: number)=>void) {
    this.fillCache(first, last, offset, callback);
    return this.cache.slice(first, last +1);
  }
}
