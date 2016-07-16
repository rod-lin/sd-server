var db		= require("./db.js");
var err		= require("./err.js");
var date	= require("./date.js");
var wallet	= require("./wallet.js");
var util	= require("./util.js");
var crypto	= require('./crypto.js');
var bookm	= require('./book.js');

var SD_SESSIONID_KEY = "_sd_session";

function encryptPass(n, p) {
	return crypto.hmac("md5", crypto.sha1(p), crypto.md5(n));
}

function getSessionID(name, time) {
	return crypto.hmac("md5", crypto.md5(time.toString()), crypto.sha1(name));
}

/*
	user = {
		login,
		name,
		passwd,
		session,
		timest,
		wallet: {},
		contri: [],
		private: [],
		public: []
	};
*/

var levels = {
	system: 0,
	repo: 1,
	admin: 2,
	ord: 3
};
exports.levels = levels;

function User(info) {
	return {
		login: info.login,
		name: info.name,
		passwd: encryptPass(info.login, info.passwd),
		session: null,
		timest: 0,
		level: levels.ord, // user level:
						   // 0: system -- 1. unable to login
						   // 			  2. balance can be negative
						   // 			  3. can increase dollars
						   // 1: repository -- unable to login, can only receive books
						   // 2: admin -- 1. able to login
						   // 			 2. can revert transactions, but cannot create them
						   // 			 3. able to raise other users' level(up to admin)
						   // >3: ordinary
		wallet: wallet.Wallet(),
		contri: [],
		private: [],
		public: []
	};
}

/*
	user_info: {
		str login_name
		str nick_name
		str passwd
	}
 */
exports.IAddUser = function (env, user_info) {
	if (!util.checkArg(env, user_info, [ "login", "name", "passwd" ])) {
		return;
	}

	return db.col(env, db.const.user_tab,
		err.callback(env, function (col) {
			col.count(
				// first check
				{ login: user_info.login },
				err.callback(env, function (count) {
					if (count > 0) {
						// user exists
						err.poperr(env, "user_exists");
						env.endResponse();
					} else {
						// add new user
						col.insert(User(user_info),
								   err.callback(env, function () {
							env.sendValue(null);
						}));
					}
				})
			);
		})
	);
}

/*
	login_info: {
		str login
		str passwd
	}
 */
exports.INewSession = function (env, login_info) {
	if (!util.checkArg(env, login_info, [ "login", "passwd" ])) {
		return;
	}

	return db.col(env, db.const.user_tab,
		err.callback(env, function (col) {
			col.find({
				login: login_info.login,
				passwd: encryptPass(login_info.login, login_info.passwd)
			}).toArray(err.callback(env, function (res) {
				if (res.length) {
					var timest = date.getTimeStamp();
					var session = getSessionID(login_info.login, timest);
					col.update(
						{ login: login_info.login },
						{ $set: { session: session, timest: timest } },
						err.callback(env, function () {
							env.cookie[SD_SESSIONID_KEY] = session;
							env.sendValue(session);
						})
					);
				} else {
					err.poperr(env, "login_failed");
					env.endResponse();
				}
			}));
		})
	);
}

exports.logout = function (env, callback) {
	env.cookie[SD_SESSIONID_KEY] = "nop";
	callback();
	return;
}

exports.ILogout = function (env) {
	exports.logout(env, function () {
		env.sendValue(null);
	});
	return;
}

/*
	login: try to log in using session id in the cookie
		-> suc: call callback with login name and collection
		-> failed: pop message and return null
 */
exports.login = function (env, callback, session_id) {
	var session = session_id || env.cookie[SD_SESSIONID_KEY];

	if (!session) {
		err.poperr(env, "invalid_session");
		return null;
	}

	return db.col(env, db.const.user_tab,
		err.callback(env, function (col) {
			col.find({ session: session })
			.toArray(err.callback(env, function (res) {
				if (res.length) {
					// find session id
					var cur_time = date.getTimeStamp();
					var user = res[0];

					if (cur_time - user.timest >= err.session_timeout) {
						// timeout!
						exports.logout(env, function () {
							err.poperr(env, "session_timeout");
						});
					} else if (user.level >= levels.admin
							   || err.debug) {
						// only users with level >= admin can log in
						callback(user, col);
					} else {
						err.poperr(env, "no_auth");
					}
				} else {
					err.poperr(env, "invalid_session");
				}
			}));
		})
	);
}

exports.IChangeName = function (env, arg) {
	if (!util.checkArg(env, arg, [ "new" ])) {
		return;
	}

	return exports.login(env, function (user, col) {
		col.findOneAndUpdate(
			{ login: user.login },
			{
				$set: { name: arg.new }
			},
			err.callback(env, function () {
				env.sendValue(null);
			})
		);
	})
}

