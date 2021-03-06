/*
 * Monitor remote server uptime.
 */

if (process.argv.length == 3) {
	var _env = process.argv[2];
	if(_env.length){
	    process.env.NODE_ENV = _env;
	}
}

var http       = require('http');
var https      = require('https');
var url        = require('url');
var express    = require('express');
var config     = require('config');
var socketIo   = require('socket.io');
var fs         = require('fs');
var monitor    = require('./lib/monitor');
var analyzer   = require('./lib/analyzer');
var CheckEvent = require('./models/checkEvent');
var Account = require('./models/user/accountManager');
var Ping       = require('./models/ping');
var PollerCollection = require('./lib/pollers/pollerCollection');
var apiApp     = require('./app/api/app');
var dashboardApp = require('./app/dashboard/app');
var cookieParser = express.cookieParser('Z5V45V6B5U56B7J5N67J5VTH345GC4G5V4');
var connect = require('connect');
var spdy = require('spdy');
// database
process.on('uncaughtException', function(err) {
  console.error('Caught exception: ' + err);
});

var mongoose   = require('./bootstrap');

var a = analyzer.createAnalyzer(config.analyzer);
a.start();

// web front

var app = module.exports = express();
if (config.ssl && config.ssl.enabled === true) {
  if (typeof(config.ssl.certificate) === 'undefined') {
    throw new Error("Must specify certificate to enable SSL!");
  }
  if (typeof(config.ssl.key) === 'undefined') {
    throw new Error("Must specify key file to enable SSL!");
  }
  var options = {
    cert: fs.readFileSync(config.ssl.certificate),
    key: fs.readFileSync(config.ssl.key)
  };
  var server = spdy.createServer(options, app);
} else {
  var server = http.createServer(app);
}

app.configure(function(){
  app.disable('x-powered-by');
  app.use(express.cookieParser('Z5V45V6B5U56B7J5N67J5VTH345GC4G5V4'));
  app.use(express.cookieSession({
    key:    'uptime',
    secret: 'FZ5HEE5YHD3E566756234C45BY4DSFZ4',
    proxy:  true,
    cookie: { maxAge: 24*60 * 60 * 1000 }
  }));
  app.use(app.router);
  // the following middlewares are only necessary for the mounted 'dashboard' app,
  // but express needs it on the parent app (?) and it therefore pollutes the api
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.set('pollerCollection', new PollerCollection());
});

// load plugins (may add their own routes and middlewares)
config.plugins.forEach(function(pluginName) {
  var plugin = require(pluginName);
  if (typeof plugin.initWebApp !== 'function') return;
  console.log('loading plugin %s on app', pluginName);
  plugin.initWebApp({
    app:       app,
    api:       apiApp,       // mounted into app, but required for events
    dashboard: dashboardApp, // mounted into app, but required for events
    io:        io,
    config:    config,
    mongoose:  mongoose
  });
});

app.emit('beforeFirstRoute', app, apiApp);

app.configure('development', function() {
  if (config.verbose) mongoose.set('debug', true);
  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
  var oneYear = 31557600000;
  app.use(express.static(__dirname + '/public', { maxAge: oneYear }));
  app.use(express.errorHandler());
});

// CORS
if (config.enableCORS) {
    app.use(function(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        next();
    });
}

// Routes
app.emit('beforeApiRoutes', app, apiApp);
app.use('/api', apiApp);

app.emit('beforeDashboardRoutes', app, dashboardApp);
app.use('/dashboard', dashboardApp);
app.get('/', function(req, res) {
  if(req.cookies.user && req.cookies.pass){
    Account.findOne({user: req.cookies.user, pass: req.cookies.pass},function(e,r){
      if(r){
        req.session.user = r;
        res.redirect('/dashboard/events');
      } else {
        res.redirect('/dashboard/logout');
      }
    });
  } else {
    if (req.session.user == undefined) {
      res.redirect('/dashboard/login');
    } else {
      res.redirect('/dashboard/events');
    }
  }

});

app.get('/favicon.ico', function(req, res) {
  res.redirect(301, '/dashboard/favicon.ico');
});

app.emit('afterLastRoute', app);

// Sockets
var io = socketIo.listen(server);
var sessionStore = new connect.middleware.session.MemoryStore();
var SessionSockets = require('session.socket.io')
  , sessionSockets = new SessionSockets(io, sessionStore, cookieParser);

io.configure('production', function() {
  io.enable('browser client etag');
  io.set('log level', 1);
});

io.configure('development', function() {
  if (!config.verbose) io.set('log level', 1);
});
/*

 */
sessionSockets.on('connection', function (err, socket, session) {
  socket.on('set check', function(check) {
    socket.set('check', check);
    //session.check = check;
    //session.save();
  });
  Ping.on('afterInsert', function(ping) {
    socket.get('check', function(err, check) {
      if (ping.check == check) {
        socket.emit('ping', ping);
      }
    });
  });
  CheckEvent.on('afterInsert', function(event) {
    socket.emit('CheckEvent', event.toJSON());
  });
});

// old way to load plugins, kept for BC
fs.exists('./plugins/index.js', function(exists) {
  if (exists) {
    var pluginIndex = require('./plugins');
    var initFunction = pluginIndex.init || pluginIndex.initWebApp;
    if (typeof initFunction === 'function') {
      initFunction({
        app:       app,
        api:       apiApp,       // mounted into app, but required for events
        dashboard: dashboardApp, // mounted into app, but required for events
        io:        io,
        config:    config,
        mongoose:  mongoose
      });
    }
  }
});

module.exports = app;

var monitorInstance;

//if (!module.parent) {
  var serverUrl = url.parse(config.url);
  var port;
  if (config.server && config.server.port) {
    console.error('Warning: The server port setting is deprecated, please use the url setting instead');
    port = config.server.port;
  } else {
    port = serverUrl.port;
    if (port === null) {
      port = config.ssl && config.ssl.enabled ? 443 : 80;
    }
  }

  port = process.env.PORT || port;
  var host = process.env.HOST || serverUrl.hostname;

  server.listen(port, function(){
    var prefix = (config.ssl.enabled) ? 'https://' : 'http://';
    host = prefix + host;
    console.log("Express server listening on %s:%d in %s mode", host, port, app.settings.env);
  });
  server.on('error', function(e) {
    if (monitorInstance) {
      monitorInstance.stop();
      process.exit(1);
    }
  });
//}

// monitor
if (config.autoStartMonitor) {
  monitorInstance = require('./monitor');
}
