Node Cache Manager store for MongoDB
==================================

[![Codacy Badge](https://api.codacy.com/project/badge/c865d138d52541f8845090ed3992357a)](https://www.codacy.com/app/valerio-cavagni/node-cache-manager-mongodb) [![Dependency Status](https://david-dm.org/v4l3r10/node-cache-manager-mongodb.svg)](https://david-dm.org/v4l3r10/node-cache-manager-mongodb)

The MongoDb store for the [node-cache-manager](https://github.com/BryanDonovan/node-cache-manager) module.

Installation
------------

```sh
npm install cache-manager-mongodb --save
```

Usage examples
--------------

Here are examples that demonstrate how to implement the Mongodb cache store.

### Single store

```js
var cacheManager = require('cache-manager');
var mongoStore = require('cache-manager-mongodb');


var mongoCache = cacheManager.caching({
    store : mongoStore,
    uri : "mongodb://user:pass@localhost:27017/nodeCacheDb",
    options : {
      host : '127.0.0.1',
      port : '27017',
      username : "username",
      password : "pass",
      database : "nodeCacheDb",
      collection : "cacheManager",
      compression : false,
      server : {
        poolSize : 5,
        auto_reconnect: true
      }
    }
  });

var ttl = 60;

mongoCache.set('foo', 'bar', ttl, function(err) {
    if (err) {
      throw err;
    }

    mongoCache.get('foo', function(err, result) {
        console.log(result);
        // >> 'bar'
        mongoCache.del('foo', function(err) {});
    });
});

function getUser(id, cb) {
    setTimeout(function () {
        console.log("Returning user from slow database.");
        cb(null, {id: id, name: 'Bob'});
    }, 100);
}

var userId = 123;
var key = 'user_' + userId;

// Note: ttl is optional in wrap()
mongoCache.wrap(key, function (cb) {
    getUser(userId, cb);
}, ttl, function (err, user) {
    console.log(user);

    // Second time fetches user from mongoCache
    mongoCache.wrap(key, function (cb) {
        getUser(userId, cb);
    }, function (err, user) {
        console.log(user);
    });
});
```

### Multi-store

```js
var cacheManager = require('cache-manager');
var mongoStore = require('cache-manager-mongodb');

var mongoCache = cacheManager.caching({store: mongoStore, uri: 'mongodb://user:pass@localhost:27017/nodeCacheDb',options: { collection: 'cacheManager'}, ttl: 600});
var memoryCache = cacheManager.caching({store: 'memory', max: 100, ttl: 60});

var multiCache = cacheManager.multiCaching([memoryCache, mongoCache]);


userId2 = 456;
key2 = 'user_' + userId;
ttl = 5;

// Sets in all caches.
multiCache.set('foo2', 'bar2', ttl, function(err) {
    if (err) { throw err; }

    // Fetches from highest priority cache that has the key.
    multiCache.get('foo2', function(err, result) {
        console.log(result);
        // >> 'bar2'

        // Delete from all caches
        multiCache.del('foo2');
    });
});

// Note: ttl is optional in wrap()
multiCache.wrap(key2, function (cb) {
    getUser(userId2, cb);
}, ttl, function (err, user) {
    console.log(user);

    // Second time fetches user from memoryCache, since it's highest priority.
    // If the data expires in the memory cache, the next fetch would pull it from
    // the 'someOtherCache', and set the data in memory again.
    multiCache.wrap(key2, function (cb) {
        getUser(userId2, cb);
    }, function (err, user) {
        console.log(user);
    });
});

function getUser(id, cb) {
    setTimeout(function () {
        console.log("Returning user from slow database.");
        cb(null, {id: id, name: 'Bob'});
    }, 100);
}
```



Contribution
------------

If you would like to contribute to the project, please fork it and send us a pull request.

License
-------

`node-cache-manager-mongodb` is licensed under the MIT license.
