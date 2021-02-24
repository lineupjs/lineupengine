/* eslint-env node */

module.exports = {
  preset: 'ts-jest',
  testRegex: '((\\.|/)(test|spec))\\.[jt]sx?$',
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.test.json',
      diagnostics: true,
      babelConfig: false
    }
  }
};
