define([
  "jquery",
  "modules/tvp/tvpmodel"
],
function($, TVPModel) {

  var SpotModel = TVPModel.extend({
    parse: function(data) {
      if (data.data && typeof data.data == "string") {
        data.data = $.parseJSON(data.data);
      }

      return data;
    }
  });

  return SpotModel;
});
