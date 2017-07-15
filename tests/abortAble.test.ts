/// <reference types="jasmine" />
import abortAble, {ABORTED, isAbortAble} from '../src/abortAble';

describe('utils', () => {
  it('abortAble', () => {
    expect(typeof abortAble).toEqual('function');
  });
});
