define([
  "modules/tvp/tvpcollection",
  "modules/TVPData/data/TVPageModel"
],
function(TVPCollection, TVPageModel) {

  var GuideCollection = TVPCollection.extend({
    url: function() {
      return 'https://'+this.app.getDomain()+'/api/guide/'+this.key;
    },

    model: TVPageModel,

    comparator:function(itm){
      //console.log('comparator', itm);
      return Number(itm.get('sortOrder'));
    },

    getKey: function(key, options) {
      return key;
    },

    fetch: function(key, options){
      var collectionKey = this.getKey(key, options);

      if (typeof collectionKey == "undefined") {
        collectionKey = false;
      }

      if (collectionKey != this.key){
        if (collectionKey !== false) {
          this.key = collectionKey;
        }
        return Backbone.Collection.prototype.fetch.call(this, options);
      } else {
        // This is a dummy to be backbone compliant and always return a deferred XHR response.
        var def = $.Deferred();
        def.resolve();
        return def.promise();
      }
    },

    /*filter: function(model) {
      return model.get('parentId') == this.key;
    },*/

    initialize: function() {
      //console.log(this);
      /*if (this.key == -1) {
        this.key = this.getKey(this.app.data.vars.get('tvpageId'));
      }*/
    }
  });

  return GuideCollection;
});
