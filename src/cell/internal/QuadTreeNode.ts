abstract class AQuadTreeNode {
  parent: QuadTreeInnerNode | null = null;

  constructor(public readonly index: number, public readonly rowFirst: number, public readonly rowLast: number, public readonly colFirst: number, public readonly colLast: number, public readonly rowTotal: number, public readonly colTotal: number) {

  }

  get rowCount() {
    //since inclusive
    return this.rowLast - this.rowFirst + 1;
  }

  get colCount() {
    return this.colLast - this.colFirst + 1;
  }

  get width() {
    return this.rowTotal;
  }

  get height() {
    return this.colTotal;
  }

  get area() {
    switch (this.index) {
      case 0:
        return `1 / 1`;
      case 1:
        return `1 / 2`;
      case 2:
        return `2 / 1`;
      case 3:
        return `2 / 2`;
    }
    return '1 / 1';
  }

  get rowId() {
    let id = this.index < 2 ? '0' : '1';
    let p = this.parent;
    while (p !== null) {
      id = `${p.index < 2 ? '0' : '1'}${id}`;
      p = p.parent;
    }
    return id;
  }

  get colId() {
    let id = this.index % 2 === 0 ? '0' : '1';
    let p = this.parent;
    while (p !== null) {
      id = `${p.index % 2 === 0 ? '0' : '1'}${id}`;
      p = p.parent;
    }
    return id;
  }

  get id() {
    let id = '${this.index}';
    let p = this.parent;
    while (p !== null) {
      id = `${p.index}-${id}`;
      p = p.parent;
    }
    return id;
  }
}


export class QuadTreeLeafNode extends AQuadTreeNode {
  readonly type = 'leaf';
}

export const TOP_LEFT = 0;
export const TOP_RIGHT = 1;
export const BOTTOM_LEFT = 2;
export const BOTTOM_RIGHT = 3;

export class QuadTreeInnerNode extends AQuadTreeNode {
  readonly type = 'inner';
  /**
   * 0 | 1
   * 2 | 3
   */
  readonly children: QuadTreeNode[] = [];

  get colMiddle() {
    return Math.floor(this.colFirst + this.colCount / 2) - 1;
  }

  get rowMiddle() {
    return Math.floor(this.rowFirst + this.rowCount / 2) - 1;
  }
}

type QuadTreeNode = QuadTreeInnerNode | QuadTreeLeafNode;
export default QuadTreeNode;
