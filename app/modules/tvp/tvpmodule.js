define([
	"namespace",
	// Libs
	"backbone"
],

function(tvpage, Backbone) {

  function TVPModule(settings){
    this.app = tvpage;
    this.settings = settings || {};
    this.context = {};

    // set options like requires auth, 
    // admin module...
    // ACL...??? 
  };
  
  TVPModule.prototype = {};
  TVPModule.prototype.constructor = TVPModule;

  TVPModule.prototype.view = function(route, args, isLoggedIn, loginId){
    throw "not implemented yet";    
  };
  
  TVPModule.prototype.getContext = function(){
    return this.context;
  };
  
  TVPModule.prototype.load = function (route, args, isLoggedIn, loginId){
    throw "Module::load must be implemented. Return a deferred object (promise)";
  };
  
  TVPModule.prototype.afterRender = function(route, args){

    if (this.hasOwnProperty('views') &&  typeof this.views == "object") {
      var i;
      for (i in this.views) {
        if (this.views[i] instanceof TVPView) {
          this.views[i].afterRender();
        }
      }
    }
 };

  TVPModule.prototype.removeViews = function(route, args){

    if (this.hasOwnProperty('views') &&  typeof this.views == "object") {
      var i;
      for (i in this.views) {
        if (this.views[i] instanceof TVPView) {
          delete this.views[i];
        }
      }
    }
  };

  TVPModule.prototype.getRoutes = function(){
    throw "Must be implemented by module: return object with routes";
  };

  TVPModule.prototype.getRenderTarget = function(route, args){
    throw "Must be implemented by module: return string of class/id for target render";
  };

  TVPModule.prototype.isLoginRequired = function(route, args){
    return false;
  };

  TVPModule.prototype.getLayoutName = function(route, args){
    return false;
  };

	TVPModule.prototype.getModule = function(moduleName){
		if(!this.app || !this.app.modules){
			throw "Trying to call getModule before app or app.modules are initialized.";
		}
		return this.app.modules[moduleName];
	};

	TVPModule.prototype.isDomReady = function(targetRenderLocation, route, args, isLoggedIn, loginId){
    return $(targetRenderLocation).length;
	};

	return TVPModule;
});
