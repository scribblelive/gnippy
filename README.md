Gnippy
========================

A Node.js client for consuming Gnip.

```javascript
var Gnippy  = require('gnippy');

var powertrack_options  = {
  account_name: "<your Gnip account name>",
  user:         "<your Gnip user name>",
  password:     "<your Gnip password>"
};

var stream  = new Gnippy.Powertrack.Stream(powertrack_options);

stream.on('data', function(data){
  console.dir(data);  
});

stream.start();

```