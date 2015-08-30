'use strict';

/**
 * Module dependencies.
 */

var Client = require('mongodb').MongoClient,
uri = require('mongodb-uri'),
thunky = require('thunky'),
zlib = require('zlib'), noop = function () {};

/**
 * Export `MongoStore`.
 */

module.exports = {
  create : function (args) {
    return MongoStore(args);
  }
};

/**
 * MongoStore constructor.
 *
 * @param {Object} options
 * @api public
 */

function MongoStore(args) {
  
  var conn = args;
  var options;
  if (args.uri)
    conn = args.uri;
  if (args.options)
    options = args.options;

  if (!(this instanceof MongoStore))
    return new MongoStore(args);

  var self = {
    name : 'mongodb'
  };

  var store = this;

  if ('object' === typeof conn) {
    if ('function' !== typeof conn.collection) {
      options = conn.options;
      if (Object.keys(options).length === 0) {
        conn = null;
      } else if (options.client) {
        store.client = options.client
      } else {
        options.database = options.database || options.db;
        options.hosts = options.hosts || [{
              port : options.port || 27017,
              host : options.host || '127.0.0.1'
            }
          ];
        options.server = options.server;
        conn = uri.format(options);
      }
    } else {
      store.client = conn;
    }
  }
  conn = conn || 'mongodb://127.0.0.1:27017';
  options = options || {};
  store.coll = options.collection || 'cacheman';
  store.compression = options.compression || false;
  store.ready = thunky(function ready(cb) {
      if ('string' === typeof conn) {
        console.log(conn);
        console.log(options);
        Client.connect(conn, options, function getDb(err, db) {
          if (err)
            return cb(err);
          cb(null, store.client = db);
        });
      } else {
        if (store.client)
          return cb(null, store.client);
        cb(new Error('Invalid mongo connection.'));
      }
    });
}

/**
 * Get an entry.
 *
 * @param {String} key
 * @param {Function} fn
 * @api public
 */

MongoStore.prototype.get = function get(key, options, fn) {
  var store = this;
  fn = fn || noop;
  store.ready(function ready(err, db) {
    if (err)
      return fn(err);
    db.collection(store.coll).findOne({
      key : key
    }, function findOne(err, data) {
      if (err)
        return fn(err);
      if (!data)
        return fn(null, null);
      if (data.expire < Date.now()) {
        store.del(key);
        return fn(null, null);
      }
      try {
        if (data.compressed)
          return decompress(data.value, fn);
        fn(null, data.value);
      } catch (err) {
        fn(err);
      }
    });
  });
};

/**
 * Set an entry.
 *
 * @param {String} key
 * @param {Mixed} val
 * @param {Number} ttl
 * @param {Function} fn
 * @api public
 */

MongoStore.prototype.set = function set(key, val, options, fn) {

  if ('function' === typeof options) {
    fn = options;
    options = null;
  }

  fn = fn || noop;
  var ttl = options.ttl;
  var data,
  store = this,
  query = {
    key : key
  },
  options = {
    upsert : true,
    safe : true
  };

  try {
    data = {
      key : key,
      value : val,
      expire : Date.now() + ((ttl || 60) * 1000)
    };
  } catch (err) {
    return fn(err);
  }

  store.ready(function ready(err, db) {
    if (err)
      return fn(err);
    if (!store.compression) {
      update(data);
    } else {
      compress(data, function compressData(err, data) {
        if (err)
          return fn(err);
        update(data);
      });
    }
    function update(data) {
      db.collection(store.coll).update(query, data, options, function _update(err, data) {
        if (err)
          return fn(err);
        if (!data)
          return fn(null, null);
        fn(null, val);
      });
    }
  });
};

/**
 * Delete an entry.
 *
 * @param {String} key
 * @param {Function} fn
 * @api public
 */

MongoStore.prototype.del = function del(key, options, fn) {
  if (typeof options === 'function') {
    fn = options;
  }
  var store = this;
  fn = fn || noop;
  this.ready(function ready(err, db) {
    if (err)
      return fn(err);
    db.collection(store.coll).remove({
      key : key
    }, {
      safe : true
    }, fn);
  });
};

/**
 * Clear all entries for this bucket.
 *
 * @param {String} key
 * @param {Function} fn
 * @api public
 */

MongoStore.prototype.reset = function reset(key, fn) {
  var store = this;

  if ('function' === typeof key) {
    fn = key;
    key = null;
  }

  fn = fn || noop;
  store.ready(function ready(err, db) {
    if (err)
      return fn(err);
    db.collection(store.coll).remove({}, {
      safe : true
    }, fn);
  });
};

MongoStore.prototype.isCacheableValue = function (value) {
  return value !== null && value !== undefined;
};

/**
 * Non-exported Helpers
 */

/**
 * Compress data value.
 *
 * @param {Object} data
 * @param {Function} fn
 * @api public
 */

function compress(data, fn) {

  // Data is not of a "compressable" type (currently only Buffer)
  if (!Buffer.isBuffer(data.value))
    return fn(null, data);

  zlib.gzip(data.value, function (err, val) {
    // If compression was successful, then use the compressed data.
    // Otherwise, save the original data.
    if (!err) {
      data.value = val;
      data.compressed = true;
    }

    fn(err, data);
  });
};

/**
 * Decompress data value.
 *
 * @param {Object} value
 * @param {Function} fn
 * @api public
 */

function decompress(value, fn) {
  var v = (value.buffer && Buffer.isBuffer(value.buffer)) ? value.buffer : value;
  zlib.gunzip(v, fn);
};
