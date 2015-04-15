var exports
  , winston = require('winston')
  , papertrail = require('winston-papertrail').Papertrail
  , mongoose = require('mongoose')
  , moment = require('moment')
  , _ = require('underscore')
  , util = require('util')
  , Check = require('./models/check')
  , transports = []
  , env = process.env.NODE_ENV || 'development';

function winstonConsole () {
  transports.push(new winston.transports.Console({colorize: true}));
}

function winstonFile (options) {
  transports.push(new winston.transports.File(options));
}

function winstonPapertrail () {
  var options = {
    handleExceptions: true,
    host: 'logs.papertrailapp.com',
    port: 55976,
    colorize: true
  }

  transports.push(new papertrail(options));
}

if (env == 'development') {
  winstonConsole();
  winstonFile({filename: 'server.log', maxsize: 2097152});
} else if (env == 'test') {
  winstonConsole();
} else if (env == 'production') {
  winstonPapertrail();
}

logger = new winston.Logger({transports: transports});

exports = module.exports = {
  objectify: function(collection) {
    var i, len
      , results = []

    for (i = 0, len = collection.length; i < len; i++) {
      results.push([collection[i]._id, collection[i]]);
    }

    return _.object(results);
  },

  applyPlugin: function(options, Model) {
    var name = Model.modelName
      , Plugin = require('./plugins/' + name + 's/' + options.type + name)
      , Schema = Model.schema

    Schema.plugin(Plugin, options)
    return mongoose.model(options.type + name, Schema, name + 's')
  },

  augmentBody: function(req) {
    if (req.check) {req.body.check = req.check._id};
    if (req.tag) {req.body.tags = [req.tag._id]};
    if (req.tags) {req.body.tags = req.tags};
    return req.body
  },

  parseRequest: function(req) {
    var options = _(req.query).extend(req.params)
      , period = options.period
      , date = new Date(parseInt(options.timestamp))
      , query = {}

    if (options.tag) {query.tags = options.tag};
    if (options.check) {query.check = options.check};

    return {
      // second, minute, hour, day, week, month, or year
      period: period,
      single: options.single,
      begin: options.begin || moment(date).clone().startOf(period).toDate(),
      end: options.end || moment(date).clone().endOf(period).toDate(),
      limit: options.limit || 50,
      page: options.page || 1,
      sort: options.sort || {isUp: 1, lastChanged: -1, timestamp: -1},
      query: options.check || {}
    }
  },

  cleanup: function(model, maxAge, callback) {
    maxAge = maxAge || 1000 * 60 * 60 * 24 * 30 * 3
    var oldestDateToKeep = new Date(Date.now() - maxAge);
    model.find({timestamp: {$lt: new Date(oldestDateToKeep)}}).remove(callback);
  },

  durations: {
    'second': 1000,
    'minute': 1000 * 60,
    'hour': 1000 * 60 * 60,
    'day': 1000 * 60 * 60 * 24,
    'month': 1000 * 60 * 60 * 24 * 30,
    'year': 1000 * 60 * 60 * 24 * 30 * 12
  },

  findCheck: function(Model, callback) {
    return Check.findById(Model.check, callback);
  },

  logger: logger,
  env: env,
  errback: function(err) {if (err) logger.error(err)},

  sendResponse: function(res, response, options) {
    var options = options || {}
      , status = options.status || 200
      , source = options.source
      , message = options.message
      , json = {source: source}

    if (options.err) {
      message = message ? message + " Please try again." : message;
      message += ' (' + source + ')';
      json.error = options.err;
    }

    if (response) {json.objects = response}
    res.status(status)
    res.json(json)
    // if (message) {debug(message)}
  }
};
