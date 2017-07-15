/// <reference types="jasmine" />
import {ABORTED, isAbortAble, abortAble} from '../src/utils';

describe('utils', () => {
  it('abortAble', () => {
    expect(typeof abortAble).toEqual('function');
  });
});
