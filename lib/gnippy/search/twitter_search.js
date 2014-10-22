var _             = require('underscore');
var EventEmitter  = require('events').EventEmitter;
var eventStream   = require('event-stream');
var http          = require('request');
var querystring   = require('querystring');
var util          = require('util');
var zlib          = require('zlib');

function buildQueryString(options){
  var q     = options.query || {};
  if(!_.has(q, 'query')){
    throw new Error('"The query parameter is required. Search requires ALL portions of the PowerTrack rule, including all operators, and portions of the rule should not be separated into other parameters of the query.')
  }


  //  fromDate and toDate are both required parameters
  if(_.has(q, 'fromDate')){
    var gnipDateFormat = 'YYYYMMDDHHmm';
    var from_date   = moment(q.fromDate, gnipDateFormat);
    var to_date;
    //  Confirm the fromDate and toDate fall within the permitted range
    if(_.has(q,'toDate')){
      to_date       = _.has(q, 'toDate') ? moment(q.toDate, gnipDateFormat) : moment();
      if(to_date.subtract(30, 'days').unix() > from_date.unix()){
        throw new Error('Max Requested Time Period: The max time period allowed per request is 30 days.');
      }
    }else if(moment().subtract(30, 'days').unix() < from_date.unix()){
      throw new Error('Max Requested Time Period: The max time period allowed per request is 30 days.');
    }

  }

  if(_.has(q, 'maxResults')){
    if(q.maxResults < 10){
      throw new Error('The value of maxResults must be greater than or equal to 10.');
    }else if(q.maxResults > 500){
      throw new Error('The value of maxResults must be less than 500.');
    }
  }

  return querystring.stringify(_.extend({publisher: 'twitter'}, q));
}

var Search  = function(options){
  var that        = this;
  that.options    = _.extend({platform: 'twitter'},options);

  EventEmitter.call(that);

  var uri               = _.template("https://search.gnip.com/accounts/<%- account_name %>/publishers/<%- platform %>/search/prod.json", that.options);
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
      "Accept-Encoding":  "gzip"
    }
  };

  that._req             = null;

};
util.inherits(Search, EventEmitter);

Search.prototype.start  = function(){
  var that  = this;

  if(that.options.debug){
    util.log('Starting search.');
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
            that.emit('page:next', data.next);
            that.emit('page:is_last', _.isEmpty(data.next));
            that.emit(data.verb, data);
          }));
    }else{
      //  Unsupported encoding/compression?
      that.emit('error', 'Unsupported response encoding received. ['+response_encoding+']');
    }
  });
};

Search.prototype.nextPage = function(cursor){
  var that  = this;

  if(that.options.debug){
    util.log('Fetching next page of results.');
  }

  if(_.isEmpty(that.options.account_name)){
    throw new Error('You must include a Gnip account name.');
  }

  if(_.isEmpty(cursor)){
    throw new Error('You must include the next page cursor value.');
  }

  if(_.isEmpty(_.compact([that.options.user, that.options.password]))){
    throw new Error('Missing account credentials.');
  }

  //  update the request options
  var next_page_req_options = _.clone(that.request_options);
  var q_options             = _.clone(that.options);
  q_options.query.next      = cursor;

  next_page_req_options.uri = [that.request_options.uri.split('?')[0], buildQueryString(q_options)].join('?');

  that._req           = http(next_page_req_options);
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
            that.emit('page:next', data.next);
            that.emit('page:is_last', _.isEmpty(data.next));
            that.emit(data.verb, data);
          }));
    }else{
      //  Unsupported encoding/compression?
      that.emit('error', 'Unsupported response encoding received. ['+response_encoding+']');
    }
  });
};

Search.prototype.end  = function(){
  var that    = this;
  if(that._req){
    that._req.abort();
    that._req = null;
    that.emit('end');
  }
};

module.exports  = Search;