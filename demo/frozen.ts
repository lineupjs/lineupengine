 
import { ACellRenderer, ICellRenderContext, uniformContext, nonUniformContext } from '../src';
import Column from './column';

/** @internal */
export default class TestRenderer extends ACellRenderer<Column<number>> {
  protected readonly privateContext: ICellRenderContext<Column<number>>;

  constructor(root: HTMLElement, id: string, numberOfRows = 1000, numberOfColumns = 15) {
    super(root, `#${id}`, { mixins: [], striped: true });
     
    root.id = id;

    const defaultRowHeight = 20;

    const columns: Column<number>[] = [];
    for (let i = 0; i < numberOfColumns; i += 1) {
      columns.push(new Column(i, i.toString(36), i < 2, i > 3 ? 500 : 100));
    }
    this.privateContext = {
      columns,
      column: nonUniformContext(
        columns.map((d) => d.width),
        100
      ),
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
