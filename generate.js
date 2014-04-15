"use strict";
/*global setImmediate: true*/

var base = require("xbase"),
	fs = require("fs"),
	libxmljs = require("libxmljs"),
	path = require("path"),
	runUtil = require("xutil").run,
	fileUtil = require("xutil").file,
	rimraf = require("rimraf"),
	glob = require("glob"),
	tiptoe = require("tiptoe");

if(process.argv.length<3 || !fs.existsSync(process.argv[2]))
{
	base.error("Usage: node generate.js /path/to/base-Win.MPQ");
	process.exit(1);
}

var MPQ_ORIGINAL_PATH = process.argv[2];
var MPQ_FILE_NAME = "base-Win.MPQ";
var OUT_PATH = path.join(__dirname, "out");
var CARDXML_FILE_NAME = "cardxml0.unity3d";
var MPQEDITOR_PATH = path.join(__dirname, "MPQEditor.exe");
var DISUNITY_PATH = path.join(__dirname, "disunity", "disunity.sh");

tiptoe(
	function clearOut()
	{
		base.info("Clearing 'out' directory...");
		rimraf(OUT_PATH, this);
	},
	function createOut()
	{
		fs.mkdir(OUT_PATH, this);
	},
	function copyMPQ()
	{
		base.info("Copying MPQ to 'out' directory...");
		fileUtil.copy(MPQ_ORIGINAL_PATH, path.join(OUT_PATH, MPQ_FILE_NAME), this);
	},
	function extractMPQ()
	{
		base.info("Extracting MPQ...");
		runUtil.run("wine", [MPQEDITOR_PATH, "/extract", path.join("out", MPQ_FILE_NAME), "Data\\Win\\cardxml0.unity3d", "out"], {cwd:__dirname, silent : true}, this);
	},
	function extractCardXMLIfNeeded()
	{
		base.info("Extracting card XML...");
		runUtil.run(DISUNITY_PATH, ["-c", "extract", CARDXML_FILE_NAME], {cwd:OUT_PATH, silent : true}, this);
	},
	function getCards()
	{
		base.info("Finding card XML...");
		glob(path.join(OUT_PATH, "cardxml0", "TextAsset", "*.txt"), this);
	},
	function processCards(files)
	{
		base.info("Processing card XML...");
		files.serialForEach(processCard, this);
	},
	function saveSets(cards)
	{
		var sets = {};

		cards.forEach(function(card)
		{
			var cardSet = card.set;
			if(!sets.hasOwnProperty(cardSet))
				sets[cardSet] = [];
			sets[cardSet].push(card);
		});

		fs.writeFile(path.join(OUT_PATH, "AllCards.json"), JSON.stringify(cards.sort(function(a, b) { return a.name.localeCompare(b.name); })), {encoding:"utf8"}, this.parallel());

		Object.forEach(sets, function(setName, cards)
		{
			fs.writeFile(path.join(OUT_PATH, setName + ".json"), JSON.stringify(cards.sort(function(a, b) { return a.name.localeCompare(b.name); })), {encoding:"utf8"}, this.parallel());
		}.bind(this));
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

function processCard(cardXMLPath, cb)
{
	var card = {};

	tiptoe(
		function loadFile()
		{
			base.info(cardXMLPath);
			fs.readFile(cardXMLPath, {encoding:"utf8"}, this);
		},
		function processFile(cardXMLData)
		{
			var xmlDoc = libxmljs.parseXml(cardXMLData);
			var Entity = xmlDoc.get("/Entity");

			card.id = Entity.attr("CardID").value();
			card.name = getTagValue(Entity, "CardName");
			card.set = getTagValue(Entity, "CardSet");
			card.type = getTagValue(Entity, "CardType");
			card.faction = getTagValue(Entity, "Faction");
			card.rarity = getTagValue(Entity, "Rarity");
			card.cost = getTagValue(Entity, "Cost");
			card.attack = getTagValue(Entity, "Atk");
			card.health = getTagValue(Entity, "Health");
			card.text = getTagValue(Entity, "CardTextInHand");
			card.inPlayText = getTagValue(Entity, "CardTextInPlay");
			card.flavor = getTagValue(Entity, "FlavorText");
			card.artist = getTagValue(Entity, "ArtistName");
			card.collectible = getTagValue(Entity, "Collectible");
			card.elite = getTagValue(Entity, "Elite");
			card.race = getTagValue(Entity, "Race");
			card.playerClass = getTagValue(Entity, "Class");

			Object.keys(card).forEach(function(key)
			{
				if(card[key]===undefined)
					delete card[key];
			});

			this();
		},
		function finish(err)
		{
			if(err)
				base.error("Error for card: " + card.name);

			setImmediate(function() { cb(err, card); });
		}
	);
}

function getTagValue(Entity, tagName)
{
	var Tag = Entity.get("Tag[@name='" + tagName + "']");
	if(!Tag)
		return undefined;

	var type = Tag.attr("type").value();
	if(type==="String")
		return Tag.get("enUS").text().trim();

	var value = Tag.attr("value").value();

	if(!TAG_VALUE_MAPS.hasOwnProperty(tagName))
	{
		if(type==="Number")
			return +value;

		if(type==="Bool")
			return value==="1" ? true : false;

		throw new Error("Unhandled Tag type [" + type + "]");
	}

	var tagMap = TAG_VALUE_MAPS[tagName];
	if(!tagMap.hasOwnProperty(value))
		throw new Error("Unknown " + tagName + ": " + value);

	return tagMap[value];
}

var TAG_VALUE_MAPS =
{
	"CardSet" :
	{
		2 : "Basic",
		3 : "Expert",
		4 : "Reward",
		5 : "Missions",
		7 : "System",
		8 : "Debug",
		11 : "Promotion",
		16 : "Credits"
	},
	"CardType" :
	{
		3 : "Hero",
		4 : "Minion",
		5 : "Spell",
		6 : "Enchantment",
		7 : "Weapon",
		10 : "Hero Power"
	},
	"Faction" :
	{
		1 : "Horde",
		2 : "Alliance",
		3 : "Neutral"
	},
	"Rarity" :
	{
		1 : "Common",
		2 : "Free",
		3 : "Rare",
		4 : "Epic",
		5 : "Legendary"
	},
	"Race" :
	{
		14 : "Murloc",
		15 : "Demon",
		20 : "Beast",
		21 : "Totem",
		23 : "Pirate",
		24 : "Dragon"
	},
	"Class" :
	{
		2 : "Druid",
		3 : "Hunter",
		4 : "Mage",
		5 : "Paladin",
		6 : "Priest",
		7 : "Rogue",
		8 : "Shaman",
		9 : "Warlock",
		10 : "Warrior",
		11 : "Dream"
	}
};
