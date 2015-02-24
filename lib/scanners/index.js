var scan_type_map = {
	"python": require("./python_lx"), 
	"node": require("./node_lx"), 
	"test": require("./test_lx"), 
	"ubuntu": require("./apt_lx")
}; 

var scanners = function(type) { 
	return scan_type_map[type]; 
}; 

module.exports = scanners; 
