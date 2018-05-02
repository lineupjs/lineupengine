/**
 * column base interface
 */
export interface IColumn {
  readonly index: number;
  readonly id: string;
  readonly width: number;
  /**
   * boolean flag whether when scrolling the column should be sticky
   */
  readonly frozen: boolean;
}
