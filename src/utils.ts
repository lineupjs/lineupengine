

export interface IAbortAblePromise<T> extends Promise<T|symbol> {
  abort();
}

export const ABORTED = Symbol('aborted');

export function abortAble<T>(loader: Promise<T>) {
  return {
    then<TResult1 = T>(onfulfilled: ((value: T) => TResult1 | PromiseLike<TResult1>)): IAbortAblePromise<TResult1> {
      let aborted = false;
      const p = loader.then<TResult1|symbol>((loaded: T) => {
        if (aborted) {
          return ABORTED;
        }
        return onfulfilled(loaded);
      });
      return {
        abort: () => aborted = true,
        then: p.then.bind(p),
        catch: p.catch.bind(p),
        [Symbol.toStringTag]: p[Symbol.toStringTag]
      };
    }
  };
}

export function isAbortAble(abortAble: IAbortAblePromise<any>|void|undefined|null) {
  return abortAble !== undefined && abortAble !== null && abortAble && typeof abortAble.then === 'function';
}
