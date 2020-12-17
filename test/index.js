'use strict';
const Promise = require("bluebird");
var MongoClient = require('mongodb').MongoClient,
  store = require('../index.js'),
  mongoUri = 'mongodb://userTest:test@192.168.1.5:27017/test',
  collection = 'test_node_cache_mongodb_1',
  collection2 = 'test_node_cache_mongodb_2',
  assert = require('assert');

describe('node-cache-manager-mongodb', function () {
  var db;
  var c, c2;
  var mongoC;

  before('connect to mongo', function (done) {
    MongoClient.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }, function (err, client) {
      mongoC = client;
      db = mongoC.db('test');
      c = db.collection(collection);
      c2 = db.collection(collection2);
      done(err);
    });
  });

  describe('set', function () {
    var s;
    before('connect', function (done) {
      s = store.create({
        uri: mongoUri,
        options: {
          collection: collection,
          ttl: 0.1
        }
      });
      setTimeout(function () {
        done();
      }, 500);
    });

    it('check mongo expiry (this takes long)', function () {
      this.timeout(60000);
      return s.set('test-cookie-0', 'test-user', {
        ttl: 0.1
      }).delay(30000).then(() => {
        return c.findOne({
          key: 'test-cookie-0'
        });
      }).then((r) => {
        assert.ok(!r);
      })
    });


    it('value with 1s expiry', function () {
      this.timeout(30000);
      return s.set('test-cookie-1', 'test-user', {
        ttl: 1
      }).delay(5000)
        .then(() => {
          return s.get('test-cookie-1')
        }).then((v) => {
          assert.ok(!v);
        });
    });

    it('check expiry', function () {
      this.timeout(30000);
      return s.set('test-cookie-2', 'test-user', {
        ttl: 1
      }).delay(10000)
        .then(() => {
          return s.get('test-cookie-2')
        }).then((v) => {
          assert.ok(!v);
        });
    });

    it('check get', function () {
      this.timeout(5000);
      return s.set('test-cookie-3', 'test-user', {
        ttl: 10
      }).then(() => {
        return s.get('test-cookie-3');
      }).then((v) => {
        assert.strictEqual('test-user', v);
      });
    });

    it('check del', function () {
      this.timeout(5000);
      return s.set('test-cookie-4', 'test-user', {
        ttl: 10000
      }).then(() => {
        return s.del('test-cookie-4');
      }).then(() => {
        return s.get('test-cookie-4');
      }).then((v) => {
        assert.ok(!v);
      })
    });

    /*it('check mongo expiry (this takes long)', function (done) {
      this.timeout(5000);
      s.set('test-cookie-5', 'test-user', {
        ttl: 1
      }, function (err) {
        setTimeout(function (err) {
          c.findOne({
            key: 'test-cookie-5'
          }, function (e, r) {
            console.log(e);
            console.log(r);
            assert.ok(!!!r);
            done(e);
          });
        }, 3000);
      });
    });*/

    it('check reset cache', function () {
      this.timeout(60000);
      return Promise.all([
        s.set('test-cookie-3', 'test-cookie-3', { ttl: 60000 }),
        s.set('test-cookie-2', 'test-cookie-2', { ttl: 60000 }),
        s.set('test-user', 'test-user', { ttl: 60000 })])
        .then(() => {
          return s.reset();
        }).then(() => {
          return c.find({});
        }).then((res) => {
          return res.count();
        }).then((len) => {
          assert.ok(!!!len);
        })
    });

  });

  describe('create a second collection', function () {
    var s;
    before('connect', function () {
      this.timeout(30000);
      s = store.create({
        uri: mongoUri,
        options: {
          collection: collection2,
          ttl: 5
        }
      });
      return Promise.delay(1000);
    });

    it('check expiry', function () {
      this.timeout(30000);
      return s.set('test-cookie-2', 'test-user', {
        ttl: 0.1
      }).delay(500)
        .then(() => {
          return s.get('test-cookie-2')
        }).then((v) => {
          assert.ok(!v);
        })
    });

  });


  describe('get', function () {

  });


  after('close connection', function () {
    mongoC.close();
    process.exit(0);
  });
});
