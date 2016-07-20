/*
	book.js: everything about books
 */

var db		= require("./db.js");
var err		= require("./err.js");
var util	= require("./util.js");
var wallet	= require("./wallet.js");
var isbn	= require("./isbn.js");
var user	= require("./user.js");

exports.Book = function (id, isbn, name, value) {
	return {
		_id: id,
		isbn: isbn,
		locked: false,
		name: name,
		value: parseInt(value)
	};
}

exports.ContributeRequest = function (id, isbn, login) {
	return {
		_id: id,
		locked: false,
		user: login,
		isbn: isbn
	};
}

function getNewBookID(env, proc) {
	return db.col(env, db.const.state, err.callback(env, function (col) {
		col.findOneAndUpdate(
			{}, { $inc: { "book_id": 1 } }, { new: true, upsert: true, returnOriginal: false },
			err.callback(env, function (obj) {
				return proc(obj.value.book_id);
			})
		);
	}))
}

/*
	info {
		isbn: string,
		name: string,
		value: number
	}
 */
exports.addBook = function (env, info, proc) {
	return db.col(env, db.const.book_tab, err.callback(env, function (col) {
		getNewBookID(env, function (id) {
			var book;
			col.insert(
				(book = exports.Book(id, info.isbn, info.name, info.value)),
				err.callback(env, function () {
					proc(env, book);
				})
			);
		});
	}));
}

exports.IAddBook = function (env, arg) {
	if (!util.checkArg(env, arg, [ "name", "value" ])) {
		return;
	}

	var value = parseInt(arg.value);

	if (!wallet.isLegalValue(value)) {
		err.poperr(env, "illegal_book_value");
		return;
	}

	return exports.addBook(env,
		{ isbn: "", name: arg.name, value: value },
		function (env, book) {
			env.sendValue(book._id);
		}
	);
}

// make sure id exist
exports.lockBook = function (env, id, proc) {
	return db.col(env, db.const.book_tab, err.callback(env, function (col) {
		col.findOne(
			{ _id: id },
			err.callback(env, function (res) {
				if (res) {
					col.findOneAndUpdate(
						{ _id: id, locked: false },
						{ $set: { locked: true } },
						err.callback(env, function (res) {
							if (res.value) {
								env.addLockedBook(id);
								proc(env, res.value)
							} else {
								err.poperr(env, "server_busy");
							}
						})
					);
				} else {
					err.poperr(env, "book_not_exist");
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
				proc && proc(env);
			})
		);
	}));
}

function getNewContriID(env, proc) {
	return db.col(env, db.const.state, err.callback(env, function (col) {
		col.findOneAndUpdate(
			{}, { $inc: { "contri_id": 1 } }, { new: true, upsert: true, returnOriginal: false },
			err.callback(env, function (obj) {
				return proc(obj.value.contri_id);
			})
		);
	}))
}

// request for contribution
exports.IContribute = function (env, arg) {
	if (!util.checkArg(env, arg, [ "isbn" ])) {
		return;
	}

	var i13 = isbn.parseISBN(arg.isbn);

	if (!i13) {
		err.poperr(env, "invalid_isbn");
		return;
	}

	return user.login(env, function (env, user, col) {
		db.col(env, db.const.contri_tab,
			err.callback(env, function (col) {
				col.count({ user: user.login },
					err.callback(env, function (count) {
						if (count < 5) {
							col.count({ user: user.login, isbn: i13 },
								err.callback(env, function (count) {
									if (!count) {
										getNewContriID(env, function (id) {
											col.insert(exports.ContributeRequest(id, i13, user.login),
												err.callback(env, function () {
													env.sendValue(id);
												})
											);
										});
									} else {
										err.poperr(env, "contri_overlap");
										return;
									}
								})
							);
						} else {
							err.poperr(env, "contri_req_limit");
							return;
						}
					})
				);
			})
		);
	});
}

exports.lockContri = function (env, id, proc) {
	return db.col(env, db.const.contri_tab, err.callback(env, function (col) {
		col.findOne(
			{ _id: id },
			err.callback(env, function (res) {
				if (res) {
					col.findOneAndUpdate(
						{ _id: id, locked: false },
						{ $set: { locked: true } },
						err.callback(env, function (res) {
							if (res.value) {
								env.addLockedContri(id);
								proc(env, res.value, col)
							} else {
								err.poperr(env, "server_busy");
							}
						})
					);
				} else {
					err.poperr(env, "contri_not_exist");
				}
			})
		);
	}));
}

exports.unlockContri = function (env, id, proc) {
	return db.col(env, db.const.contri_tab, err.callback(env, function (col) {
		col.findOneAndUpdate(
			{ _id: id },
			{ $set: { locked: false } },
			err.callback(env, function (res) {
				proc && proc(env);
			})
		);
	}));
}

exports.IConfirmContri = function (env, arg) {
	if (!util.checkArg(env, arg, [ "id" ])) {
		return;
	}

	var id = parseInt(arg.id);

	return user.login_s(env, function (env, u, col) {
		exports.lockContri(env, id, function (env, contri, col) {
			if (u.level <= user.levels.admin) {
				col.findOneAndDelete(
					{ _id: contri._id },
					err.callback(env, function (res) {
						if (res.value) {
							exports.addBook(env,
								{
									isbn: contri.isbn,
									name: "not specified",
									value: 10
								},
								function (env, book) {
									env.sendValue(book._id);
								}
							);
						} else {
							err.poperr(env, "contri_not_exist");
							return;
						}
					})
				);
			} else {
				err.poperr(env, "no_auth");
				return;
			}
		});
	});
}
