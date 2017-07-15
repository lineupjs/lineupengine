/// <reference types="jasmine" />
import abortAble, {ABORTED, isAbortAble} from '../src/abortAble';


function resolveIn<T>(ms: number, result: T = null) {
  return new Promise<T>((resolve) => {
    setTimeout(resolve.bind(this, result), ms);
  });
}

describe('utils', () => {
  describe('abortAble', () => {
    it('default', () => {
      expect(typeof abortAble).toEqual('function');
    });
    it('good', () => {
      const a = abortAble(Promise.resolve(1)).then((v) => v * 10);
      return a.then((r) => expect(r).toBe(10));
    });
    it('aborted afterwards', () => {
      const a = abortAble(Promise.resolve(1)).then((v) => v * 10);
      a.abort();
      return a.then((r) => expect(r).toBe(ABORTED));
    });
    it('aborted before', () => {
      const a = abortAble(resolveIn(100, 1)).then((v) => v * 10);
      a.abort();
      return a.then((r) => expect(r).toBe(ABORTED));
    });
    it('good async', () => {
      const a = abortAble(resolveIn(100, 1)).then((v) => v * 10);
      return a.then((r) => expect(r).toBe(10));
    });
    it('aborted before not called', () => {
      const a = abortAble(resolveIn(100, 1)).then(() => Promise.reject('should not be called'));
      resolveIn(10).then(() => a.abort());
      return a.then((r) => expect(r).toBe(ABORTED));
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
