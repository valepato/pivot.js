/*
 * Pivot: A photo gallery using CSS3 3D transforms.
 *
 * By Markus Messner-Chaney, http://markusmessnerchaney.com
 * Public Domain.
 */

/*jshint browser: true, boss: true, curly: true, eqeqeq: true, immed: true,
  newcap: true, noarg: true, noempty: true, overvar: true, undef: true,
  white: true, indent: 2 */
/*global pivot, Element, Modernizr */

/* compile order: util, gallery, photo, flickr*/

(function (window) {

  var pivot = window.pivot || (window.pivot = {}),
      document = window.document,
      elProto = Element.prototype,
      fnProto = Function.prototype;

  pivot.util = {};
  pivot.util.slice = [].slice;

  Modernizr.addTest("devicemotion", function () {
    return window.ondevicemotion !== undefined;
  });

  Modernizr.addTest("matchesselector", function () {
    var matchesSelector = ["webkit", "moz", "ms", "o"].reduce(function (matchesSelector, prefix) {
      return matchesSelector || elProto[prefix + "MatchesSelector"];
    }, elProto.matchesSelector);
    return !!(pivot.util.matchesSelector = matchesSelector && fnProto.call.bind(matchesSelector));
  });

  // Utility functions
  // -----------------

  function makeElement(tagName, attributes) {
    var element = document.createElement(tagName),
        prop;

    for (prop in attributes) {
      if (prop === "class") {
        element.className = attributes[prop];
      } else {
        element.setAttribute(prop, attributes[prop]);
      }
    }

    return element;
  }

  function delegate(element, selector, type, listener) {
    element.addEventListener(type, function (event) {
      var target = event.target,
      nodes = pivot.util.slice.call(element.querySelectorAll(selector));
      while (target && nodes.indexOf(target) < 0) {
        target = target.parentNode;
      }
      if (target && target !== element && target !== document) {
        listener.call(target, event);
      }
    }, false);
  }

  function ancestor(element, selector) {
    while (element !== document && !pivot.util.matchesSelector(element, selector)) {
      element = element.parentNode;
    }
    return element;
  }

  function supplant(string) {
    var args = pivot.util.slice.call(arguments),
        i = 0,
        arg;
    if (typeof(args[1]) === "object") {
      return string.replace(/\{(\w+)\}/g, function () {
        return (args[1][arguments[1]] !== undefined) ? args[1][arguments[1]] : arguments[0];
      });
    } else {
      return string.replace(/\{(\w*)\}/g, function () {
        arg = args[++i];
        return (arg !== undefined) ? arg : arguments[0];
      });
    }
  }

  function getJSON(url, callback) {
    var request = new XMLHttpRequest();

    request.addEventListener("readystatechange", function (event) {
      if (request.readyState === 4 && request.status === 200) {
        callback(JSON.parse(request.responseText));
      }
    }, false);

      request.open("GET", url, true);
      request.send();
  }

  // Normalized mouse position local to element
  function localCoordinates(event, target) {
    var box;

    target = target || event.target;
    box = target.getBoundingClientRect();

    return {
      x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
      box: box
    };
  }

  function mod(a, b) {
    return (a % b + b) % b;
  }

  function Gesturized(element, type, handler) {
    this.element = element;
    this.setType(type);

    this.element.addEventListener(type, handler, false);

    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);

    this.element.addEventListener("touchstart", this.onTouchStart, false);
  }

  Gesturized.availableEvents = ["swipeleft", "swiperight"];

  Gesturized.prototype = {

    setType: function (type) {
      this.type = type.toLowerCase();
      this.event = document.createEvent("Events");
      this.event.initEvent(type, true, false);
    },

    dispatchEvent: function (target, type) {
      if (this.type === type.toLowerCase()) {
        target.dispatchEvent(this.event);
      }
    },

    getCoords: function (event) {
      return {
        x: event.touches[0].pageX,
        y: event.touches[0].pageY
      };
    },

    onTouchStart: function (event) {
      if ((this.startCoords = this.getCoords(event))) {
        this.element.addEventListener("touchend", this.onTouchEnd, false);
        this.element.addEventListener("touchmove", this.onTouchMove, false);
      }
    },

    onTouchMove: function (event) {
      this.moveCoords = this.getCoords(event);
    },

    onTouchEnd: function (event) {
      var diff;

      this.element.removeEventListener("touchend", this.onTouchEnd, false);
      this.element.removeEventListener("touchmove", this.onTouchMove, false);

      // Check for swipes
      if (this.moveCoords) {
        diff = {
          x: this.startCoords.x - this.moveCoords.x,
          y: this.startCoords.y - this.moveCoords.y
        };
        if (Math.abs(diff.x) > 30 || Math.abs(diff.y) > 30) {
          this.dispatchEvent(event.target, (diff.x > 0) ? "swipeleft" : "swiperight");
        }
        delete this.moveCoords;
      }
    }
  };

  function gesturize(element, type, handler) {
    return new Gesturized(element, type, handler);
  }

  function preventTouchScroll(element) {
    var preventScroll = function (event) {
          event.preventDefault();
        };
    element.addEventListener("touchmove", preventScroll, false);
  }

  pivot.util.makeElement = makeElement;
  pivot.util.delegate = delegate;
  pivot.util.ancestor = ancestor;
  pivot.util.supplant = supplant;
  pivot.util.getJSON = getJSON;
  pivot.util.localCoordinates = localCoordinates;
  pivot.util.mod = mod;
  pivot.util.gesturize = gesturize;
  pivot.util.preventTouchScroll = preventTouchScroll;

  // ES5 Polyfills
  // -------------

  // Emulate ES5 getter/setter API using legacy APIs
  if (Object.prototype.__defineGetter__ && !Object.defineProperty) {
    Object.defineProperty = function (obj, prop, desc) {
      if ("get" in desc) {
        obj.__defineGetter__(prop, desc.get);
      }
      if ("set" in desc) {
        obj.__defineSetter__(prop, desc.set);
      }
    };
  }

  // Element::classList (does not fully implement ES5 spec)
  if (typeof Element != null && !Element.hasOwnProperty.call(Element.prototype, "classList")) {
    (function () {
      var classRE = function (token) {
            return new RegExp("(^|\\s)" + token + "(\\s|$)");
          },
          ClassList = function (element) {
            this.element = element;
          },
          getClassList = function () {
            return new ClassList(this);
          };

      ClassList.prototype = {
        contains: function (token) {
          return classRE(token).test(this.element.className);
        },
        add: function (token) {
          if (!this.contains(token)) {
            this.element.className += (this.element.className ? " " : "") + token;
          }
        },
        remove: function (token) {
          this.element.className = this.element.className.replace(classRE(token), " ").trim();
        },
        toggle: function (token) {
          var boundClassRE = classRE(token);
          if (boundClassRE.test(this.element.className)) {
            this.element.className = this.element.className.replace(boundClassRE, " ").trim();
          } else {
            this.element.className += (this.element.className ? " " : "") + token;
          }
        }
      };

      Object.defineProperty(Element.prototype, "classList", {
        get: getClassList
      });
    }());
  }

}(this));

