define([
  "jquery",
  "modules/tvp/tvpview",

  "modules/Spots/views/SpotItem"
],
  function($, TVPView, SpotItem) {
    /**
     * SpotList class
     * This is the SpotList class
     *
     * @name SpotList
     * @class SpotList
     * @constructor
     * @return SpotList Object
     */

    var SpotList = TVPView.extend({
      className: "grid SpotList clearfix",
      tagName: 'ul',

      beforeRender: function() {
        if (this.collection && this.collection.length > 1) {
          this.collection.each(function(model) {
            this.insertView(new SpotItem({ model: model }));
          }, this);
        }
      }
    });

    return SpotList;
  });