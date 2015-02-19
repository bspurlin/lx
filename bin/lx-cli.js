#!/usr/bin/env node
var lx = require("../lx.js"),
nopt = require ("nopt"),
fs = require("fs"),
knownOpts = { "prefix" : String},
parsed = nopt( knownOpts, undefined, process.argv),
er = null,
prefix = "",
re = /\/+$/


if(parsed.prefix==undefined) {
    usage()  
    return 1
} else prefix = parsed.prefix

prefix = prefix.replace(re,"")

if(prefix) { 
    try {
	var stats = fs.lstatSync(prefix + "/node_modules")
    } catch (e) {
	console.error(prefix + "/node_modules", " does not exist")
	er = true
	return 1
    }
}

if (!stats.isDirectory()) {
    console.error(prefix + "/node_modules", "is not a directory")
    return 1
}
//console.log("path=",prefix, stats.isDirectory()); return 1



var opts = {prefix: prefix  , dir: prefix + "/node_modules" }

var headers = {"user": process.env.USER?process.env.USER:process.env.USERNAME,
	       "date": Date(),
	       "path":  prefix + "/node_modules",
	       "hostname": process.env.HOSTNAME?process.env.HOSTNAME:process.env.COMPUTERNAME,
	       "modified":[
		   {USER: process.env.USER?process.env.USER:process.env.USERNAME,
		   "date": Date()}]
}

lx("node", prefix+"/node_modules", opts, function(er, licobjs) {
    if(er) console.error(er);
    else console.log(JSON.stringify({"headers": headers, "data": licobjs}))
})

function usage(str){
 console.error("Usage:  <program> --prefix <directory containing a node_modules subirectory")
}
