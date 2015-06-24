var path = require("path"),
asyncMap = require("slide").asyncMap,
semver = require("semver"),
readJson = require("read-package-json"),
url = require("url"),

npa = require("npm-package-arg")


try {
  var fs = require("graceful-fs")
} catch (er) {
    var fs = require("fs")
}
var scanner = require("./scanner_proto.js"); 



function lx (lxopts, cb) {

    var lxpackages = []

    var prefix = lxopts.prefix

    readLic(prefix, null, null, null, 0, {"dev": true}, function (er, obj ) {
	if (er) return cb(er)
    // now obj has all the installed things, where they're installed
    // figure out the inheritance links, now that the object is built.
		//    resolveInheritance(obj, opts)
		//    markExtraneous(obj)
      var objs = []

	obj = makeLicInfo(obj, null, null, null, null, lxpackages);
      //console.log(lxpackages)
	var seen = {}	
	lxpackages.forEach(
	       function(pkg, cb){
       // FIXME: The "version" tag here is obtained in a rather dirty way; what really needs to happen is that the version and name
       // attributes should be generated and labelled separated during the intial scan sweep
		   var obj = {"name":pkg.name, "label": pkg.label, "version": pkg.label.split("@")[1], "licensefile": pkg.licensefile}
		   if(seen[pkg.label] == undefined) seen[pkg.label] = 1
		   else {
		       seen[pkg.label]++
		       //console.error("seen",pkg.label,seen[pkg.label])
		   }
		   if(pkg.licensefile.length == 0 && pkg.repository && seen[pkg.label] == 1) {
		       var a = pkg.repository
		       obj["repository"] = a
		       if (obj.homepage == undefined) obj["homepage"] = a
		       objs.push(obj)
		   } else if(seen[pkg.label] == 1){
		       if(pkg.license) obj["license"]= pkg.license
		       if(pkg.repository) obj["repository"] = pkg.repository
		       if(pkg.homepage) obj["homepage"] = pkg.homepage
		       else if(pkg.repository)  obj["homepage"] = pkg.repository
		       objs.push(obj)
		   }
		   
		   if(pkg.licensefile) obj["licensefile"]= pkg.licensefile

		       
		
	       }
	)
  cb(null,objs); 
    })
}

var rpSeen = {}

function readLic(folder, parent, name, reqver, depth, opts, cb) {
  var installed
    , obj
    , real
    , link
  fs.readdir(path.resolve(folder, "node_modules"), function (er, i) {
    // error indicates that nothing is installed here
    if (er) i = []
    installed = i.filter(function (f) { return f.charAt(0) !== "." })
    next()
  })
  
  readJson(path.resolve(folder, "package.json"), function (er, data) {
    obj = copy(data)

    if (!parent) {
      obj = obj || true
      er = null
    }
    return next(er)
  })

  fs.lstat(folder, function (er, st) {
    if (er) {
      if (!parent) real = true
      return next(er)
    }






    fs.realpath(folder, function (er, rp) {
      //console.error("realpath(%j) = %j", folder, rp)
      real = rp
      if (st.isSymbolicLink()) link = rp
      next(er)
    })
  })

  var errState = null
    , called = false
  function next (er) {
    if (errState) return
    if (er) {
      errState = er
      return cb(null, [])
    }
    //console.error('next', installed, obj && typeof obj, name, real)
    if (!installed || !obj || !real || called) return
    called = true
    if (rpSeen[real]) return cb(null, rpSeen[real])
    if (obj === true) {
      obj = {dependencies:{}, path:folder}
      installed.forEach(function (i) { obj.dependencies[i] = "*" })
    }
    if (name && obj.name !== name) obj.invalid = true
    obj.realName = name || obj.name
	
    obj.dependencies = obj.dependencies || {}
    // "foo":"http://blah" and "foo":"latest" are always presumed valid
    if (reqver
        && semver.validRange(reqver, true)
        && !semver.satisfies(obj.version, reqver, true)) {
      obj.invalid = true
    }

    if (parent) {
      var deps = parent.dependencies || {}
      var inDeps = name in deps
      var devDeps = parent.devDependencies || {}
      var inDev = opts.dev && (name in devDeps)
      if (!inDeps && !inDev) {
        obj.extraneous = true
      }
    }

    obj.path = obj.path || folder
    obj.realPath = real
    obj.link = link
    if (parent && !obj.link) obj.parent = parent
    rpSeen[real] = obj
    obj.depth = depth
    //if (depth >= opts.depth) return cb(null, obj)
    asyncMap(installed, function (pkg, cb) {
      var rv = obj.dependencies[pkg]
      if (!rv && obj.devDependencies && opts.dev)
        rv = obj.devDependencies[pkg]

      if (depth >= opts.depth) {
        // just try to get the version number
        var pkgfolder = path.resolve(folder, "node_modules", pkg)
          , jsonFile = path.resolve(pkgfolder, "package.json")
        return readJson(jsonFile, function (er, depData) {
          // already out of our depth, ignore errors
          if (er || !depData || !depData.version) return cb(null, obj)
          if (depth === opts.depth) {
            // edge case, ignore dependencies
           depData.dependencies = {}
            depData.peerDependencies = {}
            obj.dependencies[pkg] = depData
          } else {
            obj.dependencies[pkg] = depData.version
          }
          cb(null, obj)
        })
      }
      //wjs      console.log(folder)
      readLic( path.resolve(folder, "node_modules/"+pkg)
                    , obj, pkg, obj.dependencies[pkg], depth + 1, opts
                    , cb )

	}, function (er, installedData) {
      if (er) return cb(er)
      installedData.forEach(function (dep) {
        obj.dependencies[dep.realName] = dep
      })

      return cb(null, obj)
    })
  }


}

