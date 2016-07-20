var http = require("http");

var main = require("./main.js");
var init = require("./core/init.js");
var Env = require("./core/env.js").Env;
var crypto = require("./core/crypto.js");
var isbn = require("./core/isbn.js");

var env = Env(0, null, null);

if (0) {
	console.log(isbn.parseISBN10("7-309-04547-5"));
	console.log(isbn.parseISBN10("7-309-04547-6"));

	console.log(isbn.parseISBN13("978-7-81090-021-8")); // true
	console.log(isbn.parseISBN13("978-7-80763-292-4")); // true
	console.log(isbn.parseISBN13("978-7-80763-292-3"));

	var i13 = isbn.ISBN10213("7-309-04547-5");

	console.log(i13);
	console.log(isbn.parseISBN13(i13));

	return;
}

init.initDB(env, function () {
	http.createServer(main.requestHandler).listen(8081);
	console.log('server running');
});
