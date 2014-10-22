
var _             = require('underscore');
var EventEmitter  = require('events').EventEmitter;
var eventStream   = require('event-stream');
var http          = require('request');
var moment        = require('moment');
var querystring   = require('querystring');
var util          = require('util');
var zlib          = require('zlib');

function buildQueryString(options){
  var q     = options.query || {};
  //  fromDate and toDate are both required parameters, we try to apply defaults
  var gnipDateFormat = 'YYYYMMDDHHmm';
  q         = _.extend(
      {
        fromDate: moment().subtract(15,'minutes').format(gnipDateFormat),
        toDate:   moment().subtract(5,'minutes').format(gnipDateFormat)
      },
      q
  );

  //  Confirm the fromDate and toDate fall within the permitted range
  var to_date     = moment(q.toDate, gnipDateFormat);
  var from_date   = moment(q.fromDate, gnipDateFormat);
  if(to_date.unix() > moment().subtract(5,'minutes').unix()){
    throw new Error('Minimum toDate: The Compliance API can only accept requests where the toDate is at least 5 minutes in the past.')
  }

  if(to_date.subtract(10, 'minutes').unix() < from_date.unix()){
    throw new Error('Max Requested Time Period: The max time period allowed per request is 10 minutes.');
  }

  return querystring.stringify(q);
}

var ComplianceStream  = function(options){
  var that        = this;
  that.options    = _.extend({platform: 'twitter'},options);

  EventEmitter.call(that);

  //  only Twitter is a supported platform
  that.options.platform = 'twitter';

  var uri               = _.template("https://compliance.gnip.com/accounts/<%- account_name %>/publishers/<%- platform %>/", that.options);
  //  build the querystring parameters
  uri                   = [uri, buildQueryString(that.options)].join('?');

  that.request_options  =  {
    uri:        uri,
    auth:       {
      user:     options.user,
      pass:     options.password
    },
    method:     'GET',
    gzip:       true,
    headers:    {
      "Accept-Encoding":  'gzip'
    }
  };

  that._req             = null;

};
util.inherits(ComplianceStream, EventEmitter);

ComplianceStream.prototype.start  = function(){
  var that  = this;

  if(that.options.debug){
    util.log('Starting Compliance stream.');
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
      that.emit('error', {code: res.statusCode, message: 'Status is not 200. Returned '+res.statusCode});
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
            that.emit('summary', data.summary);

            if(data.summary.status === 'failure'){
              that.emit('failure', data);
            }

            _.each(data.results, function(compliance_activity){
              var emit_data = {
                activity_id:  _.has(compliance_activity.gnip, 'activity') ? compliance_activity.gnip.activity.id : null,
                user_id:      _.has(compliance_activity.gnip, 'user') ? compliance_activity.gnip.user.id : null
              };

              var event_type  = _.first(_.keys(compliance_activity.original));

              //  See http://support.gnip.com/apis/compliance_api/api_reference.html#ComplianceEvents for list of all compliance events
              that.emit(['event',event_type].join(':'), emit_data, compliance_activity);
              that.emit(['product',compliance_activity.gnip.labels.product].join(':'), emit_data, compliance_activity);
              that.emit(['stream_type',compliance_activity.gnip.labels.streamType].join(':'), emit_data, compliance_activity);
            });
          }));
    }else{
      //  Unsupported encoding/compression?
      that.emit('error', 'Unsupported response encoding received. ['+response_encoding+']');
    }
  });
};

ComplianceStream.prototype.end  = function(){
  var that    = this;
  if(that._req){
    that._req.abort();
    that._req = null;
    that.emit('end');
  }
};

module.exports  = ComplianceStream;