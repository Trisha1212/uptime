var parse = require('url').parse
  , baseHttpPoller = require('./baseHttpPoller')

var exports = module.exports = function httpPollerPlugin (schema) {
  function validProtocol (protocol) {
    return !protocol || protocol == 'http:'
  };

  function redirect (res) {
    return validProtocol(parse(res.href).protocol)
  };

  schema.plugin(baseHttpPoller, {redirect: redirect, strictSSL: false});

  schema.methods.validateUrl = function(url) {
    return validProtocol(parse(url).protocol);
  };
}
