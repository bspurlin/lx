var licid = require("../lic-id"); 

var makeGeneralRequest = function(parallel_function) { 
	return function (license_object) { 
		return function (callback) { 
			parallel_function(license_object)(function (error,license_object) { 
				// At this point our license object should have been augmented by license
				// text and a URL to the license, if it could be found during the scrape. 
				// This block is for further processing
				if(error) 
					return callback(error,null); 
				callback(null,license_object); 
			}); 
		}; 
	}; 
}

var makeCondition = function(regex) { 
	if(!regex)
		return function() {return false;}; 
	return function (license_object) { 
		return regex.test(license_object.repository); 
	}; 
}; 
var proto = function(options) { 
	this.condition = makeCondition(options.regex); 
	this.parallel_function = makeGeneralRequest(options.parallel_function); 
};

module.exports = proto; 