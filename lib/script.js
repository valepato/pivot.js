/**
 * Parallax Scrolling Tutorial
 * For NetTuts+
 *  
 * Author: Mohiuddin Parekh
 *	http://www.mohi.me
 * 	@mohiuddinparekh   
 */



$(document).ready(function(){

	// Cache the Window object
	$window = $(window);

	if (Modernizr && !Modernizr.csstransforms3d) {
		$('#warningPopup').bPopup({
			positionStyle: "fixed",
			scrollBar: false
		});	
	}

	//Set up event listeners for menu bar
	$('#menuBar').children().each( function( index ) {
	   	$(this).bind('click', function(){
	   		//remove selected state on all menu items
	   		$('.menu-bar').children().each( function( index ) {
	   			$(this).removeClass('menu-bar-selected');
	   		});
	   		//add selected state
	   		$(this).addClass("menu-bar-selected");
	   		
			var category = $(this).attr('category');
			var section = $(this).attr('jumpTo');
			console.error(category)
			if (checkElementTop(section) && category != "") {
				loadGallery(category);
			} else {
				$('html, body').animate({scrollTop: $(section).offset().top}, 2000, function() {
					$('html, body').clearQueue();
					if (category != "") {
						loadGallery(category);
					}
				});
				return false;
			}
		}); 
	});

	
$('#galleryNavButton').bind('click', 
		function(){
			$('#menu01').addClass("menu-bar-selected");
			loadGallery("projects_interface");
		}
	);
	//$('#galleryMenu').click(loadGallery("projects_interface"));

	$(window).scroll(function(e){ 
		 $element = $('#mainMenu');
		 if ($(this).scrollTop() > 625 && $element.css('position') != 'fixed'){ 
		 	$('#mainMenu').css({'position': 'fixed', 'top': '0px'}); 
		 } 
		 if ($(this).scrollTop() < 625 && $element.css('position') == 'fixed'){
		 	$('#mainMenu').css({'position': 'relative', 'top': ''});
		 }
	});

	$(window).bind('scroll',function(e){
    	parallaxScroll();
    });

    /* Scroll the background layers */
	function parallaxScroll(){
		var scrolled = $(window).scrollTop();
		$('#parallax-bg1').css('top',(0-(scrolled*.50))+'px');
		$('#parallax-bg2').css('top',(0-(scrolled*.75))+'px');
		$('#parallax-bg3').css('top',(0-(scrolled*.90))+'px');
	}
                


/* 
 * Helper functions
 */

 	//check to see if element is at the top of the window
    function checkElementTop (element) {
   		var element = $(element);
		if ($window.scrollTop() == element.offset().top) {
			return true;
		} else {
			return false;
		}
    }

    function loadGallery (category) {
    	$('.galleryNav').removeClass("gallery-fadeIn").addClass("gallery-fadeOut");
    	pivot.Gallery.prototype.onShow();
   		pivot.setup({quality: 'medium', jsonName: category});
    }

}); 

/* 
 * Create HTML5 elements for IE's sake
 */

document.createElement("article");
document.createElement("section");
