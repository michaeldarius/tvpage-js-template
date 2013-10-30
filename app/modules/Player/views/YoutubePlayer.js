define([
  "jquery",
  "modules/tvp/tvpview"
],
function($, TVPView) {
  /**
   * YoutubePlayer class
   * This is the Player class
   *
   * @name YoutubePlayer
   * @class YoutubePlayer
   * @constructor
   * @return YoutubePlayer Object
   */

  var YoutubePlayer = TVPView.extend({
    template: "Player/YoutubePlayer",
    className: "YoutubePlayer",

    afterRender: function() {
      //console.log('Load Player');
      var THAT = this;
      window.onYouTubeIframeAPIReady = function() {
        var player = new YT.Player('YTPlayer', {
          height: '100%',
          width: '100%',
          enablejsapi: 1,
          showinfo: 0,
          iv_load_policy: 3,
          rel: 0,
          wmode: 'transparent',
          controls: 0,
          videoId: '',
          events: {
            'onStateChange': function(e) {
              //t.dispatchEvent(e);
              //console.log('onStateChange', e);
            },
            'onReady': function(e) {
              THAT.player = player;
              //console.log('onReady', e);
            },
            'onError':function(e) {
              // nothing yet...
              //console.log('onError', e);
            }
          }
        });
      };

      $('head').append('<script type="text/javascript" src="http://www.youtube.com/iframe_api"></script>');
    },

    initialize: function() {
      this.model.on('change:videoId', function() {
        var video = this.app.data.guideCollection.get(this.model.get('videoId'));
        this.player.loadVideoById(video.get('assetDetails').videoId);
      }, this);
    }
  });

  return YoutubePlayer;
});