exports.ITransfer = function (env, arg) {
	if (!util.checkArg(env, arg, [ "to", "amt" ])) {
		return;
	}

	return exports.login(env, function (user, col) {
		wallet.applyTransac(
			env, wallet.Transaction(
				arg.amt,
				user.login, arg.to, null,
				arg["descr"] || "no description",
				{
					success: function (env, trans) {
						env.sendValue(trans);
						return;
					},
					failed: function (env, trans, errno) {
						err.poperr(env, errno || "unable_finish_trans");
						return;
					}
				}
			)
		);
	});
}

exports.IChangeBalance = function (env, arg) {
	if (!util.checkArg(env, arg, [ "value" ])) {
		return;
	}

	return exports.login(env, function (user, col) {
		if (user.level == levels.system) { // only system can change dollar without limit
			col.findOneAndUpdate(
				{ login: user.login },
				{ $set: { "wallet.balance": parseFloat(arg.value) } },
				err.callback(env, function () {
					env.sendValue(null);
				})
			);
		} else {
			err.poperr(env, "no_auth");
			return;
		}
	});
}

exports.IChangeLevel = function (env, arg) {
	if (!util.checkArg(env, arg, [ "level" ])) {
		return;
	}

	return exports.login(env, function (user, col) {
		var to_level = parseInt(arg.level);
		arg.user = arg.user || user.login;
		// if no user specified, change own level

		if (to_level < 0) {
			err.poperr(env, "illegal_level");
			return;
		}

		/*
			change level range:

			cur level		can change to
			0				0 - inf
			1				1 - inf
			2				2 - inf
			.
			. (so on)
			.
		 */
		
		if (arg.level < user.level) {
			err.poperr(env, "no_auth");
			return;
		}

		col.findOneAndUpdate(
			{ login: arg.user },
			{ $set: { level: parseInt(arg.level) } },
			err.callback(env, function () {
				env.sendValue(null);
			})
		);
	});
}

function applyBookTrans(env, payer, payee, book) {
	return bookm.lockBook(env, book._id, function (env, book) {
		return wallet.applyTransac(
			env, wallet.Transaction(
				book.value,
				payer, payee, book._id,
				"book purchase",
				{
					success: function (env, trans) {
						bookm.unlockBook(env, book._id, function (env) {
							env.sendValue(trans);
						});
						return;
					},
					failed: function (env, trans, errno) {
						bookm.unlockBook(env, book._id, function (env) {
							err.poperr(env, errno || "unable_finish_trans");
						});
						return;
					}
				}
			)
		);
	});
}

// buy book
exports.IBuyBook = function (env, arg) {
	if (!util.checkArg(env, arg, [ "book" ])) {
		return;
	}

	var book_id = parseInt(arg.book);

	return exports.login(env, function (user, col) {
		col.find(
			{ "public": { $in: [ book_id ] } }
		).toArray(err.callback(env, function (res) {
			if (res.length) {
				if (res.length == 1) {
					var owner = res[0];
					// TODO: probably not thread-safe
					db.col(env, db.const.book_tab, err.callback(env,
						function (col) {
							col.find({ _id: book_id }).toArray(
								err.callback(env, function (arr) {
									if (arr.length) {
										applyBookTrans(env, user.login, owner.login, arr[0]);
									} else {
										err.poperr(env, "book_not_exist");
									}
								})
							);
						}
					));
				} else {
					env.crush("multi-book-ownership", res);
					err.poperr(env, "multi_ownership");
				}
			} else {
				err.poperr(env, "book_not_pub");
			}
		}));
	});
}

// put private book on sale(to public book list)
exports.IPutOnSale = function (env, arg) {
	if (!util.checkArg(env, arg, [ "book" ])) {
		return;
	}

	var book_id = parseInt(arg.book);

	return exports.login(env, function (user, col) {
		if (user.private.indexOf(book_id) != -1) {
			bookm.lockBook(env, book_id, function (env, book) {
				col.findOneAndUpdate(
					{ login: user.login },
					{
						$push: { public: book_id },
						$pull: { private: book_id }
					},
					err.callback(env, function () {
						bookm.unlockBook(env, book_id, function (env) {
							env.sendValue(null);
						});
					}, function (next) {
						bookm.unlockBook(env, book_id, function (env) {
							next();
						});
					})
				);
			});
		} else {
			err.poperr(env, "book_not_priv");
		}
	});
}

// reverse the process of IPutOnSale
exports.IRemovePubBook = function (env, arg) {
	if (!util.checkArg(env, arg, [ "book" ])) {
		return;
	}

	var book_id = parseInt(arg.book);

	return exports.login(env, function (user, col) {
		if (user.public.indexOf(book_id) != -1) {
			bookm.lockBook(env, book_id, function (env, book) {
				col.findOneAndUpdate(
					{ login: user.login },
					{
						$pull: { public: book_id },
						$push: { private: book_id }
					},
					err.callback(env, function () {
						bookm.unlockBook(env, book_id, function (env) {
							env.sendValue(null);
						});
					}, function () {
						bookm.unlockBook(env, book_id, function (env) {
							next();
						});
					})
				);
			});
		} else {
			err.poperr(env, "book_not_pub");
		}
	});
}
