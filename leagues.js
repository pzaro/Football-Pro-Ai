// leagues.js — Βάση δεδομένων πρωταθλημάτων APEX OMEGA v5.0
// ─────────────────────────────────────────────────────────────
// Κατηγορίες:
//   GOLD   → υψηλή σκοραριστικότητα, καλή εφαρμογή Poisson (mult +12%)
//   TIGHT  → τακτικά / χαμηλά γκολ (mult −5%)
//   TRAP   → υψηλή αστάθεια, δύσκολη πρόβλεψη (mult −10%)
//   (κανένα) → standard leagues

const LEAGUES_DATA = [

  // ── UEFA Club Competitions ────────────────────────────────
  { id:2,   name:"Champions League"        },
  { id:3,   name:"Europa League"           },
  { id:848, name:"Conference League"       },

  // ── England ───────────────────────────────────────────────
  { id:39,  name:"Premier League (EN)"     },   // TIGHT
  { id:40,  name:"Championship (EN)"       },   // TRAP
  { id:41,  name:"League One (EN)"         },   // TRAP

  // ── Spain ─────────────────────────────────────────────────
  { id:140, name:"La Liga (ES)"            },   // TIGHT
  { id:141, name:"La Liga 2 (ES)"          },   // TRAP

  // ── Italy ─────────────────────────────────────────────────
  { id:135, name:"Serie A (IT)"            },   // TIGHT
  { id:136, name:"Serie B (IT)"            },   // TRAP

  // ── Germany ───────────────────────────────────────────────
  { id:78,  name:"Bundesliga (DE)"         },   // GOLD ★
  { id:79,  name:"2. Bundesliga (DE)"      },   // TRAP

  // ── France ────────────────────────────────────────────────
  { id:61,  name:"Ligue 1 (FR)"            },   // TIGHT
  { id:62,  name:"Ligue 2 (FR)"            },   // TRAP

  // ── Netherlands ───────────────────────────────────────────
  { id:88,  name:"Eredivisie (NL)"         },   // GOLD ★

  // ── Belgium ───────────────────────────────────────────────
  { id:144, name:"Jupiler Pro (BE)"        },   // GOLD ★

  // ── Portugal ──────────────────────────────────────────────
  { id:94,  name:"Primeira Liga (PT)"      },   // TIGHT

  // ── Austria — εξαιρετική εφαρμογή Poisson (avg 3.08 γκολ)
  { id:218, name:"Bundesliga (AT)"         },   // GOLD ★★

  // ── Switzerland ───────────────────────────────────────────
  { id:207, name:"Super League (CH)"       },   // TIGHT (avg 2.72)

  // ── Scotland ──────────────────────────────────────────────
  { id:179, name:"Premiership (SC)"        },   // Standard (avg 2.65)

  // ── Turkey ────────────────────────────────────────────────
  { id:203, name:"Süper Lig (TR)"          },   // Standard

  // ── Greece ────────────────────────────────────────────────
  { id:197, name:"Super League (GR)"       },   // TIGHT

  // ── ═══ ΒΟΡΕΙΕΣ ΧΩΡΕΣ ═══ ────────────────────────────────

  // Denmark — Superliga: avg 2.78 γκολ, καλή Poisson εφαρμογή
  { id:119, name:"Superliga (DK)"          },   // GOLD ★

  // Sweden — Allsvenskan
  { id:113, name:"Allsvenskan (SE)"        },   // Standard

  // Norway — Eliteserien: avg 2.92, ανοιχτό ποδόσφαιρο
  { id:103, name:"Eliteserien (NO)"        },   // GOLD ★

  // Finland — Veikkausliiga
  { id:244, name:"Veikkausliiga (FI)"      },   // Standard

  // Iceland — Urvalsdeild: avg 2.95, high-scoring
  { id:164, name:"Urvalsdeild (IS)"        },   // GOLD

  // ── Ireland ───────────────────────────────────────────────
  // Δημοκρατία Ιρλανδίας — League of Ireland Premier Division
  { id:357, name:"Premier Division (IE)"   },   // TRAP
  // Βόρεια Ιρλανδία — NIFL Premiership
  { id:395, name:"NIFL Premiership (NIR)"  },   // TRAP

  // ── Eastern Europe ────────────────────────────────────────
  // Poland — Ekstraklasa
  { id:106, name:"Ekstraklasa (PL)"        },   // Standard

  // Czech Republic — Fortuna Liga
  { id:345, name:"Fortuna Liga (CZ)"       },   // Standard (avg 2.62)

  // Romania — SuperLiga (Liga 1): χαμηλά γκολ αλλά σταθερά patterns
  { id:283, name:"SuperLiga (RO)"          },   // TIGHT

  // Hungary — OTP Bank Liga: avg 2.60, αναπτυσσόμενη αγορά
  { id:271, name:"OTP Bank Liga (HU)"      },   // Standard

  // ── Americas ─────────────────────────────────────────────
  { id:253, name:"MLS (US)"                },   // GOLD ★
  { id:262, name:"Liga MX (MX)"            },   // GOLD ★
  { id:71,  name:"Serie A (BR)"            },   // GOLD
  { id:128, name:"Liga Profesional (AR)"   },   // TIGHT
  { id:239, name:"Primera A (CO)"          },   // TRAP
  { id:265, name:"Primera Division (CL)"   },   // TRAP
  { id:280, name:"Primera Division (PE)"   },   // TRAP
  { id:268, name:"Primera Division (UY)"   },   // TRAP
];

