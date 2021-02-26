/* eslint-env node */

module.exports = {
  preset: 'ts-jest',
  testRegex: '/tests/.*\\.spec\\.(ts|tsx|js)$',
  haste: {
    throwOnModuleCollision: false,
  },
  modulePathIgnorePatterns: ['node_modules/terser', 'node_modules/jest-runner'],
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.test.json',
      // diagnostics: true,
      // babelConfig: false,
    },
  },
};
