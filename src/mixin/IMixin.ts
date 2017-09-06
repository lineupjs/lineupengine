/**
 * Created by Samuel Gratzl on 19.07.2017.
 */
import {IExceptionContext} from '../logic';

export enum EScrollResult {
  NONE,
  ALL,
  PARTIAL
}

export interface IMixinAdapter {
  readonly visible: {
    //writable
    first: number;
    last: number;
    forcedFirst: number;
    forcedLast: number;
  };
  readonly visibleFirstRowPos: number;

  readonly context: IExceptionContext;
  readonly scroller: HTMLElement;

  addAtBeginning(from: number, to: number, frozenShift: number): void;

  addAtBottom(from: number, to: number): void;

  removeFromBeginning(from: number, to: number, frozenShift: number): void;

  removeFromBottom(from: number, to: number): void;

  updateOffset(firstRowPos: number): void;

  /**
   * @param {number} first
   * @return {number} frozenShift
   */
  syncFrozen?(first: number): number;
}

export interface IMixin {
  onScrolled(isGoingDown: boolean, scrollResult: EScrollResult): void;
}

export interface IMixinClass {
  new(adapter: IMixinAdapter, options?: any): IMixin;
}
