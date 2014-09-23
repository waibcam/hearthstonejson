"use strict";

var base = require("xbase"),
	util = require("util"),
	C = require("C"),
	runUtil = require("xutil").run,
	rimraf = require("rimraf"),
	printUtil = require("xutil").print,
	fs = require("fs"),
	glob = require("glob"),
	path = require("path"),
	dustUtil = require("xutil").dust,
	moment = require("moment"),
	tiptoe = require("tiptoe");

var dustData = 
{
	title           : "Hearthstone card data in JSON format",
	sets            : {},	// Later changed to []
	version         : "2.1.0",
	patchVersion    : "1.2.0.6485",
	lastUpdated     : "Sep 23, 2014",
	allSizeLangs    : [],
	allSizeZipLangs : [],
	changeLog       : fs.readFileSync(path.join(__dirname, "changelog.html"), {encoding : "utf8"})
};

var WEB_OUT_PATH = path.join(__dirname, "json");
var allSetsAllLanguages = {};

tiptoe(
	function removeJSONDirectory()
	{
		rimraf(path.join(WEB_OUT_PATH), this);
	},
	function createJSONDirectory()
	{
		fs.mkdir(path.join(WEB_OUT_PATH), this);
	},
	function findJSON()
	{
		glob(path.join(__dirname, "..", "out", "*.enUS.json"), this);
	},
	function processJSON(jsonFiles)
	{
		this.data.setNames = jsonFiles.map(function(jsonFile)
		{
			var setName = path.basename(jsonFile.substring(0, jsonFile.indexOf(".enUS.json")));
			dustData.sets[setName] = {sizeLangs:[]};
			return setName;
		}).sort();

		C.LANGUAGES.serialForEach(function(language, cb) { processLanguage(this.data.setNames, language, cb); }.bind(this), this);
	},
	function makeSymlinks()
	{
		fs.symlink("AllSets.enUS.json", path.join(WEB_OUT_PATH, "AllSets.json"), this.parallel());
		fs.symlink("AllSets.enUS.json.zip", path.join(WEB_OUT_PATH, "AllSets.json.zip"), this.parallel());

		fs.writeFileSync(path.join(WEB_OUT_PATH, "AllSetsAllLanguages.json"), JSON.stringify(allSetsAllLanguages), {encoding:"utf8"});
		dustData.allSetsAllLanguagesSize = printUtil.toSize(JSON.stringify(allSetsAllLanguages).length, 1);
		runUtil.run("zip", ["-9", "AllSetsAllLanguages.json.zip", "AllSetsAllLanguages.json"], { cwd:  WEB_OUT_PATH, silent : true }, this.parallel());

		this.data.setNames.forEach(function(setName)
		{
			fs.symlink(setName + ".enUS.json", path.join(WEB_OUT_PATH, setName + ".json"), this.parallel());
		}.bind(this));
	},
	function verifyJSON()
	{
		base.info("Verifying JSON...");

		checkCardDataTypes(this.data.setNames, this.parallel());
	},
	function saveOtherJSON()
	{
		base.info("Saving other JSON...");

		fs.writeFile(path.join(WEB_OUT_PATH, "SetList.json"), JSON.stringify(this.data.setNames.sort()), {encoding : "utf8"}, this.parallel());
		fs.writeFile(path.join(WEB_OUT_PATH, "version.json"), JSON.stringify({version:dustData.version}), {encoding : "utf8"}, this.parallel());
	},
	function render()
	{
		base.info("Rendering index...");

		var newSets = [];
		Object.forEach(dustData.sets, function(key, value) { value.name = key; newSets.push(value); });
		dustData.sets = newSets;
		dustData.allSetsAllLanguagesSizeZip = printUtil.toSize(fs.statSync(path.join(WEB_OUT_PATH, "AllSetsAllLanguages.json.zip")).size, 1);

		var individualHTML = "";
		var languages = C.LANGUAGES_FULL.multiSort([function(o) { return o.language; }, function(o) { return o.country; }]);
		var NUM_PER_CELL = 5;
		var NUM_COLS = Math.ceil(dustData.sets.length/NUM_PER_CELL);

		languages.forEach(function(languageFull, langi)
		{
			var alternateClass = ((langi+1)%2)===0 ? " alternate" : "";
			individualHTML += "\n<tr class='" + alternateClass + "'>\n\t<td rowspan='" + NUM_PER_CELL+ "'>" + languageFull.language + " (" + languageFull.country + ")</td>\n";
			individualHTML += "\t<td rowspan='" + NUM_PER_CELL + "'>\n";
			individualHTML += "<a href='json/AllSets." + languageFull.code + ".json'>AllSets." + languageFull.code + ".json</a><br><br>";
			individualHTML += "<a href='json/AllSets." + languageFull.code + ".json.zip'>AllSets." + languageFull.code + ".json.zip</a>";
			individualHTML += "</td>\n";

			for(var i=0;i<dustData.sets.length;i++)
			{
				var set = dustData.sets[(Math.floor(i/NUM_COLS) + ((i%NUM_COLS)*NUM_PER_CELL))];
				individualHTML += "\t<td class='setLinkContainer'><a href='json/" + set.name + "." + languageFull.code + ".json'>" + set.name + "." + languageFull.code + ".json</a></td>\n";
				if(((i+1)%NUM_COLS===0))
				{
					individualHTML += "</tr>\n";
					if(i!==(dustData.sets.length-1))
						individualHTML += "<tr class='" + (((i+1+NUM_COLS)>=dustData.sets.length) ? "setContainerLast" : "") + alternateClass + "'>\n";
				}
			}

			for(i=1;i<(dustData.sets.length/NUM_PER_CELL);i++)
			{
				individualHTML += "<td class='setLinkContainer'>&nbsp;</td>";
			}
		});
		dustData.individualHeaderColSpan = NUM_COLS+2;
		dustData.individualNumCols = NUM_COLS;

		dustData.individualHTML = individualHTML;

		dustUtil.render(__dirname, "index", dustData, { keepWhitespace : true }, this);
	},
	function save(html)
	{
		fs.writeFile(path.join(__dirname, "index.html"), html, {encoding:"utf8"}, this);
	},
	function finish(err)
	{
		if(err)
		{
			base.error(err.stack);
			base.error(err);
			process.exit(1);
		}

		process.exit(0);
	}
);

