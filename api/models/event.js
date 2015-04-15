require('coffee-script/register')

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , lifecycle = require('mongoose-lifecycle')
  , expire = require('../plugins/general/autoExpire')
  , config = require('../../config/default')

var EventSchema = new Schema({
  owner: {type: Schema.ObjectId, ref: 'User', required: true},
  check: {type: Schema.ObjectId, ref: 'Check', required: true},
  timestamp: {type: Number, default: Date.now()},
  status: String,
  details: String,
  // tags: [{type: Schema.ObjectId, ref: 'Tag'}],
});

EventSchema.plugin(lifecycle);
EventSchema.plugin(expire, config.retention);
EventSchema.index({check: 1, timestamp: -1});
EventSchema.set('autoIndex', false);

EventSchema.virtual('date').get(function () {
  return new Date(this.timestamp)
});

module.exports = mongoose.model('Event', EventSchema);
