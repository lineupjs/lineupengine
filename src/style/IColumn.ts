/**
 * Created by Samuel Gratzl on 26.09.2017.
 */

export interface IColumn {
  readonly index: number;
  readonly id: string;
  readonly width: number;
  readonly frozen: boolean;
}
