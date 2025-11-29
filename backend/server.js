require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { ethers } = require('ethers');

const app = express();

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;
const RESOLVER_PRIVATE_KEY = process.env.RESOLVER_PRIVATE_KEY;
const CONTRACT_ADDRESS = '0x6FBB86d5940B11E23056a66a948d97289Bd320eB'; // WordleRoyaleFree
const CHAIN_ID = 143; // Monad Mainnet
const RPC_URL = 'https://rpc.monad.xyz';

// Security: Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  // Production domains (Amplify)
  'https://main.dcfw70ks4eq5w.amplifyapp.com',
  'https://test.dcfw70ks4eq5w.amplifyapp.com',
  // Custom domains
  'https://wrdl.fun',
  'https://www.wrdl.fun',
];

// Rate limiting config
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;
const rateLimitMap = new Map(); // IP -> { count, resetTime }

// Word list - kept secret on server (expand to 400+ for production)
const WORDS = [
  // Crypto/blockchain themed
  'MONAD', 'BLOCK', 'CHAIN', 'TOKEN', 'STAKE', 'CRAFT', 'SMART', 'PROOF', 'VALID', 'NODES',
  'CRYPT', 'SPEND', 'TRADE', 'MONEY', 'COINS', 'MINER', 'LEDGE', 'VAULT', 'YIELD', 'DEBIT',
  // Common 5-letter words (1000+)
  'ABOUT', 'ABOVE', 'ABUSE', 'ACTOR', 'ACUTE', 'ADMIT', 'ADOPT', 'ADULT', 'AFTER', 'AGAIN',
  'AGENT', 'AGREE', 'AHEAD', 'ALARM', 'ALBUM', 'ALERT', 'ALIEN', 'ALIGN', 'ALIKE', 'ALIVE',
  'ALLEY', 'ALLOW', 'ALLOY', 'ALONE', 'ALONG', 'ALTER', 'AMAZE', 'AMBER', 'AMEND', 'AMUSE',
  'ANGEL', 'ANGER', 'ANGLE', 'ANGRY', 'ANKLE', 'ANNOY', 'ANTIC', 'ANVIL', 'APART', 'APPLE',
  'APPLY', 'APRON', 'ARENA', 'ARGUE', 'ARISE', 'ARMOR', 'AROMA', 'ARROW', 'ARSON', 'ARTSY',
  'ASCOT', 'ASIAN', 'ASIDE', 'ASSET', 'ATLAS', 'ATTIC', 'AUDIO', 'AUDIT', 'AVERT', 'AVOID',
  'AWAIT', 'AWAKE', 'AWARD', 'AWARE', 'AWFUL', 'BACON', 'BADGE', 'BADLY', 'BAGEL', 'BAKER',
  'BALLS', 'BANDS', 'BASIC', 'BASIN', 'BASIS', 'BATCH', 'BEACH', 'BEADS', 'BEARD', 'BEAST',
  'BEGAN', 'BEGIN', 'BEING', 'BELLY', 'BELOW', 'BENCH', 'BERRY', 'BIKES', 'BILLY', 'BIRDS',
  'BIRTH', 'BLACK', 'BLADE', 'BLAME', 'BLAND', 'BLANK', 'BLAST', 'BLAZE', 'BLEAK', 'BLEED',
  'BLEND', 'BLESS', 'BLIND', 'BLINK', 'BLISS', 'BLITZ', 'BLOAT', 'BLOCK', 'BLOND', 'BLOOD',
  'BLOOM', 'BLOWN', 'BLUES', 'BLUFF', 'BLUNT', 'BLURB', 'BLURT', 'BLUSH', 'BOARD', 'BOAST',
  'BOATS', 'BOGUS', 'BOILS', 'BOLTS', 'BOMBS', 'BONDS', 'BONES', 'BONUS', 'BOOKS', 'BOOST',
  'BOOTH', 'BOOTS', 'BOOZE', 'BORED', 'BOSSY', 'BOTCH', 'BOUND', 'BOWLS', 'BOXER',
  'BRAIN', 'BRAKE', 'BRAND', 'BRASS', 'BRAVE', 'BREAD', 'BREAK', 'BREED', 'BRICK', 'BRIDE',
  'BRIEF', 'BRING', 'BRINK', 'BRISK', 'BROAD', 'BROIL', 'BROKE', 'BROOK', 'BROOM', 'BROTH',
  'BROWN', 'BRUSH', 'BRUTE', 'BUDDY', 'BUILD', 'BUILT', 'BULGE', 'BULKY', 'BULLY', 'BUNCH',
  'BUNNY', 'BURNT', 'BURST', 'BUSES', 'BUSHY', 'BUYER', 'CABIN', 'CABLE', 'CACHE', 'CADET',
  'CAGED', 'CAKES', 'CAMEL', 'CAMPS', 'CANAL', 'CANDY', 'CANOE', 'CARDS', 'CARGO', 'CAROL',
  'CARRY', 'CARVE', 'CASES', 'CATCH', 'CATER', 'CAUSE', 'CEASE', 'CHAIN', 'CHAIR', 'CHALK',
  'CHAMP', 'CHANT', 'CHAOS', 'CHARM', 'CHART', 'CHASE', 'CHEAP', 'CHEAT', 'CHECK', 'CHEEK',
  'CHEER', 'CHESS', 'CHEST', 'CHICK', 'CHIEF', 'CHILD', 'CHILL', 'CHIMP', 'CHINA', 'CHIPS',
  'CHORD', 'CHORE', 'CHOSE', 'CHUNK', 'CINCH', 'CIVIC', 'CIVIL', 'CLAIM', 'CLAMP', 'CLANG',
  'CLANK', 'CLASH', 'CLASP', 'CLASS', 'CLAWS', 'CLEAN', 'CLEAR', 'CLERK', 'CLICK', 'CLIFF',
  'CLIMB', 'CLING', 'CLOAK', 'CLOCK', 'CLONE', 'CLOSE', 'CLOTH', 'CLOUD', 'CLOUT', 'CLOWN',
  'CLUBS', 'CLUCK', 'CLUMP', 'CLUNG', 'COACH', 'COAST', 'COATS', 'COCOA', 'COILS', 'COLOR',
  'COLON', 'COMBO', 'COMET', 'COMIC', 'COMMA', 'CONCH', 'CONDO', 'CORAL', 'COUCH', 'COUGH',
  'COULD', 'COUNT', 'COUPE', 'COURT', 'COVER', 'COVET', 'CRACK', 'CRAFT', 'CRAMP', 'CRANE',
  'CRANK', 'CRASH', 'CRATE', 'CRAVE', 'CRAWL', 'CRAZE', 'CRAZY', 'CREAK', 'CREAM', 'CREED',
  'CREEK', 'CREEP', 'CREST', 'CRICK', 'CRIME', 'CRIMP', 'CRISP', 'CROAK', 'CROCK', 'CROOK',
  'CROSS', 'CROWD', 'CROWN', 'CRUDE', 'CRUEL', 'CRUSH', 'CRUST', 'CUBIC', 'CURRY', 'CURSE',
  'CURVE', 'CYCLE', 'DADDY', 'DAILY', 'DAIRY', 'DAISY', 'DANCE', 'DANDY', 'DATES', 'DEALS',
  'DEALT', 'DEATH', 'DEBIT', 'DEBUG', 'DEBUT', 'DECAL', 'DECAY', 'DECOR', 'DECOY', 'DECRY',
  'DEITY', 'DELAY', 'DELTA', 'DELVE', 'DEMON', 'DEMUR', 'DENIM', 'DENSE', 'DEPOT', 'DEPTH',
  'DERBY', 'DESKS', 'DETER', 'DETOX', 'DEVIL', 'DIARY', 'DIGIT', 'DIMLY', 'DINER', 'DINGY',
  'DISCO', 'DITCH', 'DITTO', 'DITTY', 'DIVER', 'DIZZY', 'DODGE', 'DOING', 'DOLLY', 'DONOR',
  'DONUT', 'DOORS', 'DOUBT', 'DOUGH', 'DOUSE', 'DOWDY', 'DOZEN', 'DRAFT', 'DRAIN', 'DRAKE',
  'DRAMA', 'DRANK', 'DRAPE', 'DRAWL', 'DRAWN', 'DRAWS', 'DREAD', 'DREAM', 'DRESS', 'DRIED',
  'DRIFT', 'DRILL', 'DRINK', 'DRIVE', 'DROIT', 'DROLL', 'DRONE', 'DROOL', 'DROOP', 'DROPS',
  'DROSS', 'DROVE', 'DROWN', 'DRUGS', 'DRUMS', 'DRUNK', 'DRYER', 'DRYLY', 'DUCKS', 'DUCTS',
  'DULLY', 'DUMMY', 'DUMPS', 'DUNCE', 'DUNES', 'DUSTY', 'DWARF', 'DWELL', 'DYING', 'EAGER',
  'EAGLE', 'EARLY', 'EARTH', 'EASEL', 'EATEN', 'EATER', 'EBONY', 'EDGED', 'EDGES', 'EDICT',
  'EIGHT', 'EJECT', 'ELBOW', 'ELDER', 'ELECT', 'ELITE', 'ELOPE', 'ELUDE', 'EMAIL', 'EMBER',
  'EMPTY', 'ENDED', 'ENEMY', 'ENJOY', 'ENTER', 'ENTRY', 'ENVOY', 'EPOCH', 'EQUAL', 'EQUIP',
  'ERASE', 'ERECT', 'ERODE', 'ERROR', 'ERUPT', 'ESSAY', 'ETHER', 'ETHIC', 'EVADE', 'EVENT',
  'EVERY', 'EXACT', 'EXALT', 'EXCEL', 'EXERT', 'EXILE', 'EXIST', 'EXPEL', 'EXTRA', 'EXUDE',
  'FABLE', 'FACED', 'FACET', 'FACTS', 'FAINT', 'FAIRY', 'FAITH', 'FALLS', 'FALSE', 'FANCY',
  'FANGS', 'FARMS', 'FATAL', 'FATTY', 'FAULT', 'FAUNA', 'FAVOR', 'FEAST', 'FEATS', 'FEEDS',
  'FEELS', 'FEIGN', 'FEINT', 'FELLA', 'FELON', 'FEMUR', 'FENCE', 'FERAL', 'FERRY', 'FETAL',
  'FETCH', 'FETID', 'FETUS', 'FEVER', 'FEWER', 'FIBER', 'FIBRE', 'FIELD', 'FIEND', 'FIERY',
  'FIFTH', 'FIFTY', 'FIGHT', 'FILCH', 'FILED', 'FILER', 'FILES', 'FILLS', 'FILMY', 'FILTH',
  'FINAL', 'FINCH', 'FINDS', 'FINER', 'FINES', 'FIRED', 'FIRES', 'FIRMS', 'FIRST', 'FISHY',
  'FISTS', 'FITLY', 'FITS', 'FIVER', 'FIVES', 'FIXED', 'FIXER', 'FIXES', 'FIZZY', 'FJORD',
  'FLACK', 'FLAGS', 'FLAIR', 'FLAKE', 'FLAKY', 'FLAME', 'FLANK', 'FLAPS', 'FLARE', 'FLASH',
  'FLASK', 'FLATS', 'FLAWS', 'FLEAS', 'FLECK', 'FLESH', 'FLICK', 'FLIER', 'FLIES', 'FLING',
  'FLINT', 'FLIPS', 'FLIRT', 'FLOAT', 'FLOCK', 'FLOOD', 'FLOOR', 'FLOSS', 'FLOUR', 'FLOUT',
  'FLOWS', 'FLUID', 'FLUKE', 'FLUNG', 'FLUNK', 'FLUSH', 'FLUTE', 'FOAMS', 'FOCAL', 'FOCUS',
  'FOGGY', 'FOIST', 'FOLKS', 'FOLLY', 'FONTS', 'FOODS', 'FOOLS', 'FORAY', 'FORCE', 'FORGE',
  'FORGO', 'FORMS', 'FORTE', 'FORTH', 'FORTY', 'FORUM', 'FOULS', 'FOUND',
  'FOUNT', 'FOYER', 'FRAIL', 'FRAME', 'FRANK', 'FRAUD', 'FREAK', 'FREED', 'FRESH', 'FRIAR',
  'FRIED', 'FRIES', 'FRILL', 'FRISK', 'FRITZ', 'FRIZZ', 'FROCK', 'FROGS', 'FRONT',
  'FROST', 'FROTH', 'FROWN', 'FROZE', 'FRUIT', 'FUDGE', 'FUELS', 'FULLY', 'FUMES', 'FUNDS',
  'FUNGI', 'FUNKY', 'FUNNY', 'FURRY', 'FUSSY', 'FUZZY', 'GAFFE', 'GAINS', 'GAMES', 'GAMMA',
  'GANGS', 'GASES', 'GAUGE', 'GAUNT', 'GAUZE', 'GAUZY', 'GAVEL', 'GAWKS', 'GAYER', 'GAZER',
  'GEARS', 'GECKO', 'GEEKS', 'GENES', 'GENIE', 'GENRE', 'GENUS', 'GERMS', 'GETUP', 'GHOST',
  'GIANT', 'GIFTS', 'GILDS', 'GIRLS', 'GIRTH', 'GIVEN', 'GIVER', 'GIVES', 'GIZMO', 'GLADE',
  'GLAND', 'GLARE', 'GLASS', 'GLAZE', 'GLEAM', 'GLEAN', 'GLIDE', 'GLINT', 'GLITZ', 'GLOAT',
  'GLOBE', 'GLOOM', 'GLORY', 'GLOSS', 'GLOVE', 'GLOWS', 'GLUED', 'GLUES', 'GLUEY', 'GNARL',
  'GNASH', 'GNAWS', 'GNOME', 'GOADS', 'GOALS', 'GOATS', 'GODLY', 'GOING', 'GOLDS', 'GOLFS',
  'GONER', 'GONGS', 'GONNA', 'GOODS', 'GOOEY', 'GOOFS', 'GOOFY', 'GOOSE', 'GORGE', 'GOUGE',
  'GOURD', 'GRACE', 'GRADE', 'GRADS', 'GRAFT', 'GRAIL', 'GRAIN', 'GRAMS', 'GRAND', 'GRANT',
  'GRAPE', 'GRAPH', 'GRASP', 'GRASS', 'GRATE', 'GRAVE', 'GRAVY', 'GRAYS', 'GRAZE', 'GREAT',
  'GREED', 'GREEK', 'GREEN', 'GREET', 'GREYS', 'GRIEF', 'GRILL', 'GRIME', 'GRIMY', 'GRIND',
  'GRINS', 'GRIPE', 'GRIPS', 'GRIST', 'GRITS', 'GROAN', 'GROAT', 'GROOM', 'GROPE', 'GROSS',
  'GROUP', 'GROUT', 'GROVE', 'GROWL', 'GROWN', 'GROWS', 'GRUBS', 'GRUEL', 'GRUFF', 'GRUMP',
  'GRUNT', 'GUANO', 'GUARD', 'GUAVA', 'GUESS', 'GUEST', 'GUIDE', 'GUILD', 'GUILT', 'GUISE',
  'GULCH', 'GULFS', 'GULLS', 'GULPS', 'GUMMY', 'GUNKY', 'GUNNY', 'GUSTO', 'GUSTY',
  'GYPSY', 'HABIT', 'HACKS', 'HAIKU', 'HAILS', 'HAIRS', 'HAIRY', 'HALTS', 'HALVE',
  'HANDS', 'HANDY', 'HANGS', 'HAPPY', 'HARDY', 'HARMS', 'HARPS', 'HARSH', 'HASTE', 'HASTY',
  'HATCH', 'HATED', 'HATER', 'HATES', 'HAULS', 'HAUNT', 'HAVEN', 'HAVOC', 'HAWKS', 'HAZEL',
  'HEADS', 'HEADY', 'HEALS', 'HEARD', 'HEARS', 'HEART', 'HEATS', 'HEAVY', 'HEDGE', 'HEEDS',
  'HEELS', 'HEFTY', 'HEIRS', 'HEIST', 'HELIX', 'HELLO', 'HELPS', 'HENCE', 'HERBS', 'HERDS',
  'HILLS', 'HILLY', 'HILTS', 'HINDS', 'HINGE', 'HINTS', 'HIPPO', 'HIPPY', 'HIRED', 'HITCH',
  'HOARD', 'HOBBY', 'HOIST', 'HOLDS', 'HOLES', 'HOLLY', 'HOMER', 'HOMES', 'HONEY', 'HONOR',
  'HOODS', 'HOOKS', 'HOOPS', 'HOPED', 'HOPES', 'HORNS', 'HORSE', 'HOSTS', 'HOTEL', 'HOUND',
  'HOURS', 'HOUSE', 'HOVER', 'HOWLS', 'HUMAN', 'HUMID', 'HUMOR', 'HUMPS', 'HUMUS', 'HUNCH',
  'HUNKS', 'HUNTS', 'HURLS', 'HURRY', 'HURTS', 'HUSKY', 'HYENA', 'HYMNS', 'HYPER', 'ICIER',
  'ICING', 'IDEAL', 'IDEAS', 'IDIOM', 'IDIOT', 'IDLER', 'IDOLS', 'IGLOO', 'IMAGE', 'IMPLY',
  'INANE', 'INBOX', 'INCUR', 'INDEX', 'INDIE', 'INEPT', 'INERT', 'INFER', 'INGOT', 'INNER',
  'INPUT', 'INTER', 'INTRO', 'IONIC', 'IRATE', 'IRISH', 'IRKED', 'IRONY', 'ISLES', 'ISSUE',
  'ITCHY', 'ITEMS', 'IVORY', 'JACKS', 'JADED', 'JAILS', 'JAPAN', 'JAUNT', 'JAZZY', 'JEANS',
  'JEEPS', 'JEERS', 'JELLY', 'JERKS', 'JERKY', 'JESTS', 'JEWEL', 'JIFFY', 'JILTS', 'JIMMY',
  'JINKS', 'JOBS', 'JOINS', 'JOINT', 'JOKED', 'JOKER', 'JOKES', 'JOLLY', 'JOLTS', 'JOUST',
  'JOYED', 'JUDGE', 'JUICE', 'JUICY', 'JUMBO', 'JUMPS', 'JUMPY', 'JUNCO', 'JUNKS', 'JUNKY',
  'JUROR', 'KARMA', 'KAYAK', 'KEBAB', 'KEELS', 'KEEPS', 'KELPS', 'KEMPT', 'KENYA', 'KETCH',
  'KEYED', 'KHAKI', 'KICKS', 'KILLS', 'KILNS', 'KILTS', 'KINDS', 'KINGS', 'KINKS', 'KINKY',
  'KIOSK', 'KITTY', 'KNACK', 'KNEAD', 'KNEED', 'KNEEL', 'KNEES', 'KNELT', 'KNIFE', 'KNITS',
  'KNOBS', 'KNOCK', 'KNOLL', 'KNOTS', 'KNOWN', 'KNOWS', 'KOALA', 'KUDOS', 'LABEL', 'LABOR',
  'LACED', 'LACES', 'LADEN', 'LADLE', 'LAGER', 'LAGGY', 'LAIRD', 'LAKES', 'LAMBS', 'LAMPS',
  'LANCE', 'LANDS', 'LANES', 'LAPEL', 'LAPSE', 'LARGE', 'LARKS', 'LARVA', 'LASER', 'LASSO',
  'LASTS', 'LATCH', 'LATER', 'LATEX', 'LATHE', 'LAUGH', 'LAWNS', 'LAYER', 'LEADS', 'LEAFY',
  'LEAKS', 'LEAKY', 'LEANS', 'LEAPS', 'LEAPT', 'LEARN', 'LEASE', 'LEASH', 'LEAST', 'LEAVE',
  'LEDGE', 'LEECH', 'LEEKS', 'LEERS', 'LEERY', 'LEFTS', 'LEGAL', 'LEMON', 'LEMUR', 'LENDS',
  'LEVEL', 'LEVER', 'LIBEL', 'LIGHT', 'LIKED', 'LIKEN', 'LIKES', 'LILAC', 'LIMBO', 'LIMBS',
  'LIMIT', 'LIMPS', 'LINED', 'LINEN', 'LINER', 'LINES', 'LINGO', 'LINKS', 'LIONS', 'LIPID',
  'LISTS', 'LITER', 'LITHE', 'LITRE', 'LIVED', 'LIVEN', 'LIVER', 'LIVES', 'LIVID', 'LLAMA',
  'LOADS', 'LOAFS', 'LOAMY', 'LOANS', 'LOATH', 'LOBBY', 'LOBED', 'LOBES', 'LOCAL', 'LOCKS',
  'LOCUS', 'LODGE', 'LOFTS', 'LOFTY', 'LOGIC', 'LOGIN', 'LOGOS', 'LOINS', 'LONER', 'LONGS',
  'LOOKS', 'LOOMS', 'LOONS', 'LOONY', 'LOOPS', 'LOOPY', 'LOOSE', 'LOOTS', 'LORDS', 'LORRY',
  'LOSER', 'LOSES', 'LOSSY', 'LOTUS', 'LOUSE', 'LOUSY', 'LOUTS', 'LOVED', 'LOVER', 'LOVES',
  'LOWER', 'LOYAL', 'LUCID', 'LUCKY', 'LUMEN', 'LUMPS', 'LUMPY', 'LUNAR', 'LUNCH', 'LUNGE',
  'LUNGS', 'LURCH', 'LURED', 'LURES', 'LURID', 'LURKS', 'LUSTY', 'LYING', 'LYMPH', 'LYNCH',
  'LYRIC', 'MACHO', 'MACRO', 'MADAM', 'MADLY', 'MAFIA', 'MAGIC', 'MAGMA', 'MAIDS', 'MAILS',
  'MAIMS', 'MAINS', 'MAIZE', 'MAJOR', 'MAKER', 'MAKES', 'MALES', 'MALLS', 'MALTY', 'MAMMA',
  'MANGO', 'MANIA', 'MANIC', 'MANLY', 'MANOR', 'MAPLE', 'MARCH', 'MARKS', 'MARRY', 'MARSH',
  'MASKS', 'MASON', 'MATCH', 'MATED', 'MATES', 'MATHS', 'MATTY', 'MAULS', 'MAYOR', 'MAZES',
  'MEALY', 'MEANS', 'MEANT', 'MEATS', 'MEATY', 'MEDAL', 'MEDIA', 'MEDIC', 'MELEE', 'MELON',
  'MELTS', 'MENDS', 'MENUS', 'MERCY', 'MERGE', 'MERIT', 'MERRY', 'MESSY', 'METAL', 'METER',
  'METRO', 'MICRO', 'MIDST', 'MIGHT', 'MILKS', 'MILKY', 'MILLS', 'MIMIC', 'MINCE', 'MINDS',
  'MINED', 'MINER', 'MINES', 'MINOR', 'MINTS', 'MINTY', 'MINUS', 'MIRTH', 'MISER', 'MISSY',
  'MISTY', 'MITES', 'MITRE', 'MITTS', 'MIXED', 'MIXER', 'MIXES', 'MOANS', 'MOATS', 'MOCKS',
  'MODEL', 'MODEM', 'MODES', 'MOIST', 'MOLAR', 'MOLDS', 'MOLDY', 'MOLES', 'MOLTS', 'MOMMA',
  'MOMMY', 'MONEY', 'MONKS', 'MONTH', 'MOODS', 'MOODY', 'MOONS', 'MOOSE', 'MOPED', 'MOPES',
  'MORAL', 'MORPH', 'MORSE', 'MOSSY', 'MOTEL', 'MOTIF', 'MOTOR', 'MOTTO', 'MOULD', 'MOULT',
  'MOUND', 'MOUNT', 'MOURN', 'MOUSE', 'MOUSY', 'MOUTH', 'MOVED', 'MOVER', 'MOVES', 'MOVIE',
  'MOWED', 'MOWER', 'MUCUS', 'MUDDY', 'MUFFS', 'MULCH', 'MULES', 'MULTI', 'MUMBO', 'MUMMY',
  'MUMPS', 'MUNCH', 'MURAL', 'MURKY', 'MUSHY', 'MUSIC', 'MUSKY', 'MUSTY', 'MYTHS', 'NAILS',
  'NAIVE', 'NAKED', 'NAMED', 'NAMES', 'NANNY', 'NASAL', 'NASTY', 'NATAL', 'NAVAL', 'NAVEL',
  'NEEDS', 'NEEDY', 'NERDS', 'NERDY', 'NERVE', 'NERVY', 'NESTS', 'NEVER', 'NEWER', 'NEWLY',
  'NICER', 'NICHE', 'NICKS', 'NIECE', 'NIGHT', 'NIMBY', 'NINJA', 'NINTH', 'NIPPY', 'NITTY',
  'NOBLE', 'NOBLY', 'NOISE', 'NOISY', 'NOMAD', 'NOOKS', 'NORMS', 'NORTH', 'NOSES', 'NOSEY',
  'NOTCH', 'NOTED', 'NOTES', 'NOVEL', 'NUDGE', 'NURSE', 'NUTTY', 'NYLON', 'NYMPH', 'OAKEN',
  'OASIS', 'OCCUR', 'OCEAN', 'ODDLY', 'ODORS', 'OFFAL', 'OFFER', 'OFTEN', 'OILED', 'OILER',
  'OINKS', 'OKAYS', 'OLDER', 'OLIVE', 'OMBRE', 'OMEGA', 'ONION', 'ONSET', 'OPERA', 'OPTIC',
  'OPTED', 'ORBIT', 'ORDER', 'ORGAN', 'OTHER', 'OTTER', 'OUGHT', 'OUNCE', 'OUTER', 'OUTGO',
  'OUTRE', 'OVALS', 'OVARY', 'OVATE', 'OVENS', 'OVERT', 'OWNED', 'OWNER', 'OXIDE', 'OZONE',
  'PACED', 'PACER', 'PACES', 'PACKS', 'PADDY', 'PAGAN', 'PAGED', 'PAGER', 'PAGES', 'PAILS',
  'PAINS', 'PAINT', 'PAIRS', 'PALMS', 'PALSY', 'PANEL', 'PANES', 'PANGS', 'PANIC', 'PANSY',
  'PANTS', 'PAPAL', 'PAPAS', 'PAPER', 'PARKA', 'PARKS', 'PARRY', 'PARSE', 'PARTS', 'PARTY',
  'PASTA', 'PASTE', 'PASTY', 'PATCH', 'PATIO', 'PATSY', 'PATTY', 'PAUSE', 'PAVED', 'PAVES',
  'PAWED', 'PAWNS', 'PAYEE', 'PAYER', 'PEACE', 'PEACH', 'PEAKS', 'PEAKY', 'PEARL', 'PEARS',
  'PECKS', 'PEDAL', 'PEELS', 'PEERS', 'PENAL', 'PENCE', 'PENNY', 'PERCH', 'PERIL', 'PERKS',
  'PERKY', 'PERMS', 'PESOS', 'PESTS', 'PETAL', 'PETTY', 'PHASE', 'PHONE', 'PHONY', 'PHOTO',
  'PIANO', 'PICKS', 'PICKY', 'PIECE', 'PIERS', 'PIGGY', 'PILOT', 'PINCH', 'PINES', 'PINGS',
  'PINKY', 'PINTS', 'PIOUS', 'PIPES', 'PITCH', 'PITHY', 'PITON', 'PIVOT', 'PIXEL', 'PIZZA',
  'PLACE', 'PLAID', 'PLAIN', 'PLANE', 'PLANK', 'PLANS', 'PLANT', 'PLATE', 'PLAYA', 'PLAYS',
  'PLAZA', 'PLEAD', 'PLEAS', 'PLEAT', 'PLIED', 'PLIER', 'PLIES', 'PLODS', 'PLOPS',
  'PLOTS', 'PLOWS', 'PLOYS', 'PLUCK', 'PLUGS', 'PLUMB', 'PLUME', 'PLUMP', 'PLUMS', 'PLUMY',
  'PLUNK', 'PLUSH', 'POACH', 'POCKS', 'POEMS', 'POETS', 'POINT', 'POISE', 'POKED', 'POKER',
  'POKES', 'POLAR', 'POLES', 'POLIO', 'POLKA', 'POLLS', 'POLYP', 'PONDS', 'POOLS',
  'POOPS', 'POPES', 'POPPY', 'PORCH', 'PORED', 'PORES', 'PORKY', 'PORTS', 'POSED', 'POSER',
  'POSES', 'POSIT', 'POSSE', 'POSTS', 'POUCH', 'POUND', 'POURS', 'POWER', 'PRANK', 'PRAWN',
  'PRAYS', 'PRESS', 'PRICE', 'PRICK', 'PRIDE', 'PRIED', 'PRIES', 'PRIME', 'PRIMO', 'PRIMP',
  'PRIMS', 'PRINT', 'PRIOR', 'PRISM', 'PRIVY', 'PRIZE', 'PROBE', 'PRODS', 'PROMO', 'PROMS',
  'PRONE', 'PRONG', 'PROOF', 'PROPS', 'PROSE', 'PROUD', 'PROVE', 'PROWL', 'PRUDE', 'PRUNE',
  'PUDGY', 'PUFFS', 'PUFFY', 'PULLS', 'PULPS', 'PULPY', 'PULSE', 'PUMPS', 'PUNCH', 'PUNKS',
  'PUNNY', 'PUPIL', 'PUPPY', 'PUREE', 'PURER', 'PURGE', 'PURRS', 'PURSE', 'PUSHY', 'PUTTY',
  'PYGMY', 'QUACK', 'QUAFF', 'QUAIL', 'QUAKE', 'QUALM', 'QUART', 'QUASI', 'QUEEN', 'QUEER',
  'QUELL', 'QUERY', 'QUEST', 'QUEUE', 'QUICK', 'QUIDS', 'QUIET', 'QUILL', 'QUILT', 'QUIRK',
  'QUITE', 'QUOTA', 'QUOTE', 'RABID', 'RACED', 'RACER', 'RACES', 'RACKS', 'RADAR', 'RADII',
  'RADIO', 'RAFTS', 'RAGED', 'RAGES', 'RAIDS', 'RAILS', 'RAINS', 'RAINY', 'RAISE', 'RAKED',
  'RAKES', 'RALLY', 'RAMPS', 'RANCH', 'RANGE', 'RANKS', 'RAPID', 'RARER', 'RARER', 'RASPY',
  'RATED', 'RATES', 'RATIO', 'RATTY', 'RAVED', 'RAVEN', 'RAVER', 'RAVES', 'RAYON', 'RAZOR',
  'REACH', 'REACT', 'READS', 'READY', 'REALM', 'REAMS', 'REAPS', 'REARS', 'REBEL', 'RECAP',
  'RECUT', 'REDUX', 'REEDS', 'REEDY', 'REEFS', 'REEKS', 'REELS', 'REFER', 'REHAB', 'REIGN',
  'REINS', 'RELAX', 'RELAY', 'RELIC', 'REMIT', 'REMIX', 'RENAL', 'RENDS', 'RENEW', 'RENTS',
  'REPAY', 'REPEL', 'REPLY', 'RERUN', 'RESET', 'RESIN', 'RESTS', 'RETRO', 'RETRY', 'REUSE',
  'REVEL', 'REVUE', 'RHINO', 'RHYME', 'RIDER', 'RIDES', 'RIDGE', 'RIFLE', 'RIFTS', 'RIGHT',
  'RIGID', 'RIGOR', 'RILED', 'RILES', 'RILLS', 'RINDS', 'RINGS', 'RINKS', 'RINSE', 'RIOTS',
  'RIPEN', 'RIPER', 'RISEN', 'RISER', 'RISES', 'RISKS', 'RISKY', 'RITES', 'RITZY', 'RIVAL',
  'RIVER', 'RIVET', 'ROADS', 'ROAMS', 'ROARS', 'ROAST', 'ROBED', 'ROBES', 'ROBIN', 'ROBOT',
  'ROCKS', 'ROCKY', 'RODEO', 'ROGUE', 'ROLES', 'ROLLS', 'ROMAN', 'ROOFS', 'ROOMS', 'ROOMY',
  'ROOTS', 'ROPED', 'ROPES', 'ROSES', 'ROTOR', 'ROUGE', 'ROUGH', 'ROUND', 'ROUSE', 'ROUTE',
  'ROVER', 'ROWDY', 'ROWED', 'ROWER', 'ROYAL', 'RUDER', 'RUGBY', 'RUINS', 'RULED', 'RULER',
  'RULES', 'RUMBA', 'RUMOR', 'RUNGS', 'RUNNY', 'RUNTS', 'RUPEE', 'RURAL', 'RUSTY', 'SADLY',
  'SAFER', 'SAFES', 'SAINT', 'SALAD', 'SALES', 'SALON', 'SALSA', 'SALTS', 'SALTY', 'SALVE',
  'SAMBA', 'SANDS', 'SANDY', 'SANER', 'SASSY', 'SATIN', 'SATYR', 'SAUCE', 'SAUCY',
  'SAUNA', 'SAUTE', 'SAVED', 'SAVER', 'SAVES', 'SAVOR', 'SAVVY', 'SAWED', 'SAXES', 'SCALE',
  'SCALP', 'SCALY', 'SCAMP', 'SCAMS', 'SCANT', 'SCARE', 'SCARF', 'SCARY', 'SCENE', 'SCENT',
  'SCOLD', 'SCONE', 'SCOOP', 'SCOOT', 'SCOPE', 'SCORE', 'SCORN', 'SCOUT', 'SCOWL', 'SCRAM',
  'SCRAP', 'SCREW', 'SCRUB', 'SEALS', 'SEAMS', 'SEAMY', 'SEARS', 'SEATS', 'SEDAN', 'SEEDS',
  'SEEDY', 'SEEKS', 'SEEMS', 'SEEPS', 'SEIZE', 'SENDS', 'SENSE', 'SEPIA', 'SERVE', 'SETUP',
  'SEVEN', 'SEVER', 'SEWER', 'SHADE', 'SHADY', 'SHAFT', 'SHAKE', 'SHAKY', 'SHALL', 'SHAME',
  'SHAMS', 'SHAPE', 'SHARD', 'SHARE', 'SHARK', 'SHARP', 'SHAVE', 'SHAWL', 'SHEAF', 'SHEAR',
  'SHEDS', 'SHEEN', 'SHEEP', 'SHEER', 'SHEET', 'SHELF', 'SHELL', 'SHIFT', 'SHIMS', 'SHINE',
  'SHINS', 'SHINY', 'SHIPS', 'SHIRE', 'SHIRK', 'SHIRT', 'SHOCK', 'SHOES', 'SHONE', 'SHOOK',
  'SHOOT', 'SHOPS', 'SHORE', 'SHORN', 'SHORT', 'SHOTS', 'SHOUT', 'SHOVE', 'SHOWN', 'SHOWS',
  'SHOWY', 'SHRED', 'SHREW', 'SHRUB', 'SHRUG', 'SHUCK', 'SHUNS', 'SHUSH', 'SHUTS', 'SIDED',
  'SIDES', 'SIEGE', 'SIEVE', 'SIGHS', 'SIGHT', 'SIGMA', 'SIGNS', 'SILKS', 'SILKY', 'SILLY',
  'SINCE', 'SINEW', 'SINGE', 'SINGS', 'SINKS', 'SINUS', 'SIREN', 'SITES', 'SIXTH', 'SIXTY',
  'SIZED', 'SIZER', 'SIZES', 'SKATE', 'SKEET', 'SKEIN', 'SKIED', 'SKIER', 'SKIES', 'SKIFF',
  'SKILL', 'SKIMP', 'SKIMS', 'SKINS', 'SKIPS', 'SKIRT', 'SKITS', 'SKULL', 'SKUNK', 'SLABS',
  'SLACK', 'SLAIN', 'SLAKE', 'SLAMS', 'SLANG', 'SLANT', 'SLAPS', 'SLASH', 'SLATE', 'SLATS',
  'SLAVE', 'SLAYS', 'SLEDS', 'SLEEK', 'SLEEP', 'SLEET', 'SLEPT', 'SLICE', 'SLICK', 'SLIDE',
  'SLIME', 'SLIMY', 'SLING', 'SLINK', 'SLIPS', 'SLITS', 'SLOBS', 'SLOGS', 'SLOPE', 'SLOPS',
  'SLOSH', 'SLOTH', 'SLOTS', 'SLOWS', 'SLUBS', 'SLUES', 'SLUGS', 'SLUMS', 'SLUNG', 'SLUNK',
  'SLURP', 'SLURS', 'SLUSH', 'SLYLY', 'SMACK', 'SMALL', 'SMART', 'SMASH', 'SMEAR', 'SMELL',
  'SMELT', 'SMILE', 'SMIRK', 'SMITE', 'SMITH', 'SMOCK', 'SMOKE', 'SMOKY', 'SNACK', 'SNAGS',
  'SNAIL', 'SNAKE', 'SNAKY', 'SNAPS', 'SNARE', 'SNARL', 'SNEAK', 'SNEER', 'SNIDE', 'SNIFF',
  'SNIPE', 'SNIPS', 'SNOBS', 'SNOOP', 'SNORE', 'SNORT', 'SNOUT', 'SNOWS', 'SNOWY', 'SNUBS',
  'SNUCK', 'SNUFF', 'SNUGS', 'SOAKS', 'SOAPS', 'SOAPY', 'SOARS', 'SOBER', 'SOCKS', 'SOFAS',
  'SOFTY', 'SOGGY', 'SOILS', 'SOLAR', 'SOLED', 'SOLES', 'SOLID', 'SOLOS', 'SOLVE', 'SONAR',
  'SONGS', 'SONIC', 'SOOTH', 'SOOTY', 'SOPPY', 'SORRY', 'SORTS', 'SOULS', 'SOUND', 'SOUPS',
  'SOUPY', 'SOURS', 'SOUTH', 'SOWED', 'SOWER', 'SPACE', 'SPADE', 'SPAMS', 'SPANK', 'SPANS',
  'SPARE', 'SPARK', 'SPARS', 'SPASM', 'SPATE', 'SPAWN', 'SPEAK', 'SPEAR', 'SPECK', 'SPECS',
  'SPEED', 'SPELL', 'SPEND', 'SPENT', 'SPERM', 'SPICE', 'SPICY', 'SPIED', 'SPIEL', 'SPIES',
  'SPIKE', 'SPIKY', 'SPILL', 'SPILT', 'SPINE', 'SPINS', 'SPINY', 'SPITE', 'SPITS', 'SPLAT',
  'SPLIT', 'SPOIL', 'SPOKE', 'SPOOF', 'SPOOK', 'SPOOL', 'SPOON', 'SPORT', 'SPOTS', 'SPOUT',
  'SPRAY', 'SPREE', 'SPRIG', 'SPUNK', 'SPURN', 'SPURS', 'SPURT', 'SQUAB', 'SQUAD', 'SQUAT',
  'SQUIB', 'SQUID', 'STAB', 'STACK', 'STAFF', 'STAGE', 'STAIN', 'STAIR', 'STAKE', 'STALE',
  'STALK', 'STALL', 'STAMP', 'STAND', 'STANK', 'STAPH', 'STARE', 'STARK', 'STARS', 'START',
  'STASH', 'STATE', 'STATS', 'STAVE', 'STAYS', 'STEAD', 'STEAK', 'STEAL', 'STEAM', 'STEEL',
  'STEEP', 'STEER', 'STEMS', 'STEPS', 'STERN', 'STEWS', 'STICK', 'STIFF', 'STILL', 'STILT',
  'STING', 'STINK', 'STINT', 'STOCK', 'STOIC', 'STOKE', 'STOLE', 'STOMP', 'STONE', 'STONY',
  'STOOD', 'STOOL', 'STOOP', 'STOPS', 'STORE', 'STORK', 'STORM', 'STORY', 'STOUT', 'STOVE',
  'STRAP', 'STRAW', 'STRAY', 'STRIP', 'STRUT', 'STUCK', 'STUDS', 'STUDY', 'STUFF', 'STUMP',
  'STUNG', 'STUNK', 'STUNS', 'STUNT', 'STYLE', 'SUAVE', 'SUGAR', 'SUITE', 'SUITS', 'SULKS',
  'SULKY', 'SUNNY', 'SUPER', 'SURGE', 'SUSHI', 'SWABS', 'SWAMP', 'SWANS', 'SWAPS', 'SWARM',
  'SWATH', 'SWAYS', 'SWEAR', 'SWEAT', 'SWEEP', 'SWEET', 'SWELL', 'SWEPT', 'SWIFT', 'SWIGS',
  'SWIMS', 'SWINE', 'SWING', 'SWIPE', 'SWIRL', 'SWISH', 'SWISS', 'SWOON', 'SWOOP', 'SWORD',
  'SWORE', 'SWORN', 'SWUNG', 'SYNOD', 'SYRUP', 'TABLE', 'TABOO', 'TACIT', 'TACKS', 'TACKY',
  'TAFFY', 'TAILS', 'TAINT', 'TAKEN', 'TAKER', 'TAKES', 'TALES', 'TALKS', 'TALLY', 'TALON',
  'TAMED', 'TAMER', 'TAMES', 'TANGS', 'TANGY', 'TANKS', 'TAPES', 'TARDY', 'TARPS', 'TARRY',
  'TASKS', 'TASTE', 'TASTY', 'TATTY', 'TAUNT', 'TAXES', 'TEACH', 'TEAMS', 'TEARS', 'TEARY',
  'TEASE', 'TEDDY', 'TEENS', 'TEENY', 'TEETH', 'TELLS', 'TEMPO', 'TEMPS', 'TENDS', 'TENOR',
  'TENSE', 'TENTH', 'TENTS', 'TERMS', 'TESTS', 'TEXTS', 'THANK', 'THAWS', 'THEFT', 'THEIR',
  'THEME', 'THERE', 'THESE', 'THICK', 'THIEF', 'THIGH', 'THING', 'THINK', 'THINS', 'THIRD',
  'THORN', 'THOSE', 'THREE', 'THREW', 'THROB', 'THROW', 'THUDS', 'THUGS', 'THUMB', 'THUMP',
  'TIARA', 'TIDAL', 'TIDES', 'TIERS', 'TIGER', 'TIGHT', 'TILED', 'TILES', 'TILTS', 'TIMER',
  'TIMES', 'TIMID', 'TIPSY', 'TIRED', 'TIRES', 'TITAN', 'TITLE', 'TOAST', 'TODAY', 'TODDY',
  'TOKEN', 'TOMBS', 'TONED', 'TONER', 'TONES', 'TONGS', 'TONIC', 'TOOLS', 'TOOTH', 'TOPIC',
  'TOPAZ', 'TORCH', 'TORSO', 'TOTAL', 'TOTEM', 'TOUCH', 'TOUGH', 'TOURS', 'TOWEL', 'TOWER',
  'TOWNS', 'TOXIC', 'TOXIN', 'TRACE', 'TRACK', 'TRACT', 'TRADE', 'TRAIL', 'TRAIN', 'TRAIT',
  'TRAMP', 'TRAMS', 'TRAPS', 'TRASH', 'TRAWL', 'TRAYS', 'TREAD', 'TREAT', 'TREES', 'TREND',
  'TRIAL', 'TRIBE', 'TRICK', 'TRIED', 'TRIER', 'TRIES', 'TRIGS', 'TRILL', 'TRIMS', 'TRIPS',
  'TRITE', 'TROLL', 'TROMP', 'TROOP', 'TROTS', 'TROUT', 'TROVE', 'TRUCE', 'TRUCK', 'TRULY',
  'TRUMP', 'TRUNK', 'TRUSS', 'TRUST', 'TRUTH', 'TRYST', 'TUBES', 'TUCKS', 'TULIP', 'TUMID',
  'TUMMY', 'TUMOR', 'TUNED', 'TUNER', 'TUNES', 'TUNIC', 'TURBO', 'TURDS', 'TURFS', 'TURNS',
  'TUTOR', 'TWANG', 'TWEAK', 'TWEED', 'TWEET', 'TWICE', 'TWIGS', 'TWINE', 'TWIRL', 'TWIST',
  'TYING', 'TYPED', 'TYPES', 'TYPOS', 'UDDER', 'ULCER', 'ULTRA', 'UNCLE', 'UNDER', 'UNDID',
  'UNDUE', 'UNFED', 'UNFIT', 'UNIFY', 'UNION', 'UNITE', 'UNITS', 'UNITY', 'UNLIT', 'UNMET',
  'UNTIL', 'UPPER', 'UPSET', 'URBAN', 'URGED', 'URGES', 'URINE', 'USAGE', 'USERS', 'USHER',
  'USING', 'USUAL', 'UTTER', 'VAGUE', 'VALID', 'VALOR', 'VALUE', 'VALVE', 'VAPOR', 'VAULT',
  'VAUNT', 'VEGAN', 'VEINS', 'VENOM', 'VENUE', 'VERBS', 'VERGE', 'VERSE', 'VIDEO', 'VIERS',
  'VIEWS', 'VIGOR', 'VILLA', 'VINES', 'VINYL', 'VIOLA', 'VIPER', 'VIRAL', 'VIRUS', 'VISIT',
  'VISOR', 'VISTA', 'VITAL', 'VIVID', 'VOCAL', 'VODKA', 'VOGUE', 'VOICE', 'VOMIT', 'VOTER',
  'VOTES', 'VOUCH', 'VOWEL', 'WACKY', 'WADED', 'WADER', 'WADES', 'WAFER', 'WAGER', 'WAGES',
  'WAGON', 'WAIST', 'WAITS', 'WAKED', 'WAKEN', 'WAKES', 'WALKS', 'WALLS', 'WALTZ', 'WANDS',
  'WANTS', 'WARDS', 'WARES', 'WARNS', 'WARPS', 'WARTS', 'WARTY', 'WASTE', 'WATCH', 'WATER',
  'WATTS', 'WAVED', 'WAVER', 'WAVES', 'WAXED', 'WAXES', 'WEARY', 'WEAVE', 'WEDGE', 'WEEDS',
  'WEEDY', 'WEEKS', 'WEIGH', 'WEIRD', 'WELLS', 'WELSH', 'WENCH', 'WHALE', 'WHARF', 'WHEAT',
  'WHEEL', 'WHERE', 'WHICH', 'WHIFF', 'WHILE', 'WHIMS', 'WHINE', 'WHINY', 'WHIPS', 'WHIRL',
  'WHISK', 'WHITE', 'WHOLE', 'WHOSE', 'WICKS', 'WIDEN', 'WIDER', 'WIDTH', 'WIELD', 'WILLS',
  'WIMPY', 'WINCE', 'WINCH', 'WINDS', 'WINDY', 'WINED', 'WINES', 'WINGS', 'WINKS', 'WIPED',
  'WIPER', 'WIPES', 'WIRED', 'WIRES', 'WISER', 'WITCH', 'WITTY', 'WIVES', 'WOKEN', 'WOLFS',
  'WOMAN', 'WOMEN', 'WOODS', 'WOODY', 'WOOZY', 'WORDS', 'WORDY', 'WORKS', 'WORLD', 'WORMS',
  'WORMY', 'WORRY', 'WORSE', 'WORST', 'WORTH', 'WOULD', 'WOUND', 'WOVEN', 'WRACK', 'WRAPS',
  'WRATH', 'WREAK', 'WRECK', 'WREST', 'WRING', 'WRIST', 'WRITE', 'WRONG', 'WROTE', 'WRUNG',
  'YACHT', 'YARDS', 'YARNS', 'YAWNS', 'YEARN', 'YEARS', 'YEAST', 'YELLS', 'YELPS', 'YIELD',
  'YOKES', 'YOUNG', 'YOURS', 'YOUTH', 'ZEBRA', 'ZEROS', 'ZESTY', 'ZILCH', 'ZINCS', 'ZINGS',
  'ZIPPY', 'ZOMBI', 'ZONED', 'ZONES', 'ZOOMS',
];

