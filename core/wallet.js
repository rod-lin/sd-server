/*
	wallet.js: balance and transactions
 */

/*
	Transaction {
		amt // amount
		type // 1 for in, -1 for out
		obj // transaction object -- the payer or payee(null for center repository)
		descr // description
	}
 */

var db		= require("./db.js");
var err		= require("./err.js");
var util	= require("./util.js");
var crypto	= require("./crypto.js");
var date	= require("./date.js");
var user	= require("./user.js");

function getTransID(trans) {
	return crypto.hmac(
		"sha256",
		trans.amt + trans.payer + trans.payee +
		crypto.md5((Math.random() * 1000).toString()),
		date.getTimeStamp().toString()
	);
}

exports.TransLog = function (type /* payer or payee */, trans) {
	switch (type) {
		case "payer":
			return {
				id: trans.id,
				time: trans.time,
				amt: -trans.amt,
				obj: trans.payee,
				descr: trans.descr
			};
		case "payee":
			return {
				id: trans.id,
				time: trans.time,
				amt: trans.amt,
				obj: trans.payer,
				descr: trans.descr
			};
	};

	return null;
}

exports.Transaction = function (amt, payer, payee, book_id, descr, event) {
	var ret = {
		time: date.getTimeStamp(),
		amt: parseFloat(amt),
		payer: payer,
		payee: payee,
		book_id: book_id,
		descr: descr,
		state: 0, // 0: init
				  // 1: add to trans_lst
				  // 2: payer.balance-- & payer add log & book push
				  // 3: payee.balance++ & payee add log & book pull
				  // 4: update trans log list
				  // 5: finish -> call event["success"]
		event: event
	};

	ret.id = getTransID(ret);

	return ret;
}

exports.Wallet = function () {
	return {
		balance: 0,
		trans_log: [],
	};
}

function revertTransac(env, trans, errno, trans_lst, col) {
	switch (trans.state) {
		case 3:
		case 4:
			var pull_log = {
				"wallet.trans_log": { id: trans.id }
			};

			if (trans.book_id != null) {
				pull_log["private"] = trans.book_id;
			}

			// revert payer's log:
			// 1. add back balance
			// 2. remove trans log in payer's wallet
			// 3. remove book id in payer's private repo(if it's involved)
			col.findOneAndUpdate(
				{ login: trans.payer },
				{
					$inc: { "wallet.balance": trans.amt },
					$pull: pull_log
				},
				err.callback(env, function (res) {
					if (res.value) {
						if (trans.state >= 4) {
							// revert payee's log next(if reached state 4):
							// 1. decrease balance
							// 2. remove trans log
							// 3. push back book id(if involved)
							
							// default update log
							var update_log = {
								$inc: { "wallet.balance": -trans.amt },
								$pull: { "wallet.trans_log": { id: trans.id } }
							};

							// add pushing book id if involved
							if (trans.book_id != null) {
								update_log["$push"] = {
									public: trans.book_id
								};
							}

							// commit
							col.findOneAndUpdate(
								{ login: trans.payee },
								update_log,
								err.callback(env, function (res) {
									if (!res.value) {
										env.crush("unable to finish transaction or revert", trans);
									} else {
										// revert finished
										(trans.event["failed"] || function () {})(env, trans, errno);
									}
								}, function () {
									env.crush("unable to finish transaction or revert", trans);
								})
							);
						} else {
							// revert finished
							// call failed event
							(trans.event["failed"] || function () {})(env, trans, errno);
						}
					} else {
						env.crush("unable to finish transaction or revert", trans);
					}
				}, function () {
					env.crush("unable to finish transaction or revert", trans);
				})
			);
			break;
		default: (trans.event["failed"] || function () {})(env, trans, errno);
	}

	return;
}

function finishTransac(env, trans) {
	(trans.event["success"] || function () {})(env, trans);
	return;
}

