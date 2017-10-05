/**
 * Created by Samuel Gratzl on 04.10.2017.
 */
import {IExceptionContext} from '../logic';

export interface IAnimationContext {
  previous: IExceptionContext;

  previousKey(previousRowIndex: number): string;

  currentKey(currentRowIndex: number): string;

  appearPosition?(currentRowIndex: number): number;

  removePosition?(previousRowIndex: number): number;

  animate?(row: HTMLElement, currentRowIndex: number, phase: 'before'|'after'): void;

  removeAnimate?(row: HTMLElement, previousRowIndex: number, phase: 'before'|'after'|'cleanup'): void;

  cleanUpAfter?: number;
}
