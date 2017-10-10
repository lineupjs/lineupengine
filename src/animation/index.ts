/**
 * Created by Samuel Gratzl on 04.10.2017.
 */
import {IExceptionContext} from '../logic';
import KeyFinder from './KeyFinder';

export interface IAnimationContext {
  previous: IExceptionContext;

  previousKey(previousRowIndex: number): string;

  currentKey(currentRowIndex: number): string;

  appearPosition?(currentRowIndex: number, previousFinder: KeyFinder): number;

  removePosition?(previousRowIndex: number, currentFinder: KeyFinder): number;

  animate?(row: HTMLElement, currentRowIndex: number, previousRowIndex: number, phase: 'before'|'after'|'cleanup'): void;

  removeAnimate?(row: HTMLElement, currentRowIndex: number, previousRowIndex: number, phase: 'before'|'after'|'cleanup'): void;

  cleanUpAfter?: number;
}


export interface IAnimationInfo {
  node: HTMLElement;
  target: number;
  currentIndex: number;
  previousIndex: number;
}
