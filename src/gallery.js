
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
    this.tiltLag = 7;

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
    this.zoomOutButton.addEventListener("click", this.zoomOut.bind(this), false);

    this.nextPage.addEventListener("click", this.onNextPage.bind(this), false);
    this.lastPage.addEventListener("click", this.onPreviousPage.bind(this), false);

    //this.container.zoomOut = this.zoomOut.bind(this);
    //this.container.addEventListener("click", this.zoomOut, false);

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
      //this.showHidePaging();
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
      //this.showHidePaging();
      $(".p-zoomOut-container").hide();
      $(".p-backButton-container").show();
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
      this.container = pivot.util.ancestor(event.target, ".pivot");
      this.container.classList.add("gallery-fadeOut");
      $('.galleryNav').removeClass("gallery-fadeOut").addClass("gallery-fadeIn");
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

    onClose: function () {
        $('.menu-bar').children().each( function( index ) {
          $(this).removeClass('menu-bar-selected');
        });
        var html = $("html");
        html.css("overflow-y", "scroll");
        $("#mainMenu").css("width", "100%");
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
