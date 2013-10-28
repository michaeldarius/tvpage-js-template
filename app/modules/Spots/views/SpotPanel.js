define([
  "jquery",
  "modules/tvp/tvpview",
  "modules/tvp/tvpcollection",

  "modules/Spots/views/SpotList"
],
  function($, TVPView, TVPCollection, SpotList) {
    /**
     * SpotList class
     * This is the SpotList class
     *
     * @name SpotList
     * @class SpotList
     * @constructor
     * @return SpotList Object
     */

    var SpotPanel = TVPView.extend({
      className: "SpotPanel",

      beforeRender: function() {
        this.options.pageToken = 0;
        this.options.currentPage = 1;

        if (this.collection && this.collection.length > 0) {
          while (this.options.pageToken < this.collection.length) {
            var pageCollection = this._getCollectionPage();
            var spotList = new SpotList({ collection: new TVPCollection(pageCollection) })
            this.insertView(spotList);
          }
        }
      },

      afterRender: function() {
        this.$el.find('.SpotList').slice(0,1).addClass('showCenter');
        this.$el.find('.SpotList:gt(0)').addClass('hiddenRight');
      },

      _getCollectionPage: function() {
        var start = this.options.pageToken;
        var end = this.options.pageToken + this.options.pageSize;
        this.options.pageToken = this.options.pageToken + this.options.pageSize;

        return this.collection.slice(start, end);
      },

      initialize: function() {
        this.options.pageToken = 0;
        this.options.currentPage = 1;
        this.options.pageSize = 4;
      }
    });

    return SpotPanel;
  });