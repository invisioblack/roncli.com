var Song = require("../models/song"),
    Collection = require("./base");

module.exports = Collection.extend({
    model: Song,
    url: "/song/get-latest"
});

module.exports.id = "Song_GetLatest";
