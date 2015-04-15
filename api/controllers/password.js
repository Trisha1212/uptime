exports = module.exports = {
  reset: function(req, res) {
    var failOpts = {status: 500, source: 'reset'}
      , id = req.query.key
      , query = User.model.findOne({resetPasswordKey: id})

    return query.exec(function(err, user) {
      var message;

      if (err) {
        failOpts.err = err
      } else if (!user) {
        failOpts.err = {message: "Couldn't find a matching user account."}
      } else if (!(req.body.password && req.body.confirmPassword)) {
        failOpts.err = {message: "Please enter, and confirm your new password."};
      } else if (req.body.password === !req.body.confirmPassword) {
        failOpts.err = {message: "Please make sure both passwords match."};
      } else {
        user.password = req.body.password;
        user.resetPasswordKey = null;
        user.save(function(err) {
          var options;

          if (err) {
            utils.sendResponse(res, null, _.extend({err: err}, failOpts));
          } else {
            options = {message: 'Your password has been reset, please sign in.'};
            return utils.sendResponse(res, {result: true}, options);
          }
        });
      }

      if (failOpts.err) {utils.sendResponse(res, null, failOpts)}
    });
  },

  recover: function(req, res) {
    var failOpts = {status: 500, source: 'recover'}
      , id = req.body.email

    if (!id) {
      failOpts.err = {message: 'You must provide an email address.'};
      utils.sendResponse(res, null, failOpts);
    }

    User.model.findOne({email: id}, function(err, user) {
      if (err) {
        utils.sendResponse(res, null, _.extend({err: err}, failOpts));
      } else if (!user) {
        err = {message: "Couldn't find a matching user account."}
        utils.sendResponse(res, null, _.extend({err: err}, failOpts));
      } else {
        user.sendPasswordResetLink(function(err) {
          var options
            , result = false

          if (err) {
            failOpts.err = err
            options = failOpts
          } else {
            options = {message: "Your password recovery email has been sent."};
            result = true
          }

          utils.sendResponse(res, {result: result}, options);
        });
      }
    });
  }
};
