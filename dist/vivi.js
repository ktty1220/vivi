/*! Hammer.JS - v1.0.6 - 2014-01-02
 * http://eightmedia.github.com/hammer.js
 *
 * Copyright (c) 2014 Jorik Tangelder <j.tangelder@gmail.com>;
 * Licensed under the MIT license */

(function(window, undefined) {
  'use strict';

/**
 * Hammer
 * use this to create instances
 * @param   {HTMLElement}   element
 * @param   {Object}        options
 * @returns {Hammer.Instance}
 * @constructor
 */
var Hammer = function(element, options) {
  return new Hammer.Instance(element, options || {});
};

// default settings
Hammer.defaults = {
  // add styles and attributes to the element to prevent the browser from doing
  // its native behavior. this doesnt prevent the scrolling, but cancels
  // the contextmenu, tap highlighting etc
  // set to false to disable this
  stop_browser_behavior: {
    // this also triggers onselectstart=false for IE
    userSelect       : 'none',
    // this makes the element blocking in IE10 >, you could experiment with the value
    // see for more options this issue; https://github.com/EightMedia/hammer.js/issues/241
    touchAction      : 'none',
    touchCallout     : 'none',
    contentZooming   : 'none',
    userDrag         : 'none',
    tapHighlightColor: 'rgba(0,0,0,0)'
  }

  //
  // more settings are defined per gesture at gestures.js
  //
};

// detect touchevents
Hammer.HAS_POINTEREVENTS = window.navigator.pointerEnabled || window.navigator.msPointerEnabled;
Hammer.HAS_TOUCHEVENTS = ('ontouchstart' in window);

// dont use mouseevents on mobile devices
Hammer.MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android|silk/i;
Hammer.NO_MOUSEEVENTS = Hammer.HAS_TOUCHEVENTS && window.navigator.userAgent.match(Hammer.MOBILE_REGEX);

// eventtypes per touchevent (start, move, end)
// are filled by Hammer.event.determineEventTypes on setup
Hammer.EVENT_TYPES = {};

// direction defines
Hammer.DIRECTION_DOWN = 'down';
Hammer.DIRECTION_LEFT = 'left';
Hammer.DIRECTION_UP = 'up';
Hammer.DIRECTION_RIGHT = 'right';

// pointer type
Hammer.POINTER_MOUSE = 'mouse';
Hammer.POINTER_TOUCH = 'touch';
Hammer.POINTER_PEN = 'pen';

// touch event defines
Hammer.EVENT_START = 'start';
Hammer.EVENT_MOVE = 'move';
Hammer.EVENT_END = 'end';

// hammer document where the base events are added at
Hammer.DOCUMENT = window.document;

// plugins and gestures namespaces
Hammer.plugins = Hammer.plugins || {};
Hammer.gestures = Hammer.gestures || {};

// if the window events are set...
Hammer.READY = false;

/**
 * setup events to detect gestures on the document
 */
function setup() {
  if(Hammer.READY) {
    return;
  }

  // find what eventtypes we add listeners to
  Hammer.event.determineEventTypes();

  // Register all gestures inside Hammer.gestures
  Hammer.utils.each(Hammer.gestures, function(gesture){
    Hammer.detection.register(gesture);
  });

  // Add touch events on the document
  Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_MOVE, Hammer.detection.detect);
  Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_END, Hammer.detection.detect);

  // Hammer is ready...!
  Hammer.READY = true;
}

Hammer.utils = {
  /**
   * extend method,
   * also used for cloning when dest is an empty object
   * @param   {Object}    dest
   * @param   {Object}    src
   * @parm  {Boolean}  merge    do a merge
   * @returns {Object}    dest
   */
  extend: function extend(dest, src, merge) {
    for(var key in src) {
      if(dest[key] !== undefined && merge) {
        continue;
      }
      dest[key] = src[key];
    }
    return dest;
  },


  /**
   * for each
   * @param obj
   * @param iterator
   */
  each: function(obj, iterator, context) {
    var i, length;
    // native forEach on arrays
    if ('forEach' in obj) {
      obj.forEach(iterator, context);
    }
    // arrays
    else if(obj.length !== undefined) {
      for (i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === false) {
          return;
        }
      }
    }
    // objects
    else {
      for (i in obj) {
        if (obj.hasOwnProperty(i) && iterator.call(context, obj[i], i, obj) === false) {
          return;
        }
      }
    }
  },

  /**
   * find if a node is in the given parent
   * used for event delegation tricks
   * @param   {HTMLElement}   node
   * @param   {HTMLElement}   parent
   * @returns {boolean}       has_parent
   */
  hasParent: function(node, parent) {
    while(node) {
      if(node == parent) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  },


  /**
   * get the center of all the touches
   * @param   {Array}     touches
   * @returns {Object}    center
   */
  getCenter: function getCenter(touches) {
    var valuesX = [], valuesY = [];

    Hammer.utils.each(touches, function(touch) {
      // I prefer clientX because it ignore the scrolling position
      valuesX.push(typeof touch.clientX !== 'undefined' ? touch.clientX : touch.pageX );
      valuesY.push(typeof touch.clientY !== 'undefined' ? touch.clientY : touch.pageY );
    });

    return {
      pageX: ((Math.min.apply(Math, valuesX) + Math.max.apply(Math, valuesX)) / 2),
      pageY: ((Math.min.apply(Math, valuesY) + Math.max.apply(Math, valuesY)) / 2)
    };
  },


  /**
   * calculate the velocity between two points
   * @param   {Number}    delta_time
   * @param   {Number}    delta_x
   * @param   {Number}    delta_y
   * @returns {Object}    velocity
   */
  getVelocity: function getVelocity(delta_time, delta_x, delta_y) {
    return {
      x: Math.abs(delta_x / delta_time) || 0,
      y: Math.abs(delta_y / delta_time) || 0
    };
  },


  /**
   * calculate the angle between two coordinates
   * @param   {Touch}     touch1
   * @param   {Touch}     touch2
   * @returns {Number}    angle
   */
  getAngle: function getAngle(touch1, touch2) {
    var y = touch2.pageY - touch1.pageY,
      x = touch2.pageX - touch1.pageX;
    return Math.atan2(y, x) * 180 / Math.PI;
  },


  /**
   * angle to direction define
   * @param   {Touch}     touch1
   * @param   {Touch}     touch2
   * @returns {String}    direction constant, like Hammer.DIRECTION_LEFT
   */
  getDirection: function getDirection(touch1, touch2) {
    var x = Math.abs(touch1.pageX - touch2.pageX),
      y = Math.abs(touch1.pageY - touch2.pageY);

    if(x >= y) {
      return touch1.pageX - touch2.pageX > 0 ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
    }
    else {
      return touch1.pageY - touch2.pageY > 0 ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
    }
  },


  /**
   * calculate the distance between two touches
   * @param   {Touch}     touch1
   * @param   {Touch}     touch2
   * @returns {Number}    distance
   */
  getDistance: function getDistance(touch1, touch2) {
    var x = touch2.pageX - touch1.pageX,
      y = touch2.pageY - touch1.pageY;
    return Math.sqrt((x * x) + (y * y));
  },


  /**
   * calculate the scale factor between two touchLists (fingers)
   * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
   * @param   {Array}     start
   * @param   {Array}     end
   * @returns {Number}    scale
   */
  getScale: function getScale(start, end) {
    // need two fingers...
    if(start.length >= 2 && end.length >= 2) {
      return this.getDistance(end[0], end[1]) /
        this.getDistance(start[0], start[1]);
    }
    return 1;
  },


  /**
   * calculate the rotation degrees between two touchLists (fingers)
   * @param   {Array}     start
   * @param   {Array}     end
   * @returns {Number}    rotation
   */
  getRotation: function getRotation(start, end) {
    // need two fingers
    if(start.length >= 2 && end.length >= 2) {
      return this.getAngle(end[1], end[0]) -
        this.getAngle(start[1], start[0]);
    }
    return 0;
  },


  /**
   * boolean if the direction is vertical
   * @param    {String}    direction
   * @returns  {Boolean}   is_vertical
   */
  isVertical: function isVertical(direction) {
    return (direction == Hammer.DIRECTION_UP || direction == Hammer.DIRECTION_DOWN);
  },


  /**
   * stop browser default behavior with css props
   * @param   {HtmlElement}   element
   * @param   {Object}        css_props
   */
  stopDefaultBrowserBehavior: function stopDefaultBrowserBehavior(element, css_props) {
    if(!css_props || !element || !element.style) {
      return;
    }

    // with css properties for modern browsers
    Hammer.utils.each(['webkit', 'khtml', 'moz', 'Moz', 'ms', 'o', ''], function(vendor) {
      Hammer.utils.each(css_props, function(prop) {
          // vender prefix at the property
          if(vendor) {
            prop = vendor + prop.substring(0, 1).toUpperCase() + prop.substring(1);
          }
          // set the style
          if(prop in element.style) {
            element.style[prop] = prop;
          }
      });
    });

    // also the disable onselectstart
    if(css_props.userSelect == 'none') {
      element.onselectstart = function() {
        return false;
      };
    }

    // and disable ondragstart
    if(css_props.userDrag == 'none') {
      element.ondragstart = function() {
        return false;
      };
    }
  }
};


