var config = require("../privateConfig").battlenet,
    bnet = require("battlenet-api")(config.apikey),
    cache = require("../cache/cache"),
    promise = require("promised-io/promise"),
    Deferred = promise.Deferred,
    all = promise.all,

    /**
     * Caches the character from Battle.Net.
     * @param {function} callback The callback function.
     */
    cacheCharacter = function(callback) {
        "use strict";

        bnet.wow.character.aggregate({
            origin: "us",
            realm: "lightbringer",
            name: "Roncli",
            fields: ["feed"]
        }, function(err, result) {
            var character, feed;

            if (err) {
                console.log("Bad response from Battle.Net while getting the character.");
                console.log(err);
                callback({
                    error: "Bad response from Battle.Net.",
                    status: 502
                });
                return;
            }

            character = {
                achievementPoints: result.achievementPoints,
                thumbnail: "http://us.battle.net/static-render/us/" + result.thumbnail,
                profile: "http://us.battle.net/static-render/us/" + result.thumbnail.replace("avatar.jpg", "profilemain.jpg")
            };

            feed = character.feed.filter(function(item) {
                return ["ACHIEVEMENT", "BOSSKILL", "LOOT"].indexOf(item.type) !== -1;
            }).map(function(item) {
                return {
                    score: item.timestamp,
                    value: item
                };
            });

            all(
                (function() {
                    var deferred = new Deferred();

                    cache.set("roncli.com:battlenet:wow:character", character, 86400, function() {
                        deferred.resolve(true);
                    });

                    return deferred.promise;
                }()),

                (function() {
                    var deferred = new Deferred();

                    cache.zadd("roncli.com:battlenet:wow:feed", feed, 86400, function() {
                        deferred.resolve(true);
                    });

                    return deferred.promise;
                }())
            ).then(function() {
                callback();
            });
        });
    };

/**
 * Ensures that the character is cached.
 * @param {boolean} force Forces the caching of the character.
 * @param {function} callback The callback function.
 */
module.exports.cacheCharacter = function(force, callback) {
    "use strict";

    if (force) {
        cacheCharacter(callback);
        return;
    }

    cache.keys("roncli.com:battlenet:wow:character", function(keys) {
        if (keys && keys.length > 0) {
            callback();
            return;
        }

        cacheCharacter(callback);
    });
};
