module.exports  = {
  Powertrack: {
    ComplianceAPI: require('./lib/gnippy/compliance/compliance_api'),
    Stream: require('./lib/gnippy/powertrack/powertrack_stream'),
    Rules:  require('./lib/gnippy/rules/powertrack_rules')
  }
};