/**
 * create new hammer instance
 * all methods should return the instance itself, so it is chainable.
 * @param   {HTMLElement}       element
 * @param   {Object}            [options={}]
 * @returns {Hammer.Instance}
 * @constructor
 */
Hammer.Instance = function(element, options) {
  var self = this;

  // setup HammerJS window events and register all gestures
  // this also sets up the default options
  setup();

  this.element = element;

  // start/stop detection option
  this.enabled = true;

  // merge options
  this.options = Hammer.utils.extend(
    Hammer.utils.extend({}, Hammer.defaults),
    options || {});

  // add some css to the element to prevent the browser from doing its native behavoir
  if(this.options.stop_browser_behavior) {
    Hammer.utils.stopDefaultBrowserBehavior(this.element, this.options.stop_browser_behavior);
  }

  // start detection on touchstart
  Hammer.event.onTouch(element, Hammer.EVENT_START, function(ev) {
    if(self.enabled) {
      Hammer.detection.startDetect(self, ev);
    }
  });

  // return instance
  return this;
};


Hammer.Instance.prototype = {
  /**
   * bind events to the instance
   * @param   {String}      gesture
   * @param   {Function}    handler
   * @returns {Hammer.Instance}
   */
  on: function onEvent(gesture, handler) {
    var gestures = gesture.split(' ');
    Hammer.utils.each(gestures, function(gesture) {
      this.element.addEventListener(gesture, handler, false);
    }, this);
    return this;
  },


  /**
   * unbind events to the instance
   * @param   {String}      gesture
   * @param   {Function}    handler
   * @returns {Hammer.Instance}
   */
  off: function offEvent(gesture, handler) {
    var gestures = gesture.split(' ');
    Hammer.utils.each(gestures, function(gesture) {
      this.element.removeEventListener(gesture, handler, false);
    }, this);
    return this;
  },


  /**
   * trigger gesture event
   * @param   {String}      gesture
   * @param   {Object}      [eventData]
   * @returns {Hammer.Instance}
   */
  trigger: function triggerEvent(gesture, eventData) {
    // optional
    if(!eventData) {
      eventData = {};
    }

    // create DOM event
    var event = Hammer.DOCUMENT.createEvent('Event');
    event.initEvent(gesture, true, true);
    event.gesture = eventData;

    // trigger on the target if it is in the instance element,
    // this is for event delegation tricks
    var element = this.element;
    if(Hammer.utils.hasParent(eventData.target, element)) {
      element = eventData.target;
    }

    element.dispatchEvent(event);
    return this;
  },


  /**
   * enable of disable hammer.js detection
   * @param   {Boolean}   state
   * @returns {Hammer.Instance}
   */
  enable: function enable(state) {
    this.enabled = state;
    return this;
  }
};


/**
 * this holds the last move event,
 * used to fix empty touchend issue
 * see the onTouch event for an explanation
 * @type {Object}
 */
var last_move_event = null;


/**
 * when the mouse is hold down, this is true
 * @type {Boolean}
 */
var enable_detect = false;


/**
 * when touch events have been fired, this is true
 * @type {Boolean}
 */
var touch_triggered = false;


Hammer.event = {
  /**
   * simple addEventListener
   * @param   {HTMLElement}   element
   * @param   {String}        type
   * @param   {Function}      handler
   */
  bindDom: function(element, type, handler) {
    var types = type.split(' ');
    Hammer.utils.each(types, function(type){
      element.addEventListener(type, handler, false);
    });
  },


  /**
   * touch events with mouse fallback
   * @param   {HTMLElement}   element
   * @param   {String}        eventType        like Hammer.EVENT_MOVE
   * @param   {Function}      handler
   */
  onTouch: function onTouch(element, eventType, handler) {
    var self = this;

    this.bindDom(element, Hammer.EVENT_TYPES[eventType], function bindDomOnTouch(ev) {
      var sourceEventType = ev.type.toLowerCase();

      // onmouseup, but when touchend has been fired we do nothing.
      // this is for touchdevices which also fire a mouseup on touchend
      if(sourceEventType.match(/mouse/) && touch_triggered) {
        return;
      }

      // mousebutton must be down or a touch event
      else if(sourceEventType.match(/touch/) ||   // touch events are always on screen
        sourceEventType.match(/pointerdown/) || // pointerevents touch
        (sourceEventType.match(/mouse/) && ev.which === 1)   // mouse is pressed
        ) {
        enable_detect = true;
      }

      // mouse isn't pressed
      else if(sourceEventType.match(/mouse/) && !ev.which) {
        enable_detect = false;
      }


      // we are in a touch event, set the touch triggered bool to true,
      // this for the conflicts that may occur on ios and android
      if(sourceEventType.match(/touch|pointer/)) {
        touch_triggered = true;
      }

      // count the total touches on the screen
      var count_touches = 0;

      // when touch has been triggered in this detection session
      // and we are now handling a mouse event, we stop that to prevent conflicts
      if(enable_detect) {
        // update pointerevent
        if(Hammer.HAS_POINTEREVENTS && eventType != Hammer.EVENT_END) {
          count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
        }
        // touch
        else if(sourceEventType.match(/touch/)) {
          count_touches = ev.touches.length;
        }
        // mouse
        else if(!touch_triggered) {
          count_touches = sourceEventType.match(/up/) ? 0 : 1;
        }

        // if we are in a end event, but when we remove one touch and
        // we still have enough, set eventType to move
        if(count_touches > 0 && eventType == Hammer.EVENT_END) {
          eventType = Hammer.EVENT_MOVE;
        }
        // no touches, force the end event
        else if(!count_touches) {
          eventType = Hammer.EVENT_END;
        }

        // store the last move event
        if(count_touches || last_move_event === null) {
          last_move_event = ev;
        }

        // trigger the handler
        handler.call(Hammer.detection, self.collectEventData(element, eventType, self.getTouchList(last_move_event, eventType), ev));

        // remove pointerevent from list
        if(Hammer.HAS_POINTEREVENTS && eventType == Hammer.EVENT_END) {
          count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
        }
      }

      // on the end we reset everything
      if(!count_touches) {
        last_move_event = null;
        enable_detect = false;
        touch_triggered = false;
        Hammer.PointerEvent.reset();
      }
    });
  },


  /**
   * we have different events for each device/browser
   * determine what we need and set them in the Hammer.EVENT_TYPES constant
   */
  determineEventTypes: function determineEventTypes() {
    // determine the eventtype we want to set
    var types;

    // pointerEvents magic
    if(Hammer.HAS_POINTEREVENTS) {
      types = Hammer.PointerEvent.getEvents();
    }
    // on Android, iOS, blackberry, windows mobile we dont want any mouseevents
    else if(Hammer.NO_MOUSEEVENTS) {
      types = [
        'touchstart',
        'touchmove',
        'touchend touchcancel'];
    }
    // for non pointer events browsers and mixed browsers,
    // like chrome on windows8 touch laptop
    else {
      types = [
        'touchstart mousedown',
        'touchmove mousemove',
        'touchend touchcancel mouseup'];
    }

    Hammer.EVENT_TYPES[Hammer.EVENT_START] = types[0];
    Hammer.EVENT_TYPES[Hammer.EVENT_MOVE] = types[1];
    Hammer.EVENT_TYPES[Hammer.EVENT_END] = types[2];
  },


  /**
   * create touchlist depending on the event
   * @param   {Object}    ev
   * @param   {String}    eventType   used by the fakemultitouch plugin
   */
  getTouchList: function getTouchList(ev/*, eventType*/) {
    // get the fake pointerEvent touchlist
    if(Hammer.HAS_POINTEREVENTS) {
      return Hammer.PointerEvent.getTouchList();
    }
    // get the touchlist
    else if(ev.touches) {
      return ev.touches;
    }
    // make fake touchlist from mouse position
    else {
      ev.identifier = 1;
      return [ev];
    }
  },


  /**
   * collect event data for Hammer js
   * @param   {HTMLElement}   element
   * @param   {String}        eventType        like Hammer.EVENT_MOVE
   * @param   {Object}        eventData
   */
  collectEventData: function collectEventData(element, eventType, touches, ev) {
    // find out pointerType
    var pointerType = Hammer.POINTER_TOUCH;
    if(ev.type.match(/mouse/) || Hammer.PointerEvent.matchType(Hammer.POINTER_MOUSE, ev)) {
      pointerType = Hammer.POINTER_MOUSE;
    }

    return {
      center     : Hammer.utils.getCenter(touches),
      timeStamp  : new Date().getTime(),
      target     : ev.target,
      touches    : touches,
      eventType  : eventType,
      pointerType: pointerType,
      srcEvent   : ev,

      /**
       * prevent the browser default actions
       * mostly used to disable scrolling of the browser
       */
      preventDefault: function() {
        if(this.srcEvent.preventManipulation) {
          this.srcEvent.preventManipulation();
        }

        if(this.srcEvent.preventDefault) {
          this.srcEvent.preventDefault();
        }
      },

      /**
       * stop bubbling the event up to its parents
       */
      stopPropagation: function() {
        this.srcEvent.stopPropagation();
      },

      /**
       * immediately stop gesture detection
       * might be useful after a swipe was detected
       * @return {*}
       */
      stopDetect: function() {
        return Hammer.detection.stopDetect();
      }
    };
  }
};

