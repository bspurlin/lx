var scanner = require("./scanner_proto"); 

var test_lx = function(options,callback) { 
	callback(null,options.test_licobjs); 
}

module.exports = new scanner({scanner_function: test_lx}); 