var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , async = require('async')
  , lifecycle = require('mongoose-lifecycle')
  , BasePoller = require('./poller')
  , Check = require('./check')
  , utils = require('../utils')

var MonitorSchema = new Schema({
  owner: {type: Schema.ObjectId, ref: 'User', required: true}
  , isStopped: {type: Boolean, default: false}
  // pollers: [{type: Schema.ObjectId, ref: 'Poller'}]
});

// MonitorSchema.plugin(lifecycle);

MonitorSchema.methods.toggle = function(callback) {
  console.log('toggle')
  console.log('isStopped', this.isStopped)
  var monitor = this

  if (this.isStopped) {
    monitor.getMinInterval(utils.errback, function(minInterval) {
      monitor.start(minInterval, {}, callback)
    });
  } else {
    this.stop(callback)
  }
};

MonitorSchema.methods.updateInterval = function(check, poller) {
  console.log('updating')
  var monitor = this
    , polls = this.scheduledPolls
    , curInterval = polls != null ? polls._idleTimeout : 0

  monitor.getMinInterval(utils.errback, function(minInterval) {
    if (curInterval != minInterval) {
      var options = {checks: [check], poller: poller}
      monitor.start(minInterval, options)
    }
  })
};

MonitorSchema.methods.getMinInterval = function (errback, callback) {
  var query = BasePoller.find({monitor: this._id}).select('_id')
    , promise = query.lean().exec()

  function aggregateback (err, checks) {
    checks.length ? callback(checks[0].interval) : errback(err || 'No checks')
  }

  promise.addErrback(errback)
  promise.addCallback(function (pollers) {
    var ids = pollers.map(function (poller) {return poller._id})
    Check.aggregate(
      {$match: {poller: {$in: ids}}}
      , {$project: {interval: 1}}
      , {$group: {_id: null, interval: {$min: "$interval"}}}
      , aggregateback
    );
  });
};

MonitorSchema.methods.start = function(interval, options, callback) {
  console.log('starting monitor')
  this.pollChecks(options);
  this.scheduledPolls = setInterval(this.pollChecks.bind(this), interval);
  this.isStopped = false;
  console.log('isStopped', this.isStopped)
  if (callback) {callback()}
};

MonitorSchema.methods.stop = function(callback) {
  console.log('stoping monitor')
  clearInterval(this.scheduledPolls)
  this.isStopped = true
  console.log('isStopped', this.isStopped)
  if (callback) {callback()}
};

MonitorSchema.methods.pollChecks = function(options, errback) {
  errback = errback || utils.errback

  function updatePoller(poller) {
    var UpdatedModel = utils.applyPlugin({type: poller.type}, BasePoller)
    return UpdatedModel(poller)
  }

  if (options && options.checks && options.poller) {
    var poller = updatePoller(options.poller)
    return async.each(options.checks, poller.poll.bind(poller), errback)
  }

  function poll (check, errback) {
    updatePoller(check.poller).poll(check, errback)
  }

  function callback (checks) {async.each(checks, poll, errback)};

  promise = BasePoller.find({monitor: this._id}).exec()
  promise.addErrback(errback)
  promise.addCallback(function (pollers) {
    pollerIds = pollers.map(function(poller) {return poller._id})
    Check.needingPoll(pollerIds, callback)
  });
};

module.exports = mongoose.model('Monitor', MonitorSchema);
