Gnippy
========================

A Node.js client for consuming Gnip. Connect to the Gnip Powertrack Streaming API and manage your rules. You **must have a**
**Gnip account** with Twitter PowerTrack available and enabled.

## Gnippy.Powertrack.Stream
========================

The stream is an EventEmitter that allows you to connect to a PowerTrack stream and start receiving data.

### API Methods
========================

#### stream.start()
Connect to the stream and start receiving data from Gnip. You should have registered at least one event listener for any
of the following events from the stream:

- data
- share
- post

#### stream.end()
Terminates the connection to the stream.

### Events
========================

| Event Name | Description |
| ---------- | ----------- |
| data       | Emitted for each content item received. |
| error      | Emitted when the response received is not a 200 OK. |
| end        | Emitted when the stream has been ended. |
| post       | Emitted for each content item received that has a _verb_ value of `post`. |
| share      | Emitted for each content item received that has a _verb_ value of `share`. |

## Installation
```bash
npm install gnippy
```

## Example Usage

```javascript
var Gnippy  = require('gnippy');

var powertrack_options  = {
  account_name: "<your Gnip account name>",
  user:         "<your Gnip user name>",
  password:     "<your Gnip password>"
};

var stream  = new Gnippy.Powertrack.Stream(powertrack_options);

stream.on('error', function(err){
  console.error(err);  
});

stream.on('data', function(data){
  console.dir(data);  
});

stream.on('post', function(data){
  console.dir(data);  
});

stream.on('share', function(data){
  console.dir(data);  
});

stream.start();

```