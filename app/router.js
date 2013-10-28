define([
  "jquery",
  "namespace",
  // Libs
  "backbone",

  "modules/TVPData/tvpdata",
  "modules/Canvas/CanvasModule",
  "modules/Content/ContentModule",
  "modules/Player/PlayerModule",
  "modules/Spots/SpotsModule",
  "modules/Modal/ModalModule"

],

function($, tvpage, Backbone, TVPData,
  CanvasModule, ContentModule, PlayerModule, SpotsModule, ModalModule) {

  var app = tvpage;
  var Router = Backbone.Router.extend({
    initialize: function() {
      var THAT = this;

      app.modules = {};
      app.data = {};

      // Data
      app.modules.tvpData = new TVPData();

      // Get TVPage's ID from the DOM
      this._getTVPageId();

      // Views
      app.modules.canvas = new CanvasModule();
      app.modules.content = new ContentModule();
      app.modules.player = new PlayerModule();
      app.modules.spots = new SpotsModule();
      app.modules.modal = new ModalModule();


      var fetchGuideData = app.modules.tvpData.fetchGuideData(app.data.vars.get('tvpageId'));

      $.when(fetchGuideData).done(function() {

        app.data.guideCollectionFiltered.reset(_.filter(app.data.guideCollection.models,function(itm){
          return itm.get('parentId') == app.data.guideCollection.key;
        }));

        app.data.tvpageModel = app.data.guideCollection.findWhere({ typeId: "3" });
        app.data.videoModel.set(app.data.guideCollectionFiltered.findWhere({ typeId: "1" }).attributes);
        app.data.vars.set({ videoId: app.data.videoModel.get('id') }, { silent: true });

      }).then(function() {
        THAT._renderApplication();
      });
    },

    routes: {
      "": "index",
      ":all/": "index"
    },

    index: function() {
      // Reset the state and render.
      //this.reset();
      //console.log('index', app.layout);
    },

    _getTVPageId: function() {
      var tvpageId = $('#tvpage').data('tvpage-id');

      if (typeof tvpageId != "number") {
        throw new Error("tvpageId must be numeric.");
      }

      app.data.vars.set({ tvpageId: tvpageId }, { silent: true });
    },

    _renderApplication: function() {
      app.useLayout('main', { el: '#tvpage' });
      //app.useLayout('tvpage_spots', { el: '#tvpage_spots' });

      console.log(app.layouts);

      app.layouts.main.setViews({
        '.tvp-player': app.modules.player.view(),
        //'.tvp-spots': app.modules.spots.view('spotOverlay'),
        '.tvp-content': app.modules.content.view()

      }).render();



      app.layouts.tvpage_spots.setViews({
        '.tvp-spots': app.modules.spots.view('spotRemote')
      }).render();
    }
  });

  return Router;
});
