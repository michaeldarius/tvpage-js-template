define([
  "namespace",
  "jquery",
  "backbone",
  "modules/tvp/tvpmodule"
],

function(tvpage, $, Backbone, TVPModule) {

  function ModalModule() {
    this.initialize();

    TVPModule.apply(this, arguments);
  }
  ModalModule.prototype = new TVPModule();
  ModalModule.prototype.constructor = ModalModule;

  ModalModule.prototype.initialize = function() {

  };

  return ModalModule;
});