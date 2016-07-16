/*
	util.js: some utils
 */

var err		= require("./err.js");

exports.checkArg = function (env, arg, expects) {
	for (var i = 0; i < expects.length; i++) {
		if (!arg[expects[i]]) {
			err.poperr(env, "wrong_arg");
			return false;
		}
	}

	return true;
}
