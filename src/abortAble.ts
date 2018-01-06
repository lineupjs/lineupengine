export interface IAbortAblePromise<T> extends Promise<T | symbol> {
  abort(): void;
}

export const ABORTED = Symbol('aborted');

/**
 * abort able Promise wrapper, returns a promise which can be aborted, and trying to avoid executing therefore the wrapped promise
 * @param {Promise<T>} loader
 * @returns {any}
 */
export default function abortAble<T>(loader: Promise<T>) {
  return {
    then<TResult1>(onfulfilled: ((value: T) => TResult1 | PromiseLike<TResult1>)): IAbortAblePromise<TResult1> {
      let aborted: ((v: symbol) => void) | null = null;
      const isAborted = () => aborted === null;
      const aborter = new Promise<symbol>((resolve) => aborted = resolve);
      const fullfiller = loader.then((r) => {
        if (isAborted()) {
          return ABORTED;
        }
        return Promise.resolve(onfulfilled(r)).then((r) => isAborted() ? ABORTED : r);
      });
      const p = Promise.race<TResult1 | symbol>([aborter, fullfiller]);
      return {
        abort: (): void => {
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

/**
 * checked whether the given argument is an abortable Promise
 * @param {IAbortAblePromise<any> | void | null | undefined} abortAble
 * @returns {boolean}
 */
export function isAbortAble(abortAble: IAbortAblePromise<any> | void | undefined | null): abortAble is IAbortAblePromise<any> {
  return abortAble !== undefined && abortAble !== null && abortAble && typeof abortAble.then === 'function' && typeof abortAble.abort === 'function';
}
