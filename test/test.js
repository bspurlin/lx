module.exports = test

var assert=require("assert")


function test(testobj, f, result, msg) {
    try {
	assert.equal(
	    f(testobj.value)
	    , result
	)
	console.log("ok", result, msg?msg:"")
    } catch(e) {
	console.error(result, "failed", testobj.desc)
    }
}
