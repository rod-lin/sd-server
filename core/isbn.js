/*
	isbn.js: ISBN check
 */

// return: isbn without dashes and spaces(null for check failed)
exports.parseISBN10 = function (isbn) {
	if (!isbn) return null;

	isbn = isbn.replace(" ", ""); // remove spaces
	isbn = isbn.split("-").join("");

	if (isbn.length != 10) return null;

	var sum = 0, tmp;

	for (var i = 0; i < 9; i++) {
		tmp = parseInt(isbn[i]);
		if (isNaN(tmp)) return null;
		sum += tmp * (10 - i);
	}

	var check = 11 - sum % 11;
	if ((check < 10 && check.toString() == isbn[9]) ||
		(check == 10 && isbn[9].toUpperCase() == 'X')) {
		return isbn;
	}

	return null;
}

function getISBN13Sum(isbn) {
	var sum = 0, tmp;

	for (var i = 0; i < 12; i++) {
		tmp = parseInt(isbn[i]);
		if (isNaN(tmp)) return null;
		if (i % 2)
			sum += tmp * 3;
		else
			sum += tmp;
	}

	return 10 - sum % 10;
}

// return: isbn without dashes and spaces(null for check failed)
exports.parseISBN13 = function (isbn) {
	if (!isbn) return null;

	isbn = isbn.replace(" ", ""); // remove spaces
	isbn = isbn.split("-").join("");

	if (isbn.length != 13) return null;

	if (getISBN13Sum(isbn).toString() == isbn[12]) {
		return isbn;
	}

	return null;
}

// return: isbn-13 without dashes and spaces(null for check failed)
exports.ISBN10213 = function (isbn) {
	var i10 = exports.parseISBN10(isbn);
	var i13;

	if (!i10) return null;

	i13 = "978" + i10.substring(0, 9);
	i13 = i13 + getISBN13Sum(i13).toString();

	return i13;
}

// 10 or 13
exports.parseISBN = function (isbn) {
	var tmp;
	return ((tmp = exports.parseISBN10(isbn)) && exports.ISBN10213(tmp)) || exports.parseISBN13(isbn);
}
