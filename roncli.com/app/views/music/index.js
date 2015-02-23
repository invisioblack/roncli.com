var BaseView = require("rendr/shared/base/view"),
    $ = require("jquery");

// Sets up the music view.
module.exports = BaseView.extend({
    className: "music_index_view",

    events: {
        "click img.thumb": "thumbClick"
    },

    postRender: function() {
        "use strict";

        if ($("#children-pages-wrapper").length > 0) {
            this.app.addPageScroller("#children-pages-wrapper", {mouseWheel: true, scrollbars: true});
        }

        $("div.page-content img").each(function() {
            var image = $(this);
            image.load(function() {
                var width = this.width;
                $("<img />").attr("src", $(this).attr("src")).load(function() {
                    if (width !== this.width) {
                        image.addClass("thumb").attr("title", "Click to view full image in a new window");
                    }
                });
            });
        });
    },

    thumbClick: function(ev) {
        "use strict";

        window.open($(ev.target).attr("src"), "fullImage", "menubar=0,status=0,titlebar=0,toolbar=0");
    }
});

module.exports.id = "music/index";