// Server secret for randomizing words (generate once on deploy, keep constant)
const SERVER_SECRET = process.env.SERVER_SECRET || crypto.randomBytes(32).toString('hex');

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

// Health check - MUST be before CORS middleware for App Runner health checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// CORS - only allow specific origins
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc) in dev only
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS not allowed'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10kb' })); // Limit payload size

// Rate limiting middleware
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  let rateData = rateLimitMap.get(ip);
  if (!rateData || now > rateData.resetTime) {
    rateData = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    rateLimitMap.set(ip, rateData);
  }

  rateData.count++;

  if (rateData.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many requests. Please wait.' });
  }

  next();
});

// ═══════════════════════════════════════════════════════════════════════════
// BLOCKCHAIN CONNECTION
// ═══════════════════════════════════════════════════════════════════════════

const provider = new ethers.JsonRpcProvider(RPC_URL);

const CONTRACT_ABI = [
  'function isPlayerInGame(address resolver, uint256 gameId, address player) view returns (bool)',
  'function isGameResolved(address resolver, uint256 gameId) view returns (bool)',
  'function getCurrentGameId(address resolver) view returns (uint256)',
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

// ═══════════════════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════════════════

// Active game sessions: sessionId -> session data
const gameSessions = new Map();

// Track which player+gameId combinations have sessions (prevent duplicates)
const playerGameIndex = new Map(); // `${player}-${gameId}` -> sessionId

// Session tokens for authentication
const sessionTokens = new Map(); // sessionId -> token

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function generateSessionId() {
  return ethers.hexlify(ethers.randomBytes(16));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Secure word selection - uses server secret + gameId + player for randomness
function getWordForGame(gameId, player) {
  const seed = crypto
    .createHash('sha256')
    .update(`${SERVER_SECRET}-${gameId}-${player.toLowerCase()}-${Date.now()}`)
    .digest('hex');

  // Convert first 8 chars of hash to number for index
  const index = parseInt(seed.substring(0, 8), 16) % WORDS.length;
  return WORDS[index];
}

function evaluateGuess(guess, target) {
  const result = [];
  const targetLetters = target.split('');
  const guessLetters = guess.toUpperCase().split('');

  // First pass: mark correct letters
  guessLetters.forEach((letter, i) => {
    if (letter === targetLetters[i]) {
      result[i] = 'correct';
      targetLetters[i] = null;
    }
  });

  // Second pass: mark present/absent letters
  guessLetters.forEach((letter, i) => {
    if (result[i]) return;

    const targetIndex = targetLetters.indexOf(letter);
    if (targetIndex !== -1) {
      result[i] = 'present';
      targetLetters[targetIndex] = null;
    } else {
      result[i] = 'absent';
    }
  });

  return result;
}

// Input validation
function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidGuess(guess) {
  return typeof guess === 'string' && /^[A-Za-z]{5}$/.test(guess);
}

function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && /^0x[a-fA-F0-9]{32}$/.test(sessionId);
}

// Verify session token
function verifySessionToken(sessionId, token) {
  const storedToken = sessionTokens.get(sessionId);
  if (!storedToken || !token) return false;
  // Ensure same length for timing-safe comparison
  if (storedToken.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(storedToken), Buffer.from(token));
  } catch {
    return false;
  }
}

