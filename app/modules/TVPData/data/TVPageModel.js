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
    }
  });

  return TVPageModel;
});
