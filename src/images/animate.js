// further performance enhancements, code improvements and feature adjustments still to come...
(function(){

    if ("performance" in window == false) {
        window.performance = {};
    }
    
    Date.now = (Date.now || function () {  // thanks IE8
        return new Date().getTime();
    });
  
    if ("now" in window.performance == false){
      
      var nowOffset = Date.now();
      
      if (performance.timing && performance.timing.navigationStart){
        nowOffset = performance.timing.navigationStart
      }
  
      window.performance.now = function now(){
        return Date.now() - nowOffset;
      }
    }
  
  })();
  
  (function() {
      var lastTime = 0;
      var vendors = ['webkit', 'moz'];
      for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
          window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
          window.cancelAnimationFrame =
            window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
      }
  
      if (!window.requestAnimationFrame)
          window.requestAnimationFrame = function(callback, element) {
              var currTime = new Date().getTime();
              var timeToCall = Math.max(0, 16 - (currTime - lastTime));
              var id = window.setTimeout(function() { callback(currTime + timeToCall); },
                timeToCall);
              lastTime = currTime + timeToCall;
              return id;
          };
  
      if (!window.cancelAnimationFrame)
          window.cancelAnimationFrame = function(id) {
              clearTimeout(id);
          };
  }());
  
  ;
  (function($, window, document, undefined) {
  
    "use strict";
  
    var pluginName = "popCircle",
      defaults = {
  
        renderMode: '2d', // 2d, webgl
  
        color1: '#445566',
        color2: null,
        fadeIntensity: 50, // amount to fade the dots by the area's edge
        fadeInverse: false,
        fadeSize: 1,
        fadeType: 'linear', //linear or radial
        fadeDirection: 45, // "Direction" for linear, "CenterX/Y" for radial
        fadeCenterX: 80, // percentage value
        fadeCenterY: 70, // percentage value
        waveType: 'linear', //linear or radial
        waveCenterX: 25, // percentage value
        waveCenterY: 40, // percentage value
        waveDirection: 135,
        waveSpeed: 400, // time to transition full area, in ms
        gradientDirection: 270,
        gradientCenterX: 80, // percentage value
        gradientCenterY: 70, // percentage value
        gradientSize: 1, // 0-3
        minRadius: 0,
  
        maxRadius: 14,
  
        background: '#777',
        backgroundFadeSpeed: 500,
        overlap: 1,
        panSpeedX: 1,
        panSpeedY: 1,
        pulseCenterX: 50,
        pulseCenterY: 100,
        pulseDuration: 600,
        pulseStrength: 4,
        pulseSpeed: 500,
        pulseColor: '#EEEEEE'
      };
  
    function PopColor() {}
  
    PopColor.prototype = {
  
      // With massive amounts of thanks to 
      // http://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
      // for the truly remarkable function
      blendColors: function(c0, c1, p) {
        var f = parseInt(c0.slice(1), 16),
          t = parseInt(c1.slice(1), 16),
          R1 = f >> 16,
          G1 = f >> 8 & 0x00FF,
          B1 = f & 0x0000FF,
          R2 = t >> 16,
          G2 = t >> 8 & 0x00FF,
          B2 = t & 0x0000FF;
        return "#" + (0x1000000 + (Math.round((R2 - R1) * p) + R1) * 0x10000 + (Math.round((G2 - G1) * p) + G1) * 0x100 + (Math.round((B2 - B1) * p) + B1)).toString(16).slice(1);
      },
  
      // thanks to https://github.com/ondras/rot.js
      interpolateColor: function(color1, color2, factor) {
        if (arguments.length < 3) {
          factor = 0.5;
        }
        var result = this._h2r(color1).slice();
        for (var i = 0; i < 3; i++) {
          result[i] = Math.round(result[i] + factor * (this._h2r(color2)[i] - this._h2r(color1)[i]));
        }
        return this._r2h(result);
      },
  
      // Converts a #ffffff hex string into an [r,g,b] array
      _h2r: function(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16)
        ] : null;
      },
  
      // inverse
      _r2h: function(rgb) {
        return "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
      },
    }
  
    function PopCirc(x, y, limit, delay) {
      this.x = x;
      this.y = y;
  
      this.pos = {
        x: x,
        y: y
      };
  
      this.settings = {};
  
      this.container = null;
  
      this.index = 0;
  
      this.radius = 0;
      this.startRadius = 0;
      this.endRadius = 0;
      this.context = false;
  
      this.color = '#555555';
      this.color2 = null; // for gradient
  
      this.calculatedColor = '#000000';
  
      this.expanding = true;
  
      this.resetCallback = null;
  
      // callback when a circle has finished animating
      this.completeCallback = null;
  
      this.reverse = false;
  
      // determine how far "along" the gradient line this circle is
      this.gradientPosition = 0.5;
  
      this.fade = 0;
  
      this.age = 0;
      this.delay = 0;
  
      this.delayFunction = null;
  
      this.colorFunction = null;
  
      this.positionFunction = null;
  
      this.radiusFunction = null;
  
      this.stopped = false;
      this.prevTime = null;
      this.totalFrames = 32;
      this.totalFramesOut = 20;
      this.startTime = null;
  
      this.sprite = null;
  
    };
  
    PopCirc.prototype = {
      constructor: PopCirc,
  
      getPosition: function() {
        return this.pos;
      },
  
      transition: function(reverse, callback) {
        this.reverse = reverse;
        this.completeCallback = callback;
        this.startTime = window.performance.now();
        this.frame = 0;
      },
  
      applySettings: function(settings) {
        this.settings = settings;
      },
  
      setColor: function(color, color2) {
        this.color1 = color2;
        this.color2 = color2;
      },
  
      setDelay: function(delay) {
        this.delay = delay;
      },
  
      setDelayFunction: function(fn) {
        this.delayFunction = fn;
      },
  
      setFadeFunction: function(fn) {
        this.fadeFunction = fn;
      },
  
      setFade: function(fade) {
        if (fade > 1) {
          fade = 1;
        } else if (fade < 0) {
          fade = 0;
        }
        this.fade = fade;
      },
  
      setColorFunction: function(fn) {
        this.colorFunction = fn;
      },
  
      setGradientFunction: function(fn) {
        this.gradientFunction = fn;
      },
  
      setPositionFunction: function(fn) {
        this.positionFunction = fn;
      },
  
      setRadiusFunction: function(fn) {
        this.radiusFunction = fn;
      },
  
      setPulseFunction: function(fn) {
        this.pulseFunction = fn;
      },
  
      // TODO: combine overlap and fade into radiusFunction
  
      /*setOverlap: function(overlap) {
        if(overlap <= 0) {
          overlap = 0;
        }
        this.overlap = overlap;
      },*/
  
      hashCode: function(str) { // java String#hashCode
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hash;
      },
  
      intToRGB: function(i) {
        var c = (i & 0x00FFFFFF)
          .toString(16)
          .toUpperCase();
  
        return "00000".substring(0, 6 - c.length) + c;
      },
  
      easeOut: function(t, b, c, d) {
        var ts = (t /= d) * t;
        var tc = ts * t;
        return b + c * (-20.5925 * tc * ts + 48.8825 * ts * ts + -37.585 * tc + 10.595 * ts + -0.3 * t);
      },
  
      easeIn: function(t, b, c, d) {
        var ts = (t /= d) * t;
        var tc = ts * t;
        return b + c * (-20.5925 * tc * ts + 48.8825 * ts * ts + -37.585 * tc + 10.595 * ts + -0.3 * t);
      },
  
      setPixel: function(imageData, x, y, r, g, b, a) {
        var index = (x + y * imageData.width) * 4;
        imageData.data[index + 0] = r;
        imageData.data[index + 1] = g;
        imageData.data[index + 2] = b;
        imageData.data[index + 3] = a;
      },
  
      step: function(ctx, t) {
  
        if (!this.sprite && this.settings['renderMode'] == 'webgl') {
          this.sprite = new PIXI.Sprite(this.container.texture);
          this.container.particle_container.addChild(this.sprite);
        }
  
        this.pos = this.positionFunction(this, t);
  
        if (!this.startTime) {
          this.startTime = window.performance.now();
        }
  
        if (t == 0) {
          return;
        }
  
        // Method 1
        if (this.container.settings['renderMode'] == '2d') {
          ctx.beginPath();
          var r = this.radiusFunction(this, t);
          if (r > 0) {
            ctx.arc(
              this.getPosition().x,
              this.getPosition().y,
              r,
              0,
              2 * Math.PI,
              false);
          }
          ctx.fillStyle = this.colorFunction(this, t);
          ctx.fill();
        } else {
          // render using the webgl canvas          
          var r = this.radiusFunction(this, t);
          this.sprite.width = r * 2;
          this.sprite.height = r * 2;
          this.sprite.position.x = this.getPosition().x - r;
          this.sprite.position.y = this.getPosition().y - r;
          if (this.frame % 3 == 0) {
            this.calculatedColor = this.colorFunction(this, t);
          }
          this.sprite.tint = parseInt(this.calculatedColor.replace('#', '0x'));
        }
  
        if (this.delayFunction(this, t - this.startTime) && this.frame <= this.totalFrames) {
          this.frame++;
        }
  
        if (this.frame >= this.totalFrames) {
          if (typeof this.completeCallback === "function") {
            this.completeCallback(this);
          }
        }
      }
    }
  
    // The actual plugin constructor
    function Plugin(element, options) {
      this.element = element;
      // jQuery has an extend method which merges the contents of two or
      // more objects, storing the result in the first object. The first object
      // is generally empty as we don't want to alter the default options for
      // future instances of the plugin
      this.settings = $.extend({}, defaults, options);
      this._defaults = defaults;
      this._name = pluginName;
      this.init();
    }
  
    // Avoid Plugin.prototype conflicts
    $.extend(Plugin.prototype, {
      popCircs: [],
      context: null,
      canvas: null,
      animating: false,
      width: 0,
      height: 0,
      pulseTime: 0,
      stats: null,
      stage: null,
  
      texture: null,
      renderer: null,
  
      sourceCanvas: null,
      sourceImage: null,
      sourceCanvasElement: null,
      init: function() {
        var $this = $(this.element);
  
        this.height = $this.height();
        this.width = $this.width();
  
        // setup the canvas
        $this.css('background', 'transparent');
        $this.css('position', 'relative');
        this.canvas = $('<canvas width="' + this.width + '" height="' + this.height + '">');
        this.canvas.css({
          position: 'absolute',
          left: '0px',
          top: '0px',
          zIndex: '-1',
          background: '#555'
        });
  
        $this.append(this.canvas);
  
        if (this.settings['renderMode'] == '2d') {
          this.context = this.canvas.get(0).getContext("2d");
        }
  
        var y = Math.round(this.height / this.settings['maxRadius']);
        // new radius, designed to fit exactly into height
        var radius = this.height / y;
        var count = 0;
  
        function _delayFunction(c, t) {
  
          var waveCenterX = c.settings['waveCenterX'] / 100;
          var waveCenterY = c.settings['waveCenterY'] / 100;
  
          var a = waveCenterX - c.getPosition().x / c.container.width;
          var b = waveCenterY - c.getPosition().y / c.container.height;
          var dist = Math.sqrt(a * a + b * b);
  
          // calculate percentage value of canvas size
          //console.log(dist);
          return t > (dist * c.settings['waveSpeed']);
        }
  
        // fade, as a function of position (move to radius)
        function _fadeFunction(c, t) {
          var fadeCenterX = c.settings['fadeCenterX'] / 100;
          var fadeCenterY = c.settings['fadeCenterY'] / 100;
  
          var a = fadeCenterX - c.positionFunction(c, t).x / c.container.width;
          var b = fadeCenterY - c.positionFunction(c, t).y / c.container.height;
          var dist = Math.sqrt(a * a + b * b) * c.settings['fadeSize'];
  
          // apply the intensity factor (0 - 1)
          dist = 1 - c.settings['fadeIntensity'] * dist;
  
          //console.log(dist);
          if (c.settings['fadeInverse'] == 1) {
            return 1 - dist;
          } else {
            return dist;
          }
        }
  
        // radius as a function of time and position
        function _radiusFunction(c, t) {
          var r;
          if (!c.reverse) {
            r = c.easeIn(c.frame,
              c.settings['minRadius'],
              c.settings['maxRadius'] * c.fadeFunction(this, t) * c.settings['overlap'],
              c.totalFrames);
  
          } else {
            r = c.settings['maxRadius'] * c.fadeFunction(this, t) * c.settings['overlap'] - c.easeOut(
              c.frame,
              c.settings['minRadius'],
              c.settings['maxRadius'] * c.fadeFunction(this, t) * c.settings['overlap'],
              c.totalFrames);
          }
  
          r = r + c.pulseFunction(c, t);
          return r > 0 ? r : 0;
          //todo: implement "fade" and "overlay" here
        }
  
        function _positionFunction(c, t) {
  
          var dx = (t / c.settings['panSpeedX']) * c.settings['maxRadius'] * 2;
          var dy = (t / c.settings['panSpeedY']) * c.settings['maxRadius'] * 2
  
          dx = dx % (c.settings['maxRadius'] * 2);
          dy = dy % (c.settings['maxRadius'] * 2);
  
          return {
            x: c.x + dx,
            y: c.y + dy
          };
        }
  
        function _colorFunction(c, t) {
  
          var gradientCenterX = c.settings['gradientCenterX'] / 100;
          var gradientCenterY = c.settings['gradientCenterY'] / 100;
  
          var Color = new PopColor;
          if (c.settings['color2']) {
            var a = gradientCenterX - c.getPosition().x / c.container.width;
            var b = gradientCenterY - c.getPosition().y / c.container.height;
            var dist = Math.sqrt(a * a + b * b);
            //console.log(dist);
  
            var grad = dist * 2 / c.settings['gradientSize'];
            if (grad > 1) {
              grad = 1;
            }
            var color = Color.interpolateColor(c.settings['color1'], c.settings['color2'], grad);
          } else {
            var color = c.settings['color1'];
          }
          // add an additional color param based on amplitude of pulse
          var amp = c.pulseFunction(c, t) / c.settings['pulseStrength'];
          color = Color.blendColors(color, c.settings['pulseColor'], amp);
          return color;
  
        }
  
        function _pulseFunction(c, t) {
  
          var pulseCenterX = c.settings['pulseCenterX'] / 100;
          var pulseCenterY = c.settings['pulseCenterY'] / 100;
  
          var a = pulseCenterX - c.getPosition().x / c.container.width;
          var b = pulseCenterY - c.getPosition().y / c.container.height;
          var dist = Math.sqrt(a * a + b * b);
  
          // delay is equal to the distance between the centre and this circle
          // as a proportion of the screen size
          var delay = dist * c.settings['pulseSpeed'];
  
          // calculate td - the time that has passed since the pulse started at this circle
          // add on "delay" to accomodate the extra time this circle has to wait before it begins
          var td = t - c.container.pulseTime - delay;
  
          if (td < 0 || td > c.settings['pulseDuration']) {
            // pulse has ended
            return 0;
          }
  
          // SIN based. Todo: plug into easing functions
          var amp = (1 - (dist / 1.5)) * Math.sin(Math.PI * td / c.settings['pulseDuration']) * c.settings['pulseStrength'];
  
          return amp;
        }
  
        //this.stage.setInteractive(true);
  
        for (var i = -1; i < this.width / (radius * 2) + 1; i++) {
          for (var j = -1; j < y + 1; j++) {
            var circle = new PopCirc(i * radius * 2 + (radius / 2), j * radius * 2 + (radius / 2));
  
            //this.stage.addChild(circle.graphics);
  
            circle.index = count;
            circle.container = this;
            circle.setDelayFunction(_delayFunction);
            circle.setFadeFunction(_fadeFunction);
            circle.setColorFunction(_colorFunction);
            circle.setPositionFunction(_positionFunction);
            circle.setRadiusFunction(_radiusFunction);
            circle.setPulseFunction(_pulseFunction);
            // define the minimum and maximum radius for the circles
            //circle.transition(this.settings['minRadius'], radius, false);
  
            circle.applySettings(this.settings);
            this.popCircs.push(circle);
            count++;
          }
        }
        if (this.settings['renderMode'] == 'webgl') {
  
          this.stage = new PIXI.Stage(0x666666, true);
          this.renderer = PIXI.autoDetectRenderer(this.width, this.height, null, false, true);
          var amount = (this.renderer instanceof PIXI.WebGLRenderer) ? 100 : 5;
          console.log(amount);
          if (amount == 5) {
            this.renderer.context.mozImageSmoothingEnabled = false
            this.renderer.context.webkitImageSmoothingEnabled = false;
  
          }
  
          this.renderer.view.style["transform"] = "translatez(0)";
          this.renderer.view.style.position = "absolute";
          document.body.appendChild(this.renderer.view);
          this.texture = new PIXI.Texture.fromImage("circle.png");
  
          this.particle_container = new PIXI.DisplayObjectContainer();
          //this.particle_container = new PIXI.ParticleContainer();
          this.stage.addChild(this.particle_container);
        }
        //console.log(j);
        //this.animate();
  
      },
      pulse: function() {
        this.pulseTime = window.performance.now();
      },
      update: function(options) {
        // update a setting
        if (options.hasOwnProperty('name') && options.hasOwnProperty('value')) {
          if (options.name == 'background') {
            this.canvas.css({
              'transition': 'background-color ' + (this.settings['backgroundFadeSpeed'] / 1000) + 's',
              'background-color': options.value
            });
          } else {
            this.settings[options.name] = options.value;
            for (var i in this.circles) {
              var circle = this.circles[i];
              circle.settings[options.name] = options.value;
            }
          }
        }
      },
      trigger: function(options) {
  
        var _this = this;
  
        this.settings = $.extend({}, this._defaults, options);
        // todo: validate all settings!!
        var count = 1;
  
        this.triggerTime = window.performance.now();
  
        this.canvas.css({
          'transition': 'background-color ' + (this.settings['backgroundFadeSpeed'] / 1000) + 's',
          'background-color': this.settings['background']
        });
  
        if (this.settings['renderMode'] == 'webgl') {
          this.renderer.backgroundColor = parseInt(this.settings['background'].replace('#', '0x'));
        }
  
        for (var i in this.popCircs) {
          var c = this.popCircs[i];
          c.transition(true, function(c) {
            c.applySettings(_this.settings);
            c.transition(false);
          });
          count++;
        }
        if (!this.animating) {
          this.animate();
        }
      },
      prevt: 0,
      animate: function() {
        var _this = this;
        // start the process
        function animateStep(t) {
  
          if (_this.settings['renderMode'] == '2d') {
            _this.context.clearRect(0, 0, _this.canvas.width(), _this.canvas.height());
          }
          // see: http://jsperf.com/improving-clear-canvas
          for (var i in _this.popCircs) {
            var c = _this.popCircs[i];
            c.step(_this.context, t);
          }
          if (_this.settings['renderMode'] == 'webgl') {
            _this.renderer.render(_this.stage);
          }
          requestAnimationFrame(animateStep);
  
          _this.prevt = t;
        }
        this.animating = true;
        animateStep(0);
      }
    });
  
    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[pluginName] = function(call, params) {
      return this.each(function() {
        if (call && $.data(this, "plugin_" + pluginName)) {
          var instance = $.data(this, "plugin_" + pluginName);
          if (call == 'trigger') {
            instance['trigger'](params);
          } else if (call == 'pulse') {
            instance['pulse']();
          } else if (call == 'update') {
            instance['update'](params);
          } else {
            // no function defined
          }
        } else if (!$.data(this, "plugin_" + pluginName)) {
          $.data(this, "plugin_" + pluginName, new Plugin(this, call));
        }
      });
    };
  
  })(jQuery, window, document);
  
  String.prototype.toUnderscore = function() {
    return this.replace(/([A-Z])/g, function($1) {
      return "_" + $1.toLowerCase();
    });
  };
  String.prototype.toCamel = function() {
    return this.toLowerCase().replace(/_(.)/g, function(match, group1) {
      return group1.toUpperCase();
    });
  }
  $(function() {
  
    //It's a reflektor...
    var Reflector = function(obj) {
      this.getProperties = function() {
        var properties = [];
        for (var prop in obj) {
          if (typeof obj[prop] != 'function' && typeof obj[prop] != 'undefined') {
            properties.push(prop + ': \'' + obj[prop] + '\'');
          }
        }
        return properties;
      };
    }
  
    var circ = $('.pop-this').popCircle();
    //circ.popCircle('trigger'); 
    $('.trigger').on('click', function() {
      $('.pop-this h1').slideDown(function() {
        $(this).html('Green!');
        $(this).css('color', '#FFF');
        $(this).slideUp(500);
      }, 1000);
      var settings = {
        color1: $('.color1').val(),
        color2: $('.color2').val(),
        background: $('.background').val(),
        backgroundFadeSpeed: $('.background_fade_speed').val(),
  
        waveDirection: $('.wave_direction').val(),
        waveSpeed: $('.wave_speed').val(),
        fadeDirection: $('.fade_direction').val(),
        fadeCenterX: $('.fade_center_x').val(),
        fadeCenterY: $('.fade_center_y').val(),
        gradientCenterX: $('.gradient_center_x').val(),
        gradientCenterY: $('.gradient_center_y').val(),
        gradientSize: $('.gradient_size').val(),
        waveCenterX: $('.wave_center_x').val(),
        waveCenterY: $('.wave_center_y').val(),
        gradientDirection: $('.gradient_direction').val(),
        fadeIntensity: $('.fade_intensity').val(),
        fadeSize: $('.fade_size').val(),
        fadeInverse: $('.invert_fade').val(),
        overlap: $('.overlap').val(),
        panSpeedX: $('.pan_speed_x').val(),
        panSpeedY: $('.pan_speed_y').val(),
        // TODO: adjust pan speed etc. only after callback of "circle complete"
        // 
        pulseCenterX: $('.pulse_center_x').val(),
        pulseCenterY: $('.pulse_center_y').val(),
        pulseDuration: $('.pulse_duration').val(),
        pulseStrength: $('.pulse_strength').val(),
        pulseSpeed: $('.pulse_speed').val(),
        pulseColor: $('.pulse_color').val(),
      };
  
      var reflector = new Reflector(settings);
  
      $('.dump').html('{<br/>' + reflector.getProperties().join(',<br/>') + '<br/>}');
  
      circ.popCircle('trigger', settings);
  
    });
  
    $('.trigger').triggerHandler('click');
  
    $('.pulse').on('click', function() {
      circ.popCircle('pulse');
    });
  
    var presets = {
      'Deep Blue Something': {
        color1: '#0d1c55',
        color2: '#122452',
        background: '#09396f',
        backgroundFadeSpeed: '250',
        waveSpeed: '250',
        fadeCenterX: '70',
        fadeCenterY: '55',
        gradientCenterX: '25',
        gradientCenterY: '50',
        gradientSize: '0.4',
        waveCenterX: '20',
        waveCenterY: '80',
        fadeIntensity: '0',
        fadeSize: '0.75',
        overlap: '1.25',
        panSpeedX: '500',
        panSpeedY: '2000',
        pulseCenterX: '75',
        pulseCenterY: '50',
        pulseDuration: '5000',
        pulseStrength: '10',
        pulseSpeed: '2500',
        pulseColor: '#0075bb'
      },
      'Moonlight': {
        color1: '#ddfff1',
        color2: '#06091c',
        background: '#070725',
        backgroundFadeSpeed: '6000',
        waveSpeed: '250',
        fadeCenterX: '10',
        fadeCenterY: '10',
        gradientCenterX: '70',
        gradientCenterY: '35',
        gradientSize: '0.5',
        waveCenterX: '20',
        waveCenterY: '80',
        fadeIntensity: '2',
        fadeSize: '0.5',
        overlap: '1',
        panSpeedX: '-5000',
        panSpeedY: '8000',
        pulseCenterX: '100',
        pulseCenterY: '100',
        pulseDuration: '250',
        pulseStrength: '4',
        pulseSpeed: '4000',
        pulseColor: '#e1faff'
      },
      'COPS!': {
        color1: '#e80000',
        color2: '#0b0b0f',
        background: '#070a14',
        backgroundFadeSpeed: '250',
        waveSpeed: '250',
        fadeCenterX: '70',
        fadeCenterY: '55',
        gradientCenterX: '25',
        gradientCenterY: '50',
        gradientSize: '0.4',
        waveCenterX: '20',
        waveCenterY: '80',
        fadeIntensity: '0.75',
        fadeSize: '0.75',
        overlap: '1',
        panSpeedX: '500',
        panSpeedY: '2000',
        pulseCenterX: '75',
        pulseCenterY: '50',
        pulseDuration: '200',
        pulseStrength: '10',
        pulseSpeed: '500',
        pulseColor: '#0630f2'
      },
      'Stop The Ride I Want To Get Off': {
        color1: '#fe3838',
        color2: '#fefdfc',
        background: '#6b9def',
        backgroundFadeSpeed: '1500',
        waveSpeed: '250',
        fadeCenterX: '70',
        fadeCenterY: '55',
        gradientCenterX: '30',
        gradientCenterY: '40',
        gradientSize: '1',
        waveCenterX: '20',
        waveCenterY: '80',
        fadeIntensity: '1.5',
        fadeSize: '1.5',
        overlap: '1',
        panSpeedX: '75',
        panSpeedY: '100000',
        pulseCenterX: '0',
        pulseCenterY: '50',
        pulseDuration: '500',
        pulseStrength: '10',
        pulseSpeed: '1250',
        pulseColor: '#afe01b'
      },
      'Vanilla Sky': {
        color1: '#aad3f2',
        color2: '#e2baf3',
        background: '#eaf9ff',
        backgroundFadeSpeed: '2500',
        waveSpeed: '250',
        fadeCenterX: '70',
        fadeCenterY: '55',
        gradientCenterX: '80',
        gradientCenterY: '35',
        gradientSize: '1.5',
        waveCenterX: '20',
        waveCenterY: '80',
        fadeIntensity: '0.75',
        fadeSize: '1.5',
        overlap: '2',
        panSpeedX: '-5000',
        panSpeedY: '8000',
        pulseCenterX: '0',
        pulseCenterY: '0',
        pulseDuration: '2500',
        pulseStrength: '20',
        pulseSpeed: '250',
        pulseColor: '#ffffff'
      },
      '48:13': {
        color1: '#ffffff',
        color2: '#fb00e8',
        background: '#fd04c2',
        backgroundFadeSpeed: '250',
        waveSpeed: '250',
        fadeCenterX: '70',
        fadeCenterY: '55',
        gradientCenterX: '90',
        gradientCenterY: '90',
        gradientSize: '1',
        waveCenterX: '20',
        waveCenterY: '80',
        fadeIntensity: '0.75',
        fadeSize: '0.25',
        overlap: '1',
        panSpeedX: '5000',
        panSpeedY: '100000',
        pulseCenterX: '50',
        pulseCenterY: '50',
        pulseDuration: '200',
        pulseStrength: '20',
        pulseSpeed: '500',
        pulseColor: '#ffffff'
      },
      'Sun Spots': {
        color1: '#fcd703',
        color2: '#5b2c00',
        background: '#fef805',
        backgroundFadeSpeed: '6000',
        waveSpeed: '2000',
        fadeCenterX: '70',
        fadeCenterY: '55',
        gradientCenterX: '90',
        gradientCenterY: '20',
        gradientSize: '1',
        waveCenterX: '20',
        waveCenterY: '80',
        fadeIntensity: '0.75',
        fadeSize: '2',
        overlap: '1.05',
        panSpeedX: '1500',
        panSpeedY: '1500',
        pulseCenterX: '0',
        pulseCenterY: '0',
        pulseDuration: '750',
        pulseStrength: '15',
        pulseSpeed: '750',
        pulseColor: '#242424'
      }
    }
    for (var i in presets) {
      var preset = presets[i];
      $('.presets').append('<option value="' + i + '">' + i + '</option>');
    }
    $('.presets').on('change', function() {
      var settings = presets[$(this).val()];
      var name = $(this).val();
      var reflector = new Reflector(settings);
      for (var i in settings) {
        $('.' + i.toUnderscore()).val(settings[i]);
      }
      $('.pop-this h1').slideUp(500, function() {
        $(this).html(name);
        $(this).slideDown(500);
      });
      $('.dump').html('{<br/>' + reflector.getProperties().join(',<br/>') + '<br/>}');
      circ.popCircle('trigger', settings);
    });
  
    $('input, select').on('keyup change', function() {
      var val = $(this).val();
      circ.popCircle('update', {
        name: $(this).attr('class').toCamel(),
        value: val
      });
    });
  
  });