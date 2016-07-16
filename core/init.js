/*
	init.js: everything have to be done when starting up
 */

var err		= require("./err.js");
var db		= require("./db.js");

exports.initDB = function (env, callback) {
	db.col(env, db.const.user_tab,
		err.callback(env, function (col) {
			col.ensureIndex(
				{ "login": 1 },
				{ "unique": true },
				err.callback(env, callback)
			);
		})
	);
	return;
}
