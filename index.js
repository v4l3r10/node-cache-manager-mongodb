'use strict';

/**
 * Module dependencies.
 */

const Client = require('mongodb').MongoClient;
Promise = require('bluebird');
const zlib = require('zlib');
const _ = require('lodash');
const validOptionNames = ['poolSize', 'ssl', 'sslValidate', 'sslCA', 'sslCert',
  'sslKey', 'sslPass', 'sslCRL', 'autoReconnect', 'noDelay', 'keepAlive', 'connectTimeoutMS', 'family',
  'socketTimeoutMS', 'reconnectTries', 'reconnectInterval', 'ha', 'haInterval',
  'replicaSet', 'secondaryAcceptableLatencyMS', 'acceptableLatencyMS',
  'connectWithNoPrimary', 'authSource', 'w', 'wtimeout', 'j', 'forceServerObjectId',
  'serializeFunctions', 'ignoreUndefined', 'raw', 'bufferMaxEntries',
  'readPreference', 'pkFactory', 'promiseLibrary', 'readConcern', 'maxStalenessSeconds',
  'loggerLevel', 'logger', 'promoteValues', 'promoteBuffers', 'promoteLongs',
  'domainsEnabled', 'keepAliveInitialDelay', 'checkServerIdentity', 'validateOptions', 'appname', 'auth', 'useNewUrlParser',
  'useUnifiedTopology'
];


/**
 * MongoStore constructor.
 *
 * @param {Object} options
 * @api public
 */

class MongoStore {

  constructor(args) {
    var store = this;
    store.uri = (args.uri) ? args.uri : 'mongodb://localhost:27017/cache';
    store.options = (args.options) ? args.options : {};
    store.MongoOptions = store.options;
    store.MongoOptions.ttl = (store.MongoOptions.ttl) ? store.MongoOptions.ttl : 60 * 1000;
    store.MongoOptions.promiseLibrary = Promise;
    store.MongoOptions.useNewUrlParser = true;
    store.MongoOptions.useUnifiedTopology = true;
    store.name = 'mongodb';
    store.expireKey = 'expire';
    store.coll = store.MongoOptions.collection || 'cacheman';
    store.compression = store.MongoOptions.compression || false;
    store.support_cosmosDB = store.options.support_cosmosDB || false;
    return this;
  }

  getCollection() {
    var store = this;
    return Promise.try(() => {
      if (store.client && store.collection)
        return store.collection;
      return store.initClient();
    });

  }

  initClient() {
    var store = this;
    return Promise.try(() => {
      let uri = store.uri;
      return Client.connect(uri, _.pick(store.MongoOptions, validOptionNames));
    }).then((client) => {
      return client.db();
    }).then((db) => {
      store.client = db;
      return store.initColl();
    }).then(() => {
      return store.collection;
    }).catch((err) => {
      console.log(err);
      throw err;
    });
  }

  /**
   * Init Collection on db
   */
  initColl() {
    var self = this;
    return self.checkColl()
      .then((collection) => {
        if (collection) {
          self.collection = collection;
          if (self.support_cosmosDB) {

            // In cosmosDB only support _ts custom index when expireAfterSeconds is given and also this index is required so that value given as ttl will work
            self.collection.createIndex({ _ts: 1 }, {
              expireAfterSeconds: -1
            });
          }
          return collection;
        }
        //if not exist create it with index
        return self.client.createCollection(self.coll).then((coll) => {
          self.collection = coll;
          if (self.support_cosmosDB) {
            return self.collection.createIndex({ _ts: 1 }, {
              expireAfterSeconds: -1
            });
          } else {
            return self.collection.createIndex('expire', {
              expireAfterSeconds: 0
            });
          }
          //create Expire index that hook TTL when date in expire is lower than expire field
        }).then(() => {
          return self.collection.createIndex('key', {
            unique: true
          });
        })
      })
  }

  /**
   * Promisify collection check method
   */
  checkColl() {
    var self = this;
    return new Promise((resolve, reject) => {
      self.client.collection(self.coll, { strict: true }, (err, coll) => {
        //if err is collectio not exist resolve with null value
        if (err && err.message.indexOf('not exist') > -1)
          return resolve();
        else if (err)
          return reject(err);
        return resolve(coll);
      });
    });
  }