(function (window) {

  var pivot = window.pivot || (window.pivot = {}),
      document = window.document,
      supplant = pivot.util.supplant,
      transform = Modernizr.prefixed("Transform");

  pivot.Gallery = function (options) {

    var row, column, feedArguments;

    this.wrapper = options.wrapper || document.body;

    this.quality = options.quality || "medium";

    this.currentPage = options.currentPage || 0;

    this.photosPage = options.galleryData

    feedArguments = {};

    // Choose feed
    if (options.jsonName) {
      this.feed = pivot.flickr.feeds.jsonFeed;

      // Insert feed arguments
      feedArguments.jsonName = options.jsonName;
      this.feed = supplant(this.feed, feedArguments);
    }

    // Holds amount of photos loaded or timed out
    this.photoLoadCount = 0;

    // Aspect ratio of the images, Fix: make data driven
    this.aspectRatio = 1.78;

    // Holds pivot.Photos
    this.photos = [];
    photosPage = [];

    this.rows = 2;
    this.columns = 3;
    this.rowsMax = 3;
    this.photoPerPage = this.columns * this.rowsMax;

    var oldBodyMarginRight = $("body").css("margin-right", "20px");

    // Tilt settings/variables
    // -----------------------
    this.allowedRotation = options.allowedRotation || (window.orientation) ? 120 : 90;

    // Holds how fast tilting reacts to mouse movement.
    // Lower is faster.
    this.tiltLag = 25;

    this.rotationDelta = { x: 0, y: 0 };
    this.movementCoordinates = { x: 0, y: 0 };
    this.currentRotation = { x: 0, y: 0 };

    // Bind some class methods to this object
    // --------------------------------------

    this.onFlickrResult = this.onFlickrResult.bind(this);
    this.getPhotoGrid = this.getPhotoGrid.bind(this);
    this.getNewPage = this.getNewPage.bind(this);
    this.constrainLayout = this.constrainLayout.bind(this);
    this.tilt = this.tilt.bind(this);

    // Setup DOM
    // ---------

    this.container = pivot.util.makeElement("div", { "class": "pivot" });

    if (!options.wrapper) {
      this.container.classList.add("fullscreen");
    }

    this.wrapper.appendChild(this.container);

    this.viewport = pivot.util.makeElement("div", { "class": "p-viewport" });

    this.zoomPlane = pivot.util.makeElement("div", { "class": "p-zoom-plane" });
    this.viewport.appendChild(this.zoomPlane);

    this.tiltPlane = pivot.util.makeElement("div", { "class": "p-tilt-plane" });
    this.zoomPlane.appendChild(this.tiltPlane);

    this.trackingPlane = pivot.util.makeElement("div", { "class": "p-tracking-plane" });
    this.tiltPlane.appendChild(this.trackingPlane);

    this.getFlickrPage = this.getFlickrPage.bind(this);

    //if data is JSON set up new page else use previously parsed data
    if (options.jsonName){
      setTimeout(this.getFlickrPage, 400);
    } else {
      setTimeout(this.getNewPage, 400);
    }

    //set up back and close buttons
    this.controls = pivot.util.makeElement("div", { "class": "p-controls" });
    //close button
    this.refreshContainer = pivot.util.makeElement("div", { "class": "p-refresh-container" });
    this.refresh = pivot.util.makeElement("button", { "class": "p-refresh" });
    this.refreshContainer.appendChild(this.refresh);
    this.controls.appendChild(this.refreshContainer);
    //back button
    this.backButtonContainer = pivot.util.makeElement("div", { "class": "p-backButton-container" });
    this.backButton = pivot.util.makeElement("button", { "class": "p-backButton" });
    this.backButtonContainer.appendChild(this.backButton);
    this.controls.appendChild(this.backButtonContainer);

    this.backButton.currentProjectParent = options.currentProjectParent || "";

    this.zoomOutContainer = pivot.util.makeElement("div", {"class": "p-zoomOut-container"});
    this.zoomOutButton = pivot.util.makeElement("button", {"class": "p-zoomOutButton"});
    this.zoomOutContainer.appendChild(this.zoomOutButton);
    this.controls.appendChild(this.zoomOutContainer);


    //setup paging controls
    this.navControls = pivot.util.makeElement("div", { "class": "p-pageNavControls" });
    //next page
    this.nextPageContainer = pivot.util.makeElement("div", { "class": "p-nextPage-container" });
    this.nextPage = pivot.util.makeElement("button", { "class": "p-nextPage" });
    this.nextPageContainer.appendChild(this.nextPage);
    this.navControls.appendChild(this.nextPageContainer);
    //last page
    this.lastPageContainer = pivot.util.makeElement("div", { "class": "p-lastPage-container" });
    this.lastPage = pivot.util.makeElement("button", { "class": "p-lastPage" });
    this.lastPageContainer.appendChild(this.lastPage);
    this.navControls.appendChild(this.lastPageContainer);

    this.constrainLayout();

    this.container.appendChild(this.viewport);
    this.container.appendChild(this.controls);
    this.container.appendChild(this.navControls);

    // Setup events
    // ------------

    window.addEventListener("keydown", function(e) {
      // space and arrow keys
      if([32, 38, 40].indexOf(e.keyCode) > -1) {
          e.preventDefault();
      }
    }, false);
    window.addEventListener("resize", this.constrainLayout, false);
    this.trackingPlane.addEventListener("load", this.onPhotoLoaded.bind(this), false);
    this.trackingPlane.addEventListener("nodeLoad", this.onSelectedClickDelegate.bind(this), false);
    document.addEventListener("keydown", this.onKeyDown.bind(this), false);
    pivot.util.delegate(this.viewport, ".p-photo", "click", this.onPhotoClickDelegate.bind(this));

    this.refresh.addEventListener("click", this.onCloseButton, false);
    this.backButton.addEventListener("click", this.onBackButton, false);
    this.zoomOutButton.addEventListener("click", this.zoomOut.bind(this), false);

    this.nextPage.addEventListener("click", this.onNextPage.bind(this), false);
    this.lastPage.addEventListener("click", this.onPreviousPage.bind(this), false);

    if (Modernizr.devicemotion  && Modernizr.touch) {
      window.addEventListener("devicemotion", this.onDeviceMotion.bind(this), false);
      window.addEventListener("orientationchange", this.constrainLayout, false);
    } else {
      this.container.addEventListener("mousemove", this.onContainerMouseMove.bind(this), false);
    }

    if (Modernizr.touch) {
      pivot.util.preventTouchScroll(document.body);
      pivot.util.gesturize(this.viewport, "swipeleft", this.cycle.bind(this, "next"), true, false);
      pivot.util.gesturize(this.viewport, "swiperight", this.cycle.bind(this, "prev"), true, false);
    }

    // Finalize setup
    // --------------

    this.zoomOut();

    $(".p-backButton-container").hide();
    $(".p-zoomOut-container").hide();
    if (this.backButton.currentProjectParent != "") {
      $(".p-backButton-container").show();
    }

    $(".p-nextPage-container").hide();
    $(".p-lastPage-container").hide();

    this.setSelectedPhoto(this.getPhoto(0, 0));
  };

  pivot.Gallery.prototype = {

    // Make zoomPlane square and centered within viewport
    constrainLayout: function () {
      var width = this.container.clientWidth,
          height = this.container.clientHeight,
          min = Math.min(width, height);

      this.zoomPlane.style.width = (height * this.aspectRatio) + "px";
      this.zoomPlane.style.height = height + "px";

      if (width > height) {
        this.zoomPlane.style.left = (width - (height * this.aspectRatio)) / 2 + "px";
        this.zoomPlane.style.top = 0;
      } else {
        this.zoomPlane.style.top = (height - width) / 2 + "px";
        this.zoomPlane.style.left = 0;
      }
    },

    showHidePaging: function() {
      $(".p-nextPage-container").hide();
      $(".p-lastPage-container").hide();
      //show next and last depending on page
      if (this.zoomed) {
        $(".p-nextPage-container").show();
        $(".p-lastPage-container").show();
      } else {
        if ((this.photosPage.length - 1) > this.currentPage) {
          $(".p-nextPage-container").show();
        } else {
          $(".p-nextPage-container").hide();
        }
        if (this.currentPage != 0) {
          $(".p-lastPage-container").show();
        } else {
          $(".p-lastPage-container").hide();
        }
      }
    },

    // Set up photo grid
    // ---------------

    getPhotoGrid: function (data) {
      //show next and last depending on page
      this.showHidePaging();

      //determine how many rows based on # of images & columns
      if (data.length < this.columns) {
        this.columns = data.length;
      }
      this.rows = Math.ceil(data.length / this.columns);

      this.zoomOut();

      //set up DOM elements of images
      for (var i=0;i<data.length;i++)
      {
        this.photos.push(new pivot.Photo( {
          container: this.trackingPlane,
          row: this.getRow(i),
          column: this.getColumn(i,row),
          rows: this.rows,
          quality: this.quality,
          id: ('imageItem'+i)
        }));
      }
    },

    getRow: function (i) {
      row = Math.floor(i / this.columns);
      return row;
    },

    getColumn: function (i, row) {
      if (i > (this.columns - 1)) {
        column = i - (this.columns * row);
      } else {
        column = (i);
      }
      return column;
    },


    // Photo selection
    // ---------------

    getPhoto: function (row, column) {
      var selector = supplant('.p-photo[data-row="{row}"][data-column="{column}"]', row, column);
      return this.container.querySelector(selector);
    },

    getSelectedPhoto: function () {
      return this.container.querySelector(".p-photo.selected");
    },

    setSelectedPhoto: function (photo) {
      var selectedPhoto = this.getSelectedPhoto();

      if (selectedPhoto) {
        selectedPhoto.classList.remove("selected");
        selectedPhoto.classList.remove("flipped");
      }

      photo.classList.add("selected");

      this.track();

      return photo;
    },

    //get column and row coord of next image when paging forward
    getNextLocation: function(column, row, selectedPhotoNumber) {
      var newGridLocation = {newColumn: column, newRow: row}

      if (column == (this.columns - 1) || (selectedPhotoNumber == (this.photosPage[this.currentPage].length + 1))) {
        if (row == (this.rows -1)) {
          newGridLocation.newColumn = 0;
          newGridLocation.newRow = 0;
        } else {
          newGridLocation.newColumn = (column + 1) % this.columns;
          newGridLocation.newRow = (row + 1);
        }
      } else {
        newGridLocation.newColumn = (column + 1) % this.columns;
      }
      return newGridLocation;
    },

    //get column and row coord of last image when paging backward
    getLastLocation: function(column, row, selectedPhotoNumber) {
      var newGridLocation = {newColumn: column, newRow: row}
      if (column == 0) {
        if (row == 0) {
          newGridLocation.newColumn = ((this.photosPage[this.currentPage].length % this.columns) - 1);
          if (newGridLocation.newColumn < 0) {newGridLocation.newColumn = (this.columns - 1)}
          newGridLocation.newRow = ((Math.ceil(this.photosPage[this.currentPage].length / this.columns)) - 1);
        } else {
          newGridLocation.newColumn = pivot.util.mod(column - 1, this.columns);
          newGridLocation.newRow = (row - 1);
        }
      } else {
        newGridLocation.newColumn = pivot.util.mod(column - 1, this.columns);
      }
      return newGridLocation;
    },

    cycle: function (direction) {
      var selectedPhoto = this.getSelectedPhoto(),
          row = selectedPhoto ? parseInt(selectedPhoto.getAttribute("data-row"), 10) : 0,
          column = selectedPhoto ? parseInt(selectedPhoto.getAttribute("data-column"), 10) : 0,
          selectedPhotoNumber = (Number((selectedPhoto.id).slice(9)) + 2),
          newGridLocation = {};

      switch (direction) {
      case "left":
        newGridLocation = this.getLastLocation(column, row);
        column = newGridLocation.newColumn;
        row = newGridLocation.newRow;
        break;
      case "right":
        newGridLocation = this.getNextLocation(column, row, selectedPhotoNumber);
        column = newGridLocation.newColumn;
        row = newGridLocation.newRow;
        break;
      }

      this.setSelectedPhoto(this.getPhoto(row, column));
    },

    // Flickr XHR
    // ----------

    sendFlickrRequest: function (feed) {
      this.photoLoadCount = 0;
      this.container.classList.add("gallery-loading");
      pivot.util.getJSON(feed, this.onFlickrResult);
    },

    onFlickrResult: function (data, page) {
      //if images exceed photosPerPage slice data into multiple arrays
      var len = data.photos.photo.length
      for (var i=0; i < len; i += this.photoPerPage){
        photosPage.push(data.photos.photo.slice(i, i + this.photoPerPage));
      }
      //hack to remove original, unprocessed data set from object
      if (len <= this.photoPerPage) {
        photosPage.splice(1,1);
      }

      this.photosPage = photosPage;

      this.getPhotoGrid(photosPage[this.currentPage]);

      photosPage[this.currentPage].forEach(
        function (data, index) {
          this.photos[index].insertFlickrData(data);
      }, this);
    },

    getNewPage: function () {
      this.getPhotoGrid(this.photosPage[this.currentPage]);

      this.photosPage[this.currentPage].forEach(
        function (data, index) {
          this.photos[index].insertFlickrData(data);
      }, this);
    },

    getFlickrPage: function () {
      this.sendFlickrRequest(supplant(this.feed));
    },


    // 3D movement
    // -----------

    zoomIn: function () {
      this.container.classList.add("zoomed");
      this.zoomed = true;
      this.zoomPlane.style[transform] = "translate3d(0, 0, 0)";
      if (photosPage) {
        this.showHidePaging();
      }
      $(".p-backButton-container").hide();
      $(".p-zoomOut-container").show();
      this.track();

      if (!this.tilting) {
        this.tilt();
      }
    },

    zoomOut: function () {
      this.container.classList.remove("zoomed");
      this.zoomed = false;
      if (photosPage) {
        this.showHidePaging();
      }
      $(".p-zoomOut-container").hide();
      if (this.backButton.currentProjectParent != "") {
        $(".p-backButton-container").show();
      }
      this.zoomPlane.style[transform] = supplant("translate3d(0, 0, {z}px)", {
        z: -this.rows * 800
      });
      this.track();
    },

    track: function () {
      var selectedPhoto, trackingTransform;

      if (this.zoomed) {
        // Center selected photo in viewport
        selectedPhoto = this.getSelectedPhoto();
        trackingTransform = supplant("translate3d({x}%, {y}%, -150px)", {
          x: selectedPhoto.getAttribute("data-column") * -100,
          y: selectedPhoto.getAttribute("data-row") * -100
        });
      } else {
        // Center gallery in viewport
        trackingTransform = supplant("translate3d({x}%, {y}%, 1px)", {
          x: (this.columns / 2) * -100 + 50,
          y: (this.rows / 2) * -100 + 50
        });
      }

      this.trackingPlane.style[transform] = trackingTransform;
    },

    tilt: function () {
      var allowedRotation = (this.zoomed && window.orientation === undefined) ? this.allowedRotation / 4 : this.allowedRotation;

      this.tilting = true;

      // Rotation on x and y axis is proportional to mouse position within the container or device movement
      this.rotationDelta.x = (allowedRotation * (this.movementCoordinates.y - 0.5) - this.currentRotation.x) / this.tiltLag;
      this.rotationDelta.y = (allowedRotation * (this.movementCoordinates.x - 0.5) + this.currentRotation.y) / this.tiltLag;

      this.currentRotation.x += this.rotationDelta.x;
      this.currentRotation.y -= this.rotationDelta.y;

      this.tiltPlane.style[transform] = supplant("rotateX({x}deg) rotateY({y}deg)", this.currentRotation.x, this.currentRotation.y);

      // Continue tilting if deltas are still reasonably large
      if (Math.abs(this.rotationDelta.x) + Math.abs(this.rotationDelta.y) > 0.05) {
        setTimeout(this.tilt, 1000 / 30); // Continue rotation at 30 fps
      } else {
        this.tilting = false;
      }
    },

    // Event handlers
    // --------------

    onPhotoLoaded: function () {
      this.photoLoadCount++;

      if (this.photoLoadCount === this.photos.length) {
        this.container.classList.remove("gallery-loading");
      }
    },

    onPhotoClickDelegate: function (event) {
      var photo = pivot.util.ancestor(event.target, ".p-photo");

      //console.error(this.childProject)

      if (event.target !== photo) {
        event.stopPropagation();
      }

      if (photo.objectType == "nodeCard"){
        pivot.setup({quality: 'medium', jsonName: photo.childProject, currentProjectParent: this.feed});
      } else {
        this.setSelectedPhoto(photo);
        if (!this.zoomed) {
          this.zoomIn();
        }
      }

    },

    onSelectedClickDelegate: function (event) {
      this.childProject = event.target.childProject;
      if (this.childProject) {
        if (this.zoomed) {
          this.zoomOut();
        }
        pivot.setup({quality: 'medium', jsonName: this.childProject, currentProjectParent: this.feed});
      }

    },

    getCurrentFileName: function (path) {
      this.path = path;
      this.p_filename = this.path.substr(this.path.lastIndexOf("/") + 1);
      this.p_filename = this.p_filename.substring(0,(this.p_filename.lastIndexOf(".")));
      return this.p_filename;
    },

    onBackButton: function (event) {
      this.path = pivot.Gallery.prototype.getCurrentFileName(event.target.currentProjectParent);
      if (this.path) {
        pivot.setup({quality: 'medium', jsonName: this.path});
      }
    },

    onCloseButton: function (event) {
      $('.galleryNav').removeClass("gallery-fadeOut").addClass("gallery-fadeIn");
      $('.menu-bar').children().each( function( index ) {
        if (!($(this).attr('jumpTo') == '#me')) {
          $(this).removeClass('menu-bar-selected');
        }
      });
      var html = $("html");
      html.css("overflow-y", "scroll");
      $("#mainMenu").css("width", "100%");
      $('.pivot').remove();
    },

    onViewportMouseWheel: function (event) {
        if (event.wheelDelta || event.detail < 0) {
          this.zoomOut();
        } else {
          var photo = pivot.util.ancestor(event.target, ".p-photo");
          if (event.target !== photo) {
          event.stopPropagation();
        } else {

          this.onPhotoClickDelegate(event);
        }
      }
    },

    // Define some keyboard shortcuts
    onKeyDown: function (event) {
      switch (event.keyCode) {
      case 37:  // Left arrow. Previous Photo.
        this.cycle('left');
        break;
      case 39: // Right arrow. Next Photo.
        this.cycle('right');
        break;
      case 13: // Enter. Flip photo.
        this.getSelectedPhoto().classList.toggle("flipped");
        break;
      case 32: // Spacebar. Toggle zoom.
        if (this.zoomed) {
          this.zoomOut();
        } else {
          this.zoomIn();
        }
        break;
      }
    },

    onContainerMouseMove: function (event) {
      this.movementCoordinates = pivot.util.localCoordinates(event, this.container);

      if (!this.tilting) {
        this.tilt();
      }
    },

    onDeviceMotion: function (event) {
      var portrait = (window.orientation % 180) === 0,
          vertAxis = portrait ? "x" : "y",
          horizAxis = portrait ? "y" : "x",
          mod;

      mod = {
        x: (window.orientation === 180 || window.orientation === 90) ? -1 : 1,
        y: (window.orientation === 0 || window.orientation === 90) ? -1 : 1
      };

      this.movementCoordinates.x = (mod[vertAxis] * event.accelerationIncludingGravity[vertAxis] + 10) / 20;
      this.movementCoordinates.y = (mod[horizAxis] * event.accelerationIncludingGravity[horizAxis] + 10) / 20;

      if (!this.tilting) {
        this.tilt();
      }
    },

    onOrientationChange: function (event) {
      this.constrainLayout();
    },

    onShow: function () {
      // Turn off scroll bars to prevent the scroll wheel from affecting the main page.  Make sure turning off the scrollbars doesn't shift the position of the content.
      // This solution works Chrome 12, Firefox 4, IE 7/8/9, and Safari 5.
      // It turns off the scroll bars, but doesn't prevent the scrolling, in Opera 11 and Safari 5.
      var oldBodyOuterWidth = $("body").outerWidth(true);
      var newBodyOuterWidth;
      $("html").css("overflow-y", "hidden");
      newBodyOuterWidth = $("body").outerWidth(true);
      $("body").css("margin-right", (newBodyOuterWidth - oldBodyOuterWidth + parseInt(this.oldBodyMarginRight)) + "px");
      $("#mainMenu").css("width", oldBodyOuterWidth + "px");
    },

    onNextPage: function (event) {
      if (this.zoomed) {
        this.cycle('right');
      } else {
        if (this.photosPage.length > 1) {
          this.currentPage += 1;
        }
        pivot.setup({quality: 'medium', galleryData: this.photosPage, currentPage: this.currentPage, currentProjectParent: this.backButton.currentProjectParent});
      }
    },

    onPreviousPage: function (event) {
      if (this.zoomed) {
        this.cycle('left');
      } else {
        if (this.photosPage.length > 1) {
          this.currentPage -= 1;
        }
        pivot.setup({quality: 'medium', galleryData: this.photosPage, currentPage: this.currentPage, currentProjectParent: this.backButton.currentProjectParent});
      }
    }

  };

  pivot.setup = function (options) {
    if (Modernizr && Modernizr.matchesselector && Modernizr.csstransforms3d) {
      if ($('.pivot').length != 0) {
        $('.pivot').remove();
      }
      return new pivot.Gallery(options);
    }
  };

}(this));

