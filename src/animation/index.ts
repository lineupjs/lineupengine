import {IExceptionContext} from '../logic';
import KeyFinder from './KeyFinder';

export {default as KeyFinder} from './KeyFinder';

/**
 * different row animation modes
 */
export enum EAnimationMode {
  /**
   * plain update existed both before and after
   */
  UPDATE,
  /**
   * exists both before and after but wasn't visible yet thus waas created
   */
  UPDATE_CREATE,
  /**
   * exists both before and after is visible but not needed anymore and thus removed
   */
  UPDATE_REMOVE,
  /**
   * row appears
   */
  SHOW,
  /**
   * row disappears
   */
  HIDE
}

/**
 * animated row item
 */
export interface IAnimationItem {
  mode: EAnimationMode;
  node: HTMLElement;
  key: string;

  /**
   * previous context information
   */
  previous: {
    index: number | -1;
    y: number;
    height: number | null;
  };

  /**
   * position of the added node considering the previous height
   */
  nodeY: number;
  /**
   * position of the added node considering the current height
   */
  nodeYCurrentHeight: number;

  /**
   * current position
   */
  current: {
    index: number | -1;
    y: number;
    height: number | null;
  };
}

const NO_CHANGE_DELTA = 1;

export function noAnimationChange({previous, mode, nodeY, current}: IAnimationItem, previousHeight: number, currentHeight: number) {
  // sounds like the same
  const prev = previous.height == null ? previousHeight : previous.height;
  const curr = current.height == null ? currentHeight : current.height;
  return mode === EAnimationMode.UPDATE && (Math.abs(previous.y - nodeY) <= NO_CHANGE_DELTA) && (Math.abs(prev - curr) <= NO_CHANGE_DELTA);
}

export interface IPhase {
  readonly delay: number;

  apply(item: Readonly<IAnimationItem>, previousFinder: KeyFinder, currentFinder: KeyFinder): void;
}

export interface IAnimationContext {
  readonly previous: IExceptionContext;

  previousKey(previousRowIndex: number): string;

  currentKey(currentRowIndex: number): string;

  phases?: IPhase[];
}

/**
 * maximal duration of all animations + extra waiting before e.g. rows are really removed
 * @type {number}
 */
const MAX_ANIMATION_TIME = 1100;

export const defaultPhases = [
  {
    delay: 0, // before
    apply({mode, previous, nodeY, current, node}: Readonly<IAnimationItem>) {
      node.dataset.animation = EAnimationMode[mode].toLowerCase();
      node.style.transform = `translate(0, ${previous.y - nodeY}px)`;
      if (mode === EAnimationMode.SHOW) {
        // already target height
        node.style.height = current.height !== null ? `${current.height}px` : null;
      } else { // always set previous height for default height changes
        node.style.height = `${previous.height}px`;
      }
      node.style.opacity = mode === EAnimationMode.SHOW ? '0' : (mode === EAnimationMode.HIDE ? '1' : null);
    }
  },
  {
    delay: 10, // after some delay for the before phase have been applied visually
    apply({mode, current, nodeY, node}: Readonly<IAnimationItem>) {
      // null for added/update since already at the right position
      node.style.transform = (mode === EAnimationMode.HIDE || mode === EAnimationMode.UPDATE_REMOVE) ? `translate(0, ${current.y - nodeY}px)` : null;
      if (mode !== EAnimationMode.HIDE) { // keep height for removal
        node.style.height = current.height !== null ? `${current.height}px` : null;
      }
      node.style.opacity = mode === EAnimationMode.SHOW ? '1' : (mode === EAnimationMode.HIDE ? '0' : null);
    }
  },
  {
    delay: MAX_ANIMATION_TIME, // cleanup
    apply({node}: Readonly<IAnimationItem>) {
      delete node.dataset.animation;
      node.style.opacity = null;
      node.style.transform = null;
    }
  }
];
