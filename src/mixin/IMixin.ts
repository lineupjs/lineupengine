/**
 * Created by Samuel Gratzl on 19.07.2017.
 */
import {IExceptionContext} from '../logic';

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

  addAtBeginning(from: number, to: number): void;
  addAtBottom(from: number, to: number): void;

  removeFromBeginning(from: number, to: number): void;
  removeFromBottom(from: number, to: number): void;

  updateOffset(firstRowPos: number): void;
}

export interface IMixin {
  onScrolled(isGoingDown: boolean, scrollResult: 'full' | 'partial'): void;
}

export interface IMixinClass {
    new(adapter: IMixinAdapter, options?: any): IMixin;
}
