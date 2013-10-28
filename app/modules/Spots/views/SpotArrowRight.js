define([
  "jquery",
  "modules/tvp/tvpview"
],
  function($, TVPView) {
    /**
     * SpotArrowRight class
     * This is the SpotArrowRight class
     *
     * @name SpotArrowRight
     * @class SpotArrowRight
     * @constructor
     * @return SpotArrowRight Object
     */

    var SpotArrowRight = TVPView.extend({
      template: "Spots/SpotArrowRight",
      className: "SpotArrowRight"
    });

    return SpotArrowRight;
  });