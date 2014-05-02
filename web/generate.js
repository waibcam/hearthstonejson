"use strict";

var base = require("xbase"),
	util = require("util"),
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
	title : "Hearthstone card data in JSON format",
	sets  : [],
	version : "1.0.0",
	lastUpdated : "May 1, 2014"
};

tiptoe(
	function removeJSONDirectory()
	{
		rimraf(path.join(__dirname, "json"), this);
	},
	function createJSONDirectory()
	{
		fs.mkdir(path.join(__dirname, "json"), this);
	},
	function findJSON()
	{
		glob(path.join(__dirname, "..", "out", "*.json"), this);
	},
	function loadJSON(jsonFiles)
	{
		this.data.setNames = jsonFiles.map(function(jsonFile) { return path.basename(jsonFile, ".json"); }).sort();
		this.data.setNames.forEach(function(setName)
		{
			fs.readFile(path.join(__dirname, "..", "out", setName + ".json"), {encoding : "utf8"}, this.parallel());
		}.bind(this));
	},
	function saveSets()
	{
		var args=arguments;

		var allSets = {};

		this.data.setNames.forEach(function(setName, i)
		{
			var set = JSON.parse(args[i]);
			set.forEach(function(card) {
				delete card.set;
			});

			allSets[setName] = set;

			var setSize = printUtil.toSize(JSON.stringify(set).length, 0);
			setSize = "&nbsp;".repeat(6-setSize.length) + setSize;

			fs.writeFile(path.join(__dirname, "json", setName + ".json"), JSON.stringify(set), {encoding:"utf8"}, this.parallel());

			dustData.sets.push({name : setName, size : setSize});
		}.bind(this));

		dustData.allSize = printUtil.toSize(JSON.stringify(allSets).length, 1);

		dustData.changeLog = fs.readFileSync(path.join(__dirname, "changelog.html"), {encoding : "utf8"});

		fs.writeFile(path.join(__dirname, "json", "AllSets.json"), JSON.stringify(allSets), {encoding : "utf8"}, this.parallel());
		
		fs.writeFile(path.join(__dirname, "json", "SetList.json"), JSON.stringify(Object.keys(allSets).sort()), {encoding : "utf8"}, this.parallel());
		fs.writeFile(path.join(__dirname, "json", "version.json"), JSON.stringify({version:dustData.version}), {encoding : "utf8"}, this.parallel());
	},
	function verifyJSON()
	{
		checkCardDataTypes(this.data.setNames, this.parallel());
	},
	function zipJSON()
	{
		runUtil.run("zip", ["-9", "AllSets.json.zip", "AllSets.json"], { cwd:  path.join(__dirname, "json"), silent : true }, this.parallel());

		this.data.setNames.serialForEach(function(setName, cb)
		{
			runUtil.run("zip", ["-9", setName + ".json.zip", setName + ".json"], { cwd:  path.join(__dirname, "json"), silent : true }, cb);
		}, this.parallel());
	},
	function render()
	{
		dustData.allSizeZip = printUtil.toSize(fs.statSync(path.join(__dirname, "json", "AllSets.json.zip")).size, 1);

		this.data.setNames.forEach(function(setName, i)
		{
			dustData.sets[i].sizeZip = printUtil.toSize(fs.statSync(path.join(__dirname, "json", setName + ".json.zip")).size, 1);
		});

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
			base.error(err);
			process.exit(1);
		}

		process.exit(0);
	}
);

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
		inPlayText   : "string"
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
