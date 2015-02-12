var User = require("./user"),
    db = require("../database/database"),
    blog = require("../models/blog"),
    page = require("../models/page"),
    cache = require("../cache/cache"),
    promise = require("promised-io/promise"),
    Deferred = promise.Deferred,
    all = promise.all,

    /**
     * Gets the list of child pages for a URL.
     * @param {string} url The URL to get child pages for.
     * @param {function(null, object)|function(object)} callback The callback function.
     */
    getChildPagesByUrl = function(url, callback) {
        "use strict";

        var sql;

        if (url === null) {
            sql = "SELECT PageID, PageURL, Title FROM tblPage WHERE ParentPageID IS NULL ORDER BY [Order], Title";
        } else {
            sql = "SELECT PageID, PageURL, Title FROM tblPage WHERE ParentPageID IN (SELECT PageID FROM tblPage WHERE PageURL = @url) ORDER BY [Order], Title";
        }

        db.query(
            sql, {url: {type: db.VARCHAR(1024), value: url}}, function(err, data) {
                if (err) {
                    console.log("Database error in getChildPagesByUrl.");
                    console.log(err);
                    callback(err);
                    return;
                }

                if (!data || !data[0] || data[0].length === 0) {
                    callback(null, []);
                    return;
                }

                callback(null,
                    data[0].map(function(page) {
                        return {
                            id: page.PageID,
                            url: page.PageURL,
                            title: page.Title
                        };
                    })
                );
            }
        );
    },

    /**
     * Checks to see if the page URL exists.
     * @param {number} pageId The page ID to exclude from the search.
     * @param {string} url The URL to check to see if it exists.
     * @param {function(null, object)|function(object)} callback The callback function.
     */
    pageExistsByUrl = function(pageId, url, callback) {
        "use strict";

        db.query(
            "SELECT COUNT(PageID) Pages FROM tblPage WHERE PageURL = @url AND PageID <> @pageId",
            {
                url: {type: db.VARCHAR(1024), value: url},
                pageId: {type: db.INT, value: pageId}
            },
            function(err, data) {
                if (err) {
                    console.log("Database error in pageExistsByUrl.");
                    console.log(err);
                    callback(err);
                    return;
                }

                callback(null, data && data[0] && data[0][0] && data[0][0].Pages && data[0][0].Pages > 0);
            }
        );
    };

/**
 * Reeturn list of blog comments to moderate.
 * @param {number} userId The user ID of the moderator.
 * @param {function(null, object)|function(object)} callback The callback function.
 */
module.exports.getBlogCommentsToModerate = function(userId, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while getting blog comments to moderate.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        db.query(
            "SELECT bc.CommentID, bc.Comment, bc.CrDate, u.Alias, bc.BlogURL FROM tblBlogComment bc INNER JOIN tblUser u ON bc.CrUserID = u.UserID WHERE bc.ModeratedDate IS NULL ORDER BY bc.CrDate",
            {},
            function(err, data) {
                if (err) {
                    console.log("Database error in admin.getBlogCommentsToModerate");
                    console.log(err);
                    callback({
                        error: "There was a database error while getting blog comments to moderate.  Please reload the page and try again.",
                        status: 500
                    });
                    return;
                }

                if (!data[0]) {
                    callback(null, {});
                    return;
                }

                callback(null, data[0].map(function(comment) {
                    return {
                        id: comment.CommentID,
                        published: comment.CrDate.getTime(),
                        content: comment.Comment,
                        author: comment.Alias,
                        url: comment.BlogURL
                    };
                }));
            }
        );
    });
};

/**
 * Clears the blog's caches.
 * @param {number} userId The user ID of the moderator.
 * @param {function()|function(object)} callback The callback function.
 */
module.exports.clearBlogCaches = function(userId, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while approving a blog comment.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        cache.keys("roncli.com:[bt][lu][om][gb][:gl]*", function(keys) {
            var cachePosts = function() {
                blog.forceCachePosts(callback);
            };

            if (keys.length > 0) {
                cache.del(keys, cachePosts);
            } else {
                cachePosts();
            }
        });
    });
};

