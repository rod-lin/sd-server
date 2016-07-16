/*
	state.js: state of books and users
 */

exports.IInitState = function (env) {
	return db.col(env, db.const.state, function (col) {
		col.count(err.callback(env, function (count) {
			if (!count) {
				col.insert({}, err.callback(env));
			}
		}));
	});
}
