define([
  "jquery",
  "modules/tvp/tvpview",

  "modules/Spots/views/SpotRemoteSmall"
],
  function($, TVPView, SpotRemoteSmall) {
    /**
     * SpotOverlay class
     * This is the SpotOverlay class
     *
     * @name SpotOverlay
     * @class SpotOverlay
     * @constructor
     * @return SpotOverlay Object
     */

    var SpotOverlay = TVPView.extend({
      className: "SpotOverlay",

      initialize: function() {
        this.spotRemoteSmall = new SpotRemoteSmall({
          className: 'SpotRemoteLarge background-image'
        });
      },

      afterRender: function() {
        this.model.on('change:videoId', function(e) {
          this.remove();
          //console.log('SpotOverlay spotCheck');
          this._spotCheck(this.model.get('videoId'));
        }, this);
      },

      _spotCheck: function(videoId) {
        var THAT = this;
        this.data.spotCollection.setVideoId(videoId);

        var spotCollectionFetch = this.app.modules.tvpData.fetchSpotData();

        spotCollectionFetch.done(function(data) {
          if (data.length < 1) {
            THAT.removeView('');
            THAT.render();
          } else {
            THAT.spotRemoteSmall.model = THAT.data.spotCollection.at(1);
            THAT.setView('', THAT.spotRemoteSmall);
            THAT.render();

            THAT.$el
              .transit({ x: '0' })
              .delay(2857)
              .transit({ x: '-100%' });


          }
        });
      }
    });

    return SpotOverlay;
  });