/**
 * Approves a blog comment.
 * @param {number} userId The user ID of the moderator.
 * @param {number} commentId The comment ID to approve.
 * @param {function()|function(object)} callback The callback function.
 */
module.exports.approveBlogComment = function(userId, commentId, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while approving a blog comment.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        db.query(
            "UPDATE tblBlogComment SET ModeratedDate = GETUTCDATE() WHERE CommentID = @id",
            {id: {type: db.INT, value: commentId}},
            function(err) {
                if (err) {
                    console.log("Database error in admin.approveBlogComment.");
                    callback({
                        error: "There was a database error while approving a blog comment.  Please reload the page and try again.",
                        status: 500
                    });
                    return;
                }

                callback();
            }
        );
    });
};

/**
 * Rejects a blog comment.
 * @param {number} userId The user ID of the moderator.
 * @param {number} commentId The comment ID to reject.
 * @param {function()|function(object)} callback The callback function.
 */
module.exports.rejectBlogComment = function(userId, commentId, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while rejecting a blog comment.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        db.query(
            "DELETE FROM tblBlogComment WHERE CommentID = @id",
            {id: {type: db.INT, value: commentId}},
            function(err) {
                if (err) {
                    console.log("Database error in admin.approveBlogComment.");
                    callback({
                        error: "There was a database error while rejecting a blog comment.  Please reload the page and try again.",
                        status: 500
                    });
                    return;
                }

                callback();
            }
        );
    });
};

/**
 * Gets the child pages of a parent by URL.
 * @param {number} userId The user ID of the moderator.
 * @param {string} url The URL of the pages to get.
 * @param {function(null, object)|function(object)} callback The callback function.
 */
module.exports.getPagesByParentUrl = function(userId, url, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while approving a blog comment.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        all(
            (function() {
                var deferred = new Deferred();

                getChildPagesByUrl(url, function(err, pages) {
                    if (err) {
                        deferred.reject({
                            error: "There was a database error while approving a blog comment.  Please reload the page and try again.",
                            status: 500
                        });
                        return;
                    }

                    deferred.resolve(pages);
                });

                return deferred.promise;
            }()),
            (function() {
                var deferred = new Deferred();

                db.query(
                    "SELECT PageID, Title FROM tblPage WHERE ParentPageID IS NOT NULL ORDER BY Title",
                    {},
                    function(err, data) {
                        if (err) {
                            console.log("Database error in admin.getPagesByParentUrl.");
                            console.log(err);
                            deferred.reject(err);
                            return;
                        }

                        deferred.resolve(data[0].map(function(page) {
                            return {
                                id: page.PageID,
                                title: page.Title
                            };
                        }));
                    }
                );

                return deferred.promise;
            }())
        ).then(
            function(results) {
                callback(null, {
                    pages: results[0],
                    pageList: results[1]
                });
            },

            // If any of the functions error out, it will be handled here.
            function(err) {
                callback(err);
            }
        );
    });
};

/**
 * Gets page data for a URL.
 * @param {number} userId The user ID of the moderator.
 * @param {string} url The URL of the page to get.
 * @param {function(null, object)|function(object)} callback The callback function.
 */
