'use strict';
const c = require('irc-colors');

class IRCDecorator extends global.AKP48.TextDecorators.default {
  constructor() {
    super();
  }

  applyStyle(str, ...styles) {
    for (var i = 0; i < styles.length; i++) {
      let stylesString = styles[i];
      let s = stylesString.split(' ');
      for (var j = 0; j < s.length; j++) {
        if (typeof c[s[j]] === 'function') {
          str = c[s[j]](str);
        } else {
          //custom styles can be defined here.
          switch(s[j]) {
            case 'link':
              str = c.navy.underline(str);
              break;
            case 'reset':
              str = c.stripColorsAndStyle(str);
              break;
            default:
              break;
          }
        }
      }
    }

    return str;
  }

  removeAllStyles(str) {
    return c.stripColorsAndStyle(str);
  }
}

module.exports = IRCDecorator;
