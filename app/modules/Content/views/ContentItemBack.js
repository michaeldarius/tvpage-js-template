define([
  "jquery",
  "modules/tvp/tvpview"
],
  function($, TVPView) {
    /**
     * ContentItemBack class
     * This is the ContentItemBack class
     *
     * @name ContentItemBack
     * @class ContentItemBack
     * @constructor
     * @return ContentItemBack Object
     */

    var ContentItemBack = TVPView.extend({
      template: "Content/ContentItemBack",
      className: "grid-item ContentItemBack",
      tagName: 'li',

      events: {
        "click .BackOverlay": "handleClick"
      },

      handleClick: function(e) {
        e.preventDefault();
        e.stopPropagation();

        var THAT = this;

        this.app.data.guideCollection.key = this.app.data.vars.get('tvpageId');

        var data = _.filter(this.app.data.guideCollection.models,function(itm){
          return itm.get('parentId') == THAT.app.data.guideCollection.key;
        });

        this.app.data.guideCollectionFiltered.reset(data);
      }
    });

    return ContentItemBack;
  });