define([
  "jquery",
  "modules/tvp/tvpview",
  "modules/helpers/ChannelThumbnail"
],
  function($, TVPView, ChannelThumbnail) {
    /**
     * ContentItemChannel class
     * This is the ContentItemChannel class
     *
     * @name ContentItemChannel
     * @class ContentItemChannel
     * @constructor
     * @return ContentItemChannel Object
     */

    var ContentItemChannel = TVPView.extend({
      className: "fade",
      tagName: 'li',

      beforeRender: function() {
        this.$el.addClass('channel-'+this.options.listStyle+'-item');
      },

      afterRender: function() {
        ChannelThumbnail.create(this.model);

        this.$el.find('.list-item-media').html(ChannelThumbnail.el);
      },

      events: {
        "click .ChannelOverlay": "handleClick"
      },

      handleClick: function(e) {
        e.preventDefault();
        e.stopPropagation();

        var THAT = this;

        var channelKey = Number(this.$el.find('.ChannelOverlay').data('key'));

        if (typeof channelKey !== "number") {
          throw new Error('Channel ID must be a number');
        }

        this.app.data.guideCollection.key = channelKey;

        var data = _.filter(this.app.data.guideCollection.models,function(itm){
          return itm.get('parentId') == THAT.app.data.guideCollection.key;
        });

        console.log(data.length, data);


        this.app.data.guideCollectionFiltered.reset(data);
      },

      initialize: function() {
        if (!this.options.listStyle) {
          throw Error("listStyle must be provided");
        }

        this._setItemStyle();
      },

      _setItemStyle: function() {
        switch (this.options.listStyle) {
          case "list":
            this.template = "Content/ContentListItemChannel";
            break;
          case "grid":
            this.template = "Content/ContentGridItemChannel";
            break;
        }
      }
    });

    return ContentItemChannel;
  });