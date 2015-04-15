require('coffee-script/register')

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , bcrypt = require('bcrypt')
  , jwt = require('jsonwebtoken')
  , config = require('../../config/default')

var UserSchema = new Schema({
  firstName: {type: String, required: true},
  lastName: {type: String, required: true},
  email: {type: String, unique: true, required: true},
  password: {type: String, required: true},
  resetPasswordKey: String,
  accountVerificationKey: String,
  isVerified: {type: Boolean, default: false},
  // settings: [{type: Schema.ObjectId, ref: 'Setting'}],
  // checks: [{type: Schema.ObjectId, ref: 'Check'}],
  // events: [{type: Schema.ObjectId, ref: 'Event'}],
  // pings: [{type: Schema.ObjectId, ref: 'Ping'}],
  // stats: [{type: Schema.ObjectId, ref: 'Stat'}],
});

UserSchema.virtual('name').get(function () {
  return this.firstName + ' ' + this.lastName;
});

UserSchema.virtual('name').set(function (name) {
  var split = name.split(' ');
  this.firstName = split[0];
  this.lastName = split[1];
});

UserSchema.pre('save', function(next) {
  var user = this;

  // Break out if the password hasn't changed
  if (!user.isModified('password')) return next();

  // Password changed so we need to hash it
  bcrypt.hash(user.password, 10, function(err, hash) {
    if (!err) {user.password = hash};
    next(err);
  });
});

UserSchema.methods.verifyPassword = function(password, callback) {
  bcrypt.compare(password, this.password, callback);
};

UserSchema.methods.issueToken = function(timestamp, cid) {
  var payload = {sub: this._id, exp: timestamp, cid: cid}
  return jwt.sign(payload, config.jwt.secret);
};

UserSchema.methods.sendUserVerificationLink = function(callback) {
  var user = this;
  user.accountVerificationKey = crypto.randomBytes(32).toString('hex');
  user.save(function(err) {
    if (err) return callback(err)

    new keystone.Email('verify-account').send({
      user: user.name.first,
      host: config.host,
      client: config.client,
      link: "/verify?key=" + user.accountVerificationKey,
      subject: "Verify your " + config.brand + " User",
      to: user.email,
      from: {name: config.brand, email: config.email}
    }, callback);
  });
};

UserSchema.methods.sendPasswordResetLink = function(callback) {
  var user = this;
  user.resetPasswordKey = crypto.randomBytes(32).toString('hex');
  user.save(function(err) {
    if (err) return callback(err);

    new keystone.Email('forgotten-password').send({
      user: user.name.first,
      host: config.host,
      client: config.client,
      link: "/reset?key=" + user.resetPasswordKey,
      subject: "Reset your " + config.brand + " Password",
      to: user.email,
      from: {name: config.brand, email: config.email}
    }, callback);
  });
};

module.exports = mongoose.model('User', UserSchema);
