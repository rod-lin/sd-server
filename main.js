var url			= require("url");
var qs			= require("querystring");
var multiparty	= require("multiparty");

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
				function get_proc(args) {
					env.log("interface handler " + ifname.join(".") + " triggered");
					intf(env, args);
				}

				function post_proc(args, files) {
					if (!files) return get_proc(args);
					env.log("interface handler " + ifname.join(".") + " triggered");
					intf(env, args, files);
				}

				if (request.method == "GET") {
					get_proc(qs.parse(parsed.query));
				} else if (request.method == "POST") {
					var form = new multiparty.Form();
					form.maxFilesSize = err.file_max_size;

					var args = {}, files = null;

					form
					.on("error", function (e) {
						env.err(e);
						err.poperr(env, "failed_upload");
						return;
					})
					.on("field", function (name, value) {
						args[name] = value;
						return;
					})
					.on("file", function (name, file) {
						if (!files) files = {};
						files[name] = file;
						return;
					})
					.on("close", function () {
						post_proc(args, files);
					});

					form.parse(request);
				}
			} else {
				env.sendError(err.code.no_interface, 404);
			}
		}
	);

	return;
}
