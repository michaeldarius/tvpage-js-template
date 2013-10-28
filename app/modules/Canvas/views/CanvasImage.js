define([
  "jquery",
  "modules/tvp/tvpview"
],
function($, TVPView) {
  /**
   * CanvasImage class
   * This is the CanvasImage class
   *
   * @name CanvasImage
   * @class CanvasImage
   * @constructor
   * @return CanvasImage Object
   */

  var CanvasImage = TVPView.extend({
    template: "Canvas/CanvasImage",
    className: "background-image CanvasImage",

    beforeRender: function() {
      this.$el.css({
        'backgroundImage': 'url('+ this._createBackgroundImageUrl() +')'
      });
    },

    _createBackgroundImageUrl: function() {
      return this.app.getProtocol()+'//'+this.app.getDomain()+'/api/canvasImage/'+this.data.tvpageModel.get('loginId')+'/950/214/'+this._getCanvasImage();
      //return 'https://www.tvpage.com/api/canvasImage/147/1920/1080/166448316-010520481261.jpg'
    },

    _getCanvasImage: function() {
      if (_.has(this.data.tvpageModel.get('settings'), "canvasCropped")) {
        return this.data.tvpageModel.get('settings').canvasCropped;
      } else {
        return this.data.tvpageModel.get('settings').canvasImage;
      }
    }
  });

  return CanvasImage;
});