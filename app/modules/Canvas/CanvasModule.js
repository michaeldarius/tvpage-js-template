define([
  "namespace",
  "jquery",
  "backbone",
  "modules/tvp/tvpmodule",

  "modules/Canvas/views/CanvasImage"
],

function(tvpage, $, Backbone, TVPModule,
  CanvasImage
  ) {

  function CanvasModule() {
    this.views = {};
    this.data = {};

    this.initialize();

    TVPModule.apply(this, arguments);
  }
  CanvasModule.prototype = new TVPModule();
  CanvasModule.prototype.constructor = CanvasModule;

  CanvasModule.prototype.initialize = function() {
    _.extend(this.data, {
      tvpageModel: this.app.data.tvpageModel
    });

    _.extend(this.views, {
      canvasImage: CanvasImage
    });
  };

  CanvasModule.prototype.view = function() {
    return new this.views.canvasImage({
      data: {
        tvpageModel: this.data.tvpageModel
      }
    });
  };

  return CanvasModule;
});