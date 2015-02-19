var async = require("async"); 



var scrapers = [require("./git-scraper"),require("./bitbucket-scraper"),require("./gcode-scraper")]; 

var determine_scraper = function(license_object) { 
	var return_value; 
	for(var i = 0;i<scrapers.length;i++) { 
		if(scrapers[i].condition(license_object)) { 
			return_value = scrapers[i].parallel_function(license_object); 
			break; 
		}
	}
	if(return_value)
		return return_value; 
	return function (cb) { 
		cb(null,license_object); 
	}
}; 

var scraper = function (license_objects,callback) {  
	var work_to_be_done = []; 
	license_objects.forEach(function (license_object) { 
		work_to_be_done.push(determine_scraper(license_object)); 
	}); 

	async.parallel(work_to_be_done,function (error,results) { 
		if(error)
			return callback(error,null); 
		callback(null,results); 
	});
}; 

module.exports = scraper; 