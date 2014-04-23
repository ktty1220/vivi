###
# vivi.js v0.1.0
# (c) 2014 ktty1220
# License: MIT
###

### Function.bindを実装していない環境用 ###
# http://d.hatena.ne.jp/kkotaro0111/20120819/1345361487
Function::bind ?= () ->
  func = this
  t = arguments[0]
  len = arguments.length
  newargary = []
  newargary.push arguments[i] for i in [1...len]
  () -> func.apply t, newargary

### 共通クラス ###
class ViVi
  event: {}
  _elBody: null
  _evTransition: [ 'oTransitionEnd', 'mozTransitionEnd', 'webkitTransitionEnd', 'transitionend' ]

  _parentUntil: (el, target) =>
    switch true
      when /^[a-z][a-z0-9]*$/i.test target
        type = 'tagName'
        target = "^#{target}$"
      when /^\./.test target
        type = 'className'
        target = "\\b#{target.substr 1}\\b"
      when /^#/.test target
        type = 'id'
        target = "^#{target.substr 1}$"
      else
        return null
    re = new RegExp target, 'i'
    el = el.parentNode while el? and not re.test(el[type] ? '')
    el

  _setTranslate3d: (el, x, y = 0) =>
    translate3d = "translate3D(#{x}px, #{y}px, 0)"
    el.style.WebkitTransform = translate3d
    el.style.transform = translate3d

  _bodySize: () =>
    @_elBody ?= document.querySelector 'body'
    height: @_elBody.offsetHeight
    width: @_elBody.offsetWidth

  find: (selector, from = @el) =>
    #return from.querySelector selector if /^#[\w-]+$/.test selector
    return from.getElementsByClassName selector.substr(1) if /^\.[\w-]+$/.test selector
    return from.getElementsByTagName selector if /^[a-z0-9]+$/i.test selector
    return from.querySelectorAll selector

  each: (selector, from, func) =>
    if from instanceof Function
      func = from
      from = null
    elems = @find selector, from
    return if elems.length is 0
    #elems = [ elems ] unless elems.length > 0
    func el, i for el, i in Array::slice.call elems

  hasClass: (el, className) =>
    new RegExp("(^| )#{className}( |$)", 'gi').test el.className

  addClass: (el, className) =>
    el.className = "#{el.className} #{className}".trim() unless @hasClass el, className

  removeClass: (el, className) =>
    re = new RegExp "(^|\\b)#{className.split(' ').join('|')}(\\b|$)", 'gi'
    el.className = el.className.replace(re, ' ').trim()

  toggleClass: (el, className) =>
    if @hasClass el, className then @removeClass el, className else @addClass el, className

  fireEvent: (eventName, el = document) =>
    event = document.createEvent 'HTMLEvents'
    event.initEvent eventName, true, false
    el.dispatchEvent event
    
### Hammer.jsイベント登録 ###
ViVi::_hammerOpt =
  swipe_velocity: 0.25
  hold_timeout: 500
[
  'hold', 'tap', 'doubletap', 'drag', 'dragstart', 'dragend', 'dragup', 'dragdown', 'dragleft',
  'dragright', 'swipe', 'swipeup', 'swipedown', 'swipeleft', 'swiperight', 'transform',
  'transformstart', 'transformend', 'rotate', 'pinch', 'pinchin', 'pinchout', 'touch', 'release',
].forEach (e) => ViVi::event[e] = (elems, func) ->
  return if elems.length is 0
  elems = document.querySelectorAll elems if typeof elems is 'string'
  elems = [ elems ] unless elems.length > 0
  Array::forEach.call elems, (el, i) ->
    Hammer(el, ViVi::_hammerOpt).on e, (ev) ->
      #return if el isnt ev.target
      func.call ev.target, ev
      #ev.stopPropagation()
      ev.preventDefault()

