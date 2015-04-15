var mongoose = require('mongoose')
  , _ = require('underscore')
  , Schema = mongoose.Schema
  , Ping = require('./ping')
  , config = require('../../config/default')
  , utils = require('../utils')

var PollerSchema = new Schema({
  owner: {type: Schema.ObjectId, ref: 'User', required: true}
  , monitor: {type: Schema.ObjectId, ref: 'Monitor', required: true}
  , timeout: {type: Number, default: config.timeout}
  , userAgent: {type: String, default: config.userAgent}
  , type: {type: String, required: true}
  // , settings: [{type: Schema.ObjectId, ref: 'Setting'}]
  // , checks: [{type: Schema.ObjectId, ref: 'Check'}]
});

PollerSchema.methods.validateUrl = function(url) {
  utils.errback('Override this poller method (validateUrl) in the plugin')
  return true
};

PollerSchema.methods.poll = function(check) {
  utils.errback('Override this poller method (poll) in the plugin')
  return {}
};

PollerSchema.methods.ping = function(options) {
  Ping.create(options, utils.errback);
}

module.exports = mongoose.model('Poller', PollerSchema);
