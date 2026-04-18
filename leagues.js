// leagues.js - ΑΥΣΤΗΡΑ ΜΟΝΟ ΤΑ ΔΕΔΟΜΕΝΑ (Καμία άλλη μεταβλητή)

const LEAGUES_DATA = [
  {id:2,  name:"Champions League", country:"Europe", flag:"🇪🇺", code:"UCL"},
  {id:3,  name:"Europa League", country:"Europe", flag:"🇪🇺", code:"UEL"},
  {id:848,name:"Conference League", country:"Europe", flag:"🇪🇺", code:"UECL"},
  {id:39, name:"Premier League", country:"England", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", code:"EPL"},
  {id:40, name:"Championship", country:"England", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", code:"ENG2"},
  {id:41, name:"League One", country:"England", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", code:"ENG3"},
  {id:140,name:"La Liga", country:"Spain", flag:"🇪🇸", code:"ESP1"},
  {id:141,name:"La Liga 2", country:"Spain", flag:"🇪🇸", code:"ESP2"},
  {id:135,name:"Serie A", country:"Italy", flag:"🇮🇹", code:"ITA1"},
  {id:136,name:"Serie B", country:"Italy", flag:"🇮🇹", code:"ITA2"},
  {id:78, name:"Bundesliga", country:"Germany", flag:"🇩🇪", code:"GER1"},
  {id:79, name:"2. Bundesliga", country:"Germany", flag:"🇩🇪", code:"GER2"},
  {id:61, name:"Ligue 1", country:"France", flag:"🇫🇷", code:"FRA1"},
  {id:62, name:"Ligue 2", country:"France", flag:"🇫🇷", code:"FRA2"},
  {id:88, name:"Eredivisie", country:"Netherlands", flag:"🇳🇱", code:"NED1"},
  {id:144,name:"Jupiler Pro", country:"Belgium", flag:"🇧🇪", code:"BEL1"},
  {id:203,name:"Süper Lig", country:"Turkey", flag:"🇹🇷", code:"TUR1"},
  {id:253,name:"MLS", country:"USA", flag:"🇺🇸", code:"USA1"},
  {id:262,name:"Liga MX", country:"Mexico", flag:"🇲🇽", code:"MEX1"},
  {id:197,name:"Super League", country:"Greece", flag:"🇬🇷", code:"GRE1"},
  {id:357,name:"Premier Division", country:"Ireland", flag:"🇮🇪", code:"IRL1"},
  {id:71, name:"Serie A", country:"Brazil", flag:"🇧🇷", code:"BRA1"},
  {id:128,name:"Liga Profesional", country:"Argentina", flag:"🇦🇷", code:"ARG1"},
  {id:239,name:"Primera A", country:"Colombia", flag:"🇨🇴", code:"COL1"},
  {id:265,name:"Primera División", country:"Chile", flag:"🇨🇱", code:"CHI1"},
  {id:280,name:"Primera División", country:"Peru", flag:"🇵🇪", code:"PER1"},
  {id:268,name:"Primera División", country:"Uruguay", flag:"🇺🇾", code:"URU1"},
  {id:94, name:"Primeira Liga", country:"Portugal", flag:"🇵🇹", code:"POR1"},
  {id:113,name:"Allsvenskan", country:"Sweden", flag:"🇸🇪", code:"SWE1"},
  {id:103,name:"Eliteserien", country:"Norway", flag:"🇳🇴", code:"NOR1"}
];

const LEAGUE_IDS = LEAGUES_DATA.map(l => l.id);
const TRAP_LEAGUES = new Set([40,41,136,141,79,62,239,280,268]); 
const TIGHT_LEAGUES = new Set([61,94,197,135,140,39,128]); 
const GOLD_LEAGUES = new Set([78,262,88,253,71,113,103]); 
const MY_LEAGUES_IDS = [39,78,88,144,140,135,197,253,71,128,113,103];

const LEAGUE_AVG_GOALS = {
  78: 3.12, 88: 3.05, 253: 2.95, 113: 2.85, 103: 2.92, 71: 2.65,
  39: 2.72, 135: 2.48, 140: 2.52, 128: 2.30
};
