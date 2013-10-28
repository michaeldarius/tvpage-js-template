define([
  "jquery",
  "modules/tvp/tvpview",

  "modules/Spots/views/SpotRemoteSmall"
],
  function($, TVPView, SpotRemoteSmall) {
    /**
     * SpotRemote class
     * This is the SpotRemote class
     *
     * @name SpotRemote
     * @class SpotRemote
     * @constructor
     * @return SpotRemote Object
     */

    var SpotRemote = TVPView.extend({
      className: "SpotRemote",

      initialize: function() {
        this.spotRemoteSmall = new SpotRemoteSmall();

        this.model.on('change:videoId', function(e) {
          this._spotCheck(this.model.get('videoId'));
        }, this);

        if (this.model.get('videoId') != "undefined") {
          this._spotCheck(this.model.get('videoId'));
        }
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
            THAT.spotRemoteSmall.model = THAT.data.spotCollection.at(0);
            THAT.setView('', THAT.spotRemoteSmall);
            THAT.render();
          }
        });
      }
    });

    return SpotRemote;
  });