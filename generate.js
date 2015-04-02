"use strict";
/*global setImmediate: true*/

var base = require("xbase"),
	fs = require("fs"),
	C = require("C"),
	libxmljs = require("libxmljs"),
	path = require("path"),
	runUtil = require("xutil").run,
	fileUtil = require("xutil").file,
	rimraf = require("rimraf"),
	tiptoe = require("tiptoe");

if(process.argv.length<3 || !fs.existsSync(process.argv[2]))
{
	base.error("Usage: node generate.js /path/to/base-Win.MPQ or /path/to/cardxml0.unity3d");
	process.exit(1);
}

var MPQ_PATH = process.argv[2];
var OUT_PATH = path.join(__dirname, "out");
var OUT_PATH_TO_EXTRACTED_DATA = path.join(OUT_PATH, "Data");
var OUT_PATH_TO_CARDXML = path.join(OUT_PATH_TO_EXTRACTED_DATA, "Win");
var CARDXML_FILE_NAME = "cardxml0.unity3d";
var CARDXML_DIR_NAME = path.basename(CARDXML_FILE_NAME, path.extname(CARDXML_FILE_NAME));
var MPQEXTRACTOR_PATH = path.join(__dirname, "MPQExtractor", "build", "bin", "MPQExtractor");
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
	function extractMPQ()
	{
		if(MPQ_PATH.endsWith("unity3d"))
		{
			OUT_PATH_TO_CARDXML = OUT_PATH;
			fileUtil.copy(MPQ_PATH, path.join(OUT_PATH, path.basename(MPQ_PATH)), this);
		}
		else
		{
			base.info("Extracting MPQ...");
			runUtil.run(MPQEXTRACTOR_PATH, ["-e", "Data\\Win\\" + CARDXML_FILE_NAME, "-f", "-o", OUT_PATH, MPQ_PATH], this);
		}
	},
	function extractCardXMLIfNeeded()
	{
		base.info("Extracting card XML...");
		runUtil.run(DISUNITY_PATH, ["-c", "extract", CARDXML_FILE_NAME], {cwd:OUT_PATH_TO_CARDXML, silent : true}, this);
	},
	function processLanguages()
	{
		base.info("Processing card languages...");
		C.LANGUAGES.serialForEach(function(language, cb)
		{
			base.info("Processing language: %s", language);
			processCards(path.join(OUT_PATH, "cardxml0", "TextAsset", language + ".txt"), language, cb);
		}, this);
	},
	function saveSets(cards)
	{
		base.info("Saving JSON...");

		C.LANGUAGES.serialForEach(function(language, cb, i)
		{
			saveSet(cards[i], language, cb);
		}, this);
	},
	function cleanup()
	{
		base.info("Cleaning up...");
		if(fs.existsSync(OUT_PATH_TO_EXTRACTED_DATA))
			rimraf(OUT_PATH_TO_EXTRACTED_DATA, this.parallel());
		if(fs.existsSync(path.join(OUT_PATH, CARDXML_DIR_NAME)))
			rimraf(path.join(OUT_PATH, CARDXML_DIR_NAME), this.parallel());
		if(fs.existsSync(path.join(OUT_PATH, CARDXML_FILE_NAME)))
			fs.unlink(path.join(OUT_PATH, CARDXML_FILE_NAME), this.parallel());

		this.parallel()();
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

function saveSet(cards, language, cb)
{
	var sets = {};

	base.info("Saving %d cards for language: %s", cards.length, language);

	cards.forEach(function(card)
	{
		var cardSet = card.set;
		if(!sets.hasOwnProperty(cardSet))
			sets[cardSet] = [];

		fixCard(language, card);

		sets[cardSet].push(card);
	});

	tiptoe(
		function saveFiles()
		{
			Object.forEach(sets, function(setName, cards)
			{
				fs.writeFile(path.join(OUT_PATH, setName + "." + language + ".json"), JSON.stringify(cards.sort(function(a, b) { return a.name.localeCompare(b.name); })), {encoding:"utf8"}, this.parallel());
			}.bind(this));
		},
		function finish(err)
		{
			return setImmediate(function() { cb(err); });
		}
	);
}

function fixCard(language, card)
{
	if(["Minion", "Weapon"].contains(card.type) && !card.hasOwnProperty("cost"))
	{
		console.log("Fixing missing cost %s \"%s\"", card.type, card.name);
		card.cost = 0;
	}
}

var USED_TAGS = ["CardID", "CardName", "CardSet", "CardType", "Faction", "Rarity", "Cost", "Atk", "Health", "Durability", "CardTextInHand", "CardTextInPlay", "FlavorText", "ArtistName", "Collectible",
				 "Elite", "Race", "Class", "HowToGetThisCard", "HowToGetThisGoldCard"];
var IGNORED_TAGS = ["AttackVisualType", "EnchantmentBirthVisual", "EnchantmentIdleVisual", "TargetingArrowText", "DevState", "TriggerVisual", "Recall", "AIMustPlay", "InvisibleDeathrattle"];
var MECHANIC_TAGS = ["Windfury", "Combo", "Secret", "Battlecry", "Deathrattle", "Taunt", "Stealth", "Spellpower", "Enrage", "Freeze", "Charge", "Overload", "Divine Shield", "Silence", "Morph", "OneTurnEffect", "Poisonous", "Aura", "AdjacentBuff",
					"HealTarget", "GrantCharge", "ImmuneToSpellpower", "AffectedBySpellPower", "Summoned"];
var KNOWN_TAGS = USED_TAGS.concat(IGNORED_TAGS, MECHANIC_TAGS);
var ENUMID_TO_NAME =
{
	185 : "CardName",
	183 : "CardSet",
	202 : "CardType",
	201 : "Faction",
	199 : "Class",
	203 : "Rarity",
	48 : "Cost",
	251 : "AttackVisualType",
	184 : "CardTextInHand",
	47 : "Atk",
	45 : "Health",
	321 : "Collectible",
	342 : "ArtistName",
	351 : "FlavorText",
	32 : "TriggerVisual",
	330 : "EnchantmentBirthVisual",
	331 : "EnchantmentIdleVisual",
	268 : "DevState",
	365 : "HowToGetThisGoldCard",
	190 : "Taunt",
	364 : "HowToGetThisCard",
	338 : "OneTurnEffect",
	293 : "Morph",
	208 : "Freeze",
	252 : "CardTextInPlay",
	325 : "TargetingArrowText",
	189 : "Windfury",
	218 : "Battlecry",
	200 : "Race",
	192 : "Spellpower",
	187 : "Durability",
	197 : "Charge",
	362 : "Aura",
	361 : "HealTarget",
	349 : "ImmuneToSpellpower",
	194 : "Divine Shield",
	350 : "AdjacentBuff",
	217 : "Deathrattle",
	191 : "Stealth",
	220 : "Combo",
	339 : "Silence",
	212 : "Enrage",
	370 : "AffectedBySpellPower",
	240 : "Cant Be Damaged",
	114 : "Elite",
	219 : "Secret",
	363 : "Poisonous",
	215 : "Recall",
	340 : "Counter",
	205 : "Summoned",
	367 : "AIMustPlay",
	335 : "InvisibleDeathrattle",
	377 : "UKNOWN_HasOnDrawEffect",
	388 : "SparePart",
	389 : "UNKNOWN_DuneMaulShaman",
	380 : "UNKNOWN_Blackrock_Heroes",
	402 : "UNKNOWN_Intense_Gaze",
	401 : "UNKNOWN_BroodAffliction"
};
var BOOLEAN_TYPES = ["Collectible", "Elite"];
// Fields above that I don't know the actual name for has an UNKNOWN_ prefix

var NAME_TO_ENUMID = Object.swapKeyValues(ENUMID_TO_NAME);
var IGNORED_TAG_NAMES = ["text", "MasterPower", "Power", "TriggeredPowerHistoryInfo", "EntourageCard"];

function processCards(cardXMLPath, language, cb)
{
	var cards = [];

	tiptoe(
		function loadFile()
		{
			fs.readFile(cardXMLPath, {encoding:"utf8"}, this);
		},
		function processFile(cardXMLData)
		{
			var xmlDoc = libxmljs.parseXml(cardXMLData);
			var cardDefs = xmlDoc.get("/CardDefs");
			cardDefs.childNodes().forEach(function(childNode)
			{
				if(childNode.name()!=="Entity")
					return;

				cards.push(processEntity(childNode, language));
			});

			this();
		},
		function finish(err)
		{
			if(err)
			{
				base.error("Error for file: " + cardXMLPath);
				base.error(err);
			}

			setImmediate(function() { cb(err, cards); });
		}
	);
}

function processEntity(Entity, language)
{
	var card = {};
	Entity.childNodes().forEach(function(childNode)
	{
		var childNodeName = childNode.name();
		if(IGNORED_TAG_NAMES.contains(childNodeName))
			return;

		if(childNodeName!=="Tag" && childNodeName!=="ReferencedTag")
		{
			base.info("New XML node name [%s] with XML: %s", childNodeName, childNode.toString());
			process.exit(1);
			return;
		}

		var enumID = +childNode.attr("enumID").value();
		if(!ENUMID_TO_NAME.hasOwnProperty(enumID))
		{
			base.info("New enumID [%d] with value [%s] in parent:\n%s", enumID, childNode.toString(), childNode.parent().toString());
			process.exit(1);
			return;
		}
	});

	card.id = Entity.attr("CardID").value();
	card.name = getTagValue(Entity, "CardName");
	card.set = getTagValue(Entity, "CardSet");
	card.type = getTagValue(Entity, "CardType");
	card.faction = getTagValue(Entity, "Faction");
	card.rarity = getTagValue(Entity, "Rarity");
	card.cost = getTagValue(Entity, "Cost");
	card.attack = getTagValue(Entity, "Atk");
	card.health = getTagValue(Entity, "Health");
	card.durability = getTagValue(Entity, "Durability");
	card.text = getTagValue(Entity, "CardTextInHand");
	card.inPlayText = getTagValue(Entity, "CardTextInPlay");
	card.flavor = getTagValue(Entity, "FlavorText");
	card.artist = getTagValue(Entity, "ArtistName");
	card.collectible = getTagValue(Entity, "Collectible");
	card.elite = getTagValue(Entity, "Elite");
	card.race = getTagValue(Entity, "Race");
	card.playerClass = getTagValue(Entity, "Class");
	card.howToGet = getTagValue(Entity, "HowToGetThisCard");
	card.howToGetGold = getTagValue(Entity, "HowToGetThisGoldCard");
	card.mechanics = [];

	MECHANIC_TAGS.forEach(function(MECHANIC_TAG)
	{
		if(getTagValue(Entity, MECHANIC_TAG))
			card.mechanics.push(MECHANIC_TAG);
	});

	if(!card.mechanics.length)
		delete card.mechanics;
	else
		card.mechanics = card.mechanics.sort();

	Object.keys(card).forEach(function(key)
	{
		if(card[key]===undefined)
			delete card[key];
	});

	return card;
}

function getTagValue(Entity, tagName)
{
	var value = getTagValue_Actual(Entity, tagName);
	if(value && typeof value==="string")
		value = value.replaceAll(" ", " ");

	return value;
}

function getTagValue_Actual(Entity, tagName)
{
	var Tag = Entity.get("Tag[@enumID='" + NAME_TO_ENUMID[tagName] + "']");
	if(!Tag)
		return undefined;

	var type = Tag.attr("type").value();
	if(type==="String")
		return Tag.text().trim();

	var value = Tag.attr("value").value();

	if(!TAG_VALUE_MAPS.hasOwnProperty(tagName))
	{
		if(type==="")
		{
			if(BOOLEAN_TYPES.contains(tagName))
				type = "Bool";
			else
				type = "Number";
		}

		if(type==="Number")
			return +value;

		if(type==="Bool")
			return value==="1" ? true : false;

		throw new Error("Unhandled Tag type [" + type + "] for tag: " + Tag.toString());
	}

	var tagMap = TAG_VALUE_MAPS[tagName];
	if(!tagMap.hasOwnProperty(value))
		throw new Error("Unknown " + tagName + ": " + value + "\nWith XML: " + Tag.parent().toString());

	return tagMap[value];
}

var TAG_VALUE_MAPS =
{
	"CardSet" :
	{
		2 : "Basic",
		3 : "Classic",
		4 : "Reward",
		5 : "Missions",
		7 : "System",
		8 : "Debug",
		11 : "Promotion",
		12 : "Curse of Naxxramas",
		13 : "Goblins vs Gnomes",
		14 : "Blackrock Mountain",
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
		0 : undefined,
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
		24 : "Dragon",
		17 : "Mech"
	},
	"Class" :
	{
		0 : undefined,
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