  /**
   * Compress data value.
   *
   * @param {Object} data
   * @api public
   */
  compress(data) {
    return new Promise((resolve, reject) => {
      // Data is not of a "compressable" type (currently only Buffer)
      if (!Buffer.isBuffer(data)) {
        return reject(new Error('Data is not of a "compressable" type (currently only Buffer)'));
      }
      zlib.gzip(data, (err, val) => {
        if (err)
          return reject(err);
        return resolve(val);
      });
    });
  }

  /**
   * Decompress data value.
   *
   * @param {Object} value
   * @api public
   */
  decompress(value) {
    return new Promise((resolve, reject) => {
      value = (value.buffer && Buffer.isBuffer(value.buffer)) ? value.buffer : value;
      zlib.gunzip(value, (err, data) => {
        if (err)
          return reject(err);
        return resolve(data);
      });
    });
  }


  /**
   * Get an entry.
   *
   * @param {String} key
   * @param {} options
   * @param {fn} cb
   * @api public
   */

  get(key, options, cb) {
    var store = this;

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (cb === undefined) {
      return new Promise(function (resolve, reject) {
        store.get(key, options, function (err, result) {
          err ? reject(err) : resolve(result)
        })
      })
    }

    store.getCollection()
      .then((collection) => {
        return collection.findOne({
          key: key
        });
      }).then((data) => {
        if (!data)
          return cb();
        if (data.expire < (new Date())) return cb();
        if (data.compressed)
          return cb(null, store.decompress(data.value));
        return cb(null, data.value);
      }).catch(err => cb(err));
  }

  /**
   * Set an entry.
   *
   * @param {String} key
   * @param {Mixed} val
   * @param {Object} options
   * @param {fn} cb
   * @api public
   */

  set(key, val, options, cb) {
    const store = this;

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (cb === undefined) {
      return new Promise(function (resolve, reject) {
        store.set(key, val, options, function (err, result) {
          err ? reject(err) : resolve(result)
        })
      })
    }

    var data = {
      key: key,
      value: val
    };
    data.expire = new Date();

    //if new ttl generate expire Date else use standard TTL
    if (options && options.ttl) {
      data.expire.setTime(data.expire.getTime() + (options.ttl * 1000));
      store.setCosmosDbTTl(options.ttl)
    }
    else {
      data.expire.setTime(data.expire.getTime() + (store.MongoOptions.ttl * 1000));
      store.setCosmosDbTTl(store.MongoOptions.ttl)
    }
    const query = {
      key: key
    };
    const opt = {
      upsert: true,
      w: 1
    };
    store.getCollection()
      .then((collection) => {
        if (store.compression) {
          return store.compress(data.value)
            .then((value) => {
              data.value = value;
              return collection.findOneAndUpdate(query, {
                '$set': data
              }, opt);
            });
        }
        return collection.findOneAndUpdate(query, {
          '$set': data
        }, opt);
      }).then((data) => {
        return cb(null, data);
      }).catch(err => cb(err));
  }

  /**
   * Delete an entry.
   *
   * @param {String} key
   * @param {Object} options
   * @param {fn} cb
   * @api public
   */

  del(key, options, cb) {
    var store = this;

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (cb === undefined) {
      return new Promise(function (resolve, reject) {
        store.del(key, options, function (err, result) {
          err ? reject(err) : resolve(result)
        })
      })
    }

    store.getCollection()
      .then((collection) => {
        return collection.deleteOne({
          key: key
        });
      }).then((r) => {
        if (r.deleteCount)
          return cb(null, true);
        return cb(null, false);
      }).catch(err => cb(err));
  }

  /**
   * Clear all entries for this bucket.
   *
   * @param {String} key
   * @param {fn} cb
   * @api public
   */

  reset(key, cb) {
    var store = this;

    if (typeof key === 'function') {
      cb = key;
      key = {};
    }

    if (cb === undefined) {
      return new Promise(function (resolve, reject) {
        store.reset(key, function (err, result) {
          err ? reject(err) : resolve(result)
        })
      })
    }
    store.getCollection()
      .then((collection) => {
        return collection.deleteMany({}, {
          w: 1
        });
      }).then(() => {
        return cb(null, true);
      })
      .catch(err => cb(err));
  }

  isCacheableValue(value) {
    return value !== null && value !== undefined;
  }


  // When migrating from mongodb to cosmos db ,we can expire document by setting a integer value for ttl
  setCosmosDbTTl(ttl) {
    store = this;
    if (store.support_cosmosDB) {
      data.ttl = parseInt(ttl);
    }
  }
}

/**
 * Export `MongoStore`.
 */

exports = module.exports = {
  create: (args) => {
    return new MongoStore(args);
  }
};
