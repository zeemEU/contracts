const createDeferredFn = require("./deferred-fn");

// Allows you to add fns onto a queue
// Calling start triggers them in order, stopping on any fail.
// Once started, you are not allowed to add to it.  This is to
// prevent race conditions, which are no good when testing.
//
// usage:
//	   createTaskQueue()
//			.add(fn || promise)
//			.add(fn || promise)
//			.start()
//			.asPromise()
//			.then() ...
//
function createTaskQueue(allowAddingAsync) {
	var _obj = Object.create(null);
	var _started = false;
	var _deferredFns = [];
	var _endPromise = createDeferredFn();
	var _allowAddingAsync = !!allowAddingAsync;
	
	// if there is no next task, fulfill _endPromise with _lastPromise
	// otherwise, set next task to _lastPromise, execute it:
	//	  	- if it succeeds, repeat
	//		- if it fails, fail _endPromise
	var _lastPromise = undefined;
	function _doNextPromise(v) {
		if (_deferredFns.length) {
			var next = _deferredFns.shift();
			next.resolve(v).then(_doNextPromise, (e) => { _endPromise.reject(e); });
			_lastPromise = next.catch((e) => {});
		} else {
			// all tasks done. fulfill the end promise
			_endPromise.resolve(_lastPromise);
		}
	}

	// functions for state
	_obj.isPending = function() {
		return _started;
	};
	
	// functions for modifying the queue itself
	_obj.add = function(fn) {
		if (_started && !_allowAddingAsync)
			throw Error("Cannot add to queue after it has been started.");
		var deferredFn = createDeferredFn(fn);
		_deferredFns.push(deferredFn);
		return deferredFn;
	}

	_obj.addDeferredFn = function(deferredFn) {
		_deferredFns.push(deferredFn);
	}

	_obj.empty = function() {
		_deferredFns = [];
	}

	_obj.getDeferredFns = function() {
		return _deferredFns.slice();
	}

	// starting, stopping
	_obj.start = function(fn) {
		if (_started)
			throw Error("Queue has already been started");
		Promise.resolve().then(()=> {
			_started = true;
			_doNextPromise();
		});
		return _obj.asPromise();
	};

	_obj.reject = function(e) {
		_deferredFns = [];
		_endPromise.reject(e);
	};

	_obj.resolve = function(v) {
		_deferredFns = [];
		_endPromise.resolve(v);
	}

	// getting the promise for the entire queue
	_obj.asPromise = function(fn) {
		return _endPromise;
	};

	return _obj;
}

module.exports = createTaskQueue;