function processLanguage(setNames, language, cb)
{
	base.info("Processing language: %s", language);

	var OUT_PATH = path.join(__dirname, "..", "out");
	var setsSizeLang = {};

	tiptoe(
		function loadJSON()
		{
			setNames.forEach(function(setName)
			{
				fs.readFile(path.join(OUT_PATH, setName + "." + language + ".json"), {encoding : "utf8"}, this.parallel());
			}.bind(this));
		},
		function saveSets()
		{
			var args=arguments;

			var allSets = {};

			setNames.forEach(function(setName, i)
			{
				var set = JSON.parse(args[i]);
				set.forEach(function(card) {
					delete card.set;
				});

				allSets[setName] = set;

				fs.writeFile(path.join(WEB_OUT_PATH, setName + "." + language + ".json"), JSON.stringify(set), {encoding:"utf8"}, this.parallel());
			}.bind(this));

			allSetsAllLanguages[language] = allSets;

			var allSize = printUtil.toSize(JSON.stringify(allSets).length, 1);
			if(language==="enUS")
				dustData.allSize = allSize;
			else
				dustData.allSizeLangs.push({language:language, allSize : allSize});

			fs.writeFile(path.join(WEB_OUT_PATH, "AllSets." + language + ".json"), JSON.stringify(allSets), {encoding : "utf8"}, this.parallel());
		},
		function zipAllSets()
		{
			runUtil.run("zip", ["-9", "AllSets." + language + ".json.zip", "AllSets." + language +  ".json"], { cwd:  WEB_OUT_PATH, silent : true }, this);
		},
		function getZipSizes()
		{
			var allSizeZip = printUtil.toSize(fs.statSync(path.join(WEB_OUT_PATH, "AllSets." + language + ".json.zip")).size, 1);
			if(language==="enUS")
				dustData.allSizeZip = allSizeZip;
			else
				dustData.allSizeZipLangs.push({language:language, allSizeZip : allSizeZip});

			this();
		},
		function finish(err)
		{
			return setImmediate(function() { cb(err); });
		}
	);
}

function checkCardDataTypes(setNames, cb)
{
	tiptoe(
		function processSets()
		{
			setNames.serialForEach(function(setName, subcb)
			{
				checkSetCardDataTypes(setName, subcb);
			}, this);
		},
		function finish(err)
		{
			setImmediate(function() { cb(err); });
		}
	);
}

function checkSetCardDataTypes(setName, cb)
{
	var VALID_TYPES =
	{
		name         : "string",
		cost         : "number",
		type         : "string",
		rarity       : "string",
		faction      : "string",
		text         : "string",
		flavor       : "string",
		artist       : "string",
		attack       : "number",
		health       : "number",
		durability   : "number",
		collectible  : "boolean",
		id           : "string",
		elite        : "boolean",
		playerClass  : "string",
		howToGet     : "string",
		howToGetGold : "string",
		race         : "string",
		inPlayText   : "string",
		mechanics    : ["string"]
	};

	tiptoe(
		function getJSON()
		{
			fs.readFile(path.join(__dirname, "..", "web", "json", setName + ".json"), {encoding : "utf8"}, this);
		},
		function check(setRaw)
		{
			var cards = JSON.parse(setRaw);

			cards.forEach(function(card)
			{
				Object.forEach(card, function(key, val)
				{
					if(!VALID_TYPES.hasOwnProperty(key))
					{
						base.info("%s (%s) NO KNOWN TYPE REFERENCE: [%s] : [%s]", setName, card.name, key, val);
						return;
					}

					if(Array.isArray(VALID_TYPES[key]))
					{
						if(val.some(function(v) { return typeof v!==VALID_TYPES[key][0]; }))
							base.info("%s (%s) HAS A NON-%s IN ARRAY: [%s] : [%s]", setName, card.name, VALID_TYPES[key][0], key, val);

						return;
					}

					if(Object.isObject(VALID_TYPES[key]))
					{
						if(!Object.isObject(val))
							base.info("%s (%s) INVALID TYPE: [%s] : [%s] (Not an object)", setName, card.name, key, val);

						return;
					}

					if(typeof val!==VALID_TYPES[key])
					{
						base.info("%s (%s) INVALID TYPE: [%s] : [%s] (%s !== %s)", setName, card.name, key, val, typeof val, VALID_TYPES[key]);
						return;
					}
				});
			});

			this();
		},
		function finish(err)
		{
			setImmediate(function() { cb(err); });
		}
	);
}
