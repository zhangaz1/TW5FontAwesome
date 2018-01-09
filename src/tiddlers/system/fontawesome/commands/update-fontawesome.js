/*\
title: $:/TheDiveO/commands/update-fontawesome.js
type: application/javascript
module-type: command

The `update-fontawesome` command takes a locally downloaded
[[Font Awesome 5.x Free zip package|https://fontawesome.com/?utm_source=font_awesome_homepage&utm_medium=display&utm_campaign=fa5_released&utm_content=banner]]
and then extracts the WOFF font files as well as some CSS files
in order to update the FontAwesome plugin tiddlers.

In order to run this command, the following Nodejs modules
need to be installed:

* `adm-zip`
* `compare-versions`

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
  self.logger.log("autodetected Font Awesome version in zip package:", faversion);

  // Check if newer than plugin...
  var faversionplugin = wiki.getTiddler("$:/plugins/TheDiveO/FontAwesome").fields["fa-version"];
  self.logger.log("current plugin Font Awesome version:", faversionplugin);
  if (versioning(faversionplugin, faversion) >=  0 && !force) {
    return "update not possible: zip package is older or equal to plugin";
  }

  // Embedd the Font Awesome font files...
  // ...please note that we deal with the free package only. If you need
  // pro support, then please fork this project, make the necessary additions,
  // and create a PR (pull request) -- do NOT check-in the FA pro font files or
  // FA pro tiddlers to GitHub. Don't create PRs that contain FA pro fonts.
  $tw.utils.each([
      {
        fontfile: "fa-brands-400",
        fontfamily: "Font Awesome 5 Brands",
        fontstyle: "normal",
        fontweight: "normal",
        cssclass: ".fab",
        title: "Font Awesome 5 Free Brands"
      }, {
        fontfile: "fa-regular-400",
        fontfamily: "Font Awesome 5 Free",
        fontstyle: "normal",
        fontweight: "400",
        cssclass: ".far",
        title: "Font Awesome 5 Free Regular"
      }, {
        fontfile: "fa-solid-900",
        fontfamily: "Font Awesome 5 Free",
        fontstyle: "normal",
        fontweight: "900",
        cssclass: ".fa, .fas",
        title: "Font Awesome 5 Free Solid"
      }
    ], function(font) {
      self.logger.log("extracting Font Awesome font file", font.fontfile + ".woff");
      var woffname = faroot + "/web-fonts-with-css/webfonts/" + font.fontfile + ".woff";
      var woff = fazip.readFile(woffname);
			if (woff === null) {
        return "zip package misses WOFF web font file " + woffname;
      }
      var woffb64 = woff.toString("base64");
			self.logger.log("WOFF font binary size", Buffer.byteLength(woff),
				"/", "base64-encoded size", woffb64.length);
      var text = "/* autoimported retrieved from '" + faroot + "' */\n";
			text += "@font-face {\n";
      text += "  font-family: '" + font.fontfamily + "';\n";
      text += "  font-style: " + font.fontstyle + ";\n";
      text += "  font-weight: " + font.fontweight + ";\n";
      text += "  src: url('data:application/font-woff;charset=utf-8;base64,"
        + woffb64 + "') format('woff');\n";
      text += "}\n\n";
      text += font.cssclass + " {\n";
      text += "  font-family: '" + font.fontfamily + "';\n";
      text += "  font-style: " + font.fontstyle + ";\n";
      text += "  font-weight: " + font.fontweight + ";\n";
      text += "}\n";

      var fontcsstiddler = new $tw.Tiddler({
        title: "$:/plugins/TheDiveO/FontAwesome/fonts/" + font.title + ".css",
        type: "text/css",
        tags: "$:/tags/Stylesheet",
        text : text
      });
      wiki.addTiddler(fontcsstiddler);
  });

	// Retrieve the Font Awesome CSS file containing all the nifty
	// class definitions...
	self.logger.log("updating plugin styles/fontawesome 5.css");
	var fa5css = fazip.readAsText(faroot + "/web-fonts-with-css/css/fontawesome.css");
	if (fa5css === null) {
		return "zip package misses fontawesome.css file";
	}
	var csstiddler = new $tw.Tiddler({
		title: "$:/plugins/TheDiveO/FontAwesome/styles/fontawesome 5.css",
		type: "text/css",
		tags: "$:/tags/Stylesheet",
		text: "/* autoimported from '" + faroot + "' */\n"
			+ fa5css
	});
	wiki.addTiddler(csstiddler);

	// Now import the glyph metadata...
	self.logger.log("updating glyph metadata");
	var faiconmetadata = fazip.readAsText(faroot + "/advanced-options/metadata/icons.json");
	if (faiconmetadata === null) {
		return "zip package misses icons.json file";
	}
	var glyphmd;
  try {
    glyphmd = JSON.parse(faiconmetadata);
  } catch(ex) {
    return "invalid icons.json metadata file: " + ex.message;
  }

  // Each glyph/icon gets its own top-level property. We use this for the
  // data tiddler title.
  var glyphs = 0;
  var fontclassenames = {
    "brands": "fab",
    "solid": "fas",
    "regular": "far"
  };
  $tw.utils.each(glyphmd, function(glyph, glyphid) {
    ++glyphs;

    // Derive the default CSS class to use for a given glyph/icon...
    var defaultstyle = fontclassenames[glyph["styles"][0]];

    // Which font variants are available...?
    var fontcssclasses = [];
    $tw.utils.each(glyph["styles"], function(style) {
      fontcssclasses.push(fontclassenames[style]);
    });

    // Knock together suitable (search) tags...
    var terms = glyph["search"]["terms"];
    terms.push.apply(terms, glyph["styles"]);

    // We can finally create the glyp metadata tiddler.
    var tiddler = new $tw.Tiddler({
      // ...standard tiddler fields
      "title": "$:/fontawesome/glyph/" + glyphid,
      "tags": $tw.utils.stringifyList(terms),
      "text": "<i class='" + defaultstyle + " fa-" + glyphid + " fa-10x'></i>",

      // ...additional Font Awesome related fields
      "fa-unicode": glyph["unicode"],
      "fa-label": glyph["label"],
      "fa-styles": $tw.utils.stringifyList(glyph["styles"]),
      "fa-style-classes": fontcssclasses.join(" "),
      "fa-default-style": defaultstyle
    });
    $tw.wiki.addTiddler(tiddler);
  });

  self.logger.log("imported", glyphs, "glyphs");

  self.logger.log("...update succeeded; plugin Font Awesome upgraded to version:", faversion);
	return null; // done & okay
};

// Finally export the constructor function for this command.
exports.Command = Command;

})();
