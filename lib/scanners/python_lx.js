var licid = require("../lic-id"); 
var exec = require("child_process").exec; 
var path = require("path"); 
var fs = require("fs"); 
var scanner = require("./scanner_proto.js"); 






// This callback is called as callback(error,licobjcs) in the typical way; 
// licobjs is an array of license_objects that are created as a result of the scan
var plx = function (opts,callback) { 
	var python_path; 
	if(!(python_path = opts.dir))
		python_path = "python"; 
	var package_name; 
	if(!(package_name = opts.package_name))
		package_name = ""; 
	exec(python_path+" "+path.join(__dirname,"plx.py")+" "+package_name,{maxBuffer: 2000*1024},function (error,stdout,stderr) { 
		if(error) 
			return callback(error.toString(),null); 
		if(stderr.toString().length > 1) 
			return callback(stderr.toString(),null); 
		package_info = JSON.parse(stdout.toString()); 
		plx_core(package_info,callback); 
	}); 
}; 

var plx_core = function(package_info,callback) { 
	var plx_output = []; 
	package_info.forEach(function (package_entry,package_index) { 
		var license_object = {}; 		
		license_object.name = package_entry.name; 
		license_object.label = package_entry.name + "@" + package_entry.version; 
		license_object.version = package_entry.version; 
		license_object.licensefile = []; 
		if(!package_entry.files) { 
			plx_output.push(license_object); 
			return; 
		}
		var license_extract = extract_license_info(package_entry)

		license_object.homepage = license_extract.homepage; 
		license_object.license = license_extract.type; 

		
		var license_file_object = {}; 
		if(license_extract.path) license_file_object.licensepath = license_extract.path; 
		if(license_extract.notice) license_file_object.notice = license_extract.notice; 
		if(license_extract.text) license_file_object.text = license_extract.text; 
		if(license_extract.text) license_object.licensefile = [license_file_object]; 
		else license_object.licensefile = []; 
		if(!license_object.repository) license_object.repository = license_object.homepage; 

		plx_output.push(license_object); 
	}); 

	callback(null,plx_output); 
}; 

// Returns an object of the form {homepage:,type:,path:,text:,notice:}
var extract_license_info = function(package_entry) { 
	var files = package_entry.files; 
	var depth = package_entry.location.split(path.sep).length; 
	var license_files = []; 
	var license = {}; 
	files.forEach(function (file,index,file_list) { 
		if(!/^.*PKG-INFO[^\/]*$/.test(file)) {
			license_files.push(file); 
			file_list[index] = ""; 
		}
	});
	files = files.filter(Boolean); 
	

	if(files.length > 0) 
		license = parse_pkg_info_file(files[0],license); 

	if(license_files.length > 0) { 
		var index = -1; 
		// Here begins a dirty hack; if one of these license files is 
		// more than 4 directories deep in the tree we ignore it
		for(var i = 0;i<license_files.length;i++) {  
			var file_depth = license_files[i].split(path.sep).length - depth; 
			if(/^.*LICENSE[^\/]*$/i.test(license_files[i]) && file_depth <= 4) { 
				index = i; 
				break; 
			}
		}
		if(index!==-1) {
			license = parse_license_file(license_files[index],license); 
			license.path = license_files[index]; 
			license_files[index] = null; 
		} 
		var temp_license; 
		var license_depth; 
		while(!license.notice && license_files.length != 0) { 
			license_files = license_files.filter(Boolean); 
			license_depth = license_files[0].length - depth; 
			if(license_files[0])
				if(license_depth <= 4) 
					temp_license = parse_license_file(license_files[0],license); 
			else
				break; 
			if( license.notice = temp_license.notice )  {
				license.text = temp_license.text; 
				license.path = license_files[0]; 
			}
			// license_files[0] = null; 
		}
	}
	return license; 
}; 


var parse_license_file = function(license_file_name,license) { 
	var license_text = fs.readFileSync(license_file_name).toString(); 
	var license_note,license_type,repo; 
	if(license_note = license_text.match(/(copyright.+)/i)) { 
		license.text = license_text; 
		// license.notice = license_note[0]; 
	}
	// This is a bit dirty, but finding a github link in the license text 
	// directly can save quite a bit of work
	if(repo = license_text.match(/(https?:\/\/)?(www\.)?github\.com[^\s\n]*/ig)) { 
		license.repository = repo[0]; 
		if(!license.homepage)
			license.homepage = repo[0]; 
	}
	// if(license_type = licid(license_text))
	// 	license.type = license_type; 
	return license; 
}; 


var parse_pkg_info_file = function(package_info_file_name,license) { 
	var package_info_text = fs.readFileSync(package_info_file_name).toString(); 
	
	var homepage,type,repo; 
	if(homepage = package_info_text.match(/(Home-page.+)/i)) { 
		// Homepage is at this point in the form Home-page: <URL here> 
		license.homepage = homepage[0].split(" ")[1]; 
	}
	if(type = package_info_text.match(/(License.+)/i)) { 
		// In this case we rely on the colon to split the field instead
		// of a space
		if(!license.type)
			license.type = type[0].split(":")[1].slice(1); 
	}
	if(repo = package_info_text.match(/(https?:\/\/)?(www\.)?github\.com[^\s]*/i)) { 
		if(!license.repository)
			license.repo = license.repository = repo[0]; 
		if(!license.homepage)
			license.homepage = repo[0]; 
	}
	return license; 
}; 



module.exports = new scanner({scanner_function: plx}); 