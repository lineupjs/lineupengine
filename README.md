LineUpEngine  [![License: MIT][mit-image]][mit-url] [![NPM version][npm-image]][npm-url]  [![CircleCI][ci-image]][ci-url] 
============

a fast engine for rendering large tables consisting of rows, rows+columns, multiple rows+columns instances. 

Supported Browsers
------------------

 * latest Chrome (best performance)
 * Firefox Quantum
 * Edge 16

Development Environment
-----------------------

**Installation**

```bash
git clone https://github.com/sgratzl/lineupengine.git
cd lineupengine
npm install
```

**Build distribution packages**

```bash
npm run build
```

**Run Linting**

```bash
npm run lint
```


**Watch file changes**

```bash
npm run watch
```

Notes
-----

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
[ci-image]: https://circleci.com/gh/sgratzl/lineupengine.svg?style=svg
[ci-url]: https://circleci.com/gh/sgratzl/lineupengine
