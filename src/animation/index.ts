/**
 * Created by Samuel Gratzl on 04.10.2017.
 */
import {IExceptionContext} from '../logic';
import KeyFinder from './KeyFinder';

export interface IPhase {
  readonly name: string;
  readonly delay: number;
}

export interface IAnimationContext {
  readonly previous: IExceptionContext;

  previousKey(previousRowIndex: number): string;

  currentKey(currentRowIndex: number): string;

  appearPosition?(currentRowIndex: number, previousFinder: KeyFinder): number;

  removePosition?(previousRowIndex: number, currentFinder: KeyFinder): number;

  animate?(row: HTMLElement, currentRowIndex: number, previousRowIndex: number, phase: IPhase): void;

  removeAnimate?(row: HTMLElement, currentRowIndex: number, previousRowIndex: number, phase: IPhase): void;

  phases?: IPhase[];
}

const BEFORE_PHASE: IPhase = {
  name: 'before',
  delay: 0
};

const phases = [
  {name: 'before', delay: 0},
  {name: 'after', delay: 200},
  {name: 'cleanup', delay: 3100}
];

export interface IAnimationInfo {
  mode: 'update'|'create'|'remove';
  node: HTMLElement;

  previous: {
    index: number|-1;
    y: number|null;
    height: number|null;
  },
  current: {
    index: number|-1;
    y: number|null;
    height: number|null;
  }
}
