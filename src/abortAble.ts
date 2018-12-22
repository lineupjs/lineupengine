export function isPromiseLike(p: PromiseLike<any> | any): p is PromiseLike<any> {
  return p != null && p && typeof p.then === 'function';
}

export interface IAbortAblePromiseBase<T> extends PromiseLike<T> {
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): IAbortAblePromiseBase<TResult1 | TResult2>;
  abort(): void;
}

export declare type IAbortAblePromise<T> = IAbortAblePromiseBase<T | symbol>;
export declare type IAAP<T> = IAbortAblePromise<T>;


export interface IAsyncUpdate<T> {
  item: T;
  ready: IAbortAblePromise<void>;
}

export const ABORTED = Symbol('aborted');

function thenFactory<T>(loader: PromiseLike<T | symbol>, isAborted: () => boolean, abort: () => void) {
  function then<TResult1 = T | symbol, TResult2 = never>(onfulfilled?: ((value: T | symbol) => TResult1 | PromiseLike<TResult1>) | undefined | null, _onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): IAbortAblePromiseBase<TResult1 | TResult2> {
    const fullfiller = loader.then((loaded) => {
      const loadedOrAborted = isAborted() ? ABORTED : loaded;
      const res = onfulfilled ? onfulfilled(loadedOrAborted) : <any>loadedOrAborted;

      if (isPromiseLike(res)) {
        return res.then((r) => {
          return isAborted() ? ABORTED : r;
        });
      }
      return isAborted() ? ABORTED : res;
    });
    return {
      then: thenFactory(fullfiller, isAborted, abort),
      abort
    };
  }
  return then;
}

/**
 * abort able Promise wrapper, returns a promise which can be aborted, and trying to avoid executing therefore the wrapped promise
 * @param {Promise<T>} loader
 * @returns {any}
 */
export default function abortAble<T>(loader: PromiseLike<T>): IAAP<T> {
  let aborted: ((v: symbol) => void) | null = null;
  const isAborted = () => aborted === null;
  const aborter = new Promise<symbol>((resolve) => aborted = resolve);
  const abort = () => {
    if (aborted == null) {
      return;
    }
    aborted(ABORTED);
    aborted = null;
  };

  const race = Promise.race<T | symbol>([aborter, loader]);

  return {
    then: thenFactory(race, isAborted, abort),
    abort
  };
}

export function abortAbleAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>, T4 | IAAP<T4>, T5 | IAAP<T5>, T6 | IAAP<T6>, T7 | IAAP<T7>, T8 | IAAP<T8>, T9 | IAAP<T9>, T10 | IAAP<T10>]): IAAP<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]>;
export function abortAbleAll<T1, T2, T3, T4, T5, T6, T7, T8, T9>(values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>, T4 | IAAP<T4>, T5 | IAAP<T5>, T6 | IAAP<T6>, T7 | IAAP<T7>, T8 | IAAP<T8>, T9 | IAAP<T9>]): IAAP<[T1, T2, T3, T4, T5, T6, T7, T8, T9]>;
export function abortAbleAll<T1, T2, T3, T4, T5, T6, T7, T8>(values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>, T4 | IAAP<T4>, T5 | IAAP<T5>, T6 | IAAP<T6>, T7 | IAAP<T7>, T8 | IAAP<T8>]): IAAP<[T1, T2, T3, T4, T5, T6, T7, T8]>;
export function abortAbleAll<T1, T2, T3, T4, T5, T6, T7>(values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>, T4 | IAAP<T4>, T5 | IAAP<T5>, T6 | IAAP<T6>, T7 | IAAP<T7>]): IAAP<[T1, T2, T3, T4, T5, T6, T7]>;
export function abortAbleAll<T1, T2, T3, T4, T5, T6>(values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>, T4 | IAAP<T4>, T5 | IAAP<T5>, T6 | IAAP<T6>]): IAAP<[T1, T2, T3, T4, T5, T6]>;
export function abortAbleAll<T1, T2, T3, T4, T5>(values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>, T4 | IAAP<T4>, T5 | IAAP<T5>]): IAAP<[T1, T2, T3, T4, T5]>;
export function abortAbleAll<T1, T2, T3, T4>(values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>, T4 | IAAP<T4>]): IAAP<[T1, T2, T3, T4]>;
export function abortAbleAll<T1, T2, T3>(values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>]): IAAP<[T1, T2, T3]>;
export function abortAbleAll<T1, T2>(values: [T1 | IAAP<T1>, T2 | IAAP<T2>]): IAAP<[T1, T2]>;
export function abortAbleAll<T>(values: (T | IAAP<T>)[]): IAAP<T[]>;

export function abortAbleAll(values: any[]): IAAP<any[]> {
  const loader = Promise.all(values);
  let aborted: ((v: symbol) => void) | null = null;
  const isAborted = () => aborted === null;
  const aborter = new Promise<symbol>((resolve) => aborted = resolve);
  const abort = () => {
    if (aborted == null) {
      return;
    }
    aborted(ABORTED);
    for (const v of values) {
      if (isAbortAble(v)) {
        v.abort();
      }
    }
    aborted = null;
  };
  const race = Promise.race<any | symbol>([aborter, loader]);

  return {
    then: thenFactory(race, isAborted, abort),
    abort
  };
}

/**
 * checked whether the given argument is an abortable Promise
 * @param {IAbortAblePromise<any> | any} abortAble
 * @returns {boolean}
 */
export function isAbortAble(abortAble: IAbortAblePromise<any> | any): abortAble is IAbortAblePromise<any> {
  return abortAble != null && abortAble && typeof abortAble.then === 'function' && typeof abortAble.abort === 'function';
}


export function isAsyncUpdate<T>(update: T | void | undefined | null | IAsyncUpdate<T>): update is IAsyncUpdate<T> {
  return update !== undefined && update !== null && update && isAbortAble((<IAsyncUpdate<T>>update).ready);
}

export function abortAbleResolveNow<T>(value: T) {
  function then<TResult1 = T | symbol, TResult2 = never>(onfulfilled?: ((value: T | symbol) => TResult1 | PromiseLike<TResult1>) | undefined | null, _onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): IAbortAblePromiseBase<TResult1 | TResult2> {
    const res = onfulfilled ? onfulfilled(value) : <any>value;
    if (isAbortAble(res)) {
      return res;
    }
    if (isPromiseLike(res)) {
      return abortAble(res);
    }
    return {
      then: <any>abortAbleResolveNow(<TResult1>res),
      abort: () => undefined
    };
  }
  return {
    then,
    abort: () => undefined
  };
}
