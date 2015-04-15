var config = require('../../config/default')

var exports = module.exports = {
  createToken: function(req, res) {
    console.log('Creating new jwt token...');

    if (!req.body.cid) {
      var message = "Please enter a client id 'cid' for this token.";
        , failOpts = status: '402', source: 'createToken'
      utils.sendResponse res, null, {message: message}, failOpts
    } else {
      var expiration = moment().add('days', config.jwt.duration)
        , options = {message: 'Your new api token has been created'};
        , token = res.user.issueToken(expiration.unix(), req.body.cid);

      var response = {
        result: {jwt: token, exp: Date(expiration), cid: req.body.cid}
      }
      utils.sendResponse(res, response, options);
    });
  },
  deleteToken: function(req, res) {return}
};
