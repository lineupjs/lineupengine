/**
 * generic exception of a uniform space
 */
export interface IRowHeightException {
  /**
   * reference index
   */
  readonly index: number;
  /**
   * height of the element
   */
  readonly height: number;
  /**
   * starting y
   */
  readonly y: number;
  /**
   * ending y
   */
  readonly y2: number;
}

class RowHeightException implements IRowHeightException {
  constructor(public readonly index: number, public readonly y: number, public readonly height: number) {}

  get y2() {
    return this.y + this.height;
  }
}

/**
 * similar to a map
 */
export interface IRowHeightExceptionLookup {
  keys(): IterableIterator<number>;

  get(index: number): number | undefined;

  has(index: number): boolean;

  readonly size: number;
}

/**
 * exception context for optimized non uniform height exceptions
 */
export interface IExceptionContext {
  /**
   * height exceptions as a list
   */
  readonly exceptions: IRowHeightException[];
  /**
   * lookup for the height of a given index, if not part of this map it has the default height
   */
  readonly exceptionsLookup: IRowHeightExceptionLookup;
  /**
   * number of rows
   */
  readonly numberOfRows: number;
  /**
   * default height of rows
   */
  readonly defaultRowHeight: number;
  /**
   * total height
   */
  readonly totalHeight: number;

  /**
   * padding between rows, however already included in all heights to have the precise numbers
   */
  readonly padding: (index: number) => number;
}

/**
 * creates a uniform exception context, i.e no exceptions all rows are of the same height
 * @param {number} numberOfRows
 * @param {number} currentRowHeight
 * @param {number} rowPadding padding between rows
 * @return {IExceptionContext}
 */
export function uniformContext(numberOfRows: number, rowHeight: number, rowPadding = 0): IExceptionContext {
  const currentRowHeight = rowHeight + rowPadding;
  const exceptionsLookup = {
    keys: () => [].values(),
    get: () => currentRowHeight,
    has: () => false,
    size: 0,
  };
  return {
    exceptions: [],
    exceptionsLookup,
    totalHeight: numberOfRows * currentRowHeight,
    numberOfRows,
    defaultRowHeight: currentRowHeight,
    padding: () => rowPadding,
  };
}

/**
 * computes the most frequent value in a given array like
 * @param {} values
 * @return {number}
 */
function mostFrequentValue(values: { forEach: (callback: (height: number, index: number) => void) => void }): number {
  const lookup = new Map<number, number>();
  values.forEach((value) => {
    lookup.set(value, (lookup.get(value) || 0) + 1);
  });
  if (lookup.size === 0) {
    return 20; // default value since it doesn't matter
  }
  // sort desc take first key and asc by the second in case of tie, it is optimized to have exceptions for higher rows less for big rows
  const sorted = Array.from(lookup).sort((a, b) => {
    if (a[1] !== b[1]) {
      return b[1] - a[1];
    }
    return a[0] - b[0];
  });
  const mostFrequent = sorted[0][0];
  if (mostFrequent === 0) {
    // corner case
    return sorted.length > 1 ? sorted[1][0] : 20; // all empty
  }
  return mostFrequent;
}

/**
 * creates a non uniform context based on the given array like heights
 * @param rowHeights array like to get the heights
 * @param {number} defaultRowHeight if not given the most frequent value will be used
 * @param {number} rowPadding padding between rows
 * @return {IExceptionContext}
 */
