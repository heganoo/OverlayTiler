// OverlayTiler.js
// Copyright (c) 2014 Heganoo
// https://github.com/heganoo/OverlayTiler

'use strict';

////////////////////////
/// The Overlay
////////////////////////

/**
 * Set to OverlayView.
 *
 * @type {google.maps.OverlayView}
 */
OverlayTiler.prototype = new google.maps.OverlayView;

/**
 * A map overlay that allows affine transformations on its image.
 *
 * @param data
 * @param img
 * @constructor
 */
function OverlayTiler( data, map ) {
  var self = this;

  var img = new Image();
  img.src = data.src;
  img.style.position = 'absolute';

  this.img_ = img;
  this.data_ = data;
  this.map_ = map;

  img.onload = function () {

    // Add the opacity control.
    var opacity = new Opacity( self );
    map.controls[google.maps.ControlPosition.BOTTOM_LEFT].push( opacity.getElement() );
    self.opacity_ = opacity;

    // Engage the layer to the map.
    self.setMap( map );

    // Invoke afterLoad hook.
    if ( self.afterLoad ) {
      self.afterLoad();
    }
  }
};

/**
 * Adds the image in the top left of the current map viewport.
 * The overlay can be transformed via three control points, and translated via
 * a larger control point that sits in the middle of the image overlay.
 */
OverlayTiler.prototype.onAdd = function () {
  // Set projection and pane.
  var proj = this.getProjection();
  var pane = this.getPanes().overlayImage;
  var data = this.data_;
  var map = this.map_;

  // Append the image as a layer to the map.
  this.getPanes().overlayLayer.appendChild( this.img_ );

  var topRight, bottomLeft, img = this.img_;

  if ( data.ne && data.sw && data.ne.lat && data.ne.lng && data.sw.lat && data.sw.lng ) {
    // Set the image bounds from external data.
    var ne = new google.maps.LatLng( this.data_.ne.lat, this.data_.ne.lng );
    var sw = new google.maps.LatLng( this.data_.sw.lat, this.data_.sw.lng );

    topRight = proj.fromLatLngToDivPixel( ne );
    bottomLeft = proj.fromLatLngToDivPixel( sw );
  }
  else {
    // Set the image bounds from map center.
    var center = proj.fromLatLngToDivPixel( map.getCenter() );
    topRight = new google.maps.Point( center.x + (img.width / 2), center.y - (img.height / 2) );
    bottomLeft = new google.maps.Point( center.x - (img.width / 2), center.y + (img.height / 2) );
  }

  // The Mover allows the overlay to be translated.
  var mover = new Mover( pane, bottomLeft.x, topRight.y, this );
  this.mover_ = mover;

  google.maps.event.addListener( mover, 'dragstart',
      this.setMapDraggable_.bind( this, false ) );

  google.maps.event.addListener( mover, 'dragend',
      this.setMapDraggable_.bind( this, true ) );

  google.maps.event.addListener( mover, 'change',
      this.renderImage_.bind( this ) );

  // The Resizer allows the overlay to be resize.
  var resizer = new Resizer( pane, topRight.x, bottomLeft.y, this );
  this.resizer_ = resizer;

  google.maps.event.addListener( resizer, 'dragstart',
      this.setMapDraggable_.bind( this, false ) );

  google.maps.event.addListener( resizer, 'dragend',
      this.setMapDraggable_.bind( this, true ) );

  google.maps.event.addListener( resizer, 'change',
      this.renderImage_.bind( this ) );

  // On map zoom, we render the image calibrated to the map.
  var map = this.map_;
  google.maps.event.addListener( map, 'zoom_changed',
      this.calibrationRenderImage_.bind( this ) );

  this.renderImage_();

  // Invoke afterAdd hook.
  if ( this.afterAdd ) {
    this.afterAdd();
  }
};

/**
 * Notify that the image should be rendered in calibration.
 *
 * @private
 */
