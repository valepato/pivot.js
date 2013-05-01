
(function (window) {

  var pivot = window.pivot || (window.pivot = {}),
      document = window.document,
      supplant = pivot.util.supplant,
      transform = Modernizr.prefixed("Transform");

  pivot.Gallery = function (options) {

    var row, column, feedArguments;

    this.wrapper = options.wrapper || document.body;

    this.quality = options.quality || "medium";

    this.page = 1;
    this.perPage = this.rows * this.columns;

    feedArguments = { perPage: this.rows * this.columns };

    // Choose feed
    if (options.jsonName) {
      this.feed = pivot.flickr.feeds.jsonFeed;
      feedArguments.jsonName = options.jsonName;
    } else if (options.groupId) {
      this.feed = pivot.flickr.feeds.group;
      feedArguments.groupId = options.groupId;
    } else {
      this.feed = pivot.flickr.feeds.interesting;
    }

    // Insert feed arguments
    this.feed = supplant(this.feed, feedArguments);

    // Holds amount of photos loaded or timed out
    this.photoLoadCount = 0;

    // Aspect ratio of the images, Fix: make data driven
    this.aspectRatio = 1.78;

    // Holds pivot.Photos
    this.photos = [];

    this.rows = 2;
    this.columns = 3;

    var oldBodyMarginRight = $("body").css("margin-right");

    // Tilt settings/variables
    // -----------------------
    this.allowedRotation = options.allowedRotation || (window.orientation) ? 120 : 90;

    // Holds how fast tilting reacts to mouse movement.
    // Lower is faster.
    this.tiltLag = 7;

    this.rotationDelta = { x: 0, y: 0 };
    this.movementCoordinates = { x: 0, y: 0 };
    this.currentRotation = { x: 0, y: 0 };

    // Bind some class methods to this object
    // --------------------------------------

    this.onFlickrResult = this.onFlickrResult.bind(this);
    this.getNextFlickrPage = this.getNextFlickrPage.bind(this);
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
    setTimeout(this.getFlickrPage, 400);

    //set up back and close buttons
    this.controls = pivot.util.makeElement("div", { "class": "p-controls" });
    this.refreshContainer = pivot.util.makeElement("div", { "class": "p-refresh-container" });
    this.refresh = pivot.util.makeElement("button", { "class": "p-refresh" });
    this.backButtonContainer = pivot.util.makeElement("div", { "class": "p-backButton-container" });
    this.backButton = pivot.util.makeElement("button", { "class": "p-backButton" });
    this.backButtonContainer.appendChild(this.backButton);
    this.refreshContainer.appendChild(this.refresh);
    this.controls.appendChild(this.backButtonContainer);
    this.controls.appendChild(this.refreshContainer);
    this.backButton.currentProjectParent = options.currentProjectParent || "";

    this.constrainLayout();

    this.container.appendChild(this.viewport);
    this.container.appendChild(this.controls);

    // Setup events
    // ------------

    window.addEventListener("resize", this.constrainLayout, false);
    this.trackingPlane.addEventListener("load", this.onPhotoLoaded.bind(this), false);
    this.trackingPlane.addEventListener("nodeLoad", this.onSelectedClickDelegate.bind(this), false);
    document.addEventListener("keydown", this.onKeyDown.bind(this), false);
    pivot.util.delegate(this.viewport, ".p-photo", "click", this.onPhotoClickDelegate.bind(this));

    // Turnning off scroll wheel for now
    // this.viewport.addEventListener("mousewheel", this.onViewportMouseWheel.bind(this), false);
    // this.viewport.addEventListener("DOMMouseScroll", this.onViewportMouseWheel.bind(this), false);

    this.refresh.addEventListener("click", this.onCloseButton, false);
    this.backButton.addEventListener("click", this.onBackButton, false);

    this.zoomOut = this.zoomOut.bind(this);
    this.container.addEventListener("click", this.zoomOut, false);

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

    // Set up photo grid
    // ---------------

    getPhotoGrid: function (data) {
      if (data.photos.photo.length < this.columns) {
        this.columns = data.photos.photo.length;
      }
      this.rows = Math.ceil(data.photos.photo.length / this.columns);
      this.zoomOut();

      for (var i=0;i<data.photos.photo.length;i++)
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

    // Flickr XHR
    // ----------

    sendFlickrRequest: function (feed) {
      this.photoLoadCount = 0;
      this.container.classList.add("gallery-loading");
      pivot.util.getJSON(feed, this.onFlickrResult);
    },

    onFlickrResult: function (data) {
      this.getPhotoGrid(data);

      data.photos.photo.forEach(
      function (data, index) {
        this.photos[index].insertFlickrData(data);
      }, this);

      // If amount of photos returned is less than space available clear source of unused photos.
      // Increase photoLoadCount by unused amount as setting source to '' does not generate event.
      this.photoLoadCount += this.photos.length - data.photos.photo.length;
      this.photos.slice(data.photos.photo.length).forEach(
      function (photo) {
        photo.setSource('');
      });
    },

    getFlickrPage: function (page) {
      this.page = (page > 0) ? page : 1;
      this.sendFlickrRequest(supplant(this.feed, {
        page: this.page
      }));
    },

    getNextFlickrPage: function () {
      this.getFlickrPage(this.page + 1);
    },

    cycle: function (direction) {
      var selectedPhoto = this.getSelectedPhoto(),
          row = selectedPhoto ? parseInt(selectedPhoto.getAttribute("data-row"), 10) : 0,
          column = selectedPhoto ? parseInt(selectedPhoto.getAttribute("data-column"), 10) : 0;

      switch (direction) {
      case "left":
        column = pivot.util.mod(column - 1, this.columns);
        break;
      case "right":
        column = (column + 1) % this.columns;
        break;
      case "up":
        row = pivot.util.mod(row - 1, this.rows);
        break;
      case "down":
        row = (row + 1) % this.rows;
        break;
      case "next":
        if (column < this.columns - 1) {
          column++;
        } else {
          column = 0;
          row = (row < this.rows - 1) ? row + 1 : 0;
        }
        break;
      case "prev":
        if (column) { // !== 0
          column--;
        } else {
          column = this.columns - 1;
          row = row ? row - 1 : this.rows - 1;
        }
        break;
      }

      this.setSelectedPhoto(this.getPhoto(row, column));
    },

    // 3D movement
    // -----------

    zoomIn: function () {
      this.container.classList.add("zoomed");
      this.zoomed = true;
      this.zoomPlane.style[transform] = "translate3d(0, 0, 0)";
      this.track();

      if (!this.tilting) {
        this.tilt();
      }
    },

    zoomOut: function () {
      this.container.classList.remove("zoomed");
      this.zoomed = false;
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

      if (event.target !== photo) {
        event.stopPropagation();
      }

      this.setSelectedPhoto(photo);
      if (!this.zoomed) {
        this.zoomIn();
      }
    },

    onSelectedClickDelegate: function (event) {
      this.childProject = event.target.childProject;
      if (this.childProject) {
        if (this.zoomed) {
          this.zoomOut();
        }
        pivot.setup({quality: 'medium', jsonName: this.childProject, /*wrapper: document.getElementById("about"),*/ currentProjectParent: this.feed});
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
        pivot.setup({quality: 'medium', jsonName: this.path/*, wrapper: document.getElementById("about")*/});
      }
    },

    onCloseButton: function (event) {
      this.container = pivot.util.ancestor(event.target, ".pivot");
      this.container.classList.add("gallery-fadeOut");
      pivot.Gallery.prototype.onClose();
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
      case 38: // Up arrow. Photo above.
        this.cycle('up');
        break;
      case 40: // Down arrow. Photo beneath.
        this.cycle('down');
        break;
      case 13: // Enter. Flip photo.
        this.getSelectedPhoto().classList.toggle("flipped");
        break;
      case 82: // R. Next page.
        this.getNextFlickrPage();
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

    onClose: function () {
        $('.menu-bar').children().each( function( index ) {
          $(this).removeClass('menu-bar-selected');
        });
        var html = $("html");
        html.css("overflow-y", "scroll");
        $("#mainMenu").css("width", "100%");
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
