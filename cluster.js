var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var config     = require('config');
var apiApp = require('./app/api/app');
var workers = [];
if (cluster.isMaster) {

  var broadcast = function(event) {
    for (var i in workers) {
      var worker = workers[i];
      worker.send(event);
    }
  };

  for (var i = 0; i < numCPUs; i++) {
    var worker = cluster.fork();
    worker.on('message', function(event) {
          //console.log('Got message',event);
          if(event.event && event.data){
            broadcast(event);
          } else{
            console.log(event)
          }
    });
    // Add the worker to an array of known workers
    workers.push(worker);
  }

  // we create a HTTP server, but we do not use listen
  // that way, we have a socket.io server that doesn't accept connections
  var server = require('http').createServer();
  var io = require('socket.io').listen(server)


  var RedisStore = require('socket.io/lib/stores/redis');
  var redis = require('socket.io/node_modules/redis');

  io.set('store', new RedisStore({
    redisPub: redis.createClient(),
    redisSub: redis.createClient(),
    redisClient: redis.createClient()
  }));
  cluster.on('exit', function(worker, code, signal) {
    console.log('worker %d died (%s). restarting...',
      worker.process.pid, signal || code);
    cluster.fork();
  });

} else {
  var monitorInstance;
  require("./app.js")(cluster,process);
}
