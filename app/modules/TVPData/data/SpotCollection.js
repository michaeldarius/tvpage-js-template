define([
  "modules/tvp/tvpcollection",
  "modules/TVPData/data/SpotModel"
],
  function(TVPCollection, SpotModel) {

    var SpotCollection = TVPCollection.extend({
      url: function() {
        return 'https://'+this.app.getDomain()+'/api/spot/link/container/'+this.options.videoId;
      },

      model: SpotModel,

      setVideoId: function(videoId) {
        this.options.videoId = videoId;
      },

      clearVideoId: function() {
        this.options.videoId = null;
        this.reset();
      },

      initialize: function() {

      }
    });

    return SpotCollection;
  });