module.exports.getPageByUrl = function(userId, url, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error retrieving the page.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        all(
            // Get the children of the page.
            (function() {
                var deferred = new Deferred();

                getChildPagesByUrl(url, function(err, pages) {
                    if (err) {
                        deferred.reject({
                            error: "There was a database error retrieving the page.  Please reload the page and try again.",
                            status: 500
                        });
                        return;
                    }

                    deferred.resolve(pages);
                });

                return deferred.promise;
            }()),

            // Get the page data.
            (function() {
                var deferred = new Deferred();

                db.query(
                    "SELECT PageID, ParentPageID, Title, ShortTitle, PageData FROM tblPage WHERE PageURL = @url",
                    {url: {type: db.VARCHAR(1024), value: url}},
                    function(err, data) {
                        if (err) {
                            console.log("Database error getting page in admin.getPageByUrl.");
                            console.log(err);
                            deferred.reject({
                                error: "There was a database error retrieving the page.  Please reload the page and try again.",
                                status: 500
                            });
                            return;
                        }

                        if (!data || !data[0] || data[0].length === 0) {
                            deferred.resolve(null);
                            return;
                        }

                        deferred.resolve({
                            id: data[0][0].PageID,
                            parentPageId: data[0][0].ParentPageID,
                            title: data[0][0].Title,
                            shortTitle: data[0][0].ShortTitle,
                            content: data[0][0].PageData
                        });
                    }
                );

                return deferred.promise;
            }())
        ).then(
            function(results) {
                var pageId;

                if (!results[1]) {
                    callback(null, {});
                    return;
                }

                pageId = results[1].id;
                results[1].pages = results[0];

                // Get the parents of the page.
                page.getParents(pageId, function(err, parents) {
                    var variableNames = [],
                        variables = {};

                    if (err) {
                        callback({
                            error: "There was a database error retrieving the page.  Please reload the page and try again.",
                            status: 500
                        });
                        return;
                    }

                    results[1].parents = parents;

                    parents.forEach(function(parent) {
                        variableNames.push("@page" + parent.id);
                        variables["page" + parent.id] = {type: db.INT, value: parent.id};
                    });
                    variables.parentPageId = {type: db.INT, value: pageId};

                    // Get the pages that can be moved to have this page as the parent.
                    db.query(
                        "SELECT PageID, Title FROM tblPage WHERE PageID NOT IN (" + variableNames.join(", ") + ") AND (ParentPageID IS NULL OR ParentPageID <> @parentPageId) ORDER BY Title",
                        variables,
                        function(err, data) {
                            if (err) {
                                console.log("Database error getting list of pages to move in admin.getPageByUrl.");
                                console.log(err);
                                callback({
                                    error: "There was a database error retrieving the page.  Please reload the page and try again.",
                                    status: 500
                                });
                                return;
                            }

                            if (!data || !data[0] || data[0].length === 0) {
                                data = [[]];
                            }

                            results[1].pageList = data[0].map(function(page) {
                                return {
                                    id: page.PageID,
                                    title: page.Title
                                };
                            });

                            callback(null, results[1]);
                        }
                    );
                });
            },

            // If any of the functions error out, it will be handled here.
            function(err) {
                callback(err);
            }
        );
    });
};

/**
 * Adds a page.
 * @param {number} userId The user ID of the moderator.
 * @param {number} parentPageId The parent page ID.
 * @param {string} url The URL.
 * @param {string} title The page title.
 * @param {string} shortTitle The short title of the page.
 * @param {string} content The content of the page.
 * @param {function()|function(object)} callback The callback function.
 */
module.exports.addPage = function(userId, parentPageId, url, title, shortTitle, content, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while adding a page.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        // Check to make sure the page hasn't already been added.
        pageExistsByUrl(0, url, function(err, exists) {
            var data = {},
                sql;

            if (err) {
                callback({
                    error: "There was a database error while adding a page.  Please reload the page and try again.",
                    status: 500
                });
            }

            if (exists) {
                callback({
                    error: "The page already exists.",
                    status: 400
                });
                return;
            }

            data.url = {type: db.VARCHAR(1024), value: url};
            data.title = {type: db.VARCHAR(255), value: title};
            data.shortTitle = {type: db.VARCHAR(255), value: shortTitle};
            data.content = {type: db.TEXT, value: content};
            if (parentPageId) {
                sql = "INSERT INTO tblPage (PageURL, ParentPageID, [Order], Title, ShortTitle, PageData, CrDate, UpdDate) SELECT @url, @parentPageId, COUNT(PageID) + 1, @title, @shortTitle, @content, GETUTCDATE(), GETUTCDATE() FROM tblPage WHERE ParentPageID = @parentPageId";
                data.parentPageId = {type: db.INT, value: parentPageId};
            } else {
                sql = "INSERT INTO tblPage (PageURL, ParentPageID, [Order], Title, ShortTitle, PageData, CrDate, UpdDate) VALUES (@url, NULL, NULL, @title, @shortTitle, @content, GETUTCDATE(), GETUTCDATE())";
            }
            db.query(
                sql, data, function(err) {
                    if (err) {
                        console.log("Database error in admin.addPage.");
                        console.log(err);
                        callback({
                            error: "There was a database error while adding a page.  Please reload the page and try again.",
                            status: 500
                        });
                        return;
                    }

                    callback();
                }
            );
        });
    });
};