(function (window) {

  var pivot = window.pivot || (window.pivot = {}),
      document = window.document,
      supplant = pivot.util.supplant,
      transform = Modernizr.prefixed("Transform");

  pivot.Photo = function (options) {

    this.row = options.row;
    this.column = options.column;
    this.rows = options.rows;
    this.id = options.id
    this.quality = options.quality;

    this.aspectRatio = 1;


    // Define load event to bubble towards gallery
    // when the photo is done loading (or failed loading)
    this.loadEvent = document.createEvent("Events");
    this.loadEvent.initEvent("load", true, false);

    this.nodeLoadEvent = document.createEvent("Events");
    this.nodeLoadEvent.initEvent("nodeLoad", true, false);

    // Setup DOM
    // ---------

    this.container = pivot.util.makeElement("itemCard", {
      "class": "p-photo loading no-img",
      "data-row": this.row,
      "data-column": this.column
    });

    this.container.style[transform] = supplant("translate3d({x}%, {y}%, 1px)", {
      x: this.column * 100,
      y: this.row * 100
    });

    this.backing = pivot.util.makeElement("div", {
      "class": "p-backing"
    });
    // Set random starting position for backing element
    this.backing.style[transform] = supplant("translate3d({x}px, {y}px, {z}px) rotate({r}deg)", {
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      z: Math.random() * -16000,
      r: Math.random() * -16000
    });
    this.backing.style.opacity = 0;
    this.container.appendChild(this.backing);

    this.imageWrapper = pivot.util.makeElement("div", {"class": "p-image-wrapper"});
    this.container.appendChild(this.imageWrapper);

    this.caption = pivot.util.makeElement("figcaption");
    this.imageWrapper.appendChild(this.caption);

    this.image = pivot.util.makeElement("img", {draggable: false});
    this.imageWrapper.appendChild(this.image);

    this.loader = pivot.util.makeElement("img", {"class": "loadingSpinner", draggable: false});
    this.loader.src = "../images/loader.png";
    this.backing.appendChild(this.loader);

    this.imagePreloader = new Image();

    options.container.appendChild(this.container);

    // Setup events
    // ------------

    this.completeLoading = this.completeLoading.bind(this);

    this.imagePreloader.addEventListener("load", this.onImagePreloaderLoad.bind(this), false);
    this.imagePreloader.addEventListener("error", this.onImagePreloaderError.bind(this), false);

    this.imageWrapper.addEventListener("click", this.onImageWrapperClick.bind(this), false);

    this.backing.addEventListener("webkitAnimationEnd", this.onBackingAnimationEnd = this.onBackingAnimationEnd.bind(this), false);
    this.backing.addEventListener('animationend', this.onBackingAnimationEnd, false);

    // Finalize setup
    // --------------

    // Reset 'backing' transform on next redraw
    setTimeout(this.resetBackingTransform.bind(this), 0);

  };

  pivot.Photo.prototype = {

    setSource: function (source) {
      if (this.image.src !== source) {
        this.container.classList.add("loading");
        this.container.classList.remove("flipped");
        this.imagePreloader.src = source;
      } else {
        this.onImagePreloaderError();
      }
    },

    setCaption: function (caption) {
      this.caption.innerHTML = caption;
    },

    insertFlickrData: function (data) {
      // Add page url and other properties from json

      // photoProperties = data;
      data.pageURL = supplant(pivot.flickr.pageURL, data);

      this.container.setAttribute("id",this.id);
      this.container.objectType = data.objectType;
      this.container.childProject = data.childProject;

      data.title = data.title || "Untitled";
      this.setCaption(supplant(pivot.flickr.captionTemplate, data));
      this.setSource(supplant(pivot.flickr.sourceURLs[this.quality], data));
    },

    resetBackingTransform: function () {
      this.backing.style.cssText = '';
    },

    completeLoading: function () {
      // Set source of visible image
      this.image.src = this.imagePreloader.src;

      // Check aspect ratio of new image
      var ar = this.image.naturalWidth / this.image.naturalHeight;

      // Setup dimensions/offsets so image wrapper is centered
      if (ar < 1) {
        this.wrapperDimensions = supplant("top: {top}%; left: 5%; width: 90%; height: {height}%;", {
          top: 5,
          height: 90
        });
      } else {
        this.wrapperDimensions = supplant("top: 5%; left: {left}%; width: {width}%; height: 90%;", {
          left: 5,
          width: 90
        });
      }

     this.imageWrapper.style.cssText = this.wrapperDimensions;

      // Unhides image wrapper
      this.container.classList.remove("loading");
      this.container.classList.remove("no-img");

      // Plays 'fly-in' animation
      this.container.classList.add("done-loading");

      // Bubble a load event for the gallery to catch
      this.container.dispatchEvent(this.loadEvent);
    },

    // Event handlers
    // --------------

    onBackingAnimationEnd: function (event) {
      // Set backing size to recently calculated dimensions/offset.
      // This ensures that the backing flying aways has the same size as the photo being replaced.
      this.backing.style.cssText = this.wrapperDimensions;
      this.container.classList.remove("done-loading");
    },

    onImagePreloaderLoad: function () {
      // Delay setting of image src
      setTimeout(this.completeLoading, (this.column + this.row * this.rows) * 250);
    },

    onImagePreloaderError: function () {
      this.container.classList.add("no-img");
      // On error dispatch event anyway to signal gallery that
      // this image isn't loading anymore
      this.container.dispatchEvent(this.loadEvent);
    },

    onImageWrapperClick: function (event) {
      if (pivot.util.matchesSelector(this.container, ".pivot.zoomed .p-photo.selected")) {
        event.stopPropagation();

        //get parent of parent of imagewrapper which has
        var e = event.target.parentNode;
        e = e.parentNode;

        //if card is not a node show the back otherwise load children of node
        if (e.objectType !== "nodeCard") {
          this.container.classList.toggle("flipped");
        } else {
          this.container.dispatchEvent(this.nodeLoadEvent);
        }
      }
    }

  };

}(this));

(function (window) {

  var pivot = window.pivot || (window.pivot = {});

  pivot.flickr = {
    captionTemplate: '<h1><a href="{pageURL}" target="blank" tabindex="-1">{title}</a></h1><p>{description}</p>',

    sourceURLs: {
      high: "http://farm{farm}.static.flickr.com/{server}/{id}_{secret}_b.jpg",
      medium: "http://dlduckworth.com/{imagePath}/{category}/{project}/{imageName_lg}",
      low: "http://farm{farm}.static.flickr.com/{server}/{id}_{secret}_m.jpg"
    },

    pageURL: "http://dlduckworth.com/{imagePath}/{category}/{project}/{imageName_lg}",

    feeds: {
      jsonFeed: "../json/{jsonName}.json",

      group: "http://api.flickr.com/services/rest/?method=flickr.groups.pools.getPhotos&api_key=6fff138dbd0fbe330c07a67c47c9cc21&group_id={groupId}&per_page={perPage}&page={page}&extras=description,owner_name&format=json&nojsoncallback=1",

      interesting: "../json/interface_mixprototype.json"
    }
  };

}(this));
