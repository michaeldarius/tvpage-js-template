define([
  "namespace",
  "jquery",
  "backbone",
  "modules/tvp/tvpmodule",

  "modules/Player/views/YoutubePlayer",
  "modules/Player/views/PosterImage",
  "modules/Spots/views/SpotOverlay"
],

function(tvpage, $, Backbone, TVPModule,
  YoutubePlayer, PosterImage, SpotOverlay
  ) {

  function PlayerModule() {
    this.views = {};
    this.data = {};

    this.initialize();

    TVPModule.apply(this, arguments);
  }
  PlayerModule.prototype = new TVPModule();
  PlayerModule.prototype.constructor = PlayerModule;

  PlayerModule.prototype.initialize = function() {
    _.extend(this.views, {
      youtubePlayer: YoutubePlayer,
      posterImage: PosterImage,
      spotOverlay: SpotOverlay
    });
  };

  PlayerModule.prototype.view = function() {
    return [
      new this.views.youtubePlayer({
        model: this.app.data.vars
      }),
      new this.views.posterImage({
        data: {
          vars: this.app.data.vars,
          videoModel: this.app.data.videoModel
        }
      }),
      new this.views.spotOverlay({
        model: this.app.data.vars,
        data: {
          spotCollection: this.app.data.spotCollection
        }
      })
    ];
  };

  return PlayerModule;
});