var scraper = require("./scraper_proto"); 
var url = require("url"); 
var utils = require("scanner_utils"); 
var path = require("path");
var cheerio = require("cheerio"); 


var copyright_regex = /copyright/ig; 



var filter_by_regex = function (elements,regex) { 
	return elements.filter(function (index,element) { 
		return element.attribs.href.match(regex); 
	}); 
}

var link_parse = function (uri,link) {
	link = link.attribs.href;  
	return uri + "/" + link.split("/")[1]; 
}

// In the worst case we have to make 3 page requests; 1 to the index page,
// 1 to the docs folder page, and 1 to a docs/license file. Minimum is 2. 
var makeRequest = function(license_object) { 
	return function (callback) { 
		var default_request = utils.default_request(license_object,callback); 

		var uri = license_object.repository; 
		if(uri[uri.length-1]!== "/")
			uri+= "/"; 
		uri += "source/browse";		

		var extract_license = function (link) { 
			default_request(link,function (error,res,body) { 
				$ = cheerio.load(body); 
				var license_text = ""; 
				// Works around the default $(*).text() behavior so that
				// line breaks are included.
				license_text = $(".source").map(function (index,element) { 
					return $(this).text(); 
				}).get().join("\n"); 
				license_object.licensefile.push({licensepath: link, text: license_text}); 
				return callback(null,license_object); 
			}); 
		}

		default_request(uri,function (error,res,body) { 
			var $ = cheerio.load(body);  

			var link_list = $("a"); 
			var license_links = filter_by_regex(link_list,/license/i); 
			var doc_links = filter_by_regex(link_list,/doc/i); 
			var readme_links = filter_by_regex(link_list,/readme/i); 

			if(license_links[0]) { 
				var link = link_parse(uri,license_links[0]); 
			} else if(readme_links[0]) {
				var link = link_parse(uri,readme_links[0]); 
			}
			if(link) { 
				extract_license(link); 
			} else {
				if(!doc_links[0])
					return callback(null,license_object);
				var link = link_parse(uri,doc_links[0]); 
				default_request(link, function (error,res,body) { 
					$ = cheerio.load(body); 
					license_links = filter_by_regex(link_list,/license/i); 
					readme_links = filter_by_regex(readme_links,/readme/i); 
					if(license_links[0]) { 
						var link = license_links[0].attribs.href; 
						link = link.split("/")[1]; 
						link = uri + "/" + link; 
					} else if(readme_links[0]) { 
						var link = readme_links[0].attribs.href; 
						link = link.split("/")[1]; 
						link = uri + "/" + link; 
					} else { 
						return callback(null,license_object); 
					}
					extract_license(link); 
				}); 
			}
		}); 
	};
};

module.exports = new scraper({regex: /code\.google/,parallel_function: makeRequest}); 