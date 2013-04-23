
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
