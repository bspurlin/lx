var licid = require("../lic-id"); 

var makeGeneralRequest = function(parallel_function) { 
	return function (license_object) { 
		return function (callback) { 
			parallel_function(license_object)(function (error,license_object) { 
				// At this point our license object should have been augmented by license
				// text and a URL to the license, if it could be found during the scrape. 
				// Now we can do further processing. 
				if(error) 
					return callback(error,null); 

				var licensefile = license_object.licensefile; 
				license_object.licensefile = licensefile.map(function (license) { 
					var aa = []; 
					var mynotice = undefined;
					var potential_license; 
					if( potential_license = licid(license.text) ) { 
						license_object.license = potential_license; 
						aa = license.text.match(/(copyright.+)/i);
						if(aa) license.notice = aa[0]; 
						else license.notice = undefined;
					}
					return license; 
				}); 
				if (license_object.license == undefined && license_object.licensefile.length > 0) {
	 				license_object.license = licid(license_object.licensefile[0].text);
				} else if (license_object.license == undefined) license_object.license = "undefined";
				delete license_object.repo; 
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