import { readFileSync } from 'fs';
import gulp from 'gulp';
import webpackStream from 'webpack-stream';
import autoprefixer from 'autoprefixer';
import browserSyncModule from 'browser-sync';
import camelCase from 'camelcase';
import colors from 'ansi-colors';
import concat from 'gulp-concat';
import { deleteAsync } from 'del';
import dependencies from './dependencies-injector.js';
import fs from 'fs';
import log from 'fancy-log';
import postcss from 'gulp-postcss';
import terser from 'gulp-terser';
import cleanCSS from 'gulp-clean-css';
import gulpSass from 'gulp-sass';
import * as dartSass from 'sass-embedded';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const browserSync = browserSyncModule.create();
const sass = gulpSass(dartSass);

/**
 * ----------------------------------------
 *  VARIABLES
 * ----------------------------------------
 */
const paths = {
    src: 'src/',
    dist: 'dist/',
    demo: 'demo/',
    assets: 'assets/',
    bulma: 'node_modules/bulma/sass/utilities/',
    pattern: {
        sass: '**/*.scss',
        js: '**/*.js',
        image: '**/*.+(jpg|JPG|jpeg|JPEG|png|PNG|svg|SVG|gif|GIF|webp|WEBP|tif|TIF)',
        html: '**/*.html',
        xml: '**/*.xml',
    },
};
const config = {
    sass: {
        input: 'index.scss',
        dependencies: [paths.bulma + '_index.scss'],
        output: {
            filename: pkg.name,
            format: 'expanded',
        },
        source: paths.src + 'scss/',
        destination: paths.dist + 'css/',
    },
    javascript: {
        input: 'index.js',
        output: {
            name: camelCase(pkg.name),
            filename: pkg.name,
            format: 'umd',
        },
        source: paths.src + 'js/',
        destination: paths.dist + 'js/',
    },
};

/**
 * ----------------------------------------
 *  BUILD STYLESHEETS TASKS
 * ----------------------------------------
 */
// Uses Sass compiler to process styles, adds vendor prefixes, minifies, then
// outputs file to the appropriate location.

gulp.task('build:styles', function () {
    if (fs.existsSync(config.sass.source + config.sass.input)) {
        return gulp
            .src(config.sass.source + config.sass.input)
            .pipe(
                sass({
                    style: config.sass.output.format,
                    trace: true,
                    loadPaths: ['node_modules'],
                    indentedSyntax: false,
                })
            )
            .on('error', function (error) {
                console.error(error);
                this.emit('end'); // Prevent gulp from crashing on Sass error
            })
            .pipe(
                postcss([
                    autoprefixer({
                        browsers: pkg.browsers,
                    }),
                ])
            )

            .pipe(concat(config.sass.output.filename + '.css'))
            .pipe(gulp.dest(config.sass.destination))

            .pipe(cleanCSS())
            .pipe(concat(config.sass.output.filename + '.min.css'))
            .pipe(gulp.dest(config.sass.destination))
            .on('end', () => console.log('Minified CSS file generated'));
    } else {
        return Promise.resolve();
    }
});

gulp.task('clean:styles', function () {
    return deleteAsync([
        config.sass.destination + config.sass.output.filename + '.css',
        config.sass.destination + config.sass.output.filename + '.min.css',
    ]);
});

gulp.task('copy:styles', function () {
    return gulp
        .src(config.sass.destination + config.sass.output.filename + '.min.css')
        .pipe(gulp.dest(paths.src + paths.demo + paths.assets + 'css'))
        .pipe(gulp.dest(paths.demo + paths.assets + 'css'));
});

/**
 * ----------------------------------------
 *  BUILD JAVASCRIPT TASKS
 * ----------------------------------------
 */

// Concatenates and uglifies global JS files and outputs result to the
// appropriate location.
gulp.task('build:scripts', function () {
    if (fs.existsSync(config.javascript.source + config.javascript.input)) {
        return gulp
            .src(config.javascript.source + config.javascript.input)
            .pipe(
                webpackStream({
                    output: {
                        filename: config.javascript.output.filename + '.js',
                        library: config.javascript.output.name,
                        libraryTarget: config.javascript.output.format,
                        libraryExport: 'default',
                    },
                    mode: 'production',
                    resolve: {
                        extensions: ['.js', '.jsx'],
                    },
                    module: {
                        rules: [
                            {
                                test: /\.(js|jsx)$/,
                                exclude: /(node_modules)/,
                                loader: 'babel-loader',
                                options: {
                                    babelrc: true,
                                },
                            },
                            {
                                test: /\.m?js$/,
                                resolve: {
                                    fullySpecified: false,
                                },
                            },
                        ],
                    },
                    performance: {
                        hints: false,
                    },
                })
            )

            .pipe(concat(config.javascript.output.filename + '.js'))
            .pipe(gulp.dest(config.javascript.destination))

            .pipe(concat(config.javascript.output.filename + '.min.js'))
            .pipe(
                terser({
                    keep_fnames: true,
                    mangle: false,
                }).on('error', function (err) {
                    log(colors.red('[Error]'), err.toString());
                })
            )
            .pipe(
                gulp.dest(config.javascript.destination).on('error', function (err) {
                    log(colors.red('[Error]'), err.toString());
                })
            );
    } else {
        return Promise.resolve();
    }
});

