require('coffee-script/register')

var exports, sendUserInfo
  , utils = require('../utils')
  , async = require('async')
  , _ = require('underscore')
  , moment = require('moment')
  , User = require('../models/user')
  , config = require('../../config/default')
  , errorStatus = 500

exports = module.exports = {
  userInfo: function(req, res) {
    user = req.user || 'anon'
    utils.sendResponse(res, {user: user});
  },

  sendVerification: function(req, res) {
    var failOpts = {status: errorStatus, source: 'sendVerification'};

    return req.user.sendUserVerificationLink(function(err) {
      var message, options
        , result = false

      if (err) {
        message = "Couldn't send your account verification email.";
        options = _.extend({message: message, err: err}, failOpts);
      } else {
        options = {message: "Your account verification email has been sent."};
        result = true
      }

      utils.sendResponse(res, {result: result}, options);
    });
  },

  verify: function(req, res) {
    var failOpts = {status: errorStatus, source: 'verify'}
      , id = req.query.key
      , query = User.findOne({accountVerificationKey: id})

    var user_callback = function(err, user) {
      var message, options
        , result = false

      if (err) {
        message = "Error verifying user account.";
        options = _.extend({message: message, err: err}, failOpts)
      } else {
        user.notifyAdmins();
        options = {message: 'Your account has been verified!'};
        result = true
      }

      utils.sendResponse(res, {result: result}, options);
    };

    query.exec(function(err, user) {
      if (err) {
        utils.sendResponse(res, null, _.extend({err: err}, failOpts));
      } else if (!user) {
        err = {message: "Couldn't find a matching user account."}
        utils.sendResponse(res, null, _.extend({err: err}, failOpts));
      } else {
        user.isVerified = true;
        user.accountVerificationKey = null;
        user.save(function(err) {user_callback(err, user)});
      }
    });
  },

  signup: function(req, res) {
    var checkEmail, createUser, validateForm, verifyEmail
      , newUser = null
      , verificationErr = null
      , form = req.body
      , failOpts = {status: errorStatus, source: 'signup'}

    validateForm = function(next, form) {
      var err = null

      if (
        !_.every([
          form.name,
          form.email,
          form.password,
          form.confirmPassword,
        ])
      ) {
        err = {message: "You must fill out the entire form."};
      } else if (form.password === !form.confirmPassword) {
        err = {message: "Please make sure both passwords match."};
      };

      next(err);
    };

    checkEmail = function(next, form) {
      var id = form.email
        , query = User.findOne({email: id});

      console.log("Checking if " + id + " already exists");

      query.exec(function(err, user) {
        if (user) {
          failOpts.status = 409
          err = {message: "The account " + id + " is already registered."}
        };

        next(err);
      });
    };

    createUser = function(next, form) {
      console.log('Creating new user...');
      newUser = new User(form);
      newUser.isVerified = false
      // newUser.notificationSettings = [
      //   {name: 'email'}, {name: 'pushbullet'}, {name: 'statushub'}
      // ];

      newUser.save(function(err) {
        var result = null

        if (!err) {
          var expiration = moment().add('days', config.jwt.duration)
            , token = newUser.issueToken(expiration.unix())

          result = {id: newUser._id, jwt: token, exp: Date(expiration)}
        };

        next(err, result);
      });
    };

    verifyEmail = function(next, user) {user.sendUserVerificationLink(next)};

    async.series({
      'form': function(next) {validateForm(next, form)},
      'check': function(next) {checkEmail(next, form)},
      'create': function(next) {createUser(next, form)},
      // 'verify': function(next) {verifyEmail(next, newUser)},
    },

    function(err, results) {
      var message

      if (results.create) {
        message = "Successfully created user " + newUser.email + "!"
      } else {
        message = "Could not create new user.";
      };

      if (results.verify) {
        message += " Your account verification email has been sent.";
      } else {
        message += " Could not send your account verification email.";
      };

      options = _.extend({message: message, err: err}, failOpts)
      return utils.sendResponse(res, results.create, options);
   });
  }
};
