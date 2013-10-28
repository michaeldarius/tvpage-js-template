define([
  "jquery",
  "modules/tvp/tvpview"
],
function($, TVPView) {
  /**
   * PosterImage class
   * This is the Player class
   *
   * @name PosterImage
   * @class PosterImage
   * @constructor
   * @return PosterImage Object
   */

  var PosterImage = TVPView.extend({
    template: "Player/PosterImage",
    className: "PosterImage background-image",

    beforeRender: function() {
      this.$el.css({
        backgroundImage: 'url('+this.data.videoModel.get('assetDetails').thumbnailUrl+')'
      });

      this.model = this.data.videoModel;
    },

    initialize: function() {
      this.data.vars.on('change:videoId', function() {
        this.$el.transit({ opacity: 0 }).hide();
      }, this);
    }
  });

  return PosterImage;
});