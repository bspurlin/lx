var exec = require("child_process").exec; 
var async = require("async"); 
var _ = require("underscore"); 
var scanner = require("./scanner_proto.js"); 
var fs = require("graceful-fs"); 
var licid = require("../lic-id"); 

var num_parallel_execs = 10; 
var split_modulus = 10; 

var get_installed_package_list = function (callback) { 
	exec("dpkg --get-selections | grep -v deinstall",{maxBuffer:1000*1024},function (error,stdout,stderr) { 
		if(error)
			return callback(error); 
		var packages = stdout.toString().split("\n"); 
		// Lines are output by dpkg as <package_name>  (space) install; this fixes that
		packages = packages.map(function (package) { 
			return package.split("\t")[0]; 
		});
		callback(null,packages.slice(0,-1)); 
	}); 
}; 

var get_cache_info = function (packages,callback) {
	var get_first_package_description = function (package_info) { 
		package_info = package_info.split("\n"); 
		var i = 0; 
		var return_val = ""; 
		while(package_info[i]!=="" && i < package_info.length) { 
			return_val += package_info[i] + "\n"; 
			i++; 
		}
		// Slice is to remove an extra newline character
		return return_val.slice(0,-3); 
	}; 
	// Sets up batches of apt-cache queries so that they're not done 
	// one at a time
	var query_strings = []; 
	var current_string = packages[0]; 
	for(var i = 0;i<packages.length;i++) { 
		current_string += packages[i] + " "; 

		// Next bin
		if((i+1) % split_modulus === 0) { 
			query_strings.push(current_string.slice(0,-1)); 
			current_string = ""; 
		}
	}

	var package_tasks = query_strings.map(function (package_names) {
		return function (callback) { 
			exec("apt-cache show " + package_names,{maxBuffer:1000*1024},function (error,stdout,stderr) { 
				var results = stdout.toString().split("Package:"); 
				results = results.map(function (package_info) { 
					return "Package:" + package_info; 
				}); 
				callback(null,results.slice(1)); 
			}); 
		}; 
	}); 
	async.parallelLimit(package_tasks,num_parallel_execs,function (err,results) { 
		results = _.flatten(results);
		results = results.map(function (description_chunk) { 
			// Break the description chunk up into its descriptor fields
			var lines = description_chunk.split("\n"); 
			var final_description = {}; 
			var descriptor; 
			var line_split; 
			var seen = {}; 
			for(var i = 0;i<lines.length;i++) { 
				line_split = lines[i].split(": "); 
				if(line_split.length > 1) { 
					if(descriptor) { 
						if(final_description[descriptor].slice(-1) === "\n")
							final_description[descriptor] = final_description[descriptor].slice(0,-1); 
					}
					descriptor = line_split[0]; 
					final_description[descriptor] = line_split[1] + "\n"; 
				} else { 
					final_description[descriptor] += line_split[0] + "\n"; 
				}
			}
			final_description = _.pick(final_description,["Homepage","Package","Version","Maintainer"]); 
			if(seen[final_description["Package"]])
				return false; 
			else 
				seen[final_description["Package"]] = true; 
			return final_description; 
		});
		results = _.compact(results);   		
		callback(null,results); 
	}); 
}; 

var get_license_texts = function(license_objects,callback) { 
	async.map(license_objects, function (license_object,callback) {
		// Right now it seems consistent just to locate /usr/share/doc/<package_name>/copyright
		// But the file search might be need to be broadened later. Trying to avoid execs. 
		var license_url = "/usr/share/doc/" + license_object["Package"] + "/copyright"; 
		fs.readFile(license_url,function (error,text) { 
			if(error) { 
				if(error.code === "ENOENT") { 
					return callback(null,license_object); 
				}
				return callback(error);
			}
			var license_type,license_note; 
			text = text.toString(); 
			license_object.text = text; 
			license_object.path = license_url;
			if(license_type = licid(text)) { 
				license_object.type = license_type; 
				if(license_note = text.match(/(copyright.+)/i))
					license_object.note = license_note; 
			}
			callback(null,license_object); 		
		}); 
	}, function (error,license_objects_with_text) {
		if(error)
			return callback(error); 
		return callback(null,license_objects_with_text); 
	}); 
}; 


var aptlx = function (opts,callback) { 
	get_installed_package_list(function (error,packages) { 
		if(error)
			return callback(error); 
		get_cache_info(packages,function (error,package_info) { 
			if(error)
				return callback(error); 
			get_license_texts(package_info,function (error,license_objects) { 
				if(error)
					return callback(error); 
				license_objects = license_objects.map(function (license_object) { 
					var return_obj = {}; 
					return_obj.name = license_object["Package"]; 
					return_obj.version = license_object["Version"]; 
					return_obj.label = return_obj.name + "@" + return_obj.version; 
					return_obj.homepage = license_object["Homepage"]; 
					if(license_object.text) { 
						var license = { 
							licensepath: license_object.path, 
							text: license_object.text, 
						}
						if(license_object.type) { 
							license.type = license_object.type; 
							return_obj.license = {}; 
							return_obj.license.type = license.type; 
						}
						if(license_object.note)
							license.note = license_object.note; 
						return_obj.licensefile = [license]; 
					}
					return_obj.repository = return_obj.homepage; 
					return return_obj; 
				});
				callback(null,license_objects);  
			}); 
		}); 
	}); 
}; 


module.exports = new scanner({scanner_function: aptlx}); 