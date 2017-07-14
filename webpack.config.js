/* *****************************************************************************
 * Caleydo - Visualization for Molecular Biology - http://caleydo.org
 * Copyright (c) The Caleydo Team. All rights reserved.
 * Licensed under the new BSD license, available at http://caleydo.org/license
 **************************************************************************** */

const {libraryAliases, libraryExternals, modules, entries, ignores, type} = require('./.yo-rc.json')['generator-phovea'];
const resolve = require('path').resolve;
const pkg = require('./package.json');
const webpack = require('webpack');
const fs = require('fs');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const now = new Date();
const prefix = (n) => n < 10 ? ('0' + n) : n.toString();
const buildId = `${now.getUTCFullYear()}${prefix(now.getUTCMonth() + 1)}${prefix(now.getUTCDate())}-${prefix(now.getUTCHours())}${prefix(now.getUTCMinutes())}${prefix(now.getUTCSeconds())}`;
pkg.version = pkg.version.replace('SNAPSHOT', buildId);

const year = (new Date()).getFullYear();
const banner = '/*! ' + (pkg.title || pkg.name) + ' - v' + pkg.version + ' - ' + year + '\n' +
  (pkg.homepage ? '* ' + pkg.homepage + '\n' : '') +
  '* Copyright (c) ' + year + ' ' + pkg.author.name + ';' +
  ' Licensed ' + pkg.license + '*/\n';


//list of loaders and their mappings
const webpackloaders = [
  {test: /\.scss$/, loader: 'style-loader!css-loader!sass-loader'},
  {test: /\.tsx?$/, loader: 'awesome-typescript-loader'},
  {test: /\.json$/, loader: 'json-loader'},
  {
    test: /\.(png|jpg)$/,
    loader: 'url-loader',
    query: {
      limit: 10000, //inline <= 10kb
    }
  },
  {
    test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
    loader: 'url-loader',
    query: {
      limit: 10000, //inline <= 10kb
      mimetype: 'application/font-woff'
    }
  },
  {
    test: /\.svg(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
    loader: 'url-loader',
    query: {
      limit: 10000, //inline <= 10kb
      mimetype: 'image/svg+xml'
    }
  },
  {test: /\.(ttf|eot)(\?v=[0-9]\.[0-9]\.[0-9])?$/, loader: 'file-loader'}
];

/**
 * generate a webpack configuration
 */
function generateWebpack(options) {
  let base = {
    entry: options.entries,
    output: {
      path: resolve(__dirname, 'build'),
      filename: (options.name || (pkg.name + (options.bundle ? '_bundle' : ''))) + (options.min && !options.nosuffix ? '.min' : '') + '.js',
      chunkFilename: '[chunkhash].js',
      publicPath: '' //no public path = relative
    },
    resolve: {
      // Add `.ts` and `.tsx` as a resolvable extension.
      extensions: ['.webpack.js', '.web.js', '.ts', '.tsx', '.js'],
      alias: Object.assign({}, options.libs || {}),
      //fallback to the directory above if they are siblings just in the workspace context
      modules: ['node_modules']
    },
    plugins: [
      //define magic constants that are replaced
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(options.isProduction ? 'production': 'development'),
        __VERSION__: JSON.stringify(pkg.version),
        __LICENSE__: JSON.stringify(pkg.license),
        __BUILD_ID__: buildId,
        __DEBUG__: options.isDev || options.isTest,
        __TEST__: options.isTest,
        __PRODUCTION__: options.isProduction,
        __APP_CONTEXT__: JSON.stringify('/')
      })
      //rest depends on type
    ],
    externals: [],
    module: {
      loaders: webpackloaders.slice()
    },
    devServer: {
      proxy: {
        '/api/*': {
          target: 'http://localhost:9000',
          secure: false,
          ws: true
        },
        '/login': {
          target: 'http://localhost:9000',
          secure: false
        },
        '/logout': {
          target: 'http://localhost:9000',
          secure: false
        },
        '/loggedinas': {
          target: 'http://localhost:9000',
          secure: false
        }
      },
      contentBase: resolve(__dirname, 'build'),
      watchOptions: {
        aggregateTimeout: 500,
        ignored: /node_modules/
      }
    },
    watchOptions: {
      aggregateTimeout: 500,
      ignored: /node_modules/
    }
  };

  if (options.isProduction) {
	  base.plugins.unshift(new webpack.BannerPlugin({
        banner: banner,
        raw: true
      }));
	  base.plugins.push(new webpack.optimize.MinChunkSizePlugin({
			minChunkSize: 10000 //at least 10.000 characters
		  }),
		  new webpack.optimize.AggressiveMergingPlugin());
  }

  if (options.library) {
    let libName = /phovea_.*/.test(pkg.name) ? ['phovea', pkg.name.slice(7)] : pkg.name;
    //generate a library, i.e. output the last entry element
    //create library name
    if (options.moduleBundle) {
      libName = 'phovea';
    }
    base.output.library = libName;
    base.output.libraryTarget = 'umd';
    base.output.umdNamedDefine = false; //anonymous require module
  }


  if (!options.bundle) {
    //if we don't bundle don't include external libraries and other phovea modules
    base.externals.push(...(options.externals || Object.keys(options.libs || {})));

    //ignore extra modules
    (options.ignore || []).forEach(function (d) {
      base.module.loaders.push({test: new RegExp(d), loader: 'null-loader'}); //use null loader
    });
  }
  if (!options.bundle || options.isApp) {
    //extract the included css file to own file
    let p = new ExtractTextPlugin({
      filename: (options.isApp || options.moduleBundle ? 'style' : pkg.name)  + (options.min && !options.nosuffix ? '.min' : '') + '.css',
      allChunks: true // there seems to be a bug in dynamically loaded chunk styles are not loaded, workaround: extract all styles from all chunks
    });
    base.plugins.push(p);
    base.module.loaders[0] = {
      test: /\.scss$/,
      loader: p.extract(['css-loader', 'sass-loader'])
    };
  }
  if (options.isApp) {
    // create manifest
    // base.plugins.push(new webpack.optimize.AppCachePlugin());
  }
  if (options.commons) {
    //build a commons plugin
    base.plugins.push(new webpack.optimize.CommonsChunkPlugin({
      // The order of this array matters
      names: ['common'],
      minChunks: 2
    }));
  }
  if (options.min) {
    //use a minifier
    base.plugins.push(
      new webpack.LoaderOptionsPlugin({
        minimize: true,
        debug: false
      }),
      new webpack.optimize.UglifyJsPlugin({
        compress: {
          warnings: false
        },
        output: {
          comments: false
        },
        sourceMap: false
      }));
  } else {
    //generate source maps
    base.devtool = 'source-map';
  }
  return base;
}

