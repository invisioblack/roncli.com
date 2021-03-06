var Comment = require("../models/song_comment"),
    Collection = require("./base");

module.exports = Collection.extend({
    model: Comment,
    url: function() {
        "use strict";

        return "/song-comment?url=" + this.songUrl;
    }
});

module.exports.id = "SongComments";