### <section>管理クラス ###
class Section extends ViVi
  constructor: (@el) ->
    @_setTranslate3d @el, 0
    @_tabs = []

    @_elTabLinks = @find 'nav li a'
    @addClass @find('nav li')[0], 'active' if @_elTabLinks.length > 0
    @each 'article', (el, i) => @_tabs.push el.id

    @_setScroller()
    @_createCheckBox()
    @_tapEvent()
    @_navEvent()

  _setScroller: () =>
    @each 'article', (el, i) =>
      contents = el.innerHTML
      wrapper = 'vv-wrapper'
      footer = ''
      m = el.innerHTML.match /^([\s\S]+)(<footer>[\s\S]+)$/i
      if m
        wrapper += ' vv-has-footer'
        contents = m[1]
        footer = m[2]

      el.innerHTML = """
      <div class="#{wrapper}">
        <div class="article-contents">
          #{contents}
        </div>
      </div>
      #{footer}
      """
      el.style.visibility = 'visible'
    @_createScroller()

  _hash2id: (el) => el.getAttribute('href').substr(1)

  _currentTabIndex: () =>
    return 0 if @_tabs.length < 2
    @_tabs.indexOf @_hash2id(@find('nav li.active a').item(0))

  _doTabChange: (elTab, onResize) =>
    return if @_elTabLinks.length is 0
    elTab = @_parentUntil elTab, 'a'
    elPage = @find('.vv-page').item(0)
    gotoIndex = @_tabs.indexOf @_hash2id(elTab)
    return @_onTabChanged elPage if @_currentTabIndex() is 0 and gotoIndex is 0
    bodyWidth = @_bodySize().width
    toPos = bodyWidth * -1 * gotoIndex
    curPos = @_currentTransform(elPage).x
    return if toPos is curPos
    @addClass elTab, 'touch' unless onResize
    @_setTranslate3d elPage, toPos
    @each 'nav li', (el, i) => @removeClass el, 'active'
    @addClass elTab.parentNode, 'active'

  _onTabChanged: (elt) =>
    @each 'nav li a', (el, i) => @removeClass el, 'touch'

  _navEvent: () =>
    @event.tap @_elTabLinks, (ev) => @_doTabChange ev.target
    @event.swipeleft @find('article'), (ev) =>
      return if ev.cancelBubble
      pageIndex = @_currentTabIndex()
      @_doTabChange @_elTabLinks.item(pageIndex + 1) if pageIndex < @_elTabLinks.length - 1
    @event.swiperight @find('article'), (ev) =>
      return if ev.cancelBubble
      pageIndex = @_currentTabIndex()
      @_doTabChange @_elTabLinks.item(pageIndex - 1) if pageIndex > 0
    for trEnd in @_evTransition
      @each '.vv-page', (el, i) =>
        el.addEventListener trEnd, (ev) => @_onTabChanged ev.target

  _tapEvent: () =>
    @_delayTapState = {}
    for el in @find '.article-contents .list'
      el.addEventListener 'touch', @_delayTapStart
      el.addEventListener 'dragstart', @_delayTapDrag
      el.addEventListener 'hold', @_delayTapHold
      el.addEventListener 'swipe', @_delayTapSwipe
    for el in @find '.vv-wrapper'
      el.addEventListener 'release', @_delayTapEnd

  _delayTapStart: (ev) =>
    el = @_parentUntil ev.target, 'li'
    @_delayTapState =
      el: el
      swipe: false
      hold: false
      timer: setTimeout () =>
        @addClass @_delayTapState.el, 'touch' if @_delayTapState.el?
      , 80

  _delayTapEnd: (ev) =>
    { el, swipe, hold } = @_delayTapState
    return unless el?
    setTimeout () =>
      @removeClass el, 'touch'
      return if swipe
      isTapDistance = if /(right|left)/.test ev.gesture.direction then 30 else 5
      if ev.gesture.distance < isTapDistance
        elCheckbox = @find '.vv-checkbox', el
        if elCheckbox.length > 0
          @toggleClass elCheckbox[0], 'checked'
          @fireEvent 'delaytap', el
        else if not hold or not @hasClass el, 'vv-hold-event'
          @fireEvent 'delaytap', el
    , 160

  _delayTapDrag: (ev) => clearTimeout @_delayTapState.timer #if /(up|down)/.test ev.gesture.direction
  _delayTapHold: (ev) => @_delayTapState.hold = true
  _delayTapSwipe: (ev) => @_delayTapState.swipe = true

  _createCheckBox: () =>
    checkbox = '<div class="vv-checkbox"></div>'
    @each '.vv-page .list-item-checkbox', (el, i) =>
      children = el.children
      if children.length is 0
        el.append checkbox
      else
        el.children[0].insertAdjacentHTML 'beforebegin', checkbox

  onResize: () =>
    @_doTabChange @_elTabLinks.item(@_currentTabIndex()), true if @_elTabLinks.length > 0
    if not @hasClass(@el, 'active') and @el.id isnt 'vv-main'
      @addClass @el, 'bgset'
      @_setTranslate3d @el, @_bodySize().width
      @removeClass @el, 'bgset'

  _currentTransform: (el) =>
    m = (el.style.WebkitTransform ? '').match(/translate3d\s*\((.*?)\)/i)
    return { x: 0, y: 0, z: 0} unless m
    [ x, y, z ] = m[1].split(/\s*,\s*/).map (v, i, a) -> Number v.replace(/[^\d\.\-]/g, '')
    x: x
    y: y
    z: z

  _onPageDragInit: (ev) =>
    if @hasClass ev.target, 'vv-wrapper'
      el = @find('.article-contents', ev.target)[0]
      elWrapper = ev.target
    else
      el = @_parentUntil ev.target, '.article-contents'
      elWrapper = @find('.vv-wrapper')[0]
    @_dragState =
      scrollRange: elWrapper.offsetHeight
      el: el
      elWrapper: elWrapper
      pos: @_currentTransform(el).y
      deltaHistory: []

  _onPageDrag: (ev) =>
    { pos, el, elWrapper, scrollRange, deltaHistory } = @_dragState
    #return if el.offsetHeight < elWrapper.offsetHeight
    { deltaY, velocityY, deltaTime, direction } = ev.gesture
    return if direction is 'left' or direction is 'right'

    y = pos + deltaY
    if ev.type is 'dragend'
      scrollRange *= velocityY
      for b in [ 0.2, 0.4, 0.6, 0.8 ]
        scrollRange *= (b / 2 + 0.5) if velocityY < b
      scrollRange *= Math.abs(deltaY) * 2 / elWrapper.offsetHeight
      deltaHistory.pop()
      altVelocity = Math.abs(deltaY) - Math.abs(deltaHistory.pop())
      scrollRange = 0 if altVelocity <= 1
      #scrollRange *= (altVelocity / 10) if altVelocity > 10
      scrollRange *= 2 if altVelocity > 10
      # 上swipe(下スクロール)は指の動き的に少し移動距離が大きい方が良さげ
      scrollRange *= 1.3 if direction is 'up'
      duration = 400
    else
      @_dragState.deltaHistory.push deltaY
      if deltaTime < 100 and velocityY > 0.05
        scrollRange = deltaY
        scrollRange *= -1 if direction is 'down'
        duration = 100
      else
        scrollRange = 0
        duration = 0
    tr = if duration > 0 then "all #{duration}ms ease-out" else 'none'
    el.style.transition = tr
    el.style.WebkitTransition = tr
    maxBottom = (el.offsetHeight - elWrapper.offsetHeight) * -1
    switch direction
      when 'up' then y = Math.max y - scrollRange, maxBottom
      when 'down' then y += scrollRange
    y = 0 if y > 0
    @_setTranslate3d el, 0, y

  _createScroller: () =>
    for el in @find 'article .vv-wrapper'
      el.addEventListener 'dragstart', @_onPageDragInit, true
      el.addEventListener 'dragend', @_onPageDrag, true
      el.addEventListener 'dragup', @_onPageDrag, true
      el.addEventListener 'dragdown', @_onPageDrag, true

  changeTab: (id) =>
    @_doTabChange @_elTabLinks.item(@_tabs.indexOf id) if @_elTabLinks.length > 0