gulp.task('clean:scripts', function () {
    return deleteAsync([
        config.javascript.destination + config.javascript.output.filename + '.js',
        config.javascript.destination + config.javascript.output.filename + '.min.js'
    ]);
});

gulp.task('copy:scripts', function () {
    return gulp
        .src(config.javascript.destination + config.javascript.output.filename + '.min.js')
        .pipe(gulp.dest(paths.src + paths.demo + paths.assets + 'js'))
        .pipe(gulp.dest(paths.demo + paths.assets + 'js'));
});

/**
 * ----------------------------------------
 *  GLOBAL TASKS
 * ----------------------------------------
 */

gulp.task('clean', function () {
    return deleteAsync(paths.dist);
});

gulp.task('build', gulp.series('clean', 'build:styles', 'build:scripts', 'copy:styles', 'copy:scripts'));

gulp.task('sync', function (callback) {
    browserSync.reload();
    callback();
});

gulp.task('watch', gulp.series('build', function() {

    browserSync.init({
        server: paths.demo,
        ghostMode: false, // Toggle to mirror clicks, reloads etc. (performance)
        logFileChanges: true,
        logLevel: 'debug',
        open: true // Toggle to automatically open page when starting.
    });

    gulp.watch(config.javascript.source + paths.pattern.js, gulp.series('build:scripts', 'copy:scripts', 'sync'));
    gulp.watch(config.sass.source + paths.pattern.sass, gulp.series('build:styles', 'copy:styles', 'sync'));

}));

/**
 * ----------------------------------------
 *  DEFAULT TASK
 * ----------------------------------------
 */
gulp.task('default', gulp.series('build', function (done) {
  done();
}));

gulp.task('build:demo', async function () {
  browserSync.notify('Compiling Demo');

  const { execa } = await import('execa');
  await execa('bundle', ['exec', 'jekyll', 'build', `--source=${paths.src + paths.demo}`, `--destination=${paths.demo}`, '--config', '_config.yml'], {
    stdio: 'inherit'
  });
});

gulp.task('clean:demo', function (callback) {
    browserSync.notify('Cleaning Demo');
    return deleteAsync(paths.demo);
});

gulp.task('demo:dependencies', gulp.series('build:demo', function () {
  browserSync.notify('Updating Demo dependencies');
  return gulp.src(paths.demo + paths.pattern.html)
    .pipe(dependencies({
      src: paths.demo,
      dest: 'assets/js',
      dependenciesPath: './'
    }))
    .pipe(gulp.dest(paths.demo));
}));

/**
 * ----------------------------------------
 *  WATCH TASKS
 * ----------------------------------------
 */
gulp.task('build:scripts:watch', gulp.series('build:scripts', function (callback) {
  browserSync.reload();
  callback();
}));

gulp.task('build:styles:watch', gulp.series('build:styles', function (callback) {
  browserSync.reload();
  callback();
}));

gulp.task('build:demo:watch', gulp.series('demo:dependencies', function (callback) {
  browserSync.reload();
  callback();
}));

/**
 * ----------------------------------------
 *  DEMO
 * ----------------------------------------
 */

// Static Server + watching files.
// Note: passing anything besides hard-coded literal paths with globs doesn't
// seem to work with gulp.watch().
gulp.task('launch:demo', gulp.series('demo:dependencies', function () {
  browserSync.init({
    server: paths.demo,
    ghostMode: false, // Toggle to mirror clicks, reloads etc. (performance)
    logFileChanges: true,
    logLevel: 'debug',
    open: true // Toggle to automatically open page when starting.
  });

  // Watch site settings.
  gulp.watch('_config.yml', gulp.series('build:demo:watch'));

  // Watch .sass files; changes are piped to browserSync.
  gulp.watch('src/sass/**/*.sass', gulp.series('build:styles:watch'));
  gulp.watch('src/demo/**/*.css', gulp.series('copy:styles'));

  // Watch .js files.
  gulp.watch('src/js/**/*.js', gulp.series('build:scripts:watch'));
  gulp.watch('src/demo/**/*.js', gulp.series('copy:scripts'));

  // Watch html and markdown files.
  gulp.watch('src/demo/**/*.+(html|md|markdown|MD)', gulp.series('build:demo:watch'));

  // Watch favicon.png.
  gulp.watch('favicon.png', gulp.series('build:demo:watch'));
}));

// Build and Launch Demo site
gulp.task('demo', gulp.series(
  'clean:demo',
  gulp.parallel('build:scripts', 'build:styles'),
  'build:demo',
  'launch:demo',
  function () {

  }
));