Hammer.PointerEvent = {
  /**
   * holds all pointers
   * @type {Object}
   */
  pointers: {},

  /**
   * get a list of pointers
   * @returns {Array}     touchlist
   */
  getTouchList: function() {
    var self = this;
    var touchlist = [];

    // we can use forEach since pointerEvents only is in IE10
    Hammer.utils.each(self.pointers, function(pointer){
      touchlist.push(pointer);
    });
    
    return touchlist;
  },

  /**
   * update the position of a pointer
   * @param   {String}   type             Hammer.EVENT_END
   * @param   {Object}   pointerEvent
   */
  updatePointer: function(type, pointerEvent) {
    if(type == Hammer.EVENT_END) {
      this.pointers = {};
    }
    else {
      pointerEvent.identifier = pointerEvent.pointerId;
      this.pointers[pointerEvent.pointerId] = pointerEvent;
    }

    return Object.keys(this.pointers).length;
  },

  /**
   * check if ev matches pointertype
   * @param   {String}        pointerType     Hammer.POINTER_MOUSE
   * @param   {PointerEvent}  ev
   */
  matchType: function(pointerType, ev) {
    if(!ev.pointerType) {
      return false;
    }

    var pt = ev.pointerType,
      types = {};
    types[Hammer.POINTER_MOUSE] = (pt === ev.MSPOINTER_TYPE_MOUSE || pt === Hammer.POINTER_MOUSE);
    types[Hammer.POINTER_TOUCH] = (pt === ev.MSPOINTER_TYPE_TOUCH || pt === Hammer.POINTER_TOUCH);
    types[Hammer.POINTER_PEN] = (pt === ev.MSPOINTER_TYPE_PEN || pt === Hammer.POINTER_PEN);
    return types[pointerType];
  },


  /**
   * get events
   */
  getEvents: function() {
    return [
      'pointerdown MSPointerDown',
      'pointermove MSPointerMove',
      'pointerup pointercancel MSPointerUp MSPointerCancel'
    ];
  },

  /**
   * reset the list
   */
  reset: function() {
    this.pointers = {};
  }
};


Hammer.detection = {
  // contains all registred Hammer.gestures in the correct order
  gestures: [],

  // data of the current Hammer.gesture detection session
  current : null,

  // the previous Hammer.gesture session data
  // is a full clone of the previous gesture.current object
  previous: null,

  // when this becomes true, no gestures are fired
  stopped : false,


  /**
   * start Hammer.gesture detection
   * @param   {Hammer.Instance}   inst
   * @param   {Object}            eventData
   */
  startDetect: function startDetect(inst, eventData) {
    // already busy with a Hammer.gesture detection on an element
    if(this.current) {
      return;
    }

    this.stopped = false;

    this.current = {
      inst      : inst, // reference to HammerInstance we're working for
      startEvent: Hammer.utils.extend({}, eventData), // start eventData for distances, timing etc
      lastEvent : false, // last eventData
      name      : '' // current gesture we're in/detected, can be 'tap', 'hold' etc
    };

    this.detect(eventData);
  },


  /**
   * Hammer.gesture detection
   * @param   {Object}    eventData
   */
  detect: function detect(eventData) {
    if(!this.current || this.stopped) {
      return;
    }

    // extend event data with calculations about scale, distance etc
    eventData = this.extendEventData(eventData);

    // instance options
    var inst_options = this.current.inst.options;

    // call Hammer.gesture handlers
    Hammer.utils.each(this.gestures, function(gesture) {
      // only when the instance options have enabled this gesture
      if(!this.stopped && inst_options[gesture.name] !== false) {
        // if a handler returns false, we stop with the detection
        if(gesture.handler.call(gesture, eventData, this.current.inst) === false) {
          this.stopDetect();
          return false;
        }
      }
    }, this);

    // store as previous event event
    if(this.current) {
      this.current.lastEvent = eventData;
    }

    // endevent, but not the last touch, so dont stop
    if(eventData.eventType == Hammer.EVENT_END && !eventData.touches.length - 1) {
      this.stopDetect();
    }

    return eventData;
  },


  /**
   * clear the Hammer.gesture vars
   * this is called on endDetect, but can also be used when a final Hammer.gesture has been detected
   * to stop other Hammer.gestures from being fired
   */
  stopDetect: function stopDetect() {
    // clone current data to the store as the previous gesture
    // used for the double tap gesture, since this is an other gesture detect session
    this.previous = Hammer.utils.extend({}, this.current);

    // reset the current
    this.current = null;

    // stopped!
    this.stopped = true;
  },


  /**
   * extend eventData for Hammer.gestures
   * @param   {Object}   ev
   * @returns {Object}   ev
   */
  extendEventData: function extendEventData(ev) {
    var startEv = this.current.startEvent;

    // if the touches change, set the new touches over the startEvent touches
    // this because touchevents don't have all the touches on touchstart, or the
    // user must place his fingers at the EXACT same time on the screen, which is not realistic
    // but, sometimes it happens that both fingers are touching at the EXACT same time
    if(startEv && (ev.touches.length != startEv.touches.length || ev.touches === startEv.touches)) {
      // extend 1 level deep to get the touchlist with the touch objects
      startEv.touches = [];
      Hammer.utils.each(ev.touches, function(touch) {
        startEv.touches.push(Hammer.utils.extend({}, touch));
      });
    }

    var delta_time = ev.timeStamp - startEv.timeStamp
      , delta_x = ev.center.pageX - startEv.center.pageX
      , delta_y = ev.center.pageY - startEv.center.pageY
      , velocity = Hammer.utils.getVelocity(delta_time, delta_x, delta_y)
      , interimAngle
      , interimDirection;

    // end events (e.g. dragend) don't have useful values for interimDirection & interimAngle
    // because the previous event has exactly the same coordinates
    // so for end events, take the previous values of interimDirection & interimAngle
    // instead of recalculating them and getting a spurious '0'
    if(ev.eventType === 'end') {
      interimAngle = this.current.lastEvent && this.current.lastEvent.interimAngle;
      interimDirection = this.current.lastEvent && this.current.lastEvent.interimDirection;
    }
    else {
      interimAngle = this.current.lastEvent && Hammer.utils.getAngle(this.current.lastEvent.center, ev.center);
      interimDirection = this.current.lastEvent && Hammer.utils.getDirection(this.current.lastEvent.center, ev.center);
    }

    Hammer.utils.extend(ev, {
      deltaTime: delta_time,

      deltaX: delta_x,
      deltaY: delta_y,

      velocityX: velocity.x,
      velocityY: velocity.y,

      distance: Hammer.utils.getDistance(startEv.center, ev.center),

      angle: Hammer.utils.getAngle(startEv.center, ev.center),
      interimAngle: interimAngle,

      direction: Hammer.utils.getDirection(startEv.center, ev.center),
      interimDirection: interimDirection,

      scale: Hammer.utils.getScale(startEv.touches, ev.touches),
      rotation: Hammer.utils.getRotation(startEv.touches, ev.touches),

      startEvent: startEv
    });

    return ev;
  },


  /**
   * register new gesture
   * @param   {Object}    gesture object, see gestures.js for documentation
   * @returns {Array}     gestures
   */
  register: function register(gesture) {
    // add an enable gesture options if there is no given
    var options = gesture.defaults || {};
    if(options[gesture.name] === undefined) {
      options[gesture.name] = true;
    }

    // extend Hammer default options with the Hammer.gesture options
    Hammer.utils.extend(Hammer.defaults, options, true);

    // set its index
    gesture.index = gesture.index || 1000;

    // add Hammer.gesture to the list
    this.gestures.push(gesture);

    // sort the list by index
    this.gestures.sort(function(a, b) {
      if(a.index < b.index) { return -1; }
      if(a.index > b.index) { return 1; }
      return 0;
    });

    return this.gestures;
  }
};


