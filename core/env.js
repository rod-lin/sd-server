/*
	env.js: pack up request/response environment
 */

var date	= require("./date.js");
var bookm	= require('./book.js');

var common_header = {
	"Content-Type": "text/json;charset=UTF-8"
};

exports.Env = function (id, req, resp) {
	var cookie = {};

	if (req && req.headers.cookie) {
		req.headers.cookie.split(";").forEach(function (entry) {
			var kv = entry.split("=");
			cookie[kv[0].trim()] = (kv[1] || "").trim();
		});
	}

	return {
		id: id,
		req: req,
		resp: resp,
		cookie: cookie,
		buffer: [],
		connect: [],
		locked_book: [],
		closeAllDB: function () {
			// TODO: probably need to close db with a little bit delay
			// to temporarily cover some possible bugs in which the response is ended before
			// the end of db operation(s)
			for (var i = 0; i < this.connect.length; i++) {
				this.connect[i].close();
			}

			return;
		},
		addDB: function (db) {
			this.connect.push(db);
			return;
		},
		writeRaw: function (text) {
			this.buffer.push(text);
			return;
		},
		sendValue: function (value) {
			this.writeRaw(JSON.stringify({
				status: true,
				value: value
			}));
			this.endResponse();
			return;
		},
		sendError: function (msg) {
			this.writeRaw(JSON.stringify({
				status: false,
				value: msg
			}));
			this.endResponse();
			return;
		},
		remote: function () {
			if (this.req)
				return this.req.connection.remoteAddress;
			
			return "self";
		},
		endResponse: function (status, header) {
			if (this.resp) {
				var cookie = this.cookie;
				var cookie_arr = [];

				for (var key in cookie) {
					if (cookie[key]) {
						cookie_arr.push(key + "=" + cookie[key]);
					}
				}

				if (cookie_arr.length) {
					this.resp.setHeader("Set-Cookie", cookie_arr);
				}

				this.resp.writeHead(status || 200, header || common_header);

				for (var i = 0; i < this.buffer.length; i++) {
					this.resp.write(this.buffer[i]);
				}
				this.buffer = [];
				
				this.resp.end();
				this.resp = null;
			}

			this.clean();

			return;
		},
		log: function (str) {
			console.log("[" + this.id + ":" + date.getTimeStamp() + "] LOG: " + str);
			return;
		},
		err: function (e) {
			if (typeof e == "string") {
				console.log("[" + this.id + ":" + date.getTimeStamp() + "] ERR: " + (new Error(e)).stack);
			} else {
				console.log("[" + this.id + ":" + date.getTimeStamp() + "] EXCEPTION: " + e.stack);
			}
			return;
		},
		// serious problem need administrator to handle
		crush: function (str, value) {
			console.log("[" + this.id + ":" + date.getTimeStamp() + "] CRUSH: " + (new Error(str)).stack);
			
			if (value) {
				console.log(value);
			}

			return;
		},
		addLockedBook: function (id) {
			this.locked_book.push(id);
			return;
		},
		unlockAllBook: function (callback) {
			var ids = this.locked_book;
			
			for (var i = 0; i < ids.length; i++) {
				bookm.unlockBook(this, ids[i], callback);
			}

			return;
		},
		clean: function () {
			env = this;
			this.unlockAllBook(function () {
				env.closeAllDB();
				env.connect = [];
			});
			return;
		}
	};
}
