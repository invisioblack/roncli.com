/*global tinyMCE*/
var BaseView = require("rendr/shared/base/view"),
    $ = require("jquery"),
    BlogComments = require("../../collections/blog_comments"),
    sanitizeHtml = require("sanitize-html");

// Sets up the blog view.
module.exports = BaseView.extend({
    className: "blog_base_view",

    events: {
        "click img.thumb": "thumbClick",
        "click a.blog-nav": "blogNav",
        "click #add-blog-comment": "addBlogComment"
    },

    postRender: function() {
        "use strict";

        var blogTopNav = $("#blog-top-nav");

        $("div.blog img").each(function() {
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

        switch (this.name) {
            case "blog/url":
                if (!this.app.lastBlogNav) {
                    this.app.lastBlogNav = "all";
                }

                blogTopNav.html($("div.blog-nav-bottom[data-blog-nav=\"" + this.app.lastBlogNav + "\"]").html()).data("blog-nav", this.app.lastBlogNav);
                break;
            case "blog/index":
                blogTopNav.html($("div.blog-nav-bottom[data-blog-nav=\"all\"]").html()).data("blog-nav", "all");
                break;
            case "blog/category":
                blogTopNav.html($("div.blog-nav-bottom[data-blog-nav=\"" + blogTopNav.data("load-category") + "\"]").html()).data("blog-nav", blogTopNav.data("load-category"));
                break;
        }

        this.app.lastBlogNav = undefined;

        this.app.addPageScroller("#blog-categories-wrapper", {mouseWheel: true, scrollbars: true});
    },

    thumbClick: function(ev) {
        "use strict";

        window.open($(ev.target).attr("src"), "fullImage", "menubar=0,status=0,titlebar=0,toolbar=0");
    },

    blogNav: function(ev) {
        "use strict";

        this.app.lastBlogNav = $(ev.target).closest("div.blog-nav").data("blog-nav");
    },

    onScroll: function() {
        "use strict";

        var windowTop = $(window).scrollTop(),
            windowBottom = windowTop + $(window).height(),
            commentsUnloaded = $("div.comments-unloaded"),
            divTop = commentsUnloaded.offset().top,
            divBottom = divTop + commentsUnloaded.height();

        if (windowTop <= divBottom && windowBottom >= divTop) {
            this.loadComments();
        }
    },

    loadComments: function() {
        "use strict";

        var app = this.app,
            comments;

        if (this.options.blog && this.options.blog.attributes && this.options.blog.attributes.post && this.options.blog.attributes.post.blogUrl) {
            this.onScroll = null;
            $("div.comments-unloaded").removeClass("comments-unloaded").addClass("comments");

            comments = new BlogComments();
            comments.blogUrl = this.options.blog.get("post").blogUrl;
            comments.fetch({
                success: function() {
                    var commentsDiv = $("div.comments");
                    commentsDiv.find("div.loader").remove();
                    commentsDiv.append(app.templateAdapter.getTemplate("blog/comment")({comments: comments.models}));

                    tinyMCE.init({
                        selector: "textarea.tinymce",
                        toolbar: [
                            "formatselect | fontsizeselect | removeformat | bold italic underline | strikethrough subscript superscript",
                            "undo redo | alignleft aligncenter alignright | alignjustify blockquote | bullist numlist | outdent indent "
                        ],
                        menubar: false,
                        statusbar: false,
                        content_css: "/css/tinymce.css",
                        fontsize_formats: "12px 15px 18px 24px 36px 48px 72px"
                    });
                },
                error: function(xhr, error) {
                    console.log("Error!");
                    var message;
                    if (error && error.body && error.body.error) {
                        message = error.body.error;
                    } else {
                        message = "There was a server error loading this post's comments.  Plesae try again later.";
                    }
                    console.log(xhr, error, message);
                }
            });
        }
    },

    addBlogComment: function() {
        "use strict";

        var attributes = sanitizeHtml.defaults.allowedAttributes;
        attributes.p = ["style"];
        attributes.span = ["style"];

        console.log(
            sanitizeHtml(tinyMCE.activeEditor.getContent(), {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "u", "sup", "sub", "strike", "address", "span"]),
                allowedAttributes: attributes
            })
        );
    }
});

module.exports.id = "blog/base";
