var url = require('url');
var scraper = require("./scraper_proto"); 
var utils = require("scanner_utils"); 
var cheerio = require("cheerio"); 
var copyrre = /copyright/ig; 


var parseFirstBody = function (result) { 
	var foundfile = undefined,
	license_regex = /licen[cs]/i, 
	readme_regex = /readme/i;

	var license_files = []; 
	var readme_files = []; 
	var $ = cheerio.load(result); 
	$(".js-directory-link").each(function (index,element) { 
		var text = $(this).text(); 
		var href = $(this).attr("href"); 
		if(license_regex.exec(text))
			license_files.push(href); 
		if(readme_regex.exec(text))
			readme_files.push(href); 
	}); 
	if(license_files[0])
		foundfile = license_files[0]; 
	else if(readme_files[0])
		foundfile = readme_files[0]; 
	return "file://" + foundfile; 
}; 


var makeRequest = function(license_object) {

	var a = license_object.repository;
	var fix_homepage_check = license_object.homepage === a; 
	a  = a.replace(/github.com:/,"https://github.com/");
	a  = a.replace(/^git@/,"");
	a = a.replace(/^git/,"https");
	a = a.replace(/\.git$/,"");
	a = a.replace(/\.git\/?/,"");
	if (fix_homepage_check || !license_object.homepage) license_object.homepage = a;

	return function (callback) {
		var default_request = utils.default_request(license_object,callback); 
	    var uri = a + "/file-list/master/"; 
	    default_request(uri, function (error,res,body) {
	    		var parsed_body = parseFirstBody(body); 
				var parsed = url.parse(parsed_body);
				// URL here does not refer to local file system; is result of github screen scrape formatting
				if (parsed.protocol == 'file:') {
					var pathname = parsed.pathname;
					pathname = pathname.replace('/blob','');
					uri = 'https://raw.githubusercontent.com' + pathname;
        		} 
        		else { 
        			return callback(null,license_object); 
        		}
				default_request(uri, function (error,res,body) { 						
						license_object.licensefile.push({licensepath: uri, text: body});
         				callback(null,license_object); 
					}
				);
			}
		);
	};
};   


module.exports = new scraper({regex: /github\.com/,parallel_function: makeRequest}); 