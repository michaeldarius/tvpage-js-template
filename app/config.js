require.config({
  deps: ["main"],

  paths: {
    // Libraries
    jquery: "../assets/js/libs/jquery",
    underscore: "../assets/js/libs/underscore-1.4.4",
    backbone: "../assets/js/libs/backbone",
    handlebars: "../assets/js/libs/handlebars",
    layoutmanager: "../assets/js/libs/backbone.layoutmanager-0.8.7",

    // Plugins
    jqtransit: "../assets/js/plugins/jquery.transit"
  },

  version: "0.2.11",

  shim: {
    underscore: {
      exports: "_"
    },

    backbone: {
      deps: ["underscore", "jquery"],
      exports: "Backbone"
    },

    handlebars: {
      exports: "Handlebars"
    },

    layoutmanager: {
      deps: ["backbone"],
      exports: "Backbone.LayoutManager"
    },

    jqtransit: {
      deps: ["jquery"]
    }
  }
});
