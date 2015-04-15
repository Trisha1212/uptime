require('coffee-script/register')

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , lifecycle = require('mongoose-lifecycle')
  , expire = require('../plugins/general/autoExpire')
  , config = require('../../config/default')

var PingSchema = new Schema({
  owner: {type: Schema.ObjectId, ref: 'User', required: true},
  check: {type: Schema.ObjectId, ref: 'Check', required: true},
  timestamp: {type: Number, default: Date.now()},
  statusCode: Number,
  body: String,
  type: String,
  size: Number,
  time: Number,
  err: String,
  isResponsive: Boolean,
  isComplete: Boolean,
  isValid: Boolean,
  // tags: [{type: Schema.ObjectId, ref: 'Tag'}],
});

PingSchema.virtual('json').get(function () {
  return this.type.indexOf('json') != -1 ? JSON.parse(this.body) : {};
});

PingSchema.virtual('isUp').get(function () {
  return !this.err && this.isResponsive && this.isComplete && this.isValid
});

PingSchema.virtual('status').get(function () {
  if (this.err) {
    return 'down';
  } else if (!this.isResponsive) {
    return 'unresponsive';
  } else if (!this.isComplete) {
    return 'incomplete';
  } else if (!this.isValid) {
    return 'invalid';
  } else if (this.isResponsive && this.isComplete && this.isValid) {
    return 'up';
  }
});

PingSchema.plugin(lifecycle);
PingSchema.plugin(expire, config.retention);
PingSchema.index({timestamp: -1});
PingSchema.index({check: 1});
PingSchema.set('autoIndex', false);

module.exports = mongoose.model('Ping', PingSchema);
