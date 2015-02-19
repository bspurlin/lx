var scanners = require("./lib/scanners"); 
var scraper = require("./lib/scrapers"); 

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
		// and those that need more processing 
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
			callback(null,final_license_objects); 
		}); 
	}); 
}; 

module.exports = lx;