export function nonUniformContext(
  rowHeights: {
    forEach: (callback: (height: number, index: number) => void) => void;
  },
  defaultRowHeight = Number.NaN,
  rowPadding: number | ((index: number) => number) = 0
): IExceptionContext {
  const exceptionsLookup = new Map<number, number>();
  const exceptions: IRowHeightException[] = [];

  const padding = typeof rowPadding === 'function' ? rowPadding : () => rowPadding as number;

  let actualDefaultRowHeight = defaultRowHeight;
  if (Number.isNaN(actualDefaultRowHeight)) {
    actualDefaultRowHeight = mostFrequentValue(rowHeights);
  }

  actualDefaultRowHeight += padding(-1);

  let prev = -1;
  let acc = 0;
  let totalHeight = 0;
  let numberOfRows = 0;
  rowHeights.forEach((height, index) => {
    const paddedHeight = height + padding(index);
    totalHeight += paddedHeight;
    numberOfRows += 1;
    if (paddedHeight === actualDefaultRowHeight) {
      // regular
      return;
    }
    exceptionsLookup.set(index, paddedHeight);
    const between = (index - prev - 1) * actualDefaultRowHeight;
    prev = index;
    const y = acc + between;
    acc = y + paddedHeight;
    exceptions.push(new RowHeightException(index, y, paddedHeight));
  });
  return {
    exceptionsLookup,
    exceptions,
    totalHeight,
    defaultRowHeight: actualDefaultRowHeight,
    numberOfRows,
    padding,
  };
}

/**
 * creates a random context with the given constraints
 * @param {number} numberOfRows
 * @param {number} defaultRowHeight
 * @param {number} minRowHeight
 * @param {number} maxRowHeight
 * @param {number} ratio around ratio percent will get a non uniform height
 * @param {number} seed random seed
 * @return {IExceptionContext}
 */
export function randomContext(
  numberOfRows: number,
  defaultRowHeight: number,
  minRowHeight = 2,
  maxRowHeight = defaultRowHeight * 10,
  ratio = 0.2,
  seed = Date.now()
): IExceptionContext {
  let actSeed = seed;
  const random = () => {
    const x = Math.sin(actSeed) * 10000;
    actSeed += 1;
    return x - Math.floor(x);
  };

  const getter = () => {
    const coin = random();
    if (coin < ratio) {
      // non uniform
      return minRowHeight + Math.round(random() * (maxRowHeight - minRowHeight));
    }
    return defaultRowHeight;
  };
  const forEach = (callback: (height: number, index: number) => void) => {
    for (let index = 0; index < numberOfRows; index += 1) {
      callback(getter(), index);
    }
  };
  return nonUniformContext({ forEach }, defaultRowHeight);
}

export interface IVisibleRange {
  /**
   * first visible index
   */
  readonly first: number;
  /**
   * last visible index
   */
  readonly last: number;
  /**
   * position of the first visible row in pixel
   */
  readonly firstRowPos: number;
  /**
   * position of the last visible row including its size
   */
  readonly endPos: number;
}

/**
 * computes the visible range
 * @param {number} scrollTop top scrolling
 * @param {number} clientHeight visible height
 * @param {number} rowHeight height of a row by default
 * @param {IRowHeightException[]} heightExceptions exceptions of this default height
 * @param {number} numberOfRows the number of rows
 * @return {IVisibleRange} the computed visible range
 */