// ── Core arrays ───────────────────────────────────────────────
const LEAGUE_IDS      = LEAGUES_DATA.map(l => l.id);

// Επιλεγμένα πρωταθλήματα: εξαιρετική Poisson εφαρμογή + υψηλό yield
const MY_LEAGUES_IDS  = [
  78,   // Bundesliga DE   ★★
  88,   // Eredivisie NL   ★★
  218,  // Bundesliga AT   ★★ (νέο)
  119,  // Superliga DK    ★  (νέο)
  103,  // Eliteserien NO  ★
  144,  // Jupiler Pro BE  ★
  253,  // MLS US          ★
  262,  // Liga MX MX      ★
  140,  // La Liga ES
  135,  // Serie A IT
  197,  // Super League GR
];

// ── League avg goals per match (home + away) ──────────────────
const LEAGUE_AVG_GOALS = {
  // Βόρεια / Κεντρική Ευρώπη
  78:  3.12,  // Bundesliga DE
  218: 3.08,  // Bundesliga AT  ★ (υψηλότερο avg στην Ευρώπη)
  88:  3.05,  // Eredivisie
  164: 2.95,  // Urvalsdeild IS
  103: 2.92,  // Eliteserien NO
  119: 2.78,  // Superliga DK
  253: 2.95,  // MLS
  262: 2.88,  // Liga MX
  207: 2.72,  // Super League CH
  113: 2.85,  // Allsvenskan
  144: 2.70,  // Jupiler Pro
  39:  2.72,  // Premier League
  203: 2.65,  // Süper Lig
  71:  2.65,  // Brasileirao
  244: 2.58,  // Veikkausliiga
  179: 2.65,  // Premiership SC
  271: 2.60,  // OTP Bank Liga HU
  345: 2.62,  // Fortuna Liga CZ
  // Tight/Low
  135: 2.48,  // Serie A
  140: 2.52,  // La Liga
  61:  2.45,  // Ligue 1
  197: 2.40,  // Super League GR
  94:  2.45,  // Primeira Liga
  128: 2.30,  // Liga Profesional AR
  283: 2.35,  // SuperLiga RO
  106: 2.52,  // Ekstraklasa PL
  239: 2.45,  // Primera A CO
  280: 2.50,  // Primera Division PE
  268: 2.45,  // Primera Division UY
  265: 2.48,  // Primera Division CL
  // UEFA
  2:   2.55,  // Champions League
  3:   2.60,  // Europa League
  848: 2.50,  // Conference League
};

