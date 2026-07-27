// Reference-only "what this store ordered last Monday" data, hand-extracted
// from partiko-szendvics/reference/rendelések.xlsx (the HÉTFŐ FAVORIT, HÉTFŐ1,
// HÉTFŐ2 and HÉTFŐ DU VIDÉK tabs) - see the sandwich-ordering work log for
// how it was verified (each store's total cross-checked against the sheet's
// own SUM formulas).
//
// Deliberately NOT written into SandwichOrder/SandwichOrderLine - the owner
// asked for this to be display-only ("csak látszódjon"), not a real order,
// since it predates the digital ordering system. Matched against a store's
// identified storeName by exact, case-insensitive lookup (same convention
// as customer find-or-create).
export const MONDAY_REFERENCE_ORDERS: Record<string, { itemName: string; quantity: number }[]> =
{
  "Doma": [
    {
      "itemName": "Fasírtos-pfefferonis szendvics",
      "quantity": 1
    },
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 1
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 1
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 2
    },
    {
      "itemName": "Sajtburger",
      "quantity": 2
    },
    {
      "itemName": "Mini burger",
      "quantity": 1
    },
    {
      "itemName": "Pötyi pogi (dupla rántott húsos pogácsa)",
      "quantity": 1
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 1
    },
    {
      "itemName": "Extra szendvics",
      "quantity": 1
    },
    {
      "itemName": "Mediterrán karajos vekni",
      "quantity": 1
    },
    {
      "itemName": "Szegedi sonkás vekni",
      "quantity": 1
    },
    {
      "itemName": "Piccante szalámis (olasz, csípős)",
      "quantity": 1
    },
    {
      "itemName": "Csirkés panini",
      "quantity": 1
    },
    {
      "itemName": "Tépett húsos szendvics",
      "quantity": 1
    }
  ],
  "Dettre": [
    {
      "itemName": "Sonkás bagel",
      "quantity": 1
    },
    {
      "itemName": "Fasírtos-pfefferonis szendvics",
      "quantity": 1
    },
    {
      "itemName": "Grillezett csirkemell papucs",
      "quantity": 1
    },
    {
      "itemName": "Csirkemelles bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 2
    },
    {
      "itemName": "Pleskavica",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 2
    },
    {
      "itemName": "Sajtburger",
      "quantity": 1
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 1
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 2
    },
    {
      "itemName": "Extra szendvics",
      "quantity": 2
    },
    {
      "itemName": "Mediterrán karajos vekni",
      "quantity": 1
    },
    {
      "itemName": "Piccante szalámis (olasz, csípős)",
      "quantity": 1
    }
  ],
  "Kukovecz": [
    {
      "itemName": "Sonkás bagel",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 2
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Nagyi kifli",
      "quantity": 2
    },
    {
      "itemName": "Pleskavica",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos papucs",
      "quantity": 1
    },
    {
      "itemName": "Csirkés panini",
      "quantity": 1
    }
  ],
  "Fav vedres": [
    {
      "itemName": "Grillezett csirkemell papucs",
      "quantity": 1
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 3
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 3
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 2
    },
    {
      "itemName": "Sajtburger",
      "quantity": 1
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 1
    },
    {
      "itemName": "Mediterrán karajos vekni",
      "quantity": 2
    },
    {
      "itemName": "Piccante szalámis (olasz, csípős)",
      "quantity": 1
    },
    {
      "itemName": "Csirkés panini",
      "quantity": 1
    },
    {
      "itemName": "Tépett húsos szendvics",
      "quantity": 1
    }
  ],
  "Fav Vadaspark": [
    {
      "itemName": "Fasírtos-pfefferonis szendvics",
      "quantity": 2
    },
    {
      "itemName": "Hamburger",
      "quantity": 1
    },
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 3
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 3
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos vekni (teljes kiőrlésű)",
      "quantity": 2
    },
    {
      "itemName": "Sajtburger",
      "quantity": 1
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 1
    },
    {
      "itemName": "Mediterrán karajos vekni",
      "quantity": 1
    },
    {
      "itemName": "Tépett húsos szendvics",
      "quantity": 1
    }
  ],
  "CSILLAG": [
    {
      "itemName": "Fasírtos-pfefferonis szendvics",
      "quantity": 1
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 5
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 2
    },
    {
      "itemName": "Mini burger",
      "quantity": 2
    },
    {
      "itemName": "Mediterrán karajos vekni",
      "quantity": 1
    }
  ],
  "FAV Mars": [
    {
      "itemName": "Sajtburger",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos papucs",
      "quantity": 2
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 2
    },
    {
      "itemName": "Mini burger",
      "quantity": 2
    },
    {
      "itemName": "Szegedi sonkás vekni",
      "quantity": 1
    }
  ],
  "Fav Deszk": [
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 1
    },
    {
      "itemName": "Pleskavica",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos vekni (teljes kiőrlésű)",
      "quantity": 2
    }
  ],
  "Fav Röszke": [
    {
      "itemName": "Sonkás bagel",
      "quantity": 1
    },
    {
      "itemName": "Hamburger",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 2
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 2
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 3
    },
    {
      "itemName": "Mini burger",
      "quantity": 2
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 2
    },
    {
      "itemName": "Szegedi sonkás vekni",
      "quantity": 1
    },
    {
      "itemName": "Csirkés panini",
      "quantity": 2
    }
  ],
  "ÁG U.": [
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 4
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 4
    },
    {
      "itemName": "Rántott húsos papucs",
      "quantity": 1
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 3
    }
  ],
  "MIHÁLY TELEK": [
    {
      "itemName": "Nagyi kifli",
      "quantity": 3
    },
    {
      "itemName": "Mini burger",
      "quantity": 3
    }
  ],
  "Fav Retek": [
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 2
    },
    {
      "itemName": "Csirkemelles bigkifli",
      "quantity": 2
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 5
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 4
    },
    {
      "itemName": "Mediterrán karajos vekni",
      "quantity": 4
    }
  ],
  "CSIRKE 10db": [
    {
      "itemName": "Hamburger",
      "quantity": 1
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Extra szendvics",
      "quantity": 8
    }
  ],
  "Székelysor": [
    {
      "itemName": "Hamburger",
      "quantity": 1
    },
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 2
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 1
    },
    {
      "itemName": "Sajtburger",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos papucs",
      "quantity": 1
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 2
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 2
    }
  ],
  "ÚJ KL": [
    {
      "itemName": "Sonkás bagel",
      "quantity": 3
    },
    {
      "itemName": "Sajtburger",
      "quantity": 3
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 3
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 10
    },
    {
      "itemName": "Extra szendvics",
      "quantity": 15
    }
  ],
  "GYEREK KLINIKA": [
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 6
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 6
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 3
    },
    {
      "itemName": "Tépett húsos szendvics",
      "quantity": 3
    }
  ],
  "Smart Market": [
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 6
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 5
    },
    {
      "itemName": "Rántott húsos vekni (teljes kiőrlésű)",
      "quantity": 5
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 4
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 5
    }
  ],
  "Mars Taxi": [
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 2
    },
    {
      "itemName": "Nagyi kifli",
      "quantity": 5
    },
    {
      "itemName": "Pleskavica",
      "quantity": 2
    },
    {
      "itemName": "Dupla szalámis pogácsa",
      "quantity": 2
    },
    {
      "itemName": "Sajtburger",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos papucs",
      "quantity": 3
    },
    {
      "itemName": "Csirkés panini",
      "quantity": 3
    }
  ],
  "Ital depó": [
    {
      "itemName": "Sajtburger",
      "quantity": 3
    },
    {
      "itemName": "Mini burger",
      "quantity": 3
    },
    {
      "itemName": "Pötyi pogi (dupla rántott húsos pogácsa)",
      "quantity": 2
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 5
    },
    {
      "itemName": "Extra szendvics",
      "quantity": 6
    },
    {
      "itemName": "Piccante szalámis (olasz, csípős)",
      "quantity": 2
    },
    {
      "itemName": "Csirkés panini",
      "quantity": 10
    },
    {
      "itemName": "Tépett húsos szendvics",
      "quantity": 4
    }
  ],
  "NÁ": [
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 2
    },
    {
      "itemName": "Csirkemelles bigkifli",
      "quantity": 2
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 2
    },
    {
      "itemName": "Sajtburger",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos papucs",
      "quantity": 2
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 5
    }
  ],
  "Coop 116": [
    {
      "itemName": "Hamburger",
      "quantity": 1
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 2
    },
    {
      "itemName": "Csirkemelles bigkifli",
      "quantity": 2
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 1
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 6
    }
  ],
  "Coop 103": [
    {
      "itemName": "Csirkemelles bigkifli",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 3
    },
    {
      "itemName": "Rántott húsos papucs",
      "quantity": 3
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 3
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 6
    }
  ],
  "Coop Retek": [
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 1
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 2
    },
    {
      "itemName": "Csirkemelles bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 3
    },
    {
      "itemName": "Rántott húsos papucs",
      "quantity": 3
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 3
    }
  ],
  "ZÁKÁNYSZÉK": [
    {
      "itemName": "Sonkás bagel",
      "quantity": 2
    },
    {
      "itemName": "Hamburger",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 4
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 4
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 4
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 2
    },
    {
      "itemName": "Nagyi kifli",
      "quantity": 4
    },
    {
      "itemName": "Dupla szalámis pogácsa",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 4
    },
    {
      "itemName": "Sajtburger",
      "quantity": 4
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 4
    },
    {
      "itemName": "Extra szendvics",
      "quantity": 4
    },
    {
      "itemName": "Szegedi sonkás vekni",
      "quantity": 4
    }
  ],
  "Ruzsa Fincsi": [
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 6
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 6
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 4
    },
    {
      "itemName": "Sajtburger",
      "quantity": 4
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 3
    }
  ],
  "NS Diszkont": [
    {
      "itemName": "Sonkás bagel",
      "quantity": 1
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 1
    },
    {
      "itemName": "Dupla szalámis pogácsa",
      "quantity": 2
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 2
    },
    {
      "itemName": "Extra szendvics",
      "quantity": 1
    },
    {
      "itemName": "Piccante szalámis (olasz, csípős)",
      "quantity": 1
    },
    {
      "itemName": "Tépett húsos szendvics",
      "quantity": 2
    }
  ],
  "LILIOM ABC": [
    {
      "itemName": "Fasírtos-pfefferonis szendvics",
      "quantity": 2
    },
    {
      "itemName": "Grillezett csirkemell papucs",
      "quantity": 3
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 3
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 3
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 4
    }
  ],
  "PETŐFI": [
    {
      "itemName": "Sonkás bagel",
      "quantity": 1
    },
    {
      "itemName": "Grillezett csirkemell papucs",
      "quantity": 1
    },
    {
      "itemName": "Hamburger",
      "quantity": 1
    },
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 7
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 7
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 7
    },
    {
      "itemName": "Csirkemelles bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 1
    },
    {
      "itemName": "Pleskavica",
      "quantity": 1
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 2
    },
    {
      "itemName": "Sajtburger",
      "quantity": 2
    },
    {
      "itemName": "Mini burger",
      "quantity": 1
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 1
    },
    {
      "itemName": "Extra szendvics",
      "quantity": 3
    },
    {
      "itemName": "Szegedi sonkás vekni",
      "quantity": 1
    },
    {
      "itemName": "Csirkés panini",
      "quantity": 1
    },
    {
      "itemName": "Tépett húsos szendvics",
      "quantity": 1
    }
  ],
  "KISSZÁLLÁS": [
    {
      "itemName": "Fasírtos-pfefferonis szendvics",
      "quantity": 5
    },
    {
      "itemName": "Grillezett csirkemell papucs",
      "quantity": 5
    },
    {
      "itemName": "Hamburger",
      "quantity": 5
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 5
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 5
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 5
    },
    {
      "itemName": "Mini burger",
      "quantity": 5
    }
  ],
  "COOP MÓRA": [
    {
      "itemName": "Fasírtos-pfefferonis szendvics",
      "quantity": 1
    },
    {
      "itemName": "Grillezett csirkemell papucs",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 4
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 4
    },
    {
      "itemName": "Csirkemelles bigkifli",
      "quantity": 3
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 3
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 2
    },
    {
      "itemName": "Sajtburger",
      "quantity": 4
    },
    {
      "itemName": "Rántott húsos papucs",
      "quantity": 2
    },
    {
      "itemName": "Mini burger",
      "quantity": 8
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 10
    }
  ],
  "HATÁR": [
    {
      "itemName": "Sonkás bagel",
      "quantity": 10
    },
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 5
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 5
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 5
    },
    {
      "itemName": "Csirkemelles bigkifli",
      "quantity": 10
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 10
    },
    {
      "itemName": "Nagyi kifli",
      "quantity": 10
    },
    {
      "itemName": "Pleskavica",
      "quantity": 10
    },
    {
      "itemName": "Csirkés tortilla",
      "quantity": 10
    },
    {
      "itemName": "Piccante szalámis (olasz, csípős)",
      "quantity": 10
    },
    {
      "itemName": "Csirkés panini",
      "quantity": 8
    },
    {
      "itemName": "Tépett húsos szendvics",
      "quantity": 8
    }
  ],
  "KIRÁLY ZSÓKA": [
    {
      "itemName": "Sonkás bagel",
      "quantity": 2
    },
    {
      "itemName": "Grillezett csirkemell papucs",
      "quantity": 2
    },
    {
      "itemName": "Fetasajtos bigkifli",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 2
    },
    {
      "itemName": "Sajtburger",
      "quantity": 5
    },
    {
      "itemName": "Dupla sajtburger",
      "quantity": 5
    }
  ],
  "OMW": [
    {
      "itemName": "Molnárka (kicsi) kolbászos",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) sonkás",
      "quantity": 2
    },
    {
      "itemName": "Molnárka (kicsi) szalámis",
      "quantity": 2
    },
    {
      "itemName": "Rántott húsos vekni",
      "quantity": 3
    },
    {
      "itemName": "Tépett húsos szendvics",
      "quantity": 2
    }
  ]
};
