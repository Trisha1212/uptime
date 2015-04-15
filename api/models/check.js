require('./poller')

var _ = require('underscore')
  , async = require('async')
  , mongoose = require('mongoose')
  , moment = require('moment')
  , Schema = mongoose.Schema
  , lifecycle = require('mongoose-lifecycle')
  , Ping = require('./ping')
  , config = require('../../config/default')

var CheckSchema = new Schema({
  owner: {type: Schema.ObjectId, ref: 'User', required: true}
  , poller: {type: Schema.ObjectId, ref: 'Poller', required: true}
  , url: {type: String, required: true}
  , interval: {type: Number, default: config.checkInterval}
  , maxTime: {type: Number, default: config.maxResponseTime}
  , minSize: {type: Number, default: config.minResponseSize}
  , alertThreshold: {type: Number, default: 1}
  , errorCount: {type: Number, default: 0}
  , lastChanged: {type: Number, default: Date.now()}
  , lasttime: {type: Number, default: Date.now()}
  , isUp: Boolean
  , isPaused: {type: Boolean, default: false}
  , prevStatus: String
  , toggled: {type: Boolean, default: false}
  , responsePattern: String
  , responsePath: [String]
  // notifiers: [{type: Schema.ObjectId, ref: 'Notifier'}],
  // tags: [{type: Schema.ObjectId, ref: 'Tag'}],
  // events: [{type: Schema.ObjectId, ref: 'Event'}],
  // pings: [{type: Schema.ObjectId, ref: 'Ping'}],
  // stats: [{type: Schema.ObjectId, ref: 'Stat'}],
});

CheckSchema.plugin(lifecycle);

CheckSchema.virtual('uptime').get(function () {
  return this.isUp ? Date.now() - this.lastChanged : 0;
});

CheckSchema.virtual('downtime').get(function () {
  return this.isUp ? 0 : Date.now() - this.lastChanged;
});

CheckSchema.virtual('status').get(function () {
  return this.isPaused ? 'paused' : this.isUp ? 'up' : 'down';
});

CheckSchema.methods.validateResponse = function (body) {
  if (!this.responsePattern) {return true}

  var matchPattern = '^/(.*?)/(g?i?m?y?)$'
    , matchParts = this.responsePattern.match(new RegExp(matchPattern))
    , regexp = new RegExp(matchParts[1], matchParts[2])

  if (this.responsePath) {
    function reducer (value, key) {return value[key]}
    var response = _(this.responsePath).reduce(reducer, body)
  } else {
    var response = body
  }

  return response.match(regexp)
};

CheckSchema.methods.getFirstPing = function (callback) {
  Ping.aggregate(
    {$match: {check: this._id}},
    {$project: {timestamp: 1}},
    {$group: {_id: null, timestamp: {$min: "$timestamp"}}},
    function (err, pings) {
      firstPing = (pings.length == 0 || err) ? 0 : pings[0].timestamp
      callback(firstPing)
    });
};

CheckSchema.methods.getLastPing = function (callback) {
  Ping.aggregate(
    {$match: {check: this._id}},
    {$project: {timestamp: 1}},
    {$group: {_id: null, timestamp: {$max: "$timestamp"}}},
    function (err, pings) {
      lastPing = (pings.length == 0 || err) ? 0 : pings[0].timestamp
      callback(lastPing)
    });
};

CheckSchema.statics.needingPoll = function (poller_ids, callback) {
  function filterCheck (check, filterback) {
    check.getLastPing(function (lastPing) {
      filterback((Date.now() - lastPing) >= check.interval)
    });
  };

  query = this.find({isPaused: false, poller: {$in: poller_ids}})
  promise = query.populate('poller').exec()
  promise.addErrback(callback);
  promise.addCallback(function (checks) {
    async.filter(checks, filterCheck, callback);
  })
};

CheckSchema.methods.makeOptions = function(extra) {
  return _(extra).extend({
    check: this._id,
    tags: this.tags,
    owner: this.owner
  })
};

CheckSchema.methods.toggle = function() {
  this.lasttime = this.isUp ? this.uptime : this.downtime
  this.prevStatus = this.status
  this.lastChanged = Date.now()
  this.isUp = this.isPaused ? undefined : this.isUp
  this.isPaused = !this.isPaused;
  this.toggled = true
};

CheckSchema.methods.eventRequired = function(pingIsUp) {
  if (!pingIsUp) {this.errorCount++}
  if (this.isUp != pingIsUp) {
    this.lasttime = this.isUp ? this.uptime : this.downtime
    this.prevStatus = this.status
    this.lastChanged = Date.now()
  }

  required = (
    /* up ping after being down at or beyond threshold */
    (pingIsUp && this.errorCount >= this.alertThreshold)
    /* enough down pings to equal threshold */
    || (!pingIsUp && this.errorCount === this.alertThreshold))

  this.errorCount = pingIsUp ? 0 : this.errorCount
  this.isUp = pingIsUp
  return required
};

CheckSchema.statics.findForTag = function(owner, tag, callback) {
  return this.find({owner: owner, tags: tag}).exec(callback);
};

module.exports = mongoose.model('Check', CheckSchema);
