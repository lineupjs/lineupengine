

export interface IAbortAblePromise<T> extends Promise<T|symbol> {
  abort();
}

export const ABORTED = Symbol('aborted');

export default function abortAble<T>(loader: Promise<T>) {
  return {
    then<TResult1 = T>(onfulfilled: ((value: T) => TResult1 | PromiseLike<TResult1>)): IAbortAblePromise<TResult1> {
      let aborted: (v: symbol)=>void;
      const aborter = new Promise<symbol>((resolve) => aborted = resolve);
      const p = Promise.race<TResult1|symbol>([aborter, loader.then(onfulfilled)]);
      return {
        abort: () => aborted(ABORTED),
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
