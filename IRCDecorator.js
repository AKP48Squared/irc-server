'use strict';
const c = require('irc-colors');

class IRCDecorator extends global.AKP48.TextDecorator {
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
