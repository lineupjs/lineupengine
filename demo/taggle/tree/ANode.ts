import {INode, InnerNode} from './';


export abstract class ANode {
  parent: InnerNode | null = null;

  get isFirstChild() {
    return this.parent && this.parent.children[0] === <any>this;
  }

  get isLastChild() {
    return this.parent && this.parent.children[this.parent.children.length - 1] === <any>this;
  }

  get index() {
    return this.parent ? this.parent.children.indexOf(<any>this) : -1;
  }

  get path() {
    const r: INode[] = [];
    let a: INode = <any>this;
    while (a) {
      r.push(a);
      a = a.parent;
    }
    return r;
  }


  toPathString() {
    return this.path.reverse().join('.');
  }
}

export default ANode;
