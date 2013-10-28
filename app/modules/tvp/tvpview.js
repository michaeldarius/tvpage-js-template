define([
	"jquery",
	"namespace",
	"backbone"
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
		var TVPView = Backbone.Layout.extend({
			templatePath: '/app/templates/',
      constructor: function(options){
        this.manage = true;
        this.app = tvpage;
        this.eventHandler = tvpage.eventHandler;
        this.renderOverride = false;
        this.module = null;
        this.data = {};
        //this.className = "";
        if ( typeof options == "object" ) {
          if (options.hasOwnProperty("context")) {
            this.context = options.context;
          } else {
            this.context = {};
          }
          
          if (options.hasOwnProperty("module")) {
            this.module = options.module;
          }

					if (options.hasOwnProperty('currentState')) {
						this.currentState = options.currentState;
					}
          
          if (options.hasOwnProperty('data')) {
            var d;
            for (d in options.data) {
              this.data[d] = options.data[d];
            }
          }

        }
        
        Backbone.Layout.call(this, options);
      },

      // Click Handling for jQuery DOM operations (addClass, removeClass, etc...)
      beforeClick: function(e){

      },

      afterClick: function(e){

      },

			/*afterRender:function(){

			},*/

      _click: function(e){

      },

      click: function(e){
       this.beforeClick(e);
       this._click(e);
       this.afterClick(e);
      },

      checkSelector: function(selector) {
        var t = this;
        if (!this.dfd) {
          this.dfd = $.Deferred();
        }
        if ($(selector).length) {
          this.dfd.resolve();
        } else {
          _.delay(function() {
            t.checkSelector(selector);
          }, 50)
        }
      },

      overrideRender: function(){
        this.renderOverride = true;
      },
      
      bindData: function(eventString){
        var d;
        for (d in this.data) {
          this.data[d].bind(eventString, function() {
            this.render();
          }, this);
        }
      },
      
			/*fetch: function() {
				if ( this.template.length <= 0 ) {
					return false;
				}
				var path = this.templatePath + this.template + ".html";

				window.JST = window.JST || {};

				if (JST[path]) {
					return JST[path];
				}

				var content;
				$.ajax({
					url: path,
					type: 'get',
					dataType: 'html',
					async: false,
					success: function(data) {
						content = Handlebars.compile(data);
						JST[path] = content;
					}
				});

				return content;
      },*/
      
      getTemplateOptions: function(){
         return this.options;
      },
      
      /*render: function(layout){
        if (this.renderOverride) {
          var template = this.fetch();
          if ( typeof template == "function" ) {
            var compiledTemplate = template(this.getTemplateOptions());
            $(this.el).html(compiledTemplate);
          }
          return this.el;
        } else {
					if(layout){
						var view = layout(this);
						return view.render();
					} else {
						return this.el;
					}
        }
      },*/
      
      getContext: function(){
        return this.context;
      },
      
      getModule: function(){
        return this.module;
      },
      setModule: function(module){
        this.module = module;
      },
      
      /*
      cleanup:function(){
        if (this.collection) {
          this.collection.off(null,null,this);
        }

        if (this.model){
          this.model.off(null,null,this);
        }
      },*/
              
			/**
			 * Close this object, cleanup, unbind, remove from dom
       * Ensure object can be garbage collected
			 *
			 * @name TVPView#close
       */
      remove: function(){
        if (this.collection) {
          this.collection.off(null, null, this);
        }
        
        if (this.model) {
          this.model.off(null, null, this);
        }
				if(this.eventHandler){
					this.eventHandler.off(null, null, this);
				}
        this.unbind(); // Unbind all local event bindings
        Backbone.View.prototype.remove.call(this); // Remove view from DOM
        this.off();
        //delete this.$el;
        //delete this.el;
      },

      appendClassName: function(className) {
        if (!className) {
          throw "Must supply a className to this function";
        }

        this.$el.addClass(className);
      }
		});

		return TVPView;
	});