// ── League type classifiers ───────────────────────────────────
//
// TRAP: υψηλή διακύμανση, πολλές εκπλήξεις → mult × 0.90
// Απαραίτητο: να μην υπάρχουν IDs που δεν ανήκουν στο LEAGUES_DATA
const TRAP_LEAGUES = new Set([
  40, 41,        // Championship, League One (EN)
  136, 141,      // Serie B (IT), La Liga 2 (ES)
  79, 62,        // 2. Bundesliga (DE), Ligue 2 (FR)
  357, 395,      // Premier Division IE, NIFL Premiership NIR
  239, 280, 268, // Colombia, Peru, Uruguay
  265,           // Chile
]);

// TIGHT: τακτικό / χαμηλή σκοραριστικότητα → mult × 0.95
const TIGHT_LEAGUES = new Set([
  61,            // Ligue 1 (FR)
  94,            // Primeira Liga (PT)
  197,           // Super League (GR)
  135,           // Serie A (IT)
  140,           // La Liga (ES)
  39,            // Premier League (EN) — τακτικό στο 1ο ημίχρονο
  2, 3, 848,     // UEFA competitions — cautious
  128,           // Liga Profesional (AR)
  283,           // SuperLiga (RO)
]);

// GOLD: υψηλή σκοραριστικότητα + καλή Poisson εφαρμογή → mult × 1.12
const GOLD_LEAGUES = new Set([
  78,   // Bundesliga (DE)  — top Poisson fit
  88,   // Eredivisie (NL)  — top Poisson fit
  218,  // Bundesliga (AT)  — highest avg goals in Europe
  119,  // Superliga (DK)   — good fit, open play
  103,  // Eliteserien (NO) — open, high-scoring
  164,  // Urvalsdeild (IS) — high-scoring
  144,  // Jupiler Pro (BE) — good fit
  253,  // MLS (US)
  262,  // Liga MX (MX)
  71,   // Brasileirao
]);

// ── HT League Factors (για stats.js) ─────────────────────────
// Εξάγεται ώστε να μπορεί να χρησιμοποιηθεί και από stats.js
// αν φορτωθεί μετά το leagues.js
const LEAGUES_HT_FACTORS = {
  // Germany
  78:  0.420, 79:  0.425,
  // England
  39:  0.440, 40:  0.435, 41:  0.435,
  // Italy
  135: 0.440, 136: 0.435,
  // Spain
  140: 0.430, 141: 0.430,
  // France
  61:  0.430, 62:  0.435,
  // Netherlands
  88:  0.440,
  // Belgium
  144: 0.435,
  // Portugal
  94:  0.432,
  // Austria — ισορροπημένα ημίχρονα, υψηλή σκοραριστικότητα
  218: 0.442,
  // Switzerland
  207: 0.435,
  // Scotland
  179: 0.438,
  // Turkey
  203: 0.438,
  // Greece
  197: 0.435,
  // Scandinavia / Nordic
  113: 0.430, // Allsvenskan (SE)
  103: 0.440, // Eliteserien (NO) — γκολ και στα 2 ημίχρονα
  119: 0.438, // Superliga (DK)
  244: 0.435, // Veikkausliiga (FI)
  164: 0.445, // Urvalsdeild (IS) — high-energy from start
  // Ireland
  357: 0.438, 395: 0.435,
  // Eastern Europe
  106: 0.435, // Ekstraklasa (PL)
  345: 0.435, // Fortuna Liga (CZ)
  283: 0.432, // SuperLiga (RO) — slow start
  271: 0.437, // OTP Bank Liga (HU)
  // Americas
  253: 0.450, // MLS — high-energy start
  262: 0.445, // Liga MX
  71:  0.440, // Brasileirao
  128: 0.435, // Liga Profesional (AR)
  239: 0.432, 280: 0.430, 268: 0.432, 265: 0.432,
  // UEFA
  2:   0.430, 3:  0.430, 848: 0.432,
};