OverlayTiler.prototype.calibrationRenderImage_ = function () {
  var img = this.img_;
  var resizer = this.resizer_;
  var mover = this.mover_;
  var imgBounds = this.imgBounds_;
  var proj = this.getProjection();

  if ( imgBounds && proj ) {
    // Get the pixel size from the image bounds.
    var sw = proj.fromLatLngToDivPixel( imgBounds.getSouthWest() );
    var ne = proj.fromLatLngToDivPixel( imgBounds.getNorthEast() );

    // Set the image style.
    img.style.left = sw.x + 'px';
    img.style.top = ne.y + 'px';
    img.style.width = (ne.x - sw.x) + 'px';

    // Re-locate the mover handle.
    mover.x = sw.x;
    mover.y = ne.y;
    mover.render();

    // Re-locate the resizer handle.
    resizer.x = ne.x;
    resizer.y = sw.y;
    resizer.render();

    delete this.renderTimeout;
    google.maps.event.trigger( this, 'change' );
  }
};

/**
 * Notify that the image should be rendered.
 * Essentially limits rendering to a max of 66fps.
 *
 * @private
 */
OverlayTiler.prototype.renderImage_ = function () {
  if ( this.renderTimeout ) {
    return;
  }
  this.renderTimeout = window.setTimeout(
      this.forceRenderImage_.bind( this ), 15 );
};

/**
 * Actually renders to the canvas.
 *
 * @private
 */
OverlayTiler.prototype.forceRenderImage_ = function () {
  var resizer = this.resizer_;
  var mover = this.mover_;
  var img = this.img_;

  // Set the image style.
  img.style.left = mover.x + 'px';
  img.style.top = mover.y + 'px';
  img.style.width = (resizer.x - mover.x) + 'px';

  delete this.renderTimeout;
  google.maps.event.trigger( this, 'change' );

  this.setImgBounds();

  // Invoke afterRender hook.
  if ( this.afterRender ) {
    this.afterRender();
  }
};

/**
 * Sets the map's draggable option.
 *
 * @private
 * @param {boolean} draggable  Whether the map should be draggable.
 */
OverlayTiler.prototype.setMapDraggable_ = function ( draggable ) {
  this.map_.set( 'draggable', draggable );
};

/**
 * Sets the opacity of the overlay.
 *
 * @param {number} opacity  The opacity, from 0.0 to 1.0.
 */
OverlayTiler.prototype.setOpacity = function ( opacity ) {
  this.img_.style.opacity = opacity;
};

/**
 * @inheritDoc
 */
OverlayTiler.prototype.draw = function () {
};

/**
 * @inheritDoc
 */
OverlayTiler.prototype.onRemove = function () {
  // Remove the image.
  if ( this.img_ ) {
    this.img_.parentNode.removeChild( this.img_ );
    this.img_ = null;
  }

  // Remove the opacity element.
  if ( this.opacity_ ) {
    this.opacity_.getElement().parentNode.removeChild( this.opacity_.getElement() );
    this.opacity_ = null;
  }

  // Remove the resizer handle.
  if ( this.resizer_ ) {
    this.resizer_.getElement().parentNode.removeChild( this.resizer_.getElement() );
    this.resizer_ = null;
  }

  // Remove the mover handle.
  if ( this.mover_ ) {
    this.mover_.getElement().parentNode.removeChild( this.mover_.getElement() );
    this.mover_ = null;
  }
};

/**
 * Sets image bounds.
 */
OverlayTiler.prototype.setImgBounds = function () {
  var proj = this.getProjection();
  var img = this.img_;
  var mover = this.mover_

  // Get the LatLng value of the image bounds.
  var swBound = proj.fromDivPixelToLatLng( new google.maps.Point( mover.x, ( mover.y + img.height ) ) );
  var neBound = proj.fromDivPixelToLatLng( new google.maps.Point( ( mover.x + img.width ), mover.y ) );

  // Update the bounds.
  this.imgBounds_ = new google.maps.LatLngBounds( swBound, neBound );
}

