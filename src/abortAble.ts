

export interface IAbortAblePromise<T> extends Promise<T|symbol> {
  abort();
}

export const ABORTED = Symbol('aborted');

export default function abortAble<T>(loader: Promise<T>) {
  return {
    then<TResult1 = T>(onfulfilled: ((value: T) => TResult1 | PromiseLike<TResult1>)): IAbortAblePromise<TResult1> {
      let aborted: (v: symbol)=>void = null;
      const isAborted = () => aborted === null;
      const aborter = new Promise<symbol>((resolve) => aborted = resolve);
      const checkAbort = (r) => isAborted() ? ABORTED : r;
      const fullfiller = loader.then((r) => {
        if (isAborted()) {
          return ABORTED;
        }
        return Promise.resolve(onfulfilled(r)).then(checkAbort);
      });
      const p = Promise.race<TResult1|symbol>([aborter, fullfiller]);
      return {
        abort: () => {
          if (aborted !== null) {
            aborted(ABORTED);
            aborted = null;
          }
        },
        then: p.then.bind(p),
        catch: p.catch.bind(p),
        [Symbol.toStringTag]: p[Symbol.toStringTag]
      };
    }
  };
}

export function isAbortAble(abortAble: IAbortAblePromise<any>|void|undefined|null) {
  return abortAble !== undefined && abortAble !== null && abortAble && typeof abortAble.then === 'function' && typeof abortAble.abort === 'function';
}
