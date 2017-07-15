
export interface IRowHeightException {
  readonly index: number;
  readonly height: number;
  readonly y: number;
  readonly y2: number;
}

class RowHeightException implements IRowHeightException {
  constructor(public readonly index: number, public readonly y: number, public readonly height: number) {

  }

  get y2() {
    return this.y + this.height;
  }
}

export interface IRowHeightExceptionLookup {
  keys(): IterableIterator<number>;
  get(index: number): number;
  has(index: number): boolean;
  readonly size: number;
}

export interface IExceptionContext {
  exceptions: IRowHeightException[];
  exceptionsLookup: IRowHeightExceptionLookup;
  totalHeight: number;
}

export function uniformContext(numberOfRows: number, rowHeight: number): IExceptionContext {
  const arr: number[] = [];
  const exceptionsLookup = {
    keys: () => arr.values(),
    get: () => rowHeight,
    has: () => false,
    size: 0
  };
  return {exceptions: [], exceptionsLookup, totalHeight: numberOfRows * rowHeight};
}

export function nonUniformContext(rowHeights: { forEach: (callback: (height: number, index: number)=>any)=>any}, defaultRowHeight: number): IExceptionContext {
  const exceptionsLookup = new Map<number, number>();
  const exceptions: IRowHeightException[] = [];

  let prev = -1, acc = 0, totalHeight = 0;
  rowHeights.forEach((height, index) => {
    totalHeight += height;
    if (height === defaultRowHeight) {
      //regular
      return;
    }
    exceptionsLookup.set(index, height);
    const between = (index - prev - 1) * defaultRowHeight;
    prev = index;
    const y = acc + between;
    acc = y + height;
    exceptions.push(new RowHeightException(index, y, height));
  });
  return {exceptionsLookup, exceptions, totalHeight};
}

export function randomContext(numberOfRows: number, defaultRowHeight: number, minRowHeight = 2, maxRowHeight = defaultRowHeight * 10, ratio = 0.2, seed = Date.now()) {
  let actSeed = seed;
  const random  = () => {
    const x = Math.sin(actSeed++) * 10000;
    return x - Math.floor(x);
  };


  const getter = () => {
    const coin = random();
    if (coin < ratio) {
      //non uniform
      return minRowHeight  + Math.round(random() * (maxRowHeight - minRowHeight));
    }
    return defaultRowHeight;
  };
  const forEach = (callback: (height: number, index: number)=>any) => {
    for(let index = 0; index < numberOfRows; ++index) {
      callback(getter(), index);
    }
  };
  return nonUniformContext({forEach}, defaultRowHeight);
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
   * position of the last visible row includings its size
   */
  readonly endPos: number;
}

/**
 * computes the visible range
 */
export function range(scrollTop: number, clientHeight: number, rowHeight: number, heightExceptions: IRowHeightException[], numberOfRows: number): IVisibleRange {
  const offset = scrollTop;
  const offset2 = offset + clientHeight;

  function indexOf(pos: number, indexShift: number) {
    return Math.min(numberOfRows - 1, indexShift + Math.max(0, Math.floor(pos / rowHeight)));
  }

  function calc(offsetShift: number, indexShift: number, isGuess: boolean = false) {
    const shifted = offset - offsetShift;
    const shifted2 = offset2 - offsetShift;

    const first = indexOf(shifted, indexShift);
    const last = indexOf(shifted2, indexShift);

    const firstRowPos = offsetShift + (first - indexShift) * rowHeight;
    const endPos = offsetShift + (last + 1 - indexShift) * rowHeight;

    //if (!isGuess) {
    //  console.log(first, '@', firstRowPos, last, '#', end, offset, offset2, firstRowPos <= offset, offset2 <= end);
    //}
    console.assert(!(!isGuess && (firstRowPos > offset || endPos < offset2)));
    return {first, last, firstRowPos, endPos};
  }

  const r = calc(0, 0, true);
  if (heightExceptions.length === 0) {
    //uniform
    return r;
  }
  if (r.last <= heightExceptions[0].index) {
    if (r.last === heightExceptions[0].index) {
      return Object.assign(r, { endPos: heightExceptions[0].y2});
    }
    //console.log('before the first exception = uniform with no shift');
    //console.log(r.first, '@', r.firstRowPos, r.last, '#', r.end, offset, offset2, r.firstRowPos <= offset, offset2 <= r.end);
    return r;
  }
  //the position where the exceptions ends
  const lastPos = heightExceptions[heightExceptions.length - 1];
  if (offset >= lastPos.y) {
    const rest = calc(lastPos.y2, lastPos.index + 1);
    if (offset < lastPos.y2) {
      // include me
      return Object.assign(rest, { first: lastPos.index, firstRowPos: lastPos.y});
    } else {
      return rest;
    }
  }
  //we have some exceptions
  const visible: IRowHeightException[] = [];
  let closest = heightExceptions[0]; //closest before not in range
  for (const item of heightExceptions) {
    const {y, y2} = item;
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
    //console.log('we are in the between some exceptions and none are visible');
    return calc(closest.y2, closest.index + 1); //skip myself
  }

  {
    //console.log('we show at least one exception');
    const firstException = visible[0];
    const lastException = visible[visible.length - 1];

    const first = Math.max(0, firstException.index - Math.max(0, Math.ceil((firstException.y - offset) / rowHeight)));
    let last = lastException.index;
    if (offset2 >= lastException.y2) {
      last = indexOf(offset2 - lastException.y2, lastException.index + 1);
    }
    const firstRowPos = firstException.y - (firstException.index - first) * rowHeight;
    const endPos = lastException.y2 + (last - lastException.index) * rowHeight;

    //console.log(first, '@', firstRowPos, last, '#', end, offset, offset2, firstRowPos <= offset, offset2 <= end);

    console.assert(!(firstRowPos > offset || endPos < offset2));
    return {first, last, firstRowPos, endPos};
  }
}
