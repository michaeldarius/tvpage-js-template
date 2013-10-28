define([
  "namespace",
  "jquery",
  "backbone",
  "modules/tvp/tvpmodule",

  "modules/Spots/views/SpotContainer",
  "modules/Spots/views/SpotOverlay",
  "modules/Spots/views/SpotRemote"
],

function(tvpage, $, Backbone, TVPModule, SpotContainer, SpotOverlay, SpotRemote) {

  function SpotsModule() {
    this.views = {};
    this.data = {};
    this.initialize();

    TVPModule.apply(this, arguments);
  }
  SpotsModule.prototype = new TVPModule();
  SpotsModule.prototype.constructor = SpotsModule;

  SpotsModule.prototype.initialize = function() {
    _.extend(this.views, {
      spotContainer: SpotContainer,
      spotOverlay: SpotOverlay,
      spotRemote: SpotRemote
    });

    _.extend(this.data, {
      spotCollection: this.app.data.spotCollection
    });
  };

  SpotsModule.prototype.view = function(view) {
    if (!view) {
      throw Error('You must provide a view type');
    }

    switch (view) {
      case "spotSlider":
        return new this.views.spotContainer({
          model: this.app.data.vars,
          data: {
            spotCollection: this.data.spotCollection
          }
        });
      case "spotOverlay":
        return new this.views.spotOverlay({
          model: this.app.data.vars,
          data: {
            spotCollection: this.data.spotCollection
          }
        });
      case "spotRemote":
        return new this.views.spotRemote({
          model: this.app.data.vars,
          data: {
            spotCollection: this.data.spotCollection
          }
        });
    }
  };

  return SpotsModule;
});