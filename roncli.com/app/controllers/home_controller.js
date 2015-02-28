var handleServerError = require("../lib/handleServerError");

module.exports = {
    /**
     * The default home view.
     * @param {object} params The parameters to use in the controller.
     * @param {function((null | object), object=)} callback The callback to run upon completion of the controller running.
     */
    index: function(params, callback) {
        "use strict";

        var app = this.app;

        app.fetch({
            blog: {model: "Blog_GetLatest", params: {}},
            songs: {collection: "Song_GetLatest", params: {count: 3}},
            classics: {collection: "Song_GetLatestByTag", params: {tag: "Classic", count:3}}
        }, function(err, result) {
            if (!err && result && result.blog && result.blog.attributes && result.blog.attributes.error) {
                err = result.blog.attributes;
            }

            if (!err && result && result.songs && result.songs.models && result.songs.models[0] && result.songs.models[0].attributes && result.songs.models[0].attributes.error) {
                err = result.songs.models[0].attributes;
            }

            if (!err && result && result.classics && result.classics.models && result.classics.models[0] && result.classics.models[0].attributes && result.classics.models[0].attributes.error) {
                err = result.classics.models[0].attributes;
            }

            if (err) {
                handleServerError(err, app, result, callback);
                return;
            }

            if (app.req) {
                result.meta = {
                    "og:description": "This is the homepage of Ronald M. Clifford.",
                    "og:image": "http://" + app.req.headers.host + "/images/favicon.png",
                    "og:site_name": "roncli.com",
                    "og:title": "The roncli.com Website",
                    "og:type": "website",
                    "og:url": "http://" + app.req.headers.host,
                    "twitter:card": "summary",
                    "twitter:description": "This is the homepage of Ronald M. Clifford.",
                    "twitter:image": "http://" + app.req.headers.host + "/images/favicon.png",
                    "twitter:site": "@roncli",
                    "twitter:title": "The roncli.com Website",
                    "twitter:url": "http://" + app.req.headers.host
                };
            }
            callback(err, result);
        });
    }
};
