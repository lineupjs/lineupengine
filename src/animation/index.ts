/**
 * Created by Samuel Gratzl on 04.10.2017.
 */
import {IExceptionContext} from '../logic';
import KeyFinder from './KeyFinder';

export {default as KeyFinder} from './KeyFinder';

export enum EAnimationMode {
  UPDATE,
  UPDATE_CREATE,
  UPDATE_REMOVE,
  SHOW,
  HIDE
}

export interface IAnimationItem {
  mode: EAnimationMode;
  node: HTMLElement;
  key: string;

  previous: {
    index: number | -1;
    y: number;
    height: number | null;
  };
  /**
   * position of the added node
   */
  nodeY: number;
  current: {
    index: number | -1;
    y: number;
    height: number | null;
  };
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

export const defaultPhases = [
  {
    delay: 0, // before
    apply({mode, previous, nodeY, node}: Readonly<IAnimationItem>) {
      node.dataset.animation = EAnimationMode[mode].toLowerCase();
      node.style.transform = `translate(0, ${previous.y - nodeY}px)`;
      node.style.opacity = mode === EAnimationMode.SHOW ? '0' : (mode === EAnimationMode.HIDE ? '1' : null);
    }
  },
  {
    delay: 100, // after some delay for the before phase have been applied visually
    apply({mode, current, nodeY, node}: Readonly<IAnimationItem>) {
      // null for added/update since already at the right position
      node.style.transform = (mode === EAnimationMode.HIDE || mode === EAnimationMode.UPDATE_REMOVE) ? `translate(0, ${current.y - nodeY}px)` : null;
      node.style.height = current.height !== null ? `${current.height}px` : null;
      node.style.opacity = mode === EAnimationMode.SHOW  ? '1' : (mode === EAnimationMode.HIDE ? '0' : null);
    }
  },
  {
    delay: 3100, // cleanup
    apply({node}: Readonly<IAnimationItem>) {
      // delete node.dataset.animation;
      delete node.style.opacity;
      delete node.style.transform;
    }
  }
];
