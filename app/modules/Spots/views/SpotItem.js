define([
  "jquery",
  "modules/tvp/tvpview",
  "jqtransit"
],
  function($, TVPView) {
    /**
     * SpotItem class
     * This is the SpotItem class
     *
     * @name SpotItem
     * @class SpotItem
     * @constructor
     * @return SpotItem Object
     */

    var SpotItem = TVPView.extend({
      template: "Spots/SpotItem",
      className: "grid-item background-image SpotItem",
      tagName: 'li',

      beforeRender: function() {
        this.$el.css({
          backgroundImage: 'url('+this.model.get('data').imageUrl+')'
        });
      }
    });

    return SpotItem;
  });