/**
 * Get the current image bounds.
 *
 * @returns {google.maps.LatLngBounds|*}
 */
OverlayTiler.prototype.getImgBounds = function () {
  return this.imgBounds_;
}

/**
 * Destroy this overlay.
 */
OverlayTiler.prototype.destroy = function () {
  this.setMap( null );
}

////////////////////////
/// The Mover handle
////////////////////////

/**
 * Creates a mover (big resizer) that moves a bunch of other resizer.
 *
 * @constructor
 * @param {Node} parent  the element to attach this resizer to.
 * @param {Array.<overlaytiler.Resizer>} resizer  the resizer that should be moved with
 *    this resizer.
 * @extends overlaytiler.Resizer
 */
function Mover( parent, x, y, overlay ) {

  var el = this.el_ = document.createElement( 'div' );
  el.className += ' mover';
  el.innerText += '☐';
  el.style.position = 'absolute';
  el.style.color = 'black';
  el.style.fontSize = '24px';
  el.style.fontWeight = 'bold';
  el.style.background = 'yellow';
  el.style.width = '24px';
  el.style.height = '24px';
  el.style.textAlign = 'center';
  el.style.lineHeight = '1';
  el.style.margin = '-10px';
  el.style.cursor = 'move';
  parent.appendChild( el );
  el.onMouseMove_ = this.onMouseMove_.bind( el );

  this.onMouseMove_ = this.onMouseMove_.bind( this );
  this.onMouseDown_ = this.onMouseDown_.bind( this );
  this.onMouseUp_ = this.onMouseUp_.bind( this );

  el.addEventListener( 'mousedown', this.onMouseDown_, true );
  window.addEventListener( 'mouseup', this.onMouseUp_, true );

  this.x = x;
  this.y = y;
  this.overlay_ = overlay;
  this.style = el.style;
  this.render();
};

/**
 * @returns {HTMLElement|*}
 */
Mover.prototype.getElement = function () {
  return this.el_;
};

/**
 * Renders this mover to the page, at its location.
 */
Mover.prototype.render = function () {
  this.style.left = this.x + 'px';
  this.style.top = this.y + 'px';
  google.maps.event.trigger( this, 'change' );
};

/**
 * Moves the resizer to the current mouse position.
 *
 * @private
 * @param {MouseEvent} e  the event containing coordinates of current mouse
 * position.
 */
Mover.prototype.onMouseMove_ = function ( e ) {
  this.x += e.clientX - this.cx;
  this.y += e.clientY - this.cy;

  var resizer = this.overlay_.resizer_;
  var img = this.overlay_.img_;

  resizer.x = this.x + img.width;
  resizer.y = this.y + img.height;
  resizer.render();

  this.render();

  this.cx = e.clientX;
  this.cy = e.clientY;
};

/**
 * Enables editing of the resizer's location.
 *
 * @private
 * @param {MouseEvent} e  the event containing coordinates of current mouse
 * position.
 */
Mover.prototype.onMouseDown_ = function ( e ) {
  this.cx = e.clientX;
  this.cy = e.clientY;
  this.mouseMoveListener_ = google.maps.event.addDomListener( window, 'mousemove', this.onMouseMove_.bind( this ) );
  google.maps.event.trigger( this, 'dragstart' );
};

/**
 * Disables editing of the resizer's location.
 *
 * @private
 */
Mover.prototype.onMouseUp_ = function () {
  if ( this.mouseMoveListener_ ) {
    google.maps.event.removeListener( this.mouseMoveListener_ );
  }
  google.maps.event.trigger( this, 'dragend' );
};

////////////////////////
/// The Resizer handles
////////////////////////

/**
 * A draggable Resizer, rendered to the page.
 *
 * @param parent
 * @param x
 * @param y
 * @param img
 * @constructor
 */
