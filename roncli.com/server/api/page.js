var page = require("../models/page");

module.exports.get = function(req, callback) {
    "use strict";

    if (req.parsedPath.length === 0) {
        req.res.status(400);
        callback({error: "No URL specified."});
        return;
    }

    // TODO: This is a workaround until we can get the querystring parameters from Rendr's server sync.  See https://github.com/rendrjs/rendr/pull/392 for the upcoming fix.
    page.getPage(req.parsedPath.join("/"), function(err, page) {
        if (err) {
            req.res.status(err.status);
            callback(err);
            return;
        }

        callback(page);
    });
};