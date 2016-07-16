var url		= require("url");
var qs		= require("querystring");

var user	= require("./core/user.js");
var book	= require("./core/book.js");
var Env		= require("./core/env.js").Env;
var err		= require("./core/err.js");

var ifs = {
	"useradd": user.IAddUser,
	"session": user.INewSession,
	"logout": user.ILogout,
	"chname": user.IChangeName,
	"transfer": user.ITransfer,
	"berich": user.IChangeBalance,
	"chlevel": user.IChangeLevel,
	"buy": user.IBuyBook,
	"onsale": user.IPutOnSale,
	"withdraw": user.IRemovePubBook,
	"assign": user.IAssignBook,
	"bookadd": book.IAddBook
};

var count = 1;

exports.requestHandler = function (request, response) {
	var cur = count++;
	var parsed = url.parse(request.url);
	var ifname = parsed.pathname.substring(1);
	var env = Env(cur, request, response);

	env.log(request.method + " request from " + env.remote() +" for " + parsed.pathname + " received");

	err.ensure(
		env, function () {
			if (ifs[ifname] &&
				request.method == "GET") {
				var args = qs.parse(parsed.query);
				env.log("interface handler " + ifname + " triggered");
				ifs[ifname](env, args);
			} else {
				env.writeRaw("cannot reach " + parsed.pathname);
				env.endResponse(404);
			}
		}
	);

	return;
}
