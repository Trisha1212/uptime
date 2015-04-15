var passport = require('passport')
  , BasicStrategy = require('passport-http').BasicStrategy
  , AnonymousStrategy = require('passport-anonymous').Strategy
  , JWTStrategy = require('passport-jwt').Strategy
  , User = require('./models/user')
  , Check = require('./models/check')
  , Tag = require('./models/tag')
  , utils = require('./utils')
  , config = require('../config/default')

passport.use(new BasicStrategy(
  function(email, password, callback) {
    User.findOne({email: email}, function (err, user) {
      if (err) {return callback(err)}
      if (!user) {return callback(null, false)}

      user.verifyPassword(password, function(err, match) {
        if (err) {return callback(err)}
        if (!match) {return callback(null, false)}
        return callback(null, user);
      });
    });
  }
));

var jwt_options = {
  secretOrKey: config.jwt.secret,
  issuer: config.jwt.issuer,
  audience: config.jwt.audience,
  tokenBodyField: config.jwt.field,
  authScheme: config.jwt.scheme
}

passport.use(new JWTStrategy(jwt_options, function(payload, callback) {
  User.findById(payload.sub, callback);
}));

passport.use(new AnonymousStrategy());

function getPluginType (req, model) {
  var type = null

  if (model == 'poller') {
    type = req.params.type || 'http'
  } else if (model == 'notifier') {
    type = req.params.type || 'console'
  }

  return type
}

var options = {session: false};

var exports = module.exports = {
  isAuthenticated: passport.authenticate(['basic', 'jwt'], options),
  maybeAuthenticated: passport.authenticate(['basic', 'jwt', 'anonymous'], options),

  hydrate: function(req, res, next) {
    var model = req.url.split('/')[1]
      , Model = require('./models/' + model)
      , options = req.user ? {owner: req.user._id} : {}
      , type = getPluginType(req, model)

    UpdatedModel = type ? utils.applyPlugin({type: type}, Model) : Model
    req.ownedQuery = UpdatedModel.where(options)
    next();
  },

  create: function(req, res, next) {
    var model = req.url.split('/')[1]
      , Model = require('./models/' + model)
      , type = getPluginType(req, model)

    req.Model = type ? utils.applyPlugin({type: type}, Model) : Model
    req.body.owner = req.user._id
    req.body.type = type
    next();
  },

  loadCheck: function(req, res, next) {
    var id = req.params.id || req.body.id
    promise = Check.findById(id).select('-qos').lean().exec()
    promise.addErrback(function(err) {return next(err)})
    promise.then(function(check) {
      // if (!check) {res.send('No check with id ' + id, 404)}
      req.check = check;
      next();
    });
  },

  loadTag: function(req, res, next) {
    var id = req.params.id || req.body.id
    promise = Tag.findOne({name: id}).lean().exec()
    promise.addErrback(function(err) {return next(err)})
    promise.then(function(tag) {
      // if (!tag) {res.send('No tag with id ' + id, 404)}
      req.tag = tag;
      next();
    });
  },

  populateTags: function(req, res, next) {
    Tag.parse(req.body.tags, function(tags) {
      req.tags = tags;
      next();
    });
  },

  configCORS: function(req, res, next) {
    if (!req.get('Origin')) {return next()}
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,PATCH,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    if ('OPTIONS' === req.method) {return res.send(200)}
    next();
  }
};
