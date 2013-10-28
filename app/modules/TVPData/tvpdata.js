define([
  "namespace",
  "jquery",
  "backbone",
  "modules/tvp/tvpmodule",
  "modules/tvp/tvpmodel",

  "modules/TVPData/data/GuideCollection",
  "modules/TVPData/data/SpotCollection",
  "modules/TVPData/data/TVPageModel",
  "modules/TVPData/data/VideoModel"
],

  function(tvpage, $, Backbone, TVPModule, TVPModel, GuideCollection, SpotCollection, TVPageModel, VideoModel) {

    function TVPData(options){
      this.options = options || {};
      this.initialize();

      TVPModule.call(this, options);
    }
    TVPData.prototype = new TVPModule();
    TVPData.prototype.constructor = TVPData;

    TVPData.prototype.initialize = function() {
      this.app.data.tvpageModel = new TVPageModel({}, { module: this });
      this.app.data.guideCollection = new GuideCollection();
      this.app.data.guideCollectionFiltered = new GuideCollection();
      this.app.data.spotCollection = new SpotCollection();
      this.app.data.vars = new TVPModel();
      this.app.data.videoModel = new VideoModel();
    };

    TVPData.prototype.fetchGuideData = function(key) {
      return this.app.data.guideCollection.fetch(key, { dataType: 'jsonp' });
    };

    TVPData.prototype.fetchSpotData = function() {
      return this.app.data.spotCollection.fetch({ dataType: 'jsonp' });
    };

    return TVPData;
  });






















/*
*
Framework.prototype._setTVPage = function(tvpageId) {
 if (typeof tvpageId != "number") {
 throw new Exception('You must supply a valid tvpageId');
 }

 var url = document.location.protocol + '//' + app.hostname + app.endpoints.tvpage + tvpageId;

 var getRequest = this.sendRequest(url);

 getRequest.then(function(data) {
 window.TVPage.data.tvpage = data;
 });
};


 Framework.prototype._setSpots = function(videoId) {
 if (typeof tvpageId != "number") {
 throw new Exception('You must supply a valid tvpageId');
 }

 var url = document.location.protocol + '//' + app.hostname + app.endpoints.spots + videoId;

 var getRequest = this.sendRequest(url);

 getRequest.then(function(data) {
 window.TVPage.data.tvpage = data;
 });
 };

 Framework.prototype._setUrl = function(url) {
 if (app.hosts.hasOwnProperty(document.location.hostname)) {
 app.hostname = app.hosts[document.location.hostname];
 } else {
 app.hostname = "www.tvpage.com";
 }
 };

 Framework.prototype.sendRequest = function(url) {
 'use strict';
 var def = $.Deferred();
 $.ajax({
 url: url,
 type:'GET',
 async: true,
 jsonCallback: 'jsonCallback',
 contentType: 'application/json',
 dataType:'jsonp',
 success:function(json, msg){
 def.resolve(json);
 },
 error: function(e, data) {
 def.reject(e);
 }
 });

 return def.promise();
 };
* */