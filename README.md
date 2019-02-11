Node Cache Manager store for MongoDB
==================================

[![Codacy Badge](https://api.codacy.com/project/badge/c865d138d52541f8845090ed3992357a)](https://www.codacy.com/app/valerio-cavagni/node-cache-manager-mongodb) [![Dependency Status](https://david-dm.org/v4l3r10/node-cache-manager-mongodb.svg)](https://david-dm.org/v4l3r10/node-cache-manager-mongodb)

The MongoDb store for the [node-cache-manager](https://github.com/BryanDonovan/node-cache-manager) module. 

Special thx to @onlyurei and @dcolens

Installation
------------

```sh
npm install cache-manager-mongodb --save
```

## News

​	Switch to full Promise support.

​	New Mocha test (thx to @[dcolens](https://github.com/v4l3r10/node-cache-manager-mongodb/issues?q=is%3Apr+is%3Aopen+author%3Adcolens) )

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
      collection : "cacheManager",
      compression : false,
      poolSize : 5,
      autoReconnect: true
    }
  });

var ttl = 60;

mongoCache.set('foo', 'bar', ttl)
	.then(()=>{
     return mongoCache.get('foo')
	}).then((result) => {
        console.log(result);
        // >> 'bar'
        return mongoCache.del('foo');
    });
});

function getUser(id) {
    return new Promise((resolve,reject)=>{
    setTimeout(function () {
        console.log("Returning user from slow database.");
        return resolve({id: id, name: 'Bob'});
    }, 100);
}

var userId = 123;
var key = 'user_' + userId;

// Note: ttl is optional in wrap()
mongoCache.wrap(key, function () {
    return getUserPromise(userId);
}, ttl)
    .then((user) => {
   	 console.log(user);

    // Second time fetches user from mongoCache
    mongoCache.wrap(key, function () {
       return getUserPromise(userId);
    }.then(( user) => {
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
multiCache.set('foo2', 'bar2', ttl)
    .then(()=>{
    	// Fetches from highest priority cache that has the key.
    	return multiCache.get('foo2')
	}).then((result) => {
        console.log(result);
        // >> 'bar2'
        // Delete from all caches
        return multiCache.del('foo2');
    });
});

// Note: ttl is optional in wrap()
multiCache.wrap(key2, function () {
    return getUserPromise(userId2);
}, ttl)
.then((user) => {
   		console.log(user);
   		 // Second time fetches user from memoryCache, since it's highest priority.
    	// If the data expires in the memory cache, the next fetch would pull it from
    	// the 'someOtherCache', and set the data in memory again.
    	return multiCache.wrap(key2, function () {
     	   return getUserPromise(userId2);
    	});
}).then((user)=>{
    console.log(user);
});

function getUserPromise(id) {
    return new Promise((resolve,reject)=>{
        setTimeout(function () {
       	 console.log("Returning user from slow database.");
       	 return resolve({id: id, name: 'Bob'});
 	 	}, 100);
    })
});
```



Contribution
------------

If you would like to contribute to the project, please fork it and send us a pull request.

License
-------

`node-cache-manager-mongodb` is licensed under the MIT license.
