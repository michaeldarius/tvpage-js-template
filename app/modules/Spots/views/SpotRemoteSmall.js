define([
  "jquery",
  "modules/tvp/tvpview"
],
  function($, TVPView) {
    /**
     * SpotRemoteSmall class
     * This is the SpotRemoteSmall class
     *
     * @name SpotRemoteSmall
     * @class SpotRemoteSmall
     * @constructor
     * @return SpotRemoteSmall Object
     */

    var SpotRemoteSmall = TVPView.extend({
      className: "SpotRemoteSmall background-image",
      template: "Spots/SpotRemoteSmall",

      beforeRender: function() {
        this.$el.css({
          backgroundImage: 'url('+this.model.get('data').imageUrl+')'
        });
      },

      events: {
        "click": "handleClick"
      },

      handleClick: function() {
        window.open(this.model.get('data').linkUrl);
      }
    });

    return SpotRemoteSmall;
  });