var scanners = require("./lib/scanners"); 
var scraper = require("./lib/scrapers"); 
var licid = require("./lib/lic-id"); 
var _ = require("underscore"); 


var COPYRIGHT_REGEX = /^.{0,3}(copyright|\(c\)).{0,100}$/mig; 
// The above regular expression is left intentionally inclusive
// so that it errs on the side of picking up lines that aren't copyright
// notices, rather than ignoring lines which are. 
// The following "ignore list" allows correction to remove common exceptions 
// which are known not to be copyright notices
var IGNORE_LIST = [ 
					/.*COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER.*/ig, 
					/.*copyright notice and this permission notice appear in all copies.*/ig, 
					/.*COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT.*/ig
				  ]; 


var alphasort = function(a,b) { 
	a = a.name.toLowerCase(); 
	b = b.name.toLowerCase(); 
	return a > b ? 1 : 
		a < b ? -1 : 0; 
};

var diff_filter = function(to_filter,filter_against) { 
	var against_map = {}; 
	filter_against.forEach(function (license_object) { 
		if(!against_map[license_object.name])
			against_map[license_object.name] = []; 
		against_map[license_object.name].push(license_object.version); 
	}); 
	to_filter = to_filter.filter(function (license_object) { 
		var match = false; 
		if(!against_map[license_object.name])
			return true; 
		for(var i = 0;i<against_map[license_object.name].length;i++) { 
			if(license_object.version === against_map[license_object.name][i]) { 
				match = true;
				break; 
			}
		}
		return !(match) 
	});
	return to_filter; 
}; 

var lx = function(type,directory,opts,callback) { 
	var options = opts; 
	if(!callback) { 
		callback = opts; 
		options = {}; 
	}
	options.dir = directory; 
	

	var scanner = scanners(type); 

	scanner.scan(options, function (error,license_objects) { 
		if(error) { 
			return callback(error,null); 
		}
		if(options.diff_objects) { 
			license_objects = diff_filter(license_objects,options.diff_objects); 
		}
		if(options.noremote) { 
			license_objects = license_objects.sort(alphasort); 
			return callback(null,license_objects); 
		}

		var local_licenses = []; 
		var remote_licenses = [];
		// Sort license objects into those that have been locally determined 
		// and those that need to be checked for online processing 
		license_objects.forEach(function (license_object) { 
			if(license_object.licensefile.length > 0)
				local_licenses.push(license_object); 
			else
				remote_licenses.push(license_object); 
		}); 
 
		scraper(remote_licenses, function (error,remote_licenses) { 
			if(error) 
				return callback(error,null); 
			var final_license_objects = local_licenses.concat(remote_licenses); 
			// Put the license objects in alphabetical order by name
			final_license_objects = final_license_objects.sort(alphasort); 
			
			final_license_objects = final_license_objects.map(function (license_object) { 
	 			// If a license was found for the package but no license type
	 			// attempt to populate it
	 			if (license_object.licensefile.length > 0) {
		 				license_object.license = licid(license_object.licensefile[0].text);
		 				license_object.licensefile = license_object.licensefile.map(function (license) { 
							var notice_instances = []; 
							var potential_license; 
							if( potential_license = licid(license.text) ) { 
								license_object.license = potential_license; 
							}
	
							if(license.text) { 
								notice_instances = license.text.match(COPYRIGHT_REGEX);
								if(notice_instances) license.notice = _.uniq(notice_instances).filter(function (license_line) { 							
									for(var i = 0;i<IGNORE_LIST.length;i++) { 
										if(IGNORE_LIST[i].exec(license_line))
										return false; 
									}
									return true; 
								}).join("|"); 
								else license.notice = undefined;
							}
							return license; 
						});
				}
				return license_object; 
	 		}); 
			
			callback(null,final_license_objects); 
		}); 
	}); 
}; 

module.exports = lx;