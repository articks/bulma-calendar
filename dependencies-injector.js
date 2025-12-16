import { Transform } from 'stream';
import path from 'path';
import fs from 'fs';
import PluginError from 'plugin-error';

const PLUGIN_NAME = 'dependencies-injector';

export default function(options) {
  options = options || {
    src: 'demo',
    dest: 'assets/js',
    dependenciesPath: './'
  };

  if (typeof options.dest == 'undefined') {
    throw new PluginError(PLUGIN_NAME, 'Please provide source path...');
  }

  if (typeof options.dest == 'undefined') {
    options.dest = '';
  }

  if (typeof options.dependenciesPath == 'undefined') {
    options.dependenciesPath = './';
  }

  if (typeof options.src == 'undefined') {
    options.src = 'demo';
  }

  if (options.dest.length > 1) {
    if (options.dest[options.dest.length - 1] != '/') {
      options.dest += '/';
    }
  }

  // Allow the user to add their own folders to the search pattern
  var userFolders = options.folders ? options.folders + '|' : '';
  var REGEX = new RegExp(`("|')([\\.\\/\\\\]*((${userFolders}bower_components|node_modules)\\/([a-z0-9\\.+@~$!;:\\/\\\\{}()\\[\\]|=&*£%§_-]+(\\.[a-z0-9]+)?)))['"]`, 'gi');

  return new Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      let dest = options.dest || path.dirname(file.path);
      dest = path.join(dest);

      var contents = file.contents.toString();
      var result = contents.replace(REGEX, (matches, quote, uri, pathname, engine, filename) => {
        const ext = path.extname(filename);
        const prefix = ext ? options.dest : path.join('/', options.dest);
        const f = options.flat && ext ? path.basename(filename) : filename;

        let basename = '';
        if (options.base) {
          basename = path.dirname(file.path.substring(file.path.search(options.base) + options.base.length));
        }

        const dest_file_prefix = path.join(options.src, (ext ? dest : path.join(dest, path.join(basename, engine))));
        const dest_file = path.join(dest_file_prefix, f + (!ext ? '.js' : ''));
        const url_file = new URL(f, 'file://' + options.dest).pathname;

        if (!ext) {
          uri += '.js';
        }

        let readPath = path.resolve(path.dirname(file.path), uri);
        if (readPath[0] == '/') {
          readPath = readPath.substring(1);
        }

        try {
          fs.mkdirSync(path.dirname(dest_file), { recursive: true });
          fs.createReadStream(path.resolve(options.dependenciesPath, readPath)).pipe(fs.createWriteStream(dest_file));
        } catch (err) {
          callback(new PluginError(PLUGIN_NAME, err));
          return matches;
        }

        return quote + '/' + url_file + quote;
      });

      if (result !== false) {
        file.contents = Buffer.from(result);
      }

      callback(null, file);
    }
  });
};
