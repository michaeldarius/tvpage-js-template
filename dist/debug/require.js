(function () {
var tvpapp;(function () { if (!tvpapp || !tvpapp.requirejs) {
if (!tvpapp) { tvpapp = {}; } else { require = tvpapp; }
/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.1.5 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global) {
  var req, s, head, baseElement, dataMain, src,
    interactiveScript, currentlyAddingScript, mainScript, subPath,
    version = '2.1.5',
    commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
    cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
    jsSuffixRegExp = /\.js$/,
    currDirRegExp = /^\.\//,
    op = Object.prototype,
    ostring = op.toString,
    hasOwn = op.hasOwnProperty,
    ap = Array.prototype,
    apsp = ap.splice,
    isBrowser = !!(typeof window !== 'undefined' && navigator && window.document),
    isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
  //PS3 indicates loaded and complete, but need to wait for complete
  //specifically. Sequence is 'loading', 'loaded', execution,
  // then 'complete'. The UA check is unfortunate, but not sure how
  //to feature test w/o causing perf issues.
    readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
      /^complete$/ : /^(complete|loaded)$/,
    defContextName = '_',
  //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
    isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
    contexts = {},
    cfg = {},
    globalDefQueue = [],
    useInteractive = false;

  function isFunction(it) {
    return ostring.call(it) === '[object Function]';
  }

  function isArray(it) {
    return ostring.call(it) === '[object Array]';
  }

  /**
   * Helper function for iterating over an array. If the func returns
   * a true value, it will break out of the loop.
   */
  function each(ary, func) {
    if (ary) {
      var i;
      for (i = 0; i < ary.length; i += 1) {
        if (ary[i] && func(ary[i], i, ary)) {
          break;
        }
      }
    }
  }

  /**
   * Helper function for iterating over an array backwards. If the func
   * returns a true value, it will break out of the loop.
   */
  function eachReverse(ary, func) {
    if (ary) {
      var i;
      for (i = ary.length - 1; i > -1; i -= 1) {
        if (ary[i] && func(ary[i], i, ary)) {
          break;
        }
      }
    }
  }

  function hasProp(obj, prop) {
    return hasOwn.call(obj, prop);
  }

  function getOwn(obj, prop) {
    return hasProp(obj, prop) && obj[prop];
  }

  /**
   * Cycles over properties in an object and calls a function for each
   * property value. If the function returns a truthy value, then the
   * iteration is stopped.
   */
  function eachProp(obj, func) {
    var prop;
    for (prop in obj) {
      if (hasProp(obj, prop)) {
        if (func(obj[prop], prop)) {
          break;
        }
      }
    }
  }

  /**
   * Simple function to mix in properties from source into target,
   * but only if target does not already have a property of the same name.
   */
  function mixin(target, source, force, deepStringMixin) {
    if (source) {
      eachProp(source, function (value, prop) {
        if (force || !hasProp(target, prop)) {
          if (deepStringMixin && typeof value !== 'string') {
            if (!target[prop]) {
              target[prop] = {};
            }
            mixin(target[prop], value, force, deepStringMixin);
          } else {
            target[prop] = value;
          }
        }
      });
    }
    return target;
  }

  //Similar to Function.prototype.bind, but the 'this' object is specified
  //first, since it is easier to read/figure out what 'this' will be.
  function bind(obj, fn) {
    return function () {
      return fn.apply(obj, arguments);
    };
  }

  function scripts() {
    return document.getElementsByTagName('script');
  }

  //Allow getting a global that expressed in
  //dot notation, like 'a.b.c'.
  function getGlobal(value) {
    if (!value) {
      return value;
    }
    var g = global;
    each(value.split('.'), function (part) {
      g = g[part];
    });
    return g;
  }

  /**
   * Constructs an error with a pointer to an URL with more information.
   * @param {String} id the error ID that maps to an ID on a web page.
   * @param {String} message human readable error.
   * @param {Error} [err] the original error, if there is one.
   *
   * @returns {Error}
   */
  function makeError(id, msg, err, requireModules) {
    var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
    e.requireType = id;
    e.requireModules = requireModules;
    if (err) {
      e.originalError = err;
    }
    return e;
  }

  if (typeof define !== 'undefined') {
    //If a define is already in play via another AMD loader,
    //do not overwrite.
    return;
  }

  if (typeof requirejs !== 'undefined') {
    if (isFunction(requirejs)) {
      //Do not overwrite and existing requirejs instance.
      return;
    }
    cfg = requirejs;
    requirejs = undefined;
  }

  //Allow for a require config object
  if (typeof require !== 'undefined' && !isFunction(require)) {
    //assume it is a config object.
    cfg = require;
    require = undefined;
  }

  function newContext(contextName) {
    var inCheckLoaded, Module, context, handlers,
      checkLoadedTimeoutId,
      config = {
        //Defaults. Do not set a default for map
        //config to speed up normalize(), which
        //will run faster if there is no default.
        waitSeconds: 7,
        baseUrl: './',
        paths: {},
        pkgs: {},
        shim: {},
        config: {}
      },
      registry = {},
    //registry of just enabled modules, to speed
    //cycle breaking code when lots of modules
    //are registered, but not activated.
      enabledRegistry = {},
      undefEvents = {},
      defQueue = [],
      defined = {},
      urlFetched = {},
      requireCounter = 1,
      unnormalizedCounter = 1;

    /**
     * Trims the . and .. from an array of path segments.
     * It will keep a leading path segment if a .. will become
     * the first path segment, to help with module name lookups,
     * which act like paths, but can be remapped. But the end result,
     * all paths that use this function should look normalized.
     * NOTE: this method MODIFIES the input array.
     * @param {Array} ary the array of path segments.
     */
    function trimDots(ary) {
      var i, part;
      for (i = 0; ary[i]; i += 1) {
        part = ary[i];
        if (part === '.') {
          ary.splice(i, 1);
          i -= 1;
        } else if (part === '..') {
          if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
            //End of the line. Keep at least one non-dot
            //path segment at the front so it can be mapped
            //correctly to disk. Otherwise, there is likely
            //no path mapping for a path starting with '..'.
            //This can still fail, but catches the most reasonable
            //uses of ..
            break;
          } else if (i > 0) {
            ary.splice(i - 1, 2);
            i -= 2;
          }
        }
      }
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @param {Boolean} applyMap apply the map config to the value. Should
     * only be done if this normalization is for a dependency ID.
     * @returns {String} normalized name
     */
    function normalize(name, baseName, applyMap) {
      var pkgName, pkgConfig, mapValue, nameParts, i, j, nameSegment,
        foundMap, foundI, foundStarMap, starI,
        baseParts = baseName && baseName.split('/'),
        normalizedBaseParts = baseParts,
        map = config.map,
        starMap = map && map['*'];

      //Adjust any relative paths.
      if (name && name.charAt(0) === '.') {
        //If have a base name, try to normalize against it,
        //otherwise, assume it is a top-level require that will
        //be relative to baseUrl in the end.
        if (baseName) {
          if (getOwn(config.pkgs, baseName)) {
            //If the baseName is a package name, then just treat it as one
            //name to concat the name with.
            normalizedBaseParts = baseParts = [baseName];
          } else {
            //Convert baseName to array, and lop off the last part,
            //so that . matches that 'directory' and not name of the baseName's
            //module. For instance, baseName of 'one/two/three', maps to
            //'one/two/three.js', but we want the directory, 'one/two' for
            //this normalization.
            normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
          }

          name = normalizedBaseParts.concat(name.split('/'));
          trimDots(name);

          //Some use of packages may use a . path to reference the
          //'main' module name, so normalize for that.
          pkgConfig = getOwn(config.pkgs, (pkgName = name[0]));
          name = name.join('/');
          if (pkgConfig && name === pkgName + '/' + pkgConfig.main) {
            name = pkgName;
          }
        } else if (name.indexOf('./') === 0) {
          // No baseName, so this is ID is resolved relative
          // to baseUrl, pull off the leading dot.
          name = name.substring(2);
        }
      }

      //Apply map config if available.
      if (applyMap && map && (baseParts || starMap)) {
        nameParts = name.split('/');

        for (i = nameParts.length; i > 0; i -= 1) {
          nameSegment = nameParts.slice(0, i).join('/');

          if (baseParts) {
            //Find the longest baseName segment match in the config.
            //So, do joins on the biggest to smallest lengths of baseParts.
            for (j = baseParts.length; j > 0; j -= 1) {
              mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

              //baseName segment has config, find if it has one for
              //this name.
              if (mapValue) {
                mapValue = getOwn(mapValue, nameSegment);
                if (mapValue) {
                  //Match, update name to the new value.
                  foundMap = mapValue;
                  foundI = i;
                  break;
                }
              }
            }
          }

          if (foundMap) {
            break;
          }

          //Check for a star map match, but just hold on to it,
          //if there is a shorter segment match later in a matching
          //config, then favor over this star map.
          if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
            foundStarMap = getOwn(starMap, nameSegment);
            starI = i;
          }
        }

        if (!foundMap && foundStarMap) {
          foundMap = foundStarMap;
          foundI = starI;
        }

        if (foundMap) {
          nameParts.splice(0, foundI, foundMap);
          name = nameParts.join('/');
        }
      }

      return name;
    }

    function removeScript(name) {
      if (isBrowser) {
        each(scripts(), function (scriptNode) {
          if (scriptNode.getAttribute('data-requiremodule') === name &&
            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
            scriptNode.parentNode.removeChild(scriptNode);
            return true;
          }
        });
      }
    }

    function hasPathFallback(id) {
      var pathConfig = getOwn(config.paths, id);
      if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
        removeScript(id);
        //Pop off the first array value, since it failed, and
        //retry
        pathConfig.shift();
        context.require.undef(id);
        context.require([id]);
        return true;
      }
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
      var prefix,
        index = name ? name.indexOf('!') : -1;
      if (index > -1) {
        prefix = name.substring(0, index);
        name = name.substring(index + 1, name.length);
      }
      return [prefix, name];
    }

    /**
     * Creates a module mapping that includes plugin prefix, module
     * name, and path. If parentModuleMap is provided it will
     * also normalize the name via require.normalize()
     *
     * @param {String} name the module name
     * @param {String} [parentModuleMap] parent module map
     * for the module name, used to resolve relative names.
     * @param {Boolean} isNormalized: is the ID already normalized.
     * This is true if this call is done for a define() module ID.
     * @param {Boolean} applyMap: apply the map config to the ID.
     * Should only be true if this map is for a dependency.
     *
     * @returns {Object}
     */
    function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
      var url, pluginModule, suffix, nameParts,
        prefix = null,
        parentName = parentModuleMap ? parentModuleMap.name : null,
        originalName = name,
        isDefine = true,
        normalizedName = '';

      //If no name, then it means it is a require call, generate an
      //internal name.
      if (!name) {
        isDefine = false;
        name = '_@r' + (requireCounter += 1);
      }

      nameParts = splitPrefix(name);
      prefix = nameParts[0];
      name = nameParts[1];

      if (prefix) {
        prefix = normalize(prefix, parentName, applyMap);
        pluginModule = getOwn(defined, prefix);
      }

      //Account for relative paths if there is a base name.
      if (name) {
        if (prefix) {
          if (pluginModule && pluginModule.normalize) {
            //Plugin is loaded, use its normalize method.
            normalizedName = pluginModule.normalize(name, function (name) {
              return normalize(name, parentName, applyMap);
            });
          } else {
            normalizedName = normalize(name, parentName, applyMap);
          }
        } else {
          //A regular module.
          normalizedName = normalize(name, parentName, applyMap);

          //Normalized name may be a plugin ID due to map config
          //application in normalize. The map config values must
          //already be normalized, so do not need to redo that part.
          nameParts = splitPrefix(normalizedName);
          prefix = nameParts[0];
          normalizedName = nameParts[1];
          isNormalized = true;

          url = context.nameToUrl(normalizedName);
        }
      }

      //If the id is a plugin id that cannot be determined if it needs
      //normalization, stamp it with a unique ID so two matching relative
      //ids that may conflict can be separate.
      suffix = prefix && !pluginModule && !isNormalized ?
        '_unnormalized' + (unnormalizedCounter += 1) :
        '';

      return {
        prefix: prefix,
        name: normalizedName,
        parentMap: parentModuleMap,
        unnormalized: !!suffix,
        url: url,
        originalName: originalName,
        isDefine: isDefine,
        id: (prefix ?
          prefix + '!' + normalizedName :
          normalizedName) + suffix
      };
    }

    function getModule(depMap) {
      var id = depMap.id,
        mod = getOwn(registry, id);

      if (!mod) {
        mod = registry[id] = new context.Module(depMap);
      }

      return mod;
    }

    function on(depMap, name, fn) {
      var id = depMap.id,
        mod = getOwn(registry, id);

      if (hasProp(defined, id) &&
        (!mod || mod.defineEmitComplete)) {
        if (name === 'defined') {
          fn(defined[id]);
        }
      } else {
        getModule(depMap).on(name, fn);
      }
    }

    function onError(err, errback) {
      var ids = err.requireModules,
        notified = false;

      if (errback) {
        errback(err);
      } else {
        each(ids, function (id) {
          var mod = getOwn(registry, id);
          if (mod) {
            //Set error on module, so it skips timeout checks.
            mod.error = err;
            if (mod.events.error) {
              notified = true;
              mod.emit('error', err);
            }
          }
        });

        if (!notified) {
          req.onError(err);
        }
      }
    }

    /**
     * Internal method to transfer globalQueue items to this context's
     * defQueue.
     */
    function takeGlobalQueue() {
      //Push all the globalDefQueue items into the context's defQueue
      if (globalDefQueue.length) {
        //Array splice in the values since the context code has a
        //local var ref to defQueue, so cannot just reassign the one
        //on context.
        apsp.apply(defQueue,
          [defQueue.length - 1, 0].concat(globalDefQueue));
        globalDefQueue = [];
      }
    }

    handlers = {
      'require': function (mod) {
        if (mod.require) {
          return mod.require;
        } else {
          return (mod.require = context.makeRequire(mod.map));
        }
      },
      'exports': function (mod) {
        mod.usingExports = true;
        if (mod.map.isDefine) {
          if (mod.exports) {
            return mod.exports;
          } else {
            return (mod.exports = defined[mod.map.id] = {});
          }
        }
      },
      'module': function (mod) {
        if (mod.module) {
          return mod.module;
        } else {
          return (mod.module = {
            id: mod.map.id,
            uri: mod.map.url,
            config: function () {
              return (config.config && getOwn(config.config, mod.map.id)) || {};
            },
            exports: defined[mod.map.id]
          });
        }
      }
    };

    function cleanRegistry(id) {
      //Clean up machinery used for waiting modules.
      delete registry[id];
      delete enabledRegistry[id];
    }

    function breakCycle(mod, traced, processed) {
      var id = mod.map.id;

      if (mod.error) {
        mod.emit('error', mod.error);
      } else {
        traced[id] = true;
        each(mod.depMaps, function (depMap, i) {
          var depId = depMap.id,
            dep = getOwn(registry, depId);

          //Only force things that have not completed
          //being defined, so still in the registry,
          //and only if it has not been matched up
          //in the module already.
          if (dep && !mod.depMatched[i] && !processed[depId]) {
            if (getOwn(traced, depId)) {
              mod.defineDep(i, defined[depId]);
              mod.check(); //pass false?
            } else {
              breakCycle(dep, traced, processed);
            }
          }
        });
        processed[id] = true;
      }
    }

    function checkLoaded() {
      var map, modId, err, usingPathFallback,
        waitInterval = config.waitSeconds * 1000,
      //It is possible to disable the wait interval by using waitSeconds of 0.
        expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
        noLoads = [],
        reqCalls = [],
        stillLoading = false,
        needCycleCheck = true;

      //Do not bother if this call was a result of a cycle break.
      if (inCheckLoaded) {
        return;
      }

      inCheckLoaded = true;

      //Figure out the state of all the modules.
      eachProp(enabledRegistry, function (mod) {
        map = mod.map;
        modId = map.id;

        //Skip things that are not enabled or in error state.
        if (!mod.enabled) {
          return;
        }

        if (!map.isDefine) {
          reqCalls.push(mod);
        }

        if (!mod.error) {
          //If the module should be executed, and it has not
          //been inited and time is up, remember it.
          if (!mod.inited && expired) {
            if (hasPathFallback(modId)) {
              usingPathFallback = true;
              stillLoading = true;
            } else {
              noLoads.push(modId);
              removeScript(modId);
            }
          } else if (!mod.inited && mod.fetched && map.isDefine) {
            stillLoading = true;
            if (!map.prefix) {
              //No reason to keep looking for unfinished
              //loading. If the only stillLoading is a
              //plugin resource though, keep going,
              //because it may be that a plugin resource
              //is waiting on a non-plugin cycle.
              return (needCycleCheck = false);
            }
          }
        }
      });

      if (expired && noLoads.length) {
        //If wait time expired, throw error of unloaded modules.
        err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
        err.contextName = context.contextName;
        return onError(err);
      }

      //Not expired, check for a cycle.
      if (needCycleCheck) {
        each(reqCalls, function (mod) {
          breakCycle(mod, {}, {});
        });
      }

      //If still waiting on loads, and the waiting load is something
      //other than a plugin resource, or there are still outstanding
      //scripts, then just try back later.
      if ((!expired || usingPathFallback) && stillLoading) {
        //Something is still waiting to load. Wait for it, but only
        //if a timeout is not already in effect.
        if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
          checkLoadedTimeoutId = setTimeout(function () {
            checkLoadedTimeoutId = 0;
            checkLoaded();
          }, 50);
        }
      }

      inCheckLoaded = false;
    }

    Module = function (map) {
      this.events = getOwn(undefEvents, map.id) || {};
      this.map = map;
      this.shim = getOwn(config.shim, map.id);
      this.depExports = [];
      this.depMaps = [];
      this.depMatched = [];
      this.pluginMaps = {};
      this.depCount = 0;

      /* this.exports this.factory
       this.depMaps = [],
       this.enabled, this.fetched
       */
    };

    Module.prototype = {
      init: function (depMaps, factory, errback, options) {
        options = options || {};

        //Do not do more inits if already done. Can happen if there
        //are multiple define calls for the same module. That is not
        //a normal, common case, but it is also not unexpected.
        if (this.inited) {
          return;
        }

        this.factory = factory;

        if (errback) {
          //Register for errors on this module.
          this.on('error', errback);
        } else if (this.events.error) {
          //If no errback already, but there are error listeners
          //on this module, set up an errback to pass to the deps.
          errback = bind(this, function (err) {
            this.emit('error', err);
          });
        }

        //Do a copy of the dependency array, so that
        //source inputs are not modified. For example
        //"shim" deps are passed in here directly, and
        //doing a direct modification of the depMaps array
        //would affect that config.
        this.depMaps = depMaps && depMaps.slice(0);

        this.errback = errback;

        //Indicate this module has be initialized
        this.inited = true;

        this.ignore = options.ignore;

        //Could have option to init this module in enabled mode,
        //or could have been previously marked as enabled. However,
        //the dependencies are not known until init is called. So
        //if enabled previously, now trigger dependencies as enabled.
        if (options.enabled || this.enabled) {
          //Enable this module and dependencies.
          //Will call this.check()
          this.enable();
        } else {
          this.check();
        }
      },

      defineDep: function (i, depExports) {
        //Because of cycles, defined callback for a given
        //export can be called more than once.
        if (!this.depMatched[i]) {
          this.depMatched[i] = true;
          this.depCount -= 1;
          this.depExports[i] = depExports;
        }
      },

      fetch: function () {
        if (this.fetched) {
          return;
        }
        this.fetched = true;

        context.startTime = (new Date()).getTime();

        var map = this.map;

        //If the manager is for a plugin managed resource,
        //ask the plugin to load it now.
        if (this.shim) {
          context.makeRequire(this.map, {
            enableBuildCallback: true
          })(this.shim.deps || [], bind(this, function () {
              return map.prefix ? this.callPlugin() : this.load();
            }));
        } else {
          //Regular dependency.
          return map.prefix ? this.callPlugin() : this.load();
        }
      },

      load: function () {
        var url = this.map.url;

        //Regular dependency.
        if (!urlFetched[url]) {
          urlFetched[url] = true;
          context.load(this.map.id, url);
        }
      },

      /**
       * Checks if the module is ready to define itself, and if so,
       * define it.
       */
      check: function () {
        if (!this.enabled || this.enabling) {
          return;
        }

        var err, cjsModule,
          id = this.map.id,
          depExports = this.depExports,
          exports = this.exports,
          factory = this.factory;

        if (!this.inited) {
          this.fetch();
        } else if (this.error) {
          this.emit('error', this.error);
        } else if (!this.defining) {
          //The factory could trigger another require call
          //that would result in checking this module to
          //define itself again. If already in the process
          //of doing that, skip this work.
          this.defining = true;

          if (this.depCount < 1 && !this.defined) {
            if (isFunction(factory)) {
              //If there is an error listener, favor passing
              //to that instead of throwing an error.
              if (this.events.error) {
                try {
                  exports = context.execCb(id, factory, depExports, exports);
                } catch (e) {
                  err = e;
                }
              } else {
                exports = context.execCb(id, factory, depExports, exports);
              }

              if (this.map.isDefine) {
                //If setting exports via 'module' is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                cjsModule = this.module;
                if (cjsModule &&
                  cjsModule.exports !== undefined &&
                  //Make sure it is not already the exports value
                  cjsModule.exports !== this.exports) {
                  exports = cjsModule.exports;
                } else if (exports === undefined && this.usingExports) {
                  //exports already set the defined value.
                  exports = this.exports;
                }
              }

              if (err) {
                err.requireMap = this.map;
                err.requireModules = [this.map.id];
                err.requireType = 'define';
                return onError((this.error = err));
              }

            } else {
              //Just a literal value
              exports = factory;
            }

            this.exports = exports;

            if (this.map.isDefine && !this.ignore) {
              defined[id] = exports;

              if (req.onResourceLoad) {
                req.onResourceLoad(context, this.map, this.depMaps);
              }
            }

            //Clean up
            cleanRegistry(id);

            this.defined = true;
          }

          //Finished the define stage. Allow calling check again
          //to allow define notifications below in the case of a
          //cycle.
          this.defining = false;

          if (this.defined && !this.defineEmitted) {
            this.defineEmitted = true;
            this.emit('defined', this.exports);
            this.defineEmitComplete = true;
          }

        }
      },

      callPlugin: function () {
        var map = this.map,
          id = map.id,
        //Map already normalized the prefix.
          pluginMap = makeModuleMap(map.prefix);

        //Mark this as a dependency for this plugin, so it
        //can be traced for cycles.
        this.depMaps.push(pluginMap);

        on(pluginMap, 'defined', bind(this, function (plugin) {
          var load, normalizedMap, normalizedMod,
            name = this.map.name,
            parentName = this.map.parentMap ? this.map.parentMap.name : null,
            localRequire = context.makeRequire(map.parentMap, {
              enableBuildCallback: true
            });

          //If current map is not normalized, wait for that
          //normalized name to load instead of continuing.
          if (this.map.unnormalized) {
            //Normalize the ID if the plugin allows it.
            if (plugin.normalize) {
              name = plugin.normalize(name, function (name) {
                return normalize(name, parentName, true);
              }) || '';
            }

            //prefix and name should already be normalized, no need
            //for applying map config again either.
            normalizedMap = makeModuleMap(map.prefix + '!' + name,
              this.map.parentMap);
            on(normalizedMap,
              'defined', bind(this, function (value) {
                this.init([], function () { return value; }, null, {
                  enabled: true,
                  ignore: true
                });
              }));

            normalizedMod = getOwn(registry, normalizedMap.id);
            if (normalizedMod) {
              //Mark this as a dependency for this plugin, so it
              //can be traced for cycles.
              this.depMaps.push(normalizedMap);

              if (this.events.error) {
                normalizedMod.on('error', bind(this, function (err) {
                  this.emit('error', err);
                }));
              }
              normalizedMod.enable();
            }

            return;
          }

          load = bind(this, function (value) {
            this.init([], function () { return value; }, null, {
              enabled: true
            });
          });

          load.error = bind(this, function (err) {
            this.inited = true;
            this.error = err;
            err.requireModules = [id];

            //Remove temp unnormalized modules for this module,
            //since they will never be resolved otherwise now.
            eachProp(registry, function (mod) {
              if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                cleanRegistry(mod.map.id);
              }
            });

            onError(err);
          });

          //Allow plugins to load other code without having to know the
          //context or how to 'complete' the load.
          load.fromText = bind(this, function (text, textAlt) {
            /*jslint evil: true */
            var moduleName = map.name,
              moduleMap = makeModuleMap(moduleName),
              hasInteractive = useInteractive;

            //As of 2.1.0, support just passing the text, to reinforce
            //fromText only being called once per resource. Still
            //support old style of passing moduleName but discard
            //that moduleName in favor of the internal ref.
            if (textAlt) {
              text = textAlt;
            }

            //Turn off interactive script matching for IE for any define
            //calls in the text, then turn it back on at the end.
            if (hasInteractive) {
              useInteractive = false;
            }

            //Prime the system by creating a module instance for
            //it.
            getModule(moduleMap);

            //Transfer any config to this other module.
            if (hasProp(config.config, id)) {
              config.config[moduleName] = config.config[id];
            }

            try {
              req.exec(text);
            } catch (e) {
              return onError(makeError('fromtexteval',
                'fromText eval for ' + id +
                  ' failed: ' + e,
                e,
                [id]));
            }

            if (hasInteractive) {
              useInteractive = true;
            }

            //Mark this as a dependency for the plugin
            //resource
            this.depMaps.push(moduleMap);

            //Support anonymous modules.
            context.completeLoad(moduleName);

            //Bind the value of that module to the value for this
            //resource ID.
            localRequire([moduleName], load);
          });

          //Use parentName here since the plugin's name is not reliable,
          //could be some weird string with no path that actually wants to
          //reference the parentName's path.
          plugin.load(map.name, localRequire, load, config);
        }));

        context.enable(pluginMap, this);
        this.pluginMaps[pluginMap.id] = pluginMap;
      },

      enable: function () {
        enabledRegistry[this.map.id] = this;
        this.enabled = true;

        //Set flag mentioning that the module is enabling,
        //so that immediate calls to the defined callbacks
        //for dependencies do not trigger inadvertent load
        //with the depCount still being zero.
        this.enabling = true;

        //Enable each dependency
        each(this.depMaps, bind(this, function (depMap, i) {
          var id, mod, handler;

          if (typeof depMap === 'string') {
            //Dependency needs to be converted to a depMap
            //and wired up to this module.
            depMap = makeModuleMap(depMap,
              (this.map.isDefine ? this.map : this.map.parentMap),
              false,
              !this.skipMap);
            this.depMaps[i] = depMap;

            handler = getOwn(handlers, depMap.id);

            if (handler) {
              this.depExports[i] = handler(this);
              return;
            }

            this.depCount += 1;

            on(depMap, 'defined', bind(this, function (depExports) {
              this.defineDep(i, depExports);
              this.check();
            }));

            if (this.errback) {
              on(depMap, 'error', this.errback);
            }
          }

          id = depMap.id;
          mod = registry[id];

          //Skip special modules like 'require', 'exports', 'module'
          //Also, don't call enable if it is already enabled,
          //important in circular dependency cases.
          if (!hasProp(handlers, id) && mod && !mod.enabled) {
            context.enable(depMap, this);
          }
        }));

        //Enable each plugin that is used in
        //a dependency
        eachProp(this.pluginMaps, bind(this, function (pluginMap) {
          var mod = getOwn(registry, pluginMap.id);
          if (mod && !mod.enabled) {
            context.enable(pluginMap, this);
          }
        }));

        this.enabling = false;

        this.check();
      },

      on: function (name, cb) {
        var cbs = this.events[name];
        if (!cbs) {
          cbs = this.events[name] = [];
        }
        cbs.push(cb);
      },

      emit: function (name, evt) {
        each(this.events[name], function (cb) {
          cb(evt);
        });
        if (name === 'error') {
          //Now that the error handler was triggered, remove
          //the listeners, since this broken Module instance
          //can stay around for a while in the registry.
          delete this.events[name];
        }
      }
    };

    function callGetModule(args) {
      //Skip modules already defined.
      if (!hasProp(defined, args[0])) {
        getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
      }
    }

    function removeListener(node, func, name, ieName) {
      //Favor detachEvent because of IE9
      //issue, see attachEvent/addEventListener comment elsewhere
      //in this file.
      if (node.detachEvent && !isOpera) {
        //Probably IE. If not it will throw an error, which will be
        //useful to know.
        if (ieName) {
          node.detachEvent(ieName, func);
        }
      } else {
        node.removeEventListener(name, func, false);
      }
    }

    /**
     * Given an event from a script node, get the requirejs info from it,
     * and then removes the event listeners on the node.
     * @param {Event} evt
     * @returns {Object}
     */
    function getScriptData(evt) {
      //Using currentTarget instead of target for Firefox 2.0's sake. Not
      //all old browsers will be supported, but this one was easy enough
      //to support and still makes sense.
      var node = evt.currentTarget || evt.srcElement;

      //Remove the listeners once here.
      removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
      removeListener(node, context.onScriptError, 'error');

      return {
        node: node,
        id: node && node.getAttribute('data-requiremodule')
      };
    }

    function intakeDefines() {
      var args;

      //Any defined modules in the global queue, intake them now.
      takeGlobalQueue();

      //Make sure any remaining defQueue items get properly processed.
      while (defQueue.length) {
        args = defQueue.shift();
        if (args[0] === null) {
          return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' + args[args.length - 1]));
        } else {
          //args are id, deps, factory. Should be normalized by the
          //define() function.
          callGetModule(args);
        }
      }
    }

    context = {
      config: config,
      contextName: contextName,
      registry: registry,
      defined: defined,
      urlFetched: urlFetched,
      defQueue: defQueue,
      Module: Module,
      makeModuleMap: makeModuleMap,
      nextTick: req.nextTick,
      onError: onError,

      /**
       * Set a configuration for the context.
       * @param {Object} cfg config object to integrate.
       */
      configure: function (cfg) {
        //Make sure the baseUrl ends in a slash.
        if (cfg.baseUrl) {
          if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
            cfg.baseUrl += '/';
          }
        }

        //Save off the paths and packages since they require special processing,
        //they are additive.
        var pkgs = config.pkgs,
          shim = config.shim,
          objs = {
            paths: true,
            config: true,
            map: true
          };

        eachProp(cfg, function (value, prop) {
          if (objs[prop]) {
            if (prop === 'map') {
              if (!config.map) {
                config.map = {};
              }
              mixin(config[prop], value, true, true);
            } else {
              mixin(config[prop], value, true);
            }
          } else {
            config[prop] = value;
          }
        });

        //Merge shim
        if (cfg.shim) {
          eachProp(cfg.shim, function (value, id) {
            //Normalize the structure
            if (isArray(value)) {
              value = {
                deps: value
              };
            }
            if ((value.exports || value.init) && !value.exportsFn) {
              value.exportsFn = context.makeShimExports(value);
            }
            shim[id] = value;
          });
          config.shim = shim;
        }

        //Adjust packages if necessary.
        if (cfg.packages) {
          each(cfg.packages, function (pkgObj) {
            var location;

            pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;
            location = pkgObj.location;

            //Create a brand new object on pkgs, since currentPackages can
            //be passed in again, and config.pkgs is the internal transformed
            //state for all package configs.
            pkgs[pkgObj.name] = {
              name: pkgObj.name,
              location: location || pkgObj.name,
              //Remove leading dot in main, so main paths are normalized,
              //and remove any trailing .js, since different package
              //envs have different conventions: some use a module name,
              //some use a file name.
              main: (pkgObj.main || 'main')
                .replace(currDirRegExp, '')
                .replace(jsSuffixRegExp, '')
            };
          });

          //Done with modifications, assing packages back to context config
          config.pkgs = pkgs;
        }

        //If there are any "waiting to execute" modules in the registry,
        //update the maps for them, since their info, like URLs to load,
        //may have changed.
        eachProp(registry, function (mod, id) {
          //If module already has init called, since it is too
          //late to modify them, and ignore unnormalized ones
          //since they are transient.
          if (!mod.inited && !mod.map.unnormalized) {
            mod.map = makeModuleMap(id);
          }
        });

        //If a deps array or a config callback is specified, then call
        //require with those args. This is useful when require is defined as a
        //config object before require.js is loaded.
        if (cfg.deps || cfg.callback) {
          context.require(cfg.deps || [], cfg.callback);
        }
      },

      makeShimExports: function (value) {
        function fn() {
          var ret;
          if (value.init) {
            ret = value.init.apply(global, arguments);
          }
          return ret || (value.exports && getGlobal(value.exports));
        }
        return fn;
      },

      makeRequire: function (relMap, options) {
        options = options || {};

        function localRequire(deps, callback, errback) {
          var id, map, requireMod;

          if (options.enableBuildCallback && callback && isFunction(callback)) {
            callback.__requireJsBuild = true;
          }

          if (typeof deps === 'string') {
            if (isFunction(callback)) {
              //Invalid call
              return onError(makeError('requireargs', 'Invalid require call'), errback);
            }

            //If require|exports|module are requested, get the
            //value for them from the special handlers. Caveat:
            //this only works while module is being defined.
            if (relMap && hasProp(handlers, deps)) {
              return handlers[deps](registry[relMap.id]);
            }

            //Synchronous access to one module. If require.get is
            //available (as in the Node adapter), prefer that.
            if (req.get) {
              return req.get(context, deps, relMap, localRequire);
            }

            //Normalize module name, if it contains . or ..
            map = makeModuleMap(deps, relMap, false, true);
            id = map.id;

            if (!hasProp(defined, id)) {
              return onError(makeError('notloaded', 'Module name "' +
                id +
                '" has not been loaded yet for context: ' +
                contextName +
                (relMap ? '' : '. Use require([])')));
            }
            return defined[id];
          }

          //Grab defines waiting in the global queue.
          intakeDefines();

          //Mark all the dependencies as needing to be loaded.
          context.nextTick(function () {
            //Some defines could have been added since the
            //require call, collect them.
            intakeDefines();

            requireMod = getModule(makeModuleMap(null, relMap));

            //Store if map config should be applied to this require
            //call for dependencies.
            requireMod.skipMap = options.skipMap;

            requireMod.init(deps, callback, errback, {
              enabled: true
            });

            checkLoaded();
          });

          return localRequire;
        }

        mixin(localRequire, {
          isBrowser: isBrowser,

          /**
           * Converts a module name + .extension into an URL path.
           * *Requires* the use of a module name. It does not support using
           * plain URLs like nameToUrl.
           */
          toUrl: function (moduleNamePlusExt) {
            var ext,
              index = moduleNamePlusExt.lastIndexOf('.'),
              segment = moduleNamePlusExt.split('/')[0],
              isRelative = segment === '.' || segment === '..';

            //Have a file extension alias, and it is not the
            //dots from a relative path.
            if (index !== -1 && (!isRelative || index > 1)) {
              ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
              moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
            }

            return context.nameToUrl(normalize(moduleNamePlusExt,
              relMap && relMap.id, true), ext,  true);
          },

          defined: function (id) {
            return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
          },

          specified: function (id) {
            id = makeModuleMap(id, relMap, false, true).id;
            return hasProp(defined, id) || hasProp(registry, id);
          }
        });

        //Only allow undef on top level require calls
        if (!relMap) {
          localRequire.undef = function (id) {
            //Bind any waiting define() calls to this context,
            //fix for #408
            takeGlobalQueue();

            var map = makeModuleMap(id, relMap, true),
              mod = getOwn(registry, id);

            delete defined[id];
            delete urlFetched[map.url];
            delete undefEvents[id];

            if (mod) {
              //Hold on to listeners in case the
              //module will be attempted to be reloaded
              //using a different config.
              if (mod.events.defined) {
                undefEvents[id] = mod.events;
              }

              cleanRegistry(id);
            }
          };
        }

        return localRequire;
      },

      /**
       * Called to enable a module if it is still in the registry
       * awaiting enablement. A second arg, parent, the parent module,
       * is passed in for context, when this method is overriden by
       * the optimizer. Not shown here to keep code compact.
       */
      enable: function (depMap) {
        var mod = getOwn(registry, depMap.id);
        if (mod) {
          getModule(depMap).enable();
        }
      },

      /**
       * Internal method used by environment adapters to complete a load event.
       * A load event could be a script load or just a load pass from a synchronous
       * load call.
       * @param {String} moduleName the name of the module to potentially complete.
       */
      completeLoad: function (moduleName) {
        var found, args, mod,
          shim = getOwn(config.shim, moduleName) || {},
          shExports = shim.exports;

        takeGlobalQueue();

        while (defQueue.length) {
          args = defQueue.shift();
          if (args[0] === null) {
            args[0] = moduleName;
            //If already found an anonymous module and bound it
            //to this name, then this is some other anon module
            //waiting for its completeLoad to fire.
            if (found) {
              break;
            }
            found = true;
          } else if (args[0] === moduleName) {
            //Found matching define call for this script!
            found = true;
          }

          callGetModule(args);
        }

        //Do this after the cycle of callGetModule in case the result
        //of those calls/init calls changes the registry.
        mod = getOwn(registry, moduleName);

        if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
          if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
            if (hasPathFallback(moduleName)) {
              return;
            } else {
              return onError(makeError('nodefine',
                'No define call for ' + moduleName,
                null,
                [moduleName]));
            }
          } else {
            //A script that does not call define(), so just simulate
            //the call for it.
            callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
          }
        }

        checkLoaded();
      },

      /**
       * Converts a module name to a file path. Supports cases where
       * moduleName may actually be just an URL.
       * Note that it **does not** call normalize on the moduleName,
       * it is assumed to have already been normalized. This is an
       * internal API, not a public one. Use toUrl for the public API.
       */
      nameToUrl: function (moduleName, ext, skipExt) {
        var paths, pkgs, pkg, pkgPath, syms, i, parentModule, url,
          parentPath;

        //If a colon is in the URL, it indicates a protocol is used and it is just
        //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
        //or ends with .js, then assume the user meant to use an url and not a module id.
        //The slash is important for protocol-less URLs as well as full paths.
        if (req.jsExtRegExp.test(moduleName)) {
          //Just a plain path, not module name lookup, so just return it.
          //Add extension if it is included. This is a bit wonky, only non-.js things pass
          //an extension, this method probably needs to be reworked.
          url = moduleName + (ext || '');
        } else {
          //A module that needs to be converted to a path.
          paths = config.paths;
          pkgs = config.pkgs;

          syms = moduleName.split('/');
          //For each module name segment, see if there is a path
          //registered for it. Start with most specific name
          //and work up from it.
          for (i = syms.length; i > 0; i -= 1) {
            parentModule = syms.slice(0, i).join('/');
            pkg = getOwn(pkgs, parentModule);
            parentPath = getOwn(paths, parentModule);
            if (parentPath) {
              //If an array, it means there are a few choices,
              //Choose the one that is desired
              if (isArray(parentPath)) {
                parentPath = parentPath[0];
              }
              syms.splice(0, i, parentPath);
              break;
            } else if (pkg) {
              //If module name is just the package name, then looking
              //for the main module.
              if (moduleName === pkg.name) {
                pkgPath = pkg.location + '/' + pkg.main;
              } else {
                pkgPath = pkg.location;
              }
              syms.splice(0, i, pkgPath);
              break;
            }
          }

          //Join the path parts together, then figure out if baseUrl is needed.
          url = syms.join('/');
          url += (ext || (/\?/.test(url) || skipExt ? '' : '.js'));
          url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
        }

        return config.urlArgs ? url +
          ((url.indexOf('?') === -1 ? '?' : '&') +
            config.urlArgs) : url;
      },

      //Delegates to req.load. Broken out as a separate function to
      //allow overriding in the optimizer.
      load: function (id, url) {
        req.load(context, id, url);
      },

      /**
       * Executes a module callback function. Broken out as a separate function
       * solely to allow the build system to sequence the files in the built
       * layer in the right sequence.
       *
       * @private
       */
      execCb: function (name, callback, args, exports) {
        return callback.apply(exports, args);
      },

      /**
       * callback for script loads, used to check status of loading.
       *
       * @param {Event} evt the event from the browser for the script
       * that was loaded.
       */
      onScriptLoad: function (evt) {
        //Using currentTarget instead of target for Firefox 2.0's sake. Not
        //all old browsers will be supported, but this one was easy enough
        //to support and still makes sense.
        if (evt.type === 'load' ||
          (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
          //Reset interactive script so a script node is not held onto for
          //to long.
          interactiveScript = null;

          //Pull out the name of the module and the context.
          var data = getScriptData(evt);
          context.completeLoad(data.id);
        }
      },

      /**
       * Callback for script errors.
       */
      onScriptError: function (evt) {
        var data = getScriptData(evt);
        if (!hasPathFallback(data.id)) {
          return onError(makeError('scripterror', 'Script error', evt, [data.id]));
        }
      }
    };

    context.require = context.makeRequire();
    return context;
  }

  /**
   * Main entry point.
   *
   * If the only argument to require is a string, then the module that
   * is represented by that string is fetched for the appropriate context.
   *
   * If the first argument is an array, then it will be treated as an array
   * of dependency string names to fetch. An optional function callback can
   * be specified to execute when all of those dependencies are available.
   *
   * Make a local req variable to help Caja compliance (it assumes things
   * on a require that are not standardized), and to give a short
   * name for minification/local scope use.
   */
  req = requirejs = function (deps, callback, errback, optional) {

    //Find the right context, use default
    var context, config,
      contextName = defContextName;

    // Determine if have config object in the call.
    if (!isArray(deps) && typeof deps !== 'string') {
      // deps is a config object
      config = deps;
      if (isArray(callback)) {
        // Adjust args if there are dependencies
        deps = callback;
        callback = errback;
        errback = optional;
      } else {
        deps = [];
      }
    }

    if (config && config.context) {
      contextName = config.context;
    }

    context = getOwn(contexts, contextName);
    if (!context) {
      context = contexts[contextName] = req.s.newContext(contextName);
    }

    if (config) {
      context.configure(config);
    }

    return context.require(deps, callback, errback);
  };

  /**
   * Support tvpapp.require.config() to make it easier to cooperate with other
   * AMD loaders on globally agreed names.
   */
  req.config = function (config) {
    return req(config);
  };

  /**
   * Execute something after the current tick
   * of the event loop. Override for other envs
   * that have a better solution than setTimeout.
   * @param  {Function} fn function to execute later.
   */
  req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
    setTimeout(fn, 4);
  } : function (fn) { fn(); };

  /**
   * Export require as a global, but only if it does not already exist.
   */
  if (!require) {
    require = req;
  }

  req.version = version;

  //Used to filter out dependencies that are already paths.
  req.jsExtRegExp = /^\/|:|\?|\.js$/;
  req.isBrowser = isBrowser;
  s = req.s = {
    contexts: contexts,
    newContext: newContext
  };

  //Create default context.
  req({});

  //Exports some context-sensitive methods on global require.
  each([
    'toUrl',
    'undef',
    'defined',
    'specified'
  ], function (prop) {
    //Reference from contexts instead of early binding to default context,
    //so that during builds, the latest instance of the default context
    //with its config gets used.
    req[prop] = function () {
      var ctx = contexts[defContextName];
      return ctx.require[prop].apply(ctx, arguments);
    };
  });

  if (isBrowser) {
    head = s.head = document.getElementsByTagName('head')[0];
    //If BASE tag is in play, using appendChild is a problem for IE6.
    //When that browser dies, this can be removed. Details in this jQuery bug:
    //http://dev.jquery.com/ticket/2709
    baseElement = document.getElementsByTagName('base')[0];
    if (baseElement) {
      head = s.head = baseElement.parentNode;
    }
  }

  /**
   * Any errors that require explicitly generates will be passed to this
   * function. Intercept/override it if you want custom error handling.
   * @param {Error} err the error object.
   */
  req.onError = function (err) {
    throw err;
  };

  /**
   * Does the request to load a module for the browser case.
   * Make this a separate function to allow other environments
   * to override it.
   *
   * @param {Object} context the require context to find state.
   * @param {String} moduleName the name of the module.
   * @param {Object} url the URL to the module.
   */
  req.load = function (context, moduleName, url) {
    var config = (context && context.config) || {},
      node;
    if (isBrowser) {
      //In the browser so use a script tag
      node = config.xhtml ?
        document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
        document.createElement('script');
      node.type = config.scriptType || 'text/javascript';
      node.charset = 'utf-8';
      node.async = true;

      node.setAttribute('data-requirecontext', context.contextName);
      node.setAttribute('data-requiremodule', moduleName);

      //Set up load listener. Test attachEvent first because IE9 has
      //a subtle issue in its addEventListener and script onload firings
      //that do not match the behavior of all other browsers with
      //addEventListener support, which fire the onload event for a
      //script right after the script execution. See:
      //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
      //UNFORTUNATELY Opera implements attachEvent but does not follow the script
      //script execution mode.
      if (node.attachEvent &&
        //Check if node.attachEvent is artificially added by custom script or
        //natively supported by browser
        //read https://github.com/jrburke/requirejs/issues/187
        //if we can NOT find [native code] then it must NOT natively supported.
        //in IE8, node.attachEvent does not have toString()
        //Note the test for "[native code" with no closing brace, see:
        //https://github.com/jrburke/requirejs/issues/273
        !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
        !isOpera) {
        //Probably IE. IE (at least 6-8) do not fire
        //script onload right after executing the script, so
        //we cannot tie the anonymous define call to a name.
        //However, IE reports the script as being in 'interactive'
        //readyState at the time of the define call.
        useInteractive = true;

        node.attachEvent('onreadystatechange', context.onScriptLoad);
        //It would be great to add an error handler here to catch
        //404s in IE9+. However, onreadystatechange will fire before
        //the error handler, so that does not help. If addEventListener
        //is used, then IE will fire error before load, but we cannot
        //use that pathway given the connect.microsoft.com issue
        //mentioned above about not doing the 'script execute,
        //then fire the script load event listener before execute
        //next script' that other browsers do.
        //Best hope: IE10 fixes the issues,
        //and then destroys all installs of IE 6-9.
        //node.attachEvent('onerror', context.onScriptError);
      } else {
        node.addEventListener('load', context.onScriptLoad, false);
        node.addEventListener('error', context.onScriptError, false);
      }
      node.src = url;

      //For some cache cases in IE 6-8, the script executes before the end
      //of the appendChild execution, so to tie an anonymous define
      //call to the module name (which is stored on the node), hold on
      //to a reference to this node, but clear after the DOM insertion.
      currentlyAddingScript = node;
      if (baseElement) {
        head.insertBefore(node, baseElement);
      } else {
        head.appendChild(node);
      }
      currentlyAddingScript = null;

      return node;
    } else if (isWebWorker) {
      try {
        //In a web worker, use importScripts. This is not a very
        //efficient use of importScripts, importScripts will block until
        //its script is downloaded and evaluated. However, if web workers
        //are in play, the expectation that a build has been done so that
        //only one script needs to be loaded anyway. This may need to be
        //reevaluated if other use cases become common.
        importScripts(url);

        //Account for anonymous modules
        context.completeLoad(moduleName);
      } catch (e) {
        context.onError(makeError('importscripts',
          'importScripts failed for ' +
            moduleName + ' at ' + url,
          e,
          [moduleName]));
      }
    }
  };

  function getInteractiveScript() {
    if (interactiveScript && interactiveScript.readyState === 'interactive') {
      return interactiveScript;
    }

    eachReverse(scripts(), function (script) {
      if (script.readyState === 'interactive') {
        return (interactiveScript = script);
      }
    });
    return interactiveScript;
  }

  //Look for a data-main script attribute, which could also adjust the baseUrl.
  if (isBrowser) {
    //Figure out baseUrl. Get it from the script tag with require.js in it.
    eachReverse(scripts(), function (script) {
      //Set the 'head' where we can append children by
      //using the script's parent.
      if (!head) {
        head = script.parentNode;
      }

      //Look for a data-main attribute to set main script for the page
      //to load. If it is there, the path to data main becomes the
      //baseUrl, if it is not already set.
      dataMain = script.getAttribute('data-main');
      if (dataMain) {
        //Set final baseUrl if there is not already an explicit one.
        if (!cfg.baseUrl) {
          //Pull off the directory of data-main for use as the
          //baseUrl.
          src = dataMain.split('/');
          mainScript = src.pop();
          subPath = src.length ? src.join('/')  + '/' : './';

          cfg.baseUrl = subPath;
          dataMain = mainScript;
        }

        //Strip off any trailing .js since dataMain is now
        //like a module name.
        dataMain = dataMain.replace(jsSuffixRegExp, '');

        //Put the data-main script in the files to load.
        cfg.deps = cfg.deps ? cfg.deps.concat(dataMain) : [dataMain];

        return true;
      }
    });
  }

  /**
   * The function that handles definitions of modules. Differs from
   * require() in that a string for the module should be the first argument,
   * and the function to execute after dependencies are loaded should
   * return a value to define the module corresponding to the first argument's
   * name.
   */
  define = function (name, deps, callback) {
    var node, context;

    //Allow for anonymous modules
    if (typeof name !== 'string') {
      //Adjust args appropriately
      callback = deps;
      deps = name;
      name = null;
    }

    //This module may not have dependencies
    if (!isArray(deps)) {
      callback = deps;
      deps = null;
    }

    //If no name, and callback is a function, then figure out if it a
    //CommonJS thing with dependencies.
    if (!deps && isFunction(callback)) {
      deps = [];
      //Remove comments from the callback string,
      //look for require calls, and pull them into the dependencies,
      //but only if there are function args.
      if (callback.length) {
        callback
          .toString()
          .replace(commentRegExp, '')
          .replace(cjsRequireRegExp, function (match, dep) {
            deps.push(dep);
          });

        //May be a CommonJS thing even without require calls, but still
        //could use exports, and module. Avoid doing exports and module
        //work though if it just needs require.
        //REQUIRES the function to expect the CommonJS variables in the
        //order listed below.
        deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
      }
    }

    //If in IE 6-8 and hit an anonymous define() call, do the interactive
    //work.
    if (useInteractive) {
      node = currentlyAddingScript || getInteractiveScript();
      if (node) {
        if (!name) {
          name = node.getAttribute('data-requiremodule');
        }
        context = contexts[node.getAttribute('data-requirecontext')];
      }
    }

    //Always save off evaluating the def call until the script onload handler.
    //This allows multiple modules to be in a file without prematurely
    //tracing dependencies, and allows for anonymous module support,
    //where the module name is not known until the script onload event
    //occurs. If no context, use the global queue, and get it processed
    //in the onscript load callback.
    (context ? context.defQueue : globalDefQueue).push([name, deps, callback]);
  };

  define.amd = {
    jQuery: true
  };


  /**
   * Executes the text. Normally just uses eval, but can be modified
   * to use a better, environment-specific call. Only used for transpiling
   * loader plugins, not for plain JS modules.
   * @param {String} text the text to execute/evaluate.
   */
  req.exec = function (text) {
    /*jslint evil: true */
    return eval(text);
  };

  //Set up with config info.
  req(cfg);
}(this));
tvpapp.requirejs = requirejs;tvpapp.require = require;tvpapp.define = define;
}
}());
tvpapp.define("requireLib", function(){});

/*!
 * jQuery JavaScript Library v1.7.2
 * http://jquery.com/
 *
 * Copyright 2011, John Resig
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * Includes Sizzle.js
 * http://sizzlejs.com/
 * Copyright 2011, The Dojo Foundation
 * Released under the MIT, BSD, and GPL Licenses.
 *
 * Date: Wed Mar 21 12:46:34 2012 -0700
 */
(function( window, undefined ) {

// Use the correct document accordingly with window argument (sandbox)
	var document = window.document,
		navigator = window.navigator,
		location = window.location;
	var jQuery = (function() {

// Define a local copy of jQuery
		var jQuery = function( selector, context ) {
				// The jQuery object is actually just the init constructor 'enhanced'
				return new jQuery.fn.init( selector, context, rootjQuery );
			},

		// Map over jQuery in case of overwrite
			_jQuery = window.jQuery,

		// Map over the $ in case of overwrite
			_$ = window.$,

		// A central reference to the root jQuery(document)
			rootjQuery,

		// A simple way to check for HTML strings or ID strings
		// Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
			quickExpr = /^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/,

		// Check if a string has a non-whitespace character in it
			rnotwhite = /\S/,

		// Used for trimming whitespace
			trimLeft = /^\s+/,
			trimRight = /\s+$/,

		// Match a standalone tag
			rsingleTag = /^<(\w+)\s*\/?>(?:<\/\1>)?$/,

		// JSON RegExp
			rvalidchars = /^[\],:{}\s]*$/,
			rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,
			rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,
			rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g,

		// Useragent RegExp
			rwebkit = /(webkit)[ \/]([\w.]+)/,
			ropera = /(opera)(?:.*version)?[ \/]([\w.]+)/,
			rmsie = /(msie) ([\w.]+)/,
			rmozilla = /(mozilla)(?:.*? rv:([\w.]+))?/,

		// Matches dashed string for camelizing
			rdashAlpha = /-([a-z]|[0-9])/ig,
			rmsPrefix = /^-ms-/,

		// Used by jQuery.camelCase as callback to replace()
			fcamelCase = function( all, letter ) {
				return ( letter + "" ).toUpperCase();
			},

		// Keep a UserAgent string for use with jQuery.browser
			userAgent = navigator.userAgent,

		// For matching the engine and version of the browser
			browserMatch,

		// The deferred used on DOM ready
			readyList,

		// The ready event handler
			DOMContentLoaded,

		// Save a reference to some core methods
			toString = Object.prototype.toString,
			hasOwn = Object.prototype.hasOwnProperty,
			push = Array.prototype.push,
			slice = Array.prototype.slice,
			trim = String.prototype.trim,
			indexOf = Array.prototype.indexOf,

		// [[Class]] -> type pairs
			class2type = {};

		jQuery.fn = jQuery.prototype = {
			constructor: jQuery,
			init: function( selector, context, rootjQuery ) {
				var match, elem, ret, doc;

				// Handle $(""), $(null), or $(undefined)
				if ( !selector ) {
					return this;
				}

				// Handle $(DOMElement)
				if ( selector.nodeType ) {
					this.context = this[0] = selector;
					this.length = 1;
					return this;
				}

				// The body element only exists once, optimize finding it
				if ( selector === "body" && !context && document.body ) {
					this.context = document;
					this[0] = document.body;
					this.selector = selector;
					this.length = 1;
					return this;
				}

				// Handle HTML strings
				if ( typeof selector === "string" ) {
					// Are we dealing with HTML string or an ID?
					if ( selector.charAt(0) === "<" && selector.charAt( selector.length - 1 ) === ">" && selector.length >= 3 ) {
						// Assume that strings that start and end with <> are HTML and skip the regex check
						match = [ null, selector, null ];

					} else {
						match = quickExpr.exec( selector );
					}

					// Verify a match, and that no context was specified for #id
					if ( match && (match[1] || !context) ) {

						// HANDLE: $(html) -> $(array)
						if ( match[1] ) {
							context = context instanceof jQuery ? context[0] : context;
							doc = ( context ? context.ownerDocument || context : document );

							// If a single string is passed in and it's a single tag
							// just do a createElement and skip the rest
							ret = rsingleTag.exec( selector );

							if ( ret ) {
								if ( jQuery.isPlainObject( context ) ) {
									selector = [ document.createElement( ret[1] ) ];
									jQuery.fn.attr.call( selector, context, true );

								} else {
									selector = [ doc.createElement( ret[1] ) ];
								}

							} else {
								ret = jQuery.buildFragment( [ match[1] ], [ doc ] );
								selector = ( ret.cacheable ? jQuery.clone(ret.fragment) : ret.fragment ).childNodes;
							}

							return jQuery.merge( this, selector );

							// HANDLE: $("#id")
						} else {
							elem = document.getElementById( match[2] );

							// Check parentNode to catch when Blackberry 4.6 returns
							// nodes that are no longer in the document #6963
							if ( elem && elem.parentNode ) {
								// Handle the case where IE and Opera return items
								// by name instead of ID
								if ( elem.id !== match[2] ) {
									return rootjQuery.find( selector );
								}

								// Otherwise, we inject the element directly into the jQuery object
								this.length = 1;
								this[0] = elem;
							}

							this.context = document;
							this.selector = selector;
							return this;
						}

						// HANDLE: $(expr, $(...))
					} else if ( !context || context.jquery ) {
						return ( context || rootjQuery ).find( selector );

						// HANDLE: $(expr, context)
						// (which is just equivalent to: $(context).find(expr)
					} else {
						return this.constructor( context ).find( selector );
					}

					// HANDLE: $(function)
					// Shortcut for document ready
				} else if ( jQuery.isFunction( selector ) ) {
					return rootjQuery.ready( selector );
				}

				if ( selector.selector !== undefined ) {
					this.selector = selector.selector;
					this.context = selector.context;
				}

				return jQuery.makeArray( selector, this );
			},

			// Start with an empty selector
			selector: "",

			// The current version of jQuery being used
			jquery: "1.7.2",

			// The default length of a jQuery object is 0
			length: 0,

			// The number of elements contained in the matched element set
			size: function() {
				return this.length;
			},

			toArray: function() {
				return slice.call( this, 0 );
			},

			// Get the Nth element in the matched element set OR
			// Get the whole matched element set as a clean array
			get: function( num ) {
				return num == null ?

					// Return a 'clean' array
					this.toArray() :

					// Return just the object
					( num < 0 ? this[ this.length + num ] : this[ num ] );
			},

			// Take an array of elements and push it onto the stack
			// (returning the new matched element set)
			pushStack: function( elems, name, selector ) {
				// Build a new jQuery matched element set
				var ret = this.constructor();

				if ( jQuery.isArray( elems ) ) {
					push.apply( ret, elems );

				} else {
					jQuery.merge( ret, elems );
				}

				// Add the old object onto the stack (as a reference)
				ret.prevObject = this;

				ret.context = this.context;

				if ( name === "find" ) {
					ret.selector = this.selector + ( this.selector ? " " : "" ) + selector;
				} else if ( name ) {
					ret.selector = this.selector + "." + name + "(" + selector + ")";
				}

				// Return the newly-formed element set
				return ret;
			},

			// Execute a callback for every element in the matched set.
			// (You can seed the arguments with an array of args, but this is
			// only used internally.)
			each: function( callback, args ) {
				return jQuery.each( this, callback, args );
			},

			ready: function( fn ) {
				// Attach the listeners
				jQuery.bindReady();

				// Add the callback
				readyList.add( fn );

				return this;
			},

			eq: function( i ) {
				i = +i;
				return i === -1 ?
					this.slice( i ) :
					this.slice( i, i + 1 );
			},

			first: function() {
				return this.eq( 0 );
			},

			last: function() {
				return this.eq( -1 );
			},

			slice: function() {
				return this.pushStack( slice.apply( this, arguments ),
					"slice", slice.call(arguments).join(",") );
			},

			map: function( callback ) {
				return this.pushStack( jQuery.map(this, function( elem, i ) {
					return callback.call( elem, i, elem );
				}));
			},

			end: function() {
				return this.prevObject || this.constructor(null);
			},

			// For internal use only.
			// Behaves like an Array's method, not like a jQuery method.
			push: push,
			sort: [].sort,
			splice: [].splice
		};

// Give the init function the jQuery prototype for later instantiation
		jQuery.fn.init.prototype = jQuery.fn;

		jQuery.extend = jQuery.fn.extend = function() {
			var options, name, src, copy, copyIsArray, clone,
				target = arguments[0] || {},
				i = 1,
				length = arguments.length,
				deep = false;

			// Handle a deep copy situation
			if ( typeof target === "boolean" ) {
				deep = target;
				target = arguments[1] || {};
				// skip the boolean and the target
				i = 2;
			}

			// Handle case when target is a string or something (possible in deep copy)
			if ( typeof target !== "object" && !jQuery.isFunction(target) ) {
				target = {};
			}

			// extend jQuery itself if only one argument is passed
			if ( length === i ) {
				target = this;
				--i;
			}

			for ( ; i < length; i++ ) {
				// Only deal with non-null/undefined values
				if ( (options = arguments[ i ]) != null ) {
					// Extend the base object
					for ( name in options ) {
						src = target[ name ];
						copy = options[ name ];

						// Prevent never-ending loop
						if ( target === copy ) {
							continue;
						}

						// Recurse if we're merging plain objects or arrays
						if ( deep && copy && ( jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)) ) ) {
							if ( copyIsArray ) {
								copyIsArray = false;
								clone = src && jQuery.isArray(src) ? src : [];

							} else {
								clone = src && jQuery.isPlainObject(src) ? src : {};
							}

							// Never move original objects, clone them
							target[ name ] = jQuery.extend( deep, clone, copy );

							// Don't bring in undefined values
						} else if ( copy !== undefined ) {
							target[ name ] = copy;
						}
					}
				}
			}

			// Return the modified object
			return target;
		};

		jQuery.extend({
			noConflict: function( deep ) {
				if ( window.$ === jQuery ) {
					window.$ = _$;
				}

				if ( deep && window.jQuery === jQuery ) {
					window.jQuery = _jQuery;
				}

				return jQuery;
			},

			// Is the DOM ready to be used? Set to true once it occurs.
			isReady: false,

			// A counter to track how many items to wait for before
			// the ready event fires. See #6781
			readyWait: 1,

			// Hold (or release) the ready event
			holdReady: function( hold ) {
				if ( hold ) {
					jQuery.readyWait++;
				} else {
					jQuery.ready( true );
				}
			},

			// Handle when the DOM is ready
			ready: function( wait ) {
				// Either a released hold or an DOMready/load event and not yet ready
				if ( (wait === true && !--jQuery.readyWait) || (wait !== true && !jQuery.isReady) ) {
					// Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
					if ( !document.body ) {
						return setTimeout( jQuery.ready, 1 );
					}

					// Remember that the DOM is ready
					jQuery.isReady = true;

					// If a normal DOM Ready event fired, decrement, and wait if need be
					if ( wait !== true && --jQuery.readyWait > 0 ) {
						return;
					}

					// If there are functions bound, to execute
					readyList.fireWith( document, [ jQuery ] );

					// Trigger any bound ready events
					if ( jQuery.fn.trigger ) {
						jQuery( document ).trigger( "ready" ).off( "ready" );
					}
				}
			},

			bindReady: function() {
				if ( readyList ) {
					return;
				}

				readyList = jQuery.Callbacks( "once memory" );

				// Catch cases where $(document).ready() is called after the
				// browser event has already occurred.
				if ( document.readyState === "complete" ) {
					// Handle it asynchronously to allow scripts the opportunity to delay ready
					return setTimeout( jQuery.ready, 1 );
				}

				// Mozilla, Opera and webkit nightlies currently support this event
				if ( document.addEventListener ) {
					// Use the handy event callback
					document.addEventListener( "DOMContentLoaded", DOMContentLoaded, false );

					// A fallback to window.onload, that will always work
					window.addEventListener( "load", jQuery.ready, false );

					// If IE event model is used
				} else if ( document.attachEvent ) {
					// ensure firing before onload,
					// maybe late but safe also for iframes
					document.attachEvent( "onreadystatechange", DOMContentLoaded );

					// A fallback to window.onload, that will always work
					window.attachEvent( "onload", jQuery.ready );

					// If IE and not a frame
					// continually check to see if the document is ready
					var toplevel = false;

					try {
						toplevel = window.frameElement == null;
					} catch(e) {}

					if ( document.documentElement.doScroll && toplevel ) {
						doScrollCheck();
					}
				}
			},

			// See test/unit/core.js for details concerning isFunction.
			// Since version 1.3, DOM methods and functions like alert
			// aren't supported. They return false on IE (#2968).
			isFunction: function( obj ) {
				return jQuery.type(obj) === "function";
			},

			isArray: Array.isArray || function( obj ) {
				return jQuery.type(obj) === "array";
			},

			isWindow: function( obj ) {
				return obj != null && obj == obj.window;
			},

			isNumeric: function( obj ) {
				return !isNaN( parseFloat(obj) ) && isFinite( obj );
			},

			type: function( obj ) {
				return obj == null ?
					String( obj ) :
					class2type[ toString.call(obj) ] || "object";
			},

			isPlainObject: function( obj ) {
				// Must be an Object.
				// Because of IE, we also have to check the presence of the constructor property.
				// Make sure that DOM nodes and window objects don't pass through, as well
				if ( !obj || jQuery.type(obj) !== "object" || obj.nodeType || jQuery.isWindow( obj ) ) {
					return false;
				}

				try {
					// Not own constructor property must be Object
					if ( obj.constructor &&
						!hasOwn.call(obj, "constructor") &&
						!hasOwn.call(obj.constructor.prototype, "isPrototypeOf") ) {
						return false;
					}
				} catch ( e ) {
					// IE8,9 Will throw exceptions on certain host objects #9897
					return false;
				}

				// Own properties are enumerated firstly, so to speed up,
				// if last one is own, then all properties are own.

				var key;
				for ( key in obj ) {}

				return key === undefined || hasOwn.call( obj, key );
			},

			isEmptyObject: function( obj ) {
				for ( var name in obj ) {
					return false;
				}
				return true;
			},

			error: function( msg ) {
				throw new Error( msg );
			},

			parseJSON: function( data ) {
				if ( typeof data !== "string" || !data ) {
					return null;
				}

				// Make sure leading/trailing whitespace is removed (IE can't handle it)
				data = jQuery.trim( data );

				// Attempt to parse using the native JSON parser first
				if ( window.JSON && window.JSON.parse ) {
					return window.JSON.parse( data );
				}

				// Make sure the incoming data is actual JSON
				// Logic borrowed from http://json.org/json2.js
				if ( rvalidchars.test( data.replace( rvalidescape, "@" )
					.replace( rvalidtokens, "]" )
					.replace( rvalidbraces, "")) ) {

					return ( new Function( "return " + data ) )();

				}
				jQuery.error( "Invalid JSON: " + data );
			},

			// Cross-browser xml parsing
			parseXML: function( data ) {
				if ( typeof data !== "string" || !data ) {
					return null;
				}
				var xml, tmp;
				try {
					if ( window.DOMParser ) { // Standard
						tmp = new DOMParser();
						xml = tmp.parseFromString( data , "text/xml" );
					} else { // IE
						xml = new ActiveXObject( "Microsoft.XMLDOM" );
						xml.async = "false";
						xml.loadXML( data );
					}
				} catch( e ) {
					xml = undefined;
				}
				if ( !xml || !xml.documentElement || xml.getElementsByTagName( "parsererror" ).length ) {
					jQuery.error( "Invalid XML: " + data );
				}
				return xml;
			},

			noop: function() {},

			// Evaluates a script in a global context
			// Workarounds based on findings by Jim Driscoll
			// http://weblogs.java.net/blog/driscoll/archive/2009/09/08/eval-javascript-global-context
			globalEval: function( data ) {
				if ( data && rnotwhite.test( data ) ) {
					// We use execScript on Internet Explorer
					// We use an anonymous function so that context is window
					// rather than jQuery in Firefox
					( window.execScript || function( data ) {
						window[ "eval" ].call( window, data );
					} )( data );
				}
			},

			// Convert dashed to camelCase; used by the css and data modules
			// Microsoft forgot to hump their vendor prefix (#9572)
			camelCase: function( string ) {
				return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
			},

			nodeName: function( elem, name ) {
				return elem.nodeName && elem.nodeName.toUpperCase() === name.toUpperCase();
			},

			// args is for internal usage only
			each: function( object, callback, args ) {
				var name, i = 0,
					length = object.length,
					isObj = length === undefined || jQuery.isFunction( object );

				if ( args ) {
					if ( isObj ) {
						for ( name in object ) {
							if ( callback.apply( object[ name ], args ) === false ) {
								break;
							}
						}
					} else {
						for ( ; i < length; ) {
							if ( callback.apply( object[ i++ ], args ) === false ) {
								break;
							}
						}
					}

					// A special, fast, case for the most common use of each
				} else {
					if ( isObj ) {
						for ( name in object ) {
							if ( callback.call( object[ name ], name, object[ name ] ) === false ) {
								break;
							}
						}
					} else {
						for ( ; i < length; ) {
							if ( callback.call( object[ i ], i, object[ i++ ] ) === false ) {
								break;
							}
						}
					}
				}

				return object;
			},

			// Use native String.trim function wherever possible
			trim: trim ?
				function( text ) {
					return text == null ?
						"" :
						trim.call( text );
				} :

				// Otherwise use our own trimming functionality
				function( text ) {
					return text == null ?
						"" :
						text.toString().replace( trimLeft, "" ).replace( trimRight, "" );
				},

			// results is for internal usage only
			makeArray: function( array, results ) {
				var ret = results || [];

				if ( array != null ) {
					// The window, strings (and functions) also have 'length'
					// Tweaked logic slightly to handle Blackberry 4.7 RegExp issues #6930
					var type = jQuery.type( array );

					if ( array.length == null || type === "string" || type === "function" || type === "regexp" || jQuery.isWindow( array ) ) {
						push.call( ret, array );
					} else {
						jQuery.merge( ret, array );
					}
				}

				return ret;
			},

			inArray: function( elem, array, i ) {
				var len;

				if ( array ) {
					if ( indexOf ) {
						return indexOf.call( array, elem, i );
					}

					len = array.length;
					i = i ? i < 0 ? Math.max( 0, len + i ) : i : 0;

					for ( ; i < len; i++ ) {
						// Skip accessing in sparse arrays
						if ( i in array && array[ i ] === elem ) {
							return i;
						}
					}
				}

				return -1;
			},

			merge: function( first, second ) {
				var i = first.length,
					j = 0;

				if ( typeof second.length === "number" ) {
					for ( var l = second.length; j < l; j++ ) {
						first[ i++ ] = second[ j ];
					}

				} else {
					while ( second[j] !== undefined ) {
						first[ i++ ] = second[ j++ ];
					}
				}

				first.length = i;

				return first;
			},

			grep: function( elems, callback, inv ) {
				var ret = [], retVal;
				inv = !!inv;

				// Go through the array, only saving the items
				// that pass the validator function
				for ( var i = 0, length = elems.length; i < length; i++ ) {
					retVal = !!callback( elems[ i ], i );
					if ( inv !== retVal ) {
						ret.push( elems[ i ] );
					}
				}

				return ret;
			},

			// arg is for internal usage only
			map: function( elems, callback, arg ) {
				var value, key, ret = [],
					i = 0,
					length = elems.length,
				// jquery objects are treated as arrays
					isArray = elems instanceof jQuery || length !== undefined && typeof length === "number" && ( ( length > 0 && elems[ 0 ] && elems[ length -1 ] ) || length === 0 || jQuery.isArray( elems ) ) ;

				// Go through the array, translating each of the items to their
				if ( isArray ) {
					for ( ; i < length; i++ ) {
						value = callback( elems[ i ], i, arg );

						if ( value != null ) {
							ret[ ret.length ] = value;
						}
					}

					// Go through every key on the object,
				} else {
					for ( key in elems ) {
						value = callback( elems[ key ], key, arg );

						if ( value != null ) {
							ret[ ret.length ] = value;
						}
					}
				}

				// Flatten any nested arrays
				return ret.concat.apply( [], ret );
			},

			// A global GUID counter for objects
			guid: 1,

			// Bind a function to a context, optionally partially applying any
			// arguments.
			proxy: function( fn, context ) {
				if ( typeof context === "string" ) {
					var tmp = fn[ context ];
					context = fn;
					fn = tmp;
				}

				// Quick check to determine if target is callable, in the spec
				// this throws a TypeError, but we will just return undefined.
				if ( !jQuery.isFunction( fn ) ) {
					return undefined;
				}

				// Simulated bind
				var args = slice.call( arguments, 2 ),
					proxy = function() {
						return fn.apply( context, args.concat( slice.call( arguments ) ) );
					};

				// Set the guid of unique handler to the same of original handler, so it can be removed
				proxy.guid = fn.guid = fn.guid || proxy.guid || jQuery.guid++;

				return proxy;
			},

			// Mutifunctional method to get and set values to a collection
			// The value/s can optionally be executed if it's a function
			access: function( elems, fn, key, value, chainable, emptyGet, pass ) {
				var exec,
					bulk = key == null,
					i = 0,
					length = elems.length;

				// Sets many values
				if ( key && typeof key === "object" ) {
					for ( i in key ) {
						jQuery.access( elems, fn, i, key[i], 1, emptyGet, value );
					}
					chainable = 1;

					// Sets one value
				} else if ( value !== undefined ) {
					// Optionally, function values get executed if exec is true
					exec = pass === undefined && jQuery.isFunction( value );

					if ( bulk ) {
						// Bulk operations only iterate when executing function values
						if ( exec ) {
							exec = fn;
							fn = function( elem, key, value ) {
								return exec.call( jQuery( elem ), value );
							};

							// Otherwise they run against the entire set
						} else {
							fn.call( elems, value );
							fn = null;
						}
					}

					if ( fn ) {
						for (; i < length; i++ ) {
							fn( elems[i], key, exec ? value.call( elems[i], i, fn( elems[i], key ) ) : value, pass );
						}
					}

					chainable = 1;
				}

				return chainable ?
					elems :

					// Gets
					bulk ?
						fn.call( elems ) :
						length ? fn( elems[0], key ) : emptyGet;
			},

			now: function() {
				return ( new Date() ).getTime();
			},

			// Use of jQuery.browser is frowned upon.
			// More details: http://docs.jquery.com/Utilities/jQuery.browser
			uaMatch: function( ua ) {
				ua = ua.toLowerCase();

				var match = rwebkit.exec( ua ) ||
					ropera.exec( ua ) ||
					rmsie.exec( ua ) ||
					ua.indexOf("compatible") < 0 && rmozilla.exec( ua ) ||
					[];

				return { browser: match[1] || "", version: match[2] || "0" };
			},

			sub: function() {
				function jQuerySub( selector, context ) {
					return new jQuerySub.fn.init( selector, context );
				}
				jQuery.extend( true, jQuerySub, this );
				jQuerySub.superclass = this;
				jQuerySub.fn = jQuerySub.prototype = this();
				jQuerySub.fn.constructor = jQuerySub;
				jQuerySub.sub = this.sub;
				jQuerySub.fn.init = function init( selector, context ) {
					if ( context && context instanceof jQuery && !(context instanceof jQuerySub) ) {
						context = jQuerySub( context );
					}

					return jQuery.fn.init.call( this, selector, context, rootjQuerySub );
				};
				jQuerySub.fn.init.prototype = jQuerySub.fn;
				var rootjQuerySub = jQuerySub(document);
				return jQuerySub;
			},

			browser: {}
		});

// Populate the class2type map
		jQuery.each("Boolean Number String Function Array Date RegExp Object".split(" "), function(i, name) {
			class2type[ "[object " + name + "]" ] = name.toLowerCase();
		});

		browserMatch = jQuery.uaMatch( userAgent );
		if ( browserMatch.browser ) {
			jQuery.browser[ browserMatch.browser ] = true;
			jQuery.browser.version = browserMatch.version;
		}

// Deprecated, use jQuery.browser.webkit instead
		if ( jQuery.browser.webkit ) {
			jQuery.browser.safari = true;
		}

// IE doesn't match non-breaking spaces with \s
		if ( rnotwhite.test( "\xA0" ) ) {
			trimLeft = /^[\s\xA0]+/;
			trimRight = /[\s\xA0]+$/;
		}

// All jQuery objects should point back to these
		rootjQuery = jQuery(document);

// Cleanup functions for the document ready method
		if ( document.addEventListener ) {
			DOMContentLoaded = function() {
				document.removeEventListener( "DOMContentLoaded", DOMContentLoaded, false );
				jQuery.ready();
			};

		} else if ( document.attachEvent ) {
			DOMContentLoaded = function() {
				// Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
				if ( document.readyState === "complete" ) {
					document.detachEvent( "onreadystatechange", DOMContentLoaded );
					jQuery.ready();
				}
			};
		}

// The DOM ready check for Internet Explorer
		function doScrollCheck() {
			if ( jQuery.isReady ) {
				return;
			}

			try {
				// If IE is used, use the trick by Diego Perini
				// http://javascript.nwbox.com/IEContentLoaded/
				document.documentElement.doScroll("left");
			} catch(e) {
				setTimeout( doScrollCheck, 1 );
				return;
			}

			// and execute any waiting functions
			jQuery.ready();
		}

		return jQuery;

	})();


// String to Object flags format cache
	var flagsCache = {};

// Convert String-formatted flags into Object-formatted ones and store in cache
	function createFlags( flags ) {
		var object = flagsCache[ flags ] = {},
			i, length;
		flags = flags.split( /\s+/ );
		for ( i = 0, length = flags.length; i < length; i++ ) {
			object[ flags[i] ] = true;
		}
		return object;
	}

	/*
	 * Create a callback list using the following parameters:
	 *
	 *	flags:	an optional list of space-separated flags that will change how
	 *			the callback list behaves
	 *
	 * By default a callback list will act like an event callback list and can be
	 * "fired" multiple times.
	 *
	 * Possible flags:
	 *
	 *	once:			will ensure the callback list can only be fired once (like a Deferred)
	 *
	 *	memory:			will keep track of previous values and will call any callback added
	 *					after the list has been fired right away with the latest "memorized"
	 *					values (like a Deferred)
	 *
	 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
	 *
	 *	stopOnFalse:	interrupt callings when a callback returns false
	 *
	 */
	jQuery.Callbacks = function( flags ) {

		// Convert flags from String-formatted to Object-formatted
		// (we check in cache first)
		flags = flags ? ( flagsCache[ flags ] || createFlags( flags ) ) : {};

		var // Actual callback list
			list = [],
		// Stack of fire calls for repeatable lists
			stack = [],
		// Last fire value (for non-forgettable lists)
			memory,
		// Flag to know if list was already fired
			fired,
		// Flag to know if list is currently firing
			firing,
		// First callback to fire (used internally by add and fireWith)
			firingStart,
		// End of the loop when firing
			firingLength,
		// Index of currently firing callback (modified by remove if needed)
			firingIndex,
		// Add one or several callbacks to the list
			add = function( args ) {
				var i,
					length,
					elem,
					type,
					actual;
				for ( i = 0, length = args.length; i < length; i++ ) {
					elem = args[ i ];
					type = jQuery.type( elem );
					if ( type === "array" ) {
						// Inspect recursively
						add( elem );
					} else if ( type === "function" ) {
						// Add if not in unique mode and callback is not in
						if ( !flags.unique || !self.has( elem ) ) {
							list.push( elem );
						}
					}
				}
			},
		// Fire callbacks
			fire = function( context, args ) {
				args = args || [];
				memory = !flags.memory || [ context, args ];
				fired = true;
				firing = true;
				firingIndex = firingStart || 0;
				firingStart = 0;
				firingLength = list.length;
				for ( ; list && firingIndex < firingLength; firingIndex++ ) {
					if ( list[ firingIndex ].apply( context, args ) === false && flags.stopOnFalse ) {
						memory = true; // Mark as halted
						break;
					}
				}
				firing = false;
				if ( list ) {
					if ( !flags.once ) {
						if ( stack && stack.length ) {
							memory = stack.shift();
							self.fireWith( memory[ 0 ], memory[ 1 ] );
						}
					} else if ( memory === true ) {
						self.disable();
					} else {
						list = [];
					}
				}
			},
		// Actual Callbacks object
			self = {
				// Add a callback or a collection of callbacks to the list
				add: function() {
					if ( list ) {
						var length = list.length;
						add( arguments );
						// Do we need to add the callbacks to the
						// current firing batch?
						if ( firing ) {
							firingLength = list.length;
							// With memory, if we're not firing then
							// we should call right away, unless previous
							// firing was halted (stopOnFalse)
						} else if ( memory && memory !== true ) {
							firingStart = length;
							fire( memory[ 0 ], memory[ 1 ] );
						}
					}
					return this;
				},
				// Remove a callback from the list
				remove: function() {
					if ( list ) {
						var args = arguments,
							argIndex = 0,
							argLength = args.length;
						for ( ; argIndex < argLength ; argIndex++ ) {
							for ( var i = 0; i < list.length; i++ ) {
								if ( args[ argIndex ] === list[ i ] ) {
									// Handle firingIndex and firingLength
									if ( firing ) {
										if ( i <= firingLength ) {
											firingLength--;
											if ( i <= firingIndex ) {
												firingIndex--;
											}
										}
									}
									// Remove the element
									list.splice( i--, 1 );
									// If we have some unicity property then
									// we only need to do this once
									if ( flags.unique ) {
										break;
									}
								}
							}
						}
					}
					return this;
				},
				// Control if a given callback is in the list
				has: function( fn ) {
					if ( list ) {
						var i = 0,
							length = list.length;
						for ( ; i < length; i++ ) {
							if ( fn === list[ i ] ) {
								return true;
							}
						}
					}
					return false;
				},
				// Remove all callbacks from the list
				empty: function() {
					list = [];
					return this;
				},
				// Have the list do nothing anymore
				disable: function() {
					list = stack = memory = undefined;
					return this;
				},
				// Is it disabled?
				disabled: function() {
					return !list;
				},
				// Lock the list in its current state
				lock: function() {
					stack = undefined;
					if ( !memory || memory === true ) {
						self.disable();
					}
					return this;
				},
				// Is it locked?
				locked: function() {
					return !stack;
				},
				// Call all callbacks with the given context and arguments
				fireWith: function( context, args ) {
					if ( stack ) {
						if ( firing ) {
							if ( !flags.once ) {
								stack.push( [ context, args ] );
							}
						} else if ( !( flags.once && memory ) ) {
							fire( context, args );
						}
					}
					return this;
				},
				// Call all the callbacks with the given arguments
				fire: function() {
					self.fireWith( this, arguments );
					return this;
				},
				// To know if the callbacks have already been called at least once
				fired: function() {
					return !!fired;
				}
			};

		return self;
	};




	var // Static reference to slice
		sliceDeferred = [].slice;

	jQuery.extend({

		Deferred: function( func ) {
			var doneList = jQuery.Callbacks( "once memory" ),
				failList = jQuery.Callbacks( "once memory" ),
				progressList = jQuery.Callbacks( "memory" ),
				state = "pending",
				lists = {
					resolve: doneList,
					reject: failList,
					notify: progressList
				},
				promise = {
					done: doneList.add,
					fail: failList.add,
					progress: progressList.add,

					state: function() {
						return state;
					},

					// Deprecated
					isResolved: doneList.fired,
					isRejected: failList.fired,

					then: function( doneCallbacks, failCallbacks, progressCallbacks ) {
						deferred.done( doneCallbacks ).fail( failCallbacks ).progress( progressCallbacks );
						return this;
					},
					always: function() {
						deferred.done.apply( deferred, arguments ).fail.apply( deferred, arguments );
						return this;
					},
					pipe: function( fnDone, fnFail, fnProgress ) {
						return jQuery.Deferred(function( newDefer ) {
							jQuery.each( {
								done: [ fnDone, "resolve" ],
								fail: [ fnFail, "reject" ],
								progress: [ fnProgress, "notify" ]
							}, function( handler, data ) {
								var fn = data[ 0 ],
									action = data[ 1 ],
									returned;
								if ( jQuery.isFunction( fn ) ) {
									deferred[ handler ](function() {
										returned = fn.apply( this, arguments );
										if ( returned && jQuery.isFunction( returned.promise ) ) {
											returned.promise().then( newDefer.resolve, newDefer.reject, newDefer.notify );
										} else {
											newDefer[ action + "With" ]( this === deferred ? newDefer : this, [ returned ] );
										}
									});
								} else {
									deferred[ handler ]( newDefer[ action ] );
								}
							});
						}).promise();
					},
					// Get a promise for this deferred
					// If obj is provided, the promise aspect is added to the object
					promise: function( obj ) {
						if ( obj == null ) {
							obj = promise;
						} else {
							for ( var key in promise ) {
								obj[ key ] = promise[ key ];
							}
						}
						return obj;
					}
				},
				deferred = promise.promise({}),
				key;

			for ( key in lists ) {
				deferred[ key ] = lists[ key ].fire;
				deferred[ key + "With" ] = lists[ key ].fireWith;
			}

			// Handle state
			deferred.done( function() {
				state = "resolved";
			}, failList.disable, progressList.lock ).fail( function() {
					state = "rejected";
				}, doneList.disable, progressList.lock );

			// Call given func if any
			if ( func ) {
				func.call( deferred, deferred );
			}

			// All done!
			return deferred;
		},

		// Deferred helper
		when: function( firstParam ) {
			var args = sliceDeferred.call( arguments, 0 ),
				i = 0,
				length = args.length,
				pValues = new Array( length ),
				count = length,
				pCount = length,
				deferred = length <= 1 && firstParam && jQuery.isFunction( firstParam.promise ) ?
					firstParam :
					jQuery.Deferred(),
				promise = deferred.promise();
			function resolveFunc( i ) {
				return function( value ) {
					args[ i ] = arguments.length > 1 ? sliceDeferred.call( arguments, 0 ) : value;
					if ( !( --count ) ) {
						deferred.resolveWith( deferred, args );
					}
				};
			}
			function progressFunc( i ) {
				return function( value ) {
					pValues[ i ] = arguments.length > 1 ? sliceDeferred.call( arguments, 0 ) : value;
					deferred.notifyWith( promise, pValues );
				};
			}
			if ( length > 1 ) {
				for ( ; i < length; i++ ) {
					if ( args[ i ] && args[ i ].promise && jQuery.isFunction( args[ i ].promise ) ) {
						args[ i ].promise().then( resolveFunc(i), deferred.reject, progressFunc(i) );
					} else {
						--count;
					}
				}
				if ( !count ) {
					deferred.resolveWith( deferred, args );
				}
			} else if ( deferred !== firstParam ) {
				deferred.resolveWith( deferred, length ? [ firstParam ] : [] );
			}
			return promise;
		}
	});




	jQuery.support = (function() {

		var support,
			all,
			a,
			select,
			opt,
			input,
			fragment,
			tds,
			events,
			eventName,
			i,
			isSupported,
			div = document.createElement( "div" ),
			documentElement = document.documentElement;

		// Preliminary tests
		div.setAttribute("className", "t");
		div.innerHTML = "   <link/><table></table><a href='/a' style='top:1px;float:left;opacity:.55;'>a</a><input type='checkbox'/>";

		all = div.getElementsByTagName( "*" );
		a = div.getElementsByTagName( "a" )[ 0 ];

		// Can't get basic test support
		if ( !all || !all.length || !a ) {
			return {};
		}

		// First batch of supports tests
		select = document.createElement( "select" );
		opt = select.appendChild( document.createElement("option") );
		input = div.getElementsByTagName( "input" )[ 0 ];

		support = {
			// IE strips leading whitespace when .innerHTML is used
			leadingWhitespace: ( div.firstChild.nodeType === 3 ),

			// Make sure that tbody elements aren't automatically inserted
			// IE will insert them into empty tables
			tbody: !div.getElementsByTagName("tbody").length,

			// Make sure that link elements get serialized correctly by innerHTML
			// This requires a wrapper element in IE
			htmlSerialize: !!div.getElementsByTagName("link").length,

			// Get the style information from getAttribute
			// (IE uses .cssText instead)
			style: /top/.test( a.getAttribute("style") ),

			// Make sure that URLs aren't manipulated
			// (IE normalizes it by default)
			hrefNormalized: ( a.getAttribute("href") === "/a" ),

			// Make sure that element opacity exists
			// (IE uses filter instead)
			// Use a regex to work around a WebKit issue. See #5145
			opacity: /^0.55/.test( a.style.opacity ),

			// Verify style float existence
			// (IE uses styleFloat instead of cssFloat)
			cssFloat: !!a.style.cssFloat,

			// Make sure that if no value is specified for a checkbox
			// that it defaults to "on".
			// (WebKit defaults to "" instead)
			checkOn: ( input.value === "on" ),

			// Make sure that a selected-by-default option has a working selected property.
			// (WebKit defaults to false instead of true, IE too, if it's in an optgroup)
			optSelected: opt.selected,

			// Test setAttribute on camelCase class. If it works, we need attrFixes when doing get/setAttribute (ie6/7)
			getSetAttribute: div.className !== "t",

			// Tests for enctype support on a form(#6743)
			enctype: !!document.createElement("form").enctype,

			// Makes sure cloning an html5 element does not cause problems
			// Where outerHTML is undefined, this still works
			html5Clone: document.createElement("nav").cloneNode( true ).outerHTML !== "<:nav></:nav>",

			// Will be defined later
			submitBubbles: true,
			changeBubbles: true,
			focusinBubbles: false,
			deleteExpando: true,
			noCloneEvent: true,
			inlineBlockNeedsLayout: false,
			shrinkWrapBlocks: false,
			reliableMarginRight: true,
			pixelMargin: true
		};

		// jQuery.boxModel DEPRECATED in 1.3, use jQuery.support.boxModel instead
		jQuery.boxModel = support.boxModel = (document.compatMode === "CSS1Compat");

		// Make sure checked status is properly cloned
		input.checked = true;
		support.noCloneChecked = input.cloneNode( true ).checked;

		// Make sure that the options inside disabled selects aren't marked as disabled
		// (WebKit marks them as disabled)
		select.disabled = true;
		support.optDisabled = !opt.disabled;

		// Test to see if it's possible to delete an expando from an element
		// Fails in Internet Explorer
		try {
			delete div.test;
		} catch( e ) {
			support.deleteExpando = false;
		}

		if ( !div.addEventListener && div.attachEvent && div.fireEvent ) {
			div.attachEvent( "onclick", function() {
				// Cloning a node shouldn't copy over any
				// bound event handlers (IE does this)
				support.noCloneEvent = false;
			});
			div.cloneNode( true ).fireEvent( "onclick" );
		}

		// Check if a radio maintains its value
		// after being appended to the DOM
		input = document.createElement("input");
		input.value = "t";
		input.setAttribute("type", "radio");
		support.radioValue = input.value === "t";

		input.setAttribute("checked", "checked");

		// #11217 - WebKit loses check when the name is after the checked attribute
		input.setAttribute( "name", "t" );

		div.appendChild( input );
		fragment = document.createDocumentFragment();
		fragment.appendChild( div.lastChild );

		// WebKit doesn't clone checked state correctly in fragments
		support.checkClone = fragment.cloneNode( true ).cloneNode( true ).lastChild.checked;

		// Check if a disconnected checkbox will retain its checked
		// value of true after appended to the DOM (IE6/7)
		support.appendChecked = input.checked;

		fragment.removeChild( input );
		fragment.appendChild( div );

		// Technique from Juriy Zaytsev
		// http://perfectionkills.com/detecting-event-support-without-browser-sniffing/
		// We only care about the case where non-standard event systems
		// are used, namely in IE. Short-circuiting here helps us to
		// avoid an eval call (in setAttribute) which can cause CSP
		// to go haywire. See: https://developer.mozilla.org/en/Security/CSP
		if ( div.attachEvent ) {
			for ( i in {
				submit: 1,
				change: 1,
				focusin: 1
			}) {
				eventName = "on" + i;
				isSupported = ( eventName in div );
				if ( !isSupported ) {
					div.setAttribute( eventName, "return;" );
					isSupported = ( typeof div[ eventName ] === "function" );
				}
				support[ i + "Bubbles" ] = isSupported;
			}
		}

		fragment.removeChild( div );

		// Null elements to avoid leaks in IE
		fragment = select = opt = div = input = null;

		// Run tests that need a body at doc ready
		jQuery(function() {
			var container, outer, inner, table, td, offsetSupport,
				marginDiv, conMarginTop, style, html, positionTopLeftWidthHeight,
				paddingMarginBorderVisibility, paddingMarginBorder,
				body = document.getElementsByTagName("body")[0];

			if ( !body ) {
				// Return for frameset docs that don't have a body
				return;
			}

			conMarginTop = 1;
			paddingMarginBorder = "padding:0;margin:0;border:";
			positionTopLeftWidthHeight = "position:absolute;top:0;left:0;width:1px;height:1px;";
			paddingMarginBorderVisibility = paddingMarginBorder + "0;visibility:hidden;";
			style = "style='" + positionTopLeftWidthHeight + paddingMarginBorder + "5px solid #000;";
			html = "<div " + style + "display:block;'><div style='" + paddingMarginBorder + "0;display:block;overflow:hidden;'></div></div>" +
				"<table " + style + "' cellpadding='0' cellspacing='0'>" +
				"<tr><td></td></tr></table>";

			container = document.createElement("div");
			container.style.cssText = paddingMarginBorderVisibility + "width:0;height:0;position:static;top:0;margin-top:" + conMarginTop + "px";
			body.insertBefore( container, body.firstChild );

			// Construct the test element
			div = document.createElement("div");
			container.appendChild( div );

			// Check if table cells still have offsetWidth/Height when they are set
			// to display:none and there are still other visible table cells in a
			// table row; if so, offsetWidth/Height are not reliable for use when
			// determining if an element has been hidden directly using
			// display:none (it is still safe to use offsets if a parent element is
			// hidden; don safety goggles and see bug #4512 for more information).
			// (only IE 8 fails this test)
			div.innerHTML = "<table><tr><td style='" + paddingMarginBorder + "0;display:none'></td><td>t</td></tr></table>";
			tds = div.getElementsByTagName( "td" );
			isSupported = ( tds[ 0 ].offsetHeight === 0 );

			tds[ 0 ].style.display = "";
			tds[ 1 ].style.display = "none";

			// Check if empty table cells still have offsetWidth/Height
			// (IE <= 8 fail this test)
			support.reliableHiddenOffsets = isSupported && ( tds[ 0 ].offsetHeight === 0 );

			// Check if div with explicit width and no margin-right incorrectly
			// gets computed margin-right based on width of container. For more
			// info see bug #3333
			// Fails in WebKit before Feb 2011 nightlies
			// WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
			if ( window.getComputedStyle ) {
				div.innerHTML = "";
				marginDiv = document.createElement( "div" );
				marginDiv.style.width = "0";
				marginDiv.style.marginRight = "0";
				div.style.width = "2px";
				div.appendChild( marginDiv );
				support.reliableMarginRight =
					( parseInt( ( window.getComputedStyle( marginDiv, null ) || { marginRight: 0 } ).marginRight, 10 ) || 0 ) === 0;
			}

			if ( typeof div.style.zoom !== "undefined" ) {
				// Check if natively block-level elements act like inline-block
				// elements when setting their display to 'inline' and giving
				// them layout
				// (IE < 8 does this)
				div.innerHTML = "";
				div.style.width = div.style.padding = "1px";
				div.style.border = 0;
				div.style.overflow = "hidden";
				div.style.display = "inline";
				div.style.zoom = 1;
				support.inlineBlockNeedsLayout = ( div.offsetWidth === 3 );

				// Check if elements with layout shrink-wrap their children
				// (IE 6 does this)
				div.style.display = "block";
				div.style.overflow = "visible";
				div.innerHTML = "<div style='width:5px;'></div>";
				support.shrinkWrapBlocks = ( div.offsetWidth !== 3 );
			}

			div.style.cssText = positionTopLeftWidthHeight + paddingMarginBorderVisibility;
			div.innerHTML = html;

			outer = div.firstChild;
			inner = outer.firstChild;
			td = outer.nextSibling.firstChild.firstChild;

			offsetSupport = {
				doesNotAddBorder: ( inner.offsetTop !== 5 ),
				doesAddBorderForTableAndCells: ( td.offsetTop === 5 )
			};

			inner.style.position = "fixed";
			inner.style.top = "20px";

			// safari subtracts parent border width here which is 5px
			offsetSupport.fixedPosition = ( inner.offsetTop === 20 || inner.offsetTop === 15 );
			inner.style.position = inner.style.top = "";

			outer.style.overflow = "hidden";
			outer.style.position = "relative";

			offsetSupport.subtractsBorderForOverflowNotVisible = ( inner.offsetTop === -5 );
			offsetSupport.doesNotIncludeMarginInBodyOffset = ( body.offsetTop !== conMarginTop );

			if ( window.getComputedStyle ) {
				div.style.marginTop = "1%";
				support.pixelMargin = ( window.getComputedStyle( div, null ) || { marginTop: 0 } ).marginTop !== "1%";
			}

			if ( typeof container.style.zoom !== "undefined" ) {
				container.style.zoom = 1;
			}

			body.removeChild( container );
			marginDiv = div = container = null;

			jQuery.extend( support, offsetSupport );
		});

		return support;
	})();




	var rbrace = /^(?:\{.*\}|\[.*\])$/,
		rmultiDash = /([A-Z])/g;

	jQuery.extend({
		cache: {},

		// Please use with caution
		uuid: 0,

		// Unique for each copy of jQuery on the page
		// Non-digits removed to match rinlinejQuery
		expando: "jQuery" + ( jQuery.fn.jquery + Math.random() ).replace( /\D/g, "" ),

		// The following elements throw uncatchable exceptions if you
		// attempt to add expando properties to them.
		noData: {
			"embed": true,
			// Ban all objects except for Flash (which handle expandos)
			"object": "clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",
			"applet": true
		},

		hasData: function( elem ) {
			elem = elem.nodeType ? jQuery.cache[ elem[jQuery.expando] ] : elem[ jQuery.expando ];
			return !!elem && !isEmptyDataObject( elem );
		},

		data: function( elem, name, data, pvt /* Internal Use Only */ ) {
			if ( !jQuery.acceptData( elem ) ) {
				return;
			}

			var privateCache, thisCache, ret,
				internalKey = jQuery.expando,
				getByName = typeof name === "string",

			// We have to handle DOM nodes and JS objects differently because IE6-7
			// can't GC object references properly across the DOM-JS boundary
				isNode = elem.nodeType,

			// Only DOM nodes need the global jQuery cache; JS object data is
			// attached directly to the object so GC can occur automatically
				cache = isNode ? jQuery.cache : elem,

			// Only defining an ID for JS objects if its cache already exists allows
			// the code to shortcut on the same path as a DOM node with no cache
				id = isNode ? elem[ internalKey ] : elem[ internalKey ] && internalKey,
				isEvents = name === "events";

			// Avoid doing any more work than we need to when trying to get data on an
			// object that has no data at all
			if ( (!id || !cache[id] || (!isEvents && !pvt && !cache[id].data)) && getByName && data === undefined ) {
				return;
			}

			if ( !id ) {
				// Only DOM nodes need a new unique ID for each element since their data
				// ends up in the global cache
				if ( isNode ) {
					elem[ internalKey ] = id = ++jQuery.uuid;
				} else {
					id = internalKey;
				}
			}

			if ( !cache[ id ] ) {
				cache[ id ] = {};

				// Avoids exposing jQuery metadata on plain JS objects when the object
				// is serialized using JSON.stringify
				if ( !isNode ) {
					cache[ id ].toJSON = jQuery.noop;
				}
			}

			// An object can be passed to jQuery.data instead of a key/value pair; this gets
			// shallow copied over onto the existing cache
			if ( typeof name === "object" || typeof name === "function" ) {
				if ( pvt ) {
					cache[ id ] = jQuery.extend( cache[ id ], name );
				} else {
					cache[ id ].data = jQuery.extend( cache[ id ].data, name );
				}
			}

			privateCache = thisCache = cache[ id ];

			// jQuery data() is stored in a separate object inside the object's internal data
			// cache in order to avoid key collisions between internal data and user-defined
			// data.
			if ( !pvt ) {
				if ( !thisCache.data ) {
					thisCache.data = {};
				}

				thisCache = thisCache.data;
			}

			if ( data !== undefined ) {
				thisCache[ jQuery.camelCase( name ) ] = data;
			}

			// Users should not attempt to inspect the internal events object using jQuery.data,
			// it is undocumented and subject to change. But does anyone listen? No.
			if ( isEvents && !thisCache[ name ] ) {
				return privateCache.events;
			}

			// Check for both converted-to-camel and non-converted data property names
			// If a data property was specified
			if ( getByName ) {

				// First Try to find as-is property data
				ret = thisCache[ name ];

				// Test for null|undefined property data
				if ( ret == null ) {

					// Try to find the camelCased property
					ret = thisCache[ jQuery.camelCase( name ) ];
				}
			} else {
				ret = thisCache;
			}

			return ret;
		},

		removeData: function( elem, name, pvt /* Internal Use Only */ ) {
			if ( !jQuery.acceptData( elem ) ) {
				return;
			}

			var thisCache, i, l,

			// Reference to internal data cache key
				internalKey = jQuery.expando,

				isNode = elem.nodeType,

			// See jQuery.data for more information
				cache = isNode ? jQuery.cache : elem,

			// See jQuery.data for more information
				id = isNode ? elem[ internalKey ] : internalKey;

			// If there is already no cache entry for this object, there is no
			// purpose in continuing
			if ( !cache[ id ] ) {
				return;
			}

			if ( name ) {

				thisCache = pvt ? cache[ id ] : cache[ id ].data;

				if ( thisCache ) {

					// Support array or space separated string names for data keys
					if ( !jQuery.isArray( name ) ) {

						// try the string as a key before any manipulation
						if ( name in thisCache ) {
							name = [ name ];
						} else {

							// split the camel cased version by spaces unless a key with the spaces exists
							name = jQuery.camelCase( name );
							if ( name in thisCache ) {
								name = [ name ];
							} else {
								name = name.split( " " );
							}
						}
					}

					for ( i = 0, l = name.length; i < l; i++ ) {
						delete thisCache[ name[i] ];
					}

					// If there is no data left in the cache, we want to continue
					// and let the cache object itself get destroyed
					if ( !( pvt ? isEmptyDataObject : jQuery.isEmptyObject )( thisCache ) ) {
						return;
					}
				}
			}

			// See jQuery.data for more information
			if ( !pvt ) {
				delete cache[ id ].data;

				// Don't destroy the parent cache unless the internal data object
				// had been the only thing left in it
				if ( !isEmptyDataObject(cache[ id ]) ) {
					return;
				}
			}

			// Browsers that fail expando deletion also refuse to delete expandos on
			// the window, but it will allow it on all other JS objects; other browsers
			// don't care
			// Ensure that `cache` is not a window object #10080
			if ( jQuery.support.deleteExpando || !cache.setInterval ) {
				delete cache[ id ];
			} else {
				cache[ id ] = null;
			}

			// We destroyed the cache and need to eliminate the expando on the node to avoid
			// false lookups in the cache for entries that no longer exist
			if ( isNode ) {
				// IE does not allow us to delete expando properties from nodes,
				// nor does it have a removeAttribute function on Document nodes;
				// we must handle all of these cases
				if ( jQuery.support.deleteExpando ) {
					delete elem[ internalKey ];
				} else if ( elem.removeAttribute ) {
					elem.removeAttribute( internalKey );
				} else {
					elem[ internalKey ] = null;
				}
			}
		},

		// For internal use only.
		_data: function( elem, name, data ) {
			return jQuery.data( elem, name, data, true );
		},

		// A method for determining if a DOM node can handle the data expando
		acceptData: function( elem ) {
			if ( elem.nodeName ) {
				var match = jQuery.noData[ elem.nodeName.toLowerCase() ];

				if ( match ) {
					return !(match === true || elem.getAttribute("classid") !== match);
				}
			}

			return true;
		}
	});

	jQuery.fn.extend({
		data: function( key, value ) {
			var parts, part, attr, name, l,
				elem = this[0],
				i = 0,
				data = null;

			// Gets all values
			if ( key === undefined ) {
				if ( this.length ) {
					data = jQuery.data( elem );

					if ( elem.nodeType === 1 && !jQuery._data( elem, "parsedAttrs" ) ) {
						attr = elem.attributes;
						for ( l = attr.length; i < l; i++ ) {
							name = attr[i].name;

							if ( name.indexOf( "data-" ) === 0 ) {
								name = jQuery.camelCase( name.substring(5) );

								dataAttr( elem, name, data[ name ] );
							}
						}
						jQuery._data( elem, "parsedAttrs", true );
					}
				}

				return data;
			}

			// Sets multiple values
			if ( typeof key === "object" ) {
				return this.each(function() {
					jQuery.data( this, key );
				});
			}

			parts = key.split( ".", 2 );
			parts[1] = parts[1] ? "." + parts[1] : "";
			part = parts[1] + "!";

			return jQuery.access( this, function( value ) {

				if ( value === undefined ) {
					data = this.triggerHandler( "getData" + part, [ parts[0] ] );

					// Try to fetch any internally stored data first
					if ( data === undefined && elem ) {
						data = jQuery.data( elem, key );
						data = dataAttr( elem, key, data );
					}

					return data === undefined && parts[1] ?
						this.data( parts[0] ) :
						data;
				}

				parts[1] = value;
				this.each(function() {
					var self = jQuery( this );

					self.triggerHandler( "setData" + part, parts );
					jQuery.data( this, key, value );
					self.triggerHandler( "changeData" + part, parts );
				});
			}, null, value, arguments.length > 1, null, false );
		},

		removeData: function( key ) {
			return this.each(function() {
				jQuery.removeData( this, key );
			});
		}
	});

	function dataAttr( elem, key, data ) {
		// If nothing was found internally, try to fetch any
		// data from the HTML5 data-* attribute
		if ( data === undefined && elem.nodeType === 1 ) {

			var name = "data-" + key.replace( rmultiDash, "-$1" ).toLowerCase();

			data = elem.getAttribute( name );

			if ( typeof data === "string" ) {
				try {
					data = data === "true" ? true :
						data === "false" ? false :
							data === "null" ? null :
								jQuery.isNumeric( data ) ? +data :
									rbrace.test( data ) ? jQuery.parseJSON( data ) :
										data;
				} catch( e ) {}

				// Make sure we set the data so it isn't changed later
				jQuery.data( elem, key, data );

			} else {
				data = undefined;
			}
		}

		return data;
	}

// checks a cache object for emptiness
	function isEmptyDataObject( obj ) {
		for ( var name in obj ) {

			// if the public data object is empty, the private is still empty
			if ( name === "data" && jQuery.isEmptyObject( obj[name] ) ) {
				continue;
			}
			if ( name !== "toJSON" ) {
				return false;
			}
		}

		return true;
	}




	function handleQueueMarkDefer( elem, type, src ) {
		var deferDataKey = type + "defer",
			queueDataKey = type + "queue",
			markDataKey = type + "mark",
			defer = jQuery._data( elem, deferDataKey );
		if ( defer &&
			( src === "queue" || !jQuery._data(elem, queueDataKey) ) &&
			( src === "mark" || !jQuery._data(elem, markDataKey) ) ) {
			// Give room for hard-coded callbacks to fire first
			// and eventually mark/queue something else on the element
			setTimeout( function() {
				if ( !jQuery._data( elem, queueDataKey ) &&
					!jQuery._data( elem, markDataKey ) ) {
					jQuery.removeData( elem, deferDataKey, true );
					defer.fire();
				}
			}, 0 );
		}
	}

	jQuery.extend({

		_mark: function( elem, type ) {
			if ( elem ) {
				type = ( type || "fx" ) + "mark";
				jQuery._data( elem, type, (jQuery._data( elem, type ) || 0) + 1 );
			}
		},

		_unmark: function( force, elem, type ) {
			if ( force !== true ) {
				type = elem;
				elem = force;
				force = false;
			}
			if ( elem ) {
				type = type || "fx";
				var key = type + "mark",
					count = force ? 0 : ( (jQuery._data( elem, key ) || 1) - 1 );
				if ( count ) {
					jQuery._data( elem, key, count );
				} else {
					jQuery.removeData( elem, key, true );
					handleQueueMarkDefer( elem, type, "mark" );
				}
			}
		},

		queue: function( elem, type, data ) {
			var q;
			if ( elem ) {
				type = ( type || "fx" ) + "queue";
				q = jQuery._data( elem, type );

				// Speed up dequeue by getting out quickly if this is just a lookup
				if ( data ) {
					if ( !q || jQuery.isArray(data) ) {
						q = jQuery._data( elem, type, jQuery.makeArray(data) );
					} else {
						q.push( data );
					}
				}
				return q || [];
			}
		},

		dequeue: function( elem, type ) {
			type = type || "fx";

			var queue = jQuery.queue( elem, type ),
				fn = queue.shift(),
				hooks = {};

			// If the fx queue is dequeued, always remove the progress sentinel
			if ( fn === "inprogress" ) {
				fn = queue.shift();
			}

			if ( fn ) {
				// Add a progress sentinel to prevent the fx queue from being
				// automatically dequeued
				if ( type === "fx" ) {
					queue.unshift( "inprogress" );
				}

				jQuery._data( elem, type + ".run", hooks );
				fn.call( elem, function() {
					jQuery.dequeue( elem, type );
				}, hooks );
			}

			if ( !queue.length ) {
				jQuery.removeData( elem, type + "queue " + type + ".run", true );
				handleQueueMarkDefer( elem, type, "queue" );
			}
		}
	});

	jQuery.fn.extend({
		queue: function( type, data ) {
			var setter = 2;

			if ( typeof type !== "string" ) {
				data = type;
				type = "fx";
				setter--;
			}

			if ( arguments.length < setter ) {
				return jQuery.queue( this[0], type );
			}

			return data === undefined ?
				this :
				this.each(function() {
					var queue = jQuery.queue( this, type, data );

					if ( type === "fx" && queue[0] !== "inprogress" ) {
						jQuery.dequeue( this, type );
					}
				});
		},
		dequeue: function( type ) {
			return this.each(function() {
				jQuery.dequeue( this, type );
			});
		},
		// Based off of the plugin by Clint Helfers, with permission.
		// http://blindsignals.com/index.php/2009/07/jquery-delay/
		delay: function( time, type ) {
			time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
			type = type || "fx";

			return this.queue( type, function( next, hooks ) {
				var timeout = setTimeout( next, time );
				hooks.stop = function() {
					clearTimeout( timeout );
				};
			});
		},
		clearQueue: function( type ) {
			return this.queue( type || "fx", [] );
		},
		// Get a promise resolved when queues of a certain type
		// are emptied (fx is the type by default)
		promise: function( type, object ) {
			if ( typeof type !== "string" ) {
				object = type;
				type = undefined;
			}
			type = type || "fx";
			var defer = jQuery.Deferred(),
				elements = this,
				i = elements.length,
				count = 1,
				deferDataKey = type + "defer",
				queueDataKey = type + "queue",
				markDataKey = type + "mark",
				tmp;
			function resolve() {
				if ( !( --count ) ) {
					defer.resolveWith( elements, [ elements ] );
				}
			}
			while( i-- ) {
				if (( tmp = jQuery.data( elements[ i ], deferDataKey, undefined, true ) ||
					( jQuery.data( elements[ i ], queueDataKey, undefined, true ) ||
						jQuery.data( elements[ i ], markDataKey, undefined, true ) ) &&
						jQuery.data( elements[ i ], deferDataKey, jQuery.Callbacks( "once memory" ), true ) )) {
					count++;
					tmp.add( resolve );
				}
			}
			resolve();
			return defer.promise( object );
		}
	});




	var rclass = /[\n\t\r]/g,
		rspace = /\s+/,
		rreturn = /\r/g,
		rtype = /^(?:button|input)$/i,
		rfocusable = /^(?:button|input|object|select|textarea)$/i,
		rclickable = /^a(?:rea)?$/i,
		rboolean = /^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i,
		getSetAttribute = jQuery.support.getSetAttribute,
		nodeHook, boolHook, fixSpecified;

	jQuery.fn.extend({
		attr: function( name, value ) {
			return jQuery.access( this, jQuery.attr, name, value, arguments.length > 1 );
		},

		removeAttr: function( name ) {
			return this.each(function() {
				jQuery.removeAttr( this, name );
			});
		},

		prop: function( name, value ) {
			return jQuery.access( this, jQuery.prop, name, value, arguments.length > 1 );
		},

		removeProp: function( name ) {
			name = jQuery.propFix[ name ] || name;
			return this.each(function() {
				// try/catch handles cases where IE balks (such as removing a property on window)
				try {
					this[ name ] = undefined;
					delete this[ name ];
				} catch( e ) {}
			});
		},

		addClass: function( value ) {
			var classNames, i, l, elem,
				setClass, c, cl;

			if ( jQuery.isFunction( value ) ) {
				return this.each(function( j ) {
					jQuery( this ).addClass( value.call(this, j, this.className) );
				});
			}

			if ( value && typeof value === "string" ) {
				classNames = value.split( rspace );

				for ( i = 0, l = this.length; i < l; i++ ) {
					elem = this[ i ];

					if ( elem.nodeType === 1 ) {
						if ( !elem.className && classNames.length === 1 ) {
							elem.className = value;

						} else {
							setClass = " " + elem.className + " ";

							for ( c = 0, cl = classNames.length; c < cl; c++ ) {
								if ( !~setClass.indexOf( " " + classNames[ c ] + " " ) ) {
									setClass += classNames[ c ] + " ";
								}
							}
							elem.className = jQuery.trim( setClass );
						}
					}
				}
			}

			return this;
		},

		removeClass: function( value ) {
			var classNames, i, l, elem, className, c, cl;

			if ( jQuery.isFunction( value ) ) {
				return this.each(function( j ) {
					jQuery( this ).removeClass( value.call(this, j, this.className) );
				});
			}

			if ( (value && typeof value === "string") || value === undefined ) {
				classNames = ( value || "" ).split( rspace );

				for ( i = 0, l = this.length; i < l; i++ ) {
					elem = this[ i ];

					if ( elem.nodeType === 1 && elem.className ) {
						if ( value ) {
							className = (" " + elem.className + " ").replace( rclass, " " );
							for ( c = 0, cl = classNames.length; c < cl; c++ ) {
								className = className.replace(" " + classNames[ c ] + " ", " ");
							}
							elem.className = jQuery.trim( className );

						} else {
							elem.className = "";
						}
					}
				}
			}

			return this;
		},

		toggleClass: function( value, stateVal ) {
			var type = typeof value,
				isBool = typeof stateVal === "boolean";

			if ( jQuery.isFunction( value ) ) {
				return this.each(function( i ) {
					jQuery( this ).toggleClass( value.call(this, i, this.className, stateVal), stateVal );
				});
			}

			return this.each(function() {
				if ( type === "string" ) {
					// toggle individual class names
					var className,
						i = 0,
						self = jQuery( this ),
						state = stateVal,
						classNames = value.split( rspace );

					while ( (className = classNames[ i++ ]) ) {
						// check each className given, space seperated list
						state = isBool ? state : !self.hasClass( className );
						self[ state ? "addClass" : "removeClass" ]( className );
					}

				} else if ( type === "undefined" || type === "boolean" ) {
					if ( this.className ) {
						// store className if set
						jQuery._data( this, "__className__", this.className );
					}

					// toggle whole className
					this.className = this.className || value === false ? "" : jQuery._data( this, "__className__" ) || "";
				}
			});
		},

		hasClass: function( selector ) {
			var className = " " + selector + " ",
				i = 0,
				l = this.length;
			for ( ; i < l; i++ ) {
				if ( this[i].nodeType === 1 && (" " + this[i].className + " ").replace(rclass, " ").indexOf( className ) > -1 ) {
					return true;
				}
			}

			return false;
		},

		val: function( value ) {
			var hooks, ret, isFunction,
				elem = this[0];

			if ( !arguments.length ) {
				if ( elem ) {
					hooks = jQuery.valHooks[ elem.type ] || jQuery.valHooks[ elem.nodeName.toLowerCase() ];

					if ( hooks && "get" in hooks && (ret = hooks.get( elem, "value" )) !== undefined ) {
						return ret;
					}

					ret = elem.value;

					return typeof ret === "string" ?
						// handle most common string cases
						ret.replace(rreturn, "") :
						// handle cases where value is null/undef or number
						ret == null ? "" : ret;
				}

				return;
			}

			isFunction = jQuery.isFunction( value );

			return this.each(function( i ) {
				var self = jQuery(this), val;

				if ( this.nodeType !== 1 ) {
					return;
				}

				if ( isFunction ) {
					val = value.call( this, i, self.val() );
				} else {
					val = value;
				}

				// Treat null/undefined as ""; convert numbers to string
				if ( val == null ) {
					val = "";
				} else if ( typeof val === "number" ) {
					val += "";
				} else if ( jQuery.isArray( val ) ) {
					val = jQuery.map(val, function ( value ) {
						return value == null ? "" : value + "";
					});
				}

				hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

				// If set returns undefined, fall back to normal setting
				if ( !hooks || !("set" in hooks) || hooks.set( this, val, "value" ) === undefined ) {
					this.value = val;
				}
			});
		}
	});

	jQuery.extend({
		valHooks: {
			option: {
				get: function( elem ) {
					// attributes.value is undefined in Blackberry 4.7 but
					// uses .value. See #6932
					var val = elem.attributes.value;
					return !val || val.specified ? elem.value : elem.text;
				}
			},
			select: {
				get: function( elem ) {
					var value, i, max, option,
						index = elem.selectedIndex,
						values = [],
						options = elem.options,
						one = elem.type === "select-one";

					// Nothing was selected
					if ( index < 0 ) {
						return null;
					}

					// Loop through all the selected options
					i = one ? index : 0;
					max = one ? index + 1 : options.length;
					for ( ; i < max; i++ ) {
						option = options[ i ];

						// Don't return options that are disabled or in a disabled optgroup
						if ( option.selected && (jQuery.support.optDisabled ? !option.disabled : option.getAttribute("disabled") === null) &&
							(!option.parentNode.disabled || !jQuery.nodeName( option.parentNode, "optgroup" )) ) {

							// Get the specific value for the option
							value = jQuery( option ).val();

							// We don't need an array for one selects
							if ( one ) {
								return value;
							}

							// Multi-Selects return an array
							values.push( value );
						}
					}

					// Fixes Bug #2551 -- select.val() broken in IE after form.reset()
					if ( one && !values.length && options.length ) {
						return jQuery( options[ index ] ).val();
					}

					return values;
				},

				set: function( elem, value ) {
					var values = jQuery.makeArray( value );

					jQuery(elem).find("option").each(function() {
						this.selected = jQuery.inArray( jQuery(this).val(), values ) >= 0;
					});

					if ( !values.length ) {
						elem.selectedIndex = -1;
					}
					return values;
				}
			}
		},

		attrFn: {
			val: true,
			css: true,
			html: true,
			text: true,
			data: true,
			width: true,
			height: true,
			offset: true
		},

		attr: function( elem, name, value, pass ) {
			var ret, hooks, notxml,
				nType = elem.nodeType;

			// don't get/set attributes on text, comment and attribute nodes
			if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
				return;
			}

			if ( pass && name in jQuery.attrFn ) {
				return jQuery( elem )[ name ]( value );
			}

			// Fallback to prop when attributes are not supported
			if ( typeof elem.getAttribute === "undefined" ) {
				return jQuery.prop( elem, name, value );
			}

			notxml = nType !== 1 || !jQuery.isXMLDoc( elem );

			// All attributes are lowercase
			// Grab necessary hook if one is defined
			if ( notxml ) {
				name = name.toLowerCase();
				hooks = jQuery.attrHooks[ name ] || ( rboolean.test( name ) ? boolHook : nodeHook );
			}

			if ( value !== undefined ) {

				if ( value === null ) {
					jQuery.removeAttr( elem, name );
					return;

				} else if ( hooks && "set" in hooks && notxml && (ret = hooks.set( elem, value, name )) !== undefined ) {
					return ret;

				} else {
					elem.setAttribute( name, "" + value );
					return value;
				}

			} else if ( hooks && "get" in hooks && notxml && (ret = hooks.get( elem, name )) !== null ) {
				return ret;

			} else {

				ret = elem.getAttribute( name );

				// Non-existent attributes return null, we normalize to undefined
				return ret === null ?
					undefined :
					ret;
			}
		},

		removeAttr: function( elem, value ) {
			var propName, attrNames, name, l, isBool,
				i = 0;

			if ( value && elem.nodeType === 1 ) {
				attrNames = value.toLowerCase().split( rspace );
				l = attrNames.length;

				for ( ; i < l; i++ ) {
					name = attrNames[ i ];

					if ( name ) {
						propName = jQuery.propFix[ name ] || name;
						isBool = rboolean.test( name );

						// See #9699 for explanation of this approach (setting first, then removal)
						// Do not do this for boolean attributes (see #10870)
						if ( !isBool ) {
							jQuery.attr( elem, name, "" );
						}
						elem.removeAttribute( getSetAttribute ? name : propName );

						// Set corresponding property to false for boolean attributes
						if ( isBool && propName in elem ) {
							elem[ propName ] = false;
						}
					}
				}
			}
		},

		attrHooks: {
			type: {
				set: function( elem, value ) {
					// We can't allow the type property to be changed (since it causes problems in IE)
					if ( rtype.test( elem.nodeName ) && elem.parentNode ) {
						jQuery.error( "type property can't be changed" );
					} else if ( !jQuery.support.radioValue && value === "radio" && jQuery.nodeName(elem, "input") ) {
						// Setting the type on a radio button after the value resets the value in IE6-9
						// Reset value to it's default in case type is set after value
						// This is for element creation
						var val = elem.value;
						elem.setAttribute( "type", value );
						if ( val ) {
							elem.value = val;
						}
						return value;
					}
				}
			},
			// Use the value property for back compat
			// Use the nodeHook for button elements in IE6/7 (#1954)
			value: {
				get: function( elem, name ) {
					if ( nodeHook && jQuery.nodeName( elem, "button" ) ) {
						return nodeHook.get( elem, name );
					}
					return name in elem ?
						elem.value :
						null;
				},
				set: function( elem, value, name ) {
					if ( nodeHook && jQuery.nodeName( elem, "button" ) ) {
						return nodeHook.set( elem, value, name );
					}
					// Does not return so that setAttribute is also used
					elem.value = value;
				}
			}
		},

		propFix: {
			tabindex: "tabIndex",
			readonly: "readOnly",
			"for": "htmlFor",
			"class": "className",
			maxlength: "maxLength",
			cellspacing: "cellSpacing",
			cellpadding: "cellPadding",
			rowspan: "rowSpan",
			colspan: "colSpan",
			usemap: "useMap",
			frameborder: "frameBorder",
			contenteditable: "contentEditable"
		},

		prop: function( elem, name, value ) {
			var ret, hooks, notxml,
				nType = elem.nodeType;

			// don't get/set properties on text, comment and attribute nodes
			if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
				return;
			}

			notxml = nType !== 1 || !jQuery.isXMLDoc( elem );

			if ( notxml ) {
				// Fix name and attach hooks
				name = jQuery.propFix[ name ] || name;
				hooks = jQuery.propHooks[ name ];
			}

			if ( value !== undefined ) {
				if ( hooks && "set" in hooks && (ret = hooks.set( elem, value, name )) !== undefined ) {
					return ret;

				} else {
					return ( elem[ name ] = value );
				}

			} else {
				if ( hooks && "get" in hooks && (ret = hooks.get( elem, name )) !== null ) {
					return ret;

				} else {
					return elem[ name ];
				}
			}
		},

		propHooks: {
			tabIndex: {
				get: function( elem ) {
					// elem.tabIndex doesn't always return the correct value when it hasn't been explicitly set
					// http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
					var attributeNode = elem.getAttributeNode("tabindex");

					return attributeNode && attributeNode.specified ?
						parseInt( attributeNode.value, 10 ) :
						rfocusable.test( elem.nodeName ) || rclickable.test( elem.nodeName ) && elem.href ?
							0 :
							undefined;
				}
			}
		}
	});

// Add the tabIndex propHook to attrHooks for back-compat (different case is intentional)
	jQuery.attrHooks.tabindex = jQuery.propHooks.tabIndex;

// Hook for boolean attributes
	boolHook = {
		get: function( elem, name ) {
			// Align boolean attributes with corresponding properties
			// Fall back to attribute presence where some booleans are not supported
			var attrNode,
				property = jQuery.prop( elem, name );
			return property === true || typeof property !== "boolean" && ( attrNode = elem.getAttributeNode(name) ) && attrNode.nodeValue !== false ?
				name.toLowerCase() :
				undefined;
		},
		set: function( elem, value, name ) {
			var propName;
			if ( value === false ) {
				// Remove boolean attributes when set to false
				jQuery.removeAttr( elem, name );
			} else {
				// value is true since we know at this point it's type boolean and not false
				// Set boolean attributes to the same name and set the DOM property
				propName = jQuery.propFix[ name ] || name;
				if ( propName in elem ) {
					// Only set the IDL specifically if it already exists on the element
					elem[ propName ] = true;
				}

				elem.setAttribute( name, name.toLowerCase() );
			}
			return name;
		}
	};

// IE6/7 do not support getting/setting some attributes with get/setAttribute
	if ( !getSetAttribute ) {

		fixSpecified = {
			name: true,
			id: true,
			coords: true
		};

		// Use this for any attribute in IE6/7
		// This fixes almost every IE6/7 issue
		nodeHook = jQuery.valHooks.button = {
			get: function( elem, name ) {
				var ret;
				ret = elem.getAttributeNode( name );
				return ret && ( fixSpecified[ name ] ? ret.nodeValue !== "" : ret.specified ) ?
					ret.nodeValue :
					undefined;
			},
			set: function( elem, value, name ) {
				// Set the existing or create a new attribute node
				var ret = elem.getAttributeNode( name );
				if ( !ret ) {
					ret = document.createAttribute( name );
					elem.setAttributeNode( ret );
				}
				return ( ret.nodeValue = value + "" );
			}
		};

		// Apply the nodeHook to tabindex
		jQuery.attrHooks.tabindex.set = nodeHook.set;

		// Set width and height to auto instead of 0 on empty string( Bug #8150 )
		// This is for removals
		jQuery.each([ "width", "height" ], function( i, name ) {
			jQuery.attrHooks[ name ] = jQuery.extend( jQuery.attrHooks[ name ], {
				set: function( elem, value ) {
					if ( value === "" ) {
						elem.setAttribute( name, "auto" );
						return value;
					}
				}
			});
		});

		// Set contenteditable to false on removals(#10429)
		// Setting to empty string throws an error as an invalid value
		jQuery.attrHooks.contenteditable = {
			get: nodeHook.get,
			set: function( elem, value, name ) {
				if ( value === "" ) {
					value = "false";
				}
				nodeHook.set( elem, value, name );
			}
		};
	}


// Some attributes require a special call on IE
	if ( !jQuery.support.hrefNormalized ) {
		jQuery.each([ "href", "src", "width", "height" ], function( i, name ) {
			jQuery.attrHooks[ name ] = jQuery.extend( jQuery.attrHooks[ name ], {
				get: function( elem ) {
					var ret = elem.getAttribute( name, 2 );
					return ret === null ? undefined : ret;
				}
			});
		});
	}

	if ( !jQuery.support.style ) {
		jQuery.attrHooks.style = {
			get: function( elem ) {
				// Return undefined in the case of empty string
				// Normalize to lowercase since IE uppercases css property names
				return elem.style.cssText.toLowerCase() || undefined;
			},
			set: function( elem, value ) {
				return ( elem.style.cssText = "" + value );
			}
		};
	}

// Safari mis-reports the default selected property of an option
// Accessing the parent's selectedIndex property fixes it
	if ( !jQuery.support.optSelected ) {
		jQuery.propHooks.selected = jQuery.extend( jQuery.propHooks.selected, {
			get: function( elem ) {
				var parent = elem.parentNode;

				if ( parent ) {
					parent.selectedIndex;

					// Make sure that it also works with optgroups, see #5701
					if ( parent.parentNode ) {
						parent.parentNode.selectedIndex;
					}
				}
				return null;
			}
		});
	}

// IE6/7 call enctype encoding
	if ( !jQuery.support.enctype ) {
		jQuery.propFix.enctype = "encoding";
	}

// Radios and checkboxes getter/setter
	if ( !jQuery.support.checkOn ) {
		jQuery.each([ "radio", "checkbox" ], function() {
			jQuery.valHooks[ this ] = {
				get: function( elem ) {
					// Handle the case where in Webkit "" is returned instead of "on" if a value isn't specified
					return elem.getAttribute("value") === null ? "on" : elem.value;
				}
			};
		});
	}
	jQuery.each([ "radio", "checkbox" ], function() {
		jQuery.valHooks[ this ] = jQuery.extend( jQuery.valHooks[ this ], {
			set: function( elem, value ) {
				if ( jQuery.isArray( value ) ) {
					return ( elem.checked = jQuery.inArray( jQuery(elem).val(), value ) >= 0 );
				}
			}
		});
	});




	var rformElems = /^(?:textarea|input|select)$/i,
		rtypenamespace = /^([^\.]*)?(?:\.(.+))?$/,
		rhoverHack = /(?:^|\s)hover(\.\S+)?\b/,
		rkeyEvent = /^key/,
		rmouseEvent = /^(?:mouse|contextmenu)|click/,
		rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
		rquickIs = /^(\w*)(?:#([\w\-]+))?(?:\.([\w\-]+))?$/,
		quickParse = function( selector ) {
			var quick = rquickIs.exec( selector );
			if ( quick ) {
				//   0  1    2   3
				// [ _, tag, id, class ]
				quick[1] = ( quick[1] || "" ).toLowerCase();
				quick[3] = quick[3] && new RegExp( "(?:^|\\s)" + quick[3] + "(?:\\s|$)" );
			}
			return quick;
		},
		quickIs = function( elem, m ) {
			var attrs = elem.attributes || {};
			return (
				(!m[1] || elem.nodeName.toLowerCase() === m[1]) &&
					(!m[2] || (attrs.id || {}).value === m[2]) &&
					(!m[3] || m[3].test( (attrs[ "class" ] || {}).value ))
				);
		},
		hoverHack = function( events ) {
			return jQuery.event.special.hover ? events : events.replace( rhoverHack, "mouseenter$1 mouseleave$1" );
		};

	/*
	 * Helper functions for managing events -- not part of the public interface.
	 * Props to Dean Edwards' addEvent library for many of the ideas.
	 */
	jQuery.event = {

		add: function( elem, types, handler, data, selector ) {

			var elemData, eventHandle, events,
				t, tns, type, namespaces, handleObj,
				handleObjIn, quick, handlers, special;

			// Don't attach events to noData or text/comment nodes (allow plain objects tho)
			if ( elem.nodeType === 3 || elem.nodeType === 8 || !types || !handler || !(elemData = jQuery._data( elem )) ) {
				return;
			}

			// Caller can pass in an object of custom data in lieu of the handler
			if ( handler.handler ) {
				handleObjIn = handler;
				handler = handleObjIn.handler;
				selector = handleObjIn.selector;
			}

			// Make sure that the handler has a unique ID, used to find/remove it later
			if ( !handler.guid ) {
				handler.guid = jQuery.guid++;
			}

			// Init the element's event structure and main handler, if this is the first
			events = elemData.events;
			if ( !events ) {
				elemData.events = events = {};
			}
			eventHandle = elemData.handle;
			if ( !eventHandle ) {
				elemData.handle = eventHandle = function( e ) {
					// Discard the second event of a jQuery.event.trigger() and
					// when an event is called after a page has unloaded
					return typeof jQuery !== "undefined" && (!e || jQuery.event.triggered !== e.type) ?
						jQuery.event.dispatch.apply( eventHandle.elem, arguments ) :
						undefined;
				};
				// Add elem as a property of the handle fn to prevent a memory leak with IE non-native events
				eventHandle.elem = elem;
			}

			// Handle multiple events separated by a space
			// jQuery(...).bind("mouseover mouseout", fn);
			types = jQuery.trim( hoverHack(types) ).split( " " );
			for ( t = 0; t < types.length; t++ ) {

				tns = rtypenamespace.exec( types[t] ) || [];
				type = tns[1];
				namespaces = ( tns[2] || "" ).split( "." ).sort();

				// If event changes its type, use the special event handlers for the changed type
				special = jQuery.event.special[ type ] || {};

				// If selector defined, determine special event api type, otherwise given type
				type = ( selector ? special.delegateType : special.bindType ) || type;

				// Update special based on newly reset type
				special = jQuery.event.special[ type ] || {};

				// handleObj is passed to all event handlers
				handleObj = jQuery.extend({
					type: type,
					origType: tns[1],
					data: data,
					handler: handler,
					guid: handler.guid,
					selector: selector,
					quick: selector && quickParse( selector ),
					namespace: namespaces.join(".")
				}, handleObjIn );

				// Init the event handler queue if we're the first
				handlers = events[ type ];
				if ( !handlers ) {
					handlers = events[ type ] = [];
					handlers.delegateCount = 0;

					// Only use addEventListener/attachEvent if the special events handler returns false
					if ( !special.setup || special.setup.call( elem, data, namespaces, eventHandle ) === false ) {
						// Bind the global event handler to the element
						if ( elem.addEventListener ) {
							elem.addEventListener( type, eventHandle, false );

						} else if ( elem.attachEvent ) {
							elem.attachEvent( "on" + type, eventHandle );
						}
					}
				}

				if ( special.add ) {
					special.add.call( elem, handleObj );

					if ( !handleObj.handler.guid ) {
						handleObj.handler.guid = handler.guid;
					}
				}

				// Add to the element's handler list, delegates in front
				if ( selector ) {
					handlers.splice( handlers.delegateCount++, 0, handleObj );
				} else {
					handlers.push( handleObj );
				}

				// Keep track of which events have ever been used, for event optimization
				jQuery.event.global[ type ] = true;
			}

			// Nullify elem to prevent memory leaks in IE
			elem = null;
		},

		global: {},

		// Detach an event or set of events from an element
		remove: function( elem, types, handler, selector, mappedTypes ) {

			var elemData = jQuery.hasData( elem ) && jQuery._data( elem ),
				t, tns, type, origType, namespaces, origCount,
				j, events, special, handle, eventType, handleObj;

			if ( !elemData || !(events = elemData.events) ) {
				return;
			}

			// Once for each type.namespace in types; type may be omitted
			types = jQuery.trim( hoverHack( types || "" ) ).split(" ");
			for ( t = 0; t < types.length; t++ ) {
				tns = rtypenamespace.exec( types[t] ) || [];
				type = origType = tns[1];
				namespaces = tns[2];

				// Unbind all events (on this namespace, if provided) for the element
				if ( !type ) {
					for ( type in events ) {
						jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
					}
					continue;
				}

				special = jQuery.event.special[ type ] || {};
				type = ( selector? special.delegateType : special.bindType ) || type;
				eventType = events[ type ] || [];
				origCount = eventType.length;
				namespaces = namespaces ? new RegExp("(^|\\.)" + namespaces.split(".").sort().join("\\.(?:.*\\.)?") + "(\\.|$)") : null;

				// Remove matching events
				for ( j = 0; j < eventType.length; j++ ) {
					handleObj = eventType[ j ];

					if ( ( mappedTypes || origType === handleObj.origType ) &&
						( !handler || handler.guid === handleObj.guid ) &&
						( !namespaces || namespaces.test( handleObj.namespace ) ) &&
						( !selector || selector === handleObj.selector || selector === "**" && handleObj.selector ) ) {
						eventType.splice( j--, 1 );

						if ( handleObj.selector ) {
							eventType.delegateCount--;
						}
						if ( special.remove ) {
							special.remove.call( elem, handleObj );
						}
					}
				}

				// Remove generic event handler if we removed something and no more handlers exist
				// (avoids potential for endless recursion during removal of special event handlers)
				if ( eventType.length === 0 && origCount !== eventType.length ) {
					if ( !special.teardown || special.teardown.call( elem, namespaces ) === false ) {
						jQuery.removeEvent( elem, type, elemData.handle );
					}

					delete events[ type ];
				}
			}

			// Remove the expando if it's no longer used
			if ( jQuery.isEmptyObject( events ) ) {
				handle = elemData.handle;
				if ( handle ) {
					handle.elem = null;
				}

				// removeData also checks for emptiness and clears the expando if empty
				// so use it instead of delete
				jQuery.removeData( elem, [ "events", "handle" ], true );
			}
		},

		// Events that are safe to short-circuit if no handlers are attached.
		// Native DOM events should not be added, they may have inline handlers.
		customEvent: {
			"getData": true,
			"setData": true,
			"changeData": true
		},

		trigger: function( event, data, elem, onlyHandlers ) {
			// Don't do events on text and comment nodes
			if ( elem && (elem.nodeType === 3 || elem.nodeType === 8) ) {
				return;
			}

			// Event object or event type
			var type = event.type || event,
				namespaces = [],
				cache, exclusive, i, cur, old, ontype, special, handle, eventPath, bubbleType;

			// focus/blur morphs to focusin/out; ensure we're not firing them right now
			if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
				return;
			}

			if ( type.indexOf( "!" ) >= 0 ) {
				// Exclusive events trigger only for the exact event (no namespaces)
				type = type.slice(0, -1);
				exclusive = true;
			}

			if ( type.indexOf( "." ) >= 0 ) {
				// Namespaced trigger; create a regexp to match event type in handle()
				namespaces = type.split(".");
				type = namespaces.shift();
				namespaces.sort();
			}

			if ( (!elem || jQuery.event.customEvent[ type ]) && !jQuery.event.global[ type ] ) {
				// No jQuery handlers for this event type, and it can't have inline handlers
				return;
			}

			// Caller can pass in an Event, Object, or just an event type string
			event = typeof event === "object" ?
				// jQuery.Event object
				event[ jQuery.expando ] ? event :
					// Object literal
					new jQuery.Event( type, event ) :
				// Just the event type (string)
				new jQuery.Event( type );

			event.type = type;
			event.isTrigger = true;
			event.exclusive = exclusive;
			event.namespace = namespaces.join( "." );
			event.namespace_re = event.namespace? new RegExp("(^|\\.)" + namespaces.join("\\.(?:.*\\.)?") + "(\\.|$)") : null;
			ontype = type.indexOf( ":" ) < 0 ? "on" + type : "";

			// Handle a global trigger
			if ( !elem ) {

				// TODO: Stop taunting the data cache; remove global events and always attach to document
				cache = jQuery.cache;
				for ( i in cache ) {
					if ( cache[ i ].events && cache[ i ].events[ type ] ) {
						jQuery.event.trigger( event, data, cache[ i ].handle.elem, true );
					}
				}
				return;
			}

			// Clean up the event in case it is being reused
			event.result = undefined;
			if ( !event.target ) {
				event.target = elem;
			}

			// Clone any incoming data and prepend the event, creating the handler arg list
			data = data != null ? jQuery.makeArray( data ) : [];
			data.unshift( event );

			// Allow special events to draw outside the lines
			special = jQuery.event.special[ type ] || {};
			if ( special.trigger && special.trigger.apply( elem, data ) === false ) {
				return;
			}

			// Determine event propagation path in advance, per W3C events spec (#9951)
			// Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
			eventPath = [[ elem, special.bindType || type ]];
			if ( !onlyHandlers && !special.noBubble && !jQuery.isWindow( elem ) ) {

				bubbleType = special.delegateType || type;
				cur = rfocusMorph.test( bubbleType + type ) ? elem : elem.parentNode;
				old = null;
				for ( ; cur; cur = cur.parentNode ) {
					eventPath.push([ cur, bubbleType ]);
					old = cur;
				}

				// Only add window if we got to document (e.g., not plain obj or detached DOM)
				if ( old && old === elem.ownerDocument ) {
					eventPath.push([ old.defaultView || old.parentWindow || window, bubbleType ]);
				}
			}

			// Fire handlers on the event path
			for ( i = 0; i < eventPath.length && !event.isPropagationStopped(); i++ ) {

				cur = eventPath[i][0];
				event.type = eventPath[i][1];

				handle = ( jQuery._data( cur, "events" ) || {} )[ event.type ] && jQuery._data( cur, "handle" );
				if ( handle ) {
					handle.apply( cur, data );
				}
				// Note that this is a bare JS function and not a jQuery handler
				handle = ontype && cur[ ontype ];
				if ( handle && jQuery.acceptData( cur ) && handle.apply( cur, data ) === false ) {
					event.preventDefault();
				}
			}
			event.type = type;

			// If nobody prevented the default action, do it now
			if ( !onlyHandlers && !event.isDefaultPrevented() ) {

				if ( (!special._default || special._default.apply( elem.ownerDocument, data ) === false) &&
					!(type === "click" && jQuery.nodeName( elem, "a" )) && jQuery.acceptData( elem ) ) {

					// Call a native DOM method on the target with the same name name as the event.
					// Can't use an .isFunction() check here because IE6/7 fails that test.
					// Don't do default actions on window, that's where global variables be (#6170)
					// IE<9 dies on focus/blur to hidden element (#1486)
					if ( ontype && elem[ type ] && ((type !== "focus" && type !== "blur") || event.target.offsetWidth !== 0) && !jQuery.isWindow( elem ) ) {

						// Don't re-trigger an onFOO event when we call its FOO() method
						old = elem[ ontype ];

						if ( old ) {
							elem[ ontype ] = null;
						}

						// Prevent re-triggering of the same event, since we already bubbled it above
						jQuery.event.triggered = type;
						elem[ type ]();
						jQuery.event.triggered = undefined;

						if ( old ) {
							elem[ ontype ] = old;
						}
					}
				}
			}

			return event.result;
		},

		dispatch: function( event ) {

			// Make a writable jQuery.Event from the native event object
			event = jQuery.event.fix( event || window.event );

			var handlers = ( (jQuery._data( this, "events" ) || {} )[ event.type ] || []),
				delegateCount = handlers.delegateCount,
				args = [].slice.call( arguments, 0 ),
				run_all = !event.exclusive && !event.namespace,
				special = jQuery.event.special[ event.type ] || {},
				handlerQueue = [],
				i, j, cur, jqcur, ret, selMatch, matched, matches, handleObj, sel, related;

			// Use the fix-ed jQuery.Event rather than the (read-only) native event
			args[0] = event;
			event.delegateTarget = this;

			// Call the preDispatch hook for the mapped type, and let it bail if desired
			if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
				return;
			}

			// Determine handlers that should run if there are delegated events
			// Avoid non-left-click bubbling in Firefox (#3861)
			if ( delegateCount && !(event.button && event.type === "click") ) {

				// Pregenerate a single jQuery object for reuse with .is()
				jqcur = jQuery(this);
				jqcur.context = this.ownerDocument || this;

				for ( cur = event.target; cur != this; cur = cur.parentNode || this ) {

					// Don't process events on disabled elements (#6911, #8165)
					if ( cur.disabled !== true ) {
						selMatch = {};
						matches = [];
						jqcur[0] = cur;
						for ( i = 0; i < delegateCount; i++ ) {
							handleObj = handlers[ i ];
							sel = handleObj.selector;

							if ( selMatch[ sel ] === undefined ) {
								selMatch[ sel ] = (
									handleObj.quick ? quickIs( cur, handleObj.quick ) : jqcur.is( sel )
									);
							}
							if ( selMatch[ sel ] ) {
								matches.push( handleObj );
							}
						}
						if ( matches.length ) {
							handlerQueue.push({ elem: cur, matches: matches });
						}
					}
				}
			}

			// Add the remaining (directly-bound) handlers
			if ( handlers.length > delegateCount ) {
				handlerQueue.push({ elem: this, matches: handlers.slice( delegateCount ) });
			}

			// Run delegates first; they may want to stop propagation beneath us
			for ( i = 0; i < handlerQueue.length && !event.isPropagationStopped(); i++ ) {
				matched = handlerQueue[ i ];
				event.currentTarget = matched.elem;

				for ( j = 0; j < matched.matches.length && !event.isImmediatePropagationStopped(); j++ ) {
					handleObj = matched.matches[ j ];

					// Triggered event must either 1) be non-exclusive and have no namespace, or
					// 2) have namespace(s) a subset or equal to those in the bound event (both can have no namespace).
					if ( run_all || (!event.namespace && !handleObj.namespace) || event.namespace_re && event.namespace_re.test( handleObj.namespace ) ) {

						event.data = handleObj.data;
						event.handleObj = handleObj;

						ret = ( (jQuery.event.special[ handleObj.origType ] || {}).handle || handleObj.handler )
							.apply( matched.elem, args );

						if ( ret !== undefined ) {
							event.result = ret;
							if ( ret === false ) {
								event.preventDefault();
								event.stopPropagation();
							}
						}
					}
				}
			}

			// Call the postDispatch hook for the mapped type
			if ( special.postDispatch ) {
				special.postDispatch.call( this, event );
			}

			return event.result;
		},

		// Includes some event props shared by KeyEvent and MouseEvent
		// *** attrChange attrName relatedNode srcElement  are not normalized, non-W3C, deprecated, will be removed in 1.8 ***
		props: "attrChange attrName relatedNode srcElement altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),

		fixHooks: {},

		keyHooks: {
			props: "char charCode key keyCode".split(" "),
			filter: function( event, original ) {

				// Add which for key events
				if ( event.which == null ) {
					event.which = original.charCode != null ? original.charCode : original.keyCode;
				}

				return event;
			}
		},

		mouseHooks: {
			props: "button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),
			filter: function( event, original ) {
				var eventDoc, doc, body,
					button = original.button,
					fromElement = original.fromElement;

				// Calculate pageX/Y if missing and clientX/Y available
				if ( event.pageX == null && original.clientX != null ) {
					eventDoc = event.target.ownerDocument || document;
					doc = eventDoc.documentElement;
					body = eventDoc.body;

					event.pageX = original.clientX + ( doc && doc.scrollLeft || body && body.scrollLeft || 0 ) - ( doc && doc.clientLeft || body && body.clientLeft || 0 );
					event.pageY = original.clientY + ( doc && doc.scrollTop  || body && body.scrollTop  || 0 ) - ( doc && doc.clientTop  || body && body.clientTop  || 0 );
				}

				// Add relatedTarget, if necessary
				if ( !event.relatedTarget && fromElement ) {
					event.relatedTarget = fromElement === event.target ? original.toElement : fromElement;
				}

				// Add which for click: 1 === left; 2 === middle; 3 === right
				// Note: button is not normalized, so don't use it
				if ( !event.which && button !== undefined ) {
					event.which = ( button & 1 ? 1 : ( button & 2 ? 3 : ( button & 4 ? 2 : 0 ) ) );
				}

				return event;
			}
		},

		fix: function( event ) {
			if ( event[ jQuery.expando ] ) {
				return event;
			}

			// Create a writable copy of the event object and normalize some properties
			var i, prop,
				originalEvent = event,
				fixHook = jQuery.event.fixHooks[ event.type ] || {},
				copy = fixHook.props ? this.props.concat( fixHook.props ) : this.props;

			event = jQuery.Event( originalEvent );

			for ( i = copy.length; i; ) {
				prop = copy[ --i ];
				event[ prop ] = originalEvent[ prop ];
			}

			// Fix target property, if necessary (#1925, IE 6/7/8 & Safari2)
			if ( !event.target ) {
				event.target = originalEvent.srcElement || document;
			}

			// Target should not be a text node (#504, Safari)
			if ( event.target.nodeType === 3 ) {
				event.target = event.target.parentNode;
			}

			// For mouse/key events; add metaKey if it's not there (#3368, IE6/7/8)
			if ( event.metaKey === undefined ) {
				event.metaKey = event.ctrlKey;
			}

			return fixHook.filter? fixHook.filter( event, originalEvent ) : event;
		},

		special: {
			ready: {
				// Make sure the ready event is setup
				setup: jQuery.bindReady
			},

			load: {
				// Prevent triggered image.load events from bubbling to window.load
				noBubble: true
			},

			focus: {
				delegateType: "focusin"
			},
			blur: {
				delegateType: "focusout"
			},

			beforeunload: {
				setup: function( data, namespaces, eventHandle ) {
					// We only want to do this special case on windows
					if ( jQuery.isWindow( this ) ) {
						this.onbeforeunload = eventHandle;
					}
				},

				teardown: function( namespaces, eventHandle ) {
					if ( this.onbeforeunload === eventHandle ) {
						this.onbeforeunload = null;
					}
				}
			}
		},

		simulate: function( type, elem, event, bubble ) {
			// Piggyback on a donor event to simulate a different one.
			// Fake originalEvent to avoid donor's stopPropagation, but if the
			// simulated event prevents default then we do the same on the donor.
			var e = jQuery.extend(
				new jQuery.Event(),
				event,
				{ type: type,
					isSimulated: true,
					originalEvent: {}
				}
			);
			if ( bubble ) {
				jQuery.event.trigger( e, null, elem );
			} else {
				jQuery.event.dispatch.call( elem, e );
			}
			if ( e.isDefaultPrevented() ) {
				event.preventDefault();
			}
		}
	};

// Some plugins are using, but it's undocumented/deprecated and will be removed.
// The 1.7 special event interface should provide all the hooks needed now.
	jQuery.event.handle = jQuery.event.dispatch;

	jQuery.removeEvent = document.removeEventListener ?
		function( elem, type, handle ) {
			if ( elem.removeEventListener ) {
				elem.removeEventListener( type, handle, false );
			}
		} :
		function( elem, type, handle ) {
			if ( elem.detachEvent ) {
				elem.detachEvent( "on" + type, handle );
			}
		};

	jQuery.Event = function( src, props ) {
		// Allow instantiation without the 'new' keyword
		if ( !(this instanceof jQuery.Event) ) {
			return new jQuery.Event( src, props );
		}

		// Event object
		if ( src && src.type ) {
			this.originalEvent = src;
			this.type = src.type;

			// Events bubbling up the document may have been marked as prevented
			// by a handler lower down the tree; reflect the correct value.
			this.isDefaultPrevented = ( src.defaultPrevented || src.returnValue === false ||
				src.getPreventDefault && src.getPreventDefault() ) ? returnTrue : returnFalse;

			// Event type
		} else {
			this.type = src;
		}

		// Put explicitly provided properties onto the event object
		if ( props ) {
			jQuery.extend( this, props );
		}

		// Create a timestamp if incoming event doesn't have one
		this.timeStamp = src && src.timeStamp || jQuery.now();

		// Mark it as fixed
		this[ jQuery.expando ] = true;
	};

	function returnFalse() {
		return false;
	}
	function returnTrue() {
		return true;
	}

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
	jQuery.Event.prototype = {
		preventDefault: function() {
			this.isDefaultPrevented = returnTrue;

			var e = this.originalEvent;
			if ( !e ) {
				return;
			}

			// if preventDefault exists run it on the original event
			if ( e.preventDefault ) {
				e.preventDefault();

				// otherwise set the returnValue property of the original event to false (IE)
			} else {
				e.returnValue = false;
			}
		},
		stopPropagation: function() {
			this.isPropagationStopped = returnTrue;

			var e = this.originalEvent;
			if ( !e ) {
				return;
			}
			// if stopPropagation exists run it on the original event
			if ( e.stopPropagation ) {
				e.stopPropagation();
			}
			// otherwise set the cancelBubble property of the original event to true (IE)
			e.cancelBubble = true;
		},
		stopImmediatePropagation: function() {
			this.isImmediatePropagationStopped = returnTrue;
			this.stopPropagation();
		},
		isDefaultPrevented: returnFalse,
		isPropagationStopped: returnFalse,
		isImmediatePropagationStopped: returnFalse
	};

// Create mouseenter/leave events using mouseover/out and event-time checks
	jQuery.each({
		mouseenter: "mouseover",
		mouseleave: "mouseout"
	}, function( orig, fix ) {
		jQuery.event.special[ orig ] = {
			delegateType: fix,
			bindType: fix,

			handle: function( event ) {
				var target = this,
					related = event.relatedTarget,
					handleObj = event.handleObj,
					selector = handleObj.selector,
					ret;

				// For mousenter/leave call the handler if related is outside the target.
				// NB: No relatedTarget if the mouse left/entered the browser window
				if ( !related || (related !== target && !jQuery.contains( target, related )) ) {
					event.type = handleObj.origType;
					ret = handleObj.handler.apply( this, arguments );
					event.type = fix;
				}
				return ret;
			}
		};
	});

// IE submit delegation
	if ( !jQuery.support.submitBubbles ) {

		jQuery.event.special.submit = {
			setup: function() {
				// Only need this for delegated form submit events
				if ( jQuery.nodeName( this, "form" ) ) {
					return false;
				}

				// Lazy-add a submit handler when a descendant form may potentially be submitted
				jQuery.event.add( this, "click._submit keypress._submit", function( e ) {
					// Node name check avoids a VML-related crash in IE (#9807)
					var elem = e.target,
						form = jQuery.nodeName( elem, "input" ) || jQuery.nodeName( elem, "button" ) ? elem.form : undefined;
					if ( form && !form._submit_attached ) {
						jQuery.event.add( form, "submit._submit", function( event ) {
							event._submit_bubble = true;
						});
						form._submit_attached = true;
					}
				});
				// return undefined since we don't need an event listener
			},

			postDispatch: function( event ) {
				// If form was submitted by the user, bubble the event up the tree
				if ( event._submit_bubble ) {
					delete event._submit_bubble;
					if ( this.parentNode && !event.isTrigger ) {
						jQuery.event.simulate( "submit", this.parentNode, event, true );
					}
				}
			},

			teardown: function() {
				// Only need this for delegated form submit events
				if ( jQuery.nodeName( this, "form" ) ) {
					return false;
				}

				// Remove delegated handlers; cleanData eventually reaps submit handlers attached above
				jQuery.event.remove( this, "._submit" );
			}
		};
	}

// IE change delegation and checkbox/radio fix
	if ( !jQuery.support.changeBubbles ) {

		jQuery.event.special.change = {

			setup: function() {

				if ( rformElems.test( this.nodeName ) ) {
					// IE doesn't fire change on a check/radio until blur; trigger it on click
					// after a propertychange. Eat the blur-change in special.change.handle.
					// This still fires onchange a second time for check/radio after blur.
					if ( this.type === "checkbox" || this.type === "radio" ) {
						jQuery.event.add( this, "propertychange._change", function( event ) {
							if ( event.originalEvent.propertyName === "checked" ) {
								this._just_changed = true;
							}
						});
						jQuery.event.add( this, "click._change", function( event ) {
							if ( this._just_changed && !event.isTrigger ) {
								this._just_changed = false;
								jQuery.event.simulate( "change", this, event, true );
							}
						});
					}
					return false;
				}
				// Delegated event; lazy-add a change handler on descendant inputs
				jQuery.event.add( this, "beforeactivate._change", function( e ) {
					var elem = e.target;

					if ( rformElems.test( elem.nodeName ) && !elem._change_attached ) {
						jQuery.event.add( elem, "change._change", function( event ) {
							if ( this.parentNode && !event.isSimulated && !event.isTrigger ) {
								jQuery.event.simulate( "change", this.parentNode, event, true );
							}
						});
						elem._change_attached = true;
					}
				});
			},

			handle: function( event ) {
				var elem = event.target;

				// Swallow native change events from checkbox/radio, we already triggered them above
				if ( this !== elem || event.isSimulated || event.isTrigger || (elem.type !== "radio" && elem.type !== "checkbox") ) {
					return event.handleObj.handler.apply( this, arguments );
				}
			},

			teardown: function() {
				jQuery.event.remove( this, "._change" );

				return rformElems.test( this.nodeName );
			}
		};
	}

// Create "bubbling" focus and blur events
	if ( !jQuery.support.focusinBubbles ) {
		jQuery.each({ focus: "focusin", blur: "focusout" }, function( orig, fix ) {

			// Attach a single capturing handler while someone wants focusin/focusout
			var attaches = 0,
				handler = function( event ) {
					jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ), true );
				};

			jQuery.event.special[ fix ] = {
				setup: function() {
					if ( attaches++ === 0 ) {
						document.addEventListener( orig, handler, true );
					}
				},
				teardown: function() {
					if ( --attaches === 0 ) {
						document.removeEventListener( orig, handler, true );
					}
				}
			};
		});
	}

	jQuery.fn.extend({

		on: function( types, selector, data, fn, /*INTERNAL*/ one ) {
			var origFn, type;

			// Types can be a map of types/handlers
			if ( typeof types === "object" ) {
				// ( types-Object, selector, data )
				if ( typeof selector !== "string" ) { // && selector != null
					// ( types-Object, data )
					data = data || selector;
					selector = undefined;
				}
				for ( type in types ) {
					this.on( type, selector, data, types[ type ], one );
				}
				return this;
			}

			if ( data == null && fn == null ) {
				// ( types, fn )
				fn = selector;
				data = selector = undefined;
			} else if ( fn == null ) {
				if ( typeof selector === "string" ) {
					// ( types, selector, fn )
					fn = data;
					data = undefined;
				} else {
					// ( types, data, fn )
					fn = data;
					data = selector;
					selector = undefined;
				}
			}
			if ( fn === false ) {
				fn = returnFalse;
			} else if ( !fn ) {
				return this;
			}

			if ( one === 1 ) {
				origFn = fn;
				fn = function( event ) {
					// Can use an empty set, since event contains the info
					jQuery().off( event );
					return origFn.apply( this, arguments );
				};
				// Use same guid so caller can remove using origFn
				fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
			}
			return this.each( function() {
				jQuery.event.add( this, types, fn, data, selector );
			});
		},
		one: function( types, selector, data, fn ) {
			return this.on( types, selector, data, fn, 1 );
		},
		off: function( types, selector, fn ) {
			if ( types && types.preventDefault && types.handleObj ) {
				// ( event )  dispatched jQuery.Event
				var handleObj = types.handleObj;
				jQuery( types.delegateTarget ).off(
					handleObj.namespace ? handleObj.origType + "." + handleObj.namespace : handleObj.origType,
					handleObj.selector,
					handleObj.handler
				);
				return this;
			}
			if ( typeof types === "object" ) {
				// ( types-object [, selector] )
				for ( var type in types ) {
					this.off( type, selector, types[ type ] );
				}
				return this;
			}
			if ( selector === false || typeof selector === "function" ) {
				// ( types [, fn] )
				fn = selector;
				selector = undefined;
			}
			if ( fn === false ) {
				fn = returnFalse;
			}
			return this.each(function() {
				jQuery.event.remove( this, types, fn, selector );
			});
		},

		bind: function( types, data, fn ) {
			return this.on( types, null, data, fn );
		},
		unbind: function( types, fn ) {
			return this.off( types, null, fn );
		},

		live: function( types, data, fn ) {
			jQuery( this.context ).on( types, this.selector, data, fn );
			return this;
		},
		die: function( types, fn ) {
			jQuery( this.context ).off( types, this.selector || "**", fn );
			return this;
		},

		delegate: function( selector, types, data, fn ) {
			return this.on( types, selector, data, fn );
		},
		undelegate: function( selector, types, fn ) {
			// ( namespace ) or ( selector, types [, fn] )
			return arguments.length == 1? this.off( selector, "**" ) : this.off( types, selector, fn );
		},

		trigger: function( type, data ) {
			return this.each(function() {
				jQuery.event.trigger( type, data, this );
			});
		},
		triggerHandler: function( type, data ) {
			if ( this[0] ) {
				return jQuery.event.trigger( type, data, this[0], true );
			}
		},

		toggle: function( fn ) {
			// Save reference to arguments for access in closure
			var args = arguments,
				guid = fn.guid || jQuery.guid++,
				i = 0,
				toggler = function( event ) {
					// Figure out which function to execute
					var lastToggle = ( jQuery._data( this, "lastToggle" + fn.guid ) || 0 ) % i;
					jQuery._data( this, "lastToggle" + fn.guid, lastToggle + 1 );

					// Make sure that clicks stop
					event.preventDefault();

					// and execute the function
					return args[ lastToggle ].apply( this, arguments ) || false;
				};

			// link all the functions, so any of them can unbind this click handler
			toggler.guid = guid;
			while ( i < args.length ) {
				args[ i++ ].guid = guid;
			}

			return this.click( toggler );
		},

		hover: function( fnOver, fnOut ) {
			return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
		}
	});

	jQuery.each( ("blur focus focusin focusout load resize scroll unload click dblclick " +
		"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
		"change select submit keydown keypress keyup error contextmenu").split(" "), function( i, name ) {

		// Handle event binding
		jQuery.fn[ name ] = function( data, fn ) {
			if ( fn == null ) {
				fn = data;
				data = null;
			}

			return arguments.length > 0 ?
				this.on( name, null, data, fn ) :
				this.trigger( name );
		};

		if ( jQuery.attrFn ) {
			jQuery.attrFn[ name ] = true;
		}

		if ( rkeyEvent.test( name ) ) {
			jQuery.event.fixHooks[ name ] = jQuery.event.keyHooks;
		}

		if ( rmouseEvent.test( name ) ) {
			jQuery.event.fixHooks[ name ] = jQuery.event.mouseHooks;
		}
	});



	/*!
	 * Sizzle CSS Selector Engine
	 *  Copyright 2011, The Dojo Foundation
	 *  Released under the MIT, BSD, and GPL Licenses.
	 *  More information: http://sizzlejs.com/
	 */
	(function(){

		var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^\[\]]*\]|['"][^'"]*['"]|[^\[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,
			expando = "sizcache" + (Math.random() + '').replace('.', ''),
			done = 0,
			toString = Object.prototype.toString,
			hasDuplicate = false,
			baseHasDuplicate = true,
			rBackslash = /\\/g,
			rReturn = /\r\n/g,
			rNonWord = /\W/;

// Here we check if the JavaScript engine is using some sort of
// optimization where it does not always call our comparision
// function. If that is the case, discard the hasDuplicate value.
//   Thus far that includes Google Chrome.
		[0, 0].sort(function() {
			baseHasDuplicate = false;
			return 0;
		});

		var Sizzle = function( selector, context, results, seed ) {
			results = results || [];
			context = context || document;

			var origContext = context;

			if ( context.nodeType !== 1 && context.nodeType !== 9 ) {
				return [];
			}

			if ( !selector || typeof selector !== "string" ) {
				return results;
			}

			var m, set, checkSet, extra, ret, cur, pop, i,
				prune = true,
				contextXML = Sizzle.isXML( context ),
				parts = [],
				soFar = selector;

			// Reset the position of the chunker regexp (start from head)
			do {
				chunker.exec( "" );
				m = chunker.exec( soFar );

				if ( m ) {
					soFar = m[3];

					parts.push( m[1] );

					if ( m[2] ) {
						extra = m[3];
						break;
					}
				}
			} while ( m );

			if ( parts.length > 1 && origPOS.exec( selector ) ) {

				if ( parts.length === 2 && Expr.relative[ parts[0] ] ) {
					set = posProcess( parts[0] + parts[1], context, seed );

				} else {
					set = Expr.relative[ parts[0] ] ?
						[ context ] :
						Sizzle( parts.shift(), context );

					while ( parts.length ) {
						selector = parts.shift();

						if ( Expr.relative[ selector ] ) {
							selector += parts.shift();
						}

						set = posProcess( selector, set, seed );
					}
				}

			} else {
				// Take a shortcut and set the context if the root selector is an ID
				// (but not if it'll be faster if the inner selector is an ID)
				if ( !seed && parts.length > 1 && context.nodeType === 9 && !contextXML &&
					Expr.match.ID.test(parts[0]) && !Expr.match.ID.test(parts[parts.length - 1]) ) {

					ret = Sizzle.find( parts.shift(), context, contextXML );
					context = ret.expr ?
						Sizzle.filter( ret.expr, ret.set )[0] :
						ret.set[0];
				}

				if ( context ) {
					ret = seed ?
					{ expr: parts.pop(), set: makeArray(seed) } :
						Sizzle.find( parts.pop(), parts.length === 1 && (parts[0] === "~" || parts[0] === "+") && context.parentNode ? context.parentNode : context, contextXML );

					set = ret.expr ?
						Sizzle.filter( ret.expr, ret.set ) :
						ret.set;

					if ( parts.length > 0 ) {
						checkSet = makeArray( set );

					} else {
						prune = false;
					}

					while ( parts.length ) {
						cur = parts.pop();
						pop = cur;

						if ( !Expr.relative[ cur ] ) {
							cur = "";
						} else {
							pop = parts.pop();
						}

						if ( pop == null ) {
							pop = context;
						}

						Expr.relative[ cur ]( checkSet, pop, contextXML );
					}

				} else {
					checkSet = parts = [];
				}
			}

			if ( !checkSet ) {
				checkSet = set;
			}

			if ( !checkSet ) {
				Sizzle.error( cur || selector );
			}

			if ( toString.call(checkSet) === "[object Array]" ) {
				if ( !prune ) {
					results.push.apply( results, checkSet );

				} else if ( context && context.nodeType === 1 ) {
					for ( i = 0; checkSet[i] != null; i++ ) {
						if ( checkSet[i] && (checkSet[i] === true || checkSet[i].nodeType === 1 && Sizzle.contains(context, checkSet[i])) ) {
							results.push( set[i] );
						}
					}

				} else {
					for ( i = 0; checkSet[i] != null; i++ ) {
						if ( checkSet[i] && checkSet[i].nodeType === 1 ) {
							results.push( set[i] );
						}
					}
				}

			} else {
				makeArray( checkSet, results );
			}

			if ( extra ) {
				Sizzle( extra, origContext, results, seed );
				Sizzle.uniqueSort( results );
			}

			return results;
		};

		Sizzle.uniqueSort = function( results ) {
			if ( sortOrder ) {
				hasDuplicate = baseHasDuplicate;
				results.sort( sortOrder );

				if ( hasDuplicate ) {
					for ( var i = 1; i < results.length; i++ ) {
						if ( results[i] === results[ i - 1 ] ) {
							results.splice( i--, 1 );
						}
					}
				}
			}

			return results;
		};

		Sizzle.matches = function( expr, set ) {
			return Sizzle( expr, null, null, set );
		};

		Sizzle.matchesSelector = function( node, expr ) {
			return Sizzle( expr, null, null, [node] ).length > 0;
		};

		Sizzle.find = function( expr, context, isXML ) {
			var set, i, len, match, type, left;

			if ( !expr ) {
				return [];
			}

			for ( i = 0, len = Expr.order.length; i < len; i++ ) {
				type = Expr.order[i];

				if ( (match = Expr.leftMatch[ type ].exec( expr )) ) {
					left = match[1];
					match.splice( 1, 1 );

					if ( left.substr( left.length - 1 ) !== "\\" ) {
						match[1] = (match[1] || "").replace( rBackslash, "" );
						set = Expr.find[ type ]( match, context, isXML );

						if ( set != null ) {
							expr = expr.replace( Expr.match[ type ], "" );
							break;
						}
					}
				}
			}

			if ( !set ) {
				set = typeof context.getElementsByTagName !== "undefined" ?
					context.getElementsByTagName( "*" ) :
					[];
			}

			return { set: set, expr: expr };
		};

		Sizzle.filter = function( expr, set, inplace, not ) {
			var match, anyFound,
				type, found, item, filter, left,
				i, pass,
				old = expr,
				result = [],
				curLoop = set,
				isXMLFilter = set && set[0] && Sizzle.isXML( set[0] );

			while ( expr && set.length ) {
				for ( type in Expr.filter ) {
					if ( (match = Expr.leftMatch[ type ].exec( expr )) != null && match[2] ) {
						filter = Expr.filter[ type ];
						left = match[1];

						anyFound = false;

						match.splice(1,1);

						if ( left.substr( left.length - 1 ) === "\\" ) {
							continue;
						}

						if ( curLoop === result ) {
							result = [];
						}

						if ( Expr.preFilter[ type ] ) {
							match = Expr.preFilter[ type ]( match, curLoop, inplace, result, not, isXMLFilter );

							if ( !match ) {
								anyFound = found = true;

							} else if ( match === true ) {
								continue;
							}
						}

						if ( match ) {
							for ( i = 0; (item = curLoop[i]) != null; i++ ) {
								if ( item ) {
									found = filter( item, match, i, curLoop );
									pass = not ^ found;

									if ( inplace && found != null ) {
										if ( pass ) {
											anyFound = true;

										} else {
											curLoop[i] = false;
										}

									} else if ( pass ) {
										result.push( item );
										anyFound = true;
									}
								}
							}
						}

						if ( found !== undefined ) {
							if ( !inplace ) {
								curLoop = result;
							}

							expr = expr.replace( Expr.match[ type ], "" );

							if ( !anyFound ) {
								return [];
							}

							break;
						}
					}
				}

				// Improper expression
				if ( expr === old ) {
					if ( anyFound == null ) {
						Sizzle.error( expr );

					} else {
						break;
					}
				}

				old = expr;
			}

			return curLoop;
		};

		Sizzle.error = function( msg ) {
			throw new Error( "Syntax error, unrecognized expression: " + msg );
		};

		/**
		 * Utility function for retreiving the text value of an array of DOM nodes
		 * @param {Array|Element} elem
		 */
		var getText = Sizzle.getText = function( elem ) {
			var i, node,
				nodeType = elem.nodeType,
				ret = "";

			if ( nodeType ) {
				if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
					// Use textContent || innerText for elements
					if ( typeof elem.textContent === 'string' ) {
						return elem.textContent;
					} else if ( typeof elem.innerText === 'string' ) {
						// Replace IE's carriage returns
						return elem.innerText.replace( rReturn, '' );
					} else {
						// Traverse it's children
						for ( elem = elem.firstChild; elem; elem = elem.nextSibling) {
							ret += getText( elem );
						}
					}
				} else if ( nodeType === 3 || nodeType === 4 ) {
					return elem.nodeValue;
				}
			} else {

				// If no nodeType, this is expected to be an array
				for ( i = 0; (node = elem[i]); i++ ) {
					// Do not traverse comment nodes
					if ( node.nodeType !== 8 ) {
						ret += getText( node );
					}
				}
			}
			return ret;
		};

		var Expr = Sizzle.selectors = {
			order: [ "ID", "NAME", "TAG" ],

			match: {
				ID: /#((?:[\w\u00c0-\uFFFF\-]|\\.)+)/,
				CLASS: /\.((?:[\w\u00c0-\uFFFF\-]|\\.)+)/,
				NAME: /\[name=['"]*((?:[\w\u00c0-\uFFFF\-]|\\.)+)['"]*\]/,
				ATTR: /\[\s*((?:[\w\u00c0-\uFFFF\-]|\\.)+)\s*(?:(\S?=)\s*(?:(['"])(.*?)\3|(#?(?:[\w\u00c0-\uFFFF\-]|\\.)*)|)|)\s*\]/,
				TAG: /^((?:[\w\u00c0-\uFFFF\*\-]|\\.)+)/,
				CHILD: /:(only|nth|last|first)-child(?:\(\s*(even|odd|(?:[+\-]?\d+|(?:[+\-]?\d*)?n\s*(?:[+\-]\s*\d+)?))\s*\))?/,
				POS: /:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^\-]|$)/,
				PSEUDO: /:((?:[\w\u00c0-\uFFFF\-]|\\.)+)(?:\((['"]?)((?:\([^\)]+\)|[^\(\)]*)+)\2\))?/
			},

			leftMatch: {},

			attrMap: {
				"class": "className",
				"for": "htmlFor"
			},

			attrHandle: {
				href: function( elem ) {
					return elem.getAttribute( "href" );
				},
				type: function( elem ) {
					return elem.getAttribute( "type" );
				}
			},

			relative: {
				"+": function(checkSet, part){
					var isPartStr = typeof part === "string",
						isTag = isPartStr && !rNonWord.test( part ),
						isPartStrNotTag = isPartStr && !isTag;

					if ( isTag ) {
						part = part.toLowerCase();
					}

					for ( var i = 0, l = checkSet.length, elem; i < l; i++ ) {
						if ( (elem = checkSet[i]) ) {
							while ( (elem = elem.previousSibling) && elem.nodeType !== 1 ) {}

							checkSet[i] = isPartStrNotTag || elem && elem.nodeName.toLowerCase() === part ?
								elem || false :
								elem === part;
						}
					}

					if ( isPartStrNotTag ) {
						Sizzle.filter( part, checkSet, true );
					}
				},

				">": function( checkSet, part ) {
					var elem,
						isPartStr = typeof part === "string",
						i = 0,
						l = checkSet.length;

					if ( isPartStr && !rNonWord.test( part ) ) {
						part = part.toLowerCase();

						for ( ; i < l; i++ ) {
							elem = checkSet[i];

							if ( elem ) {
								var parent = elem.parentNode;
								checkSet[i] = parent.nodeName.toLowerCase() === part ? parent : false;
							}
						}

					} else {
						for ( ; i < l; i++ ) {
							elem = checkSet[i];

							if ( elem ) {
								checkSet[i] = isPartStr ?
									elem.parentNode :
									elem.parentNode === part;
							}
						}

						if ( isPartStr ) {
							Sizzle.filter( part, checkSet, true );
						}
					}
				},

				"": function(checkSet, part, isXML){
					var nodeCheck,
						doneName = done++,
						checkFn = dirCheck;

					if ( typeof part === "string" && !rNonWord.test( part ) ) {
						part = part.toLowerCase();
						nodeCheck = part;
						checkFn = dirNodeCheck;
					}

					checkFn( "parentNode", part, doneName, checkSet, nodeCheck, isXML );
				},

				"~": function( checkSet, part, isXML ) {
					var nodeCheck,
						doneName = done++,
						checkFn = dirCheck;

					if ( typeof part === "string" && !rNonWord.test( part ) ) {
						part = part.toLowerCase();
						nodeCheck = part;
						checkFn = dirNodeCheck;
					}

					checkFn( "previousSibling", part, doneName, checkSet, nodeCheck, isXML );
				}
			},

			find: {
				ID: function( match, context, isXML ) {
					if ( typeof context.getElementById !== "undefined" && !isXML ) {
						var m = context.getElementById(match[1]);
						// Check parentNode to catch when Blackberry 4.6 returns
						// nodes that are no longer in the document #6963
						return m && m.parentNode ? [m] : [];
					}
				},

				NAME: function( match, context ) {
					if ( typeof context.getElementsByName !== "undefined" ) {
						var ret = [],
							results = context.getElementsByName( match[1] );

						for ( var i = 0, l = results.length; i < l; i++ ) {
							if ( results[i].getAttribute("name") === match[1] ) {
								ret.push( results[i] );
							}
						}

						return ret.length === 0 ? null : ret;
					}
				},

				TAG: function( match, context ) {
					if ( typeof context.getElementsByTagName !== "undefined" ) {
						return context.getElementsByTagName( match[1] );
					}
				}
			},
			preFilter: {
				CLASS: function( match, curLoop, inplace, result, not, isXML ) {
					match = " " + match[1].replace( rBackslash, "" ) + " ";

					if ( isXML ) {
						return match;
					}

					for ( var i = 0, elem; (elem = curLoop[i]) != null; i++ ) {
						if ( elem ) {
							if ( not ^ (elem.className && (" " + elem.className + " ").replace(/[\t\n\r]/g, " ").indexOf(match) >= 0) ) {
								if ( !inplace ) {
									result.push( elem );
								}

							} else if ( inplace ) {
								curLoop[i] = false;
							}
						}
					}

					return false;
				},

				ID: function( match ) {
					return match[1].replace( rBackslash, "" );
				},

				TAG: function( match, curLoop ) {
					return match[1].replace( rBackslash, "" ).toLowerCase();
				},

				CHILD: function( match ) {
					if ( match[1] === "nth" ) {
						if ( !match[2] ) {
							Sizzle.error( match[0] );
						}

						match[2] = match[2].replace(/^\+|\s*/g, '');

						// parse equations like 'even', 'odd', '5', '2n', '3n+2', '4n-1', '-n+6'
						var test = /(-?)(\d*)(?:n([+\-]?\d*))?/.exec(
							match[2] === "even" && "2n" || match[2] === "odd" && "2n+1" ||
								!/\D/.test( match[2] ) && "0n+" + match[2] || match[2]);

						// calculate the numbers (first)n+(last) including if they are negative
						match[2] = (test[1] + (test[2] || 1)) - 0;
						match[3] = test[3] - 0;
					}
					else if ( match[2] ) {
						Sizzle.error( match[0] );
					}

					// TODO: Move to normal caching system
					match[0] = done++;

					return match;
				},

				ATTR: function( match, curLoop, inplace, result, not, isXML ) {
					var name = match[1] = match[1].replace( rBackslash, "" );

					if ( !isXML && Expr.attrMap[name] ) {
						match[1] = Expr.attrMap[name];
					}

					// Handle if an un-quoted value was used
					match[4] = ( match[4] || match[5] || "" ).replace( rBackslash, "" );

					if ( match[2] === "~=" ) {
						match[4] = " " + match[4] + " ";
					}

					return match;
				},

				PSEUDO: function( match, curLoop, inplace, result, not ) {
					if ( match[1] === "not" ) {
						// If we're dealing with a complex expression, or a simple one
						if ( ( chunker.exec(match[3]) || "" ).length > 1 || /^\w/.test(match[3]) ) {
							match[3] = Sizzle(match[3], null, null, curLoop);

						} else {
							var ret = Sizzle.filter(match[3], curLoop, inplace, true ^ not);

							if ( !inplace ) {
								result.push.apply( result, ret );
							}

							return false;
						}

					} else if ( Expr.match.POS.test( match[0] ) || Expr.match.CHILD.test( match[0] ) ) {
						return true;
					}

					return match;
				},

				POS: function( match ) {
					match.unshift( true );

					return match;
				}
			},

			filters: {
				enabled: function( elem ) {
					return elem.disabled === false && elem.type !== "hidden";
				},

				disabled: function( elem ) {
					return elem.disabled === true;
				},

				checked: function( elem ) {
					return elem.checked === true;
				},

				selected: function( elem ) {
					// Accessing this property makes selected-by-default
					// options in Safari work properly
					if ( elem.parentNode ) {
						elem.parentNode.selectedIndex;
					}

					return elem.selected === true;
				},

				parent: function( elem ) {
					return !!elem.firstChild;
				},

				empty: function( elem ) {
					return !elem.firstChild;
				},

				has: function( elem, i, match ) {
					return !!Sizzle( match[3], elem ).length;
				},

				header: function( elem ) {
					return (/h\d/i).test( elem.nodeName );
				},

				text: function( elem ) {
					var attr = elem.getAttribute( "type" ), type = elem.type;
					// IE6 and 7 will map elem.type to 'text' for new HTML5 types (search, etc)
					// use getAttribute instead to test this case
					return elem.nodeName.toLowerCase() === "input" && "text" === type && ( attr === type || attr === null );
				},

				radio: function( elem ) {
					return elem.nodeName.toLowerCase() === "input" && "radio" === elem.type;
				},

				checkbox: function( elem ) {
					return elem.nodeName.toLowerCase() === "input" && "checkbox" === elem.type;
				},

				file: function( elem ) {
					return elem.nodeName.toLowerCase() === "input" && "file" === elem.type;
				},

				password: function( elem ) {
					return elem.nodeName.toLowerCase() === "input" && "password" === elem.type;
				},

				submit: function( elem ) {
					var name = elem.nodeName.toLowerCase();
					return (name === "input" || name === "button") && "submit" === elem.type;
				},

				image: function( elem ) {
					return elem.nodeName.toLowerCase() === "input" && "image" === elem.type;
				},

				reset: function( elem ) {
					var name = elem.nodeName.toLowerCase();
					return (name === "input" || name === "button") && "reset" === elem.type;
				},

				button: function( elem ) {
					var name = elem.nodeName.toLowerCase();
					return name === "input" && "button" === elem.type || name === "button";
				},

				input: function( elem ) {
					return (/input|select|textarea|button/i).test( elem.nodeName );
				},

				focus: function( elem ) {
					return elem === elem.ownerDocument.activeElement;
				}
			},
			setFilters: {
				first: function( elem, i ) {
					return i === 0;
				},

				last: function( elem, i, match, array ) {
					return i === array.length - 1;
				},

				even: function( elem, i ) {
					return i % 2 === 0;
				},

				odd: function( elem, i ) {
					return i % 2 === 1;
				},

				lt: function( elem, i, match ) {
					return i < match[3] - 0;
				},

				gt: function( elem, i, match ) {
					return i > match[3] - 0;
				},

				nth: function( elem, i, match ) {
					return match[3] - 0 === i;
				},

				eq: function( elem, i, match ) {
					return match[3] - 0 === i;
				}
			},
			filter: {
				PSEUDO: function( elem, match, i, array ) {
					var name = match[1],
						filter = Expr.filters[ name ];

					if ( filter ) {
						return filter( elem, i, match, array );

					} else if ( name === "contains" ) {
						return (elem.textContent || elem.innerText || getText([ elem ]) || "").indexOf(match[3]) >= 0;

					} else if ( name === "not" ) {
						var not = match[3];

						for ( var j = 0, l = not.length; j < l; j++ ) {
							if ( not[j] === elem ) {
								return false;
							}
						}

						return true;

					} else {
						Sizzle.error( name );
					}
				},

				CHILD: function( elem, match ) {
					var first, last,
						doneName, parent, cache,
						count, diff,
						type = match[1],
						node = elem;

					switch ( type ) {
						case "only":
						case "first":
							while ( (node = node.previousSibling) ) {
								if ( node.nodeType === 1 ) {
									return false;
								}
							}

							if ( type === "first" ) {
								return true;
							}

							node = elem;

						/* falls through */
						case "last":
							while ( (node = node.nextSibling) ) {
								if ( node.nodeType === 1 ) {
									return false;
								}
							}

							return true;

						case "nth":
							first = match[2];
							last = match[3];

							if ( first === 1 && last === 0 ) {
								return true;
							}

							doneName = match[0];
							parent = elem.parentNode;

							if ( parent && (parent[ expando ] !== doneName || !elem.nodeIndex) ) {
								count = 0;

								for ( node = parent.firstChild; node; node = node.nextSibling ) {
									if ( node.nodeType === 1 ) {
										node.nodeIndex = ++count;
									}
								}

								parent[ expando ] = doneName;
							}

							diff = elem.nodeIndex - last;

							if ( first === 0 ) {
								return diff === 0;

							} else {
								return ( diff % first === 0 && diff / first >= 0 );
							}
					}
				},

				ID: function( elem, match ) {
					return elem.nodeType === 1 && elem.getAttribute("id") === match;
				},

				TAG: function( elem, match ) {
					return (match === "*" && elem.nodeType === 1) || !!elem.nodeName && elem.nodeName.toLowerCase() === match;
				},

				CLASS: function( elem, match ) {
					return (" " + (elem.className || elem.getAttribute("class")) + " ")
						.indexOf( match ) > -1;
				},

				ATTR: function( elem, match ) {
					var name = match[1],
						result = Sizzle.attr ?
							Sizzle.attr( elem, name ) :
							Expr.attrHandle[ name ] ?
								Expr.attrHandle[ name ]( elem ) :
								elem[ name ] != null ?
									elem[ name ] :
									elem.getAttribute( name ),
						value = result + "",
						type = match[2],
						check = match[4];

					return result == null ?
						type === "!=" :
						!type && Sizzle.attr ?
							result != null :
							type === "=" ?
								value === check :
								type === "*=" ?
									value.indexOf(check) >= 0 :
									type === "~=" ?
										(" " + value + " ").indexOf(check) >= 0 :
										!check ?
											value && result !== false :
											type === "!=" ?
												value !== check :
												type === "^=" ?
													value.indexOf(check) === 0 :
													type === "$=" ?
														value.substr(value.length - check.length) === check :
														type === "|=" ?
															value === check || value.substr(0, check.length + 1) === check + "-" :
															false;
				},

				POS: function( elem, match, i, array ) {
					var name = match[2],
						filter = Expr.setFilters[ name ];

					if ( filter ) {
						return filter( elem, i, match, array );
					}
				}
			}
		};

		var origPOS = Expr.match.POS,
			fescape = function(all, num){
				return "\\" + (num - 0 + 1);
			};

		for ( var type in Expr.match ) {
			Expr.match[ type ] = new RegExp( Expr.match[ type ].source + (/(?![^\[]*\])(?![^\(]*\))/.source) );
			Expr.leftMatch[ type ] = new RegExp( /(^(?:.|\r|\n)*?)/.source + Expr.match[ type ].source.replace(/\\(\d+)/g, fescape) );
		}
// Expose origPOS
// "global" as in regardless of relation to brackets/parens
		Expr.match.globalPOS = origPOS;

		var makeArray = function( array, results ) {
			array = Array.prototype.slice.call( array, 0 );

			if ( results ) {
				results.push.apply( results, array );
				return results;
			}

			return array;
		};

// Perform a simple check to determine if the browser is capable of
// converting a NodeList to an array using builtin methods.
// Also verifies that the returned array holds DOM nodes
// (which is not the case in the Blackberry browser)
		try {
			Array.prototype.slice.call( document.documentElement.childNodes, 0 )[0].nodeType;

// Provide a fallback method if it does not work
		} catch( e ) {
			makeArray = function( array, results ) {
				var i = 0,
					ret = results || [];

				if ( toString.call(array) === "[object Array]" ) {
					Array.prototype.push.apply( ret, array );

				} else {
					if ( typeof array.length === "number" ) {
						for ( var l = array.length; i < l; i++ ) {
							ret.push( array[i] );
						}

					} else {
						for ( ; array[i]; i++ ) {
							ret.push( array[i] );
						}
					}
				}

				return ret;
			};
		}

		var sortOrder, siblingCheck;

		if ( document.documentElement.compareDocumentPosition ) {
			sortOrder = function( a, b ) {
				if ( a === b ) {
					hasDuplicate = true;
					return 0;
				}

				if ( !a.compareDocumentPosition || !b.compareDocumentPosition ) {
					return a.compareDocumentPosition ? -1 : 1;
				}

				return a.compareDocumentPosition(b) & 4 ? -1 : 1;
			};

		} else {
			sortOrder = function( a, b ) {
				// The nodes are identical, we can exit early
				if ( a === b ) {
					hasDuplicate = true;
					return 0;

					// Fallback to using sourceIndex (in IE) if it's available on both nodes
				} else if ( a.sourceIndex && b.sourceIndex ) {
					return a.sourceIndex - b.sourceIndex;
				}

				var al, bl,
					ap = [],
					bp = [],
					aup = a.parentNode,
					bup = b.parentNode,
					cur = aup;

				// If the nodes are siblings (or identical) we can do a quick check
				if ( aup === bup ) {
					return siblingCheck( a, b );

					// If no parents were found then the nodes are disconnected
				} else if ( !aup ) {
					return -1;

				} else if ( !bup ) {
					return 1;
				}

				// Otherwise they're somewhere else in the tree so we need
				// to build up a full list of the parentNodes for comparison
				while ( cur ) {
					ap.unshift( cur );
					cur = cur.parentNode;
				}

				cur = bup;

				while ( cur ) {
					bp.unshift( cur );
					cur = cur.parentNode;
				}

				al = ap.length;
				bl = bp.length;

				// Start walking down the tree looking for a discrepancy
				for ( var i = 0; i < al && i < bl; i++ ) {
					if ( ap[i] !== bp[i] ) {
						return siblingCheck( ap[i], bp[i] );
					}
				}

				// We ended someplace up the tree so do a sibling check
				return i === al ?
					siblingCheck( a, bp[i], -1 ) :
					siblingCheck( ap[i], b, 1 );
			};

			siblingCheck = function( a, b, ret ) {
				if ( a === b ) {
					return ret;
				}

				var cur = a.nextSibling;

				while ( cur ) {
					if ( cur === b ) {
						return -1;
					}

					cur = cur.nextSibling;
				}

				return 1;
			};
		}

// Check to see if the browser returns elements by name when
// querying by getElementById (and provide a workaround)
		(function(){
			// We're going to inject a fake input element with a specified name
			var form = document.createElement("div"),
				id = "script" + (new Date()).getTime(),
				root = document.documentElement;

			form.innerHTML = "<a name='" + id + "'/>";

			// Inject it into the root element, check its status, and remove it quickly
			root.insertBefore( form, root.firstChild );

			// The workaround has to do additional checks after a getElementById
			// Which slows things down for other browsers (hence the branching)
			if ( document.getElementById( id ) ) {
				Expr.find.ID = function( match, context, isXML ) {
					if ( typeof context.getElementById !== "undefined" && !isXML ) {
						var m = context.getElementById(match[1]);

						return m ?
							m.id === match[1] || typeof m.getAttributeNode !== "undefined" && m.getAttributeNode("id").nodeValue === match[1] ?
								[m] :
								undefined :
							[];
					}
				};

				Expr.filter.ID = function( elem, match ) {
					var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");

					return elem.nodeType === 1 && node && node.nodeValue === match;
				};
			}

			root.removeChild( form );

			// release memory in IE
			root = form = null;
		})();

		(function(){
			// Check to see if the browser returns only elements
			// when doing getElementsByTagName("*")

			// Create a fake element
			var div = document.createElement("div");
			div.appendChild( document.createComment("") );

			// Make sure no comments are found
			if ( div.getElementsByTagName("*").length > 0 ) {
				Expr.find.TAG = function( match, context ) {
					var results = context.getElementsByTagName( match[1] );

					// Filter out possible comments
					if ( match[1] === "*" ) {
						var tmp = [];

						for ( var i = 0; results[i]; i++ ) {
							if ( results[i].nodeType === 1 ) {
								tmp.push( results[i] );
							}
						}

						results = tmp;
					}

					return results;
				};
			}

			// Check to see if an attribute returns normalized href attributes
			div.innerHTML = "<a href='#'></a>";

			if ( div.firstChild && typeof div.firstChild.getAttribute !== "undefined" &&
				div.firstChild.getAttribute("href") !== "#" ) {

				Expr.attrHandle.href = function( elem ) {
					return elem.getAttribute( "href", 2 );
				};
			}

			// release memory in IE
			div = null;
		})();

		if ( document.querySelectorAll ) {
			(function(){
				var oldSizzle = Sizzle,
					div = document.createElement("div"),
					id = "__sizzle__";

				div.innerHTML = "<p class='TEST'></p>";

				// Safari can't handle uppercase or unicode characters when
				// in quirks mode.
				if ( div.querySelectorAll && div.querySelectorAll(".TEST").length === 0 ) {
					return;
				}

				Sizzle = function( query, context, extra, seed ) {
					context = context || document;

					// Only use querySelectorAll on non-XML documents
					// (ID selectors don't work in non-HTML documents)
					if ( !seed && !Sizzle.isXML(context) ) {
						// See if we find a selector to speed up
						var match = /^(\w+$)|^\.([\w\-]+$)|^#([\w\-]+$)/.exec( query );

						if ( match && (context.nodeType === 1 || context.nodeType === 9) ) {
							// Speed-up: Sizzle("TAG")
							if ( match[1] ) {
								return makeArray( context.getElementsByTagName( query ), extra );

								// Speed-up: Sizzle(".CLASS")
							} else if ( match[2] && Expr.find.CLASS && context.getElementsByClassName ) {
								return makeArray( context.getElementsByClassName( match[2] ), extra );
							}
						}

						if ( context.nodeType === 9 ) {
							// Speed-up: Sizzle("body")
							// The body element only exists once, optimize finding it
							if ( query === "body" && context.body ) {
								return makeArray( [ context.body ], extra );

								// Speed-up: Sizzle("#ID")
							} else if ( match && match[3] ) {
								var elem = context.getElementById( match[3] );

								// Check parentNode to catch when Blackberry 4.6 returns
								// nodes that are no longer in the document #6963
								if ( elem && elem.parentNode ) {
									// Handle the case where IE and Opera return items
									// by name instead of ID
									if ( elem.id === match[3] ) {
										return makeArray( [ elem ], extra );
									}

								} else {
									return makeArray( [], extra );
								}
							}

							try {
								return makeArray( context.querySelectorAll(query), extra );
							} catch(qsaError) {}

							// qSA works strangely on Element-rooted queries
							// We can work around this by specifying an extra ID on the root
							// and working up from there (Thanks to Andrew Dupont for the technique)
							// IE 8 doesn't work on object elements
						} else if ( context.nodeType === 1 && context.nodeName.toLowerCase() !== "object" ) {
							var oldContext = context,
								old = context.getAttribute( "id" ),
								nid = old || id,
								hasParent = context.parentNode,
								relativeHierarchySelector = /^\s*[+~]/.test( query );

							if ( !old ) {
								context.setAttribute( "id", nid );
							} else {
								nid = nid.replace( /'/g, "\\$&" );
							}
							if ( relativeHierarchySelector && hasParent ) {
								context = context.parentNode;
							}

							try {
								if ( !relativeHierarchySelector || hasParent ) {
									return makeArray( context.querySelectorAll( "[id='" + nid + "'] " + query ), extra );
								}

							} catch(pseudoError) {
							} finally {
								if ( !old ) {
									oldContext.removeAttribute( "id" );
								}
							}
						}
					}

					return oldSizzle(query, context, extra, seed);
				};

				for ( var prop in oldSizzle ) {
					Sizzle[ prop ] = oldSizzle[ prop ];
				}

				// release memory in IE
				div = null;
			})();
		}

		(function(){
			var html = document.documentElement,
				matches = html.matchesSelector || html.mozMatchesSelector || html.webkitMatchesSelector || html.msMatchesSelector;

			if ( matches ) {
				// Check to see if it's possible to do matchesSelector
				// on a disconnected node (IE 9 fails this)
				var disconnectedMatch = !matches.call( document.createElement( "div" ), "div" ),
					pseudoWorks = false;

				try {
					// This should fail with an exception
					// Gecko does not error, returns false instead
					matches.call( document.documentElement, "[test!='']:sizzle" );

				} catch( pseudoError ) {
					pseudoWorks = true;
				}

				Sizzle.matchesSelector = function( node, expr ) {
					// Make sure that attribute selectors are quoted
					expr = expr.replace(/\=\s*([^'"\]]*)\s*\]/g, "='$1']");

					if ( !Sizzle.isXML( node ) ) {
						try {
							if ( pseudoWorks || !Expr.match.PSEUDO.test( expr ) && !/!=/.test( expr ) ) {
								var ret = matches.call( node, expr );

								// IE 9's matchesSelector returns false on disconnected nodes
								if ( ret || !disconnectedMatch ||
									// As well, disconnected nodes are said to be in a document
									// fragment in IE 9, so check for that
									node.document && node.document.nodeType !== 11 ) {
									return ret;
								}
							}
						} catch(e) {}
					}

					return Sizzle(expr, null, null, [node]).length > 0;
				};
			}
		})();

		(function(){
			var div = document.createElement("div");

			div.innerHTML = "<div class='test e'></div><div class='test'></div>";

			// Opera can't find a second classname (in 9.6)
			// Also, make sure that getElementsByClassName actually exists
			if ( !div.getElementsByClassName || div.getElementsByClassName("e").length === 0 ) {
				return;
			}

			// Safari caches class attributes, doesn't catch changes (in 3.2)
			div.lastChild.className = "e";

			if ( div.getElementsByClassName("e").length === 1 ) {
				return;
			}

			Expr.order.splice(1, 0, "CLASS");
			Expr.find.CLASS = function( match, context, isXML ) {
				if ( typeof context.getElementsByClassName !== "undefined" && !isXML ) {
					return context.getElementsByClassName(match[1]);
				}
			};

			// release memory in IE
			div = null;
		})();

		function dirNodeCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
			for ( var i = 0, l = checkSet.length; i < l; i++ ) {
				var elem = checkSet[i];

				if ( elem ) {
					var match = false;

					elem = elem[dir];

					while ( elem ) {
						if ( elem[ expando ] === doneName ) {
							match = checkSet[elem.sizset];
							break;
						}

						if ( elem.nodeType === 1 && !isXML ){
							elem[ expando ] = doneName;
							elem.sizset = i;
						}

						if ( elem.nodeName.toLowerCase() === cur ) {
							match = elem;
							break;
						}

						elem = elem[dir];
					}

					checkSet[i] = match;
				}
			}
		}

		function dirCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
			for ( var i = 0, l = checkSet.length; i < l; i++ ) {
				var elem = checkSet[i];

				if ( elem ) {
					var match = false;

					elem = elem[dir];

					while ( elem ) {
						if ( elem[ expando ] === doneName ) {
							match = checkSet[elem.sizset];
							break;
						}

						if ( elem.nodeType === 1 ) {
							if ( !isXML ) {
								elem[ expando ] = doneName;
								elem.sizset = i;
							}

							if ( typeof cur !== "string" ) {
								if ( elem === cur ) {
									match = true;
									break;
								}

							} else if ( Sizzle.filter( cur, [elem] ).length > 0 ) {
								match = elem;
								break;
							}
						}

						elem = elem[dir];
					}

					checkSet[i] = match;
				}
			}
		}

		if ( document.documentElement.contains ) {
			Sizzle.contains = function( a, b ) {
				return a !== b && (a.contains ? a.contains(b) : true);
			};

		} else if ( document.documentElement.compareDocumentPosition ) {
			Sizzle.contains = function( a, b ) {
				return !!(a.compareDocumentPosition(b) & 16);
			};

		} else {
			Sizzle.contains = function() {
				return false;
			};
		}

		Sizzle.isXML = function( elem ) {
			// documentElement is verified for cases where it doesn't yet exist
			// (such as loading iframes in IE - #4833)
			var documentElement = (elem ? elem.ownerDocument || elem : 0).documentElement;

			return documentElement ? documentElement.nodeName !== "HTML" : false;
		};

		var posProcess = function( selector, context, seed ) {
			var match,
				tmpSet = [],
				later = "",
				root = context.nodeType ? [context] : context;

			// Position selectors must be done after the filter
			// And so must :not(positional) so we move all PSEUDOs to the end
			while ( (match = Expr.match.PSEUDO.exec( selector )) ) {
				later += match[0];
				selector = selector.replace( Expr.match.PSEUDO, "" );
			}

			selector = Expr.relative[selector] ? selector + "*" : selector;

			for ( var i = 0, l = root.length; i < l; i++ ) {
				Sizzle( selector, root[i], tmpSet, seed );
			}

			return Sizzle.filter( later, tmpSet );
		};

// EXPOSE
// Override sizzle attribute retrieval
		Sizzle.attr = jQuery.attr;
		Sizzle.selectors.attrMap = {};
		jQuery.find = Sizzle;
		jQuery.expr = Sizzle.selectors;
		jQuery.expr[":"] = jQuery.expr.filters;
		jQuery.unique = Sizzle.uniqueSort;
		jQuery.text = Sizzle.getText;
		jQuery.isXMLDoc = Sizzle.isXML;
		jQuery.contains = Sizzle.contains;


	})();


	var runtil = /Until$/,
		rparentsprev = /^(?:parents|prevUntil|prevAll)/,
	// Note: This RegExp should be improved, or likely pulled from Sizzle
		rmultiselector = /,/,
		isSimple = /^.[^:#\[\.,]*$/,
		slice = Array.prototype.slice,
		POS = jQuery.expr.match.globalPOS,
	// methods guaranteed to produce a unique set when starting from a unique set
		guaranteedUnique = {
			children: true,
			contents: true,
			next: true,
			prev: true
		};

	jQuery.fn.extend({
		find: function( selector ) {
			var self = this,
				i, l;

			if ( typeof selector !== "string" ) {
				return jQuery( selector ).filter(function() {
					for ( i = 0, l = self.length; i < l; i++ ) {
						if ( jQuery.contains( self[ i ], this ) ) {
							return true;
						}
					}
				});
			}

			var ret = this.pushStack( "", "find", selector ),
				length, n, r;

			for ( i = 0, l = this.length; i < l; i++ ) {
				length = ret.length;
				jQuery.find( selector, this[i], ret );

				if ( i > 0 ) {
					// Make sure that the results are unique
					for ( n = length; n < ret.length; n++ ) {
						for ( r = 0; r < length; r++ ) {
							if ( ret[r] === ret[n] ) {
								ret.splice(n--, 1);
								break;
							}
						}
					}
				}
			}

			return ret;
		},

		has: function( target ) {
			var targets = jQuery( target );
			return this.filter(function() {
				for ( var i = 0, l = targets.length; i < l; i++ ) {
					if ( jQuery.contains( this, targets[i] ) ) {
						return true;
					}
				}
			});
		},

		not: function( selector ) {
			return this.pushStack( winnow(this, selector, false), "not", selector);
		},

		filter: function( selector ) {
			return this.pushStack( winnow(this, selector, true), "filter", selector );
		},

		is: function( selector ) {
			return !!selector && (
				typeof selector === "string" ?
					// If this is a positional selector, check membership in the returned set
					// so $("p:first").is("p:last") won't return true for a doc with two "p".
					POS.test( selector ) ?
						jQuery( selector, this.context ).index( this[0] ) >= 0 :
						jQuery.filter( selector, this ).length > 0 :
					this.filter( selector ).length > 0 );
		},

		closest: function( selectors, context ) {
			var ret = [], i, l, cur = this[0];

			// Array (deprecated as of jQuery 1.7)
			if ( jQuery.isArray( selectors ) ) {
				var level = 1;

				while ( cur && cur.ownerDocument && cur !== context ) {
					for ( i = 0; i < selectors.length; i++ ) {

						if ( jQuery( cur ).is( selectors[ i ] ) ) {
							ret.push({ selector: selectors[ i ], elem: cur, level: level });
						}
					}

					cur = cur.parentNode;
					level++;
				}

				return ret;
			}

			// String
			var pos = POS.test( selectors ) || typeof selectors !== "string" ?
				jQuery( selectors, context || this.context ) :
				0;

			for ( i = 0, l = this.length; i < l; i++ ) {
				cur = this[i];

				while ( cur ) {
					if ( pos ? pos.index(cur) > -1 : jQuery.find.matchesSelector(cur, selectors) ) {
						ret.push( cur );
						break;

					} else {
						cur = cur.parentNode;
						if ( !cur || !cur.ownerDocument || cur === context || cur.nodeType === 11 ) {
							break;
						}
					}
				}
			}

			ret = ret.length > 1 ? jQuery.unique( ret ) : ret;

			return this.pushStack( ret, "closest", selectors );
		},

		// Determine the position of an element within
		// the matched set of elements
		index: function( elem ) {

			// No argument, return index in parent
			if ( !elem ) {
				return ( this[0] && this[0].parentNode ) ? this.prevAll().length : -1;
			}

			// index in selector
			if ( typeof elem === "string" ) {
				return jQuery.inArray( this[0], jQuery( elem ) );
			}

			// Locate the position of the desired element
			return jQuery.inArray(
				// If it receives a jQuery object, the first element is used
				elem.jquery ? elem[0] : elem, this );
		},

		add: function( selector, context ) {
			var set = typeof selector === "string" ?
					jQuery( selector, context ) :
					jQuery.makeArray( selector && selector.nodeType ? [ selector ] : selector ),
				all = jQuery.merge( this.get(), set );

			return this.pushStack( isDisconnected( set[0] ) || isDisconnected( all[0] ) ?
				all :
				jQuery.unique( all ) );
		},

		andSelf: function() {
			return this.add( this.prevObject );
		}
	});

// A painfully simple check to see if an element is disconnected
// from a document (should be improved, where feasible).
	function isDisconnected( node ) {
		return !node || !node.parentNode || node.parentNode.nodeType === 11;
	}

	jQuery.each({
		parent: function( elem ) {
			var parent = elem.parentNode;
			return parent && parent.nodeType !== 11 ? parent : null;
		},
		parents: function( elem ) {
			return jQuery.dir( elem, "parentNode" );
		},
		parentsUntil: function( elem, i, until ) {
			return jQuery.dir( elem, "parentNode", until );
		},
		next: function( elem ) {
			return jQuery.nth( elem, 2, "nextSibling" );
		},
		prev: function( elem ) {
			return jQuery.nth( elem, 2, "previousSibling" );
		},
		nextAll: function( elem ) {
			return jQuery.dir( elem, "nextSibling" );
		},
		prevAll: function( elem ) {
			return jQuery.dir( elem, "previousSibling" );
		},
		nextUntil: function( elem, i, until ) {
			return jQuery.dir( elem, "nextSibling", until );
		},
		prevUntil: function( elem, i, until ) {
			return jQuery.dir( elem, "previousSibling", until );
		},
		siblings: function( elem ) {
			return jQuery.sibling( ( elem.parentNode || {} ).firstChild, elem );
		},
		children: function( elem ) {
			return jQuery.sibling( elem.firstChild );
		},
		contents: function( elem ) {
			return jQuery.nodeName( elem, "iframe" ) ?
				elem.contentDocument || elem.contentWindow.document :
				jQuery.makeArray( elem.childNodes );
		}
	}, function( name, fn ) {
		jQuery.fn[ name ] = function( until, selector ) {
			var ret = jQuery.map( this, fn, until );

			if ( !runtil.test( name ) ) {
				selector = until;
			}

			if ( selector && typeof selector === "string" ) {
				ret = jQuery.filter( selector, ret );
			}

			ret = this.length > 1 && !guaranteedUnique[ name ] ? jQuery.unique( ret ) : ret;

			if ( (this.length > 1 || rmultiselector.test( selector )) && rparentsprev.test( name ) ) {
				ret = ret.reverse();
			}

			return this.pushStack( ret, name, slice.call( arguments ).join(",") );
		};
	});

	jQuery.extend({
		filter: function( expr, elems, not ) {
			if ( not ) {
				expr = ":not(" + expr + ")";
			}

			return elems.length === 1 ?
				jQuery.find.matchesSelector(elems[0], expr) ? [ elems[0] ] : [] :
				jQuery.find.matches(expr, elems);
		},

		dir: function( elem, dir, until ) {
			var matched = [],
				cur = elem[ dir ];

			while ( cur && cur.nodeType !== 9 && (until === undefined || cur.nodeType !== 1 || !jQuery( cur ).is( until )) ) {
				if ( cur.nodeType === 1 ) {
					matched.push( cur );
				}
				cur = cur[dir];
			}
			return matched;
		},

		nth: function( cur, result, dir, elem ) {
			result = result || 1;
			var num = 0;

			for ( ; cur; cur = cur[dir] ) {
				if ( cur.nodeType === 1 && ++num === result ) {
					break;
				}
			}

			return cur;
		},

		sibling: function( n, elem ) {
			var r = [];

			for ( ; n; n = n.nextSibling ) {
				if ( n.nodeType === 1 && n !== elem ) {
					r.push( n );
				}
			}

			return r;
		}
	});

// Implement the identical functionality for filter and not
	function winnow( elements, qualifier, keep ) {

		// Can't pass null or undefined to indexOf in Firefox 4
		// Set to 0 to skip string check
		qualifier = qualifier || 0;

		if ( jQuery.isFunction( qualifier ) ) {
			return jQuery.grep(elements, function( elem, i ) {
				var retVal = !!qualifier.call( elem, i, elem );
				return retVal === keep;
			});

		} else if ( qualifier.nodeType ) {
			return jQuery.grep(elements, function( elem, i ) {
				return ( elem === qualifier ) === keep;
			});

		} else if ( typeof qualifier === "string" ) {
			var filtered = jQuery.grep(elements, function( elem ) {
				return elem.nodeType === 1;
			});

			if ( isSimple.test( qualifier ) ) {
				return jQuery.filter(qualifier, filtered, !keep);
			} else {
				qualifier = jQuery.filter( qualifier, filtered );
			}
		}

		return jQuery.grep(elements, function( elem, i ) {
			return ( jQuery.inArray( elem, qualifier ) >= 0 ) === keep;
		});
	}




	function createSafeFragment( document ) {
		var list = nodeNames.split( "|" ),
			safeFrag = document.createDocumentFragment();

		if ( safeFrag.createElement ) {
			while ( list.length ) {
				safeFrag.createElement(
					list.pop()
				);
			}
		}
		return safeFrag;
	}

	var nodeNames = "abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|" +
			"header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",
		rinlinejQuery = / jQuery\d+="(?:\d+|null)"/g,
		rleadingWhitespace = /^\s+/,
		rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
		rtagName = /<([\w:]+)/,
		rtbody = /<tbody/i,
		rhtml = /<|&#?\w+;/,
		rnoInnerhtml = /<(?:script|style)/i,
		rnocache = /<(?:script|object|embed|option|style)/i,
		rnoshimcache = new RegExp("<(?:" + nodeNames + ")[\\s/>]", "i"),
	// checked="checked" or checked
		rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
		rscriptType = /\/(java|ecma)script/i,
		rcleanScript = /^\s*<!(?:\[CDATA\[|\-\-)/,
		wrapMap = {
			option: [ 1, "<select multiple='multiple'>", "</select>" ],
			legend: [ 1, "<fieldset>", "</fieldset>" ],
			thead: [ 1, "<table>", "</table>" ],
			tr: [ 2, "<table><tbody>", "</tbody></table>" ],
			td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
			col: [ 2, "<table><tbody></tbody><colgroup>", "</colgroup></table>" ],
			area: [ 1, "<map>", "</map>" ],
			_default: [ 0, "", "" ]
		},
		safeFragment = createSafeFragment( document );

	wrapMap.optgroup = wrapMap.option;
	wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
	wrapMap.th = wrapMap.td;

// IE can't serialize <link> and <script> tags normally
	if ( !jQuery.support.htmlSerialize ) {
		wrapMap._default = [ 1, "div<div>", "</div>" ];
	}

	jQuery.fn.extend({
		text: function( value ) {
			return jQuery.access( this, function( value ) {
				return value === undefined ?
					jQuery.text( this ) :
					this.empty().append( ( this[0] && this[0].ownerDocument || document ).createTextNode( value ) );
			}, null, value, arguments.length );
		},

		wrapAll: function( html ) {
			if ( jQuery.isFunction( html ) ) {
				return this.each(function(i) {
					jQuery(this).wrapAll( html.call(this, i) );
				});
			}

			if ( this[0] ) {
				// The elements to wrap the target around
				var wrap = jQuery( html, this[0].ownerDocument ).eq(0).clone(true);

				if ( this[0].parentNode ) {
					wrap.insertBefore( this[0] );
				}

				wrap.map(function() {
					var elem = this;

					while ( elem.firstChild && elem.firstChild.nodeType === 1 ) {
						elem = elem.firstChild;
					}

					return elem;
				}).append( this );
			}

			return this;
		},

		wrapInner: function( html ) {
			if ( jQuery.isFunction( html ) ) {
				return this.each(function(i) {
					jQuery(this).wrapInner( html.call(this, i) );
				});
			}

			return this.each(function() {
				var self = jQuery( this ),
					contents = self.contents();

				if ( contents.length ) {
					contents.wrapAll( html );

				} else {
					self.append( html );
				}
			});
		},

		wrap: function( html ) {
			var isFunction = jQuery.isFunction( html );

			return this.each(function(i) {
				jQuery( this ).wrapAll( isFunction ? html.call(this, i) : html );
			});
		},

		unwrap: function() {
			return this.parent().each(function() {
				if ( !jQuery.nodeName( this, "body" ) ) {
					jQuery( this ).replaceWith( this.childNodes );
				}
			}).end();
		},

		append: function() {
			return this.domManip(arguments, true, function( elem ) {
				if ( this.nodeType === 1 ) {
					this.appendChild( elem );
				}
			});
		},

		prepend: function() {
			return this.domManip(arguments, true, function( elem ) {
				if ( this.nodeType === 1 ) {
					this.insertBefore( elem, this.firstChild );
				}
			});
		},

		before: function() {
			if ( this[0] && this[0].parentNode ) {
				return this.domManip(arguments, false, function( elem ) {
					this.parentNode.insertBefore( elem, this );
				});
			} else if ( arguments.length ) {
				var set = jQuery.clean( arguments );
				set.push.apply( set, this.toArray() );
				return this.pushStack( set, "before", arguments );
			}
		},

		after: function() {
			if ( this[0] && this[0].parentNode ) {
				return this.domManip(arguments, false, function( elem ) {
					this.parentNode.insertBefore( elem, this.nextSibling );
				});
			} else if ( arguments.length ) {
				var set = this.pushStack( this, "after", arguments );
				set.push.apply( set, jQuery.clean(arguments) );
				return set;
			}
		},

		// keepData is for internal use only--do not document
		remove: function( selector, keepData ) {
			for ( var i = 0, elem; (elem = this[i]) != null; i++ ) {
				if ( !selector || jQuery.filter( selector, [ elem ] ).length ) {
					if ( !keepData && elem.nodeType === 1 ) {
						jQuery.cleanData( elem.getElementsByTagName("*") );
						jQuery.cleanData( [ elem ] );
					}

					if ( elem.parentNode ) {
						elem.parentNode.removeChild( elem );
					}
				}
			}

			return this;
		},

		empty: function() {
			for ( var i = 0, elem; (elem = this[i]) != null; i++ ) {
				// Remove element nodes and prevent memory leaks
				if ( elem.nodeType === 1 ) {
					jQuery.cleanData( elem.getElementsByTagName("*") );
				}

				// Remove any remaining nodes
				while ( elem.firstChild ) {
					elem.removeChild( elem.firstChild );
				}
			}

			return this;
		},

		clone: function( dataAndEvents, deepDataAndEvents ) {
			dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
			deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

			return this.map( function () {
				return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
			});
		},

		html: function( value ) {
			return jQuery.access( this, function( value ) {
				var elem = this[0] || {},
					i = 0,
					l = this.length;

				if ( value === undefined ) {
					return elem.nodeType === 1 ?
						elem.innerHTML.replace( rinlinejQuery, "" ) :
						null;
				}


				if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
					( jQuery.support.leadingWhitespace || !rleadingWhitespace.test( value ) ) &&
					!wrapMap[ ( rtagName.exec( value ) || ["", ""] )[1].toLowerCase() ] ) {

					value = value.replace( rxhtmlTag, "<$1></$2>" );

					try {
						for (; i < l; i++ ) {
							// Remove element nodes and prevent memory leaks
							elem = this[i] || {};
							if ( elem.nodeType === 1 ) {
								jQuery.cleanData( elem.getElementsByTagName( "*" ) );
								elem.innerHTML = value;
							}
						}

						elem = 0;

						// If using innerHTML throws an exception, use the fallback method
					} catch(e) {}
				}

				if ( elem ) {
					this.empty().append( value );
				}
			}, null, value, arguments.length );
		},

		replaceWith: function( value ) {
			if ( this[0] && this[0].parentNode ) {
				// Make sure that the elements are removed from the DOM before they are inserted
				// this can help fix replacing a parent with child elements
				if ( jQuery.isFunction( value ) ) {
					return this.each(function(i) {
						var self = jQuery(this), old = self.html();
						self.replaceWith( value.call( this, i, old ) );
					});
				}

				if ( typeof value !== "string" ) {
					value = jQuery( value ).detach();
				}

				return this.each(function() {
					var next = this.nextSibling,
						parent = this.parentNode;

					jQuery( this ).remove();

					if ( next ) {
						jQuery(next).before( value );
					} else {
						jQuery(parent).append( value );
					}
				});
			} else {
				return this.length ?
					this.pushStack( jQuery(jQuery.isFunction(value) ? value() : value), "replaceWith", value ) :
					this;
			}
		},

		detach: function( selector ) {
			return this.remove( selector, true );
		},

		domManip: function( args, table, callback ) {
			var results, first, fragment, parent,
				value = args[0],
				scripts = [];

			// We can't cloneNode fragments that contain checked, in WebKit
			if ( !jQuery.support.checkClone && arguments.length === 3 && typeof value === "string" && rchecked.test( value ) ) {
				return this.each(function() {
					jQuery(this).domManip( args, table, callback, true );
				});
			}

			if ( jQuery.isFunction(value) ) {
				return this.each(function(i) {
					var self = jQuery(this);
					args[0] = value.call(this, i, table ? self.html() : undefined);
					self.domManip( args, table, callback );
				});
			}

			if ( this[0] ) {
				parent = value && value.parentNode;

				// If we're in a fragment, just use that instead of building a new one
				if ( jQuery.support.parentNode && parent && parent.nodeType === 11 && parent.childNodes.length === this.length ) {
					results = { fragment: parent };

				} else {
					results = jQuery.buildFragment( args, this, scripts );
				}

				fragment = results.fragment;

				if ( fragment.childNodes.length === 1 ) {
					first = fragment = fragment.firstChild;
				} else {
					first = fragment.firstChild;
				}

				if ( first ) {
					table = table && jQuery.nodeName( first, "tr" );

					for ( var i = 0, l = this.length, lastIndex = l - 1; i < l; i++ ) {
						callback.call(
							table ?
								root(this[i], first) :
								this[i],
							// Make sure that we do not leak memory by inadvertently discarding
							// the original fragment (which might have attached data) instead of
							// using it; in addition, use the original fragment object for the last
							// item instead of first because it can end up being emptied incorrectly
							// in certain situations (Bug #8070).
							// Fragments from the fragment cache must always be cloned and never used
							// in place.
							results.cacheable || ( l > 1 && i < lastIndex ) ?
								jQuery.clone( fragment, true, true ) :
								fragment
						);
					}
				}

				if ( scripts.length ) {
					jQuery.each( scripts, function( i, elem ) {
						if ( elem.src ) {
							jQuery.ajax({
								type: "GET",
								global: false,
								url: elem.src,
								async: false,
								dataType: "script"
							});
						} else {
							jQuery.globalEval( ( elem.text || elem.textContent || elem.innerHTML || "" ).replace( rcleanScript, "/*$0*/" ) );
						}

						if ( elem.parentNode ) {
							elem.parentNode.removeChild( elem );
						}
					});
				}
			}

			return this;
		}
	});

	function root( elem, cur ) {
		return jQuery.nodeName(elem, "table") ?
			(elem.getElementsByTagName("tbody")[0] ||
				elem.appendChild(elem.ownerDocument.createElement("tbody"))) :
			elem;
	}

	function cloneCopyEvent( src, dest ) {

		if ( dest.nodeType !== 1 || !jQuery.hasData( src ) ) {
			return;
		}

		var type, i, l,
			oldData = jQuery._data( src ),
			curData = jQuery._data( dest, oldData ),
			events = oldData.events;

		if ( events ) {
			delete curData.handle;
			curData.events = {};

			for ( type in events ) {
				for ( i = 0, l = events[ type ].length; i < l; i++ ) {
					jQuery.event.add( dest, type, events[ type ][ i ] );
				}
			}
		}

		// make the cloned public data object a copy from the original
		if ( curData.data ) {
			curData.data = jQuery.extend( {}, curData.data );
		}
	}

	function cloneFixAttributes( src, dest ) {
		var nodeName;

		// We do not need to do anything for non-Elements
		if ( dest.nodeType !== 1 ) {
			return;
		}

		// clearAttributes removes the attributes, which we don't want,
		// but also removes the attachEvent events, which we *do* want
		if ( dest.clearAttributes ) {
			dest.clearAttributes();
		}

		// mergeAttributes, in contrast, only merges back on the
		// original attributes, not the events
		if ( dest.mergeAttributes ) {
			dest.mergeAttributes( src );
		}

		nodeName = dest.nodeName.toLowerCase();

		// IE6-8 fail to clone children inside object elements that use
		// the proprietary classid attribute value (rather than the type
		// attribute) to identify the type of content to display
		if ( nodeName === "object" ) {
			dest.outerHTML = src.outerHTML;

		} else if ( nodeName === "input" && (src.type === "checkbox" || src.type === "radio") ) {
			// IE6-8 fails to persist the checked state of a cloned checkbox
			// or radio button. Worse, IE6-7 fail to give the cloned element
			// a checked appearance if the defaultChecked value isn't also set
			if ( src.checked ) {
				dest.defaultChecked = dest.checked = src.checked;
			}

			// IE6-7 get confused and end up setting the value of a cloned
			// checkbox/radio button to an empty string instead of "on"
			if ( dest.value !== src.value ) {
				dest.value = src.value;
			}

			// IE6-8 fails to return the selected option to the default selected
			// state when cloning options
		} else if ( nodeName === "option" ) {
			dest.selected = src.defaultSelected;

			// IE6-8 fails to set the defaultValue to the correct value when
			// cloning other types of input fields
		} else if ( nodeName === "input" || nodeName === "textarea" ) {
			dest.defaultValue = src.defaultValue;

			// IE blanks contents when cloning scripts
		} else if ( nodeName === "script" && dest.text !== src.text ) {
			dest.text = src.text;
		}

		// Event data gets referenced instead of copied if the expando
		// gets copied too
		dest.removeAttribute( jQuery.expando );

		// Clear flags for bubbling special change/submit events, they must
		// be reattached when the newly cloned events are first activated
		dest.removeAttribute( "_submit_attached" );
		dest.removeAttribute( "_change_attached" );
	}

	jQuery.buildFragment = function( args, nodes, scripts ) {
		var fragment, cacheable, cacheresults, doc,
			first = args[ 0 ];

		// nodes may contain either an explicit document object,
		// a jQuery collection or context object.
		// If nodes[0] contains a valid object to assign to doc
		if ( nodes && nodes[0] ) {
			doc = nodes[0].ownerDocument || nodes[0];
		}

		// Ensure that an attr object doesn't incorrectly stand in as a document object
		// Chrome and Firefox seem to allow this to occur and will throw exception
		// Fixes #8950
		if ( !doc.createDocumentFragment ) {
			doc = document;
		}

		// Only cache "small" (1/2 KB) HTML strings that are associated with the main document
		// Cloning options loses the selected state, so don't cache them
		// IE 6 doesn't like it when you put <object> or <embed> elements in a fragment
		// Also, WebKit does not clone 'checked' attributes on cloneNode, so don't cache
		// Lastly, IE6,7,8 will not correctly reuse cached fragments that were created from unknown elems #10501
		if ( args.length === 1 && typeof first === "string" && first.length < 512 && doc === document &&
			first.charAt(0) === "<" && !rnocache.test( first ) &&
			(jQuery.support.checkClone || !rchecked.test( first )) &&
			(jQuery.support.html5Clone || !rnoshimcache.test( first )) ) {

			cacheable = true;

			cacheresults = jQuery.fragments[ first ];
			if ( cacheresults && cacheresults !== 1 ) {
				fragment = cacheresults;
			}
		}

		if ( !fragment ) {
			fragment = doc.createDocumentFragment();
			jQuery.clean( args, doc, fragment, scripts );
		}

		if ( cacheable ) {
			jQuery.fragments[ first ] = cacheresults ? fragment : 1;
		}

		return { fragment: fragment, cacheable: cacheable };
	};

	jQuery.fragments = {};

	jQuery.each({
		appendTo: "append",
		prependTo: "prepend",
		insertBefore: "before",
		insertAfter: "after",
		replaceAll: "replaceWith"
	}, function( name, original ) {
		jQuery.fn[ name ] = function( selector ) {
			var ret = [],
				insert = jQuery( selector ),
				parent = this.length === 1 && this[0].parentNode;

			if ( parent && parent.nodeType === 11 && parent.childNodes.length === 1 && insert.length === 1 ) {
				insert[ original ]( this[0] );
				return this;

			} else {
				for ( var i = 0, l = insert.length; i < l; i++ ) {
					var elems = ( i > 0 ? this.clone(true) : this ).get();
					jQuery( insert[i] )[ original ]( elems );
					ret = ret.concat( elems );
				}

				return this.pushStack( ret, name, insert.selector );
			}
		};
	});

	function getAll( elem ) {
		if ( typeof elem.getElementsByTagName !== "undefined" ) {
			return elem.getElementsByTagName( "*" );

		} else if ( typeof elem.querySelectorAll !== "undefined" ) {
			return elem.querySelectorAll( "*" );

		} else {
			return [];
		}
	}

// Used in clean, fixes the defaultChecked property
	function fixDefaultChecked( elem ) {
		if ( elem.type === "checkbox" || elem.type === "radio" ) {
			elem.defaultChecked = elem.checked;
		}
	}
// Finds all inputs and passes them to fixDefaultChecked
	function findInputs( elem ) {
		var nodeName = ( elem.nodeName || "" ).toLowerCase();
		if ( nodeName === "input" ) {
			fixDefaultChecked( elem );
			// Skip scripts, get other children
		} else if ( nodeName !== "script" && typeof elem.getElementsByTagName !== "undefined" ) {
			jQuery.grep( elem.getElementsByTagName("input"), fixDefaultChecked );
		}
	}

// Derived From: http://www.iecss.com/shimprove/javascript/shimprove.1-0-1.js
	function shimCloneNode( elem ) {
		var div = document.createElement( "div" );
		safeFragment.appendChild( div );

		div.innerHTML = elem.outerHTML;
		return div.firstChild;
	}

	jQuery.extend({
		clone: function( elem, dataAndEvents, deepDataAndEvents ) {
			var srcElements,
				destElements,
				i,
			// IE<=8 does not properly clone detached, unknown element nodes
				clone = jQuery.support.html5Clone || jQuery.isXMLDoc(elem) || !rnoshimcache.test( "<" + elem.nodeName + ">" ) ?
					elem.cloneNode( true ) :
					shimCloneNode( elem );

			if ( (!jQuery.support.noCloneEvent || !jQuery.support.noCloneChecked) &&
				(elem.nodeType === 1 || elem.nodeType === 11) && !jQuery.isXMLDoc(elem) ) {
				// IE copies events bound via attachEvent when using cloneNode.
				// Calling detachEvent on the clone will also remove the events
				// from the original. In order to get around this, we use some
				// proprietary methods to clear the events. Thanks to MooTools
				// guys for this hotness.

				cloneFixAttributes( elem, clone );

				// Using Sizzle here is crazy slow, so we use getElementsByTagName instead
				srcElements = getAll( elem );
				destElements = getAll( clone );

				// Weird iteration because IE will replace the length property
				// with an element if you are cloning the body and one of the
				// elements on the page has a name or id of "length"
				for ( i = 0; srcElements[i]; ++i ) {
					// Ensure that the destination node is not null; Fixes #9587
					if ( destElements[i] ) {
						cloneFixAttributes( srcElements[i], destElements[i] );
					}
				}
			}

			// Copy the events from the original to the clone
			if ( dataAndEvents ) {
				cloneCopyEvent( elem, clone );

				if ( deepDataAndEvents ) {
					srcElements = getAll( elem );
					destElements = getAll( clone );

					for ( i = 0; srcElements[i]; ++i ) {
						cloneCopyEvent( srcElements[i], destElements[i] );
					}
				}
			}

			srcElements = destElements = null;

			// Return the cloned set
			return clone;
		},

		clean: function( elems, context, fragment, scripts ) {
			var checkScriptType, script, j,
				ret = [];

			context = context || document;

			// !context.createElement fails in IE with an error but returns typeof 'object'
			if ( typeof context.createElement === "undefined" ) {
				context = context.ownerDocument || context[0] && context[0].ownerDocument || document;
			}

			for ( var i = 0, elem; (elem = elems[i]) != null; i++ ) {
				if ( typeof elem === "number" ) {
					elem += "";
				}

				if ( !elem ) {
					continue;
				}

				// Convert html string into DOM nodes
				if ( typeof elem === "string" ) {
					if ( !rhtml.test( elem ) ) {
						elem = context.createTextNode( elem );
					} else {
						// Fix "XHTML"-style tags in all browsers
						elem = elem.replace(rxhtmlTag, "<$1></$2>");

						// Trim whitespace, otherwise indexOf won't work as expected
						var tag = ( rtagName.exec( elem ) || ["", ""] )[1].toLowerCase(),
							wrap = wrapMap[ tag ] || wrapMap._default,
							depth = wrap[0],
							div = context.createElement("div"),
							safeChildNodes = safeFragment.childNodes,
							remove;

						// Append wrapper element to unknown element safe doc fragment
						if ( context === document ) {
							// Use the fragment we've already created for this document
							safeFragment.appendChild( div );
						} else {
							// Use a fragment created with the owner document
							createSafeFragment( context ).appendChild( div );
						}

						// Go to html and back, then peel off extra wrappers
						div.innerHTML = wrap[1] + elem + wrap[2];

						// Move to the right depth
						while ( depth-- ) {
							div = div.lastChild;
						}

						// Remove IE's autoinserted <tbody> from table fragments
						if ( !jQuery.support.tbody ) {

							// String was a <table>, *may* have spurious <tbody>
							var hasBody = rtbody.test(elem),
								tbody = tag === "table" && !hasBody ?
									div.firstChild && div.firstChild.childNodes :

									// String was a bare <thead> or <tfoot>
									wrap[1] === "<table>" && !hasBody ?
										div.childNodes :
										[];

							for ( j = tbody.length - 1; j >= 0 ; --j ) {
								if ( jQuery.nodeName( tbody[ j ], "tbody" ) && !tbody[ j ].childNodes.length ) {
									tbody[ j ].parentNode.removeChild( tbody[ j ] );
								}
							}
						}

						// IE completely kills leading whitespace when innerHTML is used
						if ( !jQuery.support.leadingWhitespace && rleadingWhitespace.test( elem ) ) {
							div.insertBefore( context.createTextNode( rleadingWhitespace.exec(elem)[0] ), div.firstChild );
						}

						elem = div.childNodes;

						// Clear elements from DocumentFragment (safeFragment or otherwise)
						// to avoid hoarding elements. Fixes #11356
						if ( div ) {
							div.parentNode.removeChild( div );

							// Guard against -1 index exceptions in FF3.6
							if ( safeChildNodes.length > 0 ) {
								remove = safeChildNodes[ safeChildNodes.length - 1 ];

								if ( remove && remove.parentNode ) {
									remove.parentNode.removeChild( remove );
								}
							}
						}
					}
				}

				// Resets defaultChecked for any radios and checkboxes
				// about to be appended to the DOM in IE 6/7 (#8060)
				var len;
				if ( !jQuery.support.appendChecked ) {
					if ( elem[0] && typeof (len = elem.length) === "number" ) {
						for ( j = 0; j < len; j++ ) {
							findInputs( elem[j] );
						}
					} else {
						findInputs( elem );
					}
				}

				if ( elem.nodeType ) {
					ret.push( elem );
				} else {
					ret = jQuery.merge( ret, elem );
				}
			}

			if ( fragment ) {
				checkScriptType = function( elem ) {
					return !elem.type || rscriptType.test( elem.type );
				};
				for ( i = 0; ret[i]; i++ ) {
					script = ret[i];
					if ( scripts && jQuery.nodeName( script, "script" ) && (!script.type || rscriptType.test( script.type )) ) {
						scripts.push( script.parentNode ? script.parentNode.removeChild( script ) : script );

					} else {
						if ( script.nodeType === 1 ) {
							var jsTags = jQuery.grep( script.getElementsByTagName( "script" ), checkScriptType );

							ret.splice.apply( ret, [i + 1, 0].concat( jsTags ) );
						}
						fragment.appendChild( script );
					}
				}
			}

			return ret;
		},

		cleanData: function( elems ) {
			var data, id,
				cache = jQuery.cache,
				special = jQuery.event.special,
				deleteExpando = jQuery.support.deleteExpando;

			for ( var i = 0, elem; (elem = elems[i]) != null; i++ ) {
				if ( elem.nodeName && jQuery.noData[elem.nodeName.toLowerCase()] ) {
					continue;
				}

				id = elem[ jQuery.expando ];

				if ( id ) {
					data = cache[ id ];

					if ( data && data.events ) {
						for ( var type in data.events ) {
							if ( special[ type ] ) {
								jQuery.event.remove( elem, type );

								// This is a shortcut to avoid jQuery.event.remove's overhead
							} else {
								jQuery.removeEvent( elem, type, data.handle );
							}
						}

						// Null the DOM reference to avoid IE6/7/8 leak (#7054)
						if ( data.handle ) {
							data.handle.elem = null;
						}
					}

					if ( deleteExpando ) {
						delete elem[ jQuery.expando ];

					} else if ( elem.removeAttribute ) {
						elem.removeAttribute( jQuery.expando );
					}

					delete cache[ id ];
				}
			}
		}
	});




	var ralpha = /alpha\([^)]*\)/i,
		ropacity = /opacity=([^)]*)/,
	// fixed for IE9, see #8346
		rupper = /([A-Z]|^ms)/g,
		rnum = /^[\-+]?(?:\d*\.)?\d+$/i,
		rnumnonpx = /^-?(?:\d*\.)?\d+(?!px)[^\d\s]+$/i,
		rrelNum = /^([\-+])=([\-+.\de]+)/,
		rmargin = /^margin/,

		cssShow = { position: "absolute", visibility: "hidden", display: "block" },

	// order is important!
		cssExpand = [ "Top", "Right", "Bottom", "Left" ],

		curCSS,

		getComputedStyle,
		currentStyle;

	jQuery.fn.css = function( name, value ) {
		return jQuery.access( this, function( elem, name, value ) {
			return value !== undefined ?
				jQuery.style( elem, name, value ) :
				jQuery.css( elem, name );
		}, name, value, arguments.length > 1 );
	};

	jQuery.extend({
		// Add in style property hooks for overriding the default
		// behavior of getting and setting a style property
		cssHooks: {
			opacity: {
				get: function( elem, computed ) {
					if ( computed ) {
						// We should always get a number back from opacity
						var ret = curCSS( elem, "opacity" );
						return ret === "" ? "1" : ret;

					} else {
						return elem.style.opacity;
					}
				}
			}
		},

		// Exclude the following css properties to add px
		cssNumber: {
			"fillOpacity": true,
			"fontWeight": true,
			"lineHeight": true,
			"opacity": true,
			"orphans": true,
			"widows": true,
			"zIndex": true,
			"zoom": true
		},

		// Add in properties whose names you wish to fix before
		// setting or getting the value
		cssProps: {
			// normalize float css property
			"float": jQuery.support.cssFloat ? "cssFloat" : "styleFloat"
		},

		// Get and set the style property on a DOM Node
		style: function( elem, name, value, extra ) {
			// Don't set styles on text and comment nodes
			if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
				return;
			}

			// Make sure that we're working with the right name
			var ret, type, origName = jQuery.camelCase( name ),
				style = elem.style, hooks = jQuery.cssHooks[ origName ];

			name = jQuery.cssProps[ origName ] || origName;

			// Check if we're setting a value
			if ( value !== undefined ) {
				type = typeof value;

				// convert relative number strings (+= or -=) to relative numbers. #7345
				if ( type === "string" && (ret = rrelNum.exec( value )) ) {
					value = ( +( ret[1] + 1) * +ret[2] ) + parseFloat( jQuery.css( elem, name ) );
					// Fixes bug #9237
					type = "number";
				}

				// Make sure that NaN and null values aren't set. See: #7116
				if ( value == null || type === "number" && isNaN( value ) ) {
					return;
				}

				// If a number was passed in, add 'px' to the (except for certain CSS properties)
				if ( type === "number" && !jQuery.cssNumber[ origName ] ) {
					value += "px";
				}

				// If a hook was provided, use that value, otherwise just set the specified value
				if ( !hooks || !("set" in hooks) || (value = hooks.set( elem, value )) !== undefined ) {
					// Wrapped to prevent IE from throwing errors when 'invalid' values are provided
					// Fixes bug #5509
					try {
						style[ name ] = value;
					} catch(e) {}
				}

			} else {
				// If a hook was provided get the non-computed value from there
				if ( hooks && "get" in hooks && (ret = hooks.get( elem, false, extra )) !== undefined ) {
					return ret;
				}

				// Otherwise just get the value from the style object
				return style[ name ];
			}
		},

		css: function( elem, name, extra ) {
			var ret, hooks;

			// Make sure that we're working with the right name
			name = jQuery.camelCase( name );
			hooks = jQuery.cssHooks[ name ];
			name = jQuery.cssProps[ name ] || name;

			// cssFloat needs a special treatment
			if ( name === "cssFloat" ) {
				name = "float";
			}

			// If a hook was provided get the computed value from there
			if ( hooks && "get" in hooks && (ret = hooks.get( elem, true, extra )) !== undefined ) {
				return ret;

				// Otherwise, if a way to get the computed value exists, use that
			} else if ( curCSS ) {
				return curCSS( elem, name );
			}
		},

		// A method for quickly swapping in/out CSS properties to get correct calculations
		swap: function( elem, options, callback ) {
			var old = {},
				ret, name;

			// Remember the old values, and insert the new ones
			for ( name in options ) {
				old[ name ] = elem.style[ name ];
				elem.style[ name ] = options[ name ];
			}

			ret = callback.call( elem );

			// Revert the old values
			for ( name in options ) {
				elem.style[ name ] = old[ name ];
			}

			return ret;
		}
	});

// DEPRECATED in 1.3, Use jQuery.css() instead
	jQuery.curCSS = jQuery.css;

	if ( document.defaultView && document.defaultView.getComputedStyle ) {
		getComputedStyle = function( elem, name ) {
			var ret, defaultView, computedStyle, width,
				style = elem.style;

			name = name.replace( rupper, "-$1" ).toLowerCase();

			if ( (defaultView = elem.ownerDocument.defaultView) &&
				(computedStyle = defaultView.getComputedStyle( elem, null )) ) {

				ret = computedStyle.getPropertyValue( name );
				if ( ret === "" && !jQuery.contains( elem.ownerDocument.documentElement, elem ) ) {
					ret = jQuery.style( elem, name );
				}
			}

			// A tribute to the "awesome hack by Dean Edwards"
			// WebKit uses "computed value (percentage if specified)" instead of "used value" for margins
			// which is against the CSSOM draft spec: http://dev.w3.org/csswg/cssom/#resolved-values
			if ( !jQuery.support.pixelMargin && computedStyle && rmargin.test( name ) && rnumnonpx.test( ret ) ) {
				width = style.width;
				style.width = ret;
				ret = computedStyle.width;
				style.width = width;
			}

			return ret;
		};
	}

	if ( document.documentElement.currentStyle ) {
		currentStyle = function( elem, name ) {
			var left, rsLeft, uncomputed,
				ret = elem.currentStyle && elem.currentStyle[ name ],
				style = elem.style;

			// Avoid setting ret to empty string here
			// so we don't default to auto
			if ( ret == null && style && (uncomputed = style[ name ]) ) {
				ret = uncomputed;
			}

			// From the awesome hack by Dean Edwards
			// http://erik.eae.net/archives/2007/07/27/18.54.15/#comment-102291

			// If we're not dealing with a regular pixel number
			// but a number that has a weird ending, we need to convert it to pixels
			if ( rnumnonpx.test( ret ) ) {

				// Remember the original values
				left = style.left;
				rsLeft = elem.runtimeStyle && elem.runtimeStyle.left;

				// Put in the new values to get a computed value out
				if ( rsLeft ) {
					elem.runtimeStyle.left = elem.currentStyle.left;
				}
				style.left = name === "fontSize" ? "1em" : ret;
				ret = style.pixelLeft + "px";

				// Revert the changed values
				style.left = left;
				if ( rsLeft ) {
					elem.runtimeStyle.left = rsLeft;
				}
			}

			return ret === "" ? "auto" : ret;
		};
	}

	curCSS = getComputedStyle || currentStyle;

	function getWidthOrHeight( elem, name, extra ) {

		// Start with offset property
		var val = name === "width" ? elem.offsetWidth : elem.offsetHeight,
			i = name === "width" ? 1 : 0,
			len = 4;

		if ( val > 0 ) {
			if ( extra !== "border" ) {
				for ( ; i < len; i += 2 ) {
					if ( !extra ) {
						val -= parseFloat( jQuery.css( elem, "padding" + cssExpand[ i ] ) ) || 0;
					}
					if ( extra === "margin" ) {
						val += parseFloat( jQuery.css( elem, extra + cssExpand[ i ] ) ) || 0;
					} else {
						val -= parseFloat( jQuery.css( elem, "border" + cssExpand[ i ] + "Width" ) ) || 0;
					}
				}
			}

			return val + "px";
		}

		// Fall back to computed then uncomputed css if necessary
		val = curCSS( elem, name );
		if ( val < 0 || val == null ) {
			val = elem.style[ name ];
		}

		// Computed unit is not pixels. Stop here and return.
		if ( rnumnonpx.test(val) ) {
			return val;
		}

		// Normalize "", auto, and prepare for extra
		val = parseFloat( val ) || 0;

		// Add padding, border, margin
		if ( extra ) {
			for ( ; i < len; i += 2 ) {
				val += parseFloat( jQuery.css( elem, "padding" + cssExpand[ i ] ) ) || 0;
				if ( extra !== "padding" ) {
					val += parseFloat( jQuery.css( elem, "border" + cssExpand[ i ] + "Width" ) ) || 0;
				}
				if ( extra === "margin" ) {
					val += parseFloat( jQuery.css( elem, extra + cssExpand[ i ]) ) || 0;
				}
			}
		}

		return val + "px";
	}

	jQuery.each([ "height", "width" ], function( i, name ) {
		jQuery.cssHooks[ name ] = {
			get: function( elem, computed, extra ) {
				if ( computed ) {
					if ( elem.offsetWidth !== 0 ) {
						return getWidthOrHeight( elem, name, extra );
					} else {
						return jQuery.swap( elem, cssShow, function() {
							return getWidthOrHeight( elem, name, extra );
						});
					}
				}
			},

			set: function( elem, value ) {
				return rnum.test( value ) ?
					value + "px" :
					value;
			}
		};
	});

	if ( !jQuery.support.opacity ) {
		jQuery.cssHooks.opacity = {
			get: function( elem, computed ) {
				// IE uses filters for opacity
				return ropacity.test( (computed && elem.currentStyle ? elem.currentStyle.filter : elem.style.filter) || "" ) ?
					( parseFloat( RegExp.$1 ) / 100 ) + "" :
					computed ? "1" : "";
			},

			set: function( elem, value ) {
				var style = elem.style,
					currentStyle = elem.currentStyle,
					opacity = jQuery.isNumeric( value ) ? "alpha(opacity=" + value * 100 + ")" : "",
					filter = currentStyle && currentStyle.filter || style.filter || "";

				// IE has trouble with opacity if it does not have layout
				// Force it by setting the zoom level
				style.zoom = 1;

				// if setting opacity to 1, and no other filters exist - attempt to remove filter attribute #6652
				if ( value >= 1 && jQuery.trim( filter.replace( ralpha, "" ) ) === "" ) {

					// Setting style.filter to null, "" & " " still leave "filter:" in the cssText
					// if "filter:" is present at all, clearType is disabled, we want to avoid this
					// style.removeAttribute is IE Only, but so apparently is this code path...
					style.removeAttribute( "filter" );

					// if there there is no filter style applied in a css rule, we are done
					if ( currentStyle && !currentStyle.filter ) {
						return;
					}
				}

				// otherwise, set new filter values
				style.filter = ralpha.test( filter ) ?
					filter.replace( ralpha, opacity ) :
					filter + " " + opacity;
			}
		};
	}

	jQuery(function() {
		// This hook cannot be added until DOM ready because the support test
		// for it is not run until after DOM ready
		if ( !jQuery.support.reliableMarginRight ) {
			jQuery.cssHooks.marginRight = {
				get: function( elem, computed ) {
					// WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
					// Work around by temporarily setting element display to inline-block
					return jQuery.swap( elem, { "display": "inline-block" }, function() {
						if ( computed ) {
							return curCSS( elem, "margin-right" );
						} else {
							return elem.style.marginRight;
						}
					});
				}
			};
		}
	});

	if ( jQuery.expr && jQuery.expr.filters ) {
		jQuery.expr.filters.hidden = function( elem ) {
			var width = elem.offsetWidth,
				height = elem.offsetHeight;

			return ( width === 0 && height === 0 ) || (!jQuery.support.reliableHiddenOffsets && ((elem.style && elem.style.display) || jQuery.css( elem, "display" )) === "none");
		};

		jQuery.expr.filters.visible = function( elem ) {
			return !jQuery.expr.filters.hidden( elem );
		};
	}

// These hooks are used by animate to expand properties
	jQuery.each({
		margin: "",
		padding: "",
		border: "Width"
	}, function( prefix, suffix ) {

		jQuery.cssHooks[ prefix + suffix ] = {
			expand: function( value ) {
				var i,

				// assumes a single number if not a string
					parts = typeof value === "string" ? value.split(" ") : [ value ],
					expanded = {};

				for ( i = 0; i < 4; i++ ) {
					expanded[ prefix + cssExpand[ i ] + suffix ] =
						parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
				}

				return expanded;
			}
		};
	});




	var r20 = /%20/g,
		rbracket = /\[\]$/,
		rCRLF = /\r?\n/g,
		rhash = /#.*$/,
		rheaders = /^(.*?):[ \t]*([^\r\n]*)\r?$/mg, // IE leaves an \r character at EOL
		rinput = /^(?:color|date|datetime|datetime-local|email|hidden|month|number|password|range|search|tel|text|time|url|week)$/i,
	// #7653, #8125, #8152: local protocol detection
		rlocalProtocol = /^(?:about|app|app\-storage|.+\-extension|file|res|widget):$/,
		rnoContent = /^(?:GET|HEAD)$/,
		rprotocol = /^\/\//,
		rquery = /\?/,
		rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
		rselectTextarea = /^(?:select|textarea)/i,
		rspacesAjax = /\s+/,
		rts = /([?&])_=[^&]*/,
		rurl = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/,

	// Keep a copy of the old load method
		_load = jQuery.fn.load,

	/* Prefilters
	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
	 * 2) These are called:
	 *    - BEFORE asking for a transport
	 *    - AFTER param serialization (s.data is a string if s.processData is true)
	 * 3) key is the dataType
	 * 4) the catchall symbol "*" can be used
	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
	 */
		prefilters = {},

	/* Transports bindings
	 * 1) key is the dataType
	 * 2) the catchall symbol "*" can be used
	 * 3) selection will start with transport dataType and THEN go to "*" if needed
	 */
		transports = {},

	// Document location
		ajaxLocation,

	// Document location segments
		ajaxLocParts,

	// Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
		allTypes = ["*/"] + ["*"];

// #8138, IE may throw an exception when accessing
// a field from window.location if document.domain has been set
	try {
		ajaxLocation = location.href;
	} catch( e ) {
		// Use the href attribute of an A element
		// since IE will modify it given document.location
		ajaxLocation = document.createElement( "a" );
		ajaxLocation.href = "";
		ajaxLocation = ajaxLocation.href;
	}

// Segment location into parts
	ajaxLocParts = rurl.exec( ajaxLocation.toLowerCase() ) || [];

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
	function addToPrefiltersOrTransports( structure ) {

		// dataTypeExpression is optional and defaults to "*"
		return function( dataTypeExpression, func ) {

			if ( typeof dataTypeExpression !== "string" ) {
				func = dataTypeExpression;
				dataTypeExpression = "*";
			}

			if ( jQuery.isFunction( func ) ) {
				var dataTypes = dataTypeExpression.toLowerCase().split( rspacesAjax ),
					i = 0,
					length = dataTypes.length,
					dataType,
					list,
					placeBefore;

				// For each dataType in the dataTypeExpression
				for ( ; i < length; i++ ) {
					dataType = dataTypes[ i ];
					// We control if we're asked to add before
					// any existing element
					placeBefore = /^\+/.test( dataType );
					if ( placeBefore ) {
						dataType = dataType.substr( 1 ) || "*";
					}
					list = structure[ dataType ] = structure[ dataType ] || [];
					// then we add to the structure accordingly
					list[ placeBefore ? "unshift" : "push" ]( func );
				}
			}
		};
	}

// Base inspection function for prefilters and transports
	function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR,
																					dataType /* internal */, inspected /* internal */ ) {

		dataType = dataType || options.dataTypes[ 0 ];
		inspected = inspected || {};

		inspected[ dataType ] = true;

		var list = structure[ dataType ],
			i = 0,
			length = list ? list.length : 0,
			executeOnly = ( structure === prefilters ),
			selection;

		for ( ; i < length && ( executeOnly || !selection ); i++ ) {
			selection = list[ i ]( options, originalOptions, jqXHR );
			// If we got redirected to another dataType
			// we try there if executing only and not done already
			if ( typeof selection === "string" ) {
				if ( !executeOnly || inspected[ selection ] ) {
					selection = undefined;
				} else {
					options.dataTypes.unshift( selection );
					selection = inspectPrefiltersOrTransports(
						structure, options, originalOptions, jqXHR, selection, inspected );
				}
			}
		}
		// If we're only executing or nothing was selected
		// we try the catchall dataType if not done already
		if ( ( executeOnly || !selection ) && !inspected[ "*" ] ) {
			selection = inspectPrefiltersOrTransports(
				structure, options, originalOptions, jqXHR, "*", inspected );
		}
		// unnecessary when only executing (prefilters)
		// but it'll be ignored by the caller in that case
		return selection;
	}

// A special extend for ajax options
// that takes "flat" options (not to be deep extended)
// Fixes #9887
	function ajaxExtend( target, src ) {
		var key, deep,
			flatOptions = jQuery.ajaxSettings.flatOptions || {};
		for ( key in src ) {
			if ( src[ key ] !== undefined ) {
				( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
			}
		}
		if ( deep ) {
			jQuery.extend( true, target, deep );
		}
	}

	jQuery.fn.extend({
		load: function( url, params, callback ) {
			if ( typeof url !== "string" && _load ) {
				return _load.apply( this, arguments );

				// Don't do a request if no elements are being requested
			} else if ( !this.length ) {
				return this;
			}

			var off = url.indexOf( " " );
			if ( off >= 0 ) {
				var selector = url.slice( off, url.length );
				url = url.slice( 0, off );
			}

			// Default to a GET request
			var type = "GET";

			// If the second parameter was provided
			if ( params ) {
				// If it's a function
				if ( jQuery.isFunction( params ) ) {
					// We assume that it's the callback
					callback = params;
					params = undefined;

					// Otherwise, build a param string
				} else if ( typeof params === "object" ) {
					params = jQuery.param( params, jQuery.ajaxSettings.traditional );
					type = "POST";
				}
			}

			var self = this;

			// Request the remote document
			jQuery.ajax({
				url: url,
				type: type,
				dataType: "html",
				data: params,
				// Complete callback (responseText is used internally)
				complete: function( jqXHR, status, responseText ) {
					// Store the response as specified by the jqXHR object
					responseText = jqXHR.responseText;
					// If successful, inject the HTML into all the matched elements
					if ( jqXHR.isResolved() ) {
						// #4825: Get the actual response in case
						// a dataFilter is present in ajaxSettings
						jqXHR.done(function( r ) {
							responseText = r;
						});
						// See if a selector was specified
						self.html( selector ?
							// Create a dummy div to hold the results
							jQuery("<div>")
								// inject the contents of the document in, removing the scripts
								// to avoid any 'Permission Denied' errors in IE
								.append(responseText.replace(rscript, ""))

								// Locate the specified elements
								.find(selector) :

							// If not, just inject the full result
							responseText );
					}

					if ( callback ) {
						self.each( callback, [ responseText, status, jqXHR ] );
					}
				}
			});

			return this;
		},

		serialize: function() {
			return jQuery.param( this.serializeArray() );
		},

		serializeArray: function() {
			return this.map(function(){
				return this.elements ? jQuery.makeArray( this.elements ) : this;
			})
				.filter(function(){
					return this.name && !this.disabled &&
						( this.checked || rselectTextarea.test( this.nodeName ) ||
							rinput.test( this.type ) );
				})
				.map(function( i, elem ){
					var val = jQuery( this ).val();

					return val == null ?
						null :
						jQuery.isArray( val ) ?
							jQuery.map( val, function( val, i ){
								return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
							}) :
						{ name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
				}).get();
		}
	});

// Attach a bunch of functions for handling common AJAX events
	jQuery.each( "ajaxStart ajaxStop ajaxComplete ajaxError ajaxSuccess ajaxSend".split( " " ), function( i, o ){
		jQuery.fn[ o ] = function( f ){
			return this.on( o, f );
		};
	});

	jQuery.each( [ "get", "post" ], function( i, method ) {
		jQuery[ method ] = function( url, data, callback, type ) {
			// shift arguments if data argument was omitted
			if ( jQuery.isFunction( data ) ) {
				type = type || callback;
				callback = data;
				data = undefined;
			}

			return jQuery.ajax({
				type: method,
				url: url,
				data: data,
				success: callback,
				dataType: type
			});
		};
	});

	jQuery.extend({

		getScript: function( url, callback ) {
			return jQuery.get( url, undefined, callback, "script" );
		},

		getJSON: function( url, data, callback ) {
			return jQuery.get( url, data, callback, "json" );
		},

		// Creates a full fledged settings object into target
		// with both ajaxSettings and settings fields.
		// If target is omitted, writes into ajaxSettings.
		ajaxSetup: function( target, settings ) {
			if ( settings ) {
				// Building a settings object
				ajaxExtend( target, jQuery.ajaxSettings );
			} else {
				// Extending ajaxSettings
				settings = target;
				target = jQuery.ajaxSettings;
			}
			ajaxExtend( target, settings );
			return target;
		},

		ajaxSettings: {
			url: ajaxLocation,
			isLocal: rlocalProtocol.test( ajaxLocParts[ 1 ] ),
			global: true,
			type: "GET",
			contentType: "application/x-www-form-urlencoded; charset=UTF-8",
			processData: true,
			async: true,
			/*
			 timeout: 0,
			 data: null,
			 dataType: null,
			 username: null,
			 password: null,
			 cache: null,
			 traditional: false,
			 headers: {},
			 */

			accepts: {
				xml: "application/xml, text/xml",
				html: "text/html",
				text: "text/plain",
				json: "application/json, text/javascript",
				"*": allTypes
			},

			contents: {
				xml: /xml/,
				html: /html/,
				json: /json/
			},

			responseFields: {
				xml: "responseXML",
				text: "responseText"
			},

			// List of data converters
			// 1) key format is "source_type destination_type" (a single space in-between)
			// 2) the catchall symbol "*" can be used for source_type
			converters: {

				// Convert anything to text
				"* text": window.String,

				// Text to html (true = no transformation)
				"text html": true,

				// Evaluate text as a json expression
				"text json": jQuery.parseJSON,

				// Parse text as xml
				"text xml": jQuery.parseXML
			},

			// For options that shouldn't be deep extended:
			// you can add your own custom options here if
			// and when you create one that shouldn't be
			// deep extended (see ajaxExtend)
			flatOptions: {
				context: true,
				url: true
			}
		},

		ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
		ajaxTransport: addToPrefiltersOrTransports( transports ),

		// Main method
		ajax: function( url, options ) {

			// If url is an object, simulate pre-1.5 signature
			if ( typeof url === "object" ) {
				options = url;
				url = undefined;
			}

			// Force options to be an object
			options = options || {};

			var // Create the final options object
				s = jQuery.ajaxSetup( {}, options ),
			// Callbacks context
				callbackContext = s.context || s,
			// Context for global events
			// It's the callbackContext if one was provided in the options
			// and if it's a DOM node or a jQuery collection
				globalEventContext = callbackContext !== s &&
					( callbackContext.nodeType || callbackContext instanceof jQuery ) ?
					jQuery( callbackContext ) : jQuery.event,
			// Deferreds
				deferred = jQuery.Deferred(),
				completeDeferred = jQuery.Callbacks( "once memory" ),
			// Status-dependent callbacks
				statusCode = s.statusCode || {},
			// ifModified key
				ifModifiedKey,
			// Headers (they are sent all at once)
				requestHeaders = {},
				requestHeadersNames = {},
			// Response headers
				responseHeadersString,
				responseHeaders,
			// transport
				transport,
			// timeout handle
				timeoutTimer,
			// Cross-domain detection vars
				parts,
			// The jqXHR state
				state = 0,
			// To know if global events are to be dispatched
				fireGlobals,
			// Loop variable
				i,
			// Fake xhr
				jqXHR = {

					readyState: 0,

					// Caches the header
					setRequestHeader: function( name, value ) {
						if ( !state ) {
							var lname = name.toLowerCase();
							name = requestHeadersNames[ lname ] = requestHeadersNames[ lname ] || name;
							requestHeaders[ name ] = value;
						}
						return this;
					},

					// Raw string
					getAllResponseHeaders: function() {
						return state === 2 ? responseHeadersString : null;
					},

					// Builds headers hashtable if needed
					getResponseHeader: function( key ) {
						var match;
						if ( state === 2 ) {
							if ( !responseHeaders ) {
								responseHeaders = {};
								while( ( match = rheaders.exec( responseHeadersString ) ) ) {
									responseHeaders[ match[1].toLowerCase() ] = match[ 2 ];
								}
							}
							match = responseHeaders[ key.toLowerCase() ];
						}
						return match === undefined ? null : match;
					},

					// Overrides response content-type header
					overrideMimeType: function( type ) {
						if ( !state ) {
							s.mimeType = type;
						}
						return this;
					},

					// Cancel the request
					abort: function( statusText ) {
						statusText = statusText || "abort";
						if ( transport ) {
							transport.abort( statusText );
						}
						done( 0, statusText );
						return this;
					}
				};

			// Callback for when everything is done
			// It is defined here because jslint complains if it is declared
			// at the end of the function (which would be more logical and readable)
			function done( status, nativeStatusText, responses, headers ) {

				// Called once
				if ( state === 2 ) {
					return;
				}

				// State is "done" now
				state = 2;

				// Clear timeout if it exists
				if ( timeoutTimer ) {
					clearTimeout( timeoutTimer );
				}

				// Dereference transport for early garbage collection
				// (no matter how long the jqXHR object will be used)
				transport = undefined;

				// Cache response headers
				responseHeadersString = headers || "";

				// Set readyState
				jqXHR.readyState = status > 0 ? 4 : 0;

				var isSuccess,
					success,
					error,
					statusText = nativeStatusText,
					response = responses ? ajaxHandleResponses( s, jqXHR, responses ) : undefined,
					lastModified,
					etag;

				// If successful, handle type chaining
				if ( status >= 200 && status < 300 || status === 304 ) {

					// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
					if ( s.ifModified ) {

						if ( ( lastModified = jqXHR.getResponseHeader( "Last-Modified" ) ) ) {
							jQuery.lastModified[ ifModifiedKey ] = lastModified;
						}
						if ( ( etag = jqXHR.getResponseHeader( "Etag" ) ) ) {
							jQuery.etag[ ifModifiedKey ] = etag;
						}
					}

					// If not modified
					if ( status === 304 ) {

						statusText = "notmodified";
						isSuccess = true;

						// If we have data
					} else {

						try {
							success = ajaxConvert( s, response );
							statusText = "success";
							isSuccess = true;
						} catch(e) {
							// We have a parsererror
							statusText = "parsererror";
							error = e;
						}
					}
				} else {
					// We extract error from statusText
					// then normalize statusText and status for non-aborts
					error = statusText;
					if ( !statusText || status ) {
						statusText = "error";
						if ( status < 0 ) {
							status = 0;
						}
					}
				}

				// Set data for the fake xhr object
				jqXHR.status = status;
				jqXHR.statusText = "" + ( nativeStatusText || statusText );

				// Success/Error
				if ( isSuccess ) {
					deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
				} else {
					deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
				}

				// Status-dependent callbacks
				jqXHR.statusCode( statusCode );
				statusCode = undefined;

				if ( fireGlobals ) {
					globalEventContext.trigger( "ajax" + ( isSuccess ? "Success" : "Error" ),
						[ jqXHR, s, isSuccess ? success : error ] );
				}

				// Complete
				completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

				if ( fireGlobals ) {
					globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );
					// Handle the global AJAX counter
					if ( !( --jQuery.active ) ) {
						jQuery.event.trigger( "ajaxStop" );
					}
				}
			}

			// Attach deferreds
			deferred.promise( jqXHR );
			jqXHR.success = jqXHR.done;
			jqXHR.error = jqXHR.fail;
			jqXHR.complete = completeDeferred.add;

			// Status-dependent callbacks
			jqXHR.statusCode = function( map ) {
				if ( map ) {
					var tmp;
					if ( state < 2 ) {
						for ( tmp in map ) {
							statusCode[ tmp ] = [ statusCode[tmp], map[tmp] ];
						}
					} else {
						tmp = map[ jqXHR.status ];
						jqXHR.then( tmp, tmp );
					}
				}
				return this;
			};

			// Remove hash character (#7531: and string promotion)
			// Add protocol if not provided (#5866: IE7 issue with protocol-less urls)
			// We also use the url parameter if available
			s.url = ( ( url || s.url ) + "" ).replace( rhash, "" ).replace( rprotocol, ajaxLocParts[ 1 ] + "//" );

			// Extract dataTypes list
			s.dataTypes = jQuery.trim( s.dataType || "*" ).toLowerCase().split( rspacesAjax );

			// Determine if a cross-domain request is in order
			if ( s.crossDomain == null ) {
				parts = rurl.exec( s.url.toLowerCase() );
				s.crossDomain = !!( parts &&
					( parts[ 1 ] != ajaxLocParts[ 1 ] || parts[ 2 ] != ajaxLocParts[ 2 ] ||
						( parts[ 3 ] || ( parts[ 1 ] === "http:" ? 80 : 443 ) ) !=
							( ajaxLocParts[ 3 ] || ( ajaxLocParts[ 1 ] === "http:" ? 80 : 443 ) ) )
					);
			}

			// Convert data if not already a string
			if ( s.data && s.processData && typeof s.data !== "string" ) {
				s.data = jQuery.param( s.data, s.traditional );
			}

			// Apply prefilters
			inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

			// If request was aborted inside a prefilter, stop there
			if ( state === 2 ) {
				return false;
			}

			// We can fire global events as of now if asked to
			fireGlobals = s.global;

			// Uppercase the type
			s.type = s.type.toUpperCase();

			// Determine if request has content
			s.hasContent = !rnoContent.test( s.type );

			// Watch for a new set of requests
			if ( fireGlobals && jQuery.active++ === 0 ) {
				jQuery.event.trigger( "ajaxStart" );
			}

			// More options handling for requests with no content
			if ( !s.hasContent ) {

				// If data is available, append data to url
				if ( s.data ) {
					s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.data;
					// #9682: remove data so that it's not used in an eventual retry
					delete s.data;
				}

				// Get ifModifiedKey before adding the anti-cache parameter
				ifModifiedKey = s.url;

				// Add anti-cache in url if needed
				if ( s.cache === false ) {

					var ts = jQuery.now(),
					// try replacing _= if it is there
						ret = s.url.replace( rts, "$1_=" + ts );

					// if nothing was replaced, add timestamp to the end
					s.url = ret + ( ( ret === s.url ) ? ( rquery.test( s.url ) ? "&" : "?" ) + "_=" + ts : "" );
				}
			}

			// Set the correct header, if data is being sent
			if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
				jqXHR.setRequestHeader( "Content-Type", s.contentType );
			}

			// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
			if ( s.ifModified ) {
				ifModifiedKey = ifModifiedKey || s.url;
				if ( jQuery.lastModified[ ifModifiedKey ] ) {
					jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ ifModifiedKey ] );
				}
				if ( jQuery.etag[ ifModifiedKey ] ) {
					jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ ifModifiedKey ] );
				}
			}

			// Set the Accepts header for the server, depending on the dataType
			jqXHR.setRequestHeader(
				"Accept",
				s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[0] ] ?
					s.accepts[ s.dataTypes[0] ] + ( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
					s.accepts[ "*" ]
			);

			// Check for headers option
			for ( i in s.headers ) {
				jqXHR.setRequestHeader( i, s.headers[ i ] );
			}

			// Allow custom headers/mimetypes and early abort
			if ( s.beforeSend && ( s.beforeSend.call( callbackContext, jqXHR, s ) === false || state === 2 ) ) {
				// Abort if not done already
				jqXHR.abort();
				return false;

			}

			// Install callbacks on deferreds
			for ( i in { success: 1, error: 1, complete: 1 } ) {
				jqXHR[ i ]( s[ i ] );
			}

			// Get transport
			transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

			// If no transport, we auto-abort
			if ( !transport ) {
				done( -1, "No Transport" );
			} else {
				jqXHR.readyState = 1;
				// Send global event
				if ( fireGlobals ) {
					globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
				}
				// Timeout
				if ( s.async && s.timeout > 0 ) {
					timeoutTimer = setTimeout( function(){
						jqXHR.abort( "timeout" );
					}, s.timeout );
				}

				try {
					state = 1;
					transport.send( requestHeaders, done );
				} catch (e) {
					// Propagate exception as error if not done
					if ( state < 2 ) {
						done( -1, e );
						// Simply rethrow otherwise
					} else {
						throw e;
					}
				}
			}

			return jqXHR;
		},

		// Serialize an array of form elements or a set of
		// key/values into a query string
		param: function( a, traditional ) {
			var s = [],
				add = function( key, value ) {
					// If value is a function, invoke it and return its value
					value = jQuery.isFunction( value ) ? value() : value;
					s[ s.length ] = encodeURIComponent( key ) + "=" + encodeURIComponent( value );
				};

			// Set traditional to true for jQuery <= 1.3.2 behavior.
			if ( traditional === undefined ) {
				traditional = jQuery.ajaxSettings.traditional;
			}

			// If an array was passed in, assume that it is an array of form elements.
			if ( jQuery.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {
				// Serialize the form elements
				jQuery.each( a, function() {
					add( this.name, this.value );
				});

			} else {
				// If traditional, encode the "old" way (the way 1.3.2 or older
				// did it), otherwise encode params recursively.
				for ( var prefix in a ) {
					buildParams( prefix, a[ prefix ], traditional, add );
				}
			}

			// Return the resulting serialization
			return s.join( "&" ).replace( r20, "+" );
		}
	});

	function buildParams( prefix, obj, traditional, add ) {
		if ( jQuery.isArray( obj ) ) {
			// Serialize array item.
			jQuery.each( obj, function( i, v ) {
				if ( traditional || rbracket.test( prefix ) ) {
					// Treat each array item as a scalar.
					add( prefix, v );

				} else {
					// If array item is non-scalar (array or object), encode its
					// numeric index to resolve deserialization ambiguity issues.
					// Note that rack (as of 1.0.0) can't currently deserialize
					// nested arrays properly, and attempting to do so may cause
					// a server error. Possible fixes are to modify rack's
					// deserialization algorithm or to provide an option or flag
					// to force array serialization to be shallow.
					buildParams( prefix + "[" + ( typeof v === "object" ? i : "" ) + "]", v, traditional, add );
				}
			});

		} else if ( !traditional && jQuery.type( obj ) === "object" ) {
			// Serialize object item.
			for ( var name in obj ) {
				buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
			}

		} else {
			// Serialize scalar item.
			add( prefix, obj );
		}
	}

// This is still on the jQuery object... for now
// Want to move this to jQuery.ajax some day
	jQuery.extend({

		// Counter for holding the number of active queries
		active: 0,

		// Last-Modified header cache for next request
		lastModified: {},
		etag: {}

	});

	/* Handles responses to an ajax request:
	 * - sets all responseXXX fields accordingly
	 * - finds the right dataType (mediates between content-type and expected dataType)
	 * - returns the corresponding response
	 */
	function ajaxHandleResponses( s, jqXHR, responses ) {

		var contents = s.contents,
			dataTypes = s.dataTypes,
			responseFields = s.responseFields,
			ct,
			type,
			finalDataType,
			firstDataType;

		// Fill responseXXX fields
		for ( type in responseFields ) {
			if ( type in responses ) {
				jqXHR[ responseFields[type] ] = responses[ type ];
			}
		}

		// Remove auto dataType and get content-type in the process
		while( dataTypes[ 0 ] === "*" ) {
			dataTypes.shift();
			if ( ct === undefined ) {
				ct = s.mimeType || jqXHR.getResponseHeader( "content-type" );
			}
		}

		// Check if we're dealing with a known content-type
		if ( ct ) {
			for ( type in contents ) {
				if ( contents[ type ] && contents[ type ].test( ct ) ) {
					dataTypes.unshift( type );
					break;
				}
			}
		}

		// Check to see if we have a response for the expected dataType
		if ( dataTypes[ 0 ] in responses ) {
			finalDataType = dataTypes[ 0 ];
		} else {
			// Try convertible dataTypes
			for ( type in responses ) {
				if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[0] ] ) {
					finalDataType = type;
					break;
				}
				if ( !firstDataType ) {
					firstDataType = type;
				}
			}
			// Or just use first one
			finalDataType = finalDataType || firstDataType;
		}

		// If we found a dataType
		// We add the dataType to the list if needed
		// and return the corresponding response
		if ( finalDataType ) {
			if ( finalDataType !== dataTypes[ 0 ] ) {
				dataTypes.unshift( finalDataType );
			}
			return responses[ finalDataType ];
		}
	}

// Chain conversions given the request and the original response
	function ajaxConvert( s, response ) {

		// Apply the dataFilter if provided
		if ( s.dataFilter ) {
			response = s.dataFilter( response, s.dataType );
		}

		var dataTypes = s.dataTypes,
			converters = {},
			i,
			key,
			length = dataTypes.length,
			tmp,
		// Current and previous dataTypes
			current = dataTypes[ 0 ],
			prev,
		// Conversion expression
			conversion,
		// Conversion function
			conv,
		// Conversion functions (transitive conversion)
			conv1,
			conv2;

		// For each dataType in the chain
		for ( i = 1; i < length; i++ ) {

			// Create converters map
			// with lowercased keys
			if ( i === 1 ) {
				for ( key in s.converters ) {
					if ( typeof key === "string" ) {
						converters[ key.toLowerCase() ] = s.converters[ key ];
					}
				}
			}

			// Get the dataTypes
			prev = current;
			current = dataTypes[ i ];

			// If current is auto dataType, update it to prev
			if ( current === "*" ) {
				current = prev;
				// If no auto and dataTypes are actually different
			} else if ( prev !== "*" && prev !== current ) {

				// Get the converter
				conversion = prev + " " + current;
				conv = converters[ conversion ] || converters[ "* " + current ];

				// If there is no direct converter, search transitively
				if ( !conv ) {
					conv2 = undefined;
					for ( conv1 in converters ) {
						tmp = conv1.split( " " );
						if ( tmp[ 0 ] === prev || tmp[ 0 ] === "*" ) {
							conv2 = converters[ tmp[1] + " " + current ];
							if ( conv2 ) {
								conv1 = converters[ conv1 ];
								if ( conv1 === true ) {
									conv = conv2;
								} else if ( conv2 === true ) {
									conv = conv1;
								}
								break;
							}
						}
					}
				}
				// If we found no converter, dispatch an error
				if ( !( conv || conv2 ) ) {
					jQuery.error( "No conversion from " + conversion.replace(" "," to ") );
				}
				// If found converter is not an equivalence
				if ( conv !== true ) {
					// Convert with 1 or 2 converters accordingly
					response = conv ? conv( response ) : conv2( conv1(response) );
				}
			}
		}
		return response;
	}




	var jsc = jQuery.now(),
		jsre = /(\=)\?(&|$)|\?\?/i;

// Default jsonp settings
	jQuery.ajaxSetup({
		jsonp: "callback",
		jsonpCallback: function() {
			return jQuery.expando + "_" + ( jsc++ );
		}
	});

// Detect, normalize options and install callbacks for jsonp requests
	jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

		var inspectData = ( typeof s.data === "string" ) && /^application\/x\-www\-form\-urlencoded/.test( s.contentType );

		if ( s.dataTypes[ 0 ] === "jsonp" ||
			s.jsonp !== false && ( jsre.test( s.url ) ||
				inspectData && jsre.test( s.data ) ) ) {

			var responseContainer,
				jsonpCallback = s.jsonpCallback =
					jQuery.isFunction( s.jsonpCallback ) ? s.jsonpCallback() : s.jsonpCallback,
				previous = window[ jsonpCallback ],
				url = s.url,
				data = s.data,
				replace = "$1" + jsonpCallback + "$2";

			if ( s.jsonp !== false ) {
				url = url.replace( jsre, replace );
				if ( s.url === url ) {
					if ( inspectData ) {
						data = data.replace( jsre, replace );
					}
					if ( s.data === data ) {
						// Add callback manually
						url += (/\?/.test( url ) ? "&" : "?") + s.jsonp + "=" + jsonpCallback;
					}
				}
			}

			s.url = url;
			s.data = data;

			// Install callback
			window[ jsonpCallback ] = function( response ) {
				responseContainer = [ response ];
			};

			// Clean-up function
			jqXHR.always(function() {
				// Set callback back to previous value
				window[ jsonpCallback ] = previous;
				// Call if it was a function and we have a response
				if ( responseContainer && jQuery.isFunction( previous ) ) {
					window[ jsonpCallback ]( responseContainer[ 0 ] );
				}
			});

			// Use data converter to retrieve json after script execution
			s.converters["script json"] = function() {
				if ( !responseContainer ) {
					jQuery.error( jsonpCallback + " was not called" );
				}
				return responseContainer[ 0 ];
			};

			// force json dataType
			s.dataTypes[ 0 ] = "json";

			// Delegate to script
			return "script";
		}
	});




// Install script dataType
	jQuery.ajaxSetup({
		accepts: {
			script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"
		},
		contents: {
			script: /javascript|ecmascript/
		},
		converters: {
			"text script": function( text ) {
				jQuery.globalEval( text );
				return text;
			}
		}
	});

// Handle cache's special case and global
	jQuery.ajaxPrefilter( "script", function( s ) {
		if ( s.cache === undefined ) {
			s.cache = false;
		}
		if ( s.crossDomain ) {
			s.type = "GET";
			s.global = false;
		}
	});

// Bind script tag hack transport
	jQuery.ajaxTransport( "script", function(s) {

		// This transport only deals with cross domain requests
		if ( s.crossDomain ) {

			var script,
				head = document.head || document.getElementsByTagName( "head" )[0] || document.documentElement;

			return {

				send: function( _, callback ) {

					script = document.createElement( "script" );

					script.async = "async";

					if ( s.scriptCharset ) {
						script.charset = s.scriptCharset;
					}

					script.src = s.url;

					// Attach handlers for all browsers
					script.onload = script.onreadystatechange = function( _, isAbort ) {

						if ( isAbort || !script.readyState || /loaded|complete/.test( script.readyState ) ) {

							// Handle memory leak in IE
							script.onload = script.onreadystatechange = null;

							// Remove the script
							if ( head && script.parentNode ) {
								head.removeChild( script );
							}

							// Dereference the script
							script = undefined;

							// Callback if not abort
							if ( !isAbort ) {
								callback( 200, "success" );
							}
						}
					};
					// Use insertBefore instead of appendChild  to circumvent an IE6 bug.
					// This arises when a base node is used (#2709 and #4378).
					head.insertBefore( script, head.firstChild );
				},

				abort: function() {
					if ( script ) {
						script.onload( 0, 1 );
					}
				}
			};
		}
	});




	var // #5280: Internet Explorer will keep connections alive if we don't abort on unload
		xhrOnUnloadAbort = window.ActiveXObject ? function() {
			// Abort all pending requests
			for ( var key in xhrCallbacks ) {
				xhrCallbacks[ key ]( 0, 1 );
			}
		} : false,
		xhrId = 0,
		xhrCallbacks;

// Functions to create xhrs
	function createStandardXHR() {
		try {
			return new window.XMLHttpRequest();
		} catch( e ) {}
	}

	function createActiveXHR() {
		try {
			return new window.ActiveXObject( "Microsoft.XMLHTTP" );
		} catch( e ) {}
	}

// Create the request object
// (This is still attached to ajaxSettings for backward compatibility)
	jQuery.ajaxSettings.xhr = window.ActiveXObject ?
		/* Microsoft failed to properly
		 * implement the XMLHttpRequest in IE7 (can't request local files),
		 * so we use the ActiveXObject when it is available
		 * Additionally XMLHttpRequest can be disabled in IE7/IE8 so
		 * we need a fallback.
		 */
		function() {
			return !this.isLocal && createStandardXHR() || createActiveXHR();
		} :
		// For all other browsers, use the standard XMLHttpRequest object
		createStandardXHR;

// Determine support properties
	(function( xhr ) {
		jQuery.extend( jQuery.support, {
			ajax: !!xhr,
			cors: !!xhr && ( "withCredentials" in xhr )
		});
	})( jQuery.ajaxSettings.xhr() );

// Create transport if the browser can provide an xhr
	if ( jQuery.support.ajax ) {

		jQuery.ajaxTransport(function( s ) {
			// Cross domain only allowed if supported through XMLHttpRequest
			if ( !s.crossDomain || jQuery.support.cors ) {

				var callback;

				return {
					send: function( headers, complete ) {

						// Get a new xhr
						var xhr = s.xhr(),
							handle,
							i;

						// Open the socket
						// Passing null username, generates a login popup on Opera (#2865)
						if ( s.username ) {
							xhr.open( s.type, s.url, s.async, s.username, s.password );
						} else {
							xhr.open( s.type, s.url, s.async );
						}

						// Apply custom fields if provided
						if ( s.xhrFields ) {
							for ( i in s.xhrFields ) {
								xhr[ i ] = s.xhrFields[ i ];
							}
						}

						// Override mime type if needed
						if ( s.mimeType && xhr.overrideMimeType ) {
							xhr.overrideMimeType( s.mimeType );
						}

						// X-Requested-With header
						// For cross-domain requests, seeing as conditions for a preflight are
						// akin to a jigsaw puzzle, we simply never set it to be sure.
						// (it can always be set on a per-request basis or even using ajaxSetup)
						// For same-domain requests, won't change header if already provided.
						if ( !s.crossDomain && !headers["X-Requested-With"] ) {
							headers[ "X-Requested-With" ] = "XMLHttpRequest";
						}

						// Need an extra try/catch for cross domain requests in Firefox 3
						try {
							for ( i in headers ) {
								xhr.setRequestHeader( i, headers[ i ] );
							}
						} catch( _ ) {}

						// Do send the request
						// This may raise an exception which is actually
						// handled in jQuery.ajax (so no try/catch here)
						xhr.send( ( s.hasContent && s.data ) || null );

						// Listener
						callback = function( _, isAbort ) {

							var status,
								statusText,
								responseHeaders,
								responses,
								xml;

							// Firefox throws exceptions when accessing properties
							// of an xhr when a network error occured
							// http://helpful.knobs-dials.com/index.php/Component_returned_failure_code:_0x80040111_(NS_ERROR_NOT_AVAILABLE)
							try {

								// Was never called and is aborted or complete
								if ( callback && ( isAbort || xhr.readyState === 4 ) ) {

									// Only called once
									callback = undefined;

									// Do not keep as active anymore
									if ( handle ) {
										xhr.onreadystatechange = jQuery.noop;
										if ( xhrOnUnloadAbort ) {
											delete xhrCallbacks[ handle ];
										}
									}

									// If it's an abort
									if ( isAbort ) {
										// Abort it manually if needed
										if ( xhr.readyState !== 4 ) {
											xhr.abort();
										}
									} else {
										status = xhr.status;
										responseHeaders = xhr.getAllResponseHeaders();
										responses = {};
										xml = xhr.responseXML;

										// Construct response list
										if ( xml && xml.documentElement /* #4958 */ ) {
											responses.xml = xml;
										}

										// When requesting binary data, IE6-9 will throw an exception
										// on any attempt to access responseText (#11426)
										try {
											responses.text = xhr.responseText;
										} catch( _ ) {
										}

										// Firefox throws an exception when accessing
										// statusText for faulty cross-domain requests
										try {
											statusText = xhr.statusText;
										} catch( e ) {
											// We normalize with Webkit giving an empty statusText
											statusText = "";
										}

										// Filter status for non standard behaviors

										// If the request is local and we have data: assume a success
										// (success with no data won't get notified, that's the best we
										// can do given current implementations)
										if ( !status && s.isLocal && !s.crossDomain ) {
											status = responses.text ? 200 : 404;
											// IE - #1450: sometimes returns 1223 when it should be 204
										} else if ( status === 1223 ) {
											status = 204;
										}
									}
								}
							} catch( firefoxAccessException ) {
								if ( !isAbort ) {
									complete( -1, firefoxAccessException );
								}
							}

							// Call complete if needed
							if ( responses ) {
								complete( status, statusText, responses, responseHeaders );
							}
						};

						// if we're in sync mode or it's in cache
						// and has been retrieved directly (IE6 & IE7)
						// we need to manually fire the callback
						if ( !s.async || xhr.readyState === 4 ) {
							callback();
						} else {
							handle = ++xhrId;
							if ( xhrOnUnloadAbort ) {
								// Create the active xhrs callbacks list if needed
								// and attach the unload handler
								if ( !xhrCallbacks ) {
									xhrCallbacks = {};
									jQuery( window ).unload( xhrOnUnloadAbort );
								}
								// Add to list of active xhrs callbacks
								xhrCallbacks[ handle ] = callback;
							}
							xhr.onreadystatechange = callback;
						}
					},

					abort: function() {
						if ( callback ) {
							callback(0,1);
						}
					}
				};
			}
		});
	}




	var elemdisplay = {},
		iframe, iframeDoc,
		rfxtypes = /^(?:toggle|show|hide)$/,
		rfxnum = /^([+\-]=)?([\d+.\-]+)([a-z%]*)$/i,
		timerId,
		fxAttrs = [
			// height animations
			[ "height", "marginTop", "marginBottom", "paddingTop", "paddingBottom" ],
			// width animations
			[ "width", "marginLeft", "marginRight", "paddingLeft", "paddingRight" ],
			// opacity animations
			[ "opacity" ]
		],
		fxNow;

	jQuery.fn.extend({
		show: function( speed, easing, callback ) {
			var elem, display;

			if ( speed || speed === 0 ) {
				return this.animate( genFx("show", 3), speed, easing, callback );

			} else {
				for ( var i = 0, j = this.length; i < j; i++ ) {
					elem = this[ i ];

					if ( elem.style ) {
						display = elem.style.display;

						// Reset the inline display of this element to learn if it is
						// being hidden by cascaded rules or not
						if ( !jQuery._data(elem, "olddisplay") && display === "none" ) {
							display = elem.style.display = "";
						}

						// Set elements which have been overridden with display: none
						// in a stylesheet to whatever the default browser style is
						// for such an element
						if ( (display === "" && jQuery.css(elem, "display") === "none") ||
							!jQuery.contains( elem.ownerDocument.documentElement, elem ) ) {
							jQuery._data( elem, "olddisplay", defaultDisplay(elem.nodeName) );
						}
					}
				}

				// Set the display of most of the elements in a second loop
				// to avoid the constant reflow
				for ( i = 0; i < j; i++ ) {
					elem = this[ i ];

					if ( elem.style ) {
						display = elem.style.display;

						if ( display === "" || display === "none" ) {
							elem.style.display = jQuery._data( elem, "olddisplay" ) || "";
						}
					}
				}

				return this;
			}
		},

		hide: function( speed, easing, callback ) {
			if ( speed || speed === 0 ) {
				return this.animate( genFx("hide", 3), speed, easing, callback);

			} else {
				var elem, display,
					i = 0,
					j = this.length;

				for ( ; i < j; i++ ) {
					elem = this[i];
					if ( elem.style ) {
						display = jQuery.css( elem, "display" );

						if ( display !== "none" && !jQuery._data( elem, "olddisplay" ) ) {
							jQuery._data( elem, "olddisplay", display );
						}
					}
				}

				// Set the display of the elements in a second loop
				// to avoid the constant reflow
				for ( i = 0; i < j; i++ ) {
					if ( this[i].style ) {
						this[i].style.display = "none";
					}
				}

				return this;
			}
		},

		// Save the old toggle function
		_toggle: jQuery.fn.toggle,

		toggle: function( fn, fn2, callback ) {
			var bool = typeof fn === "boolean";

			if ( jQuery.isFunction(fn) && jQuery.isFunction(fn2) ) {
				this._toggle.apply( this, arguments );

			} else if ( fn == null || bool ) {
				this.each(function() {
					var state = bool ? fn : jQuery(this).is(":hidden");
					jQuery(this)[ state ? "show" : "hide" ]();
				});

			} else {
				this.animate(genFx("toggle", 3), fn, fn2, callback);
			}

			return this;
		},

		fadeTo: function( speed, to, easing, callback ) {
			return this.filter(":hidden").css("opacity", 0).show().end()
				.animate({opacity: to}, speed, easing, callback);
		},

		animate: function( prop, speed, easing, callback ) {
			var optall = jQuery.speed( speed, easing, callback );

			if ( jQuery.isEmptyObject( prop ) ) {
				return this.each( optall.complete, [ false ] );
			}

			// Do not change referenced properties as per-property easing will be lost
			prop = jQuery.extend( {}, prop );

			function doAnimation() {
				// XXX 'this' does not always have a nodeName when running the
				// test suite

				if ( optall.queue === false ) {
					jQuery._mark( this );
				}

				var opt = jQuery.extend( {}, optall ),
					isElement = this.nodeType === 1,
					hidden = isElement && jQuery(this).is(":hidden"),
					name, val, p, e, hooks, replace,
					parts, start, end, unit,
					method;

				// will store per property easing and be used to determine when an animation is complete
				opt.animatedProperties = {};

				// first pass over propertys to expand / normalize
				for ( p in prop ) {
					name = jQuery.camelCase( p );
					if ( p !== name ) {
						prop[ name ] = prop[ p ];
						delete prop[ p ];
					}

					if ( ( hooks = jQuery.cssHooks[ name ] ) && "expand" in hooks ) {
						replace = hooks.expand( prop[ name ] );
						delete prop[ name ];

						// not quite $.extend, this wont overwrite keys already present.
						// also - reusing 'p' from above because we have the correct "name"
						for ( p in replace ) {
							if ( ! ( p in prop ) ) {
								prop[ p ] = replace[ p ];
							}
						}
					}
				}

				for ( name in prop ) {
					val = prop[ name ];
					// easing resolution: per property > opt.specialEasing > opt.easing > 'swing' (default)
					if ( jQuery.isArray( val ) ) {
						opt.animatedProperties[ name ] = val[ 1 ];
						val = prop[ name ] = val[ 0 ];
					} else {
						opt.animatedProperties[ name ] = opt.specialEasing && opt.specialEasing[ name ] || opt.easing || 'swing';
					}

					if ( val === "hide" && hidden || val === "show" && !hidden ) {
						return opt.complete.call( this );
					}

					if ( isElement && ( name === "height" || name === "width" ) ) {
						// Make sure that nothing sneaks out
						// Record all 3 overflow attributes because IE does not
						// change the overflow attribute when overflowX and
						// overflowY are set to the same value
						opt.overflow = [ this.style.overflow, this.style.overflowX, this.style.overflowY ];

						// Set display property to inline-block for height/width
						// animations on inline elements that are having width/height animated
						if ( jQuery.css( this, "display" ) === "inline" &&
							jQuery.css( this, "float" ) === "none" ) {

							// inline-level elements accept inline-block;
							// block-level elements need to be inline with layout
							if ( !jQuery.support.inlineBlockNeedsLayout || defaultDisplay( this.nodeName ) === "inline" ) {
								this.style.display = "inline-block";

							} else {
								this.style.zoom = 1;
							}
						}
					}
				}

				if ( opt.overflow != null ) {
					this.style.overflow = "hidden";
				}

				for ( p in prop ) {
					e = new jQuery.fx( this, opt, p );
					val = prop[ p ];

					if ( rfxtypes.test( val ) ) {

						// Tracks whether to show or hide based on private
						// data attached to the element
						method = jQuery._data( this, "toggle" + p ) || ( val === "toggle" ? hidden ? "show" : "hide" : 0 );
						if ( method ) {
							jQuery._data( this, "toggle" + p, method === "show" ? "hide" : "show" );
							e[ method ]();
						} else {
							e[ val ]();
						}

					} else {
						parts = rfxnum.exec( val );
						start = e.cur();

						if ( parts ) {
							end = parseFloat( parts[2] );
							unit = parts[3] || ( jQuery.cssNumber[ p ] ? "" : "px" );

							// We need to compute starting value
							if ( unit !== "px" ) {
								jQuery.style( this, p, (end || 1) + unit);
								start = ( (end || 1) / e.cur() ) * start;
								jQuery.style( this, p, start + unit);
							}

							// If a +=/-= token was provided, we're doing a relative animation
							if ( parts[1] ) {
								end = ( (parts[ 1 ] === "-=" ? -1 : 1) * end ) + start;
							}

							e.custom( start, end, unit );

						} else {
							e.custom( start, val, "" );
						}
					}
				}

				// For JS strict compliance
				return true;
			}

			return optall.queue === false ?
				this.each( doAnimation ) :
				this.queue( optall.queue, doAnimation );
		},

		stop: function( type, clearQueue, gotoEnd ) {
			if ( typeof type !== "string" ) {
				gotoEnd = clearQueue;
				clearQueue = type;
				type = undefined;
			}
			if ( clearQueue && type !== false ) {
				this.queue( type || "fx", [] );
			}

			return this.each(function() {
				var index,
					hadTimers = false,
					timers = jQuery.timers,
					data = jQuery._data( this );

				// clear marker counters if we know they won't be
				if ( !gotoEnd ) {
					jQuery._unmark( true, this );
				}

				function stopQueue( elem, data, index ) {
					var hooks = data[ index ];
					jQuery.removeData( elem, index, true );
					hooks.stop( gotoEnd );
				}

				if ( type == null ) {
					for ( index in data ) {
						if ( data[ index ] && data[ index ].stop && index.indexOf(".run") === index.length - 4 ) {
							stopQueue( this, data, index );
						}
					}
				} else if ( data[ index = type + ".run" ] && data[ index ].stop ){
					stopQueue( this, data, index );
				}

				for ( index = timers.length; index--; ) {
					if ( timers[ index ].elem === this && (type == null || timers[ index ].queue === type) ) {
						if ( gotoEnd ) {

							// force the next step to be the last
							timers[ index ]( true );
						} else {
							timers[ index ].saveState();
						}
						hadTimers = true;
						timers.splice( index, 1 );
					}
				}

				// start the next in the queue if the last step wasn't forced
				// timers currently will call their complete callbacks, which will dequeue
				// but only if they were gotoEnd
				if ( !( gotoEnd && hadTimers ) ) {
					jQuery.dequeue( this, type );
				}
			});
		}

	});

// Animations created synchronously will run synchronously
	function createFxNow() {
		setTimeout( clearFxNow, 0 );
		return ( fxNow = jQuery.now() );
	}

	function clearFxNow() {
		fxNow = undefined;
	}

// Generate parameters to create a standard animation
	function genFx( type, num ) {
		var obj = {};

		jQuery.each( fxAttrs.concat.apply([], fxAttrs.slice( 0, num )), function() {
			obj[ this ] = type;
		});

		return obj;
	}

// Generate shortcuts for custom animations
	jQuery.each({
		slideDown: genFx( "show", 1 ),
		slideUp: genFx( "hide", 1 ),
		slideToggle: genFx( "toggle", 1 ),
		fadeIn: { opacity: "show" },
		fadeOut: { opacity: "hide" },
		fadeToggle: { opacity: "toggle" }
	}, function( name, props ) {
		jQuery.fn[ name ] = function( speed, easing, callback ) {
			return this.animate( props, speed, easing, callback );
		};
	});

	jQuery.extend({
		speed: function( speed, easing, fn ) {
			var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
				complete: fn || !fn && easing ||
					jQuery.isFunction( speed ) && speed,
				duration: speed,
				easing: fn && easing || easing && !jQuery.isFunction( easing ) && easing
			};

			opt.duration = jQuery.fx.off ? 0 : typeof opt.duration === "number" ? opt.duration :
				opt.duration in jQuery.fx.speeds ? jQuery.fx.speeds[ opt.duration ] : jQuery.fx.speeds._default;

			// normalize opt.queue - true/undefined/null -> "fx"
			if ( opt.queue == null || opt.queue === true ) {
				opt.queue = "fx";
			}

			// Queueing
			opt.old = opt.complete;

			opt.complete = function( noUnmark ) {
				if ( jQuery.isFunction( opt.old ) ) {
					opt.old.call( this );
				}

				if ( opt.queue ) {
					jQuery.dequeue( this, opt.queue );
				} else if ( noUnmark !== false ) {
					jQuery._unmark( this );
				}
			};

			return opt;
		},

		easing: {
			linear: function( p ) {
				return p;
			},
			swing: function( p ) {
				return ( -Math.cos( p*Math.PI ) / 2 ) + 0.5;
			}
		},

		timers: [],

		fx: function( elem, options, prop ) {
			this.options = options;
			this.elem = elem;
			this.prop = prop;

			options.orig = options.orig || {};
		}

	});

	jQuery.fx.prototype = {
		// Simple function for setting a style value
		update: function() {
			if ( this.options.step ) {
				this.options.step.call( this.elem, this.now, this );
			}

			( jQuery.fx.step[ this.prop ] || jQuery.fx.step._default )( this );
		},

		// Get the current size
		cur: function() {
			if ( this.elem[ this.prop ] != null && (!this.elem.style || this.elem.style[ this.prop ] == null) ) {
				return this.elem[ this.prop ];
			}

			var parsed,
				r = jQuery.css( this.elem, this.prop );
			// Empty strings, null, undefined and "auto" are converted to 0,
			// complex values such as "rotate(1rad)" are returned as is,
			// simple values such as "10px" are parsed to Float.
			return isNaN( parsed = parseFloat( r ) ) ? !r || r === "auto" ? 0 : r : parsed;
		},

		// Start an animation from one number to another
		custom: function( from, to, unit ) {
			var self = this,
				fx = jQuery.fx;

			this.startTime = fxNow || createFxNow();
			this.end = to;
			this.now = this.start = from;
			this.pos = this.state = 0;
			this.unit = unit || this.unit || ( jQuery.cssNumber[ this.prop ] ? "" : "px" );

			function t( gotoEnd ) {
				return self.step( gotoEnd );
			}

			t.queue = this.options.queue;
			t.elem = this.elem;
			t.saveState = function() {
				if ( jQuery._data( self.elem, "fxshow" + self.prop ) === undefined ) {
					if ( self.options.hide ) {
						jQuery._data( self.elem, "fxshow" + self.prop, self.start );
					} else if ( self.options.show ) {
						jQuery._data( self.elem, "fxshow" + self.prop, self.end );
					}
				}
			};

			if ( t() && jQuery.timers.push(t) && !timerId ) {
				timerId = setInterval( fx.tick, fx.interval );
			}
		},

		// Simple 'show' function
		show: function() {
			var dataShow = jQuery._data( this.elem, "fxshow" + this.prop );

			// Remember where we started, so that we can go back to it later
			this.options.orig[ this.prop ] = dataShow || jQuery.style( this.elem, this.prop );
			this.options.show = true;

			// Begin the animation
			// Make sure that we start at a small width/height to avoid any flash of content
			if ( dataShow !== undefined ) {
				// This show is picking up where a previous hide or show left off
				this.custom( this.cur(), dataShow );
			} else {
				this.custom( this.prop === "width" || this.prop === "height" ? 1 : 0, this.cur() );
			}

			// Start by showing the element
			jQuery( this.elem ).show();
		},

		// Simple 'hide' function
		hide: function() {
			// Remember where we started, so that we can go back to it later
			this.options.orig[ this.prop ] = jQuery._data( this.elem, "fxshow" + this.prop ) || jQuery.style( this.elem, this.prop );
			this.options.hide = true;

			// Begin the animation
			this.custom( this.cur(), 0 );
		},

		// Each step of an animation
		step: function( gotoEnd ) {
			var p, n, complete,
				t = fxNow || createFxNow(),
				done = true,
				elem = this.elem,
				options = this.options;

			if ( gotoEnd || t >= options.duration + this.startTime ) {
				this.now = this.end;
				this.pos = this.state = 1;
				this.update();

				options.animatedProperties[ this.prop ] = true;

				for ( p in options.animatedProperties ) {
					if ( options.animatedProperties[ p ] !== true ) {
						done = false;
					}
				}

				if ( done ) {
					// Reset the overflow
					if ( options.overflow != null && !jQuery.support.shrinkWrapBlocks ) {

						jQuery.each( [ "", "X", "Y" ], function( index, value ) {
							elem.style[ "overflow" + value ] = options.overflow[ index ];
						});
					}

					// Hide the element if the "hide" operation was done
					if ( options.hide ) {
						jQuery( elem ).hide();
					}

					// Reset the properties, if the item has been hidden or shown
					if ( options.hide || options.show ) {
						for ( p in options.animatedProperties ) {
							jQuery.style( elem, p, options.orig[ p ] );
							jQuery.removeData( elem, "fxshow" + p, true );
							// Toggle data is no longer needed
							jQuery.removeData( elem, "toggle" + p, true );
						}
					}

					// Execute the complete function
					// in the event that the complete function throws an exception
					// we must ensure it won't be called twice. #5684

					complete = options.complete;
					if ( complete ) {

						options.complete = false;
						complete.call( elem );
					}
				}

				return false;

			} else {
				// classical easing cannot be used with an Infinity duration
				if ( options.duration == Infinity ) {
					this.now = t;
				} else {
					n = t - this.startTime;
					this.state = n / options.duration;

					// Perform the easing function, defaults to swing
					this.pos = jQuery.easing[ options.animatedProperties[this.prop] ]( this.state, n, 0, 1, options.duration );
					this.now = this.start + ( (this.end - this.start) * this.pos );
				}
				// Perform the next step of the animation
				this.update();
			}

			return true;
		}
	};

	jQuery.extend( jQuery.fx, {
		tick: function() {
			var timer,
				timers = jQuery.timers,
				i = 0;

			for ( ; i < timers.length; i++ ) {
				timer = timers[ i ];
				// Checks the timer has not already been removed
				if ( !timer() && timers[ i ] === timer ) {
					timers.splice( i--, 1 );
				}
			}

			if ( !timers.length ) {
				jQuery.fx.stop();
			}
		},

		interval: 13,

		stop: function() {
			clearInterval( timerId );
			timerId = null;
		},

		speeds: {
			slow: 600,
			fast: 200,
			// Default speed
			_default: 400
		},

		step: {
			opacity: function( fx ) {
				jQuery.style( fx.elem, "opacity", fx.now );
			},

			_default: function( fx ) {
				if ( fx.elem.style && fx.elem.style[ fx.prop ] != null ) {
					fx.elem.style[ fx.prop ] = fx.now + fx.unit;
				} else {
					fx.elem[ fx.prop ] = fx.now;
				}
			}
		}
	});

// Ensure props that can't be negative don't go there on undershoot easing
	jQuery.each( fxAttrs.concat.apply( [], fxAttrs ), function( i, prop ) {
		// exclude marginTop, marginLeft, marginBottom and marginRight from this list
		if ( prop.indexOf( "margin" ) ) {
			jQuery.fx.step[ prop ] = function( fx ) {
				jQuery.style( fx.elem, prop, Math.max(0, fx.now) + fx.unit );
			};
		}
	});

	if ( jQuery.expr && jQuery.expr.filters ) {
		jQuery.expr.filters.animated = function( elem ) {
			return jQuery.grep(jQuery.timers, function( fn ) {
				return elem === fn.elem;
			}).length;
		};
	}

// Try to restore the default display value of an element
	function defaultDisplay( nodeName ) {

		if ( !elemdisplay[ nodeName ] ) {

			var body = document.body,
				elem = jQuery( "<" + nodeName + ">" ).appendTo( body ),
				display = elem.css( "display" );
			elem.remove();

			// If the simple way fails,
			// get element's real default display by attaching it to a temp iframe
			if ( display === "none" || display === "" ) {
				// No iframe to use yet, so create it
				if ( !iframe ) {
					iframe = document.createElement( "iframe" );
					iframe.frameBorder = iframe.width = iframe.height = 0;
				}

				body.appendChild( iframe );

				// Create a cacheable copy of the iframe document on first call.
				// IE and Opera will allow us to reuse the iframeDoc without re-writing the fake HTML
				// document to it; WebKit & Firefox won't allow reusing the iframe document.
				if ( !iframeDoc || !iframe.createElement ) {
					iframeDoc = ( iframe.contentWindow || iframe.contentDocument ).document;
					iframeDoc.write( ( jQuery.support.boxModel ? "<!doctype html>" : "" ) + "<html><body>" );
					iframeDoc.close();
				}

				elem = iframeDoc.createElement( nodeName );

				iframeDoc.body.appendChild( elem );

				display = jQuery.css( elem, "display" );
				body.removeChild( iframe );
			}

			// Store the correct default display
			elemdisplay[ nodeName ] = display;
		}

		return elemdisplay[ nodeName ];
	}




	var getOffset,
		rtable = /^t(?:able|d|h)$/i,
		rroot = /^(?:body|html)$/i;

	if ( "getBoundingClientRect" in document.documentElement ) {
		getOffset = function( elem, doc, docElem, box ) {
			try {
				box = elem.getBoundingClientRect();
			} catch(e) {}

			// Make sure we're not dealing with a disconnected DOM node
			if ( !box || !jQuery.contains( docElem, elem ) ) {
				return box ? { top: box.top, left: box.left } : { top: 0, left: 0 };
			}

			var body = doc.body,
				win = getWindow( doc ),
				clientTop  = docElem.clientTop  || body.clientTop  || 0,
				clientLeft = docElem.clientLeft || body.clientLeft || 0,
				scrollTop  = win.pageYOffset || jQuery.support.boxModel && docElem.scrollTop  || body.scrollTop,
				scrollLeft = win.pageXOffset || jQuery.support.boxModel && docElem.scrollLeft || body.scrollLeft,
				top  = box.top  + scrollTop  - clientTop,
				left = box.left + scrollLeft - clientLeft;

			return { top: top, left: left };
		};

	} else {
		getOffset = function( elem, doc, docElem ) {
			var computedStyle,
				offsetParent = elem.offsetParent,
				prevOffsetParent = elem,
				body = doc.body,
				defaultView = doc.defaultView,
				prevComputedStyle = defaultView ? defaultView.getComputedStyle( elem, null ) : elem.currentStyle,
				top = elem.offsetTop,
				left = elem.offsetLeft;

			while ( (elem = elem.parentNode) && elem !== body && elem !== docElem ) {
				if ( jQuery.support.fixedPosition && prevComputedStyle.position === "fixed" ) {
					break;
				}

				computedStyle = defaultView ? defaultView.getComputedStyle(elem, null) : elem.currentStyle;
				top  -= elem.scrollTop;
				left -= elem.scrollLeft;

				if ( elem === offsetParent ) {
					top  += elem.offsetTop;
					left += elem.offsetLeft;

					if ( jQuery.support.doesNotAddBorder && !(jQuery.support.doesAddBorderForTableAndCells && rtable.test(elem.nodeName)) ) {
						top  += parseFloat( computedStyle.borderTopWidth  ) || 0;
						left += parseFloat( computedStyle.borderLeftWidth ) || 0;
					}

					prevOffsetParent = offsetParent;
					offsetParent = elem.offsetParent;
				}

				if ( jQuery.support.subtractsBorderForOverflowNotVisible && computedStyle.overflow !== "visible" ) {
					top  += parseFloat( computedStyle.borderTopWidth  ) || 0;
					left += parseFloat( computedStyle.borderLeftWidth ) || 0;
				}

				prevComputedStyle = computedStyle;
			}

			if ( prevComputedStyle.position === "relative" || prevComputedStyle.position === "static" ) {
				top  += body.offsetTop;
				left += body.offsetLeft;
			}

			if ( jQuery.support.fixedPosition && prevComputedStyle.position === "fixed" ) {
				top  += Math.max( docElem.scrollTop, body.scrollTop );
				left += Math.max( docElem.scrollLeft, body.scrollLeft );
			}

			return { top: top, left: left };
		};
	}

	jQuery.fn.offset = function( options ) {
		if ( arguments.length ) {
			return options === undefined ?
				this :
				this.each(function( i ) {
					jQuery.offset.setOffset( this, options, i );
				});
		}

		var elem = this[0],
			doc = elem && elem.ownerDocument;

		if ( !doc ) {
			return null;
		}

		if ( elem === doc.body ) {
			return jQuery.offset.bodyOffset( elem );
		}

		return getOffset( elem, doc, doc.documentElement );
	};

	jQuery.offset = {

		bodyOffset: function( body ) {
			var top = body.offsetTop,
				left = body.offsetLeft;

			if ( jQuery.support.doesNotIncludeMarginInBodyOffset ) {
				top  += parseFloat( jQuery.css(body, "marginTop") ) || 0;
				left += parseFloat( jQuery.css(body, "marginLeft") ) || 0;
			}

			return { top: top, left: left };
		},

		setOffset: function( elem, options, i ) {
			var position = jQuery.css( elem, "position" );

			// set position first, in-case top/left are set even on static elem
			if ( position === "static" ) {
				elem.style.position = "relative";
			}

			var curElem = jQuery( elem ),
				curOffset = curElem.offset(),
				curCSSTop = jQuery.css( elem, "top" ),
				curCSSLeft = jQuery.css( elem, "left" ),
				calculatePosition = ( position === "absolute" || position === "fixed" ) && jQuery.inArray("auto", [curCSSTop, curCSSLeft]) > -1,
				props = {}, curPosition = {}, curTop, curLeft;

			// need to be able to calculate position if either top or left is auto and position is either absolute or fixed
			if ( calculatePosition ) {
				curPosition = curElem.position();
				curTop = curPosition.top;
				curLeft = curPosition.left;
			} else {
				curTop = parseFloat( curCSSTop ) || 0;
				curLeft = parseFloat( curCSSLeft ) || 0;
			}

			if ( jQuery.isFunction( options ) ) {
				options = options.call( elem, i, curOffset );
			}

			if ( options.top != null ) {
				props.top = ( options.top - curOffset.top ) + curTop;
			}
			if ( options.left != null ) {
				props.left = ( options.left - curOffset.left ) + curLeft;
			}

			if ( "using" in options ) {
				options.using.call( elem, props );
			} else {
				curElem.css( props );
			}
		}
	};


	jQuery.fn.extend({

		position: function() {
			if ( !this[0] ) {
				return null;
			}

			var elem = this[0],

			// Get *real* offsetParent
				offsetParent = this.offsetParent(),

			// Get correct offsets
				offset       = this.offset(),
				parentOffset = rroot.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset();

			// Subtract element margins
			// note: when an element has margin: auto the offsetLeft and marginLeft
			// are the same in Safari causing offset.left to incorrectly be 0
			offset.top  -= parseFloat( jQuery.css(elem, "marginTop") ) || 0;
			offset.left -= parseFloat( jQuery.css(elem, "marginLeft") ) || 0;

			// Add offsetParent borders
			parentOffset.top  += parseFloat( jQuery.css(offsetParent[0], "borderTopWidth") ) || 0;
			parentOffset.left += parseFloat( jQuery.css(offsetParent[0], "borderLeftWidth") ) || 0;

			// Subtract the two offsets
			return {
				top:  offset.top  - parentOffset.top,
				left: offset.left - parentOffset.left
			};
		},

		offsetParent: function() {
			return this.map(function() {
				var offsetParent = this.offsetParent || document.body;
				while ( offsetParent && (!rroot.test(offsetParent.nodeName) && jQuery.css(offsetParent, "position") === "static") ) {
					offsetParent = offsetParent.offsetParent;
				}
				return offsetParent;
			});
		}
	});


// Create scrollLeft and scrollTop methods
	jQuery.each( {scrollLeft: "pageXOffset", scrollTop: "pageYOffset"}, function( method, prop ) {
		var top = /Y/.test( prop );

		jQuery.fn[ method ] = function( val ) {
			return jQuery.access( this, function( elem, method, val ) {
				var win = getWindow( elem );

				if ( val === undefined ) {
					return win ? (prop in win) ? win[ prop ] :
						jQuery.support.boxModel && win.document.documentElement[ method ] ||
							win.document.body[ method ] :
						elem[ method ];
				}

				if ( win ) {
					win.scrollTo(
						!top ? val : jQuery( win ).scrollLeft(),
						top ? val : jQuery( win ).scrollTop()
					);

				} else {
					elem[ method ] = val;
				}
			}, method, val, arguments.length, null );
		};
	});

	function getWindow( elem ) {
		return jQuery.isWindow( elem ) ?
			elem :
			elem.nodeType === 9 ?
				elem.defaultView || elem.parentWindow :
				false;
	}




// Create width, height, innerHeight, innerWidth, outerHeight and outerWidth methods
	jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
		var clientProp = "client" + name,
			scrollProp = "scroll" + name,
			offsetProp = "offset" + name;

		// innerHeight and innerWidth
		jQuery.fn[ "inner" + name ] = function() {
			var elem = this[0];
			return elem ?
				elem.style ?
					parseFloat( jQuery.css( elem, type, "padding" ) ) :
					this[ type ]() :
				null;
		};

		// outerHeight and outerWidth
		jQuery.fn[ "outer" + name ] = function( margin ) {
			var elem = this[0];
			return elem ?
				elem.style ?
					parseFloat( jQuery.css( elem, type, margin ? "margin" : "border" ) ) :
					this[ type ]() :
				null;
		};

		jQuery.fn[ type ] = function( value ) {
			return jQuery.access( this, function( elem, type, value ) {
				var doc, docElemProp, orig, ret;

				if ( jQuery.isWindow( elem ) ) {
					// 3rd condition allows Nokia support, as it supports the docElem prop but not CSS1Compat
					doc = elem.document;
					docElemProp = doc.documentElement[ clientProp ];
					return jQuery.support.boxModel && docElemProp ||
						doc.body && doc.body[ clientProp ] || docElemProp;
				}

				// Get document width or height
				if ( elem.nodeType === 9 ) {
					// Either scroll[Width/Height] or offset[Width/Height], whichever is greater
					doc = elem.documentElement;

					// when a window > document, IE6 reports a offset[Width/Height] > client[Width/Height]
					// so we can't use max, as it'll choose the incorrect offset[Width/Height]
					// instead we use the correct client[Width/Height]
					// support:IE6
					if ( doc[ clientProp ] >= doc[ scrollProp ] ) {
						return doc[ clientProp ];
					}

					return Math.max(
						elem.body[ scrollProp ], doc[ scrollProp ],
						elem.body[ offsetProp ], doc[ offsetProp ]
					);
				}

				// Get width or height on the element
				if ( value === undefined ) {
					orig = jQuery.css( elem, type );
					ret = parseFloat( orig );
					return jQuery.isNumeric( ret ) ? ret : orig;
				}

				// Set the width or height on the element
				jQuery( elem ).css( type, value );
			}, type, value, arguments.length, null );
		};
	});




// Expose jQuery to the global object
	window.jQuery = window.$ = jQuery;

// Expose jQuery as an AMD module, but only for AMD loaders that
// understand the issues with loading multiple versions of jQuery
// in a page that all might call define(). The loader will indicate
// they have special allowances for multiple jQuery versions by
// specifying define.amd.jQuery = true. Register as a named module,
// since jQuery can be concatenated with other files that may use define,
// but not use a proper concatenation script that understands anonymous
// AMD modules. A named AMD is safest and most robust way to register.
// Lowercase jquery is used because AMD module names are derived from
// file names, and jQuery is normally delivered in a lowercase file name.
// Do this after creating the global so that if an AMD module wants to call
// noConflict to hide this version of jQuery, it will work.
	if ( typeof tvpapp.define === 'function' && tvpapp.define.amd && tvpapp.define.amd.jQuery ) {
		tvpapp.define( "jquery", [], function () { return jQuery; } );
	}



})( window );
//     Underscore.js 1.4.4
//     http://underscorejs.org
//     (c) 2009-2011 Jeremy Ashkenas, DocumentCloud Inc.
//     (c) 2011-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `global` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.4.4';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (_.has(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    return _.filter(obj, function(value, index, list) {
      return !iterator.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs, first) {
    if (_.isEmpty(attrs)) return first ? void 0 : [];
    return _[first ? 'find' : 'filter'](obj, function(value) {
      for (var key in attrs) {
        if (attrs[key] !== value[key]) return false;
      }
      return true;
    });
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.where(obj, attrs, true);
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity, value: -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity, value: Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Shuffle an array.
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    return _.isFunction(value) ? value : function(obj){ return obj[value]; };
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, value, context) {
    var iterator = lookupIterator(value);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        index : index,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
        var a = left.criteria;
        var b = right.criteria;
        if (a !== b) {
          if (a > b || a === void 0) return 1;
          if (a < b || b === void 0) return -1;
        }
        return left.index < right.index ? -1 : 1;
      }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(obj, value, context, behavior) {
    var result = {};
    var iterator = lookupIterator(value == null ? _.identity : value);
    each(obj, function(value, index) {
      var key = iterator.call(context, value, index, obj);
      behavior(result, key, value);
    });
    return result;
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key, value) {
      (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
    });
  };

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key) {
      if (!_.has(result, key)) result[key] = 0;
      result[key]++;
    });
  };

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = iterator == null ? _.identity : lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely convert anything iterable into a real, live array.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n != null) && !guard) {
      return slice.call(array, Math.max(array.length - n, 0));
    } else {
      return array[array.length - 1];
    }
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    each(input, function(value) {
      if (_.isArray(value) || _.isArguments(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(slice.call(arguments));
  };

  // The inverse operation to `_.zip`. If given an array of pairs it
  // returns an array of the paired elements split into two left and
  // right element arrays, if given an array of triples it returns a
  // three element array and so on. For example, `_.unzip` given
  // `[['a',1],['b',2],['c',3]]` returns the array
  // [['a','b','c'],[1,2,3]].
  _.unzip = function(list) {
    var length = _.max(_.pluck(list, "length").concat(0));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(list, '' + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, l = list.length; i < l; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, l = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, l + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < l; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var len = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(len);

    while(idx < len) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context.
  _.partial = function(func) {
    var args = slice.call(arguments, 1);
    return function() {
      return func.apply(this, args.concat(slice.call(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) throw new Error("bindAll must be passed function names");
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time.
  _.throttle = function(func, wait, immediate) {
    var context, args, timeout, result;
    var previous = 0;
    var later = function() {
      previous = new Date;
      timeout = null;
      result = func.apply(context, args);
    };
    return function() {
      var now = new Date;
      if (!previous && immediate === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
      } else if (!timeout) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, result;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) result = func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) result = func.apply(context, args);
      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func];
      push.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    if (times <= 0) return func();
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var values = [];
    for (var key in obj) if (_.has(obj, key)) values.push(obj[key]);
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var pairs = [];
    for (var key in obj) if (_.has(obj, key)) pairs.push([key, obj[key]]);
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    for (var key in obj) if (_.has(obj, key)) result[obj[key]] = key;
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

  // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] === void 0) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
          a.global == b.global &&
          a.multiline == b.multiline &&
          a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Objects with different constructors are not equivalent, but `Object`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
        _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
        return false;
      }
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(Math.max(0, n));
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

}).call(this);
tvpapp.define("underscore", (function (global) {
    return function () {
        var ret, fn;
        return ret || global._;
    };
}(this)));

//     Backbone.js 1.0.0

//     (c) 2010-2011 Jeremy Ashkenas, DocumentCloud Inc.
//     (c) 2011-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(){

  // Initial Setup
  // -------------

  // Save a reference to the global object (`window` in the browser, `exports`
  // on the server).
  var root = this;

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create local references to array methods we'll want to use later.
  var array = [];
  var push = array.push;
  var slice = array.slice;
  var splice = array.splice;

  // The top-level namespace. All public Backbone classes and modules will
  // be attached to this. Exported for both the browser and the server.
  var Backbone;
  if (typeof exports !== 'undefined') {
    Backbone = exports;
  } else {
    Backbone = root.Backbone = {};
  }

  // Current version of the library. Keep in sync with `package.json`.
  Backbone.VERSION = '1.0.0';

  // Require Underscore, if we're on the server, and it's not already present.
  var _ = root._;
  if (!_ && (typeof require !== 'undefined')) _ = require('underscore');

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  Backbone.$ = root.jQuery || root.Zepto || root.ender || root.$;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  Backbone.emulateJSON = false;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = {};
        return this;
      }

      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeners = this._listeners;
      if (!listeners) return this;
      var deleteListener = !name && !callback;
      if (typeof name === 'object') callback = this;
      if (obj) (listeners = {})[obj._listenerId] = obj;
      for (var id in listeners) {
        listeners[id].off(name, callback, this);
        if (deleteListener) delete this._listeners[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeners = this._listeners || (this._listeners = {});
      var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
      listeners[id] = obj;
      if (typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Backbone.Model
  // --------------

  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = Backbone.Model = function(attributes, options) {
    var defaults;
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId('c');
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    options._attrs || (options._attrs = attrs);
    if (defaults = _.result(this, 'defaults')) {
      attrs = _.defaults({}, attrs, defaults);
    }
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The value returned during the last failed validation.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function(key, val, options) {
      var attr, attrs, unset, changes, silent, changing, prev, current;
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      unset           = options.unset;
      silent          = options.silent;
      changes         = [];
      changing        = this._changing;
      this._changing  = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }
      current = this.attributes, prev = this._previousAttributes;

      // Check for changes of `id`.
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      // For each `set` attribute, update or delete the current value.
      for (attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          this.changed[attr] = val;
        } else {
          delete this.changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = true;
        for (var i = 0, l = changes.length; i < l; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var val, changed = false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      for (var attr in diff) {
        if (_.isEqual(old[attr], (val = diff[attr]))) continue;
        (changed || (changed = {}))[attr] = val;
      }
      return changed;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server. If the server's representation of the
    // model differs from its current attributes, they will be overridden,
    // triggering a `"change"` event.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        if (!model.set(model.parse(resp, options), options)) return false;
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      var attrs, method, xhr, attributes = this.attributes;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true}, options);

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      if (attrs && !options.wait) {
        if (!this.set(attrs, options)) return false;
      } else {
        if (!this._validate(attrs, options)) return false;
      }

      // Set temporary attributes if `{wait: true}`.
      if (attrs && options.wait) {
        this.attributes = _.extend({}, attributes, attrs);
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = model.parse(resp, options);
        if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
        if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
          return false;
        }
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch') options.attrs = attrs;
      xhr = this.sync(method, this, options);

      // Restore attributes.
      if (attrs && options.wait) this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;

      var destroy = function() {
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (options.wait || model.isNew()) destroy();
        if (success) success(model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      if (this.isNew()) {
        options.success();
        return false;
      }
      wrapError(this, options);

      var xhr = this.sync('delete', this, options);
      if (!options.wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    url: function() {
      var base = _.result(this, 'urlRoot') || _.result(this.collection, 'url') || urlError();
      if (this.isNew()) return base;
      return base + (base.charAt(base.length - 1) === '/' ? '' : '/') + encodeURIComponent(this.id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function() {
      return this.id == null;
    },

    // Check if the model is currently in a valid state.
    isValid: function(options) {
      return this._validate({}, _.extend(options || {}, { validate: true }));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options || {}, {validationError: error}));
      return false;
    }

  });

  // Underscore methods that we want to implement on the Model.
  var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  _.each(modelMethods, function(method) {
    Model.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.attributes);
      return _[method].apply(_, args);
    };
  });

  // Backbone.Collection
  // -------------------

  // If models tend to represent a single row of data, a Backbone Collection is
  // more analagous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, merge: false, remove: false};

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model){ return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set.
    add: function(models, options) {
      return this.set(models, _.defaults(options || {}, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function(models, options) {
      models = _.isArray(models) ? models.slice() : [models];
      options || (options = {});
      var i, l, index, model;
      for (i = 0, l = models.length; i < l; i++) {
        model = this.get(models[i]);
        if (!model) continue;
        delete this._byId[model.id];
        delete this._byId[model.cid];
        index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;
        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }
        this._removeReference(model);
      }
      return this;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function(models, options) {
      options = _.defaults(options || {}, setOptions);
      if (options.parse) models = this.parse(models, options);
      if (!_.isArray(models)) models = models ? [models] : [];
      var i, l, model, attrs, existing, sort;
      var at = options.at;
      var sortable = this.comparator && (at == null) && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;
      var toAdd = [], toRemove = [], modelMap = {};
      var add = options.add, merge = options.merge, remove = options.remove;
      var order = !sortable && add && remove ? [] : false;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      for (i = 0, l = models.length; i < l; i++) {
        if (!(model = this._prepareModel(attrs = models[i], options))) continue;

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        if (existing = this.get(model)) {
          if (remove) modelMap[existing.cid] = true;
          if (merge) {
            attrs = attrs === model ? model.attributes : options._attrs;
            delete options._attrs;
            existing.set(attrs, options);
            if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
          }

          // This is a new model, push it to the `toAdd` list.
        } else if (add) {
          toAdd.push(model);

          // Listen to added models' events, and index models for lookup by
          // `id` and by `cid`.
          model.on('all', this._onModelEvent, this);
          this._byId[model.cid] = model;
          if (model.id != null) this._byId[model.id] = model;
        }
        if (order) order.push(existing || model);
      }

      // Remove nonexistent models if appropriate.
      if (remove) {
        for (i = 0, l = this.length; i < l; ++i) {
          if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
        }
        if (toRemove.length) this.remove(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      if (toAdd.length || (order && order.length)) {
        if (sortable) sort = true;
        this.length += toAdd.length;
        if (at != null) {
          splice.apply(this.models, [at, 0].concat(toAdd));
        } else {
          if (order) this.models.length = 0;
          push.apply(this.models, order || toAdd);
        }
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      if (options.silent) return this;

      // Trigger `add` events.
      for (i = 0, l = toAdd.length; i < l; i++) {
        (model = toAdd[i]).trigger('add', model, this, options);
      }

      // Trigger `sort` if the collection was sorted.
      if (sort || (order && order.length)) this.trigger('sort', this, options);
      return this;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function(models, options) {
      options || (options = {});
      for (var i = 0, l = this.models.length; i < l; i++) {
        this._removeReference(this.models[i]);
      }
      options.previousModels = this.models;
      this._reset();
      this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return this;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      model = this._prepareModel(model, options);
      this.add(model, _.extend({at: this.length}, options));
      return model;
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      this.remove(model, options);
      return model;
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      model = this._prepareModel(model, options);
      this.add(model, _.extend({at: 0}, options));
      return model;
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      this.remove(model, options);
      return model;
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id.
    get: function(obj) {
      if (obj == null) return void 0;
      return this._byId[obj.id != null ? obj.id : obj.cid || obj];
    },

    // Get the model at the given index.
    at: function(index) {
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function(attrs, first) {
      if (_.isEmpty(attrs)) return first ? void 0 : [];
      return this[first ? 'find' : 'filter'](function(model) {
        for (var key in attrs) {
          if (attrs[key] !== model.get(key)) return false;
        }
        return true;
      });
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      // Run sort based on type of `comparator`.
      if (_.isString(this.comparator) || this.comparator.length === 1) {
        this.models = this.sortBy(this.comparator, this);
      } else {
        this.models.sort(_.bind(this.comparator, this));
      }

      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Figure out the smallest index at which a model should be inserted so as
    // to maintain order.
    sortedIndex: function(model, value, context) {
      value || (value = this.comparator);
      var iterator = _.isFunction(value) ? value : function(model) {
        return model.get(value);
      };
      return _.sortedIndex(this.models, model, iterator, context);
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return _.invoke(this.models, 'get', attr);
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success(collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      if (!(model = this._prepareModel(model, options))) return false;
      if (!options.wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(resp) {
        if (options.wait) collection.add(model, options);
        if (success) success(model, resp, options);
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models);
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function() {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function(attrs, options) {
      if (attrs instanceof Model) {
        if (!attrs.collection) attrs.collection = this;
        return attrs;
      }
      options || (options = {});
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model._validate(attrs, options)) {
        this.trigger('invalid', this, attrs, options);
        return false;
      }
      return model;
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function(model) {
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') this.remove(model, options);
      if (model && event === 'change:' + model.idAttribute) {
        delete this._byId[model.previous(model.idAttribute)];
        if (model.id != null) this._byId[model.id] = model;
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
    'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
    'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
    'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
    'tail', 'drop', 'last', 'without', 'indexOf', 'shuffle', 'lastIndexOf',
    'isEmpty', 'chain'];

  // Mix in each Underscore method as a proxy to `Collection#models`.
  _.each(methods, function(method) {
    Collection.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.models);
      return _[method].apply(_, args);
    };
  });

  // Underscore methods that take a property name as an argument.
  var attributeMethods = ['groupBy', 'countBy', 'sortBy'];

  // Use attributes instead of properties.
  _.each(attributeMethods, function(method) {
    Collection.prototype[method] = function(value, context) {
      var iterator = _.isFunction(value) ? value : function(model) {
        return model.get(value);
      };
      return _[method](this.models, iterator, context);
    };
  });

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Options with special meaning *(e.g. model, collection, id, className)* are
  // attached directly to the view.  See `viewOptions` for an exhaustive
  // list.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    options || (options = {});
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
    this.delegateEvents();
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be merged as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be prefered to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this.$el.remove();
      this.stopListening();
      return this;
    },

    // Change the view's element (`this.el` property), including event
    // re-delegation.
    setElement: function(element, delegate) {
      if (this.$el) this.undelegateEvents();
      this.$el = element instanceof Backbone.$ ? element : Backbone.$(element);
      this.el = this.$el[0];
      if (delegate !== false) this.delegateEvents();
      return this;
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save'
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    // This only works for delegate-able events: not `focus`, `blur`, and
    // not `change`, `submit`, and `reset` in Internet Explorer.
    delegateEvents: function(events) {
      if (!(events || (events = _.result(this, 'events')))) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[events[key]];
        if (!method) continue;

        var match = key.match(delegateEventSplitter);
        var eventName = match[1], selector = match[2];
        method = _.bind(method, this);
        eventName += '.delegateEvents' + this.cid;
        if (selector === '') {
          this.$el.on(eventName, method);
        } else {
          this.$el.on(eventName, selector, method);
        }
      }
      return this;
    },

    // Clears all callbacks previously bound to the view with `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        var $el = Backbone.$('<' + _.result(this, 'tagName') + '>').attr(attrs);
        this.setElement($el, false);
      } else {
        this.setElement(_.result(this, 'el'), false);
      }
    }

  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // If we're sending a `PATCH` request, and we're in an old Internet Explorer
    // that still has ActiveX enabled by default, override jQuery to use that
    // for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
    if (params.type === 'PATCH' && window.ActiveXObject &&
      !(window.external && window.external.msActiveXFilteringEnabled)) {
      params.xhr = function() {
        return new ActiveXObject("Microsoft.XMLHTTP");
      };
    }

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch':  'PATCH',
    'delete': 'DELETE',
    'read':   'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        callback && callback.apply(router, args);
        router.trigger.apply(router, ['route:' + name].concat(args));
        router.trigger('route', name, args);
        Backbone.history.trigger('route', router, name, args);
      });
      return this;
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
        .replace(optionalParam, '(?:$1)?')
        .replace(namedParam, function(match, optional){
          return optional ? match : '([^\/]+)';
        })
        .replace(splatParam, '(.*?)');
      return new RegExp('^' + route + '$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param) {
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    _.bindAll(this, 'checkUrl');

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for detecting MSIE.
  var isExplorer = /msie [\w.]+/;

  // Cached regex for removing a trailing slash.
  var trailingSlash = /\/$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the cross-browser normalized URL fragment, either from the URL,
    // the hash, or the override.
    getFragment: function(fragment, forcePushState) {
      if (fragment == null) {
        if (this._hasPushState || !this._wantsHashChange || forcePushState) {
          fragment = this.location.pathname;
          var root = this.root.replace(trailingSlash, '');
          if (!fragment.indexOf(root)) fragment = fragment.substr(root.length);
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error("Backbone.history has already been started");
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({}, {root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.options.pushState && this.history && this.history.pushState);
      var fragment          = this.getFragment();
      var docMode           = document.documentMode;
      var oldIE             = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      if (oldIE && this._wantsHashChange) {
        this.iframe = Backbone.$('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo('body')[0].contentWindow;
        this.navigate(fragment);
      }

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._hasPushState) {
        Backbone.$(window).on('popstate', this.checkUrl);
      } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
        Backbone.$(window).on('hashchange', this.checkUrl);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      // Determine if we need to change the base url, for a pushState link
      // opened by a non-pushState browser.
      this.fragment = fragment;
      var loc = this.location;
      var atRoot = loc.pathname.replace(/[^\/]$/, '$&/') === this.root;

      // If we've started off with a route from a `pushState`-enabled browser,
      // but we're currently in a browser that doesn't support it...
      if (this._wantsHashChange && this._wantsPushState && !this._hasPushState && !atRoot) {
        this.fragment = this.getFragment(null, true);
        this.location.replace(this.root + this.location.search + '#' + this.fragment);
        // Return immediately as browser will do redirect to new url
        return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
      } else if (this._wantsPushState && this._hasPushState && atRoot && loc.hash) {
        this.fragment = this.getHash().replace(routeStripper, '');
        this.history.replaceState({}, document.title, this.root + this.fragment + loc.search);
      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      Backbone.$(window).off('popstate', this.checkUrl).off('hashchange', this.checkUrl);
      clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();
      if (current === this.fragment && this.iframe) {
        current = this.getFragment(this.getHash(this.iframe));
      }
      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl() || this.loadUrl(this.getHash());
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragmentOverride) {
      var fragment = this.fragment = this.getFragment(fragmentOverride);
      var matched = _.any(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
      return matched;
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: options};
      fragment = this.getFragment(fragment || '');
      if (this.fragment === fragment) return;
      this.fragment = fragment;
      var url = this.root + fragment;

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._hasPushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

        // If hash changes haven't been explicitly disabled, update the hash
        // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if(!options.replace) this.iframe.document.open().close();
          this._updateHash(this.iframe.location, fragment, options.replace);
        }

        // If you've told us that you explicitly don't want fallback hashchange-
        // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error(model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

}).call(this);
tvpapp.define("backbone", ["underscore","jquery"], (function (global) {
    return function () {
        var ret, fn;
        return ret || global.Backbone;
    };
}(this)));

/*
TVPAGE COMMENT: USED http://builds.handlebarsjs.com.s3.amazonaws.com/handlebars-latest.js
Copyright (C) 2011 by Yehuda Katz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

@license
*/

// lib/handlebars/browser-prefix.js
(function(undefined) {
  var Handlebars = {};
;
// lib/handlebars/base.js

Handlebars.VERSION = "1.0.0";
Handlebars.COMPILER_REVISION = 4;

Handlebars.REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '>= 1.0.0'
};

Handlebars.helpers  = {};
Handlebars.partials = {};

var toString = Object.prototype.toString,
    functionType = '[object Function]',
    objectType = '[object Object]';

Handlebars.registerHelper = function(name, fn, inverse) {
  if (toString.call(name) === objectType) {
    if (inverse || fn) { throw new Handlebars.Exception('Arg not supported with multiple helpers'); }
    Handlebars.Utils.extend(this.helpers, name);
  } else {
    if (inverse) { fn.not = inverse; }
    this.helpers[name] = fn;
  }
};

Handlebars.registerPartial = function(name, str) {
  if (toString.call(name) === objectType) {
    Handlebars.Utils.extend(this.partials,  name);
  } else {
    this.partials[name] = str;
  }
};

Handlebars.registerHelper('helperMissing', function(arg) {
  if(arguments.length === 2) {
    return undefined;
  } else {
    throw new Error("Missing helper: '" + arg + "'");
  }
});

Handlebars.registerHelper('blockHelperMissing', function(context, options) {
  var inverse = options.inverse || function() {}, fn = options.fn;

  var type = toString.call(context);

  if(type === functionType) { context = context.call(this); }

  if(context === true) {
    return fn(this);
  } else if(context === false || context == null) {
    return inverse(this);
  } else if(type === "[object Array]") {
    if(context.length > 0) {
      return Handlebars.helpers.each(context, options);
    } else {
      return inverse(this);
    }
  } else {
    return fn(context);
  }
});

Handlebars.K = function() {};

Handlebars.createFrame = Object.create || function(object) {
  Handlebars.K.prototype = object;
  var obj = new Handlebars.K();
  Handlebars.K.prototype = null;
  return obj;
};

Handlebars.logger = {
  DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, level: 3,

  methodMap: {0: 'debug', 1: 'info', 2: 'warn', 3: 'error'},

  // can be overridden in the host environment
  log: function(level, obj) {
    if (Handlebars.logger.level <= level) {
      var method = Handlebars.logger.methodMap[level];
      if (typeof console !== 'undefined' && console[method]) {
        console[method].call(console, obj);
      }
    }
  }
};

Handlebars.log = function(level, obj) { Handlebars.logger.log(level, obj); };

Handlebars.registerHelper('each', function(context, options) {
  var fn = options.fn, inverse = options.inverse;
  var i = 0, ret = "", data;

  var type = toString.call(context);
  if(type === functionType) { context = context.call(this); }

  if (options.data) {
    data = Handlebars.createFrame(options.data);
  }

  if(context && typeof context === 'object') {
    if(context instanceof Array){
      for(var j = context.length; i<j; i++) {
        if (data) { data.index = i; }
        ret = ret + fn(context[i], { data: data });
      }
    } else {
      for(var key in context) {
        if(context.hasOwnProperty(key)) {
          if(data) { data.key = key; }
          ret = ret + fn(context[key], {data: data});
          i++;
        }
      }
    }
  }

  if(i === 0){
    ret = inverse(this);
  }

  return ret;
});

Handlebars.registerHelper('if', function(conditional, options) {
  var type = toString.call(conditional);
  if(type === functionType) { conditional = conditional.call(this); }

  if(Handlebars.Utils.isEmpty(conditional)) {
    return options.inverse(this);
  } else {
    return options.fn(this);
  }
});

Handlebars.registerHelper('unless', function(conditional, options) {
  return Handlebars.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn});
});

Handlebars.registerHelper('with', function(context, options) {
  var type = toString.call(context);
  if(type === functionType) { context = context.call(this); }

  if (!Handlebars.Utils.isEmpty(context)) return options.fn(context);
});

Handlebars.registerHelper('log', function(context, options) {
  var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
  Handlebars.log(level, context);
});
;
// lib/handlebars/compiler/parser.js
/* Jison generated parser */
var handlebars = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"root":3,"statements":4,"EOF":5,"program":6,"simpleInverse":7,"statement":8,"openInverse":9,"closeBlock":10,"openBlock":11,"mustache":12,"partial":13,"CONTENT":14,"COMMENT":15,"OPEN_BLOCK":16,"inMustache":17,"CLOSE":18,"OPEN_INVERSE":19,"OPEN_ENDBLOCK":20,"path":21,"OPEN":22,"OPEN_UNESCAPED":23,"CLOSE_UNESCAPED":24,"OPEN_PARTIAL":25,"partialName":26,"partial_option0":27,"inMustache_repetition0":28,"inMustache_option0":29,"dataName":30,"param":31,"STRING":32,"INTEGER":33,"BOOLEAN":34,"hash":35,"hash_repetition_plus0":36,"hashSegment":37,"ID":38,"EQUALS":39,"DATA":40,"pathSegments":41,"SEP":42,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",14:"CONTENT",15:"COMMENT",16:"OPEN_BLOCK",18:"CLOSE",19:"OPEN_INVERSE",20:"OPEN_ENDBLOCK",22:"OPEN",23:"OPEN_UNESCAPED",24:"CLOSE_UNESCAPED",25:"OPEN_PARTIAL",32:"STRING",33:"INTEGER",34:"BOOLEAN",38:"ID",39:"EQUALS",40:"DATA",42:"SEP"},
productions_: [0,[3,2],[6,2],[6,3],[6,2],[6,1],[6,1],[6,0],[4,1],[4,2],[8,3],[8,3],[8,1],[8,1],[8,1],[8,1],[11,3],[9,3],[10,3],[12,3],[12,3],[13,4],[7,2],[17,3],[17,1],[31,1],[31,1],[31,1],[31,1],[31,1],[35,1],[37,3],[26,1],[26,1],[26,1],[30,2],[21,1],[41,3],[41,1],[27,0],[27,1],[28,0],[28,2],[29,0],[29,1],[36,1],[36,2]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: return new yy.ProgramNode($$[$0-1]); 
break;
case 2:this.$ = new yy.ProgramNode([], $$[$0]);
break;
case 3:this.$ = new yy.ProgramNode($$[$0-2], $$[$0]);
break;
case 4:this.$ = new yy.ProgramNode($$[$0-1], []);
break;
case 5:this.$ = new yy.ProgramNode($$[$0]);
break;
case 6:this.$ = new yy.ProgramNode([]);
break;
case 7:this.$ = new yy.ProgramNode([]);
break;
case 8:this.$ = [$$[$0]];
break;
case 9: $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 10:this.$ = new yy.BlockNode($$[$0-2], $$[$0-1].inverse, $$[$0-1], $$[$0]);
break;
case 11:this.$ = new yy.BlockNode($$[$0-2], $$[$0-1], $$[$0-1].inverse, $$[$0]);
break;
case 12:this.$ = $$[$0];
break;
case 13:this.$ = $$[$0];
break;
case 14:this.$ = new yy.ContentNode($$[$0]);
break;
case 15:this.$ = new yy.CommentNode($$[$0]);
break;
case 16:this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]);
break;
case 17:this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]);
break;
case 18:this.$ = $$[$0-1];
break;
case 19:
    // Parsing out the '&' escape token at this level saves ~500 bytes after min due to the removal of one parser node.
    this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1], $$[$0-2][2] === '&');
  
break;
case 20:this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1], true);
break;
case 21:this.$ = new yy.PartialNode($$[$0-2], $$[$0-1]);
break;
case 22: 
break;
case 23:this.$ = [[$$[$0-2]].concat($$[$0-1]), $$[$0]];
break;
case 24:this.$ = [[$$[$0]], null];
break;
case 25:this.$ = $$[$0];
break;
case 26:this.$ = new yy.StringNode($$[$0]);
break;
case 27:this.$ = new yy.IntegerNode($$[$0]);
break;
case 28:this.$ = new yy.BooleanNode($$[$0]);
break;
case 29:this.$ = $$[$0];
break;
case 30:this.$ = new yy.HashNode($$[$0]);
break;
case 31:this.$ = [$$[$0-2], $$[$0]];
break;
case 32:this.$ = new yy.PartialNameNode($$[$0]);
break;
case 33:this.$ = new yy.PartialNameNode(new yy.StringNode($$[$0]));
break;
case 34:this.$ = new yy.PartialNameNode(new yy.IntegerNode($$[$0]));
break;
case 35:this.$ = new yy.DataNode($$[$0]);
break;
case 36:this.$ = new yy.IdNode($$[$0]);
break;
case 37: $$[$0-2].push({part: $$[$0], separator: $$[$0-1]}); this.$ = $$[$0-2]; 
break;
case 38:this.$ = [{part: $$[$0]}];
break;
case 41:this.$ = [];
break;
case 42:$$[$0-1].push($$[$0]);
break;
case 45:this.$ = [$$[$0]];
break;
case 46:$$[$0-1].push($$[$0]);
break;
}
},
table: [{3:1,4:2,8:3,9:4,11:5,12:6,13:7,14:[1,8],15:[1,9],16:[1,11],19:[1,10],22:[1,12],23:[1,13],25:[1,14]},{1:[3]},{5:[1,15],8:16,9:4,11:5,12:6,13:7,14:[1,8],15:[1,9],16:[1,11],19:[1,10],22:[1,12],23:[1,13],25:[1,14]},{5:[2,8],14:[2,8],15:[2,8],16:[2,8],19:[2,8],20:[2,8],22:[2,8],23:[2,8],25:[2,8]},{4:19,6:17,7:18,8:3,9:4,11:5,12:6,13:7,14:[1,8],15:[1,9],16:[1,11],19:[1,20],20:[2,7],22:[1,12],23:[1,13],25:[1,14]},{4:19,6:21,7:18,8:3,9:4,11:5,12:6,13:7,14:[1,8],15:[1,9],16:[1,11],19:[1,20],20:[2,7],22:[1,12],23:[1,13],25:[1,14]},{5:[2,12],14:[2,12],15:[2,12],16:[2,12],19:[2,12],20:[2,12],22:[2,12],23:[2,12],25:[2,12]},{5:[2,13],14:[2,13],15:[2,13],16:[2,13],19:[2,13],20:[2,13],22:[2,13],23:[2,13],25:[2,13]},{5:[2,14],14:[2,14],15:[2,14],16:[2,14],19:[2,14],20:[2,14],22:[2,14],23:[2,14],25:[2,14]},{5:[2,15],14:[2,15],15:[2,15],16:[2,15],19:[2,15],20:[2,15],22:[2,15],23:[2,15],25:[2,15]},{17:22,21:23,30:24,38:[1,27],40:[1,26],41:25},{17:28,21:23,30:24,38:[1,27],40:[1,26],41:25},{17:29,21:23,30:24,38:[1,27],40:[1,26],41:25},{17:30,21:23,30:24,38:[1,27],40:[1,26],41:25},{21:32,26:31,32:[1,33],33:[1,34],38:[1,27],41:25},{1:[2,1]},{5:[2,9],14:[2,9],15:[2,9],16:[2,9],19:[2,9],20:[2,9],22:[2,9],23:[2,9],25:[2,9]},{10:35,20:[1,36]},{4:37,8:3,9:4,11:5,12:6,13:7,14:[1,8],15:[1,9],16:[1,11],19:[1,10],20:[2,6],22:[1,12],23:[1,13],25:[1,14]},{7:38,8:16,9:4,11:5,12:6,13:7,14:[1,8],15:[1,9],16:[1,11],19:[1,20],20:[2,5],22:[1,12],23:[1,13],25:[1,14]},{17:22,18:[1,39],21:23,30:24,38:[1,27],40:[1,26],41:25},{10:40,20:[1,36]},{18:[1,41]},{18:[2,41],24:[2,41],28:42,32:[2,41],33:[2,41],34:[2,41],38:[2,41],40:[2,41]},{18:[2,24],24:[2,24]},{18:[2,36],24:[2,36],32:[2,36],33:[2,36],34:[2,36],38:[2,36],40:[2,36],42:[1,43]},{21:44,38:[1,27],41:25},{18:[2,38],24:[2,38],32:[2,38],33:[2,38],34:[2,38],38:[2,38],40:[2,38],42:[2,38]},{18:[1,45]},{18:[1,46]},{24:[1,47]},{18:[2,39],21:49,27:48,38:[1,27],41:25},{18:[2,32],38:[2,32]},{18:[2,33],38:[2,33]},{18:[2,34],38:[2,34]},{5:[2,10],14:[2,10],15:[2,10],16:[2,10],19:[2,10],20:[2,10],22:[2,10],23:[2,10],25:[2,10]},{21:50,38:[1,27],41:25},{8:16,9:4,11:5,12:6,13:7,14:[1,8],15:[1,9],16:[1,11],19:[1,10],20:[2,2],22:[1,12],23:[1,13],25:[1,14]},{4:51,8:3,9:4,11:5,12:6,13:7,14:[1,8],15:[1,9],16:[1,11],19:[1,10],20:[2,4],22:[1,12],23:[1,13],25:[1,14]},{14:[2,22],15:[2,22],16:[2,22],19:[2,22],20:[2,22],22:[2,22],23:[2,22],25:[2,22]},{5:[2,11],14:[2,11],15:[2,11],16:[2,11],19:[2,11],20:[2,11],22:[2,11],23:[2,11],25:[2,11]},{14:[2,17],15:[2,17],16:[2,17],19:[2,17],20:[2,17],22:[2,17],23:[2,17],25:[2,17]},{18:[2,43],21:55,24:[2,43],29:52,30:59,31:53,32:[1,56],33:[1,57],34:[1,58],35:54,36:60,37:61,38:[1,62],40:[1,26],41:25},{38:[1,63]},{18:[2,35],24:[2,35],32:[2,35],33:[2,35],34:[2,35],38:[2,35],40:[2,35]},{14:[2,16],15:[2,16],16:[2,16],19:[2,16],20:[2,16],22:[2,16],23:[2,16],25:[2,16]},{5:[2,19],14:[2,19],15:[2,19],16:[2,19],19:[2,19],20:[2,19],22:[2,19],23:[2,19],25:[2,19]},{5:[2,20],14:[2,20],15:[2,20],16:[2,20],19:[2,20],20:[2,20],22:[2,20],23:[2,20],25:[2,20]},{18:[1,64]},{18:[2,40]},{18:[1,65]},{8:16,9:4,11:5,12:6,13:7,14:[1,8],15:[1,9],16:[1,11],19:[1,10],20:[2,3],22:[1,12],23:[1,13],25:[1,14]},{18:[2,23],24:[2,23]},{18:[2,42],24:[2,42],32:[2,42],33:[2,42],34:[2,42],38:[2,42],40:[2,42]},{18:[2,44],24:[2,44]},{18:[2,25],24:[2,25],32:[2,25],33:[2,25],34:[2,25],38:[2,25],40:[2,25]},{18:[2,26],24:[2,26],32:[2,26],33:[2,26],34:[2,26],38:[2,26],40:[2,26]},{18:[2,27],24:[2,27],32:[2,27],33:[2,27],34:[2,27],38:[2,27],40:[2,27]},{18:[2,28],24:[2,28],32:[2,28],33:[2,28],34:[2,28],38:[2,28],40:[2,28]},{18:[2,29],24:[2,29],32:[2,29],33:[2,29],34:[2,29],38:[2,29],40:[2,29]},{18:[2,30],24:[2,30],37:66,38:[1,67]},{18:[2,45],24:[2,45],38:[2,45]},{18:[2,38],24:[2,38],32:[2,38],33:[2,38],34:[2,38],38:[2,38],39:[1,68],40:[2,38],42:[2,38]},{18:[2,37],24:[2,37],32:[2,37],33:[2,37],34:[2,37],38:[2,37],40:[2,37],42:[2,37]},{5:[2,21],14:[2,21],15:[2,21],16:[2,21],19:[2,21],20:[2,21],22:[2,21],23:[2,21],25:[2,21]},{5:[2,18],14:[2,18],15:[2,18],16:[2,18],19:[2,18],20:[2,18],22:[2,18],23:[2,18],25:[2,18]},{18:[2,46],24:[2,46],38:[2,46]},{39:[1,68]},{21:55,30:59,31:69,32:[1,56],33:[1,57],34:[1,58],38:[1,27],40:[1,26],41:25},{18:[2,31],24:[2,31],38:[2,31]}],
defaultActions: {15:[2,1],49:[2,40]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    this.yy.parser = this;
    if (typeof this.lexer.yylloc == "undefined")
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    var ranges = this.lexer.options && this.lexer.options.ranges;
    if (typeof this.yy.parseError === "function")
        this.parseError = this.yy.parseError;
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || 1;
        if (typeof token !== "number") {
            token = self.symbols_[token] || token;
        }
        return token;
    }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == "undefined") {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            var errStr = "";
            if (!recovering) {
                expected = [];
                for (p in table[state])
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                if (this.lexer.showPosition) {
                    errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                } else {
                    errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1?"end of input":"'" + (this.terminals_[symbol] || symbol) + "'");
                }
                this.parseError(errStr, {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            lstack.push(this.lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0)
                    recovering--;
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column};
            if (ranges) {
                yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
            }
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}
};
/* Jison generated lexer */
var lexer = (function(){
var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        if (this.options.ranges) this.yylloc.range = [0,0];
        this.offset = 0;
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) this.yylloc.range[1]++;

        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length-len-1);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length-1);
        this.matched = this.matched.substr(0, this.matched.length-1);

        if (lines.length-1) this.yylineno -= lines.length-1;
        var r = this.yylloc.range;

        this.yylloc = {first_line: this.yylloc.first_line,
          last_line: this.yylineno+1,
          first_column: this.yylloc.first_column,
          last_column: lines ?
              (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length:
              this.yylloc.first_column - len
          };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
less:function (n) {
        this.unput(this.match.slice(n));
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            tempMatch,
            index,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (!this.options.flex) break;
            }
        }
        if (match) {
            lines = match[0].match(/(?:\r\n?|\n).*/g);
            if (lines) this.yylineno += lines.length;
            this.yylloc = {first_line: this.yylloc.last_line,
                           last_line: this.yylineno+1,
                           first_column: this.yylloc.last_column,
                           last_column: lines ? lines[lines.length-1].length-lines[lines.length-1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length};
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            if (this.options.ranges) {
                this.yylloc.range = [this.offset, this.offset += this.yyleng];
            }
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index],this.conditionStack[this.conditionStack.length-1]);
            if (this.done && this._input) this.done = false;
            if (token) return token;
            else return;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(),
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.options = {};
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {


function strip(start, end) {
  return yy_.yytext = yy_.yytext.substr(start, yy_.yyleng-end);
}


var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:yy_.yytext = "\\"; return 14;
break;
case 1:
                                   if(yy_.yytext.slice(-1) !== "\\") this.begin("mu");
                                   if(yy_.yytext.slice(-1) === "\\") strip(0,1), this.begin("emu");
                                   if(yy_.yytext) return 14;
                                 
break;
case 2:return 14;
break;
case 3:
                                   if(yy_.yytext.slice(-1) !== "\\") this.popState();
                                   if(yy_.yytext.slice(-1) === "\\") strip(0,1);
                                   return 14;
                                 
break;
case 4:strip(0,4); this.popState(); return 15;
break;
case 5:return 25;
break;
case 6:return 16;
break;
case 7:return 20;
break;
case 8:return 19;
break;
case 9:return 19;
break;
case 10:return 23;
break;
case 11:return 22;
break;
case 12:this.popState(); this.begin('com');
break;
case 13:strip(3,5); this.popState(); return 15;
break;
case 14:return 22;
break;
case 15:return 39;
break;
case 16:return 38;
break;
case 17:return 38;
break;
case 18:return 42;
break;
case 19:/*ignore whitespace*/
break;
case 20:this.popState(); return 24;
break;
case 21:this.popState(); return 18;
break;
case 22:yy_.yytext = strip(1,2).replace(/\\"/g,'"'); return 32;
break;
case 23:yy_.yytext = strip(1,2).replace(/\\'/g,"'"); return 32;
break;
case 24:return 40;
break;
case 25:return 34;
break;
case 26:return 34;
break;
case 27:return 33;
break;
case 28:return 38;
break;
case 29:yy_.yytext = strip(1,2); return 38;
break;
case 30:return 'INVALID';
break;
case 31:return 5;
break;
}
};
lexer.rules = [/^(?:\\\\(?=(\{\{)))/,/^(?:[^\x00]*?(?=(\{\{)))/,/^(?:[^\x00]+)/,/^(?:[^\x00]{2,}?(?=(\{\{|$)))/,/^(?:[\s\S]*?--\}\})/,/^(?:\{\{>)/,/^(?:\{\{#)/,/^(?:\{\{\/)/,/^(?:\{\{\^)/,/^(?:\{\{\s*else\b)/,/^(?:\{\{\{)/,/^(?:\{\{&)/,/^(?:\{\{!--)/,/^(?:\{\{![\s\S]*?\}\})/,/^(?:\{\{)/,/^(?:=)/,/^(?:\.(?=[}\/ ]))/,/^(?:\.\.)/,/^(?:[\/.])/,/^(?:\s+)/,/^(?:\}\}\})/,/^(?:\}\})/,/^(?:"(\\["]|[^"])*")/,/^(?:'(\\[']|[^'])*')/,/^(?:@)/,/^(?:true(?=[}\s]))/,/^(?:false(?=[}\s]))/,/^(?:-?[0-9]+(?=[}\s]))/,/^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.])))/,/^(?:\[[^\]]*\])/,/^(?:.)/,/^(?:$)/];
lexer.conditions = {"mu":{"rules":[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31],"inclusive":false},"emu":{"rules":[3],"inclusive":false},"com":{"rules":[4],"inclusive":false},"INITIAL":{"rules":[0,1,2,31],"inclusive":true}};
return lexer;})()
parser.lexer = lexer;
function Parser () { this.yy = {}; }Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();;
// lib/handlebars/compiler/base.js

Handlebars.Parser = handlebars;

Handlebars.parse = function(input) {

  // Just return if an already-compile AST was passed in.
  if(input.constructor === Handlebars.AST.ProgramNode) { return input; }

  Handlebars.Parser.yy = Handlebars.AST;
  return Handlebars.Parser.parse(input);
};
;
// lib/handlebars/compiler/ast.js
Handlebars.AST = {};

Handlebars.AST.ProgramNode = function(statements, inverse) {
  this.type = "program";
  this.statements = statements;
  if(inverse) { this.inverse = new Handlebars.AST.ProgramNode(inverse); }
};

Handlebars.AST.MustacheNode = function(rawParams, hash, unescaped) {
  this.type = "mustache";
  this.escaped = !unescaped;
  this.hash = hash;

  var id = this.id = rawParams[0];
  var params = this.params = rawParams.slice(1);

  // a mustache is an eligible helper if:
  // * its id is simple (a single part, not `this` or `..`)
  var eligibleHelper = this.eligibleHelper = id.isSimple;

  // a mustache is definitely a helper if:
  // * it is an eligible helper, and
  // * it has at least one parameter or hash segment
  this.isHelper = eligibleHelper && (params.length || hash);

  // if a mustache is an eligible helper but not a definite
  // helper, it is ambiguous, and will be resolved in a later
  // pass or at runtime.
};

Handlebars.AST.PartialNode = function(partialName, context) {
  this.type         = "partial";
  this.partialName  = partialName;
  this.context      = context;
};

Handlebars.AST.BlockNode = function(mustache, program, inverse, close) {
  if(mustache.id.original !== close.original) {
    throw new Handlebars.Exception(mustache.id.original + " doesn't match " + close.original);
  }

  this.type = "block";
  this.mustache = mustache;
  this.program  = program;
  this.inverse  = inverse;

  if (this.inverse && !this.program) {
    this.isInverse = true;
  }
};

Handlebars.AST.ContentNode = function(string) {
  this.type = "content";
  this.string = string;
};

Handlebars.AST.HashNode = function(pairs) {
  this.type = "hash";
  this.pairs = pairs;
};

Handlebars.AST.IdNode = function(parts) {
  this.type = "ID";

  var original = "",
      dig = [],
      depth = 0;

  for(var i=0,l=parts.length; i<l; i++) {
    var part = parts[i].part;
    original += (parts[i].separator || '') + part;

    if (part === ".." || part === "." || part === "this") {
      if (dig.length > 0) { throw new Handlebars.Exception("Invalid path: " + original); }
      else if (part === "..") { depth++; }
      else { this.isScoped = true; }
    }
    else { dig.push(part); }
  }

  this.original = original;
  this.parts    = dig;
  this.string   = dig.join('.');
  this.depth    = depth;

  // an ID is simple if it only has one part, and that part is not
  // `..` or `this`.
  this.isSimple = parts.length === 1 && !this.isScoped && depth === 0;

  this.stringModeValue = this.string;
};

Handlebars.AST.PartialNameNode = function(name) {
  this.type = "PARTIAL_NAME";
  this.name = name.original;
};

Handlebars.AST.DataNode = function(id) {
  this.type = "DATA";
  this.id = id;
};

Handlebars.AST.StringNode = function(string) {
  this.type = "STRING";
  this.original =
    this.string =
    this.stringModeValue = string;
};

Handlebars.AST.IntegerNode = function(integer) {
  this.type = "INTEGER";
  this.original =
    this.integer = integer;
  this.stringModeValue = Number(integer);
};

Handlebars.AST.BooleanNode = function(bool) {
  this.type = "BOOLEAN";
  this.bool = bool;
  this.stringModeValue = bool === "true";
};

Handlebars.AST.CommentNode = function(comment) {
  this.type = "comment";
  this.comment = comment;
};
;
// lib/handlebars/utils.js

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

Handlebars.Exception = function(message) {
  var tmp = Error.prototype.constructor.apply(this, arguments);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }
};
Handlebars.Exception.prototype = new Error();

// Build out our basic SafeString type
Handlebars.SafeString = function(string) {
  this.string = string;
};
Handlebars.SafeString.prototype.toString = function() {
  return "" + this.string;
};

var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

var badChars = /[&<>"'`]/g;
var possible = /[&<>"'`]/;

var escapeChar = function(chr) {
  return escape[chr] || "&amp;";
};

Handlebars.Utils = {
  extend: function(obj, value) {
    for(var key in value) {
      if(value.hasOwnProperty(key)) {
        obj[key] = value[key];
      }
    }
  },

  escapeExpression: function(string) {
    // don't escape SafeStrings, since they're already safe
    if (string instanceof Handlebars.SafeString) {
      return string.toString();
    } else if (string == null || string === false) {
      return "";
    }

    // Force a string conversion as this will be done by the append regardless and
    // the regex test will do this transparently behind the scenes, causing issues if
    // an object's to string has escaped characters in it.
    string = "" + string;

    if(!possible.test(string)) { return string; }
    return string.replace(badChars, escapeChar);
  },

  isEmpty: function(value) {
    if (!value && value !== 0) {
      return true;
    } else if(toString.call(value) === "[object Array]" && value.length === 0) {
      return true;
    } else {
      return false;
    }
  }
};
;
// lib/handlebars/compiler/compiler.js

/*jshint eqnull:true*/
var Compiler = Handlebars.Compiler = function() {};

// the foundHelper register will disambiguate helper lookup from finding a
// function in a context. This is necessary for mustache compatibility, which
// requires that context functions in blocks are evaluated by blockHelperMissing,
// and then proceed as if the resulting value was provided to blockHelperMissing.

Compiler.prototype = {
  compiler: Compiler,

  disassemble: function() {
    var opcodes = this.opcodes, opcode, out = [], params, param;

    for (var i=0, l=opcodes.length; i<l; i++) {
      opcode = opcodes[i];

      if (opcode.opcode === 'DECLARE') {
        out.push("DECLARE " + opcode.name + "=" + opcode.value);
      } else {
        params = [];
        for (var j=0; j<opcode.args.length; j++) {
          param = opcode.args[j];
          if (typeof param === "string") {
            param = "\"" + param.replace("\n", "\\n") + "\"";
          }
          params.push(param);
        }
        out.push(opcode.opcode + " " + params.join(" "));
      }
    }

    return out.join("\n");
  },
  equals: function(other) {
    var len = this.opcodes.length;
    if (other.opcodes.length !== len) {
      return false;
    }

    for (var i = 0; i < len; i++) {
      var opcode = this.opcodes[i],
          otherOpcode = other.opcodes[i];
      if (opcode.opcode !== otherOpcode.opcode || opcode.args.length !== otherOpcode.args.length) {
        return false;
      }
      for (var j = 0; j < opcode.args.length; j++) {
        if (opcode.args[j] !== otherOpcode.args[j]) {
          return false;
        }
      }
    }

    len = this.children.length;
    if (other.children.length !== len) {
      return false;
    }
    for (i = 0; i < len; i++) {
      if (!this.children[i].equals(other.children[i])) {
        return false;
      }
    }

    return true;
  },

  guid: 0,

  compile: function(program, options) {
    this.children = [];
    this.depths = {list: []};
    this.options = options;

    // These changes will propagate to the other compiler components
    var knownHelpers = this.options.knownHelpers;
    this.options.knownHelpers = {
      'helperMissing': true,
      'blockHelperMissing': true,
      'each': true,
      'if': true,
      'unless': true,
      'with': true,
      'log': true
    };
    if (knownHelpers) {
      for (var name in knownHelpers) {
        this.options.knownHelpers[name] = knownHelpers[name];
      }
    }

    return this.program(program);
  },

  accept: function(node) {
    return this[node.type](node);
  },

  program: function(program) {
    var statements = program.statements, statement;
    this.opcodes = [];

    for(var i=0, l=statements.length; i<l; i++) {
      statement = statements[i];
      this[statement.type](statement);
    }
    this.isSimple = l === 1;

    this.depths.list = this.depths.list.sort(function(a, b) {
      return a - b;
    });

    return this;
  },

  compileProgram: function(program) {
    var result = new this.compiler().compile(program, this.options);
    var guid = this.guid++, depth;

    this.usePartial = this.usePartial || result.usePartial;

    this.children[guid] = result;

    for(var i=0, l=result.depths.list.length; i<l; i++) {
      depth = result.depths.list[i];

      if(depth < 2) { continue; }
      else { this.addDepth(depth - 1); }
    }

    return guid;
  },

  block: function(block) {
    var mustache = block.mustache,
        program = block.program,
        inverse = block.inverse;

    if (program) {
      program = this.compileProgram(program);
    }

    if (inverse) {
      inverse = this.compileProgram(inverse);
    }

    var type = this.classifyMustache(mustache);

    if (type === "helper") {
      this.helperMustache(mustache, program, inverse);
    } else if (type === "simple") {
      this.simpleMustache(mustache);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('blockValue');
    } else {
      this.ambiguousMustache(mustache, program, inverse);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('ambiguousBlockValue');
    }

    this.opcode('append');
  },

  hash: function(hash) {
    var pairs = hash.pairs, pair, val;

    this.opcode('pushHash');

    for(var i=0, l=pairs.length; i<l; i++) {
      pair = pairs[i];
      val  = pair[1];

      if (this.options.stringParams) {
        if(val.depth) {
          this.addDepth(val.depth);
        }
        this.opcode('getContext', val.depth || 0);
        this.opcode('pushStringParam', val.stringModeValue, val.type);
      } else {
        this.accept(val);
      }

      this.opcode('assignToHash', pair[0]);
    }
    this.opcode('popHash');
  },

  partial: function(partial) {
    var partialName = partial.partialName;
    this.usePartial = true;

    if(partial.context) {
      this.ID(partial.context);
    } else {
      this.opcode('push', 'depth0');
    }

    this.opcode('invokePartial', partialName.name);
    this.opcode('append');
  },

  content: function(content) {
    this.opcode('appendContent', content.string);
  },

  mustache: function(mustache) {
    var options = this.options;
    var type = this.classifyMustache(mustache);

    if (type === "simple") {
      this.simpleMustache(mustache);
    } else if (type === "helper") {
      this.helperMustache(mustache);
    } else {
      this.ambiguousMustache(mustache);
    }

    if(mustache.escaped && !options.noEscape) {
      this.opcode('appendEscaped');
    } else {
      this.opcode('append');
    }
  },

  ambiguousMustache: function(mustache, program, inverse) {
    var id = mustache.id,
        name = id.parts[0],
        isBlock = program != null || inverse != null;

    this.opcode('getContext', id.depth);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    this.opcode('invokeAmbiguous', name, isBlock);
  },

  simpleMustache: function(mustache) {
    var id = mustache.id;

    if (id.type === 'DATA') {
      this.DATA(id);
    } else if (id.parts.length) {
      this.ID(id);
    } else {
      // Simplified ID for `this`
      this.addDepth(id.depth);
      this.opcode('getContext', id.depth);
      this.opcode('pushContext');
    }

    this.opcode('resolvePossibleLambda');
  },

  helperMustache: function(mustache, program, inverse) {
    var params = this.setupFullMustacheParams(mustache, program, inverse),
        name = mustache.id.parts[0];

    if (this.options.knownHelpers[name]) {
      this.opcode('invokeKnownHelper', params.length, name);
    } else if (this.options.knownHelpersOnly) {
      throw new Error("You specified knownHelpersOnly, but used the unknown helper " + name);
    } else {
      this.opcode('invokeHelper', params.length, name);
    }
  },

  ID: function(id) {
    this.addDepth(id.depth);
    this.opcode('getContext', id.depth);

    var name = id.parts[0];
    if (!name) {
      this.opcode('pushContext');
    } else {
      this.opcode('lookupOnContext', id.parts[0]);
    }

    for(var i=1, l=id.parts.length; i<l; i++) {
      this.opcode('lookup', id.parts[i]);
    }
  },

  DATA: function(data) {
    this.options.data = true;
    if (data.id.isScoped || data.id.depth) {
      throw new Handlebars.Exception('Scoped data references are not supported: ' + data.original);
    }

    this.opcode('lookupData');
    var parts = data.id.parts;
    for(var i=0, l=parts.length; i<l; i++) {
      this.opcode('lookup', parts[i]);
    }
  },

  STRING: function(string) {
    this.opcode('pushString', string.string);
  },

  INTEGER: function(integer) {
    this.opcode('pushLiteral', integer.integer);
  },

  BOOLEAN: function(bool) {
    this.opcode('pushLiteral', bool.bool);
  },

  comment: function() {},

  // HELPERS
  opcode: function(name) {
    this.opcodes.push({ opcode: name, args: [].slice.call(arguments, 1) });
  },

  declare: function(name, value) {
    this.opcodes.push({ opcode: 'DECLARE', name: name, value: value });
  },

  addDepth: function(depth) {
    if(isNaN(depth)) { throw new Error("EWOT"); }
    if(depth === 0) { return; }

    if(!this.depths[depth]) {
      this.depths[depth] = true;
      this.depths.list.push(depth);
    }
  },

  classifyMustache: function(mustache) {
    var isHelper   = mustache.isHelper;
    var isEligible = mustache.eligibleHelper;
    var options    = this.options;

    // if ambiguous, we can possibly resolve the ambiguity now
    if (isEligible && !isHelper) {
      var name = mustache.id.parts[0];

      if (options.knownHelpers[name]) {
        isHelper = true;
      } else if (options.knownHelpersOnly) {
        isEligible = false;
      }
    }

    if (isHelper) { return "helper"; }
    else if (isEligible) { return "ambiguous"; }
    else { return "simple"; }
  },

  pushParams: function(params) {
    var i = params.length, param;

    while(i--) {
      param = params[i];

      if(this.options.stringParams) {
        if(param.depth) {
          this.addDepth(param.depth);
        }

        this.opcode('getContext', param.depth || 0);
        this.opcode('pushStringParam', param.stringModeValue, param.type);
      } else {
        this[param.type](param);
      }
    }
  },

  setupMustacheParams: function(mustache) {
    var params = mustache.params;
    this.pushParams(params);

    if(mustache.hash) {
      this.hash(mustache.hash);
    } else {
      this.opcode('emptyHash');
    }

    return params;
  },

  // this will replace setupMustacheParams when we're done
  setupFullMustacheParams: function(mustache, program, inverse) {
    var params = mustache.params;
    this.pushParams(params);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    if(mustache.hash) {
      this.hash(mustache.hash);
    } else {
      this.opcode('emptyHash');
    }

    return params;
  }
};

Handlebars.precompile = function(input, options) {
  if (input == null || (typeof input !== 'string' && input.constructor !== Handlebars.AST.ProgramNode)) {
    throw new Handlebars.Exception("You must pass a string or Handlebars AST to Handlebars.precompile. You passed " + input);
  }

  options = options || {};
  if (!('data' in options)) {
    options.data = true;
  }
  var ast = Handlebars.parse(input);
  var environment = new Compiler().compile(ast, options);
  return new Handlebars.JavaScriptCompiler().compile(environment, options);
};

Handlebars.compile = function(input, options) {
  if (input == null || (typeof input !== 'string' && input.constructor !== Handlebars.AST.ProgramNode)) {
    throw new Handlebars.Exception("You must pass a string or Handlebars AST to Handlebars.compile. You passed " + input);
  }

  options = options || {};
  if (!('data' in options)) {
    options.data = true;
  }
  var compiled;
  function compile() {
    var ast = Handlebars.parse(input);
    var environment = new Compiler().compile(ast, options);
    var templateSpec = new Handlebars.JavaScriptCompiler().compile(environment, options, undefined, true);
    return Handlebars.template(templateSpec);
  }

  // Template is only compiled on first use and cached after that point.
  return function(context, options) {
    if (!compiled) {
      compiled = compile();
    }
    return compiled.call(this, context, options);
  };
};

;
// lib/handlebars/compiler/javascript-compiler.js
/*jshint eqnull:true*/

var Literal = function(value) {
  this.value = value;
};


var JavaScriptCompiler = Handlebars.JavaScriptCompiler = function() {};

JavaScriptCompiler.prototype = {
  // PUBLIC API: You can override these methods in a subclass to provide
  // alternative compiled forms for name lookup and buffering semantics
  nameLookup: function(parent, name /* , type*/) {
    if (/^[0-9]+$/.test(name)) {
      return parent + "[" + name + "]";
    } else if (JavaScriptCompiler.isValidJavaScriptVariableName(name)) {
      return parent + "." + name;
    }
    else {
      return parent + "['" + name + "']";
    }
  },

  appendToBuffer: function(string) {
    if (this.environment.isSimple) {
      return "return " + string + ";";
    } else {
      return {
        appendToBuffer: true,
        content: string,
        toString: function() { return "buffer += " + string + ";"; }
      };
    }
  },

  initializeBuffer: function() {
    return this.quotedString("");
  },

  namespace: "Handlebars",
  // END PUBLIC API

  compile: function(environment, options, context, asObject) {
    this.environment = environment;
    this.options = options || {};

    Handlebars.log(Handlebars.logger.DEBUG, this.environment.disassemble() + "\n\n");

    this.name = this.environment.name;
    this.isChild = !!context;
    this.context = context || {
      programs: [],
      environments: [],
      aliases: { }
    };

    this.preamble();

    this.stackSlot = 0;
    this.stackVars = [];
    this.registers = { list: [] };
    this.compileStack = [];
    this.inlineStack = [];

    this.compileChildren(environment, options);

    var opcodes = environment.opcodes, opcode;

    this.i = 0;

    for(var l=opcodes.length; this.i<l; this.i++) {
      opcode = opcodes[this.i];

      if(opcode.opcode === 'DECLARE') {
        this[opcode.name] = opcode.value;
      } else {
        this[opcode.opcode].apply(this, opcode.args);
      }
    }

    return this.createFunctionContext(asObject);
  },

  nextOpcode: function() {
    var opcodes = this.environment.opcodes;
    return opcodes[this.i + 1];
  },

  eat: function() {
    this.i = this.i + 1;
  },

  preamble: function() {
    var out = [];

    if (!this.isChild) {
      var namespace = this.namespace;

      var copies = "helpers = this.merge(helpers, " + namespace + ".helpers);";
      if (this.environment.usePartial) { copies = copies + " partials = this.merge(partials, " + namespace + ".partials);"; }
      if (this.options.data) { copies = copies + " data = data || {};"; }
      out.push(copies);
    } else {
      out.push('');
    }

    if (!this.environment.isSimple) {
      out.push(", buffer = " + this.initializeBuffer());
    } else {
      out.push("");
    }

    // track the last context pushed into place to allow skipping the
    // getContext opcode when it would be a noop
    this.lastContext = 0;
    this.source = out;
  },

  createFunctionContext: function(asObject) {
    var locals = this.stackVars.concat(this.registers.list);

    if(locals.length > 0) {
      this.source[1] = this.source[1] + ", " + locals.join(", ");
    }

    // Generate minimizer alias mappings
    if (!this.isChild) {
      for (var alias in this.context.aliases) {
        if (this.context.aliases.hasOwnProperty(alias)) {
          this.source[1] = this.source[1] + ', ' + alias + '=' + this.context.aliases[alias];
        }
      }
    }

    if (this.source[1]) {
      this.source[1] = "var " + this.source[1].substring(2) + ";";
    }

    // Merge children
    if (!this.isChild) {
      this.source[1] += '\n' + this.context.programs.join('\n') + '\n';
    }

    if (!this.environment.isSimple) {
      this.source.push("return buffer;");
    }

    var params = this.isChild ? ["depth0", "data"] : ["Handlebars", "depth0", "helpers", "partials", "data"];

    for(var i=0, l=this.environment.depths.list.length; i<l; i++) {
      params.push("depth" + this.environment.depths.list[i]);
    }

    // Perform a second pass over the output to merge content when possible
    var source = this.mergeSource();

    if (!this.isChild) {
      var revision = Handlebars.COMPILER_REVISION,
          versions = Handlebars.REVISION_CHANGES[revision];
      source = "this.compilerInfo = ["+revision+",'"+versions+"'];\n"+source;
    }

    if (asObject) {
      params.push(source);

      return Function.apply(this, params);
    } else {
      var functionSource = 'function ' + (this.name || '') + '(' + params.join(',') + ') {\n  ' + source + '}';
      Handlebars.log(Handlebars.logger.DEBUG, functionSource + "\n\n");
      return functionSource;
    }
  },
  mergeSource: function() {
    // WARN: We are not handling the case where buffer is still populated as the source should
    // not have buffer append operations as their final action.
    var source = '',
        buffer;
    for (var i = 0, len = this.source.length; i < len; i++) {
      var line = this.source[i];
      if (line.appendToBuffer) {
        if (buffer) {
          buffer = buffer + '\n    + ' + line.content;
        } else {
          buffer = line.content;
        }
      } else {
        if (buffer) {
          source += 'buffer += ' + buffer + ';\n  ';
          buffer = undefined;
        }
        source += line + '\n  ';
      }
    }
    return source;
  },

  // [blockValue]
  //
  // On stack, before: hash, inverse, program, value
  // On stack, after: return value of blockHelperMissing
  //
  // The purpose of this opcode is to take a block of the form
  // `{{#foo}}...{{/foo}}`, resolve the value of `foo`, and
  // replace it on the stack with the result of properly
  // invoking blockHelperMissing.
  blockValue: function() {
    this.context.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    var params = ["depth0"];
    this.setupParams(0, params);

    this.replaceStack(function(current) {
      params.splice(1, 0, current);
      return "blockHelperMissing.call(" + params.join(", ") + ")";
    });
  },

  // [ambiguousBlockValue]
  //
  // On stack, before: hash, inverse, program, value
  // Compiler value, before: lastHelper=value of last found helper, if any
  // On stack, after, if no lastHelper: same as [blockValue]
  // On stack, after, if lastHelper: value
  ambiguousBlockValue: function() {
    this.context.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    var params = ["depth0"];
    this.setupParams(0, params);

    var current = this.topStack();
    params.splice(1, 0, current);

    // Use the options value generated from the invocation
    params[params.length-1] = 'options';

    this.source.push("if (!" + this.lastHelper + ") { " + current + " = blockHelperMissing.call(" + params.join(", ") + "); }");
  },

  // [appendContent]
  //
  // On stack, before: ...
  // On stack, after: ...
  //
  // Appends the string value of `content` to the current buffer
  appendContent: function(content) {
    this.source.push(this.appendToBuffer(this.quotedString(content)));
  },

  // [append]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Coerces `value` to a String and appends it to the current buffer.
  //
  // If `value` is truthy, or 0, it is coerced into a string and appended
  // Otherwise, the empty string is appended
  append: function() {
    // Force anything that is inlined onto the stack so we don't have duplication
    // when we examine local
    this.flushInline();
    var local = this.popStack();
    this.source.push("if(" + local + " || " + local + " === 0) { " + this.appendToBuffer(local) + " }");
    if (this.environment.isSimple) {
      this.source.push("else { " + this.appendToBuffer("''") + " }");
    }
  },

  // [appendEscaped]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Escape `value` and append it to the buffer
  appendEscaped: function() {
    this.context.aliases.escapeExpression = 'this.escapeExpression';

    this.source.push(this.appendToBuffer("escapeExpression(" + this.popStack() + ")"));
  },

  // [getContext]
  //
  // On stack, before: ...
  // On stack, after: ...
  // Compiler value, after: lastContext=depth
  //
  // Set the value of the `lastContext` compiler value to the depth
  getContext: function(depth) {
    if(this.lastContext !== depth) {
      this.lastContext = depth;
    }
  },

  // [lookupOnContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext[name], ...
  //
  // Looks up the value of `name` on the current context and pushes
  // it onto the stack.
  lookupOnContext: function(name) {
    this.push(this.nameLookup('depth' + this.lastContext, name, 'context'));
  },

  // [pushContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext, ...
  //
  // Pushes the value of the current context onto the stack.
  pushContext: function() {
    this.pushStackLiteral('depth' + this.lastContext);
  },

  // [resolvePossibleLambda]
  //
  // On stack, before: value, ...
  // On stack, after: resolved value, ...
  //
  // If the `value` is a lambda, replace it on the stack by
  // the return value of the lambda
  resolvePossibleLambda: function() {
    this.context.aliases.functionType = '"function"';

    this.replaceStack(function(current) {
      return "typeof " + current + " === functionType ? " + current + ".apply(depth0) : " + current;
    });
  },

  // [lookup]
  //
  // On stack, before: value, ...
  // On stack, after: value[name], ...
  //
  // Replace the value on the stack with the result of looking
  // up `name` on `value`
  lookup: function(name) {
    this.replaceStack(function(current) {
      return current + " == null || " + current + " === false ? " + current + " : " + this.nameLookup(current, name, 'context');
    });
  },

  // [lookupData]
  //
  // On stack, before: ...
  // On stack, after: data, ...
  //
  // Push the data lookup operator
  lookupData: function() {
    this.push('data');
  },

  // [pushStringParam]
  //
  // On stack, before: ...
  // On stack, after: string, currentContext, ...
  //
  // This opcode is designed for use in string mode, which
  // provides the string value of a parameter along with its
  // depth rather than resolving it immediately.
  pushStringParam: function(string, type) {
    this.pushStackLiteral('depth' + this.lastContext);

    this.pushString(type);

    if (typeof string === 'string') {
      this.pushString(string);
    } else {
      this.pushStackLiteral(string);
    }
  },

  emptyHash: function() {
    this.pushStackLiteral('{}');

    if (this.options.stringParams) {
      this.register('hashTypes', '{}');
      this.register('hashContexts', '{}');
    }
  },
  pushHash: function() {
    this.hash = {values: [], types: [], contexts: []};
  },
  popHash: function() {
    var hash = this.hash;
    this.hash = undefined;

    if (this.options.stringParams) {
      this.register('hashContexts', '{' + hash.contexts.join(',') + '}');
      this.register('hashTypes', '{' + hash.types.join(',') + '}');
    }
    this.push('{\n    ' + hash.values.join(',\n    ') + '\n  }');
  },

  // [pushString]
  //
  // On stack, before: ...
  // On stack, after: quotedString(string), ...
  //
  // Push a quoted version of `string` onto the stack
  pushString: function(string) {
    this.pushStackLiteral(this.quotedString(string));
  },

  // [push]
  //
  // On stack, before: ...
  // On stack, after: expr, ...
  //
  // Push an expression onto the stack
  push: function(expr) {
    this.inlineStack.push(expr);
    return expr;
  },

  // [pushLiteral]
  //
  // On stack, before: ...
  // On stack, after: value, ...
  //
  // Pushes a value onto the stack. This operation prevents
  // the compiler from creating a temporary variable to hold
  // it.
  pushLiteral: function(value) {
    this.pushStackLiteral(value);
  },

  // [pushProgram]
  //
  // On stack, before: ...
  // On stack, after: program(guid), ...
  //
  // Push a program expression onto the stack. This takes
  // a compile-time guid and converts it into a runtime-accessible
  // expression.
  pushProgram: function(guid) {
    if (guid != null) {
      this.pushStackLiteral(this.programExpression(guid));
    } else {
      this.pushStackLiteral(null);
    }
  },

  // [invokeHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // Pops off the helper's parameters, invokes the helper,
  // and pushes the helper's return value onto the stack.
  //
  // If the helper is not found, `helperMissing` is called.
  invokeHelper: function(paramSize, name) {
    this.context.aliases.helperMissing = 'helpers.helperMissing';

    var helper = this.lastHelper = this.setupHelper(paramSize, name, true);
    var nonHelper = this.nameLookup('depth' + this.lastContext, name, 'context');

    this.push(helper.name + ' || ' + nonHelper);
    this.replaceStack(function(name) {
      return name + ' ? ' + name + '.call(' +
          helper.callParams + ") " + ": helperMissing.call(" +
          helper.helperMissingParams + ")";
    });
  },

  // [invokeKnownHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // This operation is used when the helper is known to exist,
  // so a `helperMissing` fallback is not required.
  invokeKnownHelper: function(paramSize, name) {
    var helper = this.setupHelper(paramSize, name);
    this.push(helper.name + ".call(" + helper.callParams + ")");
  },

  // [invokeAmbiguous]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of disambiguation
  //
  // This operation is used when an expression like `{{foo}}`
  // is provided, but we don't know at compile-time whether it
  // is a helper or a path.
  //
  // This operation emits more code than the other options,
  // and can be avoided by passing the `knownHelpers` and
  // `knownHelpersOnly` flags at compile-time.
  invokeAmbiguous: function(name, helperCall) {
    this.context.aliases.functionType = '"function"';

    this.pushStackLiteral('{}');    // Hash value
    var helper = this.setupHelper(0, name, helperCall);

    var helperName = this.lastHelper = this.nameLookup('helpers', name, 'helper');

    var nonHelper = this.nameLookup('depth' + this.lastContext, name, 'context');
    var nextStack = this.nextStack();

    this.source.push('if (' + nextStack + ' = ' + helperName + ') { ' + nextStack + ' = ' + nextStack + '.call(' + helper.callParams + '); }');
    this.source.push('else { ' + nextStack + ' = ' + nonHelper + '; ' + nextStack + ' = typeof ' + nextStack + ' === functionType ? ' + nextStack + '.apply(depth0) : ' + nextStack + '; }');
  },

  // [invokePartial]
  //
  // On stack, before: context, ...
  // On stack after: result of partial invocation
  //
  // This operation pops off a context, invokes a partial with that context,
  // and pushes the result of the invocation back.
  invokePartial: function(name) {
    var params = [this.nameLookup('partials', name, 'partial'), "'" + name + "'", this.popStack(), "helpers", "partials"];

    if (this.options.data) {
      params.push("data");
    }

    this.context.aliases.self = "this";
    this.push("self.invokePartial(" + params.join(", ") + ")");
  },

  // [assignToHash]
  //
  // On stack, before: value, hash, ...
  // On stack, after: hash, ...
  //
  // Pops a value and hash off the stack, assigns `hash[key] = value`
  // and pushes the hash back onto the stack.
  assignToHash: function(key) {
    var value = this.popStack(),
        context,
        type;

    if (this.options.stringParams) {
      type = this.popStack();
      context = this.popStack();
    }

    var hash = this.hash;
    if (context) {
      hash.contexts.push("'" + key + "': " + context);
    }
    if (type) {
      hash.types.push("'" + key + "': " + type);
    }
    hash.values.push("'" + key + "': (" + value + ")");
  },

  // HELPERS

  compiler: JavaScriptCompiler,

  compileChildren: function(environment, options) {
    var children = environment.children, child, compiler;

    for(var i=0, l=children.length; i<l; i++) {
      child = children[i];
      compiler = new this.compiler();

      var index = this.matchExistingProgram(child);

      if (index == null) {
        this.context.programs.push('');     // Placeholder to prevent name conflicts for nested children
        index = this.context.programs.length;
        child.index = index;
        child.name = 'program' + index;
        this.context.programs[index] = compiler.compile(child, options, this.context);
        this.context.environments[index] = child;
      } else {
        child.index = index;
        child.name = 'program' + index;
      }
    }
  },
  matchExistingProgram: function(child) {
    for (var i = 0, len = this.context.environments.length; i < len; i++) {
      var environment = this.context.environments[i];
      if (environment && environment.equals(child)) {
        return i;
      }
    }
  },

  programExpression: function(guid) {
    this.context.aliases.self = "this";

    if(guid == null) {
      return "self.noop";
    }

    var child = this.environment.children[guid],
        depths = child.depths.list, depth;

    var programParams = [child.index, child.name, "data"];

    for(var i=0, l = depths.length; i<l; i++) {
      depth = depths[i];

      if(depth === 1) { programParams.push("depth0"); }
      else { programParams.push("depth" + (depth - 1)); }
    }

    return (depths.length === 0 ? "self.program(" : "self.programWithDepth(") + programParams.join(", ") + ")";
  },

  register: function(name, val) {
    this.useRegister(name);
    this.source.push(name + " = " + val + ";");
  },

  useRegister: function(name) {
    if(!this.registers[name]) {
      this.registers[name] = true;
      this.registers.list.push(name);
    }
  },

  pushStackLiteral: function(item) {
    return this.push(new Literal(item));
  },

  pushStack: function(item) {
    this.flushInline();

    var stack = this.incrStack();
    if (item) {
      this.source.push(stack + " = " + item + ";");
    }
    this.compileStack.push(stack);
    return stack;
  },

  replaceStack: function(callback) {
    var prefix = '',
        inline = this.isInline(),
        stack;

    // If we are currently inline then we want to merge the inline statement into the
    // replacement statement via ','
    if (inline) {
      var top = this.popStack(true);

      if (top instanceof Literal) {
        // Literals do not need to be inlined
        stack = top.value;
      } else {
        // Get or create the current stack name for use by the inline
        var name = this.stackSlot ? this.topStackName() : this.incrStack();

        prefix = '(' + this.push(name) + ' = ' + top + '),';
        stack = this.topStack();
      }
    } else {
      stack = this.topStack();
    }

    var item = callback.call(this, stack);

    if (inline) {
      if (this.inlineStack.length || this.compileStack.length) {
        this.popStack();
      }
      this.push('(' + prefix + item + ')');
    } else {
      // Prevent modification of the context depth variable. Through replaceStack
      if (!/^stack/.test(stack)) {
        stack = this.nextStack();
      }

      this.source.push(stack + " = (" + prefix + item + ");");
    }
    return stack;
  },

  nextStack: function() {
    return this.pushStack();
  },

  incrStack: function() {
    this.stackSlot++;
    if(this.stackSlot > this.stackVars.length) { this.stackVars.push("stack" + this.stackSlot); }
    return this.topStackName();
  },
  topStackName: function() {
    return "stack" + this.stackSlot;
  },
  flushInline: function() {
    var inlineStack = this.inlineStack;
    if (inlineStack.length) {
      this.inlineStack = [];
      for (var i = 0, len = inlineStack.length; i < len; i++) {
        var entry = inlineStack[i];
        if (entry instanceof Literal) {
          this.compileStack.push(entry);
        } else {
          this.pushStack(entry);
        }
      }
    }
  },
  isInline: function() {
    return this.inlineStack.length;
  },

  popStack: function(wrapped) {
    var inline = this.isInline(),
        item = (inline ? this.inlineStack : this.compileStack).pop();

    if (!wrapped && (item instanceof Literal)) {
      return item.value;
    } else {
      if (!inline) {
        this.stackSlot--;
      }
      return item;
    }
  },

  topStack: function(wrapped) {
    var stack = (this.isInline() ? this.inlineStack : this.compileStack),
        item = stack[stack.length - 1];

    if (!wrapped && (item instanceof Literal)) {
      return item.value;
    } else {
      return item;
    }
  },

  quotedString: function(str) {
    return '"' + str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028')   // Per Ecma-262 7.3 + 7.8.4
      .replace(/\u2029/g, '\\u2029') + '"';
  },

  setupHelper: function(paramSize, name, missingParams) {
    var params = [];
    this.setupParams(paramSize, params, missingParams);
    var foundHelper = this.nameLookup('helpers', name, 'helper');

    return {
      params: params,
      name: foundHelper,
      callParams: ["depth0"].concat(params).join(", "),
      helperMissingParams: missingParams && ["depth0", this.quotedString(name)].concat(params).join(", ")
    };
  },

  // the params and contexts arguments are passed in arrays
  // to fill in
  setupParams: function(paramSize, params, useRegister) {
    var options = [], contexts = [], types = [], param, inverse, program;

    options.push("hash:" + this.popStack());

    inverse = this.popStack();
    program = this.popStack();

    // Avoid setting fn and inverse if neither are set. This allows
    // helpers to do a check for `if (options.fn)`
    if (program || inverse) {
      if (!program) {
        this.context.aliases.self = "this";
        program = "self.noop";
      }

      if (!inverse) {
       this.context.aliases.self = "this";
        inverse = "self.noop";
      }

      options.push("inverse:" + inverse);
      options.push("fn:" + program);
    }

    for(var i=0; i<paramSize; i++) {
      param = this.popStack();
      params.push(param);

      if(this.options.stringParams) {
        types.push(this.popStack());
        contexts.push(this.popStack());
      }
    }

    if (this.options.stringParams) {
      options.push("contexts:[" + contexts.join(",") + "]");
      options.push("types:[" + types.join(",") + "]");
      options.push("hashContexts:hashContexts");
      options.push("hashTypes:hashTypes");
    }

    if(this.options.data) {
      options.push("data:data");
    }

    options = "{" + options.join(",") + "}";
    if (useRegister) {
      this.register('options', options);
      params.push('options');
    } else {
      params.push(options);
    }
    return params.join(", ");
  }
};

var reservedWords = (
  "break else new var" +
  " case finally return void" +
  " catch for switch while" +
  " continue function this with" +
  " default if throw" +
  " delete in try" +
  " do instanceof typeof" +
  " abstract enum int short" +
  " boolean export interface static" +
  " byte extends long super" +
  " char final native synchronized" +
  " class float package throws" +
  " const goto private transient" +
  " debugger implements protected volatile" +
  " double import public let yield"
).split(" ");

var compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};

for(var i=0, l=reservedWords.length; i<l; i++) {
  compilerWords[reservedWords[i]] = true;
}

JavaScriptCompiler.isValidJavaScriptVariableName = function(name) {
  if(!JavaScriptCompiler.RESERVED_WORDS[name] && /^[a-zA-Z_$][0-9a-zA-Z_$]+$/.test(name)) {
    return true;
  }
  return false;
};
;
// lib/handlebars/runtime.js

Handlebars.VM = {
  template: function(templateSpec) {
    // Just add water
    var container = {
      escapeExpression: Handlebars.Utils.escapeExpression,
      invokePartial: Handlebars.VM.invokePartial,
      programs: [],
      program: function(i, fn, data) {
        var programWrapper = this.programs[i];
        if(data) {
          programWrapper = Handlebars.VM.program(i, fn, data);
        } else if (!programWrapper) {
          programWrapper = this.programs[i] = Handlebars.VM.program(i, fn);
        }
        return programWrapper;
      },
      merge: function(param, common) {
        var ret = param || common;

        if (param && common) {
          ret = {};
          Handlebars.Utils.extend(ret, common);
          Handlebars.Utils.extend(ret, param);
        }
        return ret;
      },
      programWithDepth: Handlebars.VM.programWithDepth,
      noop: Handlebars.VM.noop,
      compilerInfo: null
    };

    return function(context, options) {
      options = options || {};
      var result = templateSpec.call(container, Handlebars, context, options.helpers, options.partials, options.data);

      var compilerInfo = container.compilerInfo || [],
          compilerRevision = compilerInfo[0] || 1,
          currentRevision = Handlebars.COMPILER_REVISION;

      if (compilerRevision !== currentRevision) {
        if (compilerRevision < currentRevision) {
          var runtimeVersions = Handlebars.REVISION_CHANGES[currentRevision],
              compilerVersions = Handlebars.REVISION_CHANGES[compilerRevision];
          throw "Template was precompiled with an older version of Handlebars than the current runtime. "+
                "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").";
        } else {
          // Use the embedded version info since the runtime doesn't know about this revision yet
          throw "Template was precompiled with a newer version of Handlebars than the current runtime. "+
                "Please update your runtime to a newer version ("+compilerInfo[1]+").";
        }
      }

      return result;
    };
  },

  programWithDepth: function(i, fn, data /*, $depth */) {
    var args = Array.prototype.slice.call(arguments, 3);

    var program = function(context, options) {
      options = options || {};

      return fn.apply(this, [context, options.data || data].concat(args));
    };
    program.program = i;
    program.depth = args.length;
    return program;
  },
  program: function(i, fn, data) {
    var program = function(context, options) {
      options = options || {};

      return fn(context, options.data || data);
    };
    program.program = i;
    program.depth = 0;
    return program;
  },
  noop: function() { return ""; },
  invokePartial: function(partial, name, context, helpers, partials, data) {
    var options = { helpers: helpers, partials: partials, data: data };

    if(partial === undefined) {
      throw new Handlebars.Exception("The partial " + name + " could not be found");
    } else if(partial instanceof Function) {
      return partial(context, options);
    } else if (!Handlebars.compile) {
      throw new Handlebars.Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
    } else {
      partials[name] = Handlebars.compile(partial, {data: data !== undefined});
      return partials[name](context, options);
    }
  }
};

Handlebars.template = Handlebars.VM.template;
;
// lib/handlebars/browser-suffix.js
  if (typeof module === 'object' && module.exports) {
    // CommonJS
    module.exports = Handlebars;

  } else if (typeof tvpapp.define === 'function' && tvpapp.define.amd) {
    // AMD modules
    tvpapp.define('handlebars',[],function() { return Handlebars; });

  } else {
    // other, i.e. browser
    this.Handlebars = Handlebars;
  }
}).call(this);
;
/*!
 * backbone.layoutmanager.js v0.8.7
 * Copyright 2013, Tim Branyen (@tbranyen)
 * backbone.layoutmanager.js may be freely distributed under the MIT license.
 */
(function(window) {

  

// Hoisted, referenced at the bottom of the source.  This caches a list of all
// LayoutManager options at definition time.
  var keys;

// Localize global dependency references.
  var Backbone = window.Backbone;
  var _ = window._;
  var $ = Backbone.$;

// Used for issuing warnings and debugging.
  var warn = window.console && window.console.warn;
  var trace = window.console && window.console.trace;

// Maintain references to the two `Backbone.View` functions that are
// overwritten so that they can be proxied.
  var _configure = Backbone.View.prototype._configure;
  var render = Backbone.View.prototype.render;

// Cache these methods for performance.
  var aPush = Array.prototype.push;
  var aConcat = Array.prototype.concat;
  var aSplice = Array.prototype.splice;

// LayoutManager is a wrapper around a `Backbone.View`.
  var LayoutManager = Backbone.View.extend({
      // This named function allows for significantly easier debugging.
      constructor: function Layout(options) {
        // Options may not always be passed to the constructor, this ensures it is
        // always an object.
        options = options || {};

        // Grant this View superpowers.
        LayoutManager.setupView(this, options);

        // Have Backbone set up the rest of this View.
        Backbone.View.call(this, options);
      },

      // Shorthand to `setView` function with the `insert` flag set.
      insertView: function(selector, view) {
        // If the `view` argument exists, then a selector was passed in.  This code
        // path will forward the selector on to `setView`.
        if (view) {
          return this.setView(selector, view, true);
        }

        // If no `view` argument is defined, then assume the first argument is the
        // View, somewhat now confusingly named `selector`.
        return this.setView(selector, true);
      },

      // Iterate over an object and ensure every value is wrapped in an array to
      // ensure they will be inserted, then pass that object to `setViews`.
      insertViews: function(views) {
        // If an array of views was passed it should be inserted into the
        // root view. Much like calling insertView without a selector.
        if (_.isArray(views)) {
          return this.setViews({ "": views });
        }

        _.each(views, function(view, selector) {
          views[selector] = _.isArray(view) ? view : [view];
        });

        return this.setViews(views);
      },

      // Returns the View that matches the `getViews` filter function.
      getView: function(fn) {
        // If `getView` is invoked with undefined as the first argument, then the
        // second argument will be used instead.  This is to allow
        // `getViews(undefined, fn)` to work as `getViews(fn)`.  Useful for when
        // you are allowing an optional selector.
        if (fn == null) {
          fn = arguments[1];
        }

        return this.getViews(fn).first().value();
      },

      // Provide a filter function to get a flattened array of all the subviews.
      // If the filter function is omitted it will return all subviews.  If a
      // String is passed instead, it will return the Views for that selector.
      getViews: function(fn) {
        var views;

        // If the filter argument is a String, then return a chained Version of the
        // elements. The value at the specified filter may be undefined, a single
        // view, or an array of views; in all cases, chain on a flat array.
        if (typeof fn === "string") {
          views = this.views[fn] || [];
          return _.chain([].concat(views));
        }

        // Generate an array of all top level (no deeply nested) Views flattened.
        views = _.chain(this.views).map(function(view) {
          return _.isArray(view) ? view : [view];
        }, this).flatten();

        // If the argument passed is an Object, then pass it to `_.where`.
        if (typeof fn === "object") {
          return views.where(fn);
        }

        // If a filter function is provided, run it on all Views and return a
        // wrapped chain. Otherwise, simply return a wrapped chain of all Views.
        return typeof fn === "function" ? views.filter(fn) : views;
      },

      // Use this to remove Views, internally uses `getViews` so you can pass the
      // same argument here as you would to that method.
      removeView: function(fn) {
        // Allow an optional selector or function to find the right model and
        // remove nested Views based off the results of the selector or filter.
        return this.getViews(fn).each(function(nestedView) {
          nestedView.remove();
        });
      },

      // This takes in a partial name and view instance and assigns them to
      // the internal collection of views.  If a view is not a LayoutManager
      // instance, then mix in the LayoutManager prototype.  This ensures
      // all Views can be used successfully.
      //
      // Must definitely wrap any render method passed in or defaults to a
      // typical render function `return layout(this).render()`.
      setView: function(name, view, insert) {
        var manager, existing, options;
        // Parent view, the one you are setting a View on.
        var root = this;

        // If no name was passed, use an empty string and shift all arguments.
        if (typeof name !== "string") {
          insert = view;
          view = name;
          name = "";
        }

        // If the parent views object doesn't exist... create it.
        this.views = this.views || {};

        // Shorthand the `__manager__` property.
        manager = view.__manager__;

        // Shorthand the View that potentially already exists.
        existing = this.views[name];

        // If the View has not been properly set up, throw an Error message
        // indicating that the View needs `manage: true` set.
        if (!manager) {
          throw new Error("Please set `View#manage` property with selector '" +
            name + "' to `true`.");
        }

        // Assign options.
        options = view.getAllOptions();

        // Add reference to the parentView.
        manager.parent = root;

        // Add reference to the placement selector used.
        manager.selector = name;

        // Set up event bubbling, inspired by Backbone.ViewMaster.  Do not bubble
        // internal events that are triggered.
        view.on("all", function(name) {
          if (name !== "beforeRender" && name !== "afterRender") {
            root.trigger.apply(root, arguments);
          }
        }, view);

        // Code path is less complex for Views that are not being inserted.  Simply
        // remove existing Views and bail out with the assignment.
        if (!insert) {
          // If the View we are adding has already been rendered, simply inject it
          // into the parent.
          if (manager.hasRendered) {
            // Apply the partial.
            options.partial(root.$el, view.$el, root.__manager__, manager);
          }

          // Ensure remove is called when swapping View's.
          if (existing) {
            // If the views are an array, iterate and remove each individually.
            _.each(aConcat.call([], existing), function(nestedView) {
              nestedView.remove();
            });
          }

          // Assign to main views object and return for chainability.
          return this.views[name] = view;
        }

        // Ensure this.views[name] is an array and push this View to the end.
        this.views[name] = aConcat.call([], existing || [], view);

        // Put the view into `insert` mode.
        manager.insert = true;

        return view;
      },

      // Allows the setting of multiple views instead of a single view.
      setViews: function(views) {
        // Iterate over all the views and use the View's view method to assign.
        _.each(views, function(view, name) {
          // If the view is an array put all views into insert mode.
          if (_.isArray(view)) {
            return _.each(view, function(view) {
              this.insertView(name, view);
            }, this);
          }

          // Assign each view using the view function.
          this.setView(name, view);
        }, this);

        // Allow for chaining
        return this;
      },

      // By default this should find all nested views and render them into
      // the this.el and call done once all of them have successfully been
      // resolved.
      //
      // This function returns a promise that can be chained to determine
      // once all subviews and main view have been rendered into the view.el.
      render: function() {
        var root = this;
        var options = root.getAllOptions();
        var manager = root.__manager__;
        var parent = manager.parent;
        var rentManager = parent && parent.__manager__;
        var def = options.deferred();

        // Triggered once the render has succeeded.
        function resolve() {
          var next, afterRender;

          // If there is a parent, attach.
          if (parent) {
            if (!options.contains(parent.el, root.el)) {
              // Apply the partial.
              options.partial(parent.$el, root.$el, rentManager, manager);
            }
          }

          // Ensure events are always correctly bound after rendering.
          root.delegateEvents();

          // Set this View as successfully rendered.
          manager.hasRendered = true;

          // Only process the queue if it exists.
          if (next = manager.queue.shift()) {
            // Ensure that the next render is only called after all other
            // `done` handlers have completed.  This will prevent `render`
            // callbacks from firing out of order.
            next();
          } else {
            // Once the queue is depleted, remove it, the render process has
            // completed.
            delete manager.queue;
          }

          // Reusable function for triggering the afterRender callback and event
          // and setting the hasRendered flag.
          function completeRender() {
            var afterRender = options.afterRender;

            if (afterRender) {
              afterRender.call(root, root);
            }

            // Always emit an afterRender event.
            root.trigger("afterRender", root);

            // If there are multiple top level elements and `el: false` is used,
            // display a warning message and a stack trace.
            if (manager.noel && root.$el.length > 1) {
              // Do not display a warning while testing or if warning suppression
              // is enabled.
              if (warn && !options.suppressWarnings) {
                window.console.warn("Using `el: false` with multiple top level " +
                  "elements is not supported.");

                // Provide a stack trace if available to aid with debugging.
                if (trace) { window.console.trace(); }
              }
            }
          }

          // If the parent is currently rendering, wait until it has completed
          // until calling the nested View's `afterRender`.
          if (rentManager && rentManager.queue) {
            // Wait until the parent View has finished rendering, which could be
            // asynchronous, and trigger afterRender on this View once it has
            // compeleted.
            parent.once("afterRender", completeRender);
          } else {
            // This View and its parent have both rendered.
            completeRender();
          }

          return def.resolveWith(root, [root]);
        }

        // Actually facilitate a render.
        function actuallyRender() {
          var options = root.getAllOptions();
          var manager = root.__manager__;
          var parent = manager.parent;
          var rentManager = parent && parent.__manager__;

          // The `_viewRender` method is broken out to abstract away from having
          // too much code in `actuallyRender`.
          root._render(LayoutManager._viewRender, options).done(function() {
            // If there are no children to worry about, complete the render
            // instantly.
            if (!_.keys(root.views).length) {
              return resolve();
            }

            // Create a list of promises to wait on until rendering is done.
            // Since this method will run on all children as well, its sufficient
            // for a full hierarchical.
            var promises = _.map(root.views, function(view) {
              var insert = _.isArray(view);

              // If items are being inserted, they will be in a non-zero length
              // Array.
              if (insert && view.length) {
                // Schedule each view to be rendered in order and return a promise
                // representing the result of the final rendering.
                return _.reduce(view.slice(1), function(prevRender, view) {
                  return prevRender.then(function() {
                    return view.render();
                  });
                  // The first view should be rendered immediately, and the resulting
                  // promise used to initialize the reduction.
                }, view[0].render());
              }

              // Only return the fetch deferred, resolve the main deferred after
              // the element has been attached to it's parent.
              return !insert ? view.render() : view;
            });

            // Once all nested Views have been rendered, resolve this View's
            // deferred.
            options.when(promises).done(resolve);
          });
        }

        // Another render is currently happening if there is an existing queue, so
        // push a closure to render later into the queue.
        if (manager.queue) {
          aPush.call(manager.queue, actuallyRender);
        } else {
          manager.queue = [];

          // This the first `render`, preceeding the `queue` so render
          // immediately.
          actuallyRender(root, def);
        }

        // Add the View to the deferred so that `view.render().view.el` is
        // possible.
        def.view = root;

        // This is the promise that determines if the `render` function has
        // completed or not.
        return def;
      },

      // Ensure the cleanup function is called whenever remove is called.
      remove: function() {
        // Force remove itself from its parent.
        LayoutManager._removeView(this, true);

        // Call the original remove function.
        return this._remove.apply(this, arguments);
      },

      // Merge instance and global options.
      getAllOptions: function() {
        // Instance overrides take precedence, fallback to prototype options.
        return _.extend({}, this, LayoutManager.prototype.options, this.options);
      }
    },
    {
      // Clearable cache.
      _cache: {},

      // Creates a deferred and returns a function to call when finished.
      _makeAsync: function(options, done) {
        var handler = options.deferred();

        // Used to handle asynchronous renders.
        handler.async = function() {
          handler._isAsync = true;

          return done;
        };

        return handler;
      },

      // This gets passed to all _render methods.  The `root` value here is passed
      // from the `manage(this).render()` line in the `_render` function
      _viewRender: function(root, options) {
        var url, contents, fetchAsync, renderedEl;
        var manager = root.__manager__;

        // This function is responsible for pairing the rendered template into
        // the DOM element.
        function applyTemplate(rendered) {
          // Actually put the rendered contents into the element.
          if (rendered) {
            // If no container is specified, we must replace the content.
            if (manager.noel) {
              // Trim off the whitespace, since the contents are passed into `$()`.
              rendered = $.trim(rendered);

              // Hold a reference to created element as replaceWith doesn't return
              // new el.
              renderedEl = $(rendered);

              // Remove extra root elements.
              root.$el.slice(1).remove();

              // Swap out the View on the first top level element to avoid
              // duplication.
              root.$el.replaceWith(renderedEl);

              // Don't delegate events here - we'll do that in resolve()
              root.setElement(renderedEl, false);
            } else {
              options.html(root.$el, rendered);
            }
          }

          // Resolve only after fetch and render have succeeded.
          fetchAsync.resolveWith(root, [root]);
        }

        // Once the template is successfully fetched, use its contents to proceed.
        // Context argument is first, since it is bound for partial application
        // reasons.
        function done(context, contents) {
          // Store the rendered template someplace so it can be re-assignable.
          var rendered;
          // This allows the `render` method to be asynchronous as well as `fetch`.
          var renderAsync = LayoutManager._makeAsync(options, function(rendered) {
            applyTemplate(rendered);
          });

          // Ensure the cache is up-to-date.
          LayoutManager.cache(url, contents);

          // Render the View into the el property.
          if (contents) {
            rendered = options.render.call(renderAsync, contents, context);
          }

          // If the function was synchronous, continue execution.
          if (!renderAsync._isAsync) {
            applyTemplate(rendered);
          }
        }

        return {
          // This `render` function is what gets called inside of the View render,
          // when `manage(this).render` is called.  Returns a promise that can be
          // used to know when the element has been rendered into its parent.
          render: function() {
            var context = root.serialize || options.serialize;
            var template = root.template || options.template;

            // If data is a function, immediately call it.
            if (_.isFunction(context)) {
              context = context.call(root);
            }

            // This allows for `var done = this.async()` and then `done(contents)`.
            fetchAsync = LayoutManager._makeAsync(options, function(contents) {
              done(context, contents);
            });

            // Set the url to the prefix + the view's template property.
            if (typeof template === "string") {
              url = options.prefix + template;
            }

            // Check if contents are already cached and if they are, simply process
            // the template with the correct data.
            if (contents = LayoutManager.cache(url)) {
              done(context, contents, url);

              return fetchAsync;
            }

            // Fetch layout and template contents.
            if (typeof template === "string") {
              contents = options.fetch.call(fetchAsync, options.prefix + template);
              // If the template is already a function, simply call it.
            } else if (typeof template === "function") {
              contents = template;
              // If its not a string and not undefined, pass the value to `fetch`.
            } else if (template != null) {
              contents = options.fetch.call(fetchAsync, template);
            }

            // If the function was synchronous, continue execution.
            if (!fetchAsync._isAsync) {
              done(context, contents);
            }

            return fetchAsync;
          }
        };
      },

      // Remove all nested Views.
      _removeViews: function(root, force) {
        var views;

        // Shift arguments around.
        if (typeof root === "boolean") {
          force = root;
          root = this;
        }

        // Allow removeView to be called on instances.
        root = root || this;

        // Iterate over all of the nested View's and remove.
        root.getViews().each(function(view) {
          // Force doesn't care about if a View has rendered or not.
          if (view.__manager__.hasRendered || force) {
            LayoutManager._removeView(view, force);
          }
        });
      },

      // Remove a single nested View.
      _removeView: function(view, force) {
        var parentViews;
        // Shorthand the manager for easier access.
        var manager = view.__manager__;
        // Test for keep.
        var keep = typeof view.keep === "boolean" ? view.keep : view.options.keep;

        // Only remove views that do not have `keep` attribute set, unless the
        // View is in `insert` mode and the force flag is set.
        if ((!keep && manager.insert === true) || force) {
          // Clean out the events.
          LayoutManager.cleanViews(view);

          // Since we are removing this view, force subviews to remove
          view._removeViews(true);

          // Remove the View completely.
          view.$el.remove();

          // Bail out early if no parent exists.
          if (!manager.parent) { return; }

          // Assign (if they exist) the sibling Views to a property.
          parentViews = manager.parent.views[manager.selector];

          // If this is an array of items remove items that are not marked to
          // keep.
          if (_.isArray(parentViews)) {
            // Remove duplicate Views.
            return _.each(_.clone(parentViews), function(view, i) {
              // If the managers match, splice off this View.
              if (view && view.__manager__ === manager) {
                aSplice.call(parentViews, i, 1);
              }
            });
          }

          // Otherwise delete the parent selector.
          delete manager.parent.views[manager.selector];
        }
      },

      // Cache templates into LayoutManager._cache.
      cache: function(path, contents) {
        // If template path is found in the cache, return the contents.
        if (path in this._cache && contents == null) {
          return this._cache[path];
          // Ensure path and contents aren't undefined.
        } else if (path != null && contents != null) {
          return this._cache[path] = contents;
        }

        // If the template is not in the cache, return undefined.
      },

      // Accept either a single view or an array of views to clean of all DOM
      // events internal model and collection references and all Backbone.Events.
      cleanViews: function(views) {
        // Clear out all existing views.
        _.each(aConcat.call([], views), function(view) {
          var cleanup;

          // Remove all custom events attached to this View.
          view.unbind();

          // Automatically unbind `model`.
          if (view.model instanceof Backbone.Model) {
            view.model.off(null, null, view);
          }

          // Automatically unbind `collection`.
          if (view.collection instanceof Backbone.Collection) {
            view.collection.off(null, null, view);
          }

          // Automatically unbind events bound to this View.
          view.stopListening();

          // If a custom cleanup method was provided on the view, call it after
          // the initial cleanup is done
          cleanup = view.getAllOptions().cleanup;
          if (_.isFunction(cleanup)) {
            cleanup.call(view);
          }
        });
      },

      // This static method allows for global configuration of LayoutManager.
      configure: function(options) {
        _.extend(LayoutManager.prototype.options, options);

        // Allow LayoutManager to manage Backbone.View.prototype.
        if (options.manage) {
          Backbone.View.prototype.manage = true;
        }

        // Disable the element globally.
        if (options.el === false) {
          Backbone.View.prototype.el = false;
        }

        // Allow global configuration of `suppressWarnings`.
        if (options.suppressWarnings === true) {
          Backbone.View.prototype.suppressWarnings = true;
        }
      },

      // Configure a View to work with the LayoutManager plugin.
      setupView: function(views, options) {
        // Set up all Views passed.
        _.each(aConcat.call([], views), function(view) {
          // If the View has already been setup, no need to do it again.
          if (view.__manager__) {
            return;
          }

          var views, declaredViews, viewOptions;
          var proto = LayoutManager.prototype;
          var viewOverrides = _.pick(view, keys);

          // Ensure necessary properties are set.
          _.defaults(view, {
            // Ensure a view always has a views object.
            views: {},

            // Internal state object used to store whether or not a View has been
            // taken over by layout manager and if it has been rendered into the DOM.
            __manager__: {},

            // Add the ability to remove all Views.
            _removeViews: LayoutManager._removeViews,

            // Add the ability to remove itself.
            _removeView: LayoutManager._removeView

            // Mix in all LayoutManager prototype properties as well.
          }, LayoutManager.prototype);

          // Extend the options with the prototype and passed options.
          options = view.options = _.defaults(options || {}, view.options,
            proto.options);

          // Ensure view events are properly copied over.
          viewOptions = _.pick(options, aConcat.call(["events"],
            _.values(options.events)));

          // Merge the View options into the View.
          _.extend(view, viewOptions);

          // If the View still has the Backbone.View#render method, remove it.
          // Don't want it accidentally overriding the LM render.
          if (viewOverrides.render === LayoutManager.prototype.render ||
            viewOverrides.render === Backbone.View.prototype.render) {
            delete viewOverrides.render;
          }

          // Pick out the specific properties that can be dynamically added at
          // runtime and ensure they are available on the view object.
          _.extend(options, viewOverrides);

          // By default the original Remove function is the Backbone.View one.
          view._remove = Backbone.View.prototype.remove;

          // Always use this render function when using LayoutManager.
          view._render = function(manage, options) {
            // Keep the view consistent between callbacks and deferreds.
            var view = this;
            // Shorthand the manager.
            var manager = view.__manager__;
            // Cache these properties.
            var beforeRender = options.beforeRender;

            // Ensure all nested Views are properly scrubbed if re-rendering.
            if (manager.hasRendered) {
              this._removeViews();
            }

            // If a beforeRender function is defined, call it.
            if (beforeRender) {
              beforeRender.call(this, this);
            }

            // Always emit a beforeRender event.
            this.trigger("beforeRender", this);

            // Render!
            return manage(this, options).render();
          };

          // Ensure the render is always set correctly.
          view.render = LayoutManager.prototype.render;

          // If the user provided their own remove override, use that instead of
          // the default.
          if (view.remove !== proto.remove) {
            view._remove = view.remove;
            view.remove = proto.remove;
          }

          // Normalize views to exist on either instance or options, default to
          // options.
          views = options.views || view.views;

          // Set the internal views, only if selectors have been provided.
          if (_.keys(views).length) {
            // Keep original object declared containing Views.
            declaredViews = views;

            // Reset the property to avoid duplication or overwritting.
            view.views = {};

            // Set the declared Views.
            view.setViews(declaredViews);
          }

          // If a template is passed use that instead.
          if (view.options.template) {
            view.options.template = options.template;
            // Ensure the template is mapped over.
          } else if (view.template) {
            options.template = view.template;
          }
        });
      }
    });

// Convenience assignment to make creating Layout's slightly shorter.
  Backbone.Layout = LayoutManager;
// Tack on the version.
  LayoutManager.VERSION = "0.8.7";

// Override _configure to provide extra functionality that is necessary in
// order for the render function reference to be bound during initialize.
  Backbone.View.prototype._configure = function(options) {
    var noel, retVal;

    // Remove the container element provided by Backbone.
    if ("el" in options ? options.el === false : this.el === false) {
      noel = true;
    }

    // Run the original _configure.
    retVal = _configure.apply(this, arguments);

    // If manage is set, do it!
    if (options.manage || this.manage) {
      // Set up this View.
      LayoutManager.setupView(this);
    }

    // Assign the `noel` property once we're sure the View we're working with is
    // managed by LayoutManager.
    if (this.__manager__) {
      this.__manager__.noel = noel;
      this.__manager__.suppressWarnings = options.suppressWarnings;
    }

    // Act like nothing happened.
    return retVal;
  };

// Default configuration options; designed to be overriden.
  LayoutManager.prototype.options = {
    // Prefix template/layout paths.
    prefix: "",

    // Can be used to supply a different deferred implementation.
    deferred: function() {
      return $.Deferred();
    },

    // Fetch is passed a path and is expected to return template contents as a
    // function or string.
    fetch: function(path) {
      return _.template($(path).html());
    },

    // This is the most common way you will want to partially apply a view into
    // a layout.
    partial: function($root, $el, rentManager, manager) {
      // If selector is specified, attempt to find it.
      if (manager.selector) {
        if (rentManager.noel) {
          var $filtered = $root.filter(manager.selector);
          $root = $filtered.length ? $filtered : $root.find(manager.selector);
        } else {
          $root = $root.find(manager.selector);
        }
      }

      // Use the insert method if insert argument is true.
      if (manager.insert) {
        this.insert($root, $el);
      } else {
        this.html($root, $el);
      }
    },

    // Override this with a custom HTML method, passed a root element and content
    // (a jQuery collection or a string) to replace the innerHTML with.
    html: function($root, content) {
      $root.html(content);
    },

    // Very similar to HTML except this one will appendChild by default.
    insert: function($root, $el) {
      $root.append($el);
    },

    // Return a deferred for when all promises resolve/reject.
    when: function(promises) {
      return $.when.apply(null, promises);
    },

    // By default, render using underscore's templating.
    render: function(template, context) {
      return template(context);
    },

    // A method to determine if a View contains another.
    contains: function(parent, child) {
      return $.contains(parent, child);
    }
  };

// Maintain a list of the keys at define time.
  keys = _.keys(LayoutManager.prototype.options);

})(typeof global === "object" ? global : this);
tvpapp.define("layoutmanager", ["backbone"], (function (global) {
    return function () {
        var ret, fn;
        return ret || global.Backbone.LayoutManager;
    };
}(this)));

tvpapp.define('namespace',[
  "jquery",
  "underscore",
  "backbone",
  "handlebars",
  //"templates",
  "layoutmanager"
], function($, _, Backbone, Handlebars) {

  // Provide a global location to place configuration settings and module
  // creation.
  var app = {
    // The root path to run the application.
    root: "/",
    data: {},
    modules: {},
    layouts: {}
  };

  // Configure LayoutManager with Backbone Boilerplate defaults.
  Backbone.Layout.configure({
    // Allow LayoutManager to augment Backbone.View.prototype.
    manage: true,

    prefix: "app/templates/",

    fetch: function(path) {
      var done;

      var JST = window.JST || [];

      // Add the html extension.
      path = path + ".html";
      // If the template has not been loaded yet, then load.
      if (!JST[path]) {
        done = this.async();
        return $.ajax({ url: app.root + path}).then(function(contents) {
          JST[path] = Handlebars.compile(contents);
          JST[path].__compiled__ = true;

          done(JST[path]);
        });
      }

      return JST[path];
    }
  });

  _.extend(Backbone.View.prototype, {
    serialize: function() {
      if (this.model) return this.model.toJSON();
    }
  });

  // Mix Backbone.Events, modules, and layout management into the app object.
  return _.extend(app, {
    // Create a custom object with a nested Views object.
    module: function(additionalProps) {
      return _.extend({ Views: {} }, additionalProps);
    },

    // Helper for using layouts.
    useLayout: function(name, options) {
      // Enable variable arity by allowing the first argument to be the options
      // object and omitting the name argument.
      if (_.isObject(name)) {
        options = name;
      }

      // Ensure options is an object.
      options = options || {};

      // If a name property was specified use that as the template.
      if (_.isString(name)) {
        options.template = name;
      }

      // Create a new Layout with options.
      var layout = new Backbone.Layout(_.extend({
        el: "#"+name
      }, options));

      // Cache the refererence.
      this.layouts[name] = layout

      return layout;
    },

    /*createLayout: function(name, options) {
      options = options || {};

      if (typeof options != "object") {
        throw Error("Layout requires an options object");
      }

      if (_.isObject(name)) {
        options = name;
      }

      // If a name property was specified use that as the template.
      if (_.isString(name)) {
        options.template = name;
      }

      var layout = new Backbone.Layout(_.extend({
        el: "#tvpage_spots"
      }, options));

      // Create a new Layout with options.
      return this.layouts[options.name] = layout;
    },*/

    getDomain: function() {
      switch (document.location.host) {
        case "fullpage-local.wp.tvpage.com":
          return "www.tvpage.com";
        default:
          return "www.tvpage.com";
      }
    },

    getProtocol: function() {
      return document.location.protocol;
    }
  }, Backbone.Events);

});

tvpapp.define('modules/tvp/tvpmodule',[
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

tvpapp.define('modules/tvp/tvpmodel',[
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

tvpapp.define('modules/tvp/tvpcollection',[
	"jquery",
	"namespace",
	"backbone"
],

	function($, tvpage, Backbone) {

		/**
		 * TVPCollection class
		 * This is the TVPCollection class: base class of most views
		 *
		 * @name TVPCollection
		 * @class TVPCollection
		 * @constructor
		 * @return TVPCollection Object
		 */
		var TVPCollection = Backbone.Collection.extend({
      constructor: function (models, options) {
        this.key = -1;
        //this.filter = null;
        this.app = tvpage;
        if(typeof options != 'object'){
          options = {};
        }

        this.options = options;
        Backbone.Collection.call(this, models, options);
      },

      getKey: function(key, options){
        // implement in child
        return false;
      },

      setFilter: function(filter){
        this.filter = filter;
      },

      getFilter: function(){
        return this.filter;
      }
		});

		return TVPCollection;
	});

tvpapp.define('modules/TVPData/data/TVPageModel',[
  "jquery",
  "modules/tvp/tvpmodel"
],
function($, TVPModel) {

  var TVPageModel = TVPModel.extend({
    parse: function(data) {
      if (data.settings && typeof data.settings == "string") {
        data.settings = $.parseJSON(data.settings);
      }

      return data;
    }
  });

  return TVPageModel;
});

tvpapp.define('modules/TVPData/data/GuideCollection',[
  "modules/tvp/tvpcollection",
  "modules/TVPData/data/TVPageModel"
],
function(TVPCollection, TVPageModel) {

  var GuideCollection = TVPCollection.extend({
    url: function() {
      return 'https://'+this.app.getDomain()+'/api/guide/'+this.key;
    },

    model: TVPageModel,

    comparator:function(itm){
      //console.log('comparator', itm);
      return Number(itm.get('sortOrder'));
    },

    getKey: function(key, options) {
      return key;
    },

    fetch: function(key, options){
      var collectionKey = this.getKey(key, options);

      if (typeof collectionKey == "undefined") {
        collectionKey = false;
      }

      if (collectionKey != this.key){
        if (collectionKey !== false) {
          this.key = collectionKey;
        }
        return Backbone.Collection.prototype.fetch.call(this, options);
      } else {
        // This is a dummy to be backbone compliant and always return a deferred XHR response.
        var def = $.Deferred();
        def.resolve();
        return def.promise();
      }
    },

    /*filter: function(model) {
      return model.get('parentId') == this.key;
    },*/

    initialize: function() {
      //console.log(this);
      /*if (this.key == -1) {
        this.key = this.getKey(this.app.data.vars.get('tvpageId'));
      }*/
    }
  });

  return GuideCollection;
});

tvpapp.define('modules/TVPData/data/SpotModel',[
  "jquery",
  "modules/tvp/tvpmodel"
],
function($, TVPModel) {

  var SpotModel = TVPModel.extend({
    parse: function(data) {
      if (data.data && typeof data.data == "string") {
        data.data = $.parseJSON(data.data);
      }

      return data;
    }
  });

  return SpotModel;
});

tvpapp.define('modules/TVPData/data/SpotCollection',[
  "modules/tvp/tvpcollection",
  "modules/TVPData/data/SpotModel"
],
  function(TVPCollection, SpotModel) {

    var SpotCollection = TVPCollection.extend({
      url: function() {
        return 'https://'+this.app.getDomain()+'/api/spot/link/container/'+this.options.videoId;
      },

      model: SpotModel,

      setVideoId: function(videoId) {
        this.options.videoId = videoId;
      },

      clearVideoId: function() {
        this.options.videoId = null;
        this.reset();
      },

      initialize: function() {

      }
    });

    return SpotCollection;
  });

tvpapp.define('modules/TVPData/data/VideoModel',[
  "jquery",
  "modules/tvp/tvpmodel"
],
function($, TVPModel) {

  var TVPageModel = TVPModel.extend({
    parse: function(data) {
      if (data.settings && typeof data.settings == "string") {
        data.settings = $.parseJSON(data.settings);
      }

      return data;
    },

    initialize: function() {
      this.on('change', function(a, b) {
        // this creates a cached copy of the poster image when the data becomes available.
        $('<img/>')[0].src = this.get('assetDetails').thumbnailUrl;
      }, this);
    }
  });

  return TVPageModel;
});

tvpapp.define('modules/TVPData/tvpdata',[
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
* */;
tvpapp.define('modules/tvp/tvpview',[
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

tvpapp.define('modules/Canvas/views/CanvasImage',[
  "jquery",
  "modules/tvp/tvpview"
],
function($, TVPView) {
  /**
   * CanvasImage class
   * This is the CanvasImage class
   *
   * @name CanvasImage
   * @class CanvasImage
   * @constructor
   * @return CanvasImage Object
   */

  var CanvasImage = TVPView.extend({
    template: "Canvas/CanvasImage",
    className: "background-image CanvasImage",

    beforeRender: function() {
      this.$el.css({
        'backgroundImage': 'url('+ this._createBackgroundImageUrl() +')'
      });
    },

    _createBackgroundImageUrl: function() {
      return this.app.getProtocol()+'//'+this.app.getDomain()+'/api/canvasImage/'+this.data.tvpageModel.get('loginId')+'/950/214/'+this._getCanvasImage();
      //return 'https://www.tvpage.com/api/canvasImage/147/1920/1080/166448316-010520481261.jpg'
    },

    _getCanvasImage: function() {
      if (_.has(this.data.tvpageModel.get('settings'), "canvasCropped")) {
        return this.data.tvpageModel.get('settings').canvasCropped;
      } else {
        return this.data.tvpageModel.get('settings').canvasImage;
      }
    }
  });

  return CanvasImage;
});
tvpapp.define('modules/Canvas/CanvasModule',[
  "namespace",
  "jquery",
  "backbone",
  "modules/tvp/tvpmodule",

  "modules/Canvas/views/CanvasImage"
],

function(tvpage, $, Backbone, TVPModule,
  CanvasImage
  ) {

  function CanvasModule() {
    this.views = {};
    this.data = {};

    this.initialize();

    TVPModule.apply(this, arguments);
  }
  CanvasModule.prototype = new TVPModule();
  CanvasModule.prototype.constructor = CanvasModule;

  CanvasModule.prototype.initialize = function() {
    _.extend(this.data, {
      tvpageModel: this.app.data.tvpageModel
    });

    _.extend(this.views, {
      canvasImage: CanvasImage
    });
  };

  CanvasModule.prototype.view = function() {
    return new this.views.canvasImage({
      data: {
        tvpageModel: this.data.tvpageModel
      }
    });
  };

  return CanvasModule;
});
tvpapp.define('modules/helpers/ChannelThumbnail',[
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
tvpapp.define('modules/Content/views/ContentItemChannel',[
  "jquery",
  "modules/tvp/tvpview",
  "modules/helpers/ChannelThumbnail"
],
  function($, TVPView, ChannelThumbnail) {
    /**
     * ContentItemChannel class
     * This is the ContentItemChannel class
     *
     * @name ContentItemChannel
     * @class ContentItemChannel
     * @constructor
     * @return ContentItemChannel Object
     */

    var ContentItemChannel = TVPView.extend({
      className: "fade",
      tagName: 'li',

      beforeRender: function() {
        this.$el.addClass('channel-'+this.options.listStyle+'-item');
      },

      afterRender: function() {
        ChannelThumbnail.create(this.model);

        this.$el.find('.list-item-media').html(ChannelThumbnail.el);
      },

      events: {
        "click .ChannelOverlay": "handleClick"
      },

      handleClick: function(e) {
        e.preventDefault();
        e.stopPropagation();

        var THAT = this;

        var channelKey = Number(this.$el.find('.ChannelOverlay').data('key'));

        if (typeof channelKey !== "number") {
          throw new Error('Channel ID must be a number');
        }

        this.app.data.guideCollection.key = channelKey;

        var data = _.filter(this.app.data.guideCollection.models,function(itm){
          return itm.get('parentId') == THAT.app.data.guideCollection.key;
        });

        console.log(data.length, data);


        this.app.data.guideCollectionFiltered.reset(data);
      },

      initialize: function() {
        if (!this.options.listStyle) {
          throw Error("listStyle must be provided");
        }

        this._setItemStyle();
      },

      _setItemStyle: function() {
        switch (this.options.listStyle) {
          case "list":
            this.template = "Content/ContentListItemChannel";
            break;
          case "grid":
            this.template = "Content/ContentGridItemChannel";
            break;
        }
      }
    });

    return ContentItemChannel;
  });
tvpapp.define('modules/Content/views/ContentItemVideo',[
  "jquery",
  "modules/tvp/tvpview"
],
  function($, TVPView) {
    /**
     * ContentItemVideo class
     * This is the ContentItemVideo class
     *
     * @name ContentItemVideo
     * @class ContentItemVideo
     * @constructor
     * @return ContentItemVideo Object
     */

    var ContentItemVideo = TVPView.extend({
      //template: "Content/ContentItemVideo",
      className: "background-image ContentItemVideo fade",
      tagName: 'li',

      beforeRender: function() {
        this.$el.addClass('video-'+this.options.listStyle+'-item');
      },

      events: {
        "click": "handleVideoPlay",
        "mouseenter": "handleOver",
        "mouseleave": "handleOut"
      },

      handleVideoPlay: function(e) {
        e.preventDefault();
        e.stopPropagation();

        if (this.model.get('id') == this.app.data.vars.get('videoId')) {
          this.app.data.vars.trigger('change:videoId');
        } else {
          this.app.data.vars.set({ videoId: this.model.get('id') });
        }
      },

      initialize: function() {
        if (!this.options.listStyle) {
          throw Error("listStyle must be provided");
        }

        this._setItemStyle();
      },

      _setItemStyle: function() {
        switch (this.options.listStyle) {
          case "list":
            this.template = "Content/ContentListItemVideo";
            break;
          case "grid":
            this.template = "Content/ContentGridItemVideo";
            break;
        }
      },

      handleOver: function() {
        this.$el.addClass('active');
      },

      handleOut: function() {
        this.$el.removeClass('active');
      }
    });

    return ContentItemVideo;
  });
tvpapp.define('modules/Content/views/ContentItemBack',[
  "jquery",
  "modules/tvp/tvpview"
],
  function($, TVPView) {
    /**
     * ContentItemBack class
     * This is the ContentItemBack class
     *
     * @name ContentItemBack
     * @class ContentItemBack
     * @constructor
     * @return ContentItemBack Object
     */

    var ContentItemBack = TVPView.extend({
      template: "Content/ContentItemBack",
      className: "grid-item ContentItemBack",
      tagName: 'li',

      events: {
        "click .BackOverlay": "handleClick"
      },

      handleClick: function(e) {
        e.preventDefault();
        e.stopPropagation();

        var THAT = this;

        this.app.data.guideCollection.key = this.app.data.vars.get('tvpageId');

        var data = _.filter(this.app.data.guideCollection.models,function(itm){
          return itm.get('parentId') == THAT.app.data.guideCollection.key;
        });

        this.app.data.guideCollectionFiltered.reset(data);
      }
    });

    return ContentItemBack;
  });
tvpapp.define('modules/Content/views/ContentList',[
  "jquery",
  "modules/tvp/tvpview",

  "modules/Content/views/ContentItemChannel",
  "modules/Content/views/ContentItemVideo",
  "modules/Content/views/ContentItemBack"
],
  function($, TVPView, ContentItemChannel, ContentItemVideo, ContentItemBack) {
    /**
     * ContentList class
     * This is the ContentList class
     *
     * @name ContentList
     * @class ContentList
     * @constructor
     * @return ContentList Object
     */

    var ContentList = TVPView.extend({
      //template: "Content/ContentList",
      className: "ContentList",

      beforeRender: function() {

        // Add back link, tvpage is not the guideCollection Filter
        if (this.app.data.guideCollection.key != this.app.data.vars.get('tvpageId')) {
          this.insertView('.grid', new ContentItemBack());
        }

        this.data.guideCollectionFiltered.each(function(item) {
          var typeId = item.get('typeId');
          switch (typeId) {
            case "1":
              this.insertView('.'+this.options.listStyle, new ContentItemVideo({ model: item, listStyle: this.options.listStyle }));
              break;
            case "2":
              this.insertView('.'+this.options.listStyle, new ContentItemChannel({ model: item, listStyle: this.options.listStyle }));
              break;
            case "3":
              // do nothing, its just a tvpage
              break;
            default:
              //throw new Error('Improper typeId supplied');
          }
        }, this);

      },

      afterRender: function() {
        // run the animation
        var THAT = this;
        var counter = 0;
        var timer = setInterval(function() {
          THAT.$el.find('li').eq(counter).addClass('fadeIn');
          counter++;
        }, 100);
      },

      initialize: function() {
        this._setListStyle();

        this.data.guideCollectionFiltered.on('reset', function() {
          this.remove();
          this.render();
        }, this);
      },

      _setListStyle: function() {
        if (_.has(this.options, "listStyle")) {
          switch (this.options.listStyle) {
            case "grid":
              this.$el.html('<ul class="grid"></ul>');
              break;
            case "list":
              this.$el.html('<ul class="list"></ul>');
          }
        } else {
          throw Error("You must supply a listStyle");
        }
      }
    });

    return ContentList;
  });
tvpapp.define('modules/Content/ContentModule',[
  "namespace",
  "jquery",
  "backbone",
  "modules/tvp/tvpmodule",

  "modules/Content/views/ContentList"
],

function(tvpage, $, Backbone, TVPModule,
  ContentList
  ) {

  function ContentModule() {
    this.views = {};
    this.data = {};

    this.initialize();

    TVPModule.apply(this, arguments);
  }
  ContentModule.prototype = new TVPModule();
  ContentModule.prototype.constructor = ContentModule;

  ContentModule.prototype.initialize = function() {
    _.extend(this.data, {
      guideCollectionFiltered: this.app.data.guideCollectionFiltered
    });

    _.extend(this.views, {
      contentList: ContentList
    });
  };

  ContentModule.prototype.view = function() {
    return new this.views.contentList({
      data: {
        guideCollectionFiltered: this.data.guideCollectionFiltered
      },
      listStyle: "list"
    });
  };

  return ContentModule;
});
tvpapp.define('modules/Player/views/YoutubePlayer',[
  "jquery",
  "modules/tvp/tvpview"
],
function($, TVPView) {
  /**
   * YoutubePlayer class
   * This is the Player class
   *
   * @name YoutubePlayer
   * @class YoutubePlayer
   * @constructor
   * @return YoutubePlayer Object
   */

  var YoutubePlayer = TVPView.extend({
    template: "Player/YoutubePlayer",
    className: "YoutubePlayer",

    afterRender: function() {
      //console.log('Load Player');
      var THAT = this;
      window.onYouTubeIframeAPIReady = function() {
        var player = new YT.Player('YTPlayer', {
          height: '100%',
          width: '100%',
          enablejsapi: 1,
          showinfo: 0,
          iv_load_policy: 3,
          rel: 0,
          wmode: 'transparent',
          controls: 0,
          videoId: '',
          events: {
            'onStateChange': function(e) {
              //t.dispatchEvent(e);
              //console.log('onStateChange', e);
            },
            'onReady': function(e) {
              THAT.player = player;
              //console.log('onReady', e);
            },
            'onError':function(e) {
              // nothing yet...
              //console.log('onError', e);
            }
          }
        });
      };

      $('head').append('<script type="text/javascript" src="http://www.youtube.com/iframe_api"></script>');
    },

    initialize: function() {
      this.model.on('change:videoId', function() {
        var video = this.app.data.guideCollection.get(this.model.get('videoId'));
        this.player.loadVideoById(video.get('assetDetails').videoId);
      }, this);
    }
  });

  return YoutubePlayer;
});
tvpapp.define('modules/Player/views/PosterImage',[
  "jquery",
  "modules/tvp/tvpview"
],
function($, TVPView) {
  /**
   * PosterImage class
   * This is the Player class
   *
   * @name PosterImage
   * @class PosterImage
   * @constructor
   * @return PosterImage Object
   */

  var PosterImage = TVPView.extend({
    template: "Player/PosterImage",
    className: "PosterImage background-image",

    beforeRender: function() {
      this.$el.css({
        backgroundImage: 'url('+this.data.videoModel.get('assetDetails').thumbnailUrl+')'
      });

      this.model = this.data.videoModel;
    },

    initialize: function() {
      this.data.vars.on('change:videoId', function() {
        this.$el.transit({ opacity: 0 }).hide();
      }, this);
    }
  });

  return PosterImage;
});
tvpapp.define('modules/Spots/views/SpotRemoteSmall',[
  "jquery",
  "modules/tvp/tvpview"
],
  function($, TVPView) {
    /**
     * SpotRemoteSmall class
     * This is the SpotRemoteSmall class
     *
     * @name SpotRemoteSmall
     * @class SpotRemoteSmall
     * @constructor
     * @return SpotRemoteSmall Object
     */

    var SpotRemoteSmall = TVPView.extend({
      className: "SpotRemoteSmall background-image",
      template: "Spots/SpotRemoteSmall",

      beforeRender: function() {
        this.$el.css({
          backgroundImage: 'url('+this.model.get('data').imageUrl+')'
        });
      },

      events: {
        "click": "handleClick"
      },

      handleClick: function() {
        window.open(this.model.get('data').linkUrl);
      }
    });

    return SpotRemoteSmall;
  });
tvpapp.define('modules/Spots/views/SpotOverlay',[
  "jquery",
  "modules/tvp/tvpview",

  "modules/Spots/views/SpotRemoteSmall"
],
  function($, TVPView, SpotRemoteSmall) {
    /**
     * SpotOverlay class
     * This is the SpotOverlay class
     *
     * @name SpotOverlay
     * @class SpotOverlay
     * @constructor
     * @return SpotOverlay Object
     */

    var SpotOverlay = TVPView.extend({
      className: "SpotOverlay",

      initialize: function() {
        this.spotRemoteSmall = new SpotRemoteSmall({
          className: 'SpotRemoteLarge background-image'
        });
      },

      afterRender: function() {
        this.model.on('change:videoId', function(e) {
          this.remove();
          //console.log('SpotOverlay spotCheck');
          this._spotCheck(this.model.get('videoId'));
        }, this);
      },

      _spotCheck: function(videoId) {
        var THAT = this;
        this.data.spotCollection.setVideoId(videoId);

        var spotCollectionFetch = this.app.modules.tvpData.fetchSpotData();

        spotCollectionFetch.done(function(data) {
          if (data.length < 1) {
            THAT.removeView('');
            THAT.render();
          } else {
            THAT.spotRemoteSmall.model = THAT.data.spotCollection.at(1);
            THAT.setView('', THAT.spotRemoteSmall);
            THAT.render();

            THAT.$el
              .transit({ x: '0' })
              .delay(2857)
              .transit({ x: '-100%' });


          }
        });
      }
    });

    return SpotOverlay;
  });
tvpapp.define('modules/Player/PlayerModule',[
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
/*!
 * jQuery Transit - CSS3 transitions and transformations
 * (c) 2011-2012 Rico Sta. Cruz <rico@ricostacruz.com>
 * MIT Licensed.
 *
 * http://ricostacruz.com/jquery.transit
 * http://github.com/rstacruz/jquery.transit
 */
(function(k){k.transit={version:"0.9.9",propertyMap:{marginLeft:"margin",marginRight:"margin",marginBottom:"margin",marginTop:"margin",paddingLeft:"padding",paddingRight:"padding",paddingBottom:"padding",paddingTop:"padding"},enabled:true,useTransitionEnd:false};var d=document.createElement("div");var q={};function b(v){if(v in d.style){return v}var u=["Moz","Webkit","O","ms"];var r=v.charAt(0).toUpperCase()+v.substr(1);if(v in d.style){return v}for(var t=0;t<u.length;++t){var s=u[t]+r;if(s in d.style){return s}}}function e(){d.style[q.transform]="";d.style[q.transform]="rotateY(90deg)";return d.style[q.transform]!==""}var a=navigator.userAgent.toLowerCase().indexOf("chrome")>-1;q.transition=b("transition");q.transitionDelay=b("transitionDelay");q.transform=b("transform");q.transformOrigin=b("transformOrigin");q.transform3d=e();var i={transition:"transitionEnd",MozTransition:"transitionend",OTransition:"oTransitionEnd",WebkitTransition:"webkitTransitionEnd",msTransition:"MSTransitionEnd"};var f=q.transitionEnd=i[q.transition]||null;for(var p in q){if(q.hasOwnProperty(p)&&typeof k.support[p]==="undefined"){k.support[p]=q[p]}}d=null;k.cssEase={_default:"ease","in":"ease-in",out:"ease-out","in-out":"ease-in-out",snap:"cubic-bezier(0,1,.5,1)",easeOutCubic:"cubic-bezier(.215,.61,.355,1)",easeInOutCubic:"cubic-bezier(.645,.045,.355,1)",easeInCirc:"cubic-bezier(.6,.04,.98,.335)",easeOutCirc:"cubic-bezier(.075,.82,.165,1)",easeInOutCirc:"cubic-bezier(.785,.135,.15,.86)",easeInExpo:"cubic-bezier(.95,.05,.795,.035)",easeOutExpo:"cubic-bezier(.19,1,.22,1)",easeInOutExpo:"cubic-bezier(1,0,0,1)",easeInQuad:"cubic-bezier(.55,.085,.68,.53)",easeOutQuad:"cubic-bezier(.25,.46,.45,.94)",easeInOutQuad:"cubic-bezier(.455,.03,.515,.955)",easeInQuart:"cubic-bezier(.895,.03,.685,.22)",easeOutQuart:"cubic-bezier(.165,.84,.44,1)",easeInOutQuart:"cubic-bezier(.77,0,.175,1)",easeInQuint:"cubic-bezier(.755,.05,.855,.06)",easeOutQuint:"cubic-bezier(.23,1,.32,1)",easeInOutQuint:"cubic-bezier(.86,0,.07,1)",easeInSine:"cubic-bezier(.47,0,.745,.715)",easeOutSine:"cubic-bezier(.39,.575,.565,1)",easeInOutSine:"cubic-bezier(.445,.05,.55,.95)",easeInBack:"cubic-bezier(.6,-.28,.735,.045)",easeOutBack:"cubic-bezier(.175, .885,.32,1.275)",easeInOutBack:"cubic-bezier(.68,-.55,.265,1.55)"};k.cssHooks["transit:transform"]={get:function(r){return k(r).data("transform")||new j()},set:function(s,r){var t=r;if(!(t instanceof j)){t=new j(t)}if(q.transform==="WebkitTransform"&&!a){s.style[q.transform]=t.toString(true)}else{s.style[q.transform]=t.toString()}k(s).data("transform",t)}};k.cssHooks.transform={set:k.cssHooks["transit:transform"].set};if(k.fn.jquery<"1.8"){k.cssHooks.transformOrigin={get:function(r){return r.style[q.transformOrigin]},set:function(r,s){r.style[q.transformOrigin]=s}};k.cssHooks.transition={get:function(r){return r.style[q.transition]},set:function(r,s){r.style[q.transition]=s}}}n("scale");n("translate");n("rotate");n("rotateX");n("rotateY");n("rotate3d");n("perspective");n("skewX");n("skewY");n("x",true);n("y",true);function j(r){if(typeof r==="string"){this.parse(r)}return this}j.prototype={setFromString:function(t,s){var r=(typeof s==="string")?s.split(","):(s.constructor===Array)?s:[s];r.unshift(t);j.prototype.set.apply(this,r)},set:function(s){var r=Array.prototype.slice.apply(arguments,[1]);if(this.setter[s]){this.setter[s].apply(this,r)}else{this[s]=r.join(",")}},get:function(r){if(this.getter[r]){return this.getter[r].apply(this)}else{return this[r]||0}},setter:{rotate:function(r){this.rotate=o(r,"deg")},rotateX:function(r){this.rotateX=o(r,"deg")},rotateY:function(r){this.rotateY=o(r,"deg")},scale:function(r,s){if(s===undefined){s=r}this.scale=r+","+s},skewX:function(r){this.skewX=o(r,"deg")},skewY:function(r){this.skewY=o(r,"deg")},perspective:function(r){this.perspective=o(r,"px")},x:function(r){this.set("translate",r,null)},y:function(r){this.set("translate",null,r)},translate:function(r,s){if(this._translateX===undefined){this._translateX=0}if(this._translateY===undefined){this._translateY=0}if(r!==null&&r!==undefined){this._translateX=o(r,"px")}if(s!==null&&s!==undefined){this._translateY=o(s,"px")}this.translate=this._translateX+","+this._translateY}},getter:{x:function(){return this._translateX||0},y:function(){return this._translateY||0},scale:function(){var r=(this.scale||"1,1").split(",");if(r[0]){r[0]=parseFloat(r[0])}if(r[1]){r[1]=parseFloat(r[1])}return(r[0]===r[1])?r[0]:r},rotate3d:function(){var t=(this.rotate3d||"0,0,0,0deg").split(",");for(var r=0;r<=3;++r){if(t[r]){t[r]=parseFloat(t[r])}}if(t[3]){t[3]=o(t[3],"deg")}return t}},parse:function(s){var r=this;s.replace(/([a-zA-Z0-9]+)\((.*?)\)/g,function(t,v,u){r.setFromString(v,u)})},toString:function(t){var s=[];for(var r in this){if(this.hasOwnProperty(r)){if((!q.transform3d)&&((r==="rotateX")||(r==="rotateY")||(r==="perspective")||(r==="transformOrigin"))){continue}if(r[0]!=="_"){if(t&&(r==="scale")){s.push(r+"3d("+this[r]+",1)")}else{if(t&&(r==="translate")){s.push(r+"3d("+this[r]+",0)")}else{s.push(r+"("+this[r]+")")}}}}}return s.join(" ")}};function m(s,r,t){if(r===true){s.queue(t)}else{if(r){s.queue(r,t)}else{t()}}}function h(s){var r=[];k.each(s,function(t){t=k.camelCase(t);t=k.transit.propertyMap[t]||k.cssProps[t]||t;t=c(t);if(k.inArray(t,r)===-1){r.push(t)}});return r}function g(s,v,x,r){var t=h(s);if(k.cssEase[x]){x=k.cssEase[x]}var w=""+l(v)+" "+x;if(parseInt(r,10)>0){w+=" "+l(r)}var u=[];k.each(t,function(z,y){u.push(y+" "+w)});return u.join(", ")}k.fn.transition=k.fn.transit=function(z,s,y,C){var D=this;var u=0;var w=true;if(typeof s==="function"){C=s;s=undefined}if(typeof y==="function"){C=y;y=undefined}if(typeof z.easing!=="undefined"){y=z.easing;delete z.easing}if(typeof z.duration!=="undefined"){s=z.duration;delete z.duration}if(typeof z.complete!=="undefined"){C=z.complete;delete z.complete}if(typeof z.queue!=="undefined"){w=z.queue;delete z.queue}if(typeof z.delay!=="undefined"){u=z.delay;delete z.delay}if(typeof s==="undefined"){s=k.fx.speeds._default}if(typeof y==="undefined"){y=k.cssEase._default}s=l(s);var E=g(z,s,y,u);var B=k.transit.enabled&&q.transition;var t=B?(parseInt(s,10)+parseInt(u,10)):0;if(t===0){var A=function(F){D.css(z);if(C){C.apply(D)}if(F){F()}};m(D,w,A);return D}var x={};var r=function(H){var G=false;var F=function(){if(G){D.unbind(f,F)}if(t>0){D.each(function(){this.style[q.transition]=(x[this]||null)})}if(typeof C==="function"){C.apply(D)}if(typeof H==="function"){H()}};if((t>0)&&(f)&&(k.transit.useTransitionEnd)){G=true;D.bind(f,F)}else{window.setTimeout(F,t)}D.each(function(){if(t>0){this.style[q.transition]=E}k(this).css(z)})};var v=function(F){this.offsetWidth;r(F)};m(D,w,v);return this};function n(s,r){if(!r){k.cssNumber[s]=true}k.transit.propertyMap[s]=q.transform;k.cssHooks[s]={get:function(v){var u=k(v).css("transit:transform");return u.get(s)},set:function(v,w){var u=k(v).css("transit:transform");u.setFromString(s,w);k(v).css({"transit:transform":u})}}}function c(r){return r.replace(/([A-Z])/g,function(s){return"-"+s.toLowerCase()})}function o(s,r){if((typeof s==="string")&&(!s.match(/^[\-0-9\.]+$/))){return s}else{return""+s+r}}function l(s){var r=s;if(k.fx.speeds[r]){r=k.fx.speeds[r]}return o(r,"ms")}k.transit.getTransitionValue=g})(jQuery);
tvpapp.define("jqtransit", ["jquery"], function(){});

tvpapp.define('modules/Spots/views/SpotItem',[
  "jquery",
  "modules/tvp/tvpview",
  "jqtransit"
],
  function($, TVPView) {
    /**
     * SpotItem class
     * This is the SpotItem class
     *
     * @name SpotItem
     * @class SpotItem
     * @constructor
     * @return SpotItem Object
     */

    var SpotItem = TVPView.extend({
      template: "Spots/SpotItem",
      className: "grid-item background-image SpotItem",
      tagName: 'li',

      beforeRender: function() {
        this.$el.css({
          backgroundImage: 'url('+this.model.get('data').imageUrl+')'
        });
      }
    });

    return SpotItem;
  });
tvpapp.define('modules/Spots/views/SpotList',[
  "jquery",
  "modules/tvp/tvpview",

  "modules/Spots/views/SpotItem"
],
  function($, TVPView, SpotItem) {
    /**
     * SpotList class
     * This is the SpotList class
     *
     * @name SpotList
     * @class SpotList
     * @constructor
     * @return SpotList Object
     */

    var SpotList = TVPView.extend({
      className: "grid SpotList clearfix",
      tagName: 'ul',

      beforeRender: function() {
        if (this.collection && this.collection.length > 1) {
          this.collection.each(function(model) {
            this.insertView(new SpotItem({ model: model }));
          }, this);
        }
      }
    });

    return SpotList;
  });
tvpapp.define('modules/Spots/views/SpotPanel',[
  "jquery",
  "modules/tvp/tvpview",
  "modules/tvp/tvpcollection",

  "modules/Spots/views/SpotList"
],
  function($, TVPView, TVPCollection, SpotList) {
    /**
     * SpotList class
     * This is the SpotList class
     *
     * @name SpotList
     * @class SpotList
     * @constructor
     * @return SpotList Object
     */

    var SpotPanel = TVPView.extend({
      className: "SpotPanel",

      beforeRender: function() {
        this.options.pageToken = 0;
        this.options.currentPage = 1;

        if (this.collection && this.collection.length > 0) {
          while (this.options.pageToken < this.collection.length) {
            var pageCollection = this._getCollectionPage();
            var spotList = new SpotList({ collection: new TVPCollection(pageCollection) })
            this.insertView(spotList);
          }
        }
      },

      afterRender: function() {
        this.$el.find('.SpotList').slice(0,1).addClass('showCenter');
        this.$el.find('.SpotList:gt(0)').addClass('hiddenRight');
      },

      _getCollectionPage: function() {
        var start = this.options.pageToken;
        var end = this.options.pageToken + this.options.pageSize;
        this.options.pageToken = this.options.pageToken + this.options.pageSize;

        return this.collection.slice(start, end);
      },

      initialize: function() {
        this.options.pageToken = 0;
        this.options.currentPage = 1;
        this.options.pageSize = 4;
      }
    });

    return SpotPanel;
  });
tvpapp.define('modules/Spots/views/SpotArrowLeft',[
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
tvpapp.define('modules/Spots/views/SpotArrowRight',[
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
tvpapp.define('modules/Spots/views/SpotContainer',[
  "jquery",
  "modules/tvp/tvpview",

  "modules/Spots/views/SpotPanel",
  "modules/Spots/views/SpotArrowLeft",
  "modules/Spots/views/SpotArrowRight"
],
  function($, TVPView, SpotPanel, SpotArrowLeft, SpotArrowRight) {
    /**
     * SpotContainer class
     * This is the SpotContainer class
     *
     * @name SpotContainer
     * @class SpotContainer
     * @constructor
     * @return SpotContainer Object
     */

    var SpotContainer = TVPView.extend({
      className: "SpotContainer",

      initialize: function() {
        var THAT = this;

        this.spotPanel = new SpotPanel({
          collection: this.data.spotCollection
        });

        this.spotArrowLeft = new SpotArrowLeft({
          events: {
            "click": function() {
              THAT._moveLeft();
              //THAT._checkButtonState();
            }
          }
        });
        this.spotArrowRight = new SpotArrowRight({
          events: {
            "click": function() {
              THAT._moveRight();
              //THAT._checkButtonState();
            }
          }
        });

        this.model.on('change:videoId', function(e) {
          this._spotCheck(this.model.get('videoId'));
        }, this);
      },

      beforeRender: function() {
        if (this.data.spotCollection && this.data.spotCollection.length > 0) {
          this.insertView(this.spotArrowLeft);
          this.insertView(this.spotPanel);
          this.insertView(this.spotArrowRight);
        }
      },

      _spotCheck: function(videoId) {
        var THAT = this;
        this.data.spotCollection.setVideoId(videoId);

        var spotCollectionFetch = this.app.modules.tvpData.fetchSpotData();

        spotCollectionFetch.done(function(data) {
          if (data.length < 1) {

            THAT.$el.parent().transit({
              //y: "-100%",
              opacity: 0,
              scale: [1, 0],
              height: '0px'
            });
            //THAT.data.spotCollection.clearVideoId(videoId);
            //Backbone.View.prototype.remove.call(THAT);
          } else {
            THAT.render();

            THAT.$el.parent().transit({
              //y: "-100%",
              opacity: 1,
              scale: [1, 1],
              height: '143px'
            });
          }
        });
      },

      /**
       * Slide to left panel
       *
       * @private
       */
      _moveLeft: function() {
        if (this.$el.find('.hiddenLeft').length > 0) {
          this.$el.find('.showCenter').removeClass('showCenter').addClass('hiddenRight');
          this.$el.find('.hiddenLeft').filter(":last").removeClass('hiddenLeft').addClass('showCenter');
        }
      },

      /**
       * Slide to right panel from current panel
       *
       * @private
       */
      _moveRight: function() {
        if (this.$el.find('.hiddenRight').length > 0) {
          this.$el.find('.showCenter').removeClass('showCenter').addClass('hiddenLeft');
          this.$el.find('.hiddenRight').eq(0).removeClass('hiddenRight').addClass('showCenter');
        }
      }
    });

    return SpotContainer;
  });
tvpapp.define('modules/Spots/views/SpotRemote',[
  "jquery",
  "modules/tvp/tvpview",

  "modules/Spots/views/SpotRemoteSmall"
],
  function($, TVPView, SpotRemoteSmall) {
    /**
     * SpotRemote class
     * This is the SpotRemote class
     *
     * @name SpotRemote
     * @class SpotRemote
     * @constructor
     * @return SpotRemote Object
     */

    var SpotRemote = TVPView.extend({
      className: "SpotRemote",

      initialize: function() {
        this.spotRemoteSmall = new SpotRemoteSmall();

        this.model.on('change:videoId', function(e) {
          this._spotCheck(this.model.get('videoId'));
        }, this);

        if (this.model.get('videoId') != "undefined") {
          this._spotCheck(this.model.get('videoId'));
        }
      },

      _spotCheck: function(videoId) {
        var THAT = this;
        this.data.spotCollection.setVideoId(videoId);

        var spotCollectionFetch = this.app.modules.tvpData.fetchSpotData();

        spotCollectionFetch.done(function(data) {
          if (data.length < 1) {
            THAT.removeView('');
            THAT.render();
          } else {
            THAT.spotRemoteSmall.model = THAT.data.spotCollection.at(0);
            THAT.setView('', THAT.spotRemoteSmall);
            THAT.render();
          }
        });
      }
    });

    return SpotRemote;
  });
tvpapp.define('modules/Spots/SpotsModule',[
  "namespace",
  "jquery",
  "backbone",
  "modules/tvp/tvpmodule",

  "modules/Spots/views/SpotContainer",
  "modules/Spots/views/SpotOverlay",
  "modules/Spots/views/SpotRemote"
],

function(tvpage, $, Backbone, TVPModule, SpotContainer, SpotOverlay, SpotRemote) {

  function SpotsModule() {
    this.views = {};
    this.data = {};
    this.initialize();

    TVPModule.apply(this, arguments);
  }
  SpotsModule.prototype = new TVPModule();
  SpotsModule.prototype.constructor = SpotsModule;

  SpotsModule.prototype.initialize = function() {
    _.extend(this.views, {
      spotContainer: SpotContainer,
      spotOverlay: SpotOverlay,
      spotRemote: SpotRemote
    });

    _.extend(this.data, {
      spotCollection: this.app.data.spotCollection
    });
  };

  SpotsModule.prototype.view = function(view) {
    if (!view) {
      throw Error('You must provide a view type');
    }

    switch (view) {
      case "spotSlider":
        return new this.views.spotContainer({
          model: this.app.data.vars,
          data: {
            spotCollection: this.data.spotCollection
          }
        });
      case "spotOverlay":
        return new this.views.spotOverlay({
          model: this.app.data.vars,
          data: {
            spotCollection: this.data.spotCollection
          }
        });
      case "spotRemote":
        return new this.views.spotRemote({
          model: this.app.data.vars,
          data: {
            spotCollection: this.data.spotCollection
          }
        });
    }
  };

  return SpotsModule;
});
tvpapp.define('modules/Modal/ModalModule',[
  "namespace",
  "jquery",
  "backbone",
  "modules/tvp/tvpmodule"
],

function(tvpage, $, Backbone, TVPModule) {

  function ModalModule() {
    this.initialize();

    TVPModule.apply(this, arguments);
  }
  ModalModule.prototype = new TVPModule();
  ModalModule.prototype.constructor = ModalModule;

  ModalModule.prototype.initialize = function() {

  };

  return ModalModule;
});
tvpapp.define('router',[
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

      //console.log(app.layouts);

      app.layouts.main.setViews({
        '.tvp-player': app.modules.player.view(),
        //'.tvp-spots': app.modules.spots.view('spotOverlay'),
        '.tvp-content': app.modules.content.view()

      }).render();



      //app.layouts.tvpage_spots.setViews({
      //  '.tvp-spots': app.modules.spots.view('spotRemote')
      //}).render();
    }
  });

  return Router;
});

tvpapp.require([
  "namespace",

  // Libs
  "jquery",
  "backbone",
  "router"
],

function (
  tvpage, jQuery, Backbone, Router
  ) {
  

  jQuery(function ($) {
    var app = tvpage;

    app.router = new Router();
    Backbone.history.start({ pushState: true });

    $(document).on("click", "a:not([data-bypass])", function (e) {
      var href = $(this).attr("href");
      var protocol = this.protocol + "//";

      if (href && href.slice(0, protocol.length) !== protocol &&
        href.indexOf("javascript:") !== 0) {

        e.preventDefault();

        app.router.navigate(href, true);
      }
    });
  });
});

tvpapp.define("main", function(){});

tvpapp.require.config({
  deps: ["main"],

  paths: {
    // Libraries
    jquery: "../assets/js/libs/jquery",
    underscore: "../assets/js/libs/underscore-1.4.4",
    backbone: "../assets/js/libs/backbone",
    handlebars: "../assets/js/libs/handlebars",
    layoutmanager: "../assets/js/libs/backbone.layoutmanager-0.8.7",

    // Plugins
    jqtransit: "../assets/js/plugins/jquery.transit"
  },

  version: "0.2.11",

  shim: {
    underscore: {
      exports: "_"
    },

    backbone: {
      deps: ["underscore", "jquery"],
      exports: "Backbone"
    },

    handlebars: {
      exports: "Handlebars"
    },

    layoutmanager: {
      deps: ["backbone"],
      exports: "Backbone.LayoutManager"
    },

    jqtransit: {
      deps: ["jquery"]
    }
  }
});

tvpapp.define("config", function(){});
}());