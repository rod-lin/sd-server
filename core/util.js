/*
	util.js: some utils
 */

var err		= require("./err.js");

exports.checkArg = function (env, arg, expects, types) {
	if (!arg) {
		err.poperr(env, "wrong_arg");
		return false;
	}

	for (var i = 0; i < expects.length; i++) {
		if (!arg[expects[i]] ||
			(types && typeof arg[expects[i]] != types[i])) {
			// console.log(arg);
			err.poperr(env, "wrong_arg");
			return false;
		}
	}

	return true;
}
