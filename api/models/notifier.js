var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , lifecycle = require('mongoose-lifecycle')

var NotifierSchema = new Schema({
  owner: {type: Schema.ObjectId, ref: 'User', required: true}
  , check: {type: Schema.ObjectId, ref: 'Check', required: true}
  , type: {type: String, required: true}
  , settings: [{type: Schema.ObjectId, ref: 'Setting'}]
});

NotifierSchema.plugin(lifecycle);

NotifierSchema.methods.notify = function(event, check, callback) {
  utils.errback('Override this notifier method (notify) in the plugin')
  callback()
}

module.exports = mongoose.model('Notifier', NotifierSchema);
