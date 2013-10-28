define(['handlebars'], function(Handlebars) {

this["JST"] = this["JST"] || {};

this["JST"]["app/templates/Canvas/CanvasImage.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<!--\n<div class=\"background-image CanvasLogo\" style=\"background-image: url(/wp-content/uploads/2013/09/df_television.png);\"></div>-->\n";
  });

this["JST"]["app/templates/Content/ContentGridItemChannel.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"ChannelImage\"></div>\n<div class=\"ChannelOverlay\" data-key=\"";
  if (stack1 = helpers.id) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\">\n  <p class=\"text-center TitleText\">";
  if (stack1 = helpers.titleText) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.titleText; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</p>\n</div>";
  return buffer;
  });

this["JST"]["app/templates/Content/ContentGridItemVideo.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"VideoOverlay\">\n  <p class=\"text-center TitleText\">";
  if (stack1 = helpers.titleText) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.titleText; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</p>\n  <p class=\"text-center\"><a class=\"PlayLink\" data-video-id=\""
    + escapeExpression(((stack1 = ((stack1 = depth0.assetDetails),stack1 == null || stack1 === false ? stack1 : stack1.videoId)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" href=\"#\">PLAY</a></p>\n</div>";
  return buffer;
  });

this["JST"]["app/templates/Content/ContentItemBack.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<div class=\"BackImage\"></div>\n<div class=\"BackOverlay\">\n  <p class=\"text-center TitleText\">&#706;</p>\n</div>";
  });

this["JST"]["app/templates/Content/ContentList.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<ul class=\"grid\"></ul>";
  });

this["JST"]["app/templates/Content/ContentListItemChannel.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"list-item-media\"></div>\n<div class=\"list-item-body\" data-key=\"";
  if (stack1 = helpers.id) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\">\n  <h4 class=\"list-item-heading\">";
  if (stack1 = helpers.titleText) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.titleText; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</h4>\n</div>";
  return buffer;
  });

this["JST"]["app/templates/Content/ContentListItemVideo.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, stack2, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "\n\n<div class=\"list-item-media background-image\" style=\"background-image:url("
    + escapeExpression(((stack1 = ((stack1 = depth0.assetDetails),stack1 == null || stack1 === false ? stack1 : stack1.thumbnailUrl)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + ");\"></div>\n<div class=\"list-item-body\">\n  <h4 class=\"list-item-heading\">";
  if (stack2 = helpers.titleText) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.titleText; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "</h4>\n</div>\n\n";
  return buffer;
  });

this["JST"]["app/templates/Player/PosterImage.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"poster-overlay\">";
  if (stack1 = helpers.titleText) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.titleText; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</div>";
  return buffer;
  });

this["JST"]["app/templates/Player/YoutubePlayer.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<!--<div id=\"YTPlayer\" style=\"width:100%;height:100%;\"></div>-->\n<iframe id=\"YTPlayer\" class=\"PlayerReal\" type=\"text/html\" width=\"100%\" height=\"100%\" wmode=\"transparent\"\n        src=\"//www.youtube.com/embed/?enablejsapi=1&showinfo=0&iv_load_policy=3&rel=0&wmode=transparent&controls=0\"\n        frameborder=\"0\" style=\"position:absolute;top:0;left:0;width:100%;height:100%;\"></iframe>\n<!--\n<div class=\"ButtonGroup\">\n  <div class=\"ButtonShare\">share</div>\n  <div class=\"ButtonEmbed\">embed</div>\n</div>-->\n";
  });

this["JST"]["app/templates/Spots/SpotArrowLeft.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<button>Q</button>";
  });

this["JST"]["app/templates/Spots/SpotArrowRight.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<button>W</button>";
  });

this["JST"]["app/templates/Spots/SpotItem.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, stack2, functionType="function", escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n    <p>"
    + escapeExpression(((stack1 = ((stack1 = depth0.data),stack1 == null || stack1 === false ? stack1 : stack1.displayTitle)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</p>\n  ";
  return buffer;
  }

function program3(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n    <p>"
    + escapeExpression(((stack1 = ((stack1 = depth0.data),stack1 == null || stack1 === false ? stack1 : stack1.actionText)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</p>\n  ";
  return buffer;
  }

  buffer += "<div class=\"SpotOverlay\">\n  ";
  stack2 = helpers['if'].call(depth0, ((stack1 = depth0.data),stack1 == null || stack1 === false ? stack1 : stack1.displayTitle), {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n\n  ";
  stack2 = helpers['if'].call(depth0, ((stack1 = depth0.data),stack1 == null || stack1 === false ? stack1 : stack1.actionText), {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data});
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n</div>";
  return buffer;
  });

this["JST"]["app/templates/Spots/SpotRemoteSmall.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "&nbsp;";
  });

this["JST"]["app/templates/main.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "";


  buffer += "<div class=\"tvp-canvas\"></div>\n<div class=\"tvp-player\"></div>\n"
    + "\n<div class=\"tvp-content\"></div>";
  return buffer;
  });

this["JST"]["app/templates/tvpage_spots.html"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<div class=\"tvp-spots\"></div>";
  });

return this["JST"];

});