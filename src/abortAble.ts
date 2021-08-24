export function isPromiseLike(p: PromiseLike<unknown> | unknown): p is PromiseLike<unknown> {
  return p != null && typeof (p as PromiseLike<unknown>).then === 'function';
}

/**
 * a promise like object that has an abort method
 */
export interface IAbortAblePromiseBase<T> extends PromiseLike<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): IAbortAblePromiseBase<TResult1 | TResult2>;
  /**
   * abort the promise when possible
   */
  abort(): void;
  /**
   * whether this promise was aborted
   */
  isAborted(): boolean;
}

/**
 * a promise like object that has an abort method and return the ABORTED symbol in case it was
 */
export declare type IAbortAblePromise<T> = IAbortAblePromiseBase<T | symbol>;
export declare type IAAP<T> = IAbortAblePromise<T>;

/**
 * an update result with an item and a promise when the update has been done
 */
export interface IAsyncUpdate<T> {
  item: T;
  ready: IAbortAblePromise<void>;
}

/**
 * the symbol returned when the promise was aborted
 */
export const ABORTED = Symbol('aborted');

function thenFactory<T>(loader: PromiseLike<T | symbol>, isAborted: () => boolean, abort: () => void) {
  function then<TResult1 = T | symbol, TResult2 = never>(
    onfulfilled?: ((value: T | symbol) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): IAbortAblePromiseBase<TResult1 | TResult2> {
    const fullfiller = loader.then((loaded) => {
      const loadedOrAborted = isAborted() ? ABORTED : loaded;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = onfulfilled ? onfulfilled(loadedOrAborted) : (loadedOrAborted as unknown as any);

      if (isPromiseLike(res)) {
        return res.then((r) => {
          return isAborted() ? ABORTED : r;
        });
      }
      return isAborted() ? ABORTED : res;
    });
    return {
      then: thenFactory(fullfiller, isAborted, abort),
      abort,
      isAborted,
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
  const aborter = new Promise<symbol>((resolve) => {
    aborted = resolve;
  });
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
    abort,
    isAborted,
  };
}

export function abortAbleFetch(input: RequestInfo, init?: RequestInit): IAAP<Response> {
  const controller = new AbortController();

  const race = new Promise<Response | symbol>((resolve, reject) => {
    const r = fetch(input, { signal: controller.signal, ...(init || {}) });
    r.then(resolve);
    r.catch((error) => {
      if (error instanceof DOMException) {
        resolve(ABORTED);
      } else {
        reject(error);
      }
    });
  });

  const abort = controller.abort.bind(controller);
  const isAborted = () => controller.signal.aborted;

  return {
    then: thenFactory(race, isAborted, abort),
    abort,
    isAborted,
  };
}

export function abortAbleAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
  values: [
    T1 | IAAP<T1>,
    T2 | IAAP<T2>,
    T3 | IAAP<T3>,
    T4 | IAAP<T4>,
    T5 | IAAP<T5>,
    T6 | IAAP<T6>,
    T7 | IAAP<T7>,
    T8 | IAAP<T8>,
    T9 | IAAP<T9>,
    T10 | IAAP<T10>
  ]
): IAAP<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]>;
export function abortAbleAll<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
  values: [
    T1 | IAAP<T1>,
    T2 | IAAP<T2>,
    T3 | IAAP<T3>,
    T4 | IAAP<T4>,
    T5 | IAAP<T5>,
    T6 | IAAP<T6>,
    T7 | IAAP<T7>,
    T8 | IAAP<T8>,
    T9 | IAAP<T9>
  ]
): IAAP<[T1, T2, T3, T4, T5, T6, T7, T8, T9]>;
export function abortAbleAll<T1, T2, T3, T4, T5, T6, T7, T8>(
  values: [
    T1 | IAAP<T1>,
    T2 | IAAP<T2>,
    T3 | IAAP<T3>,
    T4 | IAAP<T4>,
    T5 | IAAP<T5>,
    T6 | IAAP<T6>,
    T7 | IAAP<T7>,
    T8 | IAAP<T8>
  ]
): IAAP<[T1, T2, T3, T4, T5, T6, T7, T8]>;
export function abortAbleAll<T1, T2, T3, T4, T5, T6, T7>(
  values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>, T4 | IAAP<T4>, T5 | IAAP<T5>, T6 | IAAP<T6>, T7 | IAAP<T7>]
): IAAP<[T1, T2, T3, T4, T5, T6, T7]>;
export function abortAbleAll<T1, T2, T3, T4, T5, T6>(
  values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>, T4 | IAAP<T4>, T5 | IAAP<T5>, T6 | IAAP<T6>]
): IAAP<[T1, T2, T3, T4, T5, T6]>;
export function abortAbleAll<T1, T2, T3, T4, T5>(
  values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>, T4 | IAAP<T4>, T5 | IAAP<T5>]
): IAAP<[T1, T2, T3, T4, T5]>;
export function abortAbleAll<T1, T2, T3, T4>(
  values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>, T4 | IAAP<T4>]
): IAAP<[T1, T2, T3, T4]>;
export function abortAbleAll<T1, T2, T3>(values: [T1 | IAAP<T1>, T2 | IAAP<T2>, T3 | IAAP<T3>]): IAAP<[T1, T2, T3]>;
export function abortAbleAll<T1, T2>(values: [T1 | IAAP<T1>, T2 | IAAP<T2>]): IAAP<[T1, T2]>;
export function abortAbleAll<T>(values: (T | IAAP<T>)[]): IAAP<T[]>;

/**
 * similar to Promise.all but for abortAble
 */
export function abortAbleAll(values: unknown[]): IAAP<unknown[]> {
  const loader = Promise.all(values);
  let aborted: ((v: symbol) => void) | null = null;
  const isAborted = () => aborted === null;
  const aborter = new Promise<symbol>((resolve) => {
    aborted = resolve;
  });
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
  const race = Promise.race<unknown | symbol>([aborter, loader]);

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then: thenFactory(race, isAborted, abort) as any,
    abort,
    isAborted,
  };
}

/**
 * checked whether the given argument is an abortable Promise
 * @param {IAbortAblePromise<any> | any} candidate
 * @returns {boolean}
 */
export function isAbortAble<T = unknown>(candidate: IAbortAblePromise<T> | T): candidate is IAbortAblePromise<T> {
  return (
    candidate != null &&
    candidate &&
    typeof (candidate as IAbortAblePromise<unknown>).then === 'function' &&
    typeof (candidate as IAbortAblePromise<unknown>).abort === 'function'
  );
}

export function isAsyncUpdate<T>(update: T | void | undefined | null | IAsyncUpdate<T>): update is IAsyncUpdate<T> {
  return update !== undefined && update !== null && update && isAbortAble((update as IAsyncUpdate<T>).ready);
}

/**
 * similar to Promise.resolve
 */
export function abortAbleResolveNow<T>(value: T): IAAP<T> {
  function then<TResult1 = T | symbol, TResult2 = never>(
    onfulfilled?: ((value: T | symbol) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): IAbortAblePromiseBase<TResult1 | TResult2> {
    const res = onfulfilled ? onfulfilled(value) : (value as unknown);
    if (isAbortAble(res)) {
      return res as unknown as IAbortAblePromiseBase<TResult1 | TResult2>;
    }
    if (isPromiseLike(res)) {
      return abortAble(res) as unknown as IAbortAblePromiseBase<TResult1 | TResult2>;
    }
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: abortAbleResolveNow(res as TResult1) as any,
      abort: () => undefined,
      isAborted: () => false,
    };
  }
  return {
    then,
    abort: () => undefined,
    isAborted: () => false,
  };
}
