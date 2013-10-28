define([
  "jquery",
  "underscore",
  "backbone",
  "handlebars",
  //"templates",
  "layoutmanager"
], function($, _, Backbone, Handlebars) {

  // Provide a global location to place configuration settings and module
  // creation.
  var app = {
    // The root path to run the application.
    root: "/",
    data: {},
    modules: {},
    layouts: {}
  };

  // Configure LayoutManager with Backbone Boilerplate defaults.
  Backbone.Layout.configure({
    // Allow LayoutManager to augment Backbone.View.prototype.
    manage: true,

    prefix: "app/templates/",

    fetch: function(path) {
      var done;

      var JST = window.JST || [];

      // Add the html extension.
      path = path + ".html";
      // If the template has not been loaded yet, then load.
      if (!JST[path]) {
        done = this.async();
        return $.ajax({ url: app.root + path}).then(function(contents) {
          JST[path] = Handlebars.compile(contents);
          JST[path].__compiled__ = true;

          done(JST[path]);
        });
      }

      return JST[path];
    }
  });

  _.extend(Backbone.View.prototype, {
    serialize: function() {
      if (this.model) return this.model.toJSON();
    }
  });

  // Mix Backbone.Events, modules, and layout management into the app object.
  return _.extend(app, {
    // Create a custom object with a nested Views object.
    module: function(additionalProps) {
      return _.extend({ Views: {} }, additionalProps);
    },

    // Helper for using layouts.
    useLayout: function(name, options) {
      // Enable variable arity by allowing the first argument to be the options
      // object and omitting the name argument.
      if (_.isObject(name)) {
        options = name;
      }

      // Ensure options is an object.
      options = options || {};

      // If a name property was specified use that as the template.
      if (_.isString(name)) {
        options.template = name;
      }

      // Create a new Layout with options.
      var layout = new Backbone.Layout(_.extend({
        el: "#"+name
      }, options));

      // Cache the refererence.
      this.layouts[name] = layout

      return layout;
    },

    /*createLayout: function(name, options) {
      options = options || {};

      if (typeof options != "object") {
        throw Error("Layout requires an options object");
      }

      if (_.isObject(name)) {
        options = name;
      }

      // If a name property was specified use that as the template.
      if (_.isString(name)) {
        options.template = name;
      }

      var layout = new Backbone.Layout(_.extend({
        el: "#tvpage_spots"
      }, options));

      // Create a new Layout with options.
      return this.layouts[options.name] = layout;
    },*/

    getDomain: function() {
      switch (document.location.host) {
        case "fullpage-local.wp.tvpage.com":
          return "www.tvpage.com";
        default:
          return "www.tvpage.com";
      }
    },

    getProtocol: function() {
      return document.location.protocol;
    }
  }, Backbone.Events);

});
