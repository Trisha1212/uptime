require('coffee-script/register')

var host, options, toobusyHandler, timeoutHandler, server, winstonStream
  , _ = require('underscore')
  , express = require('express')
  , router = express.Router()
  , async = require('async')
  , toobusy = require('toobusy-js')
  , morgan = require('morgan')
  , mongoose = require('mongoose')
  // , mongoose = require('./bootstrap')
  , passport = require('passport')
  , bodyParser = require('body-parser')
  , compression = require('compression')
  , timeout = require('connect-timeout')
  , middleware = require('./middleware')
  , routes = require('./routes')(router)
  , utils = require('./utils')
  , config = require('../config/default')

var mongo = config.mongo
  , connectionString = mongo.connectionString
  , prefix = mongo.user && mongo.pwd ? mongo.user + ':' + mongo.pwd + '@' : ''
  , defaultConnectionString = 'mongodb://' + prefix + mongo.server + '/' + mongo.db
  , conn = mongoose.connect(connectionString || defaultConnectionString)
  , Monitor = require('models/monitor')
  , Event = require('./models/event')
  , Check = require('./models/check')
  , BaseNotifier = require('./models/notifier')
  , BasePoller = require('./models/poller')
  , Ping = require('./models/ping')

Check.schema.path('url').validate(function(value, respond) {
  var query = BasePoller.findById(this.poller).select('validateUrl type')
  query.exec(function (err, poller) {
    if (err || !poller) {return respond(false)}
    var UpdatedModel = utils.applyPlugin({type: poller.type}, BasePoller)
    respond(UpdatedModel(poller).validateUrl(value));
  });
});

Check.on('beforeSave', function (check) {
  if (check.toggled) {
    var status = check.isPaused ? 'paused': 'restarted'
      , extra = {timestamp: Date.now(), status: status}
    Event.create(check.makeOptions(extra));
    check.toggled = false
  }
});

function updateInterval (check) {
  var query = BasePoller.findById(check.poller)
    , promise = query.populate('monitor').exec()

  promise.addErrback(errback)
  promise.addCallback(function (poller) {
    if (poller && !poller.monitor.isStopped) {
      poller.monitor.updateInterval(check, poller)
      poller.monitor.save()
    }
  });
};

Check.on('afterSave', function(check) {
  if (check.isModified('interval')) {updateInterval(check)}
});

Check.on('afterRemove', updateInterval)

Ping.on('afterInsert', function (ping) {
  var promise = Check.findById(ping.check).exec()
  promise.addErrback(utils.errback)
  promise.addCallback(function (check) {
    var eventRequired = check.eventRequired(ping.isUp)
    check.save(function (err, check) {
      utils.errback(err)
      if (eventRequired) {
        var whitelist = ['timestamp', 'status', 'err']
        Event.create(check.makeOptions(_(ping).pick(whitelist)));
      }
    })
  })
});

Event.on('afterInsert', function (event) {
  var promise = Check.findById(event.check).exec()
  promise.addErrback(utils.errback)
  promise.addCallback(function (check) {
    var subPromise = BaseNotifier.find({check: check._id}).exec()
    subPromise.addErrback(utils.errback)
    subPromise.addCallback(function (notifiers) {
      notifyFuncs = notifiers.map(function(notifier) {
        var UpdatedModel = utils.applyPlugin({type: notifier.type}, BaseNotifier)
        return UpdatedModel(notifier).notify
      })

      async.applyEach(notifyFuncs, event, check, utils.errback, utils.errback);
    })
  })
});

var port = process.env.PORT || 3333
  , encoding = {encoding: 'utf-8'}
  , sv_timeout = 250 * 1000
  , sv_retry_after = 5 * 1000
  , app = express()

if (process.env.NODETIME_ACCOUNT_KEY) {
  require('nodetime').profile({
    accountKey: process.env.NODETIME_ACCOUNT_KEY,
    appName: config.site.title
  });
}

if (utils.env == 'development' && config.verbose) {
  mongoose.set('debug', true);
}

toobusyHandler = function(req, res, next) {
  if (!toobusy() || !config.enable.toobusy) {next()}
  res.setHeader('Retry-After', sv_retry_after);
  res.location(req.url);
  var message = "server too busy. try " + req.url + " again later.";
  options = {message: message, status: 503, source: 'app'}
  utils.sendResponse(options.res, null, options);

};

timeoutHandler = function(err, req, res, next) {
  options = {err: err, status: 504, source: 'app'}
  utils.sendResponse(options.res, null, options);
};

haltOnTimedout = function(req, res, next) {if (!req.timedout) {next()}};

winstonStream = {
  write: function(message, encoding) {return utils.logger.info(message)}
};

// if (!process.env.NODE_ENV && process.argv.length == 3 && process.argv[2].length) {
//   process.env.NODE_ENV = process.argv[2];
// }

// // load plugins (may add their own routes and middlewares)
// config.plugins.forEach(function(pluginName) {
//   var plugin = require(pluginName);
//   plugin.initWebApp({
//     app: app,
//     config: config,
//     mongoose: mongoose
//   });
//   plugin.initMonitor({
//     monitor: monitor,
//     config: config
//   });
// });

// // patch in CLI options to specify your SSL stuff
// var cli_opts = getopt.create([
//   ['h', 'help', 'display this help'],
//   ['s', 'ssl', 'enable https server instead of http. requires options certificate and key.'],
//   ['c', 'certificate=ARG', 'SSL certificate'],
//   ['k', 'key=ARG', 'SSL private key']
// ]).bindHelp().parseSystem();

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// if (config.ssl && config.ssl.enabled === true) {
//   ssl = config.ssl
// } else if (cli_opts.options.ssl === true || cli_opts.options.s === true) {
//   ssl = cli_opts.options
//   ssl.enabled = true
// } else {
//   ssl = false
// }

// if (ssl.key and ssl.certificate) {
//   throw new Error("Must specify key and certificate file to enable SSL!");
//   var options = {
//     cert: fs.readFileSync(ssl.certificate),
//     key: fs.readFileSync(ssl.key)
//   };
// }

app.use(timeout(sv_timeout));
app.use(morgan('combined', {stream: winstonStream}));
app.use(haltOnTimedout);
app.use(bodyParser.urlencoded({extended: true}));
app.use(haltOnTimedout);
app.use(compression());
app.use(haltOnTimedout);
// app.use(toobusyHandler);
app.use(passport.initialize());

app.all('*', middleware.configCORS);

// Register all our routes with /api
// app.use('/api', routes);
app.use(routes);
app.use(timeoutHandler);

server = app.listen(port, function() {
  utils.logger.info("Listening on port " + port);
  // utils.logger.info("Listening on port " + port + 'via ' + ssl.enabled ? 'https' : 'http');
});

// server.on('error', utils.errback});

process.on('SIGINT', function() {
  server.close();
  toobusy.shutdown();
  process.exit();
});

// database
// process.on('uncaughtException', utils.errback);

// var a = analyzer.createAnalyzer(config.analyzer);
// a.start();

promise = Monitor.find({}).exec()
promise.addErrback(utils.errback);
promise.addCallback(function (monitors) {
  function start (monitor, errback) {
    if (monitor.isStopped) {return errback()}
    monitor.getMinInterval(errback, function(minInterval) {
      monitor.start(minInterval, errback)
    });
  }

  async.each(monitors, start, utils.errback)
})