export function range(
  scrollTop: number,
  clientHeight: number,
  rowHeight: number,
  heightExceptions: IRowHeightException[],
  numberOfRows: number
): IVisibleRange {
  if (numberOfRows === 0) {
    return { first: 0, last: -1, firstRowPos: 0, endPos: 0 };
  }
  if (numberOfRows === 1) {
    return {
      first: 0,
      last: 0,
      firstRowPos: 0,
      endPos: heightExceptions.length === 0 ? rowHeight : heightExceptions[0].y2,
    };
  }
  const offset = scrollTop;
  const offset2 = offset + clientHeight;

  function indexOf(pos: number, indexShift: number) {
    return Math.min(numberOfRows - 1, indexShift + Math.max(0, Math.floor(pos / rowHeight)));
  }

  function calc(offsetShift: number, indexShift: number) {
    const shifted = offset - offsetShift;
    const shifted2 = offset2 - offsetShift;

    const first = indexOf(shifted, indexShift);
    const last = indexOf(shifted2, indexShift);

    const firstRowPos = offsetShift + (first - indexShift) * rowHeight;
    const endPos = offsetShift + (last + 1 - indexShift) * rowHeight;

    // if (!isGuess) {
    //  console.log(first, '@', firstRowPos, last, '#', end, offset, offset2, firstRowPos <= offset, offset2 <= end);
    // }
    // console.assert(
    //   !isGuess || !(firstRowPos > offset || (endPos < offset2 && last < numberOfRows - 1)),
    //   'error',
    //   isGuess,
    //   firstRowPos,
    //   endPos,
    //   offset,
    //   offset2,
    //   indexShift,
    //   offsetShift
    // );
    return { first, last, firstRowPos, endPos };
  }

  const r = calc(0, 0);
  if (heightExceptions.length === 0) {
    // uniform
    return r;
  }
  if (r.last < heightExceptions[0].index) {
    // console.log('before the first exception = uniform with no shift');
    // console.log(r.first, '@', r.firstRowPos, r.last, '#', r.end, offset, offset2, r.firstRowPos <= offset, offset2 <= r.end);
    return r;
  }
  if (r.last === heightExceptions[0].index && heightExceptions[0].height > rowHeight) {
    return Object.assign(r, { endPos: heightExceptions[0].y2 });
  }

  // the position where the exceptions ends
  const lastPos = heightExceptions[heightExceptions.length - 1];
  if (offset >= lastPos.y) {
    const rest = calc(lastPos.y2, lastPos.index + 1);
    if (offset < lastPos.y2) {
      // include me
      return Object.assign(rest, {
        first: lastPos.index,
        firstRowPos: lastPos.y,
      });
    }
    return rest;
  }
  // we have some exceptions
  const visible: IRowHeightException[] = [];
  let closest = heightExceptions[0]; // closest before not in range
  for (const item of heightExceptions) {
    const { y, y2 } = item;
    if (y >= offset2) {
      break;
    }
    if (y2 <= offset) {
      closest = item;
      continue;
    }
    visible.push(item);
  }

  if (visible.length === 0) {
    // console.log('we are in the between some exceptions and none are visible');
    return calc(closest.y2, closest.index + 1); // skip myself
  }

  {
    // console.log('we show at least one exception');
    const firstException = visible[0];
    const lastException = visible[visible.length - 1];

    const first = Math.max(0, firstException.index - Math.max(0, Math.ceil((firstException.y - offset) / rowHeight)));
    let last = lastException.index;
    if (offset2 >= lastException.y2) {
      last = indexOf(offset2 - lastException.y2, lastException.index + 1);
    }
    const firstRowPos = firstException.y - (firstException.index - first) * rowHeight;
    const endPos = lastException.y2 + (last - lastException.index) * rowHeight;

    // console.log(first, '@', firstRowPos, last, '#', end, offset, offset2, firstRowPos <= offset, offset2 <= end);

    // console.assert(
    //   firstRowPos <= offset && (endPos >= offset2 || last === numberOfRows - 1),
    //   'error',
    //   firstRowPos,
    //   endPos,
    //   offset,
    //   offset2,
    //   firstException,
    //   lastException
    // );
    return { first, last, firstRowPos, endPos };
  }
}

export function frozenDelta(
  current: number[],
  target: number[]
): { added: number[]; removed: number[]; common: number } {
  const currentLength = current.length;
  const targetLength = target.length;
  if (currentLength === 0) {
    return { added: target, removed: [], common: 0 };
  }
  if (targetLength === 0) {
    return { added: [], removed: current, common: 0 };
  }
  if (currentLength === targetLength) {
    // since sorted and left increasing true
    return { added: [], removed: [], common: currentLength };
  }
  const removed = current.slice(Math.min(targetLength, currentLength));
  const added = target.slice(Math.min(targetLength, currentLength));
  return { added, removed, common: currentLength - removed.length };
}

export function updateFrozen(
  old: number[],
  columns: { frozen: boolean }[],
  first: number
): { target: number[]; added: number[]; removed: number[] } {
  const oldLast = old.length === 0 ? 0 : old[old.length - 1] + 1;
  const added: number[] = [];
  const removed: number[] = [];

  for (let i = old.length - 1; i >= 0; i -= 1) {
    const index = old[i];
    if (index >= first) {
      removed.push(old.pop()!);
    } else {
      // can stop since sorted and it will never happen again
      break;
    }
  }
  // added
  for (let i = oldLast; i < first; i += 1) {
    if (columns[i].frozen) {
      added.push(i);
      old.push(i);
    }
  }
  return { target: old, added, removed };
}
