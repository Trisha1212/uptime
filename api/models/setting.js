var mongoose = require('mongoose')
  , Schema = mongoose.Schema

var SettingSchema = new Schema({
  key: {type: String, required: true},
  value: {type: String, required: true},
  isDefault: {type: Boolean, default: false},
});

module.exports = mongoose.model('Setting', SettingSchema);
