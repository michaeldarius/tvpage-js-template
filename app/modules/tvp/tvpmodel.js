define([
	"jquery",
	"namespace",
	"backbone",
],

	function($, tvpage, Backbone) {
		/**
		 * TVPView class
		 * This is the TVPView class: base class of most views
		 *
		 * @name TVPView
		 * @class TVPView
		 * @constructor
		 * @return TVPView Object
		 */
		var TVPModel = Backbone.Model.extend({
      constructor: function(attributes, options){
        this.app = tvpage;
        Backbone.Model.call(this, attributes, options);
      }
      
		});

		return TVPModel;
	});
