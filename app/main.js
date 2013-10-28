require([
  "namespace",

  // Libs
  "jquery",
  "backbone",
  "router"
],

function (
  tvpage, jQuery, Backbone, Router
  ) {
  "use strict";

  jQuery(function ($) {
    var app = tvpage;

    app.router = new Router();
    Backbone.history.start({ pushState: true });

    $(document).on("click", "a:not([data-bypass])", function (e) {
      var href = $(this).attr("href");
      var protocol = this.protocol + "//";

      if (href && href.slice(0, protocol.length) !== protocol &&
        href.indexOf("javascript:") !== 0) {

        e.preventDefault();

        app.router.navigate(href, true);
      }
    });
  });
});
