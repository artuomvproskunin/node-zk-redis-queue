(function() {
    var assert   = require("assert"),
        async    = require("async"),
        simple  = require("simple_redis"),
        Queue    = require("../index"),
        ZK       = require("zkjs"),
        zk       = new ZK({hosts: ["api.yongwo.de:2181"], root: "/rq00", timeout: 2000}),
        redisOne, redisTwo, queue, timer;


    function createQueue(callback) {
        function createRedisOne(callback) {
            simple.request("ibobrik@gmail.com", {retry_max_delay: 1000}, function(error, redis) {
                assert.ifError(error);

                redisOne = redis;
                callback(error);
            });
        }

        function createRedisTwo(callback) {
            simple.request("ibobrik@gmail.com", {retry_max_delay: 1000}, function(error, redis) {
                assert.ifError(error);

                redisTwo = redis;
                callback();
            });
        }

        async.series([createRedisOne, createRedisTwo], function(error) {
            assert.ifError(error);

            queue = new Queue([redisOne, redisTwo], zk, "woo");
            callback();
        });
    }

    function clearFirst(callback) {
        queue.clear(function(error, removed) {
            assert.ifError(error);
            assert.ok(removed == 1 || removed == 2);

            callback();
        });
    }

    function checkSize(callback) {
        queue.getSize(function(error, size) {
            assert.ifError(error);
            assert.equal(size, 0);

            callback();
        });
    }

    function testPush(callback) {
        queue.push("pew one", function(error, added) {
            assert.ifError(error);
            assert.ok(added == 1 || added == 2);

            queue.getSize(function(error, size) {
                assert.ifError(error);
                assert.equal(size, 1);

                queue.push("pew one", function(error, added) {
                    assert.ifError(error);
                    assert.ok(added == 1 || added == 2);

                    queue.getSize(function(error, size) {
                        assert.ifError(error);
                        assert.equal(size, 1);

                        queue.push("pew two", function(error, added) {
                            assert.ifError(error);
                            assert.ok(added == 1 || added == 2);

                            queue.getSize(function(error, size) {
                                assert.ifError(error);
                                assert.equal(size, 2);

                                callback();
                            });
                        });
                    });
                });
            });
        });
    }

    function testPop(callback) {
        var removers = [];

        function pop(callback) {
            queue.pop(function(error, item, remove) {
                assert.ifError(error);
                assert.ok(item == "pew one" || item == "pew two", "Got incorrect item: " + item);

                // delayed removal to test locks
                removers.push(remove);
                callback();
            }, 5);
        }

        function emptyPop(callback) {
            queue.pop(function(error, item) {
                assert.ifError(error);
                assert.ok(item === undefined, "Got item when should not: " + item);

                callback();
            });
        }

        function removeItems(callback) {
            async.parallel(removers, callback);
        }

        async.series([pop, pop, emptyPop, emptyPop, emptyPop, removeItems], function(error) {
            assert.ifError(error);

            callback();
        });
    }

    function end(error) {
        assert.ifError(error);

        console.log("All good!");

        queue.close();
    }

    (function createQueue(callback) {
        function createRedisOne(callback) {
            simple.request("ibobrik@gmail.com", {retry_max_delay: 1000}, function(error, redis) {
                assert.ifError(error);

                redisOne = redis;
                callback(error);
            });
        }

        function createRedisTwo(callback) {
            simple.request("ibobrik@gmail.com", {retry_max_delay: 1000}, function(error, redis) {
                assert.ifError(error);

                redisTwo = redis;
                callback();
            });
        }

        async.series([createRedisOne, createRedisTwo], function(error) {
            assert.ifError(error);

            queue = new Queue([redisOne, redisTwo], zk, "woo");
            callback();
        });
    })(function(error) {
        assert.ifError(error);

        timer = setTimeout(function() {
            end(new Error("Queue is not ready after 2000ms"));
        }, 2000);

        queue.on("error", function(error) {
            console.log("Queue emitted error", error);
        });

        queue.on("ready", function() {
            clearTimeout(timer);

            console.log("Ready, starting test..");

            async.series([clearFirst, checkSize, testPush, testPop], end);
        });
    });
})();