// finish and call event
function trans_state4(env, trans, trans_lst, col) {
	trans.state = 4;
	trans_lst.findOneAndUpdate({ id: trans.id }, { $set: { "state": trans.state } },
		err.callback(env, function (res) {
			trans.state = 5;
			if (res.value) {
				finishTransac(env, trans);
			} else {
				revertTransac(env, trans, null, trans_lst, col);
			}
		}, function () {
			revertTransac(env, trans, null, trans_lst, col);
		})
	);

	return;
}

// payee.balance -= amount, add trans log, remove book id
function trans_state3(env, trans, trans_lst, col) {
	trans.state = 3;
	trans_lst.findOneAndUpdate({ id: trans.id }, { $set: { "state": trans.state } },
		err.callback(env, function (res) {
			if (res.value) {
				// default log
				var update_log = {
					$inc: { "wallet.balance": trans.amt },
					$push: { "wallet.trans_log": exports.TransLog("payee", trans) }
				};

				// remove book id
				if (trans.book_id != null) {
					update_log["$pull"] = {
						public: trans.book_id
					};
				}

				col.findOneAndUpdate(
					{ login: trans.payee },
					update_log,
					err.callback(env, function (res) {
						// trans.state = 4;
						if (res.value)
							trans_state4(env, trans, trans_lst, col);
						else
							revertTransac(env, trans, "payee_not_exists", trans_lst, col);
					}, function () {
						revertTransac(env, trans, null, trans_lst, col);
					})
				);
			} else {
				revertTransac(env, trans, null, trans_lst, col);
			}
		}, function () {
			revertTransac(env, trans, null, trans_lst, col);
		})
	);

	return;
}

// payer.balance -= amount, add trans log, add book id
function trans_state2(env, trans, trans_lst, col) {
	trans.state = 2; // dec payer balance
	trans_lst.findOneAndUpdate({ id: trans.id }, { $set: { "state": trans.state } },
		err.callback(env, function (res) {
			if (res.value) {
				// default
				var push_log = {
					"wallet.trans_log": exports.TransLog("payer", trans)
				};

				// pushing book id if involved
				if (trans.book_id != null) {
					push_log["private"] = trans.book_id;
				}

				col.findOneAndUpdate(
					{ login: trans.payer },
					{
						$inc: { "wallet.balance": -trans.amt },
						$push: push_log
					}, { returnOriginal: false },
					err.callback(env, function (res) {
						trans.state = 3; // has finished
						if (res.value) {
							if (res.value.wallet.balance >= 0 ||
								res.value.level <= user.levels.repo) {
								trans_state3(env, trans, trans_lst, col);
							} else {
								// not enough balance
								revertTransac(env, trans, "not_enough_balance", trans_lst, col);
							}
						} else {
							revertTransac(env, trans, null, trans_lst, col);
						}
					}, function () {
						revertTransac(env, trans, null, trans_lst, col);
					})
				);
			} else {
				revertTransac(env, trans, null, trans_lst, col);
			}
		}, function () {
			revertTransac(env, trans, null, trans_lst, col);
		})
	);

	return;
}

// set up basic connection
function trans_state1(env, trans, trans_lst) {
	trans.state = 1; // add to trans list
	trans_lst.insert(trans, err.callback(env, function () {
		db.col(env, db.const.user_tab, err.callback(env, function (col) {
			// connect to user table
			trans_state2(env, trans, trans_lst, col);
		}, function () {
			revertTransac(env, trans, null, trans_lst);
		}));
	}, function () {
		revertTransac(env, trans, null, trans_lst);
	}));

	return;
}

exports.isLegalValue = function (value) {
	return typeof value == "number" &&
		   value > 0 &&
		   !isNaN(value) &&
		   value < err.max_accr_amt;
}

// add new transaction to list
exports.applyTransac = function (env, trans) {
	// basic check on transaction

	if (!exports.isLegalValue(trans.amt)) {
		return revertTransac(env, trans, "illegal_trans_amount");
	}

	if (trans.payer == trans.payee) {
		return revertTransac(env, trans, "self_transfer");
	}

	return db.col(env, db.const.trans_lst,
		err.callback(env, function (trans_lst) {
			trans_state1(env, trans, trans_lst);
		}, function () {
			revertTransac(env, trans, null);
		})
	);
}
