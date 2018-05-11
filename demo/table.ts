import {ACellRenderer, ICellRenderContext, PrefetchMixin, uniformContext, ACellTableSection} from '../src';
import {Column} from './column';
import MultiTableRowRenderer from '../src/table/MultiTableRowRenderer';

/** @internal */
export class TestRenderer extends ACellTableSection<Column<number>> {
  protected _context: ICellRenderContext<Column<number>>;

  build(numberOfColumns = 10, numberOfRows = 1000, defaultRowHeight = 20) {
    const columns: Column<number>[] = [];
    for (let i = 0; i < numberOfColumns; ++i) {
      columns.push(new Column(i, i.toString(36), false));
    }
    this._context = Object.assign({
      columns,
      column: uniformContext(columns.length, 100),
    }, uniformContext(numberOfRows, defaultRowHeight));
    return this;
  }

  get id() {
    return 'test';
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

  protected get context() {
    return this._context;
  }

  protected updateRow(node: HTMLElement, index: number) {
    //return abortAble(resolveIn(2000)).then(() => {
    super.updateRow(node, index);
    //});
  }
}


export default function run(node: HTMLElement, id: string) {
  const table = new MultiTableRowRenderer(node, id);


  table.pushTable((header, body, id, style) => new TestRenderer(header, body, id, style).build());
  table.pushTable((header, body, id, style) => new TestRenderer(header, body, id, style).build());
}
