var captcha = require("../models/captcha");

module.exports.post = function(req, query, callback) {
    "use strict";

    switch (req.parsedPath.length) {
        case 1:
            switch (req.parsedPath[0]) {
                case "validate":
                    // Attempt to validate data.
                    if (req.body.response) {
                        captcha.isCaptchaValid(req.session.captcha, req.body.response, function(err, data) {
                            if (err) {
                                req.res.status(err.status);
                                callback(err);
                                return;
                            }
                            callback(req.body.inverse ? !data : data);
                        });
                        return;
                    }

                    req.res.status(400);
                    callback({error: "You must type in the characters as shown."});
                    return;
            }
            break;
    }

    req.res.status(404);
    callback({error: "API not found."});
};