/**
 * Updates a page.
 * @param {number} userId The user ID of the moderator.
 * @param {number} pageId The page ID.
 * @param {string} url The URL.
 * @param {string} title The page title.
 * @param {string} shortTitle The short title of the page.
 * @param {string} content The content of the page.
 * @param {function()|function(object)} callback The callback function.
 */
module.exports.updatePage = function(userId, pageId, url, title, shortTitle, content, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while updating a page.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        // Check to ensure the page being updated exists.
        db.query(
            "SELECT COUNT(PageID) Pages FROM tblPage WHERE PageID = @pageID",
            {pageId: {type: db.INT, value: pageId}},
            function(err, data) {
                if (err) {
                    console.log("Database error checking to ensure the page exists in admin.updatePage.");
                    console.log(err);
                    callback({
                        error: "There was a database error while updating a page.  Please reload the page and try again.",
                        status: 500
                    });
                    return;
                }

                if (!data || !data[0] || !data[0][0] || !data[0][0].Pages || data[0][0].Pages === 0) {
                    callback({
                        error: "Page ID does not exist.",
                        status: 400
                    });
                    return;
                }

                // Check to make sure the page hasn't already been added.
                pageExistsByUrl(pageId, url, function(err, exists) {
                    if (err) {
                        callback({
                            error: "There was a database error while updating a page.  Please reload the page and try again.",
                            status: 500
                        });
                    }

                    if (exists) {
                        callback({
                            error: "A page with this URL already exists.",
                            status: 400
                        });
                        return;
                    }

                    db.query(
                        "UPDATE tblPage SET PageURL = @url, Title = @title, ShortTitle = @shortTitle, PageData = @content, UpdDate = GETUTCDATE() WHERE PageID = @pageId",
                        {
                            url: {type: db.VARCHAR(1024), value: url},
                            title: {type: db.VARCHAR(255), value: title},
                            shortTitle: {type: db.VARCHAR(255), value: shortTitle},
                            content: {type: db.TEXT, value: content},
                            pageId: {type: db.INT, value: pageId}
                        },
                        function(err) {
                            if (err) {
                                console.log("Database error updating a page in admin.updatePage.");
                                console.log(err);
                                callback({
                                    error: "There was a database error while adding a page.  Please reload the page and try again.",
                                    status: 500
                                });
                                return;
                            }

                            callback();
                        }
                    );
                });
            }
        );
    });
};

/**
 * Deletes a page.
 * @param {number} userId The user ID of the moderator.
 * @param {number} pageId The page ID.
 * @param {function()|function(object)} callback The callback function.
 */
module.exports.deletePage = function(userId, pageId, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while deleting a page.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        db.query(
            "UPDATE tblPage SET ParentPageID = NULL, [Order] = NULL WHERE ParentPageID = @pageId; DELETE FROM tblPage WHERE PageId = @pageId",
            {pageId: {type: db.INT, value: pageId}},
            function(err) {
                if (err) {
                    console.log("Database error in admin.updatePage.");
                    console.log(err);
                    callback({
                        error: "There was a database error while deleting a page.  Please reload the page and try again.",
                        status: 500
                    });
                    return;
                }

                callback();
            }
        );
    });
};

/**
 * Moves a page.
 * @param {number} userId The user ID of the moderator.
 * @param {number} pageId The page ID to move.
 * @param {number} newParentPageId The parent page ID to move the page to.
 * @param {function()|function(object)} callback The callback function.
 */
