/*
	book.js: everything about books
 */

var db		= require("./db.js");
var err		= require("./err.js");
var util	= require("./util.js");

exports.Book = function (id, name, value) {
	return {
		_id: id,
		locked: false,
		name: name,
		value: value
	};
}

exports.getNewBookID = function (env, proc) {
	return db.col(env, db.const.state, err.callback(env, function (col) {
		col.findOneAndUpdate(
			{}, { $inc: { "book_id": 1 } }, { new: true, upsert: true, returnOriginal: false },
			err.callback(env, function (obj) {
				return proc(obj.value.book_id);
			})
		);
	}))
}

exports.IAddBook = function (env, arg) {
	if (!util.checkArg(env, arg, [ "name", "value" ])) {
		return;
	}

	return db.col(env, db.const.book_tab, err.callback(env, function (col) {
		exports.getNewBookID(env, function (id) {
			col.insert(
				exports.Book(id, arg.name, arg.value),
				err.callback(env, function () {
					env.sendValue(null);
				})
			);
		});
	}));
}

// make sure id exist
exports.lockBook = function (env, id, proc) {
	return db.col(env, db.const.book_tab, err.callback(env, function (col) {
		col.findOneAndUpdate(
			{ _id: id, locked: false },
			{ $set: { locked: true } },
			err.callback(env, function (res) {
				if (res.value) {
					proc(env, res.value)
				} else {
					err.poperr(env, "server_busy");
				}
			})
		);
	}));
}

exports.unlockBook = function (env, id, proc) {
	return db.col(env, db.const.book_tab, err.callback(env, function (col) {
		col.findOneAndUpdate(
			{ _id: id },
			{ $set: { locked: false } },
			err.callback(env, function (res) {
				proc(env);
			})
		);
	}));
}
