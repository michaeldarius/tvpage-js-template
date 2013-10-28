define([
  "jquery",
  "modules/tvp/tvpview",

  "modules/Spots/views/SpotPanel",
  "modules/Spots/views/SpotArrowLeft",
  "modules/Spots/views/SpotArrowRight"
],
  function($, TVPView, SpotPanel, SpotArrowLeft, SpotArrowRight) {
    /**
     * SpotContainer class
     * This is the SpotContainer class
     *
     * @name SpotContainer
     * @class SpotContainer
     * @constructor
     * @return SpotContainer Object
     */

    var SpotContainer = TVPView.extend({
      className: "SpotContainer",

      initialize: function() {
        var THAT = this;

        this.spotPanel = new SpotPanel({
          collection: this.data.spotCollection
        });

        this.spotArrowLeft = new SpotArrowLeft({
          events: {
            "click": function() {
              THAT._moveLeft();
              //THAT._checkButtonState();
            }
          }
        });
        this.spotArrowRight = new SpotArrowRight({
          events: {
            "click": function() {
              THAT._moveRight();
              //THAT._checkButtonState();
            }
          }
        });

        this.model.on('change:videoId', function(e) {
          this._spotCheck(this.model.get('videoId'));
        }, this);
      },

      beforeRender: function() {
        if (this.data.spotCollection && this.data.spotCollection.length > 0) {
          this.insertView(this.spotArrowLeft);
          this.insertView(this.spotPanel);
          this.insertView(this.spotArrowRight);
        }
      },

      _spotCheck: function(videoId) {
        var THAT = this;
        this.data.spotCollection.setVideoId(videoId);

        var spotCollectionFetch = this.app.modules.tvpData.fetchSpotData();

        spotCollectionFetch.done(function(data) {
          if (data.length < 1) {

            THAT.$el.parent().transit({
              //y: "-100%",
              opacity: 0,
              scale: [1, 0],
              height: '0px'
            });
            //THAT.data.spotCollection.clearVideoId(videoId);
            //Backbone.View.prototype.remove.call(THAT);
          } else {
            THAT.render();

            THAT.$el.parent().transit({
              //y: "-100%",
              opacity: 1,
              scale: [1, 1],
              height: '143px'
            });
          }
        });
      },

      /**
       * Slide to left panel
       *
       * @private
       */
      _moveLeft: function() {
        if (this.$el.find('.hiddenLeft').length > 0) {
          this.$el.find('.showCenter').removeClass('showCenter').addClass('hiddenRight');
          this.$el.find('.hiddenLeft').filter(":last").removeClass('hiddenLeft').addClass('showCenter');
        }
      },

      /**
       * Slide to right panel from current panel
       *
       * @private
       */
      _moveRight: function() {
        if (this.$el.find('.hiddenRight').length > 0) {
          this.$el.find('.showCenter').removeClass('showCenter').addClass('hiddenLeft');
          this.$el.find('.hiddenRight').eq(0).removeClass('hiddenRight').addClass('showCenter');
        }
      }
    });

    return SpotContainer;
  });