module.exports.movePage = function(userId, pageId, newParentPageId, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while deleting a page.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        // Ensure both pages exist and are separate pages.
        db.query(
            "SELECT COUNT(PageID) Pages FROM tblPage WHERE pageId IN (@pageId, @parentPageId)",
            {
                pageId: {type: db.INT, value: pageId},
                parentPageId: {type: db.INT, value: newParentPageId}
            },
            function(err, data) {
                var deferred;

                if (err) {
                    console.log("Database error checking pages in admin.movePage.");
                    console.log(err);
                    callback({
                        error: "There was a database error while moving a page.  Please reload the page and try again.",
                        status: 500
                    });
                    return;
                }

                if (!data || !data[0] || !data[0][0] || data[0][0].Pages !== 1 + (newParentPageId ? 1 : 0)) {
                    callback({
                        error: "Invalid page to move.  Please reload the page and try again.",
                        status: 400
                    });
                    return;
                }

                // Ensure the parent page ID is valid.
                deferred = new Deferred();

                if (newParentPageId) {
                    page.getParents(newParentPageId, function(err, pages) {
                        if (err) {
                            deferred.reject({
                                error: "There was a database error while moving a page.  Please reload the page and try again.",
                                status: 500
                            });
                            return;
                        }

                        pages = pages.map(function(page) {
                            return page.id;
                        });

                        if (pages.indexOf(pageId) !== -1) {
                            deferred.reject({
                                error: "Invalid page to move.  Please reload the page and try again.",
                                status: 400
                            });
                            return;
                        }

                        deferred.resolve();
                    });
                } else {
                    deferred.resolve();
                }

                deferred.promise.then(
                    function() {
                        // Reorder the page's sibilings.
                        db.query(
                            "UPDATE tblPage SET [Order] = [Order] - 1 WHERE ParentPageID IS NOT NULL AND ParentPageID = (SELECT p.ParentPageID FROM tblPage p WHERE p.PageID = @pageId) AND [Order] > (SELECT p.[Order] FROM tblPage p WHERE p.PageID = @pageId)",
                            {pageId: {type: db.INT, value: pageId}},
                            function(err) {
                                var sql, variables;

                                if (err) {
                                    console.log("Database error reordering sibling pages in admin.movePage.");
                                    console.log(err);
                                    callback({
                                        error: "There was a database error while moving a page.  Please reload the page and try again.",
                                        status: 500
                                    });
                                    return;
                                }

                                // Move the page to the end of the new parent page.
                                variables = {pageId: {type: db.INT, value: pageId}};
                                if (newParentPageId) {
                                    sql = "UPDATE tblPage SET ParentPageID = @parentPageId, [Order] = p.Pages + 1 FROM (SELECT COUNT(PageID) Pages FROM tblPage WHERE ParentPageID = @parentPageId) p WHERE PageID = @pageId";
                                    variables.parentPageId = {type: db.INT, value: newParentPageId};
                                } else {
                                    sql = "UPDATE tblPage SET ParentPageID = NULL, [Order] = NULL WHERE PageId = @pageId";
                                }

                                db.query(
                                    sql, variables, function(err) {
                                        if (err) {
                                            console.log("Database error reordering sibling pages in admin.movePage.");
                                            console.log(err);
                                            callback({
                                                error: "There was a database error while moving a page.  Please reload the page and try again.",
                                                status: 500
                                            });
                                            return;
                                        }

                                        callback();
                                    }
                                );
                            }
                        );
                    },

                    // If the function errors out, it will be handled here.
                    function(err) {
                        callback(err);
                    }
                );
            }
        );
    });
};

/**
 * Changes the order of a page's children.
 * @param {number} userId The user ID of the moderator.
 * @param {number} parentPageId The page ID to move.
 * @param {int[]} order The order of pageIDs.
 * @param {function()|function(object)} callback The callback function.
 */