/**
 * Drag
 * Move with x fingers (default 1) around on the page. Blocking the scrolling when
 * moving left and right is a good practice. When all the drag events are blocking
 * you disable scrolling on that area.
 * @events  drag, drapleft, dragright, dragup, dragdown
 */
Hammer.gestures.Drag = {
  name     : 'drag',
  index    : 50,
  defaults : {
    drag_min_distance            : 10,
    
    // Set correct_for_drag_min_distance to true to make the starting point of the drag
    // be calculated from where the drag was triggered, not from where the touch started.
    // Useful to avoid a jerk-starting drag, which can make fine-adjustments
    // through dragging difficult, and be visually unappealing.
    correct_for_drag_min_distance: true,
    
    // set 0 for unlimited, but this can conflict with transform
    drag_max_touches             : 1,
    
    // prevent default browser behavior when dragging occurs
    // be careful with it, it makes the element a blocking element
    // when you are using the drag gesture, it is a good practice to set this true
    drag_block_horizontal        : false,
    drag_block_vertical          : false,
    
    // drag_lock_to_axis keeps the drag gesture on the axis that it started on,
    // It disallows vertical directions if the initial direction was horizontal, and vice versa.
    drag_lock_to_axis            : false,
    
    // drag lock only kicks in when distance > drag_lock_min_distance
    // This way, locking occurs only when the distance has become large enough to reliably determine the direction
    drag_lock_min_distance       : 25
  },
  
  triggered: false,
  handler  : function dragGesture(ev, inst) {
    // current gesture isnt drag, but dragged is true
    // this means an other gesture is busy. now call dragend
    if(Hammer.detection.current.name != this.name && this.triggered) {
      inst.trigger(this.name + 'end', ev);
      this.triggered = false;
      return;
    }

    // max touches
    if(inst.options.drag_max_touches > 0 &&
      ev.touches.length > inst.options.drag_max_touches) {
      return;
    }

    switch(ev.eventType) {
      case Hammer.EVENT_START:
        this.triggered = false;
        break;

      case Hammer.EVENT_MOVE:
        // when the distance we moved is too small we skip this gesture
        // or we can be already in dragging
        if(ev.distance < inst.options.drag_min_distance &&
          Hammer.detection.current.name != this.name) {
          return;
        }

        // we are dragging!
        if(Hammer.detection.current.name != this.name) {
          Hammer.detection.current.name = this.name;
          if(inst.options.correct_for_drag_min_distance && ev.distance > 0) {
            // When a drag is triggered, set the event center to drag_min_distance pixels from the original event center.
            // Without this correction, the dragged distance would jumpstart at drag_min_distance pixels instead of at 0.
            // It might be useful to save the original start point somewhere
            var factor = Math.abs(inst.options.drag_min_distance / ev.distance);
            Hammer.detection.current.startEvent.center.pageX += ev.deltaX * factor;
            Hammer.detection.current.startEvent.center.pageY += ev.deltaY * factor;

            // recalculate event data using new start point
            ev = Hammer.detection.extendEventData(ev);
          }
        }

        // lock drag to axis?
        if(Hammer.detection.current.lastEvent.drag_locked_to_axis || (inst.options.drag_lock_to_axis && inst.options.drag_lock_min_distance <= ev.distance)) {
          ev.drag_locked_to_axis = true;
        }
        var last_direction = Hammer.detection.current.lastEvent.direction;
        if(ev.drag_locked_to_axis && last_direction !== ev.direction) {
          // keep direction on the axis that the drag gesture started on
          if(Hammer.utils.isVertical(last_direction)) {
            ev.direction = (ev.deltaY < 0) ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
          }
          else {
            ev.direction = (ev.deltaX < 0) ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
          }
        }

        // first time, trigger dragstart event
        if(!this.triggered) {
          inst.trigger(this.name + 'start', ev);
          this.triggered = true;
        }

        // trigger normal event
        inst.trigger(this.name, ev);

        // direction event, like dragdown
        inst.trigger(this.name + ev.direction, ev);

        // block the browser events
        if((inst.options.drag_block_vertical && Hammer.utils.isVertical(ev.direction)) ||
          (inst.options.drag_block_horizontal && !Hammer.utils.isVertical(ev.direction))) {
          ev.preventDefault();
        }
        break;

      case Hammer.EVENT_END:
        // trigger dragend
        if(this.triggered) {
          inst.trigger(this.name + 'end', ev);
        }

        this.triggered = false;
        break;
    }
  }
};

/**
 * Hold
 * Touch stays at the same place for x time
 * @events  hold
 */
Hammer.gestures.Hold = {
  name    : 'hold',
  index   : 10,
  defaults: {
    hold_timeout  : 500,
    hold_threshold: 1
  },
  timer   : null,
  handler : function holdGesture(ev, inst) {
    switch(ev.eventType) {
      case Hammer.EVENT_START:
        // clear any running timers
        clearTimeout(this.timer);

        // set the gesture so we can check in the timeout if it still is
        Hammer.detection.current.name = this.name;

        // set timer and if after the timeout it still is hold,
        // we trigger the hold event
        this.timer = setTimeout(function() {
          if(Hammer.detection.current.name == 'hold') {
            inst.trigger('hold', ev);
          }
        }, inst.options.hold_timeout);
        break;

      // when you move or end we clear the timer
      case Hammer.EVENT_MOVE:
        if(ev.distance > inst.options.hold_threshold) {
          clearTimeout(this.timer);
        }
        break;

      case Hammer.EVENT_END:
        clearTimeout(this.timer);
        break;
    }
  }
};

/**
 * Release
 * Called as last, tells the user has released the screen
 * @events  release
 */
Hammer.gestures.Release = {
  name   : 'release',
  index  : Infinity,
  handler: function releaseGesture(ev, inst) {
    if(ev.eventType == Hammer.EVENT_END) {
      inst.trigger(this.name, ev);
    }
  }
};

/**
 * Swipe
 * triggers swipe events when the end velocity is above the threshold
 * @events  swipe, swipeleft, swiperight, swipeup, swipedown
 */
