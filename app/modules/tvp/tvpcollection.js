define([
	"jquery",
	"namespace",
	"backbone"
],

	function($, tvpage, Backbone) {

		/**
		 * TVPCollection class
		 * This is the TVPCollection class: base class of most views
		 *
		 * @name TVPCollection
		 * @class TVPCollection
		 * @constructor
		 * @return TVPCollection Object
		 */
		var TVPCollection = Backbone.Collection.extend({
      constructor: function (models, options) {
        this.key = -1;
        //this.filter = null;
        this.app = tvpage;
        if(typeof options != 'object'){
          options = {};
        }

        this.options = options;
        Backbone.Collection.call(this, models, options);
      },

      getKey: function(key, options){
        // implement in child
        return false;
      },

      setFilter: function(filter){
        this.filter = filter;
      },

      getFilter: function(){
        return this.filter;
      }
		});

		return TVPCollection;
	});
