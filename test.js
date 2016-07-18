var http = require("http");

var main = require("./main.js");
var init = require("./core/init.js");
var Env = require("./core/env.js").Env;
var crypto = require("./core/crypto.js");

var env = Env(0, null, null);

init.initDB(env, function () {
	http.createServer(main.requestHandler).listen(8081);
	console.log('server running');
});
