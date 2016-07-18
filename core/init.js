/*
	init.js: everything have to be done when starting up
 */

var err		= require("./err.js");
var db		= require("./db.js");

exports.initDB = function (env, callback) {
	db.col(env, db.const.user_tab,
		err.callback(env, function (col) {
			col.ensureIndex(
				{ "login": 1, "session_id": 1 },
				{ "unique": true },
				err.callback(env, function () {
					db.col(env, db.const.action_tab,
						err.callback(env, function (col) {
							col.remove({}, err.callback(env, function () {
								col.ensureIndex(
									{ "action_id": 1 },
									{ "unique": true },
									err.callback(env, callback)
								);
							}));
						})
					);
				})
			);
		})
	);
	return;
}
