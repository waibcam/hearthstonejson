"use strict";
/*global setImmediate: true*/

var base = require("xbase"),
	fs = require("fs"),
	C = require("C"),
	libxmljs = require("libxmljs"),
	path = require("path"),
	rimraf = require("rimraf"),
	tiptoe = require("tiptoe");

if(process.argv.length<3 || !fs.existsSync(process.argv[2]))
{
	base.error("Usage: node generate.js /path/to/CARD_BACK.xml");
	process.exit(1);
}

var OUT_PATH = path.join(__dirname, "outCardBacks");

tiptoe(
	function clearOut()
	{
		base.info("Clearing 'outCardBacks' directory...");
		rimraf(OUT_PATH, this);
	},
	function createOut()
	{
		fs.mkdir(OUT_PATH, this);
	},
	function processLanguagesCardBacks()
	{
		base.info("Processing card languages...");
		C.LANGUAGES.serialForEach(processCardBacks, this);
	},
	function saveAllCardBacks(allCardBacks)
	{
		base.info("Saving JSON...");

		C.LANGUAGES.serialForEach(function(language, cb, i)
		{
			saveCardBacks(allCardBacks[i], language, cb);
		}, this);
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

function saveCardBacks(cardBacks, language, cb)
{
	base.info("Saving %d cardBacks for language: %s", cardBacks.length, language);

	tiptoe(
		function saveFiles()
		{
			fs.writeFile(path.join(OUT_PATH, "CardBacks." + language + ".json"), JSON.stringify(cardBacks), {encoding:"utf8"}, this);
		},
		cb
	);
}

function processCardBacks(language, cb)
{
	var cardBacks = [];
		
	base.info("Processing cardBacks for language: %s", language);

	tiptoe(
		function loadFile()
		{
			fs.readFile(process.argv[2], {encoding:"utf8"}, this);
		},
		function processFile(cardXMLData)
		{
			var xmlDoc = libxmljs.parseXml(cardXMLData);
			var backDefs = xmlDoc.get("/Dbf");

			backDefs.childNodes().forEach(function(childNode)
			{
				if(childNode.name()!=="Record")
					return;

				cardBacks.push(processCardBackRecord(childNode, language));
			});

			this();
		},
		function finish(err)
		{
			if(err)
				base.error(err);

			setImmediate(function() { cb(err, cardBacks); });
		}
	);
}

function setFieldValue(cardBack, language, field, targetType, options)
{
	options = options || {};

	var fieldType = field.attr("column").value().toLowerCase();
	if(fieldType!==targetType.toLowerCase())
		return;

	var value = null;
	field.childNodes().forEach(function(languageNode)
	{
		if(value || !languageNode || languageNode.name()!==language)
			return;

		value = languageNode.text();
	});

	if(!value)
		value = field.text();

	if(value)
	{
		if(options)
		{
			if(options.capitalize)
				value = value.toProperCase();

			if(options.boolean)
				value = (value.toLowerCase()==="true");

			if(options.integer)
				value = +value;
		}

		cardBack[(options && options.fieldName) ? options.fieldName : targetType] = value;
	}
}

function processCardBackRecord(Entity, language)
{
	var cardBack = {};
	Entity.childNodes().forEach(function(childNode)
	{
		var childNodeName = childNode.name();
		if(childNodeName!=="Field")
			return;

		setFieldValue(cardBack, language, childNode, "id", {integer:true});
		setFieldValue(cardBack, language, childNode, "name");
		setFieldValue(cardBack, language, childNode, "enabled", {boolean:true});
		setFieldValue(cardBack, language, childNode, "source", {capitalize:true, fieldName : "sourceType"});
		setFieldValue(cardBack, language, childNode, "source_description", {capitalize:true, fieldName : "source"});
		setFieldValue(cardBack, language, childNode, "description");
	});

	if(cardBack.hasOwnProperty("description") && cardBack.description.contains("\\n\\n"))
	{
		cardBack.howToGet = cardBack.description.substring(cardBack.description.indexOf("\\n\\n")+4);
		cardBack.description = cardBack.description.substring(0, cardBack.description.indexOf("\\n\\n"));
	}

	return cardBack;
}
