/*global bootbox*/
var BaseApp = require("rendr/shared/app"),
    handlebarsHelpers = require("./lib/handlebarsHelpers"),
    $ = require("jquery");

// Extend the BaseApp class, adding any custom methods or overrides.
module.exports = BaseApp.extend({

    /**
     * Client and server initialization function.
     */
    initialize: function() {
        "use strict";

        // Register our Handlebars helpers.
        this.templateAdapter.registerHelpers(handlebarsHelpers);
    },

    /**
     * Client-only initialization functions.
     */
    start: function() {
        "use strict";

        var _this = this,
            IScroll = require("iscroll"),
            scroller,

            /**
             * Get the tweets.
             */
            loadTweets = function() {
                var data = {
                    tweets: {collection: "Tweets"}
                };

                _this.fetch(data, {readFromCache: false, writeToCache: false}, function(err, results) {
                    var html = _this.templateAdapter.getTemplate("site/tweet")(results.tweets);
                    $("div.tweets").html(html);
                    $("abbr.setTime").removeClass("setTime").timeago();
                    setTimeout(function() {
                        if (scroller) {
                            scroller.destroy();
                        }
                        scroller = new IScroll(".wrapper", {mouseWheel: true, scrollbars: true, snap: "div.tweet"});
                    }, 0);
                });
            };

        // Setup timeago.
        $.timeago.settings.strings.seconds = "a moment";
        $.timeago.settings.strings.minute = "a minute";
        $.timeago.settings.strings.hour = "an hour";
        $.timeago.settings.strings.hours = "%d hours";
        $.timeago.settings.strings.day = "a day";
        $.timeago.settings.strings.month = "a month";
        $.timeago.settings.strings.year = "a year";

        // Setup login form.
        $("#login").on("click", function() {
            bootbox.dialog({
                title: "Log In",
                message: _this.templateAdapter.getTemplate("site/login")()
            });

            $("#loginTab").defaultButton("#loginButton");
            $("#loginEmail").focus();
        });

        // Start loading tweets.
        loadTweets();
        setInterval(loadTweets, 900000);

        // Call base function.
        BaseApp.prototype.start.call(this);
    }
});
