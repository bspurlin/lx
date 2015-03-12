#lx:  License eXtension#

Originally a new command for npm; now a standalone module using npm technology for determining license 5-tuples of license-related information per node module:

Package; version; license (type, e. g. "MIT"); required notice (e. g. "Copyright (c) 2014 IBM"); repository.  Optionally, a sixth field, license text.

If lx cannot find a license text under node_modules it attempts to find a license using scrapers for github, bitbucket, or google-code, making requests in parallel to do so. Duplicate name@versions are ignored.

A simple command line client, lx-cli, is provided to scan node_module directories and store the results as JSON.

LXWebGui is a webapp provided to scan, store scan results as JSON, edit 5-tuples where necessary, and save the edited results.


#Examples#

Command Line:

	$ bin/lx-cli.js --prefix /usr/local/lib > /tmp/lx.usrlocallib.json

LXWebGui:

	$ cd node_modules/LXWebGui
	$ node index.js
	<open localhost:8888 in Firefox or google-chrome>

	Alternatively, node_modules/LXWebGui/bin/ boot.sh or boot.bat 
	may be used to start the LXWebGuiApp on http://localhost:8888


#Programmatic access 

LX also exports its scanning functionality for use in other projects. 

#### lx(scan_type,path,options,callback)

__Arguments__

* `scan_type` is a string representing the project type you want to scan. Ex: "node". 
* `path` is a string indicating the path to either a root level project directory, or a folder containing a node_modules folder to be scanned
* The callback is called as `callback(error,license_information)`. 
    `license_information` is an array of JavaScript objects representing identified packages and the licensing information gathered about them. The attributes for those objects are: 
    - `name`: The package's name
    - `version`: The installed version of the package
    - `label`: The name and version joined by @: name@version. 
    - `repository`: If a git URL corresponding to the package's git repository is found during the scan, that URL is stored here. Otherwise the URL is the same as the package's home page. 
    - `homepage`: A URL pointing to the package's home page, for example its github page. 
    - `licensefile`: An array of objects containing information about the licenses the package is distributed under. Each of these license objects potentially has a `licensepath` attribute which identifies either the local file path or remote URL to the license's text, `notice` which is an extracted legal notice corresponding to the license, and `text` which is the full text of the license. 
    - `license`: This is an object with information about any permissive license that the package is distributed under. It has two attributes: `type` which is a quick identifier (ex: MIT) and `url` which is a web URL to the license text. 
* `options` is an object which can contain a variety of parameters as attributes:
	- `noremote`: If `Boolean(noremote)` is true, then the scanner will not attempt to obtain licensing information from the internet. 
    - `diff_objects`: If you want to perform a diff scan against a group of other license objects, those objects can be passed as this attribute.  
	    	
```js
var options = {   
    diff_objects: [
	    {
		    name:"abbrev",  
		    label:"abbrev@1.0.5",  
		    version:"1.0.5",  
		    licensefile:[{licensepath:"/home/user/node_modules/lx/node_modules/abbrev/LICENSE",notice:"Copyright 2009, 2010, 2011 Isaac Z. Schlueter.",text:"snip"}],  
		    license: {type:"MIT",url:"https://github.com/isaacs/abbrev-js/raw/master/LICENSE"},  
		    repository:"http://github.com/isaacs/abbrev-js",  
		    homepage:"https://github.com/isaacs/abbrev-js"  
	    }   
    ]  
};   
// license_objects will not include "abbrev@1.0.5"  
lx("node","/home/user/node_modules/lx",options,function(error,license_objects){});  
```
	

#### Example

```js
var lx = require("lx-scan"); 

// Scans "lx", gathers licensing information, and then prints out the array of package
// information
lx("node","/home/user/Documents/node_modules/lx",{},function (error,license_objects) { 
	console.log(license_objects); 
}); 
```


#Python scanning (experimental)#

LX experimentally supports scanning Python (2.6) packages and install bases.

####  lx("python",path\_to\_python_binary,options,callback)

The Python scanner searches packages installed using the python executable indicated at `path_to_python_binary` for a package matching the name `options.package_name`. If a binary isn't indicated your global install base will be used. If a package name isn't indicated, information will be collected about the entire install base. 

`callback` is called as `callback(error,license_information)` where `license_information` is an array of objects that contain licensing information about the scanned packages. 

```js
// Scans the entirety of the global install base and prints out licensing information
lx("python",,{},function (error, license_objects) {
	console.log(license_objects); 
}); 
```

Python scanning requires both python and setuptools to be installed. It obtains licensing information about the package, and then does the same for all packages that would be listed as required by the `pip show <package_name>` command. This is done recursively until no more required packages are found, and then the result is outputted. For the package eazytext pip show returns:
	
	$ ./pip show eazytext
	---
	Name: eazytext
	Version: 0.94
	Location: /home/pedwards/newpip/lib/python2.6/site-packages
	Requires: ply, pygments, paste, zope.interface, zope.component  

LX's python scanner will collect licensing information about eazytext, and then perform the same process for all of ply, pygments, etc. 

#Performance# 

Lenovo W520 laptop with 8GB memory

$ uname -a
Linux 2.6.32-431.30.1.el6.x86\_64 #1 SMP Wed Jul 30 14:44:26 EDT 2014 x86\_64 x86\_64 x86_64 GNU/Linux

$ npm install -g phonegap  <534 node modules counting duplicates installed in /usr/local/lib/node_modules>

$ time bin/lx-cli.js --prefix ~/local/lib > /dev/null

real	0m6.829s
user	0m4.027s
sys	    0m0.590s


#Contributors#

See AUTHORS


#License and Copyright#

Copyright (c) 2014, International Business Machines Corporation

