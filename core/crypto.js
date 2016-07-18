/*
	crypto.js: convenient interfaces of crypt
 */

var crypto	= require('crypto');

exports.md5 = function (data) {
	return crypto.createHash("md5").update(data).digest("hex");
}

exports.sha1 = function (data) {
	return crypto.createHash("sha1").update(data).digest("hex");
}

exports.hmac = function (encrypt, data, key) {
	return crypto.createHmac(encrypt, key).update(data).digest("hex");
}

exports.aes_enc = function (data, key) {
	var ciph = crypto.createCipheriv(
		"aes-128-ecb",
		exports.md5(key).substring(5, 21), ""
	);
	var ret = "";

	ret += ciph.update(data, "utf8", "hex");
	ret += ciph.final("hex");
	
	return ret;
}

exports.aes_dec = function (ciph, key) {
	var deciph = crypto.createDecipheriv(
		"aes-128-ecb",
		exports.md5(key).substring(5, 21), ""
	);
	var ret = "";

	try {
		ret += deciph.update(ciph, "hex", "utf8");
		ret += deciph.final("utf8");
	} catch (e) {
		return null;
	}

	return ret;
}