function generateWebpackConfig(env) {
  const isTest = env === 'test';
  const isProduction = env === 'prod';
  const isDev = !isProduction && !isTest;

  const base = {
    entries: entries,
    libs: libraryAliases,
    externals: libraryExternals,
    modules: modules,
    ignore: ignores,
    isProduction: isProduction,
    isDev: isDev,
    isTest: isTest
  };

  if (isTest) {
    return generateWebpack(Object.assign({}, base, {
      bundle: true
    }));
  }

  if (type.startsWith('app')) {
    base.isApp = true;
    base.bundle = true; //bundle everything together
    base.name = '[name]'; //multiple entries case
    base.commons = true; //extract commons module
  } else if (type === 'bundle') {
    base.library = true; //expose as library
    base.moduleBundle = true; //expose as library 'phovea'
    base.name = pkg.name; //to avoid adding _bundle
    base.bundle = true;
  } else { //type === 'lib'
    base.library = true;
  }

  //single generation
  if (isDev) {
    return generateWebpack(base);
  } else if (type.startsWith('app')) { //isProduction app
    return generateWebpack(Object.assign({}, base, {
        min: true,
        nosuffix: true
      }));
  } else { //isProduction
    return [
      //plain
      generateWebpack(base),
      //minified
      generateWebpack(Object.assign({}, base, {
        min: true
      }))
    ];
  }
}

module.exports = generateWebpackConfig;
module.exports.generateWebpack = generateWebpack;