function Resizer( parent, x, y, overlay ) {

  var el = this.el_ = document.createElement( 'div' );
  el.className = 'resizer';
  el.innerText = '⇲';
  el.style.position = 'absolute';
  el.style.color = 'black';
  el.style.fontSize = '24px';
  el.style.fontWeight = 'bold';
  el.style.background = 'yellow';
  el.style.width = '24px';
  el.style.height = '24px';
  el.style.textAlign = 'center';
  el.style.lineHeight = '1';
  el.style.margin = '-18px';
  el.style.cursor = 'nwse-resize';
  parent.appendChild( el );

  this.onMouseMove_ = this.onMouseMove_.bind( this );
  this.onMouseDown_ = this.onMouseDown_.bind( this );
  this.onMouseUp_ = this.onMouseUp_.bind( this );

  el.addEventListener( 'mousedown', this.onMouseDown_, true );
  window.addEventListener( 'mouseup', this.onMouseUp_, true );

  this.x = x;
  this.y = y;
  this.overlay_ = overlay;
  this.style = el.style;
  this.renderOnce();
};

/**
 * @returns {HTMLElement|*}
 */
Resizer.prototype.getElement = function () {
  return this.el_;
};

/**
 * Renders this resizer to the page, at its location.
 */
Resizer.prototype.renderOnce = function () {
  this.style.left = this.x + 'px';
  this.style.top = this.y + 'px';
  google.maps.event.trigger( this, 'change' );
};

/**
 * Renders this resizer to the page, at its location.
 */
Resizer.prototype.render = function () {
  var mover = this.overlay_.mover_;
  var img = this.overlay_.img_;

  this.style.left = (mover.x + img.width) + 'px';
  this.style.top = (mover.y + img.height) + 'px';

  google.maps.event.trigger( this, 'change' );
};

/**
 * Moves the resizer to the current mouse position.
 *
 * @private
 * @param {MouseEvent} e  the event containing coordinates of current mouse
 * position.
 */
Resizer.prototype.onMouseMove_ = function ( e ) {
  this.x += e.clientX - this.cx;
  this.y += e.clientY - this.cy;

  this.render();

  this.cx = e.clientX;
  this.cy = e.clientY;
};

/**
 * Enables editing of the resizer's location.
 *
 * @private
 * @param {MouseEvent} e  the event containing coordinates of current mouse
 * position.
 */
Resizer.prototype.onMouseDown_ = function ( e ) {
  this.cx = e.clientX;
  this.cy = e.clientY;
  this.mouseMoveListener_ = google.maps.event.addDomListener( window, 'mousemove', this.onMouseMove_.bind( this ) );
  google.maps.event.trigger( this, 'dragstart' );
};

/**
 * Disables editing of the resizer's location.
 *
 * @private
 */
Resizer.prototype.onMouseUp_ = function () {
  if ( this.mouseMoveListener_ ) {
    google.maps.event.removeListener( this.mouseMoveListener_ );
  }
  google.maps.event.trigger( this, 'dragend' );
};

////////////////////////
/// Opacity control
////////////////////////

/**
 * Controls the opacity of an Overlay.
 *
 * @constructor
 * @param {overlaytiler.Overlay} overlay  the overlay to control.
 */
function Opacity( overlay ) {
  var el = this.el_ = document.createElement( 'input' );
  el.type = 'range';
  el.min = 0;
  el.max = 100;
  el.value = 100;
  el.style.width = '200px';
  el.onchange = this.onChange_.bind( this );

  this.overlay_ = overlay;
};

/**
 * Called whenever the slider is moved.
 *
 * @private
 */
Opacity.prototype.onChange_ = function () {
  var overlay = this.overlay_;
  overlay.setOpacity( this.el_.value / 100 );
};

/**
 * Returns the Element, suitable for adding to controls on a map.
 *
 * @return {Element}  the Element.
 */
Opacity.prototype.getElement = function () {
  return this.el_;
};