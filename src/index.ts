
import {mixin} from 'phovea_core/src';

export interface IHelloOptions {
  name?: string;
}

export function hello(options?: IHelloOptions) {
  //merge with default options
  options = mixin({
    name: 'World'
  }, options);
  return `Hello ${options.name}`;
}
