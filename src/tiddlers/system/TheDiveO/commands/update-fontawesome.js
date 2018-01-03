/*\
title: $:/TheDiveO/commands/update-fontawesome.js
type: application/javascript
module-type: command

The update-fontawesome command fetches the most recent
Font Awesome 5.x zip package, extracts the required files,
and then updates the corresponding plugin tiddlers.

Requires nodejs modules:
- adm-zip
- compare-versions

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.info = {
	name: "update-fontawesome",
	synchronous: true
};

var Command = function(params, commander) {
	this.params = params;
	this.commander = commander;
	this.logger = new $tw.utils.Logger("--" + exports.info.name);
};

/*
*/
Command.prototype.execute = function() {
  if (this.params.length < 1) {
		return "Missing Font Awesome path and file name";
	}
  var force = false;
  if (this.params.length >= 2 && this.params[1] === "force") {
    force = true;
  }

	var wiki = this.commander.wiki,
		self = this,
		fs = require("fs"),
    zip = require("adm-zip"),
    versioning = require("compare-versions");

	self.logger.log("updating plugin from local Font Awesome zip package...");
  self.logger.log("opening zip package:", self.params[0]);
  var fazip = new zip(self.params[0]);

  // Autodetect the Font Awesome version...
  var faroot = fazip.getEntries()[0].entryName.split("/")[0];
  if (!faroot.startsWith("fontawesome-")) {
    return "invalid Font Awesome zip package: missing or invalid path root " + faroot;
  }
  var match = /^fontawesome-.*-(\d+\.\d+\.\d+)$/.exec(faroot);
  if (match === null) {
    return "cannot autodetect Font Awesome version from path root " + faroot;
  }
  var faversion = match[1];
  self.logger.log("autodetected Font Awesome version", faversion);

  // Check if newer than plugin...
  var faversionplugin = wiki.getTiddler("$:/plugins/TheDiveO/FontAwesome").fields["fa-version"];
  self.logger.log("plugin Font Awesome version", faversionplugin);
  if (versioning(faversionplugin, faversion) >=  0 && !force) {
    return "update not possible: zip package is older or equal to plugin";
  }

  // Embedd the font files...
  $tw.utils.each([
      {
        fontfile: "fa-brands-400",
        fontfamily: "Font Awesome 5 Brands",
        fontstyle: "normal",
        fontweight: "normal"
      }, {
        fontfile: "fa-regular-400",
        fontfamily: "Font Awesome 5 Free",
        fontstyle: "normal",
        fontweight: "400"
      }, {
        fontfile: "fa-solid-900",
        fontfamily: "Font Awesome 5 Free",
        fontstyle: "normal",
        fontweight: "900"
      }
    ], function(font) {
      self.logger.log("extracting", font.fontfile);
      var woffname = faroot + "/web-fonts-with-css/webfonts/" + font.fontfile + ".woff"
      var woff = fazip.readFile(woffname);
      if (woff === null) {
        return "missing WOFF web font file " + woffname;
      }
      var text = "@font-face { ";
      text += "font-family: '" + font.fontfamily + "'; ";
      text += "font-style: '" + font.fontstyle + "'; ";
      text += "font-weight: '" + font.fontweight + "'; ";
      text += "src: url(data:application/font-woff;charset=utf-8;base64,"
        + woff.toString("base64")
        + ") format ('woff'); ";
      text += "}";
  });

  self.logger.log("...update succeeded");
	return null; // done & okay
};

// Finally export the constructor function for this command.
exports.Command = Command;

})();
