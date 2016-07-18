var mg		= require("mongodb");
var err		= require("./err.js");

var SD_DBURL = "mongodb://localhost:27017/sd";

exports.const = {
	user_tab: "user_tab",
	book_tab: "book_tab",
	action_tab: "action_tab",
	state: "state",
	trans_lst: "trans_lst"
};

var opendb = [];

exports.closeAll = function () {
	for (var i = 0; i < opendb.length; i++) {
		opendb[i].close();
	}

	return;
}

exports.db = function (env, handler) {
	return mg.MongoClient.connect(
		SD_DBURL,
		function (err, res) {
			if (env)
				env.addDB(res);
			handler(err, res);
		}
	);
}

exports.col = function (env, name, handler) {
	return exports.db(env, err.callback(env, function (db) {
		db.collection(
			name,
			handler
		);
	}));
}