Hammer.gestures.Swipe = {
  name    : 'swipe',
  index   : 40,
  defaults: {
    // set 0 for unlimited, but this can conflict with transform
    swipe_min_touches: 1,
    swipe_max_touches: 1,
    swipe_velocity   : 0.7
  },
  handler : function swipeGesture(ev, inst) {
    if(ev.eventType == Hammer.EVENT_END) {
      // max touches
      if(inst.options.swipe_max_touches > 0 &&
        ev.touches.length < inst.options.swipe_min_touches &&
        ev.touches.length > inst.options.swipe_max_touches) {
        return;
      }

      // when the distance we moved is too small we skip this gesture
      // or we can be already in dragging
      if(ev.velocityX > inst.options.swipe_velocity ||
        ev.velocityY > inst.options.swipe_velocity) {
        // trigger swipe events
        inst.trigger(this.name, ev);
        inst.trigger(this.name + ev.direction, ev);
      }
    }
  }
};

/**
 * Tap/DoubleTap
 * Quick touch at a place or double at the same place
 * @events  tap, doubletap
 */
Hammer.gestures.Tap = {
  name    : 'tap',
  index   : 100,
  defaults: {
    tap_max_touchtime : 250,
    tap_max_distance  : 10,
    tap_always        : true,
    doubletap_distance: 20,
    doubletap_interval: 300
  },
  handler : function tapGesture(ev, inst) {
    if(ev.eventType == Hammer.EVENT_END && ev.srcEvent.type != 'touchcancel') {
      // previous gesture, for the double tap since these are two different gesture detections
      var prev = Hammer.detection.previous,
        did_doubletap = false;

      // when the touchtime is higher then the max touch time
      // or when the moving distance is too much
      if(ev.deltaTime > inst.options.tap_max_touchtime ||
        ev.distance > inst.options.tap_max_distance) {
        return;
      }

      // check if double tap
      if(prev && prev.name == 'tap' &&
        (ev.timeStamp - prev.lastEvent.timeStamp) < inst.options.doubletap_interval &&
        ev.distance < inst.options.doubletap_distance) {
        inst.trigger('doubletap', ev);
        did_doubletap = true;
      }

      // do a single tap
      if(!did_doubletap || inst.options.tap_always) {
        Hammer.detection.current.name = 'tap';
        inst.trigger(Hammer.detection.current.name, ev);
      }
    }
  }
};

/**
 * Touch
 * Called as first, tells the user has touched the screen
 * @events  touch
 */
Hammer.gestures.Touch = {
  name    : 'touch',
  index   : -Infinity,
  defaults: {
    // call preventDefault at touchstart, and makes the element blocking by
    // disabling the scrolling of the page, but it improves gestures like
    // transforming and dragging.
    // be careful with using this, it can be very annoying for users to be stuck
    // on the page
    prevent_default    : false,

    // disable mouse events, so only touch (or pen!) input triggers events
    prevent_mouseevents: false
  },
  handler : function touchGesture(ev, inst) {
    if(inst.options.prevent_mouseevents && ev.pointerType == Hammer.POINTER_MOUSE) {
      ev.stopDetect();
      return;
    }

    if(inst.options.prevent_default) {
      ev.preventDefault();
    }

    if(ev.eventType == Hammer.EVENT_START) {
      inst.trigger(this.name, ev);
    }
  }
};

/**
 * Transform
 * User want to scale or rotate with 2 fingers
 * @events  transform, pinch, pinchin, pinchout, rotate
 */
Hammer.gestures.Transform = {
  name     : 'transform',
  index    : 45,
  defaults : {
    // factor, no scale is 1, zoomin is to 0 and zoomout until higher then 1
    transform_min_scale   : 0.01,
    // rotation in degrees
    transform_min_rotation: 1,
    // prevent default browser behavior when two touches are on the screen
    // but it makes the element a blocking element
    // when you are using the transform gesture, it is a good practice to set this true
    transform_always_block: false
  },
  triggered: false,
  handler  : function transformGesture(ev, inst) {
    // current gesture isnt drag, but dragged is true
    // this means an other gesture is busy. now call dragend
    if(Hammer.detection.current.name != this.name && this.triggered) {
      inst.trigger(this.name + 'end', ev);
      this.triggered = false;
      return;
    }

    // atleast multitouch
    if(ev.touches.length < 2) {
      return;
    }

    // prevent default when two fingers are on the screen
    if(inst.options.transform_always_block) {
      ev.preventDefault();
    }

    switch(ev.eventType) {
      case Hammer.EVENT_START:
        this.triggered = false;
        break;

      case Hammer.EVENT_MOVE:
        var scale_threshold = Math.abs(1 - ev.scale);
        var rotation_threshold = Math.abs(ev.rotation);

        // when the distance we moved is too small we skip this gesture
        // or we can be already in dragging
        if(scale_threshold < inst.options.transform_min_scale &&
          rotation_threshold < inst.options.transform_min_rotation) {
          return;
        }

        // we are transforming!
        Hammer.detection.current.name = this.name;

        // first time, trigger dragstart event
        if(!this.triggered) {
          inst.trigger(this.name + 'start', ev);
          this.triggered = true;
        }

        inst.trigger(this.name, ev); // basic transform event

        // trigger rotate event
        if(rotation_threshold > inst.options.transform_min_rotation) {
          inst.trigger('rotate', ev);
        }

        // trigger pinch event
        if(scale_threshold > inst.options.transform_min_scale) {
          inst.trigger('pinch', ev);
          inst.trigger('pinch' + ((ev.scale < 1) ? 'in' : 'out'), ev);
        }
        break;

      case Hammer.EVENT_END:
        // trigger dragend
        if(this.triggered) {
          inst.trigger(this.name + 'end', ev);
        }

        this.triggered = false;
        break;
    }
  }
};

  // Based off Lo-Dash's excellent UMD wrapper (slightly modified) - https://github.com/bestiejs/lodash/blob/master/lodash.js#L5515-L5543
  // some AMD build optimizers, like r.js, check for specific condition patterns like the following:
  if(typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // define as an anonymous module
    define(function() {
      return Hammer;
    });
    // check for `exports` after `define` in case a build optimizer adds an `exports` object
  }
  else if(typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = Hammer;
  }
  else {
    window.Hammer = Hammer;
  }
})(this);// Generated by CoffeeScript 1.7.1

/*
 * vivi.js v0.1.0
 * (c) 2014 ktty1220
 * License: MIT
 */


/* Function.bindを実装していない環境用 */

