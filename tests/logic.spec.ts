import {
  IRowHeightException,
  IRowHeightExceptionLookup,
  IVisibleRange,
  nonUniformContext,
  randomContext,
  range,
  uniformContext,
} from '../src/logic';

describe('logic', () => {
  function expectException(ex: IRowHeightException, index: number, y: number, height: number) {
    expect(ex.index).toBe(index);
    expect(ex.y).toBe(y);
    expect(ex.height).toBe(height);
    expect(ex.y2).toBe(y + height);
  }

  function expectExceptionLookup(ex: IRowHeightExceptionLookup, index: number, height: number) {
    expect(ex.has(index)).toBe(true);
    expect(ex.get(index)).toBe(height);
    expect(ex.size).toBeGreaterThanOrEqual(1);
  }

  function expectExceptionLookups(ex: IRowHeightExceptionLookup, ...indexAndHeight: number[]) {
    expect(indexAndHeight.length % 2).toBe(0); //even

    const checks = indexAndHeight.reduce((acc, indexOrHeight, i) => {
      const isIndex = i % 2 === 0;
      if (isIndex) {
        acc.push({ index: indexOrHeight, height: 0 });
      } else {
        acc[acc.length - 1].height = indexOrHeight;
      }
      return acc;
    }, [] as { index: number; height: number }[]);

    expect(ex.size).toBe(checks.length);

    for (const check of checks) {
      expectExceptionLookup(ex, check.index, check.height);
    }
  }

  describe('uniformContext', () => {
    it('function', () => {
      expect(typeof uniformContext).toBe('function');
    });
    it('regular', () => {
      const { exceptions, exceptionsLookup, totalHeight } = uniformContext(10, 5);
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
      const { exceptions, exceptionsLookup, totalHeight } = nonUniformContext(new Array(10).fill(5), 5);
      expect(totalHeight).toBe(10 * 5);
      expect(exceptions.length).toBe(0);
      expect(exceptionsLookup.size).toBe(0);
    });
    it('first', () => {
      const data = new Array(10).fill(5);
      data[0] = 10;
      const { exceptions, exceptionsLookup, totalHeight } = nonUniformContext(data, 5);
      expect(totalHeight).toBe(10 * 5 + 5);
      expect(exceptions.length).toBe(1);
      expectException(exceptions[0], 0, 0, 10);
      expect(exceptionsLookup.size).toBe(1);
      expectExceptionLookups(exceptionsLookup, 0, 10);
    });
    it('third', () => {
      const data = new Array(10).fill(5);
      data[2] = 10;
      const { exceptions, exceptionsLookup, totalHeight } = nonUniformContext(data, 5);
      expect(totalHeight).toBe(10 * 5 + 5);

      expect(exceptions.length).toBe(1);
      expectException(exceptions[0], 2, 10, 10);
      expectExceptionLookups(exceptionsLookup, 2, 10);
    });
    it('multiple', () => {
      const data = new Array(10).fill(5);
      data[2] = 6;
      data[5] = 7;
      const { exceptions, exceptionsLookup, totalHeight } = nonUniformContext(data, 5);
      expect(totalHeight).toBe(10 * 5 + 1 + 2);

      expect(exceptions.length).toBe(2);
      expectException(exceptions[0], 2, 10, 6);
      expectException(exceptions[1], 5, 26, 7);
      expectExceptionLookups(exceptionsLookup, 2, 6, 5, 7);
    });
  });

  describe('randomContext', () => {
    it('function', () => {
      expect(typeof randomContext).toBe('function');
    });
    //TODO
  });

  function expectRange(r: IVisibleRange, first: number, last: number, firstRowPos: number, endPos: number) {
    expect(r.first).toBe(first);
    expect(r.last).toBe(last);
    expect(r.firstRowPos).toBe(firstRowPos);
    expect(r.endPos).toBe(endPos);
  }

  describe('range', () => {
    it('function', () => {
      expect(typeof range).toBe('function');
    });

    const rowHeight = 5;
    const numberOfRows = 10;
    const lastIndex = numberOfRows - 1;

    describe('uniform', () => {
      const { exceptions, totalHeight } = uniformContext(numberOfRows, rowHeight);

      it('single0', () => {
        expectRange(range(0, 0, rowHeight, exceptions, numberOfRows), 0, 0, 0, rowHeight);
        expectRange(range(0, 4, rowHeight, exceptions, numberOfRows), 0, 0, 0, rowHeight);
      });
      it('singleLast', () => {
        const lastRowPos = rowHeight * (numberOfRows - 1);
        expectRange(
          range(totalHeight, 0, rowHeight, exceptions, numberOfRows),
          lastIndex,
          lastIndex,
          lastRowPos,
          lastRowPos + rowHeight
        );
        expectRange(
          range(totalHeight - 5, 4, rowHeight, exceptions, numberOfRows),
          lastIndex,
          lastIndex,
          lastRowPos,
          lastRowPos + rowHeight
        );
      });

      it('full', () => {
        expectRange(range(0, totalHeight, rowHeight, exceptions, numberOfRows), 0, lastIndex, 0, totalHeight);
        expectRange(range(0, totalHeight - 5, rowHeight, exceptions, numberOfRows), 0, lastIndex, 0, totalHeight);
        expectRange(range(4, totalHeight - 5, rowHeight, exceptions, numberOfRows), 0, lastIndex, 0, totalHeight);
      });

      it('shift', () => {
        expectRange(range(5, totalHeight, rowHeight, exceptions, numberOfRows), 1, lastIndex, rowHeight, totalHeight);
        expectRange(
          range(0, totalHeight - 6, rowHeight, exceptions, numberOfRows),
          0,
          lastIndex - 1,
          0,
          totalHeight - rowHeight
        );
      });

      it('center', () => {
        expectRange(range(18, 18, rowHeight, exceptions, numberOfRows), 3, 7, 3 * rowHeight, 8 * rowHeight);
      });
    });

    describe('nonUniform', () => {
      describe('single', () => {
        const data = new Array(numberOfRows).fill(rowHeight);
        data[3] = rowHeight + 1;
        const { exceptions, totalHeight } = nonUniformContext(data, rowHeight);

        it('single0', () => {
          expectRange(range(0, 0, rowHeight, exceptions, numberOfRows), 0, 0, 0, rowHeight);
          expectRange(range(0, 4, rowHeight, exceptions, numberOfRows), 0, 0, 0, rowHeight);
        });

        it('beforeWith', () => {
          expectRange(range(0, 15, rowHeight, exceptions, numberOfRows), 0, 3, 0, 4 * rowHeight + 1);
          expectRange(range(0, 22, rowHeight, exceptions, numberOfRows), 0, 4, 0, 5 * rowHeight + 1);
        });

        it('after', () => {
          expectRange(range(21, 8, rowHeight, exceptions, numberOfRows), 4, 5, 4 * rowHeight + 1, 6 * rowHeight + 1);
        });

        it('afterWith', () => {
          expectRange(range(20, 9, rowHeight, exceptions, numberOfRows), 3, 5, 3 * rowHeight, 6 * rowHeight + 1);
        });

        it('full', () => {
          expectRange(range(0, totalHeight, rowHeight, exceptions, numberOfRows), 0, lastIndex, 0, totalHeight);
          expectRange(range(0, totalHeight - 5, rowHeight, exceptions, numberOfRows), 0, lastIndex, 0, totalHeight);
          expectRange(range(4, totalHeight - 5, rowHeight, exceptions, numberOfRows), 0, lastIndex, 0, totalHeight);
        });
      });

      describe('multiple', () => {
        const data = new Array(numberOfRows).fill(rowHeight);
        data[3] = rowHeight + 1;
        data[7] = rowHeight + 1;
        const { exceptions, totalHeight } = nonUniformContext(data, rowHeight);

        const ex3Middle = exceptions[0].y + 1;
        const ex7Middle = exceptions[1].y + 1;

        it('betweenOutOut', () => {
          expectRange(
            range(ex3Middle - 3, ex7Middle - 3 - (ex3Middle - 3), rowHeight, exceptions, numberOfRows),
            2,
            6,
            2 * rowHeight,
            7 * rowHeight + 1
          );
        });

        it('betweenInOut', () => {
          expectRange(
            range(ex3Middle, ex7Middle - 3 - ex3Middle, rowHeight, exceptions, numberOfRows),
            3,
            6,
            3 * rowHeight,
            7 * rowHeight + 1
          );
        });

        it('betweenInIn', () => {
          expectRange(
            range(ex3Middle, ex7Middle - ex3Middle, rowHeight, exceptions, numberOfRows),
            3,
            7,
            3 * rowHeight,
            8 * rowHeight + 1 + 1
          );
        });

        it('betweenOutIn', () => {
          expectRange(
            range(ex3Middle - 3, ex7Middle - (ex3Middle - 3), rowHeight, exceptions, numberOfRows),
            2,
            7,
            2 * rowHeight,
            8 * rowHeight + 1 + 1
          );
        });

        it('full', () => {
          expectRange(range(0, totalHeight, rowHeight, exceptions, numberOfRows), 0, lastIndex, 0, totalHeight);
          expectRange(range(0, totalHeight - 5, rowHeight, exceptions, numberOfRows), 0, lastIndex, 0, totalHeight);
          expectRange(range(4, totalHeight - 5, rowHeight, exceptions, numberOfRows), 0, lastIndex, 0, totalHeight);
        });
      });
    });
  });
});
