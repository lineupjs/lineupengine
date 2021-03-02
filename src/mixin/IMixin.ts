import { IExceptionContext } from '../logic';

/**
 * scrolling result
 */
export enum EScrollResult {
  /**
   * nothing has changed
   */
  NONE,
  /**
   * all rows needed to be recreated
   */
  ALL,
  /**
   * unknown
   */
  SOME,
  /**
   * some rows are added at the bottom
   */
  SOME_BOTTOM,
  /**
   * some rows are added at the top
   */
  SOME_TOP,
}

/**
 * adapter context for mixins to avoid public fields
 */
export interface IMixinAdapter {
  readonly visible: {
    // writable
    first: number;
    last: number;
    forcedFirst: number;
    forcedLast: number;
  };
  readonly visibleFirstRowPos: number;

  readonly context: IExceptionContext;
  readonly scrollOffset: number;
  readonly scrollTotal: number;

  addAtBeginning(from: number, to: number, frozenShift: number): void;

  addAtBottom(from: number, to: number): void;

  removeFromBeginning(from: number, to: number, frozenShift: number): void;

  removeFromBottom(from: number, to: number): void;

  updateOffset(firstRowPos: number): void;

  /**
   * triggers to sync frozen items
   * @param {number} first
   * @return {number} frozenShift
   */
  syncFrozen?(first: number): number;

  isScrollEventWaiting(): boolean;
}

export interface IMixin {
  onScrolled(isGoingDown: boolean, scrollResult: EScrollResult): void;
}

export interface IMixinClass {
  new (adapter: IMixinAdapter, options?: unknown): IMixin;
}
