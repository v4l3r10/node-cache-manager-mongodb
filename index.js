'use strict';

var Mongodb = require('mongoose');
var mongoose = require('mongoose');

function mongodbStore(args) {
  var self = {
    name : 'mongodb'
  };

  //Schema define
  var cacheSchema = mongoose.model(args.schema.name, {
      cacheId : String,
      data : {
        args.schema.model
      },
      createdAt : {
        type : Date,
      default:
        Date.now
      }
    });

  var kitty = new Cat({
      name : 'Zildjian'
    });
  kitty.save(function (err) {
    if (err) // ...
      console.log('meow');
  });

  var mongodbOptions = args || {};
  var mongodbSettings = mongodbOptions;
  var mongodbConnError = false;
  mongodbOptions.uri = args.uri || 'mongodb://localhost/cache';

  var pool = mongoose.createConnection(mongodbOptions.uri, mongodbOptions);

  pool.on("error", function () {
    mongodbConnError = true;
  });

  function connect(cb) {
    if (mongodbConnError) {
      return cb(new Error('MongoDb connection error'));
    }
    if (!pool.readyState) {
      pool.open(function (err) {
        if (err) {
          pool.disconnect();
          return cb(err);
        }

        cb(null);
      });
    } else
      return cb(null);
  }

  function handleResponse(cb, opts) {
    opts = opts || {};

    return function (err, result) {
      pool.disconnect();

      if (err) {
        return cb(err);
      }

      if (opts.parse) {
        result = JSON.parse(result);
      }

      cb(null, result);
    };
  }

  self.get = function (key, options, cb) {
    if (typeof options === 'function') {
      cb = options;
    }
    connect(function (err) {
      if (err) {
        return cb(err);
      }
      cacheSchema.findById(key, handleResponse(cb, {
          parse : false
        }));
    });
  };

  self.set = function (key, value, options, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }
    options = options || {};

    var ttl = (options.ttl || options.ttl === 0) ? options.ttl : mongodbOptions
    .ttl;

    connect(function (err) {
      if (err) {
        return cb(err);
      }
      var val = value;
      var model = new cacheSchema({
          cacheId : key,
          data : value
        });
      if (ttl)
        model.path('createdAt').expires(ttl);

      model.save(handleResponse(cb));

    });
  };

  self.del = function (key, options, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    connect(function (err) {
      if (err) {
        return cb(err);
      }
      cacheSchema.findByIdAndRemove(key, handleResponse(cb, {
          parse : false
        }));
    });
  };
/*
  self.ttl = function (key, cb) {
    connect(function (err, conn) {
      if (err) {
        return cb(err);
      }
      model.path('createdAt').expires('ttl');
      conn.ttl(key, handleResponse(conn, cb));
    });
  };*/

  self.keys = function (pattern, cb) {
    if (typeof pattern === 'function') {
      cb = pattern;
      pattern = '*';
    }

    connect(function (err ) {
      if (err) {
        return cb(err);
      }
      cacheSchema.find(handleResponse( cb));
    });
  };

  self.isCacheableValue = function (value) {
    return value !== null && value !== undefined;
  };

  return self;
}

module.exports = {
  create : function (args) {
    return mongodbStore(args);
  }
};
