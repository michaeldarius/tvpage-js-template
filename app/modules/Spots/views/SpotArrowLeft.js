define([
  "jquery",
  "modules/tvp/tvpview"
],
  function($, TVPView) {
    /**
     * SpotArrowLeft class
     * This is the SpotArrowLeft class
     *
     * @name SpotArrowLeft
     * @class SpotArrowLeft
     * @constructor
     * @return SpotArrowLeft Object
     */

    var SpotArrowLeft = TVPView.extend({
      template: "Spots/SpotArrowLeft",
      className: "SpotArrowLeft"
    });

    return SpotArrowLeft;
  });