### ViVi本体 ###
class Core extends ViVi
  constructor: () ->
    @el = document
    @section = {}
    @cordova =
      onPause: () =>
      onResume: () =>
      onOnline: () =>
      onOffline: () =>
      onBackButton: () => @closeSection()
      onMenuButton: () =>
      onOptionSelect: (e) =>
        #console.log e
      onSearchButton: () =>
      onStartcallButton: () =>
      onEndcallButton: () =>
      onVolumeDownButton: () =>
      onVolumeUpButton: () =>
      onBatteryCritical: (info) =>
        #console.log 'batterycritical', info
      onBatteryLow: (info) =>
        #console.log 'batterylow', info
      onBatteryStatus: (info) =>
        #console.log 'batterystatus', info

    ### Cordovaイベント登録 ###
    for name, func of @cordova
      continue unless /^on/.test name
      do (name) =>
        target = if /battery/i.test name then window else document
        target.addEventListener name.substr(2).toLowerCase(), (ev) =>
          @cordova[name](ev)
        , false

    @initialize = (cb) => cb()
    @finalize = (cb) => cb()

  ready: (wait, cb) =>
    if wait instanceof Function
      cb = wait
      wait = 10
    trigger = if /(android|ios)/i.test navigator.userAgent then 'deviceready' else 'DOMContentLoaded'
    document.addEventListener trigger, () =>
      @initialize () =>
        @each 'body>section', (el, i) => @section[el.id] = new Section(el)
        @addClass @section['vv-main'].el, 'active'
        window.addEventListener 'resize', @_onResize
        @_onResize()
        @_tapEvent()
        @_navEvent()
        @_sectionEvent()
        setTimeout (() -> cb.apply window), wait

  _onResize: () =>
    elBody = @_bodySize()
    bodyHeight = "#{elBody.height}px"
    @each 'article', (el, i) =>
      el.style.minHeight = bodyHeight
    sec.onResize() for id, sec of @section

  _navEvent: () =>
    for trEnd in @_evTransition
      @each 'body>section', (el, i) => el.addEventListener trEnd, (ev) =>
        return unless /transform/.test ev.propertyName
        elt = ev.target
        @_onSectionChanged elt if @hasClass elt, 'standby'

  _onSectionChanged: (elt) =>
    @removeClass elt, 'standby'
    if @hasClass elt, 'back'
      @removeClass elt, 'back'
      @fireEvent 'sectionbackground', elt
    else
      @each 'body>section', (el, i) =>
        if @hasClass el, 'background'
          @removeClass el, 'background'
        else if @hasClass el, 'active'
          @removeClass el, 'active'
          @addClass el, 'background'
      @addClass elt, 'active'
      @fireEvent 'sectionactive', @find('body>section.active')[0]

  _doSectionChange: (elSection) =>
    @addClass elSection, 'standby'
    do (elSection) => setTimeout (() => @_setTranslate3d(elSection, 0)), 10

  closeSection: () =>
    currentSection = @find('body>section.active').item(0)
    if currentSection.id is 'vv-main'
      mainSection = @section['vv-main']
      if mainSection._currentTabIndex() is 0
        @finalize () => window.navigator.app?.exitApp?()
        return
      return mainSection.changeTab mainSection._tabs[0]
    @removeClass currentSection, 'active'
    @addClass currentSection, 'standby back'
    bg = @find 'body>section.background'
    if bg.length > 0
      @removeClass bg[0], 'background'
      @addClass bg[0], 'active'
    else
      @addClass @find('#vv-main').item(0), 'active'
    do (currentSection) =>
      setTimeout (() => @_setTranslate3d currentSection, @_bodySize().width), 10

  _sectionEvent: () =>
    @event.tap @find('header .vv-back'), (ev) => @closeSection()

  _tapEvent: () =>
    _preventDefault = (ev) => ev.preventDefault()
    #@el.addEventListener 'touchstart', _preventDefault, false
    @el.addEventListener 'touchmove', _preventDefault, false
    @el.addEventListener 'click', _preventDefault, false
    @event.touch @find('a'), (ev) => @addClass @_parentUntil(ev.target, 'a'), 'touch'
    @event.release @find('a'), (ev)  => @removeClass @_parentUntil(ev.target, 'a'), 'touch'

  changeTab: (tabId) =>
    @section[@find('body>section.active').item(0).id].changeTab tabId

  changeSection: (sectionId) =>
    @_doSectionChange @find("##{sectionId}").item(0)

window.VV = new Core()
# window.onerror = (msg, url, line) -> console.error msg, url, line
