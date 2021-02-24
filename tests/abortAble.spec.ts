import abortAble, { ABORTED, isAbortAble } from '../src/abortAble';

function resolveIn<T>(this: any, ms: number, result?: T) {
  return new Promise<T>((resolve) => {
    self.setTimeout(resolve.bind(this, result), ms);
  });
}

describe('utils', () => {
  describe('abortAble', () => {
    it('default', () => {
      expect(typeof abortAble).toEqual('function');
    });
    it('simple', () => {
      const a = abortAble(Promise.resolve(1));
      return a.then((r) => expect(r).toBe(1));
    });
    it('resolve simple', () => {
      const a = abortAble(resolveIn(10, 1));
      return a.then((r) => expect(r).toBe(1));
    });
    it('simple abort', () => {
      const a = abortAble(Promise.resolve(1));
      a.abort();
      return a.then((r) => expect(r).toBe(ABORTED));
    });
    it('resolve abort', () => {
      const a = abortAble(resolveIn(10, 1));
      a.abort();
      return a.then((r) => expect(r).toBe(ABORTED));
    });
    it('resolve abort lazy', () => {
      const a = abortAble(resolveIn(10, 1));
      resolveIn(1).then(() => a.abort());
      return a.then((r) => expect(r).toBe(ABORTED));
    });
    it('resolve abort lazy to late', () => {
      const a = abortAble(resolveIn(10, 1));
      resolveIn(100).then(() => a.abort());
      return a.then((r) => expect(r).toBe(1));
    });
    it('resolve chain', () => {
      const a = abortAble(resolveIn(10, 1));
      const b = a.then((v) => (typeof v === 'symbol' ? v : v * 10));
      return b.then((r) => expect(r).toBe(10));
    });
    it('resolve chain abort', () => {
      const a = abortAble(resolveIn(10, 1));
      a.abort();
      const b = a.then((v) => (typeof v === 'symbol' ? v : v * 10));
      return b.then((r) => expect(r).toBe(ABORTED));
    });
    it('resolve chain abort2', () => {
      const a = abortAble(resolveIn(10, 1));
      const b = a.then((v) => (typeof v === 'symbol' ? v : v * 10));
      b.abort();
      return b.then((r) => expect(r).toBe(ABORTED));
    });
  });

  it('isAbortAble', () => {
    expect(typeof isAbortAble).toBe('function');
    expect(isAbortAble(null)).toBe(false);
    expect(isAbortAble(undefined)).toBe(false);
    expect(isAbortAble(<any>Promise.resolve(false))).toBe(false);
    expect(isAbortAble(abortAble(Promise.resolve(false)).then(() => true))).toBe(true);
  });
});
