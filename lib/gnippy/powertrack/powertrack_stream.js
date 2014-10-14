var _             = require('underscore');
var EventEmitter  = require('events').EventEmitter;
var eventStream   = require('event-stream');
var http          = require('request');
var util          = require('util');
var zlib          = require('zlib');

var PowerTrackStream  = function(options){
  var that        = this;
  that.options    = _.extend({platform: 'twitter'},options);

  EventEmitter.call(that);

  var uri               = _.template("https://stream.gnip.com/accounts/<%- account_name %>/publishers/<%- platform %>/streams/track/prod.json", that.options);
  var stream_url        = require('url').parse(uri);
  that.request_options  =  {
    host:       stream_url.hostname,
    port:       stream_url.port,
    path:       stream_url.path,
    auth:       {
      user:     options.user,
      pass:     options.password
    },
    method:     'GET',
    gzip:       true,
    headers:    {
      "Accept-Encoding":  "gzip",
      Connection:			    "keep-alive"
    }
  };

  that._req             = null;

};
util.inherits(PowerTrackStream, EventEmitter);

PowerTrackStream.prototype.start  = function(){
  var that  = this;

  if(that.options.debug){
    util.log('Starting PowerTrack stream.');
  }

  if(_.isEmpty(that.options.account_name)){
    throw new Error('You must include a Gnip account name.');
  }

  if(_.isEmpty(_.compact([that.options.user, that.options.password]))){
    throw new Error('Missing account credentials.');
  }

  that._req           = http(that.request_options);
  var parsingStream   = require('JSONStream').parse();

  that._req.on('response', function(res){
    if (res.statusCode !== 200){
      that.emit('error', 'Status is not 200.');
    }

    var response_encoding = res.headers['content-encoding'];
    if(response_encoding === 'gzip'){
      res.pipe(zlib.createGunzip())
          .pipe(parsingStream)
          .pipe(eventStream.mapSync(function (data) {
            if(that.request_options.debug){
              util.log(data);
            }

            that.emit('data', data);
            that.emit(data.verb, data);
          }));
    }else{
      //  Unsupported encoding/compression?
      that.emit('error', 'Unsupported response encoding received. ['+response_encoding+']');
    }
  });
};

PowerTrackStream.prototype.end  = function(){
  var that    = this;
  if(that._req){
    that._req.abort();
    that._req = null;
    that.emit('end');
  }
};

module.exports  = PowerTrackStream;