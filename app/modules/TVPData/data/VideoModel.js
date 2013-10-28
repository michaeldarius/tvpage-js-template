define([
  "jquery",
  "modules/tvp/tvpmodel"
],
function($, TVPModel) {

  var TVPageModel = TVPModel.extend({
    parse: function(data) {
      if (data.settings && typeof data.settings == "string") {
        data.settings = $.parseJSON(data.settings);
      }

      return data;
    },

    initialize: function() {
      this.on('change', function(a, b) {
        // this creates a cached copy of the poster image when the data becomes available.
        $('<img/>')[0].src = this.get('assetDetails').thumbnailUrl;
      }, this);
    }
  });

  return TVPageModel;
});
