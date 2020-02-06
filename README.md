# opcua-weather
+ Node.js opc ua weather using openweathermaps directly
+ Adapted code from: https://node-opcua.github.io/tutorial/2015/07/05/weather-station.html

## Usage
```
  Usage: weather.js [options] [command]
  
  Commands:
    help     Display help
    version  Display version
  
  Options:
    -a, --apikey          API key used for openweathermap calls. Superceeds config file apikey (if specified)
    -c, --config [value]  path to config file to load (JSON form) see README.md for example (defaults to "config.json")
    -d, --debug           Print debug messages (disabled by default)
    -h, --help            Output usage information
    -p, --port <n>         port number to listen on (defaults to 4334)
    -u, --units [value]    globally set units requested from openweathermap (defaults to "imperial")
    -v, --version         Output the version number
```