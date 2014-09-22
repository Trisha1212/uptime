var phantom = require("phantom");

exports.checkValidWebview = function (address, err, success) {
    console.log('Checking webview for ' + address);

    phantom.create('--web-security=no', '--ignore-ssl-errors=yes', function (ph) {
	ph.createPage(function (page) {
            page.open('address', function (status) {
                console.log('opened ' + address + '? ', status);
                page.evaluate(function () { return document.querySelectorAll('div.bb-hires-screen'); }, function (result) {
                    console.log('Result: ', result);
                    ph.exit();
                });
            });
	});
    });
};
