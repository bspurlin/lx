var scraper = require("./scraper_proto"); 
var url = require("url"); 
var utils = require("scanner_utils"); 



var copyright_regex = /copyright/ig; 


var get_license_files = function(files) { 
	var license_regex = /licen[cs]/i; 
	var readme_regex = /readme/i; 
	var license_file_name,readme_file_name; 
	files.forEach(function (file) { 
		if(file.path.match(license_regex)) 
			license_file_name = file.path; 
		else if(file.path.match(readme_regex))
			readme_file_name = file.path; 
	}); 

	if(license_file_name)
		return license_file_name; 
	if(readme_file_name)
		return readme_file_name; 
	return null; 
}

var parse_body = function(body) { 
	try { var parsed_body = JSON.parse(body); } 
	catch (e) { return {}; }
	var file_list = parsed_body.files; 
	var directory_list = parsed_body.directories; 

	var doc_regex = /doc/i; 

	var license_file_name,readme_file_name; 


	var next_link,append; 

	if(next_link = get_license_files(file_list))
		append = "raw";
	else { 
		for(var i = 0;i<directory_list.length;i++) { 
			var doc_name; 
			if(doc_name = directory_list[i].match(doc_regex)[0])
				break; 
		}
		if(next_link = doc_name) 
			append = "src"; 
	}
	return {link: next_link,append:append}; 
}


var fix_license_object = function(license_object,license_text,uri) { 
	license_object.licensefile.push({licensepath: uri, text: license_text});
	return license_object; 
}; 	


// This scrape relies on bitbucket's public JSON-based API's; there's a rate limit for these
// that's pinned to IP addresses https://confluence.atlassian.com/display/BITBUCKET/Rate+limits 
// Right now the rate is 5k files/hour. No limit on file listing information. 
// The scrape checks the root of the default branch's file tree for license files or a DOCS 
// directory, and then checks the DOCS directory if no license files are found on the first
// pass.  
var makeRequest = function(license_object) { 
	return function (callback) { 
		var default_request = utils.default_request(license_object,callback); 
		var split_repo_path = url.parse(license_object.repository).path.split("/"); 
		var uri_base = "https://bitbucket.org/api/1.0/repositories/" + split_repo_path[1] + "/" + split_repo_path[2] + "/"; 
		var uri = uri_base + "src/default/";
		default_request(uri,function (error,res,body) { 

			var processed_body = parse_body(body); 
			var next_link = processed_body.link; 
			if(!next_link) 
				return callback(null,license_object); 
			uri = uri_base + processed_body.append + "/default/" + next_link + "/"; 
			default_request(uri,function (error,res,body) { 
				if(processed_body.append === "raw") { 
					license_object = fix_license_object(license_object,body,uri); 
					return callback(null,license_object); 
				}

				processed_body = parse_body(body); 
				if (next_link = processed_body.link) { 
					uri = uri_base + processed_body.append + "/default/" + next_link + "/"; 
					default_request(uri,function (error,res,body) { 
						if(processed_body.append === "raw") { 
							license_object = fix_license_object(license_object,body,uri); 
						}
						return callback(null,license_object); 
					}); 
				} else { 
					return callback(null,license_object); 
				}
			}); 
		}); 
	}
}

module.exports = new scraper({regex: /bitbucket\.org/,parallel_function: makeRequest}); 