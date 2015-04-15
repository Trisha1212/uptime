var mongoose = require('mongoose')
  , Schema = mongoose.Schema

var TagSchema = new Schema({
  name: {type: String, unique: true, required: true},
  checks: [{type: Schema.ObjectId, ref: 'Check'}],
  events: [{type: Schema.ObjectId, ref: 'Event'}],
  pings: [{type: Schema.ObjectId, ref: 'Ping'}],
  stats: [{type: Schema.ObjectId, ref: 'Stat'}],
});

TagSchema.index({owner: 1});
TagSchema.set('autoIndex', false);

TagSchema.methods.parse = function(tags, callback) {
  if (tags && typeof(tags) === 'string') {
    var tags = tags.replace(/\s*,\s*/g, ',').split(',');
    this.find({name: {$in: tags}}, function(err, tags) {
      parsedTags = tags.map(function (tag) {return tag._id});
      callback(err, parsedTags)
    });
  }
  callback()
};

module.exports = mongoose.model('Tag', TagSchema);
