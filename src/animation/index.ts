/**
 * Created by Samuel Gratzl on 04.10.2017.
 */
import {IExceptionContext} from '../logic';
import KeyFinder from './KeyFinder';

export interface IAnimationItem {
  mode: 'update'|'create'|'create_add'|'remove'|'remove_delete';
  node: HTMLElement;
  key: string;

  previous: {
    index: number|-1;
    y: number;
    height: number|null;
  },
  /**
   * position of the added node
   */
  nodeY: number;
  current: {
    index: number|-1;
    y: number;
    height: number|null;
  }
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
    apply(item: Readonly<IAnimationItem>) {
      item.node.dataset.animate = item.mode;
      item.node.style.transform = `translate(0, ${item.previous.y - item.nodeY}px)`;
      item.node.style.opacity = item.mode === 'create_add' ? '0' : null;
    }
  },
  {
    delay: 100, // after some delay for the before phase have been applied visually
    apply(item: Readonly<IAnimationItem>) {
      // null for added/update sinc alredy at th eright position
      item.node.style.transform = item.mode.startsWith('remove') ? `translate(0, ${item.current.y - item.nodeY}px)` : null;
      item.node.style.height = item.current.height !== null ? `${item.current.height}px` : null;
      item.node.style.opacity = item.mode === 'remove_delete' ? '0' : null;
    }
  },
  {
    delay: 3100, // cleanup
    apply(item: Readonly<IAnimationItem>) {
      delete item.node.dataset.animate;
      item.node.style.opacity = null;
      item.node.style.transform = null;
    }
  }
];
