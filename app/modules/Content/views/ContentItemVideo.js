define([
  "jquery",
  "modules/tvp/tvpview"
],
  function($, TVPView) {
    /**
     * ContentItemVideo class
     * This is the ContentItemVideo class
     *
     * @name ContentItemVideo
     * @class ContentItemVideo
     * @constructor
     * @return ContentItemVideo Object
     */

    var ContentItemVideo = TVPView.extend({
      //template: "Content/ContentItemVideo",
      className: "background-image ContentItemVideo fade",
      tagName: 'li',

      beforeRender: function() {
        this.$el.addClass('video-'+this.options.listStyle+'-item');
      },

      events: {
        "click": "handleVideoPlay",
        "mouseenter": "handleOver",
        "mouseleave": "handleOut"
      },

      handleVideoPlay: function(e) {
        e.preventDefault();
        e.stopPropagation();

        if (this.model.get('id') == this.app.data.vars.get('videoId')) {
          this.app.data.vars.trigger('change:videoId');
        } else {
          this.app.data.vars.set({ videoId: this.model.get('id') });
        }
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
            this.template = "Content/ContentListItemVideo";
            break;
          case "grid":
            this.template = "Content/ContentGridItemVideo";
            break;
        }
      },

      handleOver: function() {
        this.$el.addClass('active');
      },

      handleOut: function() {
        this.$el.removeClass('active');
      }
    });

    return ContentItemVideo;
  });