function copy (obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(copy)

  var o = {}
  for (var i in obj) o[i] = copy(obj[i])
  return o
}


function makeLicInfo (data, dir, depth, parent, d, lxpackages) {

  if (typeof data === "string") {
//    if (depth < npm.config.get("depth")) {
      // just missing
//      var p = parent.link || parent.path
//      var unmet = "UNMET DEPENDENCY"
//    }
    return data
  }

  var out = {}
  // the top level is a bit special.
  out.label = data._id || ""
  if (data._found === true && data._id) {

    out.label = out.label.trim()
  }
  if (data.link) out.label += " -> " + data.link

  if (data.invalid) {
    if (data.realName !== data.name) out.label += " ("+data.realName+")"
    out.label += " "  + "invalid"
  }

  if (data.peerInvalid) {
    out.label +=  " "  +  "peer invalid"
  }

  if (data.extraneous && data.path !== dir) {
    out.label += " " + "extraneous"
  }

  // add giturl to name@version
  if (data._resolved) {
    var p = url.parse(data._resolved)
    if (npa(data._resolved).type === "git")
      out.label += " (" + data._resolved + ")"
  }

  if (data.name) {
      out.name=data.name
  
      var str = ""
      var files = []
      if(data.parent != null) files = fs.readdirSync(data.path) 
      data.licensefile = []
      files.forEach(function (i){
	  var aa = []
	  if (i.match(/licen[cs]/i)) { 
	      str = str + data.path + "/" + i
	      data.licensefile.push({"licensepath":str,"notice": undefined})
	  } else if (i.match(/^readme/i) && data.licensefile.length == 0 ) {
	      str = data.path + "/" + i
	      data.licensefile.push({"licensepath":str,"notice": undefined})
//	      console.log("no license file but " + str)
	  }
	  str = ""
      })
      
  }

  if (data.version) out.version=data.version
  if (data.description) out.description=data.description
  if (data.repository) out.repository=data.repository.url
  if (data.homepage) out.homepage=data.homepage
  // if (data.license) out.license=data.license
  if (data.licensefile) {
      var i = 0;
      out.licensefile=data.licensefile
      out.licensefile.forEach(function(lic) {
	  if(fs.lstatSync(lic.licensepath).isFile()) {
	      var str = fs.readFileSync(lic.licensepath,'utf8')
	      if (aa = str.match(/(copyright.+)/i))  {
		//  lic.notice = aa[0]
		  lic.text = str
		  i++}
	      else {}
	  }
      })
      if(i == 0) out.licensefile = []
  }

   if(out.label != '') lxpackages.push(out)


  // now all the children.
  out.nodes = Object.keys(data.dependencies || {})
    .sort(alphasort).map(function (d) {
      return makeLicInfo(data.dependencies[d], dir, depth + 1, data, d, lxpackages)
    })

  if (out.nodes.length === 0 && data.path === dir) {
    out.nodes = ["(empty)"]
  }

  return out
}

function alphasort (a, b) {
  a = a.toLowerCase()
  b = b.toLowerCase()
  return a > b ? 1
       : a < b ? -1 : 0
}


module.exports = new scanner({scanner_function: lx}); 