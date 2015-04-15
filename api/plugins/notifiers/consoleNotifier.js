var moment = require('moment')

/**
 * Console plugin
 *
 * Logs all events to the console
 *
 * Installation
 * ------------
 * Send a 'post' request to '/notifier/console' with data {'check': check_id}
 */

// ANSI color code outputs for strings
var ANSI_CODES = {
  "off": 0,
  "bold": 1,
  "italic": 3,
  "underline": 4,
  "blink": 5,
  "inverse": 7,
  "hidden": 8,
  "black": 30,
  "red": 31,
  "green": 32,
  "yellow": 33,
  "blue": 34,
  "magenta": 35,
  "cyan": 36,
  "white": 37,
  "black_bg": 40,
  "red_bg": 41,
  "green_bg": 42,
  "yellow_bg": 43,
  "blue_bg": 44,
  "magenta_bg": 45,
  "cyan_bg": 46,
  "white_bg": 47
};

function color(str, color) {
  if (!color) return str;
  var color_attrs = color.split("+");
  var ansi_str = "";
  for (var i=0, attr; attr = color_attrs[i]; i++) {
    ansi_str += "\033[" + ANSI_CODES[attr] + "m";
  }
  ansi_str += str + "\033[" + ANSI_CODES["off"] + "m";
  return ansi_str;
}

var exports = module.exports = function consoleNotifierPlugin (schema, options) {
  schema.methods.notify = function(event, check, callback) {
    var messageColor, downtime
      , message = check.url + ' '
      , date = new Date(event.timestamp)
      , lasttime = moment.duration(check.lasttime).humanize()

    switch (event.status) {
      case 'paused':
      case 'restarted':
        messageColor = 'blue+bold';
        break;
      case 'down':
        messageColor = 'red+bold';
        break;
      case 'up':
        messageColor = 'green+bold';
        break;
      default:
        messageColor = 'bold';
    }

    message += 'is ' + event.status + ' after ' + lasttime + ' of being '
    message += check.prevStatus
    if (event.details) {message += '. Details: ' + event.details};
    console.log(color(event.date, 'cyan') + ' ' + color(message, messageColor));
    callback(null, true);
  }
}
