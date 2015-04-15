var request = require('request')
  , moment = require('moment')
  , _ = require('underscore')

var exports = module.exports = function baseHttpPollerPlugin (schema, options) {
  schema.methods.poll = function(check, errback) {
    var reqOptions = {
      uri: check.url
      , headers: {'User-Agent': this.userAgent}
      , timeout: this.timeout
      , strictSSL: options.strictSSL
      , followRedirect: options.redirect
    }

    this.check = check
    console.log('polling ' + check.url + ' at ' + new Date())
    request.get(reqOptions, this.resback.bind(this))
    errback()
  }

  schema.methods.resback = function(err, res, body) {
    var date, time, statusCode, options, size

    if (err && err.code.indexOf('TIMEDOUT') != -1) {
      err.message = 'Request timed out.'
      time = this.timeout
      statusCode = 408
    } else {
      statusCode = 500
    };

    if (err) {
      options = {
        err: err
        , isResponsive: false
        , isComplete: false
        , isValid: false
      }
    } else {
      date = moment(new Date(res.headers['date']))
      time = moment(Date.now()).diff(date)
      size = parseInt(res.headers['content-length'])
      statusCode = res.statusCode

      options = {
        type: res.headers['content-type']
        , size: size
        , timestamp: date.unix()
        , isResponsive: time <= this.check.maxTime
        , isComplete: size >= this.check.minSize
        , isValid: this.check.validateResponse(body)
      }
    }

    this.ping(
      _(options).extend({
        check: this.check._id
        , owner: this.check.owner
        , time: time
        // , body: body
        , statusCode: statusCode
      })
    );
  };
};
