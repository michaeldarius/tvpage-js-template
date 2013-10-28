define([
  "jquery"
],
  function($) {
  /**
   * ChannelThumbnail class
   * This is the ChannelThumbnail class
   *
   * @name ChannelThumbnail
   * @class ChannelThumbnail
   * @constructor
   * @return ChannelThumbnail Object
   */

  function ChannelThumbnail() {
    'use strict';

    this.el = '<div class="Thumbnail" style="background-image:url(//www.tvpage.com/player/assets/img/channel_default.jpg);"></div>'
  }

  ChannelThumbnail.prototype = {};
  ChannelThumbnail.prototype.constructor = ChannelThumbnail;

  ChannelThumbnail.prototype.create = function(model) {
    // filter the guideCollection for videos in this containerId
    var guideCollection = null;
    var channelCollection = null;

    if (model.app.data) {
      guideCollection = model.app.data.guideCollection;
    }

    if (guideCollection) {
      channelCollection = _.filter(guideCollection.models, function(mdl) {
        return mdl.get('parentId') == model.get('id');
      });
    }

    if (channelCollection) {
      var videoCount = channelCollection.length;

      if (videoCount > 3) {
        videoCount = 3;
      }

      switch (videoCount) {
        case 1:
          this.el = '<div class="Thumbnail single" style="background-image:url('+channelCollection[0].get('assetDetails').thumbnailUrl+');"></div>'
          break;
        case 2:
          this.el = '<div class="Thumbnail double" style="background-image:url('+channelCollection[0].get('assetDetails').thumbnailUrl+');"></div><div class="Thumbnail double" style="padding-left:0.5%;padding-right:0.5%;background-image:url('+channelCollection[1].get('assetDetails').thumbnailUrl+');"></div>'
          break;
        case 3:
          this.el = '<div class="Thumbnail triple" style="background-image:url('+channelCollection[0].get('assetDetails').thumbnailUrl+');"></div><div class="Thumbnail triple" style="padding-left:0.5%;padding-right:0.5%;background-image:url('+channelCollection[1].get('assetDetails').thumbnailUrl+');"></div><div class="Thumbnail triple" style="background-image:url('+channelCollection[2].get('assetDetails').thumbnailUrl+');"></div>'
          break;
      }
    }

  };

  ChannelThumbnail.prototype.getImages = function() {

  };


  if(!_.has(ChannelThumbnail, 'channelThumbnail')){
    ChannelThumbnail.channelThumbnail = new ChannelThumbnail();
  }
  return ChannelThumbnail.channelThumbnail;
});