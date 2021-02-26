# LineUpEngine

[![License: MIT][mit-image]][mit-url] [![NPM version][npm-image]][npm-url] [Github Actions][github-actions-image]][github-actions-url]

a fast engine for rendering large tables consisting of rows, rows+columns, multiple rows+columns instances.

## Supported Browsers

- latest Chrome (best performance)
- Firefox ESR

## Installation

Develop Version:

```html
<script src="https://lineupengine.js.org/develop/lineupengine.min.js"></script>
```

## Usage

**TODO**

## API Documentation

see [Develop API documentation](https://lineupengine.js.org/develop/docs)

## Development Environment

**Installation**

```sh
git clone https://github.com/lineupjs/lineupengine.git
cd lineupengine
npm i -g yarn
yarn set version latest
cat .yarnrc_patch.yml >> .yarnrc.yml
yarn install
yarn pnpify --sdk vscode
```

### Common commands

```sh
yarn clean
yarn compile
yarn test
yarn lint
yarn fix
yarn build
yarn docs
yarn release
yarn release:pre
```

## Notes

```
firefox max DOM height: 17.800.000px < 17899999px
edge max DOM height: 10000000px < 1099999px

scrollHeight
chrome:  33.554.431px translate + height
firefox: 17.895.566px marginTop + height
edge:    3.033.917px height
```

[npm-image]: https://badge.fury.io/js/lineupengine.svg
[npm-url]: https://npmjs.org/package/lineupengine
[mit-image]: https://img.shields.io/badge/License-MIT-yellow.svg
[mit-url]: https://opensource.org/licenses/MIT
[github-actions-image]: https://github.com/lineupjs/lineupengine/workflows/ci/badge.svg
[github-actions-url]: https://github.com/lineupjs/lineupengine/actions
