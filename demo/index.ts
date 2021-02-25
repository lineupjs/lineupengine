import { ACellRenderer, ICellRenderContext, PrefetchMixin, uniformContext } from '../src';
import { Column } from './column';

/** @internal */
export default class TestRenderer extends ACellRenderer<Column<number>> {
  protected readonly _context: ICellRenderContext<Column<number>>;

  constructor(root: HTMLElement, id: string, numberOfRows = 1000, numberOfColumns = 20) {
    super(root, `#${id}`, { mixins: [PrefetchMixin], striped: true });
    root.id = id;

    const defaultRowHeight = 20;

    const columns: Column<number>[] = [];
    for (let i = 0; i < numberOfColumns; ++i) {
      columns.push(new Column(i, i.toString(36), i === 0 || i === 2));
    }
    this._context = Object.assign(
      {
        columns,
        column: uniformContext(columns.length, 100),
      },
      uniformContext(numberOfRows, defaultRowHeight)
    );
  }

  protected createHeader(document: Document, column: Column<number>) {
    return column.header(document);
  }

  protected updateHeader() {
    // nothing do to
  }

  protected createCell(document: Document, index: number, column: Column<number>) {
    return column.cell(index, document);
  }

  protected updateCell(node: HTMLElement, index: number, column: Column<number>) {
    return column.update(node, index);
  }

  run() {
    //wait till layouted
    setTimeout(super.init.bind(this), 100);
  }

  protected get context() {
    return this._context;
  }

  protected updateRow(node: HTMLElement, index: number) {
    //return abortAble(resolveIn(2000)).then(() => {
    super.updateRow(node, index);
    //});
  }
}
