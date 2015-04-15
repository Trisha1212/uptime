/**
 * Email plugin
 *
 * Notifies all events (up, down, paused, restarted) by email
 *
 * Installation
 * ------------
 * This plugin is disabled by default. To enable it, add its entry
 * to the `plugins` key of the configuration:
 *
 *   // in config/production.yaml
 *   plugins:
 *     - ./plugins/email
 *
 * Usage
 * -----
 * This plugin sends an email each time a check is started, goes down, or goes back up.
 * When the check goes down, the email contains the error details:
 *
 *   Object: [Down] Check "FooBar" just went down
 *   On Thursday, September 4th 1986 8:30 PM,
 *   a test on URL "http://foobar.com" failed with the following error:
 *
 *     Error 500
 *
 *   Uptime won't send anymore emails about this check until it goes back up.
 *   ---------------------------------------------------------------------
 *   This is an automated email sent from Uptime. Please don't reply to it.
 *
 * Configuration
 * -------------
 * Here is an example configuration:
 *
 *   // in config/production.yaml
 *   email:
 *     method: SMTP  # possible methods are SMTP, SES, or Sendmail
 *     transport: # see https://github.com/andris9/nodemailer for transport options
 *       service: Gmail
 *       auth:
 *         user: foobar@gmail.com
 *         pass: gursikso
 *     event:
 *       up: true
 *       down: true
 *       paused: false
 *       restarted: false
 *     message:
 *       from: 'Fred Foo <foo@blurdybloop.com>'
 *       to: 'bar@blurdybloop.com, baz@blurdybloop.com'
 *     # The email plugin also uses the main `url` param for hyperlinks in the sent emails
 */
var fs = require('fs');
var nodemailer = require('nodemailer');
var moment = require('moment');
var ejs = require('ejs');

var exports = module.exports = function emailNotifierPlugin (schema, options) {
  var config = options.config.email
    , mailer = nodemailer.createTransport(config.method, config.transport)
    , templateDir = __dirname + '/views/'

  schema.methods.notify = function(event, check, callback) {
    var filename = templateDir + event.message + '.ejs';
    var renderOptions = {
      check: check,
      event: event,
      url: options.config.url,
      moment: moment,
      filename: filename
    };
    var lines = ejs.render(fs.readFileSync(filename, 'utf8'), renderOptions).split('\n');
    var mailOptions = {
      from: config.message.from,
      bcc: check.notifiers.email.value,
      subject: lines.shift(),
      cc: event.tags.filter(function(value) {
        return value.indexOf('mailto:') != -1;
      }).map(function(value) {
        return value.split('mailto:')[1];
      }).join(', '),
      text: lines.join('\n')
    };
    mailer.sendMail(mailOptions, callback);
  }
};
