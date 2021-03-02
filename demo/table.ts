/* eslint-disable class-methods-use-this */
import { ICellRenderContext, uniformContext, ACellTableSection } from '../src';
import Column from './column';
import MultiTableRowRenderer from '../src/table/MultiTableRowRenderer';

/** @internal */
export class TestRenderer extends ACellTableSection<Column<number>> {
  protected privateContext: ICellRenderContext<Column<number>>;

  id: string;

  build(id: string, numberOfColumns = 15, numberOfRows = 1000, defaultRowHeight = 20): this {
    this.id = id;
    const columns: Column<number>[] = [];
    for (let i = 0; i < numberOfColumns; i += 1) {
      columns.push(new Column(i, `${id}${i.toString(36)}`, false)); // i === 0));
    }
    this.privateContext = {
      columns,
      column: uniformContext(columns.length, 100),
      ...uniformContext(numberOfRows, defaultRowHeight),
    };
    return this;
  }

  protected createHeader(document: Document, column: Column<number>): HTMLElement {
    return column.header(document);
  }

  protected updateHeader(): void {
    // nothing do to
  }

  protected createCell(document: Document, index: number, column: Column<number>): HTMLElement {
    return column.cell(index, document);
  }

  protected updateCell(node: HTMLElement, index: number, column: Column<number>): HTMLElement {
    return column.update(node, index);
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

export default function run(node: HTMLElement, rootId: string): void {
  const table = new MultiTableRowRenderer(node, rootId);

  table.pushTable((header, body, id, style) => new TestRenderer(header, body, id, style).build('a'));
  table.pushTable((header, body, id, style) => new TestRenderer(header, body, id, style).build('b'));
}
