/**
 * Module dependencies.
 */

var util  = require('util');
var https = require('https');
var http  = require('http');
var url   = require('url');
var fs    = require('fs');
var ejs   = require('ejs');
var request = require('request')
var BaseHttpPoller = require('../http/baseHttpPoller');


// The http module lacks proxy support. Let's monkey-patch it.
require('../../proxy');

/**
 * HTTPS Poller, to check web pages served via SSL
 *
 * @param {Mixed} Poller Target (e.g. URL)
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function DigestPoller(target, timeout, callback) {
  DigestPoller.super_.call(this, target, timeout, callback);
}

util.inherits(DigestPoller, BaseHttpPoller);

DigestPoller.type = 'digest-bbia-vpa-10.3.0';

DigestPoller.validateTarget = function(target) {
  return url.parse(target).protocol == 'https:';
};

/**
 * Launch the actual polling
 *
 * @api   public
 */
DigestPoller.prototype.poll = function(secure) {
  DigestPoller.super_.prototype.poll.call(this);
    var that = this;
  secure = typeof secure !== 'undefined' ? secure : true;
    var options = {
        uri: this.target,
        auth: {
            user: '//user',
            pass: '//password',
            sendImmediately: false
        }
    };
  try {
      this.request = request(options, function(error, response, body){
          if (!error && response.statusCode == 200){
              console.log('body : ' + body);
              that.onResponseCallback(response);
          }
          else{
              console.log("Error URI: ",that.target);
              var errorResponse = { name: "Error", message: "Undefined Error"};
              if(response){
                  console.log('Code : ' + response.statusCode);
                  errorResponse = { name: "Response Error", message: response.statusCode }
              } else if(error){
                  errorResponse = { name: error.code, message: error }
              }
              console.log('error : ' + error);
              console.log('body : ' + body);
              that.onErrorCallback(errorResponse);
          }
      });
  } catch(err) {
    return this.onErrorCallback(err);
  }
  this.request.on('error', this.onErrorCallback.bind(this));
};

DigestPoller.prototype.onResponseCallback = function(res) {
    var statusCode = res.statusCode.toString();
    console.log(statusCode);
    if (statusCode.match(/3\d{2}/)) {
        return this.handleRedirectResponse(res); // abstract, see implementations in http and https
    }
    if (statusCode.match(/2\d{2}/) === null) {
        return this.handleErrorResponse(res);
    }
    this.handleOkResponse(res);
};

DigestPoller.prototype.handleOkResponse = function(res) {
    var poller = this;
    var body = '';
    this.debug(this.getTime() + "ms - Status code 200 OK");
    body = res.body;
    res.body = body;
    poller.timer.stop();
    poller.debug(poller.getTime() + "ms - Request Finished");
    poller.callback(undefined, poller.getTime(), res);

};

// see inherited function BaseHttpPoller.prototype.onErrorCallback

DigestPoller.prototype.handleRedirectResponse = function(res) {
  this.debug(this.getTime() + "ms - Got redirect response to " + this.target.href);
  var target = url.parse(res.headers.location);
  if (!target.protocol) {
    // relative location header. This is incorrect but tolerated
    this.target = url.parse('http://' + this.target.hostname + res.headers.location);
    this.poll(false);
    return;
  }
  switch (target.protocol) {
    case 'https:':
      this.target = target;
      this.poll(true);
      break;
    case 'http:':
      this.target = target;
      this.poll(false);
      break;
    default:
      this.request.abort();
      this.onErrorCallback({ name: "WrongRedirectUrl", message: "Received redirection from https: to unsupported protocol " + target.protocol});
  }
  return;
};

module.exports = DigestPoller;