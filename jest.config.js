/* eslint-env node */

module.exports = {
  preset: 'ts-jest',
  testRegex: 'tests/.*\\.spec\\.(ts|tsx|js)$',
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.test.json',
      // diagnostics: true,
      // babelConfig: false,
    },
  },
};
