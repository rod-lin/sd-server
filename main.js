var url		= require("url");
var qs		= require("querystring");

var user	= require("./core/user.js");
var book	= require("./core/book.js");
var Env		= require("./core/env.js").Env;
var err		= require("./core/err.js");

var ifs = {
	"user": {
		"add": user.IAddUser,
		"session": user.INewSession,
		"logout": user.ILogout,
		"chname": user.IChangeName,
		"chlevel": user.IChangeLevel
	},
	
	"wallet": {
		"transfer": user.ITransfer,
		"berich": user.IChangeBalance
	},
	
	"book": {
		"bookadd": book.IAddBook,
		"buy": user.IBuyBook,
		"onsale": user.IPutOnSale,
		"withdraw": user.IRemovePubBook,
		"assign": user.IAssignBook
	},

	"contri": {
		"req": book.IContribute,
		"confirm": book.IConfirmContri
	},

	"action": {
		"confirm": user.IConfirmAction,
		"pcheck": user.IPasswordConfirm
	}
};

var count = 1;

exports.requestHandler = function (request, response) {
	var cur = count++;
	var parsed = url.parse(request.url);
	var ifname = parsed.pathname.substring(1).split(".");
	var env = Env(cur, request, response);
	var intf = null;

	env.log(request.method + " request from " + env.remote() +" for " + parsed.pathname + " received");

	err.ensure(
		env, function () {
			if (ifs[ifname[0]] &&
				(intf = ifs[ifname[0]][ifname[1]])) {
				function proc(query) {
					var args = qs.parse(query);
					env.log("interface handler " + ifname + " triggered");
					intf(env, args);
				}

				if (request.method == "GET") {
					proc(parsed.query);
				} else if (request.method == "POST") {
					var post_data = "";

					// receive data
					req.addListener("data", function (data) {
						post_data += data;
					});

					req.addListener("end", function () {
						proc(post_data);
					});
				}
			} else {
				env.sendError(err.code.no_interface, 404);
			}
		}
	);

	return;
}
