/// <reference types="jasmine" />
import {
  uniformContext, nonUniformContext, range, randomContext, IRowHeightException,
  IRowHeightExceptionLookup, IVisibleRange
} from '../src/logic';

describe('logic', () => {
  function expectException(ex: IRowHeightException, index: number, y: number, height: number) {
    expect(ex.index).toBe(index, 'index failed');
    expect(ex.y).toBe(y, 'y failed');
    expect(ex.height).toBe(height, 'height failed');
    expect(ex.y2).toBe(y + height, 'y2 failed');
  }

  function expectExceptionLookup(ex: IRowHeightExceptionLookup, index: number, height: number) {
    expect(ex.has(index)).toBe(true, 'has failed');
    expect(ex.get(index)).toBe(height, 'height failed');
    expect(ex.size).toBeGreaterThanOrEqual(1, 'size failed');
  }

  function expectExceptionLookups(ex: IRowHeightExceptionLookup, ...indexAndHeight: number[]) {
    expect(indexAndHeight.length % 2).toBe(0); //even

    const checks = indexAndHeight.reduce((acc, indexOrHeight, i) => {
      const isIndex = i % 2 === 0;
      if (isIndex) {
        acc.push({index: indexOrHeight, height: null});
      } else {
        acc[acc.length - 1].height = indexOrHeight;
      }
      return acc;
    }, <{ index: number, height: number }[]>[]);

    expect(ex.size).toBe(checks.length, 'total size failed');

    for (const check of checks) {
      expectExceptionLookup(ex, check.index, check.height);
    }
  }

  describe('uniformContext', () => {
    it('function', () => {
      expect(typeof uniformContext).toBe('function');
    });
    it('regular', () => {
      const {exceptions, exceptionsLookup, totalHeight} = uniformContext(10, 5);
      expect(totalHeight).toBe(10 * 5);
      expect(exceptions.length).toBe(0);
      expect(exceptionsLookup.size).toBe(0);
    });
  });

  describe('nonUniformContext', () => {
    it('function', () => {
      expect(typeof nonUniformContext).toBe('function');
    });
    it('uniform', () => {
      const {exceptions, exceptionsLookup, totalHeight} = nonUniformContext(new Array(10).fill(5), 5);
      expect(totalHeight).toBe(10 * 5);
      expect(exceptions.length).toBe(0);
      expect(exceptionsLookup.size).toBe(0);
    });
    it('first', () => {
      const data = new Array(10).fill(5);
      data[0] = 10;
      const {exceptions, exceptionsLookup, totalHeight} = nonUniformContext(data, 5);
      expect(totalHeight).toBe(10 * 5 + 5);
      expect(exceptions.length).toBe(1);
      expectException(exceptions[0], 0, 0, 10);
      expect(exceptionsLookup.size).toBe(1);
      expectExceptionLookups(exceptionsLookup, 0, 10);
    });
    it('third', () => {
      const data = new Array(10).fill(5);
      data[2] = 10;
      const {exceptions, exceptionsLookup, totalHeight} = nonUniformContext(data, 5);
      expect(totalHeight).toBe(10 * 5 + 5);

      expect(exceptions.length).toBe(1);
      expectException(exceptions[0], 2, 10, 10);
      expectExceptionLookups(exceptionsLookup, 2, 10);
    });
    it('multiple', () => {
      const data = new Array(10).fill(5);
      data[2] = 10;
      data[5] = 20;
      const {exceptions, exceptionsLookup, totalHeight} = nonUniformContext(data, 5);
      expect(totalHeight).toBe(10 * 5 + 5 + 15);

      expect(exceptions.length).toBe(2);
      expectException(exceptions[0], 2, 10, 10);
      expectException(exceptions[1], 5, 30, 20);
      expectExceptionLookups(exceptionsLookup, 2, 10, 5, 20);
    });
  });

  describe('randomContext', () => {
    it('function', () => {
      expect(typeof randomContext).toBe('function');
    });
    //TODO
  });

  function expectRange(r: IVisibleRange, first: number, last: number, firstRowPos: number, endPos: number) {
    expect(r.first).toBe(first, 'first failed');
    expect(r.last).toBe(last, 'last failed');
    expect(r.firstRowPos).toBe(r.firstRowPos, 'firstRowsPos failed');
    expect(r.endPos).toBe(endPos, 'endPos failed');
  }

  describe('range', () => {
    it('function', () => {
      expect(typeof range).toBe('function');
    });

    const rowHeight = 5;
    const numberOfRows = 10;

    describe('uniform', () => {
      const {exceptions, totalHeight} = uniformContext(numberOfRows, rowHeight);

      it('single0', () => {
        expectRange(range(0, 0, rowHeight, exceptions, numberOfRows), 0, 0, 0, rowHeight);
        expectRange(range(0, 4, rowHeight, exceptions, numberOfRows), 0, 0, 0, rowHeight);
      });
      it('singleLast', () => {
        const lastIndex = numberOfRows - 1;
        const lastRowPos = rowHeight * (numberOfRows - 1);
        expectRange(range(totalHeight, 0, rowHeight, exceptions, numberOfRows), lastIndex, lastIndex, lastRowPos, lastRowPos + rowHeight);
        expectRange(range(totalHeight - 4, 4, rowHeight, exceptions, numberOfRows), lastIndex, lastIndex, lastRowPos, lastRowPos + rowHeight);
      });

      it('full', () => {
        expectRange(range(0, totalHeight, rowHeight, exceptions, numberOfRows), 0, numberOfRows - 1, 0, totalHeight);
        expectRange(range(0, totalHeight - 4, rowHeight, exceptions, numberOfRows), 0, numberOfRows - 1, 0, totalHeight);
        expectRange(range(4, totalHeight - 4, rowHeight, exceptions, numberOfRows), 0, numberOfRows - 1, 0, totalHeight);
      });
    });
  });
});
