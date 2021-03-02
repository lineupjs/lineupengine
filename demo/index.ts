/* eslint-disable class-methods-use-this */
import { ACellRenderer, ICellRenderContext, PrefetchMixin, uniformContext } from '../src';
import Column from './column';

/** @internal */
export default class TestRenderer extends ACellRenderer<Column<number>> {
  protected readonly privateContext: ICellRenderContext<Column<number>>;

  constructor(root: HTMLElement, id: string, numberOfRows = 1000, numberOfColumns = 20) {
    super(root, `#${id}`, { mixins: [PrefetchMixin], striped: true });
    // eslint-disable-next-line no-param-reassign
    root.id = id;

    const defaultRowHeight = 20;

    const columns: Column<number>[] = [];
    for (let i = 0; i < numberOfColumns; i += 1) {
      columns.push(new Column(i, i.toString(36), i === 0 || i === 2));
    }
    this.privateContext = {
      columns,
      column: uniformContext(columns.length, 100),
      ...uniformContext(numberOfRows, defaultRowHeight),
    };
  }

  protected createHeader(doc: Document, column: Column<number>): HTMLElement {
    return column.header(doc);
  }

  protected updateHeader(): void {
    // nothing do to
  }

  protected createCell(doc: Document, index: number, column: Column<number>): HTMLElement {
    return column.cell(index, doc);
  }

  protected updateCell(node: HTMLElement, index: number, column: Column<number>): HTMLElement {
    return column.update(node, index);
  }

  run(): void {
    // wait till layouted
    setTimeout(super.init.bind(this), 100);
  }

  protected get context(): ICellRenderContext<Column<number>> {
    return this.privateContext;
  }

  // protected updateRow(node: HTMLElement, index: number) {
  //   // return abortAble(resolveIn(2000)).then(() => {
  //   super.updateRow(node, index);
  //   // });
  // }
}
