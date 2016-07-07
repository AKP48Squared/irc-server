'use strict';
const irc = require('irc');
const Promise = require('bluebird'); // jshint ignore:line

class IRC extends global.AKP48.pluginTypes.ServerConnector {
  constructor(AKP48) {
    super(AKP48, 'irc-server');
  }

  load(persistentObjects) {
    this._defaultCommandDelimiters = ['!', '.'];
    var self = this;
    var config = this._config;
    if(!config || !config.server || !config.nick) {
      global.logger.error(`${self.name}|${self._id}: Required server and/or nick options missing from config!`);
      this._error = true;
      return;
    }

    if(persistentObjects) {
      this._client = persistentObjects.client;
      this._client.removeAllListeners('message');
      this._client.removeAllListeners('registered');
      this._client.removeAllListeners('invite');
      this._client.removeAllListeners('kick');
      this._client.removeAllListeners('error');
      this._client.removeAllListeners('action');
      this._client.removeAllListeners('join');
      this._client.removeAllListeners('part');
      this._connected = true;
    } else {
      this._client = new irc.Client(config.server, config.nick, {
        autoRejoin: false,
        autoConnect: false,
        port: config.port || 6667,
        userName: config.userName || 'AKP48',
        realName: config.realName || 'AKP48',
        channels: config.channels || []
      });
    }

    this._client.on('nick', (oldNick, newNick) => {
      global.logger.stupid(`${self.name}|${self._id}: Caught nick change event. "${oldNick}" => "${newNick}"`);
      self._AKP48.emit('nick', oldNick, newNick, self);
    });

    this._client.on('message', function(nick, to, text, message) {
      if(to === config.nick) { to = nick; }
      self._AKP48.onMessage(self.createContextFromMessage(message, to));
    });

    this._client.on('action', function(nick, to, text, message) {
      if(to === config.nick) { to = nick; }
      var context = self.createContextFromMessage(message, to);
      context.setCustomData('ircAction', true);
      context.setCustomData('isEmote', true);
      self._AKP48.onMessage(context);
    });

    this._client.on('registered', function() {
      global.logger.verbose(`${self.name}|${self._id}: Connected to ${self._config.server}.`);
      self._AKP48.emit('registeredOnServer', self._id, self);

      //check nick
      if(self._client.nick !== self._config.nick) {
        //if nick isn't right, attempt to set it back every 10 seconds until we successfully set it.
        var setNick = setInterval(() => {
          self._client.send('NICK', self._config.nick);
          if(self._client.nick === self._config.nick) {
            clearInterval(setNick);
          }
        }, 10000);
      }
    });

    this._client.on('join', function(chan, nick) {
      if(nick === self._client.nick) { return; }
      global.logger.stupid(`${self.name}|${self._id}: Caught join event on ${self._config.server}. ${nick} joined ${chan}.`);
      self._AKP48.emit('ircJoin', chan, nick, self);
    });

    this._client.on('part', function(chan, nick, reason) {
      if(nick === self._client.nick) { return; }
      global.logger.stupid(`${self.name}|${self._id}: Caught part event on ${self._config.server}. ${nick} left ${chan} (${reason}).`);
      self._AKP48.emit('ircPart', chan, nick, reason, self);
    });

    this._client.on('invite', function(channel, from) {
      global.logger.debug(`${self.name}|${self._id}: Invite to channel "${channel}" received from ${from}. Joining channel.`);
      self._client.join(channel, function() {
        var joinMsg = self._config.joinMsg || `Hello, everyone! I'm ${self._client.nick}! I respond to commands and generally try to be helpful. For more information, say ".help"!`;
        if(!self._config.silentJoin) {
          self._client.say(channel, joinMsg);
        }
        var ctx = new this._AKP48.Context({
          instance: this,
          instanceType: 'irc',
          nick: from,
          text: joinMsg,
          to: channel,
          user: `GLOBAL`,
          commandDelimiters: '',
          myNick: self._client.nick,
          permissions: []
        });
        self._AKP48.logMessage(ctx);
        self._AKP48.saveConfig(self._config, self._id, true);
      });
    });

    this._client.on('kick', function(channel, nick, by, reason) {
      if(nick === self._client.nick) {
        global.logger.debug(`${self.name}|${self._id}: Kicked from ${channel} by ${by} for "${reason}". Removing channel from config.`);
        var index = self._config.channels.indexOf(channel);
        while(index > -1) {
          self._config.channels.splice(index, 1);
          index = self._config.channels.indexOf(channel);
        }
        self._AKP48.saveConfig(self._config, self._id, true);
      }
    });

    this._client.on('error', function(message) {
      global.logger.error(`${self.name}|${self._id}: Error received from ${message.server}! ${message.command}: ${message.args}`);
    });

    this._AKP48.on('msg_'+this._id, function(context) {
      var message = context.text();
      if(!context.getCustomData('noPrefix')) {message = `${context.nick()}: ${message}`;}
      try {
        if(context.getCustomData('isEmote')) {
          self._client.action(context.to(), context.text());
        } else {
          self._client.say(context.to(), message);
        }
        self._AKP48.logMessage(context);
      } catch (e) {
        global.logger.error(`${self.name}|${self._id}: Error sending message to channel '${context.to()}'! ${e.name}: ${e.message}`, e);
      }
    });

    this._AKP48.on('alert', function(context) {
      for (var i = 0; i < self._config.channels.length; i++) {
        var chan = self._config.channels[i];
        if(self._config.chanConfig && self._config.chanConfig[chan]) {
          if(self._config.chanConfig[chan].alert) {
            try {
              self._client.say(chan, context.text());
              self._AKP48.logMessage(context.cloneWith({instance: self, myNick: self._client.nick, to: chan}));
            } catch (e) {
              global.logger.error(`${self.name}|${self._id}: Error sending alert to channel '${chan}'! ${e.name}: ${e.message}`, e);
            }
          }
        }
      }
    });
  }

