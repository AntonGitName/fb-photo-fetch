var fs = require("fs");
var async = require("async");
var path = require("path");
var debug = require("debug")("download");
var request = require("request");
var mkdirp = require("mkdirp");
var streamToBuffer = require("stream-to-buffer");
var touch = require("touch");

var addExif = require("./add_exif");

var resolution = function (x) {
	return x.width * x.height;
};
var compare = function (a, b) {
	return resolution(b) - resolution(a);
};

module.exports = function(albums, dest, photoSelector) {
  mkdirp.sync(dest);

  async.each(albums, downloadAlbum, function(err) {
    if (err) throw err;

    debug("Finished downloading all albums");
  });

  function downloadAlbum(album, dlAlbumCb) {
    var albumPath = path.join(dest, album.name);

    mkdirp.sync(albumPath);

    async.each(album.photos.filter(photoSelector), downloadPhoto, function(
      err
    ) {
      debug("Finished downloading " + album.name);
      dlAlbumCb(err);
    });

    function downloadPhoto(photo, cb) {
      var filePath = path.join(albumPath, photo.id + ".jpg");

      fs.stat(filePath, function(stat_err, stats) {
        if (stat_err) {
					var link = photo.source;
					if (Array.isArray(photo.images) && photo.images.length > 0) {
						link = photo.images.sort(compare)[0].source;
					}

					request(link)
            .on("response", function(response) {
              streamToBuffer(response, function(err, buffer) {
                if (err) {
                  return debug("Error converting " + (photo.name || photo.id));
                }

                var result = addExif(photo, buffer.toString("binary"));

                fs.writeFile(filePath, result, "binary", function(err) {
                  if (err) {
                    return cb(err);
                  }

                  var opts = {
                    time: photo.created_time
                  };

                  setTimeout(function() {
                    touch(filePath, opts, cb);
                  }, 10);
                });
              });
            })
            .on("error", function(err) {
              debug("Error downloading " + photo.id + err.toString());
            });
        }
      });
    }
  }
};