(function() {
  var Core, Section, ViVi, _base,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  if ((_base = Function.prototype).bind == null) {
    _base.bind = function() {
      var func, i, len, newargary, t, _i;
      func = this;
      t = arguments[0];
      len = arguments.length;
      newargary = [];
      for (i = _i = 1; 1 <= len ? _i < len : _i > len; i = 1 <= len ? ++_i : --_i) {
        newargary.push(arguments[i]);
      }
      return function() {
        return func.apply(t, newargary);
      };
    };
  }


  /* 共通クラス */

  ViVi = (function() {
    function ViVi() {
      this.fireEvent = __bind(this.fireEvent, this);
      this.toggleClass = __bind(this.toggleClass, this);
      this.removeClass = __bind(this.removeClass, this);
      this.addClass = __bind(this.addClass, this);
      this.hasClass = __bind(this.hasClass, this);
      this.each = __bind(this.each, this);
      this.find = __bind(this.find, this);
      this._bodySize = __bind(this._bodySize, this);
      this._setTranslate3d = __bind(this._setTranslate3d, this);
      this._parentUntil = __bind(this._parentUntil, this);
    }

    ViVi.prototype.event = {};

    ViVi.prototype._elBody = null;

    ViVi.prototype._evTransition = ['oTransitionEnd', 'mozTransitionEnd', 'webkitTransitionEnd', 'transitionend'];

    ViVi.prototype._parentUntil = function(el, target) {
      var re, type, _ref;
      switch (true) {
        case /^[a-z][a-z0-9]*$/i.test(target):
          type = 'tagName';
          target = "^" + target + "$";
          break;
        case /^\./.test(target):
          type = 'className';
          target = "\\b" + (target.substr(1)) + "\\b";
          break;
        case /^#/.test(target):
          type = 'id';
          target = "^" + (target.substr(1)) + "$";
          break;
        default:
          return null;
      }
      re = new RegExp(target, 'i');
      while ((el != null) && !re.test((_ref = el[type]) != null ? _ref : '')) {
        el = el.parentNode;
      }
      return el;
    };

    ViVi.prototype._setTranslate3d = function(el, x, y) {
      var translate3d;
      if (y == null) {
        y = 0;
      }
      translate3d = "translate3D(" + x + "px, " + y + "px, 0)";
      el.style.WebkitTransform = translate3d;
      return el.style.transform = translate3d;
    };

    ViVi.prototype._bodySize = function() {
      if (this._elBody == null) {
        this._elBody = document.querySelector('body');
      }
      return {
        height: this._elBody.offsetHeight,
        width: this._elBody.offsetWidth
      };
    };

    ViVi.prototype.find = function(selector, from) {
      if (from == null) {
        from = this.el;
      }
      if (/^\.[\w-]+$/.test(selector)) {
        return from.getElementsByClassName(selector.substr(1));
      }
      if (/^[a-z0-9]+$/i.test(selector)) {
        return from.getElementsByTagName(selector);
      }
      return from.querySelectorAll(selector);
    };

    ViVi.prototype.each = function(selector, from, func) {
      var el, elems, i, _i, _len, _ref, _results;
      if (from instanceof Function) {
        func = from;
        from = null;
      }
      elems = this.find(selector, from);
      if (elems.length === 0) {
        return;
      }
      _ref = Array.prototype.slice.call(elems);
      _results = [];
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        el = _ref[i];
        _results.push(func(el, i));
      }
      return _results;
    };

    ViVi.prototype.hasClass = function(el, className) {
      return new RegExp("(^| )" + className + "( |$)", 'gi').test(el.className);
    };

    ViVi.prototype.addClass = function(el, className) {
      if (!this.hasClass(el, className)) {
        return el.className = ("" + el.className + " " + className).trim();
      }
    };

    ViVi.prototype.removeClass = function(el, className) {
      var re;
      re = new RegExp("(^|\\b)" + (className.split(' ').join('|')) + "(\\b|$)", 'gi');
      return el.className = el.className.replace(re, ' ').trim();
    };

    ViVi.prototype.toggleClass = function(el, className) {
      if (this.hasClass(el, className)) {
        return this.removeClass(el, className);
      } else {
        return this.addClass(el, className);
      }
    };

    ViVi.prototype.fireEvent = function(eventName, el) {
      var event;
      if (el == null) {
        el = document;
      }
      event = document.createEvent('HTMLEvents');
      event.initEvent(eventName, true, false);
      return el.dispatchEvent(event);
    };

    return ViVi;

  })();


  /* Hammer.jsイベント登録 */

  ViVi.prototype._hammerOpt = {
    swipe_velocity: 0.25,
    hold_timeout: 500
  };

  ['hold', 'tap', 'doubletap', 'drag', 'dragstart', 'dragend', 'dragup', 'dragdown', 'dragleft', 'dragright', 'swipe', 'swipeup', 'swipedown', 'swipeleft', 'swiperight', 'transform', 'transformstart', 'transformend', 'rotate', 'pinch', 'pinchin', 'pinchout', 'touch', 'release'].forEach((function(_this) {
    return function(e) {
      return ViVi.prototype.event[e] = function(elems, func) {
        if (elems.length === 0) {
          return;
        }
        if (typeof elems === 'string') {
          elems = document.querySelectorAll(elems);
        }
        if (!(elems.length > 0)) {
          elems = [elems];
        }
        return Array.prototype.forEach.call(elems, function(el, i) {
          return Hammer(el, ViVi.prototype._hammerOpt).on(e, function(ev) {
            func.call(ev.target, ev);
            return ev.preventDefault();
          });
        });
      };
    };
  })(this));


  /* <section>管理クラス */

  Section = (function(_super) {
    __extends(Section, _super);

    function Section(el) {
      this.el = el;
      this.changeTab = __bind(this.changeTab, this);
      this._createScroller = __bind(this._createScroller, this);
      this._onPageDrag = __bind(this._onPageDrag, this);
      this._onPageDragInit = __bind(this._onPageDragInit, this);
      this._currentTransform = __bind(this._currentTransform, this);
      this.onResize = __bind(this.onResize, this);
      this._createCheckBox = __bind(this._createCheckBox, this);
      this._delayTapSwipe = __bind(this._delayTapSwipe, this);
      this._delayTapHold = __bind(this._delayTapHold, this);
      this._delayTapDrag = __bind(this._delayTapDrag, this);
      this._delayTapEnd = __bind(this._delayTapEnd, this);
      this._delayTapStart = __bind(this._delayTapStart, this);
      this._tapEvent = __bind(this._tapEvent, this);
      this._navEvent = __bind(this._navEvent, this);
      this._onTabChanged = __bind(this._onTabChanged, this);
      this._doTabChange = __bind(this._doTabChange, this);
      this._currentTabIndex = __bind(this._currentTabIndex, this);
      this._hash2id = __bind(this._hash2id, this);
      this._setScroller = __bind(this._setScroller, this);
      this._setTranslate3d(this.el, 0);
      this._tabs = [];
      this._elTabLinks = this.find('nav li a');
      if (this._elTabLinks.length > 0) {
        this.addClass(this.find('nav li')[0], 'active');
      }
      this.each('article', (function(_this) {
        return function(el, i) {
          return _this._tabs.push(el.id);
        };
      })(this));
      this._setScroller();
      this._createCheckBox();
      this._tapEvent();
      this._navEvent();
    }

    Section.prototype._setScroller = function() {
      this.each('article', (function(_this) {
        return function(el, i) {
          var contents, footer, m, wrapper;
          contents = el.innerHTML;
          wrapper = 'vv-wrapper';
          footer = '';
          m = el.innerHTML.match(/^([\s\S]+)(<footer>[\s\S]+)$/i);
          if (m) {
            wrapper += ' vv-has-footer';
            contents = m[1];
            footer = m[2];
          }
          el.innerHTML = "<div class=\"" + wrapper + "\">\n  <div class=\"article-contents\">\n    " + contents + "\n  </div>\n</div>\n" + footer;
          return el.style.visibility = 'visible';
        };
      })(this));
      return this._createScroller();
    };

    Section.prototype._hash2id = function(el) {
      return el.getAttribute('href').substr(1);
    };

    Section.prototype._currentTabIndex = function() {
      if (this._tabs.length < 2) {
        return 0;
      }
      return this._tabs.indexOf(this._hash2id(this.find('nav li.active a').item(0)));
    };

    Section.prototype._doTabChange = function(elTab, onResize) {
      var bodyWidth, curPos, elPage, gotoIndex, toPos;
      if (this._elTabLinks.length === 0) {
        return;
      }
      elTab = this._parentUntil(elTab, 'a');
      elPage = this.find('.vv-page').item(0);
      gotoIndex = this._tabs.indexOf(this._hash2id(elTab));
      if (this._currentTabIndex() === 0 && gotoIndex === 0) {
        return this._onTabChanged(elPage);
      }
      bodyWidth = this._bodySize().width;
      toPos = bodyWidth * -1 * gotoIndex;
      curPos = this._currentTransform(elPage).x;
      if (toPos === curPos) {
        return;
      }
      if (!onResize) {
        this.addClass(elTab, 'touch');
      }
      this._setTranslate3d(elPage, toPos);
      this.each('nav li', (function(_this) {
        return function(el, i) {
          return _this.removeClass(el, 'active');
        };
      })(this));
      return this.addClass(elTab.parentNode, 'active');
    };

    Section.prototype._onTabChanged = function(elt) {
      return this.each('nav li a', (function(_this) {
        return function(el, i) {
          return _this.removeClass(el, 'touch');
        };
      })(this));
    };

    Section.prototype._navEvent = function() {
      var trEnd, _i, _len, _ref, _results;
      this.event.tap(this._elTabLinks, (function(_this) {
        return function(ev) {
          return _this._doTabChange(ev.target);
        };
      })(this));
      this.event.swipeleft(this.find('article'), (function(_this) {
        return function(ev) {
          var pageIndex;
          if (ev.cancelBubble) {
            return;
          }
          pageIndex = _this._currentTabIndex();
          if (pageIndex < _this._elTabLinks.length - 1) {
            return _this._doTabChange(_this._elTabLinks.item(pageIndex + 1));
          }
        };
      })(this));
      this.event.swiperight(this.find('article'), (function(_this) {
        return function(ev) {
          var pageIndex;
          if (ev.cancelBubble) {
            return;
          }
          pageIndex = _this._currentTabIndex();
          if (pageIndex > 0) {
            return _this._doTabChange(_this._elTabLinks.item(pageIndex - 1));
          }
        };
      })(this));
      _ref = this._evTransition;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        trEnd = _ref[_i];
        _results.push(this.each('.vv-page', (function(_this) {
          return function(el, i) {
            return el.addEventListener(trEnd, function(ev) {
              return _this._onTabChanged(ev.target);
            });
          };
        })(this)));
      }
      return _results;
    };

    Section.prototype._tapEvent = function() {
      var el, _i, _j, _len, _len1, _ref, _ref1, _results;
      this._delayTapState = {};
      _ref = this.find('.article-contents .list');
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        el = _ref[_i];
        el.addEventListener('touch', this._delayTapStart);
        el.addEventListener('dragstart', this._delayTapDrag);
        el.addEventListener('hold', this._delayTapHold);
        el.addEventListener('swipe', this._delayTapSwipe);
      }
      _ref1 = this.find('.vv-wrapper');
      _results = [];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        el = _ref1[_j];
        _results.push(el.addEventListener('release', this._delayTapEnd));
      }
      return _results;
    };

    Section.prototype._delayTapStart = function(ev) {
      var el;
      el = this._parentUntil(ev.target, 'li');
      return this._delayTapState = {
        el: el,
        swipe: false,
        hold: false,
        timer: setTimeout((function(_this) {
          return function() {
            if (_this._delayTapState.el != null) {
              return _this.addClass(_this._delayTapState.el, 'touch');
            }
          };
        })(this), 80)
      };
    };

    Section.prototype._delayTapEnd = function(ev) {
      var el, hold, swipe, _ref;
      _ref = this._delayTapState, el = _ref.el, swipe = _ref.swipe, hold = _ref.hold;
      if (el == null) {
        return;
      }
      return setTimeout((function(_this) {
        return function() {
          var elCheckbox, isTapDistance;
          _this.removeClass(el, 'touch');
          if (swipe) {
            return;
          }
          isTapDistance = /(right|left)/.test(ev.gesture.direction) ? 30 : 5;
          if (ev.gesture.distance < isTapDistance) {
            elCheckbox = _this.find('.vv-checkbox', el);
            if (elCheckbox.length > 0) {
              _this.toggleClass(elCheckbox[0], 'checked');
              return _this.fireEvent('delaytap', el);
            } else if (!hold || !_this.hasClass(el, 'vv-hold-event')) {
              return _this.fireEvent('delaytap', el);
            }
          }
        };
      })(this), 160);
    };

    Section.prototype._delayTapDrag = function(ev) {
      return clearTimeout(this._delayTapState.timer);
    };

    Section.prototype._delayTapHold = function(ev) {
      return this._delayTapState.hold = true;
    };

    Section.prototype._delayTapSwipe = function(ev) {
      return this._delayTapState.swipe = true;
    };

    Section.prototype._createCheckBox = function() {
      var checkbox;
      checkbox = '<div class="vv-checkbox"></div>';
      return this.each('.vv-page .list-item-checkbox', (function(_this) {
        return function(el, i) {
          var children;
          children = el.children;
          if (children.length === 0) {
            return el.append(checkbox);
          } else {
            return el.children[0].insertAdjacentHTML('beforebegin', checkbox);
          }
        };
      })(this));
    };

    Section.prototype.onResize = function() {
      if (this._elTabLinks.length > 0) {
        this._doTabChange(this._elTabLinks.item(this._currentTabIndex()), true);
      }
      if (!this.hasClass(this.el, 'active') && this.el.id !== 'vv-main') {
        this.addClass(this.el, 'bgset');
        this._setTranslate3d(this.el, this._bodySize().width);
        return this.removeClass(this.el, 'bgset');
      }
    };

    Section.prototype._currentTransform = function(el) {
      var m, x, y, z, _ref, _ref1;
      m = ((_ref = el.style.WebkitTransform) != null ? _ref : '').match(/translate3d\s*\((.*?)\)/i);
      if (!m) {
        return {
          x: 0,
          y: 0,
          z: 0
        };
      }
      _ref1 = m[1].split(/\s*,\s*/).map(function(v, i, a) {
        return Number(v.replace(/[^\d\.\-]/g, ''));
      }), x = _ref1[0], y = _ref1[1], z = _ref1[2];
      return {
        x: x,
        y: y,
        z: z
      };
    };

    Section.prototype._onPageDragInit = function(ev) {
      var el, elWrapper;
      if (this.hasClass(ev.target, 'vv-wrapper')) {
        el = this.find('.article-contents', ev.target)[0];
        elWrapper = ev.target;
      } else {
        el = this._parentUntil(ev.target, '.article-contents');
        elWrapper = this.find('.vv-wrapper')[0];
      }
      return this._dragState = {
        scrollRange: elWrapper.offsetHeight,
        el: el,
        elWrapper: elWrapper,
        pos: this._currentTransform(el).y,
        deltaHistory: []
      };
    };

    Section.prototype._onPageDrag = function(ev) {
      var altVelocity, b, deltaHistory, deltaTime, deltaY, direction, duration, el, elWrapper, maxBottom, pos, scrollRange, tr, velocityY, y, _i, _len, _ref, _ref1, _ref2;
      _ref = this._dragState, pos = _ref.pos, el = _ref.el, elWrapper = _ref.elWrapper, scrollRange = _ref.scrollRange, deltaHistory = _ref.deltaHistory;
      _ref1 = ev.gesture, deltaY = _ref1.deltaY, velocityY = _ref1.velocityY, deltaTime = _ref1.deltaTime, direction = _ref1.direction;
      if (direction === 'left' || direction === 'right') {
        return;
      }
      y = pos + deltaY;
      if (ev.type === 'dragend') {
        scrollRange *= velocityY;
        _ref2 = [0.2, 0.4, 0.6, 0.8];
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          b = _ref2[_i];
          if (velocityY < b) {
            scrollRange *= b / 2 + 0.5;
          }
        }
        scrollRange *= Math.abs(deltaY) * 2 / elWrapper.offsetHeight;
        deltaHistory.pop();
        altVelocity = Math.abs(deltaY) - Math.abs(deltaHistory.pop());
        if (altVelocity <= 1) {
          scrollRange = 0;
        }
        if (altVelocity > 10) {
          scrollRange *= 2;
        }
        if (direction === 'up') {
          scrollRange *= 1.3;
        }
        duration = 400;
      } else {
        this._dragState.deltaHistory.push(deltaY);
        if (deltaTime < 100 && velocityY > 0.05) {
          scrollRange = deltaY;
          if (direction === 'down') {
            scrollRange *= -1;
          }
          duration = 100;
        } else {
          scrollRange = 0;
          duration = 0;
        }
      }
      tr = duration > 0 ? "all " + duration + "ms ease-out" : 'none';
      el.style.transition = tr;
      el.style.WebkitTransition = tr;
      maxBottom = (el.offsetHeight - elWrapper.offsetHeight) * -1;
      switch (direction) {
        case 'up':
          y = Math.max(y - scrollRange, maxBottom);
          break;
        case 'down':
          y += scrollRange;
      }
      if (y > 0) {
        y = 0;
      }
      return this._setTranslate3d(el, 0, y);
    };

    Section.prototype._createScroller = function() {
      var el, _i, _len, _ref, _results;
      _ref = this.find('article .vv-wrapper');
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        el = _ref[_i];
        el.addEventListener('dragstart', this._onPageDragInit, true);
        el.addEventListener('dragend', this._onPageDrag, true);
        el.addEventListener('dragup', this._onPageDrag, true);
        _results.push(el.addEventListener('dragdown', this._onPageDrag, true));
      }
      return _results;
    };

    Section.prototype.changeTab = function(id) {
      if (this._elTabLinks.length > 0) {
        return this._doTabChange(this._elTabLinks.item(this._tabs.indexOf(id)));
      }
    };

    return Section;

  })(ViVi);


  /* ViVi本体 */

  Core = (function(_super) {
    __extends(Core, _super);

    function Core() {
      this.changeSection = __bind(this.changeSection, this);
      this.changeTab = __bind(this.changeTab, this);
      this._tapEvent = __bind(this._tapEvent, this);
      this._sectionEvent = __bind(this._sectionEvent, this);
      this.closeSection = __bind(this.closeSection, this);
      this._doSectionChange = __bind(this._doSectionChange, this);
      this._onSectionChanged = __bind(this._onSectionChanged, this);
      this._navEvent = __bind(this._navEvent, this);
      this._onResize = __bind(this._onResize, this);
      this.ready = __bind(this.ready, this);
      var func, name, _fn, _ref;
      this.el = document;
      this.section = {};
      this.cordova = {
        onPause: (function(_this) {
          return function() {};
        })(this),
        onResume: (function(_this) {
          return function() {};
        })(this),
        onOnline: (function(_this) {
          return function() {};
        })(this),
        onOffline: (function(_this) {
          return function() {};
        })(this),
        onBackButton: (function(_this) {
          return function() {
            return _this.closeSection();
          };
        })(this),
        onMenuButton: (function(_this) {
          return function() {};
        })(this),
        onOptionSelect: (function(_this) {
          return function(e) {};
        })(this),
        onSearchButton: (function(_this) {
          return function() {};
        })(this),
        onStartcallButton: (function(_this) {
          return function() {};
        })(this),
        onEndcallButton: (function(_this) {
          return function() {};
        })(this),
        onVolumeDownButton: (function(_this) {
          return function() {};
        })(this),
        onVolumeUpButton: (function(_this) {
          return function() {};
        })(this),
        onBatteryCritical: (function(_this) {
          return function(info) {};
        })(this),
        onBatteryLow: (function(_this) {
          return function(info) {};
        })(this),
        onBatteryStatus: (function(_this) {
          return function(info) {};
        })(this)
      };

      /* Cordovaイベント登録 */
      _ref = this.cordova;
      _fn = (function(_this) {
        return function(name) {
          var target;
          target = /battery/i.test(name) ? window : document;
          return target.addEventListener(name.substr(2).toLowerCase(), function(ev) {
            return _this.cordova[name](ev);
          }, false);
        };
      })(this);
      for (name in _ref) {
        func = _ref[name];
        if (!/^on/.test(name)) {
          continue;
        }
        _fn(name);
      }
      this.initialize = (function(_this) {
        return function(cb) {
          return cb();
        };
      })(this);
      this.finalize = (function(_this) {
        return function(cb) {
          return cb();
        };
      })(this);
    }

    Core.prototype.ready = function(wait, cb) {
      var trigger;
      if (wait instanceof Function) {
        cb = wait;
        wait = 10;
      }
      trigger = /(android|ios)/i.test(navigator.userAgent) ? 'deviceready' : 'DOMContentLoaded';
      return document.addEventListener(trigger, (function(_this) {
        return function() {
          return _this.initialize(function() {
            _this.each('body>section', function(el, i) {
              return _this.section[el.id] = new Section(el);
            });
            _this.addClass(_this.section['vv-main'].el, 'active');
            window.addEventListener('resize', _this._onResize);
            _this._onResize();
            _this._tapEvent();
            _this._navEvent();
            _this._sectionEvent();
            return setTimeout((function() {
              return cb.apply(window);
            }), wait);
          });
        };
      })(this));
    };

    Core.prototype._onResize = function() {
      var bodyHeight, elBody, id, sec, _ref, _results;
      elBody = this._bodySize();
      bodyHeight = "" + elBody.height + "px";
      this.each('article', (function(_this) {
        return function(el, i) {
          return el.style.minHeight = bodyHeight;
        };
      })(this));
      _ref = this.section;
      _results = [];
      for (id in _ref) {
        sec = _ref[id];
        _results.push(sec.onResize());
      }
      return _results;
    };

    Core.prototype._navEvent = function() {
      var trEnd, _i, _len, _ref, _results;
      _ref = this._evTransition;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        trEnd = _ref[_i];
        _results.push(this.each('body>section', (function(_this) {
          return function(el, i) {
            return el.addEventListener(trEnd, function(ev) {
              var elt;
              if (!/transform/.test(ev.propertyName)) {
                return;
              }
              elt = ev.target;
              if (_this.hasClass(elt, 'standby')) {
                return _this._onSectionChanged(elt);
              }
            });
          };
        })(this)));
      }
      return _results;
    };

    Core.prototype._onSectionChanged = function(elt) {
      this.removeClass(elt, 'standby');
      if (this.hasClass(elt, 'back')) {
        this.removeClass(elt, 'back');
        return this.fireEvent('sectionbackground', elt);
      } else {
        this.each('body>section', (function(_this) {
          return function(el, i) {
            if (_this.hasClass(el, 'background')) {
              return _this.removeClass(el, 'background');
            } else if (_this.hasClass(el, 'active')) {
              _this.removeClass(el, 'active');
              return _this.addClass(el, 'background');
            }
          };
        })(this));
        this.addClass(elt, 'active');
        return this.fireEvent('sectionactive', this.find('body>section.active')[0]);
      }
    };

    Core.prototype._doSectionChange = function(elSection) {
      this.addClass(elSection, 'standby');
      return (function(_this) {
        return function(elSection) {
          return setTimeout((function() {
            return _this._setTranslate3d(elSection, 0);
          }), 10);
        };
      })(this)(elSection);
    };

    Core.prototype.closeSection = function() {
      var bg, currentSection, mainSection;
      currentSection = this.find('body>section.active').item(0);
      if (currentSection.id === 'vv-main') {
        mainSection = this.section['vv-main'];
        if (mainSection._currentTabIndex() === 0) {
          this.finalize((function(_this) {
            return function() {
              var _ref;
              return (_ref = window.navigator.app) != null ? typeof _ref.exitApp === "function" ? _ref.exitApp() : void 0 : void 0;
            };
          })(this));
          return;
        }
        return mainSection.changeTab(mainSection._tabs[0]);
      }
      this.removeClass(currentSection, 'active');
      this.addClass(currentSection, 'standby back');
      bg = this.find('body>section.background');
      if (bg.length > 0) {
        this.removeClass(bg[0], 'background');
        this.addClass(bg[0], 'active');
      } else {
        this.addClass(this.find('#vv-main').item(0), 'active');
      }
      return (function(_this) {
        return function(currentSection) {
          return setTimeout((function() {
            return _this._setTranslate3d(currentSection, _this._bodySize().width);
          }), 10);
        };
      })(this)(currentSection);
    };

    Core.prototype._sectionEvent = function() {
      return this.event.tap(this.find('header .vv-back'), (function(_this) {
        return function(ev) {
          return _this.closeSection();
        };
      })(this));
    };

    Core.prototype._tapEvent = function() {
      var _preventDefault;
      _preventDefault = (function(_this) {
        return function(ev) {
          return ev.preventDefault();
        };
      })(this);
      this.el.addEventListener('touchmove', _preventDefault, false);
      this.el.addEventListener('click', _preventDefault, false);
      this.event.touch(this.find('a'), (function(_this) {
        return function(ev) {
          return _this.addClass(_this._parentUntil(ev.target, 'a'), 'touch');
        };
      })(this));
      return this.event.release(this.find('a'), (function(_this) {
        return function(ev) {
          return _this.removeClass(_this._parentUntil(ev.target, 'a'), 'touch');
        };
      })(this));
    };

    Core.prototype.changeTab = function(tabId) {
      return this.section[this.find('body>section.active').item(0).id].changeTab(tabId);
    };

    Core.prototype.changeSection = function(sectionId) {
      return this._doSectionChange(this.find("#" + sectionId).item(0));
    };

    return Core;

  })(ViVi);

  window.VV = new Core();

}).call(this);