module.exports.changeOrder = function(userId, parentPageId, order, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        var variableNames = [],
            variables = {};

        if (err) {
            callback({
                error: "There was a database error while deleting a page.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        // Just bail if there are no pages in the list.
        if (order.length === 0) {
            callback();
            return;
        }

        // Ensure all of the pages in the order list have a parent page of the same page ID.
        order.forEach(function(pageId) {
            variableNames.push("@page" + pageId);
            variables["page" + pageId] = {type: db.INT, value: pageId};
        });
        variables.parentPageId = {type: db.INT, value: parentPageId};

        db.query(
            "SELECT COUNT(PageID) Pages FROM tblPage WHERE PageID IN (" + variableNames.join(", ") + ") AND ParentPageID IS NOT NULL AND ParentPageID = @parentPageId",
            variables,
            function(err, data) {
                var sql = [],
                    sqlVariables = {};

                if (err) {
                    console.log("Database error checking pages in admin.changeOrder.");
                    console.log(err);
                    callback({
                        error: "There was a database error while ordering pages.  Please reload the page and try again.",
                        status: 500
                    });
                    return;
                }

                if (!data || !data[0] || !data[0][0] || data[0][0].Pages !== order.length) {
                    callback({
                        error: "Invalid pages to reorder.  Please reload the page and try again.",
                        status: 400
                    });
                    return;
                }

                // Update order of pages.
                order.forEach(function(pageId, index) {
                    sql.push("UPDATE tblPage SET [Order] = @order" + index + " WHERE PageID = @page" + pageId);
                    sqlVariables["order" + index] = {type: db.INT, value: index + 1};
                    sqlVariables["page" + pageId] = {type: db.INT, value: pageId};
                });

                db.query(
                    sql.join(";"), sqlVariables, function(err) {
                        if (err) {
                            console.log("Database error updating page order in admin.changeOrder.");
                            console.log(err);
                            callback({
                                error: "There was a database error while ordering pages.  Please reload the page and try again.",
                                status: 500
                            });
                            return;
                        }

                        callback();
                    }
                );
            }
        );
    });
};

/**
 * Reeturn list of page comments to moderate.
 * @param {number} userId The user ID of the moderator.
 * @param {function(null, object)|function(object)} callback The callback function.
 */
module.exports.getPageCommentsToModerate = function(userId, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while getting page comments to moderate.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        db.query(
            "SELECT pc.CommentID, pc.Comment, pc.CrDate, u.Alias, p.PageURL FROM tblPageComment pc INNER JOIN tblPage p on pc.PageID = p.PageID INNER JOIN tblUser u ON pc.CrUserID = u.UserID WHERE pc.ModeratedDate IS NULL ORDER BY pc.CrDate",
            {},
            function(err, data) {
                if (err) {
                    console.log("Database error in admin.getPageCommentsToModerate");
                    console.log(err);
                    callback({
                        error: "There was a database error while getting page comments to moderate.  Please reload the page and try again.",
                        status: 500
                    });
                    return;
                }

                if (!data[0]) {
                    callback(null, {});
                    return;
                }

                callback(null, data[0].map(function(comment) {
                    return {
                        id: comment.CommentID,
                        published: comment.CrDate.getTime(),
                        content: comment.Comment,
                        author: comment.Alias,
                        url: comment.PageURL
                    };
                }));
            }
        );
    });
};

/**
 * Approves a page comment.
 * @param {number} userId The user ID of the moderator.
 * @param {number} commentId The comment ID to approve.
 * @param {function()|function(object)} callback The callback function.
 */
module.exports.approvePageComment = function(userId, commentId, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while approving a page comment.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        db.query(
            "UPDATE tblPageComment SET ModeratedDate = GETUTCDATE() WHERE CommentID = @id",
            {id: {type: db.INT, value: commentId}},
            function(err) {
                if (err) {
                    console.log("Database error in admin.approvePageComment.");
                    callback({
                        error: "There was a database error while approving a page comment.  Please reload the page and try again.",
                        status: 500
                    });
                    return;
                }

                callback();
            }
        );
    });
};

/**
 * Rejects a page comment.
 * @param {number} userId The user ID of the moderator.
 * @param {number} commentId The comment ID to reject.
 * @param {function()|function(object)} callback The callback function.
 */
module.exports.rejectPageComment = function(userId, commentId, callback) {
    "use strict";

    User.getUserRoles(userId, function(err, roles) {
        if (err) {
            callback({
                error: "There was a database error while rejecting a page comment.  Please reload the page and try again.",
                status: 500
            });
            return;
        }

        if (roles.indexOf("SiteAdmin") === -1) {
            callback({
                error: "You do not have access to this resource.",
                status: 403
            });
            return;
        }

        db.query(
            "DELETE FROM tblPageComment WHERE CommentID = @id",
            {id: {type: db.INT, value: commentId}},
            function(err) {
                if (err) {
                    console.log("Database error in admin.approvePageComment.");
                    callback({
                        error: "There was a database error while rejecting a page comment.  Please reload the page and try again.",
                        status: 500
                    });
                    return;
                }

                callback();
            }
        );
    });
};