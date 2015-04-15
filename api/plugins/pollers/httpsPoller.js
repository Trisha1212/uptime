var parse = require('url').parse
  , baseHttpPoller = require('./baseHttpPoller')

var exports = module.exports = function httpsPollerPlugin (schema, options) {
  function validProtocol (protocol) {
    return !protocol || protocol == 'http:' || protocol == 'https:';
  };

  function redirect (res) {
    return validProtocol(parse(res.href).protocol);
  };

  var baseOptions = {
    redirect: redirect
    , strictSSL: options.strictSSL ? options.strictSSL : true
  }

  schema.plugin(baseHttpPoller, baseOptions);

  schema.methods.validateUrl = function(url) {
    return validProtocol(parse(url).protocol);
  };
}