// Sign game result for WordleRoyaleFree contract
async function signGameResult(resolver, gameId, winner, guessCount) {
  if (!RESOLVER_PRIVATE_KEY) {
    throw new Error('RESOLVER_PRIVATE_KEY not configured');
  }

  const wallet = new ethers.Wallet(RESOLVER_PRIVATE_KEY);

  const domain = {
    name: 'WordleRoyaleFree',
    version: '1',
    chainId: CHAIN_ID,
    verifyingContract: CONTRACT_ADDRESS,
  };

  const types = {
    Resolve: [
      { name: 'resolver', type: 'address' },
      { name: 'gameId', type: 'uint256' },
      { name: 'winner', type: 'address' },
      { name: 'guessCount', type: 'uint8' },
    ],
  };

  const message = {
    resolver: resolver,
    gameId: BigInt(gameId),
    winner: winner,
    guessCount: guessCount,
  };

  const signature = await wallet.signTypedData(domain, types, message);
  return signature;
}

// ═══════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Get resolver address
app.get('/api/resolver', (req, res) => {
  if (!RESOLVER_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Resolver not configured' });
  }
  const wallet = new ethers.Wallet(RESOLVER_PRIVATE_KEY);
  res.json({ resolver: wallet.address });
});

// Start a new game session
app.post('/api/game/start', async (req, res) => {
  try {
    const { player, gameId } = req.body;

    // Input validation
    if (!player || !isValidAddress(player)) {
      return res.status(400).json({ error: 'Invalid player address' });
    }
    if (gameId === undefined || isNaN(Number(gameId)) || Number(gameId) < 0) {
      return res.status(400).json({ error: 'Invalid gameId' });
    }

    const playerLower = player.toLowerCase();
    const gameIdStr = gameId.toString();

    // Check if player already has a session for this game
    const existingKey = `${playerLower}-${gameIdStr}`;
    if (playerGameIndex.has(existingKey)) {
      const existingSessionId = playerGameIndex.get(existingKey);
      const existingSession = gameSessions.get(existingSessionId);
      if (existingSession && !existingSession.completed) {
        // Return existing session
        return res.json({
          sessionId: existingSessionId,
          token: sessionTokens.get(existingSessionId),
          wordLength: existingSession.word.length,
          maxGuesses: 6,
          guessCount: existingSession.guesses.length,
        });
      }
    }

    // Create new session
    const sessionId = generateSessionId();
    const sessionToken = generateSessionToken();
    const word = getWordForGame(gameIdStr, playerLower);

    gameSessions.set(sessionId, {
      player: playerLower,
      gameId: gameIdStr,
      word,
      guesses: [],
      startTime: Date.now(),
      completed: false,
      won: false,
      claimed: false,
    });

    sessionTokens.set(sessionId, sessionToken);
    playerGameIndex.set(existingKey, sessionId);

    console.log(`Game started: session=${sessionId}, gameId=${gameIdStr}, player=${playerLower}, word=${word}`);

    res.json({
      sessionId,
      token: sessionToken, // Client must include this in subsequent requests
      wordLength: word.length,
      maxGuesses: 6,
    });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Submit a guess
app.post('/api/game/guess', (req, res) => {
  try {
    const { sessionId, guess, token } = req.body;

    // Input validation
    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    if (!isValidGuess(guess)) {
      return res.status(400).json({ error: 'Guess must be exactly 5 letters (A-Z)' });
    }

    const session = gameSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify session token
    if (!verifySessionToken(sessionId, token)) {
      return res.status(403).json({ error: 'Invalid session token' });
    }

    if (session.completed) {
      return res.status(400).json({ error: 'Game already completed' });
    }

    const upperGuess = guess.toUpperCase();

    // Accept any 5-letter word (no dictionary validation)
    const result = evaluateGuess(upperGuess, session.word);
    session.guesses.push({ guess: upperGuess, result, timestamp: Date.now() });

    const isCorrect = upperGuess === session.word;
    const isGameOver = isCorrect || session.guesses.length >= 6;

    if (isGameOver) {
      session.completed = true;
      session.won = isCorrect;
      session.endTime = Date.now();
    }

    console.log(`Guess: session=${sessionId}, guess=${upperGuess}, correct=${isCorrect}`);

    res.json({
      guess: upperGuess,
      result,
      guessNumber: session.guesses.length,
      isCorrect,
      isGameOver,
      won: session.won,
      ...(isGameOver && { word: session.word }),
    });
  } catch (error) {
    console.error('Error processing guess:', error);
    res.status(500).json({ error: 'Failed to process guess' });
  }
});

// Get game state
app.get('/api/game/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { token } = req.query;

  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const session = gameSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Verify session token
  if (!verifySessionToken(sessionId, token)) {
    return res.status(403).json({ error: 'Invalid session token' });
  }

  res.json({
    guesses: session.guesses.map(g => ({ guess: g.guess, result: g.result })),
    completed: session.completed,
    won: session.won,
    guessCount: session.guesses.length,
    ...(session.completed && { word: session.word }),
  });
});

// Request signature for winning game
app.post('/api/game/claim', async (req, res) => {
  try {
    const { sessionId, token } = req.body;

    // Input validation
    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const session = gameSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify session token
    if (!verifySessionToken(sessionId, token)) {
      return res.status(403).json({ error: 'Invalid session token' });
    }

    if (!session.completed) {
      return res.status(400).json({ error: 'Game not completed' });
    }

    if (!session.won) {
      return res.status(400).json({ error: 'Game was not won' });
    }

    if (session.claimed) {
      return res.status(400).json({ error: 'Reward already claimed' });
    }

    // Get resolver address
    const resolverWallet = new ethers.Wallet(RESOLVER_PRIVATE_KEY);
    const resolver = resolverWallet.address;

    // Verify on-chain that game isn't already resolved
    try {
      const isResolved = await contract.isGameResolved(resolver, session.gameId);
      if (isResolved) {
        session.claimed = true;
        return res.status(400).json({ error: 'Game already resolved on-chain' });
      }
    } catch (err) {
      console.warn('On-chain resolution check failed:', err.message);
      // Continue anyway for testing, but log it
    }

    const guessCount = session.guesses.length;

    const signature = await signGameResult(
      resolver,
      session.gameId,
      session.player,
      guessCount
    );

    session.claimed = true;

    console.log(`Claim signed: session=${sessionId}, player=${session.player}, guesses=${guessCount}`);

    res.json({
      signature,
      resolver,
      winner: session.player,
      guessCount,
      gameId: session.gameId,
    });
  } catch (error) {
    console.error('Error signing claim:', error);
    res.status(500).json({ error: 'Failed to sign claim' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════

// Clean up old sessions and rate limit data
setInterval(() => {
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();

  // Clean up sessions
  for (const [sessionId, session] of gameSessions) {
    if (now - session.startTime > ONE_HOUR) {
      gameSessions.delete(sessionId);
      sessionTokens.delete(sessionId);
      playerGameIndex.delete(`${session.player}-${session.gameId}`);
      console.log(`Cleaned up expired session: ${sessionId}`);
    }
  }

  // Clean up rate limit data
  for (const [ip, data] of rateLimitMap) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000);

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           WORDLE ROYALE FREE - BACKEND SERVER                 ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:    Running                                           ║
║  Port:      ${PORT}                                              ║
║  Contract:  ${CONTRACT_ADDRESS}      ║
║  Chain:     Monad Mainnet (${CHAIN_ID})                            ║
╠═══════════════════════════════════════════════════════════════╣
║  Model:     FREE TO PLAY - WRDLE prizes from pool             ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  if (!RESOLVER_PRIVATE_KEY) {
    console.warn('⚠️  WARNING: RESOLVER_PRIVATE_KEY not set in .env');
  }
  if (SERVER_SECRET === process.env.SERVER_SECRET) {
    console.log('✓ Using configured SERVER_SECRET');
  } else {
    console.warn('⚠️  WARNING: Using random SERVER_SECRET (will change on restart)');
    console.warn('   Set SERVER_SECRET in .env for consistent word selection');
  }
});
