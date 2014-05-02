"use strict";
/*global setImmediate: true*/

var base = require("xbase"),
	C = require("C"),
	request = require("request"),
	fs = require("fs"),
	url = require("url"),
	glob = require("glob"),
	color = require("cli-color"),
	fileUtil = require("xutil").file,
	diffUtil = require("xutil").diff,
	path = require("path"),
	tiptoe = require("tiptoe");

tiptoe(
	function findJSON()
	{
		glob(path.join(__dirname, "..", "web", "json", "*.enUS.json"), this);
	},
	function processFiles(files)
	{
		files.serialForEach(function(file, subcb)
		{
			if(file.endsWith("AllSets.enUS.json"))
				return subcb();

			processFile(path.basename(file.substring(0, file.indexOf(".enUS.json"))), subcb);
		}, this);
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

function processFile(fileName, cb)
{
	base.info("Comparing: %s", fileName);

	tiptoe(
		function getJSON()
		{
			request("http://hearthstonejson.com/json/" + fileName + ".json", this.parallel());
			fs.readFile(path.join(__dirname, "..", "web", "json", fileName + ".json"), {encoding : "utf8"}, this.parallel());
		},
		function compare(oldJSONArgs, newJSON)
		{
			var result = compareSets(JSON.parse(oldJSONArgs[1]), JSON.parse(newJSON));
			if(result)
				console.log(result);

			this();
		},
		function finish(err)
		{
			setImmediate(function() { cb(err); });
		}
	);
}

function compareSets(oldSet, newSet)
{
	var result = "";
	var oldCardsMap = oldSet.mutate(function(card, result) { result[(card.name + " (" + card.id + ")")] = card; return result; }, {});
	var newCardsMap = newSet.mutate(function(card, result) { result[(card.name + " (" + card.id + ")")] = card; return result; }, {});

	var cardsChanged = diffUtil.diff(Object.keys(oldCardsMap), Object.keys(newCardsMap));
	if(cardsChanged)
	{
		result += "Cards Changed : ";
		result += cardsChanged;
	}

	Object.forEach(oldCardsMap, function(key, oldCard)
	{
		if(!newCardsMap.hasOwnProperty(key))
			return;

		var newCard = newCardsMap[key];

		var subResult = diffUtil.diff(oldCard, newCard);
		if(subResult)
		{
			result += color.magenta(JSON.stringify(key)) + " : \n";
			result += subResult;
		}
	});

	return result;
}
