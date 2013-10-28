define([
  "jquery",
  "modules/tvp/tvpview",

  "modules/Content/views/ContentItemChannel",
  "modules/Content/views/ContentItemVideo",
  "modules/Content/views/ContentItemBack"
],
  function($, TVPView, ContentItemChannel, ContentItemVideo, ContentItemBack) {
    /**
     * ContentList class
     * This is the ContentList class
     *
     * @name ContentList
     * @class ContentList
     * @constructor
     * @return ContentList Object
     */

    var ContentList = TVPView.extend({
      //template: "Content/ContentList",
      className: "ContentList",

      beforeRender: function() {

        // Add back link, tvpage is not the guideCollection Filter
        if (this.app.data.guideCollection.key != this.app.data.vars.get('tvpageId')) {
          this.insertView('.grid', new ContentItemBack());
        }

        this.data.guideCollectionFiltered.each(function(item) {
          var typeId = item.get('typeId');
          switch (typeId) {
            case "1":
              this.insertView('.'+this.options.listStyle, new ContentItemVideo({ model: item, listStyle: this.options.listStyle }));
              break;
            case "2":
              this.insertView('.'+this.options.listStyle, new ContentItemChannel({ model: item, listStyle: this.options.listStyle }));
              break;
            case "3":
              // do nothing, its just a tvpage
              break;
            default:
              //throw new Error('Improper typeId supplied');
          }
        }, this);

      },

      afterRender: function() {
        // run the animation
        var THAT = this;
        var counter = 0;
        var timer = setInterval(function() {
          THAT.$el.find('li').eq(counter).addClass('fadeIn');
          counter++;
        }, 100);
      },

      initialize: function() {
        this._setListStyle();

        this.data.guideCollectionFiltered.on('reset', function() {
          this.remove();
          this.render();
        }, this);
      },

      _setListStyle: function() {
        if (_.has(this.options, "listStyle")) {
          switch (this.options.listStyle) {
            case "grid":
              this.$el.html('<ul class="grid"></ul>');
              break;
            case "list":
              this.$el.html('<ul class="list"></ul>');
          }
        } else {
          throw Error("You must supply a listStyle");
        }
      }
    });

    return ContentList;
  });