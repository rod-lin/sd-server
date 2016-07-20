/*
	util.js: some utils
 */

var err		= require("./err.js");

exports.checkArg = function (env, arg, expects, type) {
	for (var i = 0; i < expects.length; i++) {
		if (!arg[expects[i]] ||
			(type[i] && typeof arg[expects[i]] != type[i])) {
			// console.log(arg);
			err.poperr(env, "wrong_arg");
			return false;
		}
	}

	return true;
}
