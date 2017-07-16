import {INode, InnerNode} from './';


export abstract class ANode {
  parent: InnerNode | null = null;

  get isFirstChild() {
    return (this.parent && this.parent.children[0] === <any>this) || !this.parent;
  }

  get isLastChild() {
    return (this.parent && this.parent.children[this.parent.children.length - 1] === <any>this) || !this.parent;
  }

  get index() {
    return this.parent ? this.parent.children.indexOf(<any>this) : -1;
  }

  get level() {
    if (this.parent === null) {
      return 0;
    }
    return this.parent.level + 1;
  }

  get parents() {
    const r: InnerNode[] = [];
    let a = this.parent;
    while (a != null) {
      r.push(a);
      a = a.parent;
    }
    return r;
  }

  get path() {
    const r: INode[] = [];
    let a: INode = <any>this;
    while (a != null) {
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