  connect() {
    if(this._error) {
      global.logger.error(`${this.name}|${this._id}: Cannot connect. Check log for errors.`);
      return;
    }
    if(this._connected) {
      global.logger.debug(`${this.name}|${this._id}: Using previous connection.`);
      this._connected = false;
    } else {
      this._client.connect();
    }
    this._AKP48.emit('serverConnect', this._id, this);
  }

  disconnect(msg) {
    if(this._error) {
      global.logger.error(`${this.name}|${this._id}: Cannot disconnect. Check log for errors.`);
      return;
    }
    this._client.disconnect(msg || 'Goodbye.');
  }
}

IRC.prototype.createContextFromMessage = function (message, to) {
  var perms = this.getPermissions(`${message.user}@${message.host}`, message.nick, to);
  var delimit = this.getChannelConfig(to).commandDelimiters || this._config.commandDelimiters || this._defaultCommandDelimiters;

  var ctx = new this._AKP48.Context({
    instance: this,
    instanceType: 'irc',
    nick: message.nick,
    text: message.args[1],
    to: to,
    user: `${message.user}@${message.host}`,
    commandDelimiters: delimit,
    myNick: this._client.nick,
    permissions: perms,
    rawMessage: message
  });

  return ctx;
};

IRC.prototype.getChannelConfig = function (channel) {
  if(!this._config.chanConfig) {return {};}
  return this._config.chanConfig[channel] || {};
};

IRC.prototype.getPermissions = function (prefix, nick, channel) {
  var users = {};
  var configPerms = {};
  var globPerms = {};
  var outputPerms = [];

  if(nick !== channel) {
    try { //surround in try...catch because sometimes weird things happen and the client's users object isn't there.
      users = this._client.chans[channel.toLowerCase()].users;
    } catch (e) {}
    configPerms = this.getChannelConfig(channel).users;
    globPerms = this.getChannelConfig('global').users;
  } else {
    configPerms = this.getChannelConfig('global').users;
  }

  if(users && users[nick]) {
    switch(users[nick]) {
      case '~':
        outputPerms.push('irc.channel.owner');
        break;
      case '&':
        outputPerms.push('irc.channel.protected');
        break;
      case '@':
        outputPerms.push('irc.channel.op');
        break;
      case '%':
        outputPerms.push('irc.channel.halfop');
        break;
      case '+':
        outputPerms.push('irc.channel.voice');
        break;
      default:
        break;
    }
  }

  if(configPerms) {
    if(configPerms[prefix]) {
      outputPerms.push.apply(outputPerms, configPerms[prefix]);
    }
  }

  if(globPerms) {
    if(globPerms[prefix]) {
      outputPerms.push.apply(outputPerms, globPerms[prefix]);
    }
  }

  return outputPerms;
};

IRC.prototype.getPersistentObjects = function () {
  return {
    client: this._client
  };
};

module.exports = IRC;
