// ==========================================================================
// APEX OMEGA v5.0 — LEAGUES DATABASE & CATEGORIZATION
// ==========================================================================

const LEAGUES_DATA = [
  // --- ΕΥΡΩΠΗ (Top 5) ---
  { id: 39,  name: "🇬🇧 England - Premier League" },
  { id: 40,  name: "🇬🇧 England - Championship" },
  { id: 41,  name: "🇬🇧 England - League One" },
  { id: 140, name: "🇪🇸 Spain - La Liga" },
  { id: 141, name: "🇪🇸 Spain - Segunda Division" },
  { id: 135, name: "🇮🇹 Italy - Serie A" },
  { id: 136, name: "🇮🇹 Italy - Serie B" },
  { id: 78,  name: "🇩🇪 Germany - Bundesliga" },
  { id: 79,  name: "🇩🇪 Germany - 2. Bundesliga" },
  { id: 61,  name: "🇫🇷 France - Ligue 1" },
  { id: 62,  name: "🇫🇷 France - Ligue 2" },
  
  // --- ΕΥΡΩΠΗ (Δυνατά Πρωταθλήματα) ---
  { id: 88,  name: "🇳🇱 Netherlands - Eredivisie" },
  { id: 89,  name: "🇳🇱 Netherlands - Eerste Divisie" },
  { id: 94,  name: "🇵🇹 Portugal - Primeira Liga" },
  { id: 144, name: "🇧🇪 Belgium - Jupiler Pro League" },
  { id: 179, name: "🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland - Premiership" },
  { id: 197, name: "🇬🇷 Greece - Super League 1" },
  { id: 203, name: "🇹🇷 Turkey - Süper Lig" },

  // --- ΣΚΑΝΔΙΝΑΒΙΑ (Over-Friendly) ---
  { id: 69,  name: "🇳🇴 Norway - Eliteserien" },
  { id: 113, name: "🇸🇪 Sweden - Allsvenskan" },
  { id: 119, name: "🇩🇰 Denmark - Superliga" },

  // --- ΙΡΛΑΝΔΙΑ (Summer Leagues) ---
  { id: 353, name: "🇮🇪 Ireland - Premier Division" },
  { id: 354, name: "🇮🇪 Ireland - First Division" },
  
  // --- ΑΜΕΡΙΚΗ (Βόρεια & Νότια) ---
  { id: 253, name: "🇺🇸 USA - MLS" },
  { id: 262, name: "🇲🇽 Mexico - Liga MX" },
  { id: 71,  name: "🇧🇷 Brazil - Serie A" },
  { id: 128, name: "🇦🇷 Argentina - Liga Profesional" },
  { id: 239, name: "🇨🇴 Colombia - Primera A" },

  // --- ΕΥΡΩΠΑΪΚΕΣ ΔΙΟΡΓΑΝΩΣΕΙΣ (Συλλογικές) ---
  { id: 2,   name: "🇪🇺 UEFA Champions League" },
  { id: 3,   name: "🇪🇺 UEFA Europa League" },
  { id: 848, name: "🇪🇺 UEFA Conference League" }
];

// Φτιάχνουμε τις λίστες για τα Φίλτρα (MY_LEAGUES vs ALL)
const LEAGUE_IDS = LEAGUES_DATA.map(l => l.id);

// Εδώ βάζουμε τα πρωταθλήματα που δίνουν τα καλύτερα κέρδη (High Yield) για το φίλτρο "MY LEAGUES"
const MY_LEAGUES_IDS = [
    39, 140, 135, 78, 61, // Big 5
    88, 94, 144, 253,     // Ολλανδία, Πορτογαλία, Βέλγιο, MLS
    2, 3                  // UCL, UEL
];

// ==========================================================================
// 🧠 SMART LEAGUE CATEGORIZATION (For Quant Modifiers)
// ==========================================================================

// GOLD LEAGUES (Επιθετικά πρωταθλήματα - Το xG πολλαπλασιάζεται με το modGold, π.χ., ~1.12)
// Ιδανικά για Over 2.5 / Over 3.5. Ομάδες που δεν παίζουν άμυνα.
const GOLD_LEAGUES = new Set([
  78,  // Bundesliga
  88,  // Eredivisie
  89,  // Eerste Divisie (Ολλανδία Β)
  69,  // Norway
  113, // Sweden
  253  // USA MLS
]);

// TIGHT LEAGUES (Κλειστά πρωταθλήματα - Το xG πολλαπλασιάζεται με το modTight, π.χ., ~0.95)
// Πολλά Under 2.5, δύσκολα ματς, κλειστές άμυνες.
const TIGHT_LEAGUES = new Set([
  135, // Serie A
  136, // Serie B
  61,  // Ligue 1
  197, // Greece Super League
  128, // Argentina
  71,  // Brazil Serie A
  262, // Mexico Liga MX
  239, // Colombia
  353  // Ireland Premier Division
]);

// TRAP LEAGUES (Αλλοπρόσαλλα πρωταθλήματα - Το xG πολλαπλασιάζεται με το modTrap, π.χ., ~0.90)
// Χρειάζεται τεράστια διαφορά δυναμικότητας για να δοθεί Άσος ή Διπλό.
const TRAP_LEAGUES = new Set([
  40,  // Championship Αγγλίας
  41,  // League One Αγγλίας
  141, // Segunda Ισπανίας
  62,  // Ligue 2 Γαλλίας
  203, // Turkey Süper Lig 
  354  // Ireland First Division
]);
