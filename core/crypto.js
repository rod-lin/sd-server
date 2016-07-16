/*
	crypto.js: convenient interfaces of crypt
 */

var crypto	= require('crypto');

exports.md5 = function (data) {
	return crypto.createHash("md5").update(data).digest("hex");
};

exports.sha1 = function (data) {
	return crypto.createHash("sha1").update(data).digest("hex");
};

exports.hmac = function (encrypt, data, key) {
	return crypto.createHmac(encrypt, key).update(data).digest("hex");
};
