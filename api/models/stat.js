var mongoose = require('mongoose')
  , Schema = mongoose.Schema

var StatSchema = new Schema({
  end: Number,
  availability: Number,
  responsiveness: Number,
  responseTime: Number,
  outages: {type: Array, default: []}
});

StatSchema.index({check: 1, timestamp: -1}, {unique: true});
StatSchema.index({tag: 1, timestamp: -1});
StatSchema.set('autoIndex', false);

StatSchema.methods.clean = function(duration) {
  timestamp = Date.parse(this.timestamp)

  return {
    timestamp: timestamp,
    availability: (this.availability * 100).toFixed(3),
    responsiveness: (this.responsiveness * 100).toFixed(3),
    downtime: parseInt(this.downtime / 1000),
    responseTime: parseInt(this.responseTime),
    outages: this.outages,
    end: this.end || timestamp + duration,
    check: this.check,
    tag: this.tag
  }
};

StatSchema.methods.getStatsForPeriod = function(options) {
  return this.find({_id: {$in: options.doc.stats}})
    .where('timestamp').gte(options.begin).lte(options.end)
};

module.exports = mongoose.model('Stat', StatSchema);
