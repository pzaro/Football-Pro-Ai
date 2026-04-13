// leagues.js - Η βάση δεδομένων των πρωταθλημάτων

const LEAGUES_DATA = [
  {id:2,  name:"Champions League"},     {id:3,  name:"Europa League"},
  {id:848,name:"Conference League"},    {id:39, name:"Premier League (EN)"},
  {id:40, name:"Championship (EN)"},    {id:41, name:"League One (EN)"},
  {id:140,name:"La Liga (ES)"},         {id:141,name:"La Liga 2 (ES)"},
  {id:135,name:"Serie A (IT)"},         {id:136,name:"Serie B (IT)"},
  {id:78, name:"Bundesliga (DE)"},      {id:79, name:"2. Bundesliga (DE)"},
  {id:61, name:"Ligue 1 (FR)"},         {id:62, name:"Ligue 2 (FR)"},
  {id:88, name:"Eredivisie (NL)"},      {id:144,name:"Jupiler Pro (BE)"},
  {id:203,name:"Süper Lig (TR)"},       {id:253,name:"MLS (US)"},
  {id:262,name:"Liga MX (MX)"},         {id:197,name:"Super League (GR)"},
  {id:357,name:"Premier Division (IE)"},
  {id:71, name:"Serie A (BR)"},         {id:128,name:"Liga Profesional (AR)"},
  {id:239,name:"Primera A (CO)"},       {id:265,name:"Primera Division (CL)"},
  {id:280,name:"Primera Division (PE)"},{id:268,name:"Primera Division (UY)"},
  {id:94, name:"Primeira Liga (PT)"},   {id:113,name:"Allsvenskan (SE)"},
  {id:103,name:"Eliteserien (NO)"}
];

// Απαραίτητα arrays για τα Dropdowns και τα Φίλτρα του App
const LEAGUE_IDS = LEAGUES_DATA.map(l => l.id);
const MY_LEAGUES_IDS = [39, 78, 88, 144, 140, 135, 197, 253];

const LEAGUE_AVG_GOALS = {
  78: 3.12, 88: 3.05, 253: 2.95, 262: 2.88, 113: 2.85, 103: 2.92, 71: 2.65,
  39: 2.72, 144: 2.70, 203: 2.65, 239: 2.45, 280: 2.50, 268: 2.45,
  2:  2.55, 3:  2.60, 848: 2.50,
  135:2.48, 140:2.52, 61:2.45, 197:2.40, 94:2.45, 128: 2.30
};

const TRAP_LEAGUES = new Set([40,41,136,141,79,62,6,10,66,357, 239, 280, 268]); 
const TIGHT_LEAGUES = new Set([61,94,197,135,140,39,2,3,848, 128]); 
const GOLD_LEAGUES = new Set([78,262,88,253, 71, 113, 103]); 

const DEFAULT_SETTINGS = {
  wShotsOn:0.14, wShotsOff:0.04, wCorners:0.02, wGoals:0.20,
  tXG_O25:2.70, tXG_O35:3.25, tXG_U25:1.80, tBTTS_U25:0.65,
  xG_Diff:0.55, tBTTS:1.10, modTrap:0.90, modTight:0.95, modGold:1.15,
  minCorners: 10.5, minCards: 5.8
};
