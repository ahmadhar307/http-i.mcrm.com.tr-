// hotspot/config/config.js - SAVED AS UTF-8 WITHOUT BOM!
Config({

    // --- Basic Settings ---
    "network-name": "IT ZONE", // Displayed network name
    "service-number": "963994641245", // Your contact number

    // --- Login Page Behavior ---
    "login-type": "both", // Options: "userOnly", "passwordOnly", "both"
    // !!! CORRECT THIS ARABIC TEXT !!!
    "news-line": "أهلاً بكم في شبكةIT ZONE نسأل الله ان يوفقنا لخدمتكم بما يليق بسموكم.", // Marquee text - Example, replace with your actual text

    // --- Input Field Processing ---
    "input-type": "text",
    "input-autocomplete": "on",
    "input-rm-white-spaces": 1,
    "input-to-lower": 0,
    "input-to-upper": 0,
    "input-to-arabic-numbers": 1, // Converts ١٢٣ to 123 etc.
    "input-only-numbers": 0,
    "input-no-numbers": 0,
    "input-only-alphanumeric": 0,
    "input-to-tel-type-when": 0,

    // --- Feature Toggles ---
    "enable-hot-cookie": 1,
    "enable-hot-blocker": 1,
    "clear-router-cookie": 1,
    "clear-hot-cookie": 1,

    // --- Hot Blocker Settings ---
    "block-time": 5, // Minutes
    "try-count": 5, // Attempts allowed
    "warn-when": 3, // Show warning after # attempts
     // !!! CORRECT THIS ARABIC TEXT !!! Use placeholders: {{tryCounter}}, {{tryCount}}, {{restTryCount}}, {{blockTime}}
    "warn-message": "تنبيه!! عدد المحاولات الخاطئة اصبح {{tryCounter}} محاولات. العدد الاقصى المسموح به هو {{tryCount}} محاولات. سيتم حظرك لمدة {{blockTime}} دقائق إذا تجاوزت الحد.",

    // --- Button Visibility ---
    "price-button": true,
    "sell-point-button": true,
    "loan-button": true,
    "app-store-status-button": false, // Not used in your layout

    // --- Header Date Display ---
    "show-date-field": true,

    // --- Redirect Buttons (Optional) ---
    "redirect-to-esterahah": "",
    "redirect-to-mobasher": "",

    // --- App Store Feature (Optional) ---
    "app-store-base-url": "",

    // --- Profiles for Price List (GB Bundles) ---
     // !!! CORRECT THIS ARABIC TEXT !!!
    "profiles": [
            { "price": "3000 ل.س", "time": "5 أيام", "transfer": "1 غيغا", "validity": "5 أيام" },
            { "price": "6000 ل.س", "time": "10 أيام", "transfer": "3 غيغا", "validity": "10 أيام" },
            { "price": "10000 ل.س", "time": "20 يوم", "transfer": "5 غيغا", "validity": "20 يوم" },
            { "price": "15000 ل.س", "time": "20 يوم", "transfer": "10 غيغا", "validity": "20 يوم" },
            { "price": "30000 ل.س", "time": "30 يوم", "transfer": "20 غيغا", "validity": "30 يوم" },
            { "price": "35000 ل.س", "time": "30 يوم", "transfer": "25 غيغا", "validity": "30 يوم" },
            { "price": "65000 ل.س", "time": "30 يوم", "transfer": "50 غيغا", "validity": "30 يوم" },
            { "price": "100000 ل.س", "time": "30 يوم", "transfer": "75 غيغا", "validity": "30 يوم" },
            { "price": "120000 ل.س", "time": "30 يوم", "transfer": "100 غيغا", "validity": "30 يوم" },
            { "price": "200000 ل.س", "time": "45 يوم", "transfer": "200 غيغا", "validity": "45 يوم" }
    ],

    // --- Selling Points List ---
     // !!! CORRECT THIS ARABIC TEXT !!!
    "sell-points": [
            { "name": "سوبر ماركت وسيم الزعبي" },
            { "name": "سوبر ماركت مرتضى الزعبي" },
            { "name": "سوبر ماركت عماد الزعبي" }
    ]
});