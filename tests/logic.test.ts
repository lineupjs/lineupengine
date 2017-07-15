/// <reference types="jasmine" />
import {uniformContext} from '../src/logic';

describe('logic', () => {
  it('uniformContext', () => {
    expect(typeof uniformContext).toBe('function');
  });
});
