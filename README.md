This plugin allows AKP48Squared to connect to IRC servers.

# Installation

This plugin is included by default on new installations of AKP48Squared. No further installation is needed.

# Config

You'll need to add a new server to your configuration file for each IRC server you need to connect to. An example is shown below.

```
"servers": [
  {
    "plugin": "irc",
    "config": {
      "server": "irc.esper.net", // irc server
      "nick": "MyCoolBot", // bot nick
      "password": "Pa$$W0rd!", // bot password
      "channels": [
        "#MyCoolBot" // array of channels to join
      ],
      "chanConfig": { // chanConfig is an object with properties for each channel. You can also define a "global" property.
        "#MyCoolBot": {
          "commandDelimiters": [
            "\\",
            "."
          ],
          "users": {
            "adminuser@irc.mywebsite.com": [
              "AKP48.owner"
            ]
          "alert": true // tells AKP48 that alerts should be sent to this channel.
        }
      }
    }
  }
]
```

# Issues

If you come across any issues, you can report them on this GitHub repo [here](https://github.com/AKP48Squared/akp48-plugin-irc-server/issues).
