;(function(scope) {
    var PENDING = 'pending';
    var RESOLVED = 'resolved';
    var REJECTED = 'rejected';
    var UNDEFINED = void 0;

    function CallbackItem(promise, onResolved, onRejected) {
        this.promise = promise;
        this.onResolved = typeof onResolved === 'function' ? onResolved : function(v) {
            return v };
        this.onRejected = typeof onRejected === 'function' ? onRejected : function(v) {
            throw v };
    }
    CallbackItem.prototype.resolve = function(value) {
        executeCallbackAsync.bind(this.promise)(this.onResolved, value);
    }
    CallbackItem.prototype.reject = function(value) {
        executeCallbackAsync.bind(this.promise)(this.onRejected, value);
    }

    function getThen(obj) {
        var then = obj && obj.then;
        if (obj && typeof obj === 'object' && typeof then === 'function') {
            return function appyThen() {
                then.apply(obj, arguments);
            };
        }
    }

    function executeCallback(type, x) {
        var isResolve = type === 'resolve',
            thenable;

        if (isResolve && (typeof x === 'object' || typeof x === 'function')) {
            try {
                thenable = getThen(x);
            } catch (e) {
                return executeCallback.bind(this)('reject', e);
            }
        }
        if (isResolve && thenable) {
            executeResolver.bind(this)(thenable);
        } else {
            this.state = isResolve ? RESOLVED : REJECTED;
            this.data = x;
            this.callbackQueue.forEach(v => v[type](x));
        }
        return this;
    }

    function executeResolver(resolver) {
        var called = false,
            _this = this;

        function onError(y) {
            if (called) {
                return; }
            called = true;
            executeCallback.bind(_this)('reject', y);
        }

        function onSuccess(r) {
            if (called) {
                return; }
            called = true;
            executeCallback.bind(_this)('resolve', r);
        }

        try {
            resolver(onSuccess, onError);
        } catch (e) {
            onError(e);
        }
    }

    function executeCallbackAsync(callback, value) {
        var _this = this;
        setTimeout(function() {
            var res;
            try {
                res = callback(value);
            } catch (e) {
                return executeCallback.bind(_this)('reject', e);
            }

            if (res !== _this) {
                return executeCallback.bind(_this)('resolve', res);
            } else {
                return executeCallback.bind(_this)('reject', new TypeError('Cannot resolve promise with itself'));
            }
        }, 4)
    }

    function Promise(resolver) {
        if (resolver && typeof resolver !== 'function') {
            throw new Error('Promise resolver is not a function') }
        this.state = PENDING;
        this.data = UNDEFINED;
        this.callbackQueue = [];

        if (resolver) executeResolver.call(this, resolver);
    }
    Promise.prototype.then = function(onResolved, onRejected) {
        if (typeof onResolved !== 'function' && this.state === RESOLVED ||
            typeof onRejected !== 'function' && this.state === REJECTED) {
            return this;
        }

        var promise = new this.constructor();

        if (this.state !== PENDING) {
            var callback = this.state === RESOLVED ? onResolved : onRejected;
            executeCallbackAsync.bind(promise)(callback, this.data);
        } else {
            this.callbackQueue.push(new CallbackItem(promise, onResolved, onRejected))
        }

        return promise;
    }
    Promise.prototype.catch = function(onRejected) {
        return this.then(null, onRejected);
    }

    Promise.prototype.wait = function(ms) {
        var P = this.constructor;
        return this.then(function(v) {
            return new P(function(resolve, reject) {
                setTimeout(function() { resolve(v); }, ~~ms)
            })
        }, function(r) {
            return new P(function(resolve, reject) {
                setTimeout(function() { reject(r); }, ~~ms)
            })
        })
    }
    Promise.prototype.always = function(fn) {
        return this.then(function(v) {
            return fn(v), v;
        }, function(r) {
            throw fn(r), r;
        })
    }
    Promise.prototype.done = function(onResolved, onRejected) {
        this.then(onResolved, onRejected).catch(function(error) {
            setTimeout(function() {
                throw error;
            }, 0);
        });
    }

    Promise.resolve = function(value) {
        if (value instanceof this) return value;
        return executeCallback.bind(new this())('resolve', value);
    }
    Promise.reject = function(value) {
        if (value instanceof this) return value;
        return executeCallback.bind(new this())('reject', value);
    }
    Promise.all = function(iterable) {
        var _this = this;
        return new this(function(resolve, reject) {
            if (!iterable || !Array.isArray(iterable)) return reject(new TypeError('must be an array'));
            var len = iterable.length;
            if (!len) return resolve([]);

            var res = Array(len),
                counter = 0,
                called = false;

            iterable.forEach(function(v, i) {
                (function(i) {
                    _this.resolve(v).then(function(value) {
                        res[i] = value;
                        if (++counter === len && !called) {
                            called = true;
                            return resolve(res)
                        }
                    }, function(err) {
                        if (!called) {
                            called = true;
                            return reject(err);
                        }
                    })
                })(i)
            })
        })
    }
    Promise.race = function(iterable) {
        var _this = this;
        return new this(function(resolve, reject) {
            if (!iterable || !Array.isArray(iterable)) return reject(new TypeError('must be an array'));
            var len = iterable.length;
            if (!len) return resolve([]);

            var called = false;
            iterable.forEach(function(v, i) {
                _this.resolve(v).then(function(res) {
                    if (!called) {
                        called = true;
                        return resolve(res);
                    }
                }, function(err) {
                    if (!called) {
                        called = true;
                        return reject(err);
                    }
                })
            })
        })
    }
    Promise.stop = function() { return new this(); }
    Promise.deferred = Promise.defer = function() {
        var dfd = {};
        dfd.promise = new Promise(function(resolve, reject) {
            dfd.resolve = resolve;
            dfd.reject = reject;
        })
        return dfd
    }
    Promise.timeout = function(promise, ms) {
        return this.race([promise, this.reject().wait(ms)]);
    }
    Promise.sequence = function(tasks) {
        return tasks.reduce(function(prev, next) {
            return prev.then(next).then(function(res) {
                return res });
        }, this.resolve());
    }

    try {
        module.exports = Promise;
    } catch (e) {
        if (scope.Promise && !scope.MPromise) scope.MPromise = Promise;
    }
    return Promise;
})(this)