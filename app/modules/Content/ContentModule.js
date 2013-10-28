define([
  "namespace",
  "jquery",
  "backbone",
  "modules/tvp/tvpmodule",

  "modules/Content/views/ContentList"
],

function(tvpage, $, Backbone, TVPModule,
  ContentList
  ) {

  function ContentModule() {
    this.views = {};
    this.data = {};

    this.initialize();

    TVPModule.apply(this, arguments);
  }
  ContentModule.prototype = new TVPModule();
  ContentModule.prototype.constructor = ContentModule;

  ContentModule.prototype.initialize = function() {
    _.extend(this.data, {
      guideCollectionFiltered: this.app.data.guideCollectionFiltered
    });

    _.extend(this.views, {
      contentList: ContentList
    });
  };

  ContentModule.prototype.view = function() {
    return new this.views.contentList({
      data: {
        guideCollectionFiltered: this.data.guideCollectionFiltered
      },
      listStyle: "list"
    });
  };

  return ContentModule;
});