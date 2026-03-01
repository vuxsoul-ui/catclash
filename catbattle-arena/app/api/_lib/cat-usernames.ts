const CAT_USERNAMES = [
  'sirpounce', 'whiskerbyte', 'meowzilla', 'toebeansonly', 'purrito', 'captainmittens', 'snackpanther', 'chairguardian',
  'zoomiequeen', 'voidloaf', 'napcommander', 'mrrpington', 'clawdia', 'chaoswhiskers', 'tinytiger', 'thepurrfessor',
  'catniptide', 'fluffprotocol', 'purrlock', 'mrmeowgi', 'snugglefang', 'fuzzlightyear', 'softpawsyndicate', 'loafmaster',
  'biscuitengine', 'nightmrrp', 'couchraider', 'gremlinwhisk', 'mewsicmaker', 'purrsephone', 'mischiefmitts', 'scratchbeatz',
  'shadownappers', 'catstronaut', 'furiousgeorge', 'dukeofnap', 'vibepaws', 'sneakysnoot', 'pixelpurr', 'hissandtell',
  'midnightmews', 'boopbrigade', 'pawshank', 'catillac', 'runthezoomies', 'furrnando', 'supremeloaf', 'whiskerwaltz',
  'stormytail', 'purrenade', 'mrrpsquad', 'furballer', 'kingofboxes', 'pawpawri', 'blinksandbeans', 'catalyst',
  'drclaw', 'baronvonmeow', 'strutnnap', 'crunchymittens', 'tabbytactics', 'meowtropolis', 'chonkops', 'notyourlapcat',
  'theroyalpurr', 'catcapone', 'furrari', 'meowtain', 'softchaos', 'whiskerworks', 'hushpaws', 'lazerloaf',
  'purrplexed', 'goblinpaws', 'clawseth', 'cuddlevandal', 'snorezilla', 'purrfectcrime', 'toastthecat', 'nekojet',
  'furmidable', 'mrrpwave', 'housepanther', 'beansandglory', 'kittykrypt', 'lunarloaf', 'purrnado', 'velvetfang',
  'catnipdealer', 'felinefine', 'zoomieoracle', 'slinkylord', 'pawlitician', 'meowmancer', 'purrbyte', 'whispurr',
  'meowrage', 'pawnderer', 'snoozebaron', 'mightywhisk', 'catastrophicute', 'ruffledfur', 'hypepaws', 'mrrpengine',
  'bodegaempress', 'streetsnuggler', 'whiskerverse', 'pawfessorx', 'lordsniffles', 'clawcode', 'velcrocat', 'furbulence',
  'sushisnatcher', 'nipfiend', 'mrrpstorm', 'chonklabs', 'flickertail', 'grumpynimbus', 'pawlitics', 'kittycipher',
  'thegreatmewski', 'dashanddoze', 'sleepybandit', 'catmosphere', 'furlockholmes', 'mewsli', 'pawjama', 'scratchlord',
  'mooncato', 'neonwhisk', 'hissfit', 'fluffnsteel', 'tinymeowfia', 'catmintchip', 'tuxedotempo', 'mrrpnroll',
  'voidvelocity', 'whiskerswitch', 'pawketknife', 'furglitch', 'clawstella', 'catnipcartel', 'starlightpaws', 'snaccattacc',
  'mewsician', 'bigmoodcat', 'purrspective', 'tabbystorm', 'fuzzyoracle', 'sleepopcode', 'sneakattackcat', 'tailspin',
  'gnocchiwhisk', 'tigerthread', 'catzillaops', 'mrrpstack', 'pawsanova', 'cattuccino', 'loafmode', 'napflix',
  'ninjapaws', 'shadowmitts', 'furrfactor', 'whiskerpilot', 'catquantum', 'meowtrix', 'purradox', 'furminal',
  'chaosmuffin', 'mittensmatrix', 'slypurr', 'felineflux', 'driftloaf', 'catbyteclub', 'pawsignal', 'thezoomieking',
  'purradise', 'catnipnova', 'boopauthority', 'whiskerzen', 'tabbytune', 'furvector', 'meowfetti', 'pawprintprime',
  'lazercat420', 'naptainamerica', 'purrformance', 'clawhammer', 'mrrpdrive', 'furboss', 'meowgorithm', 'pawsitivechaos',
  'tinyfang', 'snugglebyte', 'catcore', 'vantafoof', 'purrsuer', 'nibbleclaws', 'mewtube', 'purrlander',
  'slinkywhisk', 'catpackleader', 'fuzzdynasty', 'pawsmic', 'furline', 'catstack', 'mrrpops', 'fluffchain',
];

export function pickRandomCatUsername(seed?: string): string {
  if (!seed) {
    return CAT_USERNAMES[Math.floor(Math.random() * CAT_USERNAMES.length)];
  }
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h >>> 0) % CAT_USERNAMES.length;
  return CAT_USERNAMES[idx];
}

