// Two Truths & A Lie - Gamified Travel Guide
// Main Application Logic !

// ==========================================
// API CONFIGURATION
// ==========================================

// Option 1: Use Cloudflare Worker Proxy (RECOMMENDED - Real Security)
// Set this to your Cloudflare Worker URL after deploying (see cloudflare-worker/CLOUDFLARE_SETUP.md)
// Example: 'https://travel-guide-api-proxy.your-username.workers.dev'
// When set, the API key is handled server-side and never exposed to the browser
const CLOUDFLARE_WORKER_URL = 'https://travel-guide-api-proxy.natebarksdale.workers.dev'; // Set to your worker URL or null to use direct API calls

// Option 2: Direct API Calls with Client-Side API Key (Fallback)
// This is used if CLOUDFLARE_WORKER_URL is not set
// Note: In production, this gets replaced via GitHub Actions from secrets
// The key is obfuscated (reversed + base64) to prevent casual scraping
// Real security comes from OpenRouter's site locking + spending limits
const DEFAULT_API_KEY = '__OPENROUTER_API_KEY__'; // Replaced during deployment

// Decode the obfuscated API key
function decodeApiKey(obfuscated) {
    try {
        // Decode base64 and reverse the string
        const decoded = atob(obfuscated);
        const reversed = decoded.split('').reverse().join('');
        // Trim any whitespace that might have been inadvertently encoded
        return reversed.trim();
    } catch (e) {
        return null; // Invalid obfuscation
    }
}

// Check if we have a valid API key (not a placeholder)
function getValidApiKey() {
    const stored = localStorage.getItem('openrouter_api_key');
    if (stored && stored.trim()) return stored;

    // Check if default key is still a placeholder or empty
    if (!DEFAULT_API_KEY ||
        DEFAULT_API_KEY.trim() === '' ||
        (DEFAULT_API_KEY.startsWith('__') && DEFAULT_API_KEY.endsWith('__'))) {
        return null; // No valid key available
    }

    // Decode the obfuscated default key
    return decodeApiKey(DEFAULT_API_KEY);
}

// Check if we have API access (either via key or Cloudflare Worker)
function hasApiAccess() {
    // If using Cloudflare Worker, we have API access regardless of client-side key
    if (CLOUDFLARE_WORKER_URL && CLOUDFLARE_WORKER_URL !== null && CLOUDFLARE_WORKER_URL.trim() !== '') {
        return true;
    }
    // Otherwise, check if we have a valid client-side API key
    return AppState.apiKey && AppState.apiKey.trim() !== '';
}

// Global destination starting points for the home map
const GLOBAL_DESTINATIONS = [
    { name: 'Paris', lat: 48.8566, lng: 2.3522 },
    { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
    { name: 'New York', lat: 40.7128, lng: -74.0060 },
    { name: 'London', lat: 51.5074, lng: -0.1278 },
    { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
    { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
    { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
    { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
    { name: 'Istanbul', lat: 41.0082, lng: 28.9784 },
    { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
    { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
    { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
    { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
    { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },
    { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816 }
];

// Select a random starting destination
const randomDestination = GLOBAL_DESTINATIONS[Math.floor(Math.random() * GLOBAL_DESTINATIONS.length)];

// Educational Loading Messages
// These rotate randomly during content generation to help users discover features
const LOADING_MESSAGES = [
    "Tip: Click the book icon to access Time and Voice settings for different eras and writing styles",
    "Did you know? You can create custom voices by describing any writing style you want",
    "Try the 'Near Me' button to explore places close to your current location",
    "Tip: Drag the map marker to explore any location in the world",
    "Click any blue place name in the guide to instantly travel there",
    "Your score increases when you guess correctly - can you complete a whole page?",
    "Tip: Use the settings gear to change AI models or manage your API key",
    "The breadcrumb trail at the top lets you quickly jump back to previous locations",
    "Tip: Each trio has one lie - guess all three correctly for bonus points!",
    "Try exploring different neighborhoods, landmarks, and cities by clicking links",
    "Did you know? You can use your browser's back button to retrace your journey",
    "Tip: The map shows nearby places you can explore with a single click",
    "Complete all trios on a page correctly to earn a 10-point bonus",
    "Five unique voices are built-in - each adds personality to your travel guide",
    "Tip: Search for any city, landmark, or neighborhood to start exploring",
    "The bottom map always shows a new random destination to discover",
    "Did you know? Your guesses and score are saved automatically",
    "Tip: Click suggestion chips for quick access to popular destinations",
    "Custom voices are generated on-demand and saved for future use",
    "Try switching voices mid-journey to see familiar places in new ways",
    "Tip: Use the timeline in Time and Voice settings to travel through time from the Big Bang to the far future",
    "Did you know? You can visit ancient Rome, medieval Paris, or future cities by adjusting the time period",
    "Tip: Drag the timeline handle to explore different eras, then click 'Set Time & Regenerate'",
    "The timeline includes geological eras like the Paleozoic, Mesozoic, and Cenozoic periods",
    "Tip: Toggle off the Time Period to quickly return to present-day content",
    "Travel back to see what actually existed at your location throughout history",
    "Tip: The timeline scrolls horizontally - explore decades near the present or geological eras in deep time"
];

// Application State
const AppState = {
    apiKey: getValidApiKey(),
    currentLocation: null,
    currentModel: localStorage.getItem('travel_guide_model') || 'google/gemini-2.5-flash-lite',
    writingStyle: localStorage.getItem('travel_guide_voice') || 'parker',
    score: parseInt(localStorage.getItem('travel_guide_score')) || 0,
    history: [],
    map: null,
    homeMap: null,
    homeMarker: null,
    bottomMap: null,
    bottomMarker: null,
    bottomMapCoords: { lat: randomDestination.lat, lng: randomDestination.lng },
    selectedCoords: { lat: randomDestination.lat, lng: randomDestination.lng },
    markers: [],
    isGenerating: false,
    guesses: {}, // Track user guesses: { 'cat-item': true/false }
    pageAwarded: false, // Track if page bonus has been awarded
    customVoices: JSON.parse(localStorage.getItem('travel_guide_custom_voices') || '{}'), // Custom user-defined voices
    selectedYear: parseInt(localStorage.getItem('travel_guide_year')) || 2025, // Selected year for historical context
    timeBoxEnabled: localStorage.getItem('travel_guide_timebox_enabled') !== 'false' // Time period feature toggle (default: true)
};

// Writing Style Personas
const WRITING_STYLES = {
    parker: {
        name: "Algonquin RoundTable",
        prompt: "Write in the style of Dorothy Parker - razor-sharp wit, biting humor, and devastating one-liners. Use elegant yet caustic prose with sophisticated observations and perfectly timed sarcasm.",
        icon: "cocktail"
    },
    thompson: {
        name: "Gonzo journalism",
        prompt: "Write in the style of Hunter S. Thompson - gonzo journalism with wild imagery, sharp cultural criticism, dark humor, and surreal observations. Use punchy, irreverent prose with vivid metaphors.",
        icon: "sunglasses"
    },
    battuta: {
        name: "Ibn Battuta",
        prompt: "Write in the style of Ibn Battuta - focus on Islamic culture, trade routes, scholarly encounters, and the hospitality of rulers. Include observations about religious practices and social customs with reverence and wonder.",
        icon: "compass"
    },
    wodehouse: {
        name: "Victorian Butler",
        prompt: "Write in the style of P.G. Wodehouse - delightfully absurd, charming, and whimsical prose with impeccable comedic timing. Use elaborate metaphors, British wit, and cheerfully convoluted sentences.",
        icon: "tophat"
    },
    keys: {
        name: "A Man Who Lost His Keys",
        prompt: "Write in the style of a man desperately trying to remember where he left his keys - distracted, scattered thoughts that keep veering off topic. Obsessively mention checking pockets, retracing steps, and sudden false epiphanies about key locations. Frequently lose train of thought mid-sentence.",
        icon: "key"
    }
};

// Voice-matched static feedback messages for reveals
// 4 scenarios: guessedTrue_correct, guessedTrue_wrong, guessedFalse_correct, guessedFalse_wrong
const VOICE_BADGE_MESSAGES = {
    parker: {
        guessedTrue_correct: [
            "Well spotted, darling",
            "How terribly perceptive",
            "Indeed. Genuine, sadly",
            "The truth, unfortunately",
            "Quite authentic, I'm afraid",
            "Depressingly accurate",
            "True, though dull",
            "Correct. How tedious",
            "The truth, for once",
            "Authentic, regrettably"
        ],
        guessedTrue_wrong: [
            "A charming mistake, dear",
            "Wrong, but delightfully so",
            "Actually false, sweetie",
            "Not quite, darling",
            "Incorrect, I'm afraid",
            "That was the lie, dear",
            "Fooled you beautifully",
            "Pure fiction, actually",
            "Wrong, but so am I usually",
            "The lie got you, dear"
        ],
        guessedFalse_correct: [
            "A delightful fiction",
            "Pure fabrication, darling",
            "Entirely false, well done",
            "The lie revealed",
            "Fake as my smile",
            "Utterly untrue, dear",
            "Fiction at its finest",
            "A charming falsehood",
            "The lie, spotted",
            "False as a flatterer"
        ],
        guessedFalse_wrong: [
            "Actually true, unfortunately",
            "The depressing truth",
            "Genuine, I'm afraid",
            "True, sadly",
            "Wrong, dear. It's real",
            "Authentic after all",
            "The truth, alas",
            "Real, surprisingly",
            "True, though boring",
            "Genuine, regrettably"
        ]
    },
    thompson: {
        guessedTrue_correct: [
            "Right on, brother!",
            "The ugly truth!",
            "Real as it gets",
            "Hard truth, kid",
            "Damn straight!",
            "Truth hurts, baby!",
            "You got it!",
            "Reality bites!",
            "The real deal!",
            "Nailed it, man!"
        ],
        guessedTrue_wrong: [
            "Wrong, kid!",
            "Fell for the lies!",
            "They got you!",
            "Pure propaganda!",
            "You bought the BS!",
            "Fake news got you!",
            "Conned, baby!",
            "Fiction, man!",
            "The lie wins!",
            "Fooled again!"
        ],
        guessedFalse_correct: [
            "Total BS, baby!",
            "Lies and propaganda!",
            "Fake news, pure fiction",
            "Caught the lie!",
            "Called their bluff!",
            "Fiction exposed!",
            "Bull detected!",
            "Saw through it!",
            "Lie busted!",
            "Fake as hell!"
        ],
        guessedFalse_wrong: [
            "Actually real, man!",
            "Truth, believe it!",
            "No lie here, kid!",
            "Real deal!",
            "Legit truth!",
            "Straight facts!",
            "The actual truth!",
            "Real as pain!",
            "Genuine article!",
            "True story, baby!"
        ]
    },
    battuta: {
        guessedTrue_correct: [
            "True, as Allah is my witness",
            "An authentic account",
            "This is the truth",
            "By the grace of God, true",
            "Genuine, praise be",
            "The truth, inshallah",
            "Authentic indeed",
            "True by Allah's will",
            "The truth stands",
            "Genuine account"
        ],
        guessedTrue_wrong: [
            "False, dear traveler",
            "Not as witnessed",
            "A falsehood, sadly",
            "Untrue, I fear",
            "Incorrect, friend",
            "Not authentic",
            "The lie prevailed",
            "False by my account",
            "Not the truth",
            "A fabrication"
        ],
        guessedFalse_correct: [
            "A falsehood, praise be!",
            "This is untrue",
            "Not as witnessed by this traveler",
            "False indeed",
            "Untrue, correctly spotted",
            "A fabrication exposed",
            "Not authentic",
            "The lie revealed",
            "False, well noted",
            "Untrue entirely"
        ],
        guessedFalse_wrong: [
            "True, as I witnessed",
            "Authentic account",
            "The truth, friend",
            "Genuine, by Allah",
            "True indeed",
            "The truth stands",
            "Authentic entirely",
            "True by witness",
            "The genuine account",
            "Truth prevails"
        ]
    },
    wodehouse: {
        guessedTrue_correct: [
            "The genuine article, by Jove!",
            "Quite true, old bean",
            "The absolute truth, what ho!",
            "Authentic, what!",
            "True as taxes!",
            "The real thing, by gad!",
            "Spot on, old fruit!",
            "Genuine, don't you know!",
            "Right as rain!",
            "True blue, what!"
        ],
        guessedTrue_wrong: [
            "Wrong, old chap!",
            "Fooled, what!",
            "Bamboozled, by Jove!",
            "Not quite, old bean",
            "False, I'm afraid!",
            "The lie got you!",
            "Incorrect, what ho!",
            "Hoodwinked!",
            "Wrong as wrong!",
            "The fib prevailed!"
        ],
        guessedFalse_correct: [
            "Utter poppycock, what!",
            "A fabrication of the first water",
            "Balderdash, pure and simple",
            "Complete rot!",
            "Absolute tosh!",
            "Piffle spotted!",
            "Total bunkum!",
            "The lie exposed!",
            "Tommyrot, correctly noted!",
            "Pure codswallop!"
        ],
        guessedFalse_wrong: [
            "True, old bean!",
            "The real McCoy!",
            "Genuine, what!",
            "Authentic, by gad!",
            "True blue!",
            "The truth, what ho!",
            "Real as real!",
            "Quite genuine!",
            "The actual thing!",
            "True, don't you know!"
        ]
    },
    keys: {
        guessedTrue_correct: [
            "Oh! That's true. Not my keys though.",
            "Actually true. Unlike finding my keys.",
            "True! Wait, did I check there for my keys?",
            "Right! But where are my keys?",
            "Correct. Keys aren't here either.",
            "True. Still no keys.",
            "Yes! Wait, what about my keys?",
            "True! Did I check my pockets?",
            "Right! Maybe keys are... no.",
            "Correct! Keys though... where?"
        ],
        guessedTrue_wrong: [
            "Wrong! Like my memory of my keys.",
            "False. Just like thinking my keys are here.",
            "No, that's... wait, my keys!",
            "Wrong. Where are my keys?",
            "False! Keys aren't... wait.",
            "No, that's the lie. Keys?",
            "Wrong. Did I check for keys?",
            "False. My keys... where?",
            "No! Wait, my keys though...",
            "Wrong! Keys... checked there?"
        ],
        guessedFalse_correct: [
            "Wait, no, that's not right...",
            "Huh? No, that's false. Keys aren't there either.",
            "False! Like my memory of where I left my keys.",
            "Right! That's false. Keys though?",
            "Yeah, false. Where are keys?",
            "Lie spotted! Still no keys.",
            "False! Did I check... keys?",
            "Yes, a lie! Keys where?",
            "Fake! My keys are... where?",
            "False! Keys in my pocket?"
        ],
        guessedFalse_wrong: [
            "No, that's true! Keys though?",
            "Actually true. Keys aren't.",
            "Wrong! It's true. My keys...",
            "No, real! Where are keys?",
            "True! But my keys?",
            "That's true. Keys aren't.",
            "Actually real! Keys though?",
            "No, genuine! My keys where?",
            "True! Did I check... keys?",
            "Real! But where are keys?"
        ]
    }
};

// Voice Icons (Emoji)
const VOICE_ICONS = {
    steamboat: '🚢',
    bird: '🦅',
    compass: '🧭',
    cocktail: '🍸',
    tophat: '🎩',
    key: '🔑',
    sunglasses: '🕶️',
};

// Category Templates by Location Type - optimized for faster LLM generation
const CATEGORY_TEMPLATES = {
    city: ['Introduction', 'Where to Go', 'What to Eat', 'What to Do', 'Practical Tips'],
    museum: ['Introduction', 'Must-See Exhibits', 'Hidden Gems', 'Visitor Information'],
    building: ['Introduction', 'History', 'Notable Features', 'Visiting'],
    monument: ['Introduction', 'Historical Context', 'Cultural Impact', 'Visiting'],
    nature: ['Introduction', 'What to Do', 'Flora & Fauna', 'Best Times to Visit'],
    restaurant: ['Introduction', 'Signature Dishes', 'Atmosphere', 'Practical Information'],
    default: ['Introduction', 'Where to Go', 'What to Do', 'Practical Information']
};

// Diverse suggestion pools for dynamic generation
const SUGGESTION_POOLS = {
    cities: ['Paris', 'Tokyo', 'Rome', 'Barcelona', 'Istanbul', 'Cairo', 'Bangkok', 'Rio de Janeiro', 'Sydney', 'New York', 'London', 'Dubai', 'Singapore', 'Amsterdam', 'Prague'],
    landmarks: ['The Louvre', 'Machu Picchu', 'Taj Mahal', 'Colosseum', 'Eiffel Tower', 'Great Wall of China', 'Petra', 'Angkor Wat', 'Sagrada Familia', 'Stonehenge'],
    museums: ['British Museum', 'Metropolitan Museum of Art', 'Uffizi Gallery', 'Hermitage Museum', 'Prado Museum', 'Vatican Museums', 'Smithsonian'],
    nature: ['Grand Canyon', 'Mount Fuji', 'Santorini', 'Yosemite', 'Banff', 'Patagonia', 'Serengeti', 'Great Barrier Reef']
};

// Fetch relevant image from Wikipedia/Wikimedia
async function fetchWikipediaImage(query) {
    try {
        // First, search Wikipedia for the page
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
            return null;
        }

        const pageTitle = searchData.query.search[0].title;

        // Get the page's main image
        const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=original&titles=${encodeURIComponent(pageTitle)}`;
        const imageResponse = await fetch(imageUrl);
        const imageData = await imageResponse.json();

        const pages = imageData.query.pages;
        const pageId = Object.keys(pages)[0];

        if (pages[pageId].original) {
            return pages[pageId].original.source;
        }

        return null;
    } catch (error) {
        console.error('Error fetching Wikipedia image:', error);
        return null;
    }
}

// Fallback to placeholder image
async function fetchPlaceholderImage(query) {
    const width = 1600;
    const height = 900;
    const seed = Math.abs(query.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0));
    return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

// Load hero image for a place
async function loadPlaceHeroImage(locationName) {
    const heroContainer = document.getElementById('placeHero');
    const heroImage = document.getElementById('placeHeroImage');

    // Try to get Wikipedia image first, fallback to placeholder
    let imageUrl = await fetchWikipediaImage(locationName);

    if (!imageUrl) {
        imageUrl = await fetchPlaceholderImage(locationName);
    }

    if (imageUrl) {
        // Add error handler to try fallback if image fails to load
        heroImage.onerror = async () => {
            // If Wikipedia image fails, try placeholder
            if (imageUrl.includes('wikipedia')) {
                const fallbackUrl = await fetchPlaceholderImage(locationName);
                if (fallbackUrl && fallbackUrl !== heroImage.src) {
                    heroImage.src = fallbackUrl;
                } else {
                    heroContainer.style.display = 'none';
                    heroImage.style.display = 'none';
                }
            } else {
                heroContainer.style.display = 'none';
                heroImage.style.display = 'none';
            }
        };

        // Add load handler to show hero when image loads successfully
        heroImage.onload = () => {
            heroImage.style.display = 'block';
            heroContainer.style.display = 'block';
        };

        heroImage.src = imageUrl;
        heroImage.alt = locationName;
    } else {
        // Hide hero if no image URL
        heroContainer.style.display = 'none';
    }
}

// Initialize home map with draggable marker
function initializeHomeMap() {
    // Create map centered on random global destination with city-level zoom
    AppState.homeMap = L.map('homeMap').setView([AppState.selectedCoords.lat, AppState.selectedCoords.lng], 6);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(AppState.homeMap);

    // Create custom marker icon with accent color
    const customIcon = L.divIcon({
        className: 'custom-pin-marker',
        html: `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26c0-8.8-7.2-16-16-16zm0 22c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"
                  fill="#d96b5e" stroke="white" stroke-width="2"/>
        </svg>`,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -42]
    });

    // Add draggable marker with custom colored icon
    AppState.homeMarker = L.marker([AppState.selectedCoords.lat, AppState.selectedCoords.lng], {
        draggable: true,
        icon: customIcon
    }).addTo(AppState.homeMap);

    // Update coordinates when marker is dragged
    AppState.homeMarker.on('dragend', function(e) {
        const position = e.target.getLatLng();
        AppState.selectedCoords = { lat: position.lat, lng: position.lng };
    });

    // Click on map to move marker
    AppState.homeMap.on('click', function(e) {
        AppState.homeMarker.setLatLng(e.latlng);
        AppState.selectedCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
    });
}

// Initialize bottom map with draggable marker
function initializeBottomMap(lat, lng) {
    // Clear existing map if present
    if (AppState.bottomMap) {
        AppState.bottomMap.remove();
        AppState.bottomMap = null;
        AppState.bottomMarker = null;
    }

    // Update coordinates
    AppState.bottomMapCoords = { lat, lng };

    // Create map centered on place coordinates (zoomed out to show city level)
    AppState.bottomMap = L.map('bottomMap').setView([lat, lng], 9);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(AppState.bottomMap);

    // Create custom marker icon with accent color
    const customIcon = L.divIcon({
        className: 'custom-pin-marker',
        html: `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26c0-8.8-7.2-16-16-16zm0 22c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"
                  fill="#d96b5e" stroke="white" stroke-width="2"/>
        </svg>`,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -42]
    });

    // Add draggable marker with custom colored icon
    AppState.bottomMarker = L.marker([lat, lng], {
        draggable: true,
        icon: customIcon
    }).addTo(AppState.bottomMap);

    // Update coordinates when marker is dragged
    AppState.bottomMarker.on('dragend', function(e) {
        const position = e.target.getLatLng();
        AppState.bottomMapCoords = { lat: position.lat, lng: position.lng };
    });

    // Click on map to move marker
    AppState.bottomMap.on('click', function(e) {
        AppState.bottomMarker.setLatLng(e.latlng);
        AppState.bottomMapCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
    });
}

// Reverse geocode coordinates to get location name
async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            {
                headers: {
                    'User-Agent': 'TwoTruthsLieTravelGuide/1.0'
                }
            }
        );

        const data = await response.json();

        if (data && data.address) {
            // Try to get a meaningful location name
            const addr = data.address;
            const locationName = addr.city || addr.town || addr.village ||
                               addr.county || addr.state || addr.country ||
                               `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            return locationName;
        }

        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

// Generate random suggestion chips
function generateSuggestionChips() {
    const container = document.getElementById('quickSuggestions');

    // Clear existing chips (except label)
    const label = container.querySelector('.suggestion-label');
    container.innerHTML = '';
    container.appendChild(label);

    // Pick 1 random city
    const city = SUGGESTION_POOLS.cities[Math.floor(Math.random() * SUGGESTION_POOLS.cities.length)];

    // Pick 1 random landmark
    const landmark = SUGGESTION_POOLS.landmarks[Math.floor(Math.random() * SUGGESTION_POOLS.landmarks.length)];

    // Pick 1 random museum or nature spot
    const extraPool = Math.random() > 0.5 ? SUGGESTION_POOLS.museums : SUGGESTION_POOLS.nature;
    const extra = extraPool[Math.floor(Math.random() * extraPool.length)];

    // Combine and create chips
    const suggestions = [city, landmark, extra];

    suggestions.forEach(location => {
        const chip = document.createElement('button');
        chip.className = 'suggestion-chip';
        chip.dataset.location = location;
        chip.textContent = location;
        chip.addEventListener('click', () => {
            document.getElementById('locationInput').value = location;
            handleExplore();
        });
        container.appendChild(chip);
    });
}

// Initialize Application
// ==========================================
// YEAR SELECTOR FUNCTIONALITY
// ==========================================

// Timeline constants
const TIMELINE_CONFIG = {
    BIG_BANG: -13800000000,  // 13.8 billion years ago
    FAR_FUTURE: 1000002025,  // 1 billion years from now
    PRESENT: 2025,
    SVG_WIDTH: 7000,  // Increased to accommodate all periods
    SVG_HEIGHT: 120,
    MARGIN: 50,
    TIMELINE_Y: 60
};

// Define time periods with pixel allocations (left to right: past to future)
// More pixels = more detail/granularity
const TIME_PERIODS = [
    // Deep past
    { start: -13800000000, end: -4600000000, pixels: 150, label: 'Big Bang Era' },
    { start: -4600000000, end: -541000000, pixels: 200, label: 'Precambrian' },
    // Geological eras
    { start: -541000000, end: -252000000, pixels: 200, label: 'Paleozoic' },
    { start: -252000000, end: -66000000, pixels: 200, label: 'Mesozoic' },
    { start: -66000000, end: -2600000, pixels: 250, label: 'Cenozoic' },
    { start: -2600000, end: -10000, pixels: 300, label: 'Pleistocene' },
    // Human history
    { start: -10000, end: -3000, pixels: 450, label: 'Neolithic' },
    { start: -3000, end: 0, pixels: 550, label: 'Bronze/Iron Age' },
    { start: 0, end: 500, pixels: 350, label: 'Classical' },
    { start: 500, end: 1000, pixels: 300, label: 'Early Medieval' },
    { start: 1000, end: 1500, pixels: 350, label: 'Late Medieval' },
    { start: 1500, end: 1800, pixels: 400, label: 'Early Modern' },
    { start: 1800, end: 1900, pixels: 500, label: '19th Century' },
    { start: 1900, end: 1950, pixels: 400, label: 'Early 20th' },
    { start: 1950, end: 2000, pixels: 500, label: 'Late 20th' },
    { start: 2000, end: 2025, pixels: 350, label: '21st Century' },
    // Future
    { start: 2025, end: 2100, pixels: 350, label: 'Near Future' },
    { start: 2100, end: 2500, pixels: 300, label: '22nd-25th Century' },
    { start: 2500, end: 5000, pixels: 300, label: 'Next Millennia' },
    { start: 5000, end: 100000, pixels: 200, label: 'Distant Future' },
    { start: 100000, end: 1000002025, pixels: 150, label: 'Deep Future' }
];

// Build cumulative pixel positions for periods
function buildPixelMap() {
    let cumulative = TIMELINE_CONFIG.MARGIN;
    return TIME_PERIODS.map(period => {
        const startX = cumulative;
        cumulative += period.pixels;
        return {
            ...period,
            startX,
            endX: cumulative
        };
    });
}

const PIXEL_MAP = buildPixelMap();

// Format year for display
function formatYearDisplay(year) {
    if (year === 2025) return 'Present Day (2025)';

    // Far future or past (use scientific notation for billions)
    if (Math.abs(year) >= 1000000000) {
        const billions = Math.abs(year) / 1000000000;
        if (year > 0) {
            return `${billions.toFixed(1)}B years in the future`;
        } else {
            return `${billions.toFixed(1)}B years ago (Big Bang era)`;
        }
    }

    // Millions of years
    if (Math.abs(year) >= 1000000) {
        const millions = Math.abs(year) / 1000000;
        if (year > 0) {
            return `${millions.toFixed(1)}M years in the future`;
        } else {
            return `${millions.toFixed(1)}M years ago`;
        }
    }

    // Thousands of years
    if (year < 0) {
        if (year < -100000) {
            const thousands = Math.abs(year) / 1000;
            return `${thousands.toFixed(0)}K years ago`;
        }
        return `${Math.abs(year)} BCE`;
    }

    // Future
    if (year > 2025) {
        if (year > 100000) {
            const thousands = year / 1000;
            return `${thousands.toFixed(0)}K years in the future`;
        }
        return `Future: ${year} CE`;
    }

    // Historical CE
    if (year > 0) return `${year} CE`;
    if (year === 1) return '1 CE';

    return `${Math.abs(year)} BCE`;
}

// Piecewise position-to-year conversion
function positionToYear(position) {
    // Find which period this position falls into
    for (const period of PIXEL_MAP) {
        if (position >= period.startX && position <= period.endX) {
            // Linear interpolation within this period
            const t = (position - period.startX) / (period.endX - period.startX);
            const year = period.start + t * (period.end - period.start);
            return Math.round(year);
        }
    }

    // Fallback for edge cases
    if (position < PIXEL_MAP[0].startX) return PIXEL_MAP[0].start;
    return PIXEL_MAP[PIXEL_MAP.length - 1].end;
}

// Year-to-position conversion (inverse of above)
function yearToPosition(year) {
    // Find which period this year falls into
    for (const period of PIXEL_MAP) {
        if (year >= period.start && year <= period.end) {
            // Linear interpolation within this period
            const t = (year - period.start) / (period.end - period.start);
            const x = period.startX + t * (period.endX - period.startX);
            return x;
        }
    }

    // Fallback for edge cases
    if (year < PIXEL_MAP[0].start) return PIXEL_MAP[0].startX;
    return PIXEL_MAP[PIXEL_MAP.length - 1].endX;
}

// Generate tick marks for the timeline
function generateTimelineTicks() {
    const ticks = [];

    // Add period boundaries and era labels
    PIXEL_MAP.forEach((period, idx) => {
        // Era label at the center of each period
        const centerX = (period.startX + period.endX) / 2;
        ticks.push({
            year: null,
            x: centerX,
            isEraLabel: true,
            label: period.label
        });

        // Start boundary tick
        ticks.push({
            year: period.start,
            x: period.startX,
            major: true,
            label: formatTickLabel(period.start)
        });

        // Add intermediate ticks based on period size (2-3x more frequent than before)
        const yearSpan = period.end - period.start;
        let tickInterval;

        if (yearSpan > 1000000000) tickInterval = 400000000; // 400M
        else if (yearSpan > 100000000) tickInterval = 40000000; // 40M
        else if (yearSpan > 10000000) tickInterval = 4000000; // 4M
        else if (yearSpan > 1000000) tickInterval = 200000; // 200K
        else if (yearSpan > 100000) tickInterval = 20000; // 20K
        else if (yearSpan > 10000) tickInterval = 800; // 800 years
        else if (yearSpan > 1000) tickInterval = 200; // 200 years
        else if (yearSpan > 500) tickInterval = 40; // 40 years
        else if (yearSpan > 100) tickInterval = 20; // 20 years
        else if (yearSpan > 50) tickInterval = 10; // 10 years
        else tickInterval = 5; // 5 years

        // Add intermediate minor ticks
        for (let y = period.start + tickInterval; y < period.end; y += tickInterval) {
            ticks.push({
                year: y,
                x: yearToPosition(y),
                major: false,
                label: formatTickLabel(y),
                showLabel: false  // Will be determined later based on spacing
            });
        }

        // End boundary (for last period)
        if (idx === PIXEL_MAP.length - 1) {
            ticks.push({
                year: period.end,
                x: period.endX,
                major: true,
                label: formatTickLabel(period.end),
                showLabel: true
            });
        }
    });

    // Determine which labels to show based on spacing (prevent overlap)
    const MIN_LABEL_SPACING = 60; // Minimum pixels between labels (increased to prevent overlap)
    let lastLabelX = -Infinity;

    ticks.forEach(tick => {
        if (tick.isEraLabel) {
            tick.showLabel = true; // Always show era labels (positioned separately)
        } else {
            // Check spacing for both major and minor labels
            if (tick.x - lastLabelX >= MIN_LABEL_SPACING) {
                tick.showLabel = true;
                lastLabelX = tick.x;
            } else {
                tick.showLabel = false; // Hide this label to prevent overlap
            }
        }
    });

    return ticks;
}

// Format tick label (shorter than full display)
function formatTickLabel(year) {
    if (year === TIMELINE_CONFIG.BIG_BANG) return 'Big Bang';
    if (year === TIMELINE_CONFIG.PRESENT) return 'Now';
    if (year === TIMELINE_CONFIG.FAR_FUTURE) return '+1B yr';

    if (Math.abs(year) >= 1000000000) {
        const b = Math.abs(year) / 1000000000;
        return year > 0 ? `+${b.toFixed(0)}B` : `-${b.toFixed(0)}B`;
    }
    if (Math.abs(year) >= 1000000) {
        const m = Math.abs(year) / 1000000;
        return year > 0 ? `+${m.toFixed(0)}M` : `-${m.toFixed(0)}M`;
    }
    if (Math.abs(year) >= 10000) {
        const k = Math.abs(year) / 1000;
        return year > 0 ? `+${k.toFixed(0)}K` : `-${k.toFixed(0)}K`;
    }
    if (year < 0) return `${Math.abs(year)} BCE`;
    if (year < 2000) return `${year}`;
    return `${year}`;
}

// Center the timeline on a specific year
function centerTimelineOnYear(year) {
    const scrollContainer = document.getElementById('timelineScrollContainer');
    if (!scrollContainer) return; // Not yet initialized

    const yearX = yearToPosition(year);
    const containerWidth = scrollContainer.clientWidth;
    scrollContainer.scrollTo({
        left: yearX - containerWidth / 2,
        behavior: 'smooth'
    });
}

// Initialize year selector with SVG timeline
function initializeYearSelector() {
    const svg = document.getElementById('timelineSvg');
    const yearDisplay = document.getElementById('yearDisplay');
    const setTimeBtn = document.getElementById('setTimeBtn');

    let selectedYearTemp = AppState.selectedYear;
    let isDragging = false;

    // Draw the timeline
    function drawTimeline() {
        const {SVG_WIDTH, SVG_HEIGHT, MARGIN, TIMELINE_Y} = TIMELINE_CONFIG;
        svg.innerHTML = '';

        // Base line
        const baseLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        baseLine.setAttribute('x1', MARGIN);
        baseLine.setAttribute('y1', TIMELINE_Y);
        baseLine.setAttribute('x2', SVG_WIDTH - MARGIN);
        baseLine.setAttribute('y2', TIMELINE_Y);
        baseLine.setAttribute('class', 'timeline-base-line');
        svg.appendChild(baseLine);

        // Tick marks
        const ticks = generateTimelineTicks();
        ticks.forEach(tick => {
            if (tick.isEraLabel) {
                // Era label above the timeline
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', tick.x);
                text.setAttribute('y', TIMELINE_Y - 20);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('class', 'timeline-era-label');
                text.textContent = tick.label;
                svg.appendChild(text);
            } else {
                // Tick mark
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', tick.x);
                line.setAttribute('x2', tick.x);
                line.setAttribute('y1', TIMELINE_Y - (tick.major ? 12 : 6));
                line.setAttribute('y2', TIMELINE_Y + (tick.major ? 12 : 6));
                line.setAttribute('class', tick.major ? 'timeline-tick-major' : 'timeline-tick-minor');
                svg.appendChild(line);

                // Label only if showLabel is true (prevents overlap)
                if (tick.showLabel && tick.label) {
                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('x', tick.x);
                    text.setAttribute('y', TIMELINE_Y + 30);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('class', tick.major ? 'timeline-label' : 'timeline-label-minor');
                    text.textContent = tick.label;
                    svg.appendChild(text);
                }
            }
        });

        // Draggable handle
        const handleX = yearToPosition(selectedYearTemp);
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        handle.setAttribute('class', 'timeline-handle');
        handle.setAttribute('id', 'timelineHandle');

        const handleLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        handleLine.setAttribute('x1', handleX);
        handleLine.setAttribute('y1', TIMELINE_Y - 15);
        handleLine.setAttribute('x2', handleX);
        handleLine.setAttribute('y2', TIMELINE_Y + 15);
        handleLine.setAttribute('class', 'timeline-handle-line');

        const handleCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handleCircle.setAttribute('cx', handleX);
        handleCircle.setAttribute('cy', TIMELINE_Y);
        handleCircle.setAttribute('r', 8);
        handleCircle.setAttribute('class', 'timeline-handle-circle');

        handle.appendChild(handleLine);
        handle.appendChild(handleCircle);
        svg.appendChild(handle);
    }

    // Update handle position
    function updateHandle(x) {
        const {MARGIN, SVG_WIDTH} = TIMELINE_CONFIG;
        x = Math.max(MARGIN, Math.min(SVG_WIDTH - MARGIN, x));

        const year = positionToYear(x);
        selectedYearTemp = year;
        yearDisplay.textContent = formatYearDisplay(year);

        const handle = document.getElementById('timelineHandle');
        if (handle) {
            const line = handle.querySelector('.timeline-handle-line');
            const circle = handle.querySelector('.timeline-handle-circle');
            line.setAttribute('x1', x);
            line.setAttribute('x2', x);
            circle.setAttribute('cx', x);
        }

        // Show/hide "Set Time" button
        if (year !== AppState.selectedYear) {
            setTimeBtn.style.display = 'block';
        } else {
            setTimeBtn.style.display = 'none';
        }
    }

    // Mouse/touch event handlers - only on the handle
    const handle = document.getElementById('timelineHandle');
    const scrollContainer = document.getElementById('timelineScrollContainer');

    function handleStart(e) {
        // Only start dragging if touching the handle
        if (e.target.closest('.timeline-handle')) {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
        }
    }

    function handleMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = svg.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const svgX = ((clientX - rect.left) / rect.width) * TIMELINE_CONFIG.SVG_WIDTH;

        updateHandle(svgX);
    }

    function handleEnd(e) {
        if (isDragging) {
            isDragging = false;
        }
    }

    // Click to select (anywhere on timeline)
    function handleClick(e) {
        if (e.target.closest('.timeline-handle')) return;

        const rect = svg.getBoundingClientRect();
        const clientX = e.clientX;
        const svgX = ((clientX - rect.left) / rect.width) * TIMELINE_CONFIG.SVG_WIDTH;

        updateHandle(svgX);
    }

    // Add event listeners on document for drag, but only on svg for click
    svg.addEventListener('mousedown', handleStart);
    svg.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
    svg.addEventListener('click', handleClick);

    // Set Time button
    setTimeBtn.addEventListener('click', () => {
        AppState.selectedYear = selectedYearTemp;
        localStorage.setItem('travel_guide_year', selectedYearTemp);
        setTimeBtn.style.display = 'none';

        const styleName = WRITING_STYLES[AppState.writingStyle]?.name || AppState.customVoices[AppState.writingStyle]?.style?.name || AppState.writingStyle;
        const yearText = formatYearDisplay(selectedYearTemp);
        showNotification(`Time: ${yearText} • Voice: ${styleName}`, 'info');

        // Close voice menu
        closeVoiceMenu();

        // Regenerate current page if viewing one
        if (AppState.currentLocation) {
            if (!hasApiAccess()) {
                showNotification('Please add your OpenRouter API key in settings to regenerate content', 'error');
                toggleSettings();
                return;
            }
            regenerateCurrentPage();
        }
    });

    // Time box toggle
    const timeBoxToggle = document.getElementById('timeBoxToggle');
    const timelineContent = document.getElementById('timelineContent');

    // Set initial state
    timeBoxToggle.checked = AppState.timeBoxEnabled;
    if (!AppState.timeBoxEnabled) {
        timelineContent.style.display = 'none';
        AppState.selectedYear = 2025;
        localStorage.setItem('travel_guide_year', '2025');
    }

    timeBoxToggle.addEventListener('change', (e) => {
        AppState.timeBoxEnabled = e.target.checked;
        localStorage.setItem('travel_guide_timebox_enabled', e.target.checked);

        if (e.target.checked) {
            // Enable time box - show timeline
            timelineContent.style.display = 'block';
        } else {
            // Disable time box - collapse timeline and reset to present
            timelineContent.style.display = 'none';
            AppState.selectedYear = 2025;
            localStorage.setItem('travel_guide_year', '2025');

            // If viewing a page, regenerate with present day
            if (AppState.currentLocation) {
                if (!hasApiAccess()) {
                    showNotification('Please add your OpenRouter API key in settings to regenerate content', 'error');
                    return;
                }
                regenerateCurrentPage();
            }
        }
    });

    // Initial draw
    drawTimeline();
    yearDisplay.textContent = formatYearDisplay(AppState.selectedYear);

    // Scroll to show the current year centered
    centerTimelineOnYear(AppState.selectedYear);
}

// ==========================================
// APP INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Debug: Log API key state on initialization
    console.log('App initialized. API Key state:', {
        hasApiKey: !!AppState.apiKey,
        isUsingDefault: isUsingDefaultKey(),
        localStorageKey: !!localStorage.getItem('openrouter_api_key')
    });

    // Set up event listeners
    document.getElementById('exploreBtn').addEventListener('click', handleExplore);
    document.getElementById('exploreMapBtn').addEventListener('click', handleExploreMap);
    document.getElementById('exploreBottomMapBtn').addEventListener('click', handleExploreBottomMap);
    document.getElementById('nearMeBtn').addEventListener('click', handleNearMe);
    document.getElementById('locationInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleExplore();
    });
    document.getElementById('backBtn').addEventListener('click', showSearchSection);

    // Logo home click
    document.getElementById('logoHome').addEventListener('click', showSearchSection);

    // Info panel
    document.getElementById('infoBtn').addEventListener('click', toggleInfoPanel);
    document.getElementById('closeInfoPanel').addEventListener('click', closeInfoPanel);

    // Voice toggle
    document.getElementById('voiceToggle').addEventListener('click', toggleVoiceMenu);

    // Voice menu
    document.getElementById('closeVoiceMenu').addEventListener('click', closeVoiceMenu);
    document.querySelectorAll('.voice-option').forEach(option => {
        option.addEventListener('click', () => {
            const voice = option.dataset.voice;
            selectVoice(voice);
        });
    });

    // Settings panel - using footer button instead of hamburger menu
    document.getElementById('footerSettingsBtn').addEventListener('click', toggleSettings);
    document.getElementById('closeSettings').addEventListener('click', closeSettings);
    document.getElementById('saveApiKey').addEventListener('click', saveApiKey);
    document.getElementById('resetApiKey').addEventListener('click', resetToDefaultKey);
    document.getElementById('resetScoreBtn').addEventListener('click', resetScore);

    // Set model select to persisted value
    const modelSelect = document.getElementById('modelSelect');
    const customModelInput = document.getElementById('customModelInput');
    const customModelField = document.getElementById('customModelField');

    // Check if current model is custom (not in dropdown options)
    const isCustomModel = AppState.currentModel && !Array.from(modelSelect.options).some(opt => opt.value === AppState.currentModel);

    if (isCustomModel) {
        modelSelect.value = '__custom__';
        customModelField.value = AppState.currentModel;
        customModelInput.style.display = 'block';
    } else {
        modelSelect.value = AppState.currentModel;
    }

    modelSelect.addEventListener('change', (e) => {
        if (e.target.value === '__custom__') {
            // Show custom model input
            customModelInput.style.display = 'block';
            customModelField.focus();
        } else {
            // Hide custom model input and use dropdown selection
            customModelInput.style.display = 'none';
            AppState.currentModel = e.target.value;
            localStorage.setItem('travel_guide_model', e.target.value);
            updateFooterModelName();
            // Refresh current page if viewing one
            if (AppState.currentLocation) {
                // Check if we have API access before regenerating
                if (!hasApiAccess()) {
                    showNotification('Please add your OpenRouter API key in settings to regenerate content', 'error');
                    toggleSettings();
                    return;
                }
                regenerateCurrentPage();
            }
        }
    });

    // Custom model save button
    document.getElementById('saveCustomModel').addEventListener('click', () => {
        const customModel = customModelField.value.trim();
        if (!customModel) {
            showNotification('Please enter a model name', 'error');
            return;
        }

        // Basic validation for OpenRouter model format
        if (!customModel.includes('/')) {
            showNotification('Model should be in format: provider/model-name', 'error');
            return;
        }

        AppState.currentModel = customModel;
        localStorage.setItem('travel_guide_model', customModel);
        updateFooterModelName();
        showNotification('Custom model saved', 'success');

        // Refresh current page if viewing one
        if (AppState.currentLocation) {
            // Check if we have API access before regenerating
            if (!hasApiAccess()) {
                showNotification('Please add your OpenRouter API key in settings to regenerate content', 'error');
                toggleSettings();
                return;
            }
            regenerateCurrentPage();
        }
    });

    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.getElementById('locationInput').value = chip.dataset.location;
            handleExplore();
        });
    });

    // Update score display and load API key
    updateScoreDisplay();

    // Initialize voice icon
    updateVoiceIcon();

    // Initialize footer model name
    updateFooterModelName();

    // Update API key status indicator
    updateApiKeyStatus();

    // Note: We don't load the API key into the password field here because browsers
    // often block programmatic password field population on page load for security.
    // Instead, we load it when the settings panel is opened (see toggleSettings())

    // Generate random suggestion chips and initialize home map
    generateSuggestionChips();
    initializeHomeMap();

    // Load custom voices
    loadCustomVoices();

    // Initialize year selector
    initializeYearSelector();

    // Custom voice generation
    document.getElementById('createVoiceBtn').addEventListener('click', generateCustomVoice);
    document.getElementById('customVoiceInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') generateCustomVoice();
    });

    // Note: We always have a key now (default key), so don't auto-open settings

    // Check for hash on page load and navigate to that location
    if (window.location.hash) {
        const location = decodeURIComponent(window.location.hash.substring(1));
        if (location) {
            loadPlace(location, false);
        }
    }

    // Handle browser back/forward and hash changes
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.location) {
            loadPlace(e.state.location, false);
        } else if (window.location.hash) {
            const location = decodeURIComponent(window.location.hash.substring(1));
            if (location) {
                loadPlace(location, false);
            } else {
                showSearchSection();
            }
        } else {
            showSearchSection();
        }
    });

    // Handle hash changes (e.g., from manual URL edits)
    window.addEventListener('hashchange', (e) => {
        if (window.location.hash) {
            const location = decodeURIComponent(window.location.hash.substring(1));
            if (location) {
                loadPlace(location, false);
            }
        } else {
            showSearchSection();
        }
    });

    // Handle pull-to-refresh
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        const touchY = e.touches[0].clientY;
        const touchDiff = touchY - touchStartY;

        // If we're at the top of the page and pulling down
        if (window.scrollY === 0 && touchDiff > 0 && AppState.currentLocation) {
            // This will trigger a page refresh which we want to intercept
        }
    }, { passive: true });

    // Add pulsing hint to voice button for first-time users
    const hasOpenedVoiceMenu = localStorage.getItem('travel_guide_voice_menu_opened');
    if (!hasOpenedVoiceMenu) {
        document.getElementById('voiceToggle').classList.add('pulse-hint');
    }
}

// Regenerate Current Page
function regenerateCurrentPage() {
    if (!AppState.currentLocation) return;

    // Get the current location name from history (last item)
    const currentLocationName = AppState.history[AppState.history.length - 1];

    // Remove the last item from history temporarily
    AppState.history.pop();

    // Reload the page
    loadPlace(currentLocationName, true);

    // Close settings panel
    closeSettings();
}

// Voice Menu Functions
function toggleVoiceMenu() {
    const panel = document.getElementById('voiceMenuPanel');
    const settingsPanel = document.getElementById('settingsPanel');

    // Close settings if open
    if (settingsPanel.classList.contains('open')) {
        closeSettings();
        setTimeout(() => {
            openVoiceMenu();
        }, 200);
    } else {
        if (panel.style.display === 'none') {
            openVoiceMenu();
        } else {
            closeVoiceMenu();
        }
    }
}

function openVoiceMenu() {
    const panel = document.getElementById('voiceMenuPanel');
    panel.style.display = 'block';
    panel.offsetHeight; // Force reflow
    panel.classList.add('open');

    // Update active voice option
    updateActiveVoiceOption();

    // Center timeline on current selected year
    centerTimelineOnYear(AppState.selectedYear);

    // Remove pulse hint on first open and mark as opened
    const voiceToggle = document.getElementById('voiceToggle');
    if (voiceToggle.classList.contains('pulse-hint')) {
        voiceToggle.classList.remove('pulse-hint');
        localStorage.setItem('travel_guide_voice_menu_opened', 'true');
    }
}

function closeVoiceMenu() {
    const panel = document.getElementById('voiceMenuPanel');
    panel.classList.remove('open');

    setTimeout(() => {
        panel.style.display = 'none';
    }, 200);
}

function selectVoice(voice) {
    AppState.writingStyle = voice;
    localStorage.setItem('travel_guide_voice', voice); // Persist voice choice

    // Update icon
    updateVoiceIcon();

    // Update active state
    updateActiveVoiceOption();

    // Show notification with voice and year
    const styleName = WRITING_STYLES[voice]?.name || AppState.customVoices[voice]?.style?.name || voice;
    const yearText = formatYearDisplay(AppState.selectedYear);
    showNotification(`Voice: ${styleName} • Time: ${yearText}`, 'info');

    // Refresh current page if viewing one
    if (AppState.currentLocation) {
        // Check if we have API access before regenerating
        if (!hasApiAccess()) {
            showNotification('Please add your OpenRouter API key in settings to regenerate content', 'error');
            toggleSettings();
            closeVoiceMenu();
            return;
        }
        regenerateCurrentPage();
    }

    // Close menu
    closeVoiceMenu();
}

function updateActiveVoiceOption() {
    document.querySelectorAll('.voice-option').forEach(option => {
        if (option.dataset.voice === AppState.writingStyle) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

function updateVoiceIcon() {
    const iconElement = document.getElementById('voiceIcon');
    const toggleElement = document.getElementById('voiceToggle');
    const currentStyle = WRITING_STYLES[AppState.writingStyle] || AppState.customVoices[AppState.writingStyle];

    if (!currentStyle) return;

    const iconKey = currentStyle.icon;

    if (VOICE_ICONS[iconKey]) {
        iconElement.textContent = VOICE_ICONS[iconKey];
    } else {
        // For custom voices, show first emoji from name or default
        iconElement.textContent = currentStyle.icon || '✍️';
    }

    // Update data-voice attribute for background color
    toggleElement.setAttribute('data-voice', AppState.writingStyle);

    // Apply custom color for custom voices (inline style)
    if (AppState.writingStyle.startsWith('custom_') && AppState.customVoices[AppState.writingStyle]?.style?.color) {
        iconElement.style.background = AppState.customVoices[AppState.writingStyle].style.color;
    } else {
        iconElement.style.background = '';  // Clear inline style for built-in voices
    }
}

// Load custom voices on initialization
function loadCustomVoices() {
    // Load custom voices from localStorage
    const customVoices = JSON.parse(localStorage.getItem('travel_guide_custom_voices') || '{}');
    AppState.customVoices = customVoices;

    // Add custom voices to WRITING_STYLES dynamically
    Object.keys(customVoices).forEach(voiceKey => {
        WRITING_STYLES[voiceKey] = customVoices[voiceKey].style;
        VOICE_BADGE_MESSAGES[voiceKey] = customVoices[voiceKey].messages;
    });

    // Render custom voice buttons
    renderCustomVoices();
}

// Render custom voice buttons in the UI
function renderCustomVoices() {
    const container = document.getElementById('customVoicesContainer');
    if (!container) return;

    container.innerHTML = '';

    Object.keys(AppState.customVoices).forEach(voiceKey => {
        const voice = AppState.customVoices[voiceKey];
        const button = document.createElement('button');
        button.className = 'voice-option custom-voice-option';
        button.dataset.voice = voiceKey;

        const bgColor = voice.style.color || 'rgba(128, 128, 128, 0.15)';
        button.innerHTML = `
            <div class="voice-option-emoji" style="background: ${bgColor};">${voice.style.icon || '✍️'}</div>
            <div class="voice-option-text">
                <div class="voice-option-name">${voice.style.name}</div>
                <div class="voice-option-desc">Custom voice</div>
            </div>
            <button class="delete-voice-btn" onclick="deleteCustomVoice(event, '${voiceKey}')" title="Delete this voice">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        button.addEventListener('click', () => {
            selectVoice(voiceKey);
        });

        container.appendChild(button);
    });
}

// Convert HSL to RGB
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Delete a custom voice
function deleteCustomVoice(event, voiceKey) {
    event.stopPropagation();

    if (!confirm(`Delete the "${AppState.customVoices[voiceKey].style.name}" voice?`)) {
        return;
    }

    delete AppState.customVoices[voiceKey];
    delete WRITING_STYLES[voiceKey];
    delete VOICE_BADGE_MESSAGES[voiceKey];

    localStorage.setItem('travel_guide_custom_voices', JSON.stringify(AppState.customVoices));

    // If currently using this voice, switch to parker
    if (AppState.writingStyle === voiceKey) {
        selectVoice('parker');
    }

    renderCustomVoices();
    showNotification('Custom voice deleted', 'info');
}

// Generate custom voice using LLM
async function generateCustomVoice() {
    const input = document.getElementById('customVoiceInput');
    const statusEl = document.getElementById('customVoiceStatus');
    const createBtn = document.getElementById('createVoiceBtn');

    const voiceDescription = input.value.trim();

    if (!voiceDescription) {
        showNotification('Please enter a voice description', 'error');
        return;
    }

    // Check if we have API access (via key or Cloudflare Worker)
    if (!hasApiAccess()) {
        showNotification('Please add your OpenRouter API key in settings', 'error');
        toggleSettings();
        return;
    }

    // Show loading state
    createBtn.disabled = true;
    createBtn.textContent = 'Generating...';
    statusEl.textContent = 'Generating voice feedback messages...';
    statusEl.style.color = '#2196F3';

    try {
        const prompt = `Create a unique writing voice based on: "${voiceDescription}"

Generate feedback messages for a True/False travel game in this voice. Return ONLY valid JSON with this exact structure:

{
  "name": "Voice Name",
  "prompt": "Write in the style of [description] - [key characteristics]. Use [distinctive features].",
  "icon": "🎭",
  "messages": {
    "guessedTrue_correct": [10 short phrases confirming truth in this voice],
    "guessedTrue_wrong": [10 short phrases revealing it was false in this voice],
    "guessedFalse_correct": [10 short phrases confirming it was false in this voice],
    "guessedFalse_wrong": [10 short phrases revealing it was true in this voice]
  }
}

Each message should be 3-8 words, capture the voice's personality, and be appropriate for the scenario.
Make "name" a short, memorable name for this voice (2-4 words).
Make "prompt" detailed instructions for writing in this style (20-40 words).
Choose an appropriate emoji for "icon".`;

        const response = await callLLM(prompt, 2000);

        // Parse JSON response
        let voiceData;
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                voiceData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (error) {
            console.error('Failed to parse JSON:', error);
            throw new Error('Failed to generate voice - try again');
        }

        // Validate structure
        if (!voiceData.name || !voiceData.prompt || !voiceData.messages) {
            throw new Error('Invalid voice data structure');
        }

        // Create unique voice key
        const voiceKey = 'custom_' + Date.now();

        // Generate random pastel color for custom voice
        const hue = Math.floor(Math.random() * 360);
        const customColor = `rgba(${hslToRgb(hue / 360, 0.7, 0.6).join(', ')}, 0.15)`;

        // Store custom voice
        AppState.customVoices[voiceKey] = {
            style: {
                name: voiceData.name,
                prompt: voiceData.prompt,
                icon: voiceData.icon || '✍️',
                color: customColor
            },
            messages: voiceData.messages
        };

        // Add to global style/message collections
        WRITING_STYLES[voiceKey] = AppState.customVoices[voiceKey].style;
        VOICE_BADGE_MESSAGES[voiceKey] = voiceData.messages;

        // Save to localStorage
        localStorage.setItem('travel_guide_custom_voices', JSON.stringify(AppState.customVoices));

        // Render and select the new voice
        renderCustomVoices();
        selectVoice(voiceKey);

        // Clear input and show success
        input.value = '';
        statusEl.textContent = `Created: ${voiceData.name}`;
        statusEl.style.color = '#4CAF50';

        setTimeout(() => {
            statusEl.textContent = '';
        }, 3000);

    } catch (error) {
        console.error('Error generating custom voice:', error);
        statusEl.textContent = error.message || 'Failed to generate voice';
        statusEl.style.color = '#f44336';
    } finally {
        createBtn.disabled = false;
        createBtn.textContent = 'Generate Voice';
    }
}

// Make globally available
window.deleteCustomVoice = deleteCustomVoice;

// Info Panel Functions
function toggleInfoPanel() {
    const panel = document.getElementById('infoPanel');
    const voicePanel = document.getElementById('voiceMenuPanel');
    const settingsPanel = document.getElementById('settingsPanel');

    // Close other panels if open
    if (voicePanel.classList.contains('open')) {
        closeVoiceMenu();
    }
    if (settingsPanel.classList.contains('open')) {
        closeSettings();
    }

    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        panel.offsetHeight; // Force reflow
        setTimeout(() => {
            panel.classList.add('open');
        }, 10);
    } else {
        closeInfoPanel();
    }
}

function closeInfoPanel() {
    const panel = document.getElementById('infoPanel');
    panel.classList.remove('open');

    setTimeout(() => {
        panel.style.display = 'none';
    }, 200);
}

// Settings Panel Management
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');

    // Show panel if hidden
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        // Force reflow before adding class
        panel.offsetHeight;
    }

    panel.classList.toggle('open');

    // Update API key status and load key into input field when opening
    if (panel.classList.contains('open')) {
        const apiKeyInput = document.getElementById('apiKeyInput');
        // Always try to load the saved API key (if not using default)
        if (!isUsingDefaultKey() && AppState.apiKey) {
            apiKeyInput.value = AppState.apiKey;
            console.log('API key loaded into settings field');
        } else {
            console.log('Using default key or no custom key saved');
        }
        updateApiKeyStatus();
    }

    // Hide panel after animation if closing
    if (!panel.classList.contains('open')) {
        setTimeout(() => {
            panel.style.display = 'none';
        }, 200);
    }
}

function closeSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.classList.remove('open');

    // Hide panel after animation
    setTimeout(() => {
        panel.style.display = 'none';
    }, 200);
}

function saveApiKey() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    if (!apiKey) {
        showNotification('Please enter a valid API key', 'error');
        return;
    }

    // Save to both AppState and localStorage
    AppState.apiKey = apiKey;
    localStorage.setItem('openrouter_api_key', apiKey);

    showNotification('API key saved!', 'success');
    updateApiKeyStatus();

    // Close settings panel after short delay
    setTimeout(() => {
        closeSettings();
    }, 1000);
}

function resetToDefaultKey() {
    localStorage.removeItem('openrouter_api_key');
    AppState.apiKey = getValidApiKey();
    document.getElementById('apiKeyInput').value = '';

    if (AppState.apiKey) {
        showNotification('Reset to free-tier API key', 'success');
    } else {
        showNotification('No default API key available. Please enter your own OpenRouter API key.', 'error');
    }
    updateApiKeyStatus();
}

function isUsingDefaultKey() {
    // User is using default key if they haven't saved a custom one in localStorage
    return !localStorage.getItem('openrouter_api_key');
}

function updateApiKeyStatus() {
    const statusElement = document.getElementById('apiKeyStatus');
    if (statusElement) {
        if (!AppState.apiKey) {
            statusElement.innerHTML = '<span style="color: #f44336;">⚠ No API key set - please add your OpenRouter API key</span>';
        } else if (isUsingDefaultKey()) {
            statusElement.innerHTML = '<span style="color: #4CAF50;">✓ Using shared free-tier key (free models only)</span>';
        } else {
            statusElement.innerHTML = '<span style="color: #2196F3;">✓ Using your personal API key</span>';
        }
    }
}

// Handle Explore Map Location
async function handleExploreMap() {
    // Check if we have API access before proceeding
    if (!hasApiAccess()) {
        showNotification('Please add your OpenRouter API key in settings', 'error');
        toggleSettings();
        return;
    }

    const locationName = await reverseGeocode(AppState.selectedCoords.lat, AppState.selectedCoords.lng);

    // Cancel any ongoing generation
    if (AppState.isGenerating) {
        AppState.isGenerating = false;
    }

    await loadPlace(locationName, true);
}

// Handle Explore Bottom Map Location
async function handleExploreBottomMap() {
    // Check if we have API access before proceeding
    if (!hasApiAccess()) {
        showNotification('Please add your OpenRouter API key in settings', 'error');
        toggleSettings();
        return;
    }

    const locationName = await reverseGeocode(AppState.bottomMapCoords.lat, AppState.bottomMapCoords.lng);

    // Cancel any ongoing generation
    if (AppState.isGenerating) {
        AppState.isGenerating = false;
    }

    // Clear breadcrumb history for fresh exploration
    AppState.history = [];

    await loadPlace(locationName, true);
}

// Handle Near Me
async function handleNearMe() {
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by your browser', 'error');
        return;
    }

    showNotification('Getting your location...', 'info');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            // Update map marker
            AppState.homeMarker.setLatLng([lat, lng]);
            AppState.homeMap.setView([lat, lng], 12);
            AppState.selectedCoords = { lat, lng };

            const locationName = await reverseGeocode(lat, lng);
            showNotification(`Found: ${locationName}`, 'success');

            // Optionally auto-explore
            // await loadPlace(locationName, true);
        },
        (error) => {
            let message = 'Unable to get your location';
            if (error.code === error.PERMISSION_DENIED) {
                message = 'Location permission denied. Please enable location access.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                message = 'Location information unavailable';
            } else if (error.code === error.TIMEOUT) {
                message = 'Location request timed out';
            }
            showNotification(message, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Handle Explore
async function handleExplore() {
    const location = document.getElementById('locationInput').value.trim();
    if (!location) {
        showNotification('Please enter a location', 'error');
        return;
    }

    // Check if we have API access (via key or Cloudflare Worker)
    if (!hasApiAccess()) {
        showNotification('Please add your OpenRouter API key in settings', 'error');
        toggleSettings();
        return;
    }

    // Cancel any ongoing generation
    if (AppState.isGenerating) {
        AppState.isGenerating = false;
    }

    await loadPlace(location, true);
}

// Strip parenthetical content from location name
function stripParenthetical(locationName) {
    // Remove everything from the first opening parenthesis onwards
    const index = locationName.indexOf('(');
    if (index !== -1) {
        return locationName.substring(0, index).trim();
    }
    return locationName;
}

// Load Place
async function loadPlace(location, addToHistory = true) {
    AppState.isGenerating = true;

    // Show place section and update UI immediately
    document.getElementById('searchSection').style.display = 'none';
    document.getElementById('placeSection').style.display = 'block';
    document.getElementById('loadingState').style.display = 'flex';
    document.getElementById('categoriesContainer').innerHTML = '';

    // Update loading text with voice/year description above the hint
    const randomMessage = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
    const styleName = WRITING_STYLES[AppState.writingStyle]?.name || AppState.customVoices[AppState.writingStyle]?.style?.name || 'Custom Voice';
    const yearText = formatYearDisplay(AppState.selectedYear);
    const loadingText = `Generating with ${styleName} for ${yearText}...\n\n${randomMessage}`;
    document.getElementById('loadingText').textContent = loadingText;

    // Update header immediately with the new location
    document.getElementById('placeName').textContent = location;
    document.getElementById('placeType').textContent = 'Loading...';

    // Update history and breadcrumb immediately
    if (addToHistory) {
        // Strip parenthetical content before adding to history to avoid nested parentheses
        const cleanLocationName = stripParenthetical(location);
        AppState.history.push(cleanLocationName);
        history.pushState({ location: cleanLocationName }, '', `#${encodeURIComponent(cleanLocationName)}`);
    }
    updateBreadcrumb();

    // Load hero image for this place
    loadPlaceHeroImage(location);

    try {
        // Generate content
        const placeData = await generatePlaceContent(location);

        // Check if still generating (not cancelled)
        if (!AppState.isGenerating) {
            return;
        }

        // Display content
        displayPlaceContent(placeData);

        // Initialize map
        initializeMap(placeData);

        document.getElementById('loadingState').style.display = 'none';
    } catch (error) {
        console.error('Error loading place:', error);
        // Show helpful error message with actionable suggestions
        let errorMessage = error.message || 'Failed to generate content';

        // Add actionable suggestions based on error type
        if (errorMessage.includes('parse')) {
            errorMessage = 'Unable to generate content for this location. Try a different search term or tap the logo to start over.';
        } else if (errorMessage.includes('API')) {
            errorMessage += ' Please check your connection or try again.';
        } else {
            errorMessage += ' Pull down to reload or tap the logo to start over.';
        }

        showNotification(errorMessage, 'error');
        document.getElementById('loadingState').style.display = 'none';

        // Show a helpful message on the page
        document.getElementById('categoriesContainer').innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--color-text-light);">
                <p style="font-size: 1.125rem; margin-bottom: 1rem;">Unable to generate content</p>
                <p style="margin-bottom: 1.5rem;">Try searching for a different location or tap the logo to start over.</p>
                <button onclick="showSearchSection()" style="padding: 0.75rem 1.5rem; background: var(--color-accent); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem;">
                    Start Over
                </button>
            </div>
        `;
    } finally {
        AppState.isGenerating = false;
    }
}

// Randomize which items are lies - each tile has 33% chance of being false
function randomizeTileTruths(placeData) {
    placeData.categories.forEach(category => {
        // For each category, randomly assign isLie to each of the 3 items
        // Each item has a 33% chance of being false
        category.items.forEach(item => {
            item.isLie = Math.random() < 0.33;
        });
    });
    return placeData;
}

// Generate Place Content using LLM
async function generatePlaceContent(location) {
    const writingStyle = WRITING_STYLES[AppState.writingStyle];

    // Determine location type - use a simpler heuristic to save an API call
    let locationType = 'default';
    const lowerLocation = location.toLowerCase();
    if (lowerLocation.includes('museum')) locationType = 'museum';
    else if (lowerLocation.includes('cathedral') || lowerLocation.includes('tower') ||
             lowerLocation.includes('palace') || lowerLocation.includes('castle')) locationType = 'building';
    else if (lowerLocation.includes('monument') || lowerLocation.includes('statue') ||
             lowerLocation.includes('memorial')) locationType = 'monument';
    else if (lowerLocation.includes('park') || lowerLocation.includes('beach') ||
             lowerLocation.includes('mountain') || lowerLocation.includes('forest')) locationType = 'nature';
    else if (lowerLocation.includes('restaurant') || lowerLocation.includes('cafe') ||
             lowerLocation.includes('bar')) locationType = 'restaurant';
    else if (location.split(' ').length <= 2 && !lowerLocation.includes('the')) locationType = 'city';

    const categories = CATEGORY_TEMPLATES[locationType] || CATEGORY_TEMPLATES.default;

    // Add year context if not present day (keep it concise for speed)
    let yearContext = '';
    if (AppState.selectedYear !== 2025) {
        const yearDisplay = formatYearDisplay(AppState.selectedYear);
        if (AppState.selectedYear > 2025) {
            yearContext = ` Write as if visiting in ${yearDisplay}. Speculate on future developments.`;
        } else if (AppState.selectedYear > 0) {
            yearContext = ` Write about ${yearDisplay}. Describe what actually existed then.`;
        } else {
            yearContext = ` Write about ${yearDisplay} (ancient/prehistoric era). Describe the landscape and what existed.`;
        }
    }

    // Generate content - optimized prompt for speed
    const prompt = `Travel guide for "${location}". ${writingStyle.prompt}${yearContext}

For each category, write 2 TRUE facts and 1 FALSE fact (2-3 sentences each). Make them all plausible and detailed.

For FALSE facts ONLY: Include "explanation" field (10 words or less) explaining why it's false.
For TRUE facts: No explanation needed.

Format: Wrap place names, landmarks, restaurants, museums, and key details in <strong> tags. Every item needs at least 2 strong-tagged phrases.

Categories: ${categories.join(', ')}

Return valid JSON:
{
  "name": "${location}",
  "type": "${locationType}",
  "coordinates": {"lat": <number>, "lon": <number>},
  "categories": [
    {
      "name": "Category Name",
      "items": [
        {"text": "True description with <strong>Place Name</strong> and <strong>details</strong>.", "isLie": false},
        {"text": "False description with <strong>Landmark</strong> and <strong>feature</strong>.", "isLie": true, "explanation": "Short reason (10 words max)"},
        {"text": "Another true fact with <strong>Restaurant</strong> and <strong>dish</strong>.", "isLie": false}
      ]
    }
  ]
}`;

    const response = await callLLM(prompt, 1800);

    // Parse JSON response
    let placeData;
    try {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            placeData = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error('No JSON found in response');
        }
    } catch (error) {
        console.error('Failed to parse JSON:', error);
        throw new Error('Failed to parse location data');
    }

    // Randomize the order of items in each category so the false one isn't always in the same position
    placeData.categories.forEach(category => {
        // Fisher-Yates shuffle
        for (let i = category.items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [category.items[i], category.items[j]] = [category.items[j], category.items[i]];
        }
    });

    // Skip geocoding for speed - just return the data
    placeData.mentionedPlaces = [];

    return placeData;
}

// Call OpenRouter LLM (via Cloudflare Worker or direct)
async function callLLM(prompt, maxTokens = 2000) {
    try {
        // Determine which endpoint to use
        const useProxy = CLOUDFLARE_WORKER_URL && CLOUDFLARE_WORKER_URL !== null;
        const endpoint = useProxy
            ? CLOUDFLARE_WORKER_URL
            : 'https://openrouter.ai/api/v1/chat/completions';

        // Build headers
        const headers = {
            'Content-Type': 'application/json'
        };

        // Add Authorization header only for direct API calls
        if (!useProxy) {
            headers['Authorization'] = `Bearer ${AppState.apiKey}`;
            headers['HTTP-Referer'] = window.location.origin;
            headers['X-Title'] = 'Two Truths & A Lie Travel Guide';
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: AppState.currentModel,
                messages: [
                    { role: 'user', content: prompt }
                ],
                max_tokens: maxTokens
            })
        });

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (parseError) {
                // If we can't parse the error response, get it as text
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`API Error (${response.status}): ${errorText}`);
            }

            // Extract error message from various possible error formats
            const errorMessage = errorData.error?.message ||
                                errorData.message ||
                                errorData.error ||
                                JSON.stringify(errorData);
            throw new Error(`API Error (${response.status}): ${errorMessage}`);
        }

        const data = await response.json();

        // Check if response has an error field (even with 200 status)
        if (data.error) {
            const errorMessage = data.error.message || data.error.code || JSON.stringify(data.error);
            throw new Error(`API Error: ${errorMessage}`);
        }

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from API');
        }

        return data.choices[0].message.content;
    } catch (error) {
        console.error('LLM API Error:', error);
        if (error.message.includes('401') || error.message.includes('403')) {
            throw new Error('Invalid API key. Please check your OpenRouter API key in settings.');
        } else if (error.message.includes('429')) {
            throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        } else if (error.message.includes('insufficient')) {
            throw new Error('Insufficient credits on your OpenRouter account.');
        }
        throw error;
    }
}

// Extract place names from content and geocode them
async function extractAndGeocodePlaces(placeData) {
    const mentionedPlaces = new Set();

    // Extract potential place names - be more strict
    placeData.categories.forEach(category => {
        category.items.forEach(item => {
            // Look for proper nouns - at least 2 words or well-known single places
            // Match patterns like "Central Park", "Eiffel Tower", etc.
            const matches = item.text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g);
            if (matches) {
                matches.forEach(match => {
                    // Filter out common phrases and short matches
                    const words = match.split(' ');
                    const firstWord = words[0];

                    // Skip if starts with common words or is too generic
                    if (['The', 'A', 'An', 'In', 'On', 'At', 'For', 'To', 'From', 'This', 'That',
                         'These', 'Those', 'It', 'Its', 'Many', 'Most', 'Some'].includes(firstWord)) {
                        return;
                    }

                    // Only include if it looks like a real place name (has keywords or is 2+ words)
                    if (words.length >= 2 || match.match(/(Museum|Park|Palace|Tower|Cathedral|Castle|Temple|Square|Street|Avenue|Beach|Mountain|River|Lake)/)) {
                        mentionedPlaces.add(match);
                    }
                });
            }
        });
    });

    // Geocode places in parallel - limit to 5 most likely places
    const placesArray = Array.from(mentionedPlaces).slice(0, 5);

    // Geocode in parallel for speed
    const geocodePromises = placesArray.map(async place => {
        try {
            await new Promise(resolve => setTimeout(resolve, 200)); // Stagger requests
            const coords = await geocodePlace(place);
            if (coords) {
                return { name: place, ...coords };
            }
        } catch (error) {
            console.error(`Failed to geocode ${place}:`, error);
        }
        return null;
    });

    const results = await Promise.all(geocodePromises);
    return results.filter(r => r !== null);
}

// Geocode a place name using Nominatim
async function geocodePlace(placeName) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`,
            {
                headers: {
                    'User-Agent': 'TwoTruthsLieTravelGuide/1.0'
                }
            }
        );

        const data = await response.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }
    return null;
}

// Display Place Content
function displayPlaceContent(placeData) {
    AppState.currentLocation = placeData;
    AppState.guesses = {}; // Reset guesses for new page
    AppState.pageAwarded = false; // Reset page bonus

    // Update header
    document.getElementById('placeName').textContent = placeData.name;
    document.getElementById('placeType').textContent = placeData.type || 'Location';

    // Create categories
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';

    placeData.categories.forEach((category, categoryIndex) => {
        const categoryEl = createCategoryElement(category, categoryIndex);
        container.appendChild(categoryEl);
    });

    // Show and initialize bottom map
    const bottomMapContainer = document.getElementById('bottomMapContainer');
    const exploreBottomMapBtn = document.getElementById('exploreBottomMapBtn');

    if (placeData.coordinates) {
        bottomMapContainer.style.display = 'block';
        exploreBottomMapBtn.style.display = 'flex';

        // Initialize map with place coordinates
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            initializeBottomMap(placeData.coordinates.lat, placeData.coordinates.lon);
        }, 100);
    } else {
        bottomMapContainer.style.display = 'none';
        exploreBottomMapBtn.style.display = 'none';
    }
}

// Create Category Element
function createCategoryElement(category, categoryIndex) {
    const section = document.createElement('div');
    section.className = 'category';

    const header = document.createElement('h2');
    header.className = 'category-title';
    header.textContent = category.name;
    section.appendChild(header);

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'items-container';

    category.items.forEach((item, itemIndex) => {
        const itemEl = createItemElement(item, categoryIndex, itemIndex);
        itemsContainer.appendChild(itemEl);
    });

    section.appendChild(itemsContainer);
    return section;
}

// Create Item Element
function createItemElement(item, categoryIndex, itemIndex) {
    const itemEl = document.createElement('div');
    itemEl.className = 'item';
    const itemId = `${categoryIndex}-${itemIndex}`;
    itemEl.dataset.itemId = itemId;
    itemEl.dataset.categoryIndex = categoryIndex;
    itemEl.dataset.itemIndex = itemIndex;
    itemEl.dataset.isLie = item.isLie;

    // Convert place names to links
    const textWithLinks = convertPlaceNamesToLinks(item.text);

    const textEl = document.createElement('div');
    textEl.className = 'item-text';
    textEl.innerHTML = textWithLinks;

    itemEl.appendChild(textEl);

    // Add guess buttons
    const guessButtons = document.createElement('div');
    guessButtons.className = 'guess-buttons';

    const trueBtn = document.createElement('button');
    trueBtn.className = 'guess-btn guess-true';
    trueBtn.innerHTML = '✓ True';
    trueBtn.onclick = (e) => {
        e.stopPropagation();
        if (!itemEl.classList.contains('revealed')) {
            makeGuess(itemEl, itemId, false); // false = not a lie = true
        }
    };

    const falseBtn = document.createElement('button');
    falseBtn.className = 'guess-btn guess-false';
    falseBtn.innerHTML = '✗ False';
    falseBtn.onclick = (e) => {
        e.stopPropagation();
        if (!itemEl.classList.contains('revealed')) {
            makeGuess(itemEl, itemId, true); // true = is a lie = false
        }
    };

    guessButtons.appendChild(trueBtn);
    guessButtons.appendChild(falseBtn);
    itemEl.appendChild(guessButtons);

    // Click on text to navigate to place links only
    textEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('place-link')) {
            return; // Let the link handle it
        }
    });

    return itemEl;
}

// Convert place names to clickable links
// Handles both <strong> tags and markdown **bold** syntax
function convertPlaceNamesToLinks(text) {
    // First, convert markdown **bold** to <strong> tags
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Then convert <strong>text</strong> to <strong><a href="..." class="place-link">text</a></strong>
    return text.replace(/<strong>(.*?)<\/strong>/g, (match, content) => {
        // Escape single quotes in content for onclick handler
        const escapedContent = content.replace(/'/g, "\\'");
        return `<strong><a href="#" class="place-link" onclick="handlePlaceLink(event, '${escapedContent}')">${content}</a></strong>`;
    });
}

// Handle place link clicks
function handlePlaceLink(event, placeName) {
    event.preventDefault();

    // Build contextual place name with breadcrumbs (last 3 only)
    let contextualName = placeName;
    if (AppState.history.length > 0) {
        // Add context from last 3 breadcrumbs in reverse order
        // e.g., "President Hotel (Asunción, Paraguay, South America)"
        const lastThree = AppState.history.slice(-3).reverse();
        const breadcrumbContext = lastThree.join(', ');
        contextualName = `${placeName} (${breadcrumbContext})`;
    }

    loadPlace(contextualName, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Make a guess on a tile
function makeGuess(itemEl, itemId, guessIsLie) {
    // Store guess and mark as revealed
    AppState.guesses[itemId] = guessIsLie;
    itemEl.classList.add('revealed');

    const actualIsLie = itemEl.dataset.isLie === 'true';
    const correct = guessIsLie === actualIsLie;
    const categoryIndex = itemEl.dataset.categoryIndex;

    // Award immediate points
    const points = correct ? 1 : -1;
    updateScore(points);

    // Add visual state for correct/incorrect and truth/lie
    if (actualIsLie) {
        itemEl.classList.add('is-lie');
    } else {
        itemEl.classList.add('is-truth');
    }

    if (correct) {
        itemEl.classList.add('guess-correct');
    } else {
        itemEl.classList.add('guess-incorrect');
    }

    // Get voice-specific badge messages based on 4 scenarios
    const badgeMessages = VOICE_BADGE_MESSAGES[AppState.writingStyle] || VOICE_BADGE_MESSAGES.parker;

    let resultMessage = '';
    let voiceMessage = '';
    let scenario = '';

    // Determine which scenario we're in
    if (!guessIsLie && !actualIsLie) {
        // Guessed TRUE, was TRUE
        scenario = 'guessedTrue_correct';
    } else if (!guessIsLie && actualIsLie) {
        // Guessed TRUE, was FALSE (lie)
        scenario = 'guessedTrue_wrong';
    } else if (guessIsLie && actualIsLie) {
        // Guessed FALSE, was FALSE (lie)
        scenario = 'guessedFalse_correct';
    } else {
        // Guessed FALSE, was TRUE
        scenario = 'guessedFalse_wrong';
    }

    const messages = badgeMessages[scenario];
    voiceMessage = messages[Math.floor(Math.random() * messages.length)];

    // Get explanation for false statements
    const categoryIdx = parseInt(categoryIndex);
    const itemIdx = parseInt(itemEl.dataset.itemIndex);
    const item = AppState.currentLocation.categories[categoryIdx].items[itemIdx];
    const explanation = actualIsLie && item.explanation ? item.explanation : null;

    // For false statements, show terse explanation instead of generic feedback
    if (actualIsLie && explanation) {
        if (correct) {
            resultMessage = `<div style="font-weight: 600; color: #4CAF50;">✓ ${explanation}</div>`;
        } else {
            resultMessage = `<div style="font-weight: 600; color: #f44336;">✗ ${explanation}</div>`;
        }
    } else {
        // For true statements
        if (correct) {
            resultMessage = `<div style="font-weight: 600; color: #4CAF50;">✓ Correct! +1</div><div>${voiceMessage}</div>`;
        } else {
            resultMessage = `<div style="font-weight: 600; color: #f44336;">✗ True, actually</div><div>${voiceMessage}</div>`;
        }
    }

    // Create and show overlay with feedback (only over buttons area)
    const overlay = document.createElement('div');
    overlay.className = `item-overlay ${correct ? 'overlay-correct' : 'overlay-incorrect'}`;
    overlay.innerHTML = resultMessage;

    // Append to guess buttons container instead of whole item
    const guessButtons = itemEl.querySelector('.guess-buttons');
    guessButtons.appendChild(overlay);

    // Trigger animation
    setTimeout(() => overlay.classList.add('show'), 10);

    // Disable guess buttons
    const buttons = itemEl.querySelectorAll('.guess-btn');
    buttons.forEach(btn => btn.disabled = true);

    // Check for trio completion
    checkTrioCompletion(categoryIndex);

    // Check for page completion
    checkPageCompletion();
}

// Check if a category trio is complete
function checkTrioCompletion(categoryIndex) {
    const categoryItems = document.querySelectorAll(`.item[data-category-index="${categoryIndex}"]`);

    // Check if all 3 items in this category are revealed
    const allRevealed = Array.from(categoryItems).every(item => item.classList.contains('revealed'));

    if (!allRevealed) return;

    // Check if already awarded bonus for this category
    if (categoryItems[0].dataset.trioAwarded === 'true') return;

    // Count correct guesses in this category
    let correctCount = 0;
    categoryItems.forEach(item => {
        if (item.classList.contains('guess-correct')) {
            correctCount++;
        }
    });

    // Award trio bonus
    let bonus = 0;
    let message = '';

    if (correctCount === 3) {
        bonus = 5;
        message = '🎯 Perfect Trio! +5';
        updateScore(bonus);
    } else if (correctCount === 0) {
        bonus = -5;
        message = '💥 All Wrong -5';
        updateScore(bonus);
    }

    // Mark trio as awarded
    categoryItems.forEach(item => {
        item.dataset.trioAwarded = 'true';
    });

    if (bonus !== 0) {
        showNotification(message, bonus > 0 ? 'success' : 'error');
    }
}

// Check if entire page is complete
function checkPageCompletion() {
    const allItems = document.querySelectorAll('.item');
    const allRevealed = Array.from(allItems).every(item => item.classList.contains('revealed'));

    if (!allRevealed) return;

    // Check if already awarded page bonus
    if (AppState.pageAwarded) return;

    // Count correct guesses
    let correctCount = 0;
    allItems.forEach(item => {
        if (item.classList.contains('guess-correct')) {
            correctCount++;
        }
    });

    // Award page bonus
    let bonus = 0;
    let message = '';

    if (correctCount === allItems.length) {
        bonus = 10;
        message = '🏆 Perfect Page! +10';
        updateScore(bonus);
    } else if (correctCount === 0) {
        bonus = -10;
        message = '😬 All Wrong -10';
        updateScore(bonus);
    }

    if (bonus !== 0) {
        AppState.pageAwarded = true;
        showNotification(message, bonus > 0 ? 'success' : 'error');
    }
}

// Update Score
function updateScore(delta) {
    const oldScore = AppState.score;
    AppState.score += delta;
    localStorage.setItem('travel_guide_score', AppState.score);
    updateScoreDisplay(delta, oldScore);
}

// Reset Score
function resetScore() {
    if (!confirm('Are you sure you want to reset your score to 0?')) {
        return;
    }

    const oldScore = AppState.score;
    AppState.score = 0;
    localStorage.setItem('travel_guide_score', 0);
    updateScoreDisplay(0 - oldScore, oldScore);
    showNotification('Score reset to 0', 'info');
}

function updateScoreDisplay(delta = 0, oldScore = AppState.score) {
    // Animate the score ticker
    if (delta !== 0) {
        animateScoreTicker(oldScore, AppState.score, delta > 0);
    } else {
        document.getElementById('scoreValue').textContent = AppState.score;
    }

    // Update score color based on value
    const scoreValueElement = document.getElementById('scoreValue');
    let scoreColor;
    if (AppState.score < 0) {
        // Red for negative scores
        scoreColor = '#d96b5e';
    } else if (AppState.score === 0) {
        // Neutral gray for zero
        scoreColor = '#6b6b6b';
    } else {
        // Green for positive scores
        scoreColor = '#52a675';
    }
    scoreValueElement.style.color = scoreColor;

    // Update header score indicator
    const headerScore = document.getElementById('headerScore');
    const headerScoreValue = document.getElementById('headerScoreValue');

    if (AppState.score !== 0) {
        headerScore.style.display = 'flex';

        // Add animation class based on delta
        if (delta > 0) {
            headerScore.classList.remove('score-decrease');
            headerScore.classList.add('score-increase');
            setTimeout(() => headerScore.classList.remove('score-increase'), 500);
        } else if (delta < 0) {
            headerScore.classList.remove('score-increase');
            headerScore.classList.add('score-decrease');
            setTimeout(() => headerScore.classList.remove('score-decrease'), 500);
        }

        // Update background color class based on score
        headerScore.classList.remove('score-positive', 'score-negative', 'score-neutral');
        if (AppState.score > 0) {
            headerScore.classList.add('score-positive');
        } else if (AppState.score < 0) {
            headerScore.classList.add('score-negative');
        } else {
            headerScore.classList.add('score-neutral');
        }

        // Animate header score
        if (delta !== 0) {
            animateHeaderScore(oldScore, AppState.score);
        } else {
            headerScoreValue.textContent = AppState.score;
        }
    } else {
        headerScore.style.display = 'none';
    }

    // Update title bar with score
    document.title = `(${AppState.score}) True/False Travel`;
}

// Update footer with current model name
function updateFooterModelName() {
    const footerModelEl = document.getElementById('footerModelName');
    if (!footerModelEl) return;

    const modelSelect = document.getElementById('modelSelect');
    const selectedOption = modelSelect?.options[modelSelect.selectedIndex];

    if (selectedOption) {
        if (selectedOption.value === '__custom__') {
            // Show the actual custom model name
            footerModelEl.textContent = AppState.currentModel || 'Custom Model';
        } else {
            footerModelEl.textContent = selectedOption.textContent;
        }
    }
}

// Animate score ticker
function animateScoreTicker(from, to, isIncrease) {
    const duration = 400;
    const steps = Math.abs(to - from);
    const stepDuration = duration / Math.max(steps, 1);
    let current = from;

    const interval = setInterval(() => {
        if (isIncrease) {
            current++;
            if (current >= to) {
                current = to;
                clearInterval(interval);
            }
        } else {
            current--;
            if (current <= to) {
                current = to;
                clearInterval(interval);
            }
        }
        document.getElementById('scoreValue').textContent = current;
    }, stepDuration);
}

// Animate header score
function animateHeaderScore(from, to) {
    const duration = 400;
    const steps = Math.abs(to - from);
    const stepDuration = duration / Math.max(steps, 1);
    let current = from;
    const isIncrease = to > from;

    const headerScoreValue = document.getElementById('headerScoreValue');
    const interval = setInterval(() => {
        if (isIncrease) {
            current++;
            if (current >= to) {
                current = to;
                clearInterval(interval);
            }
        } else {
            current--;
            if (current <= to) {
                current = to;
                clearInterval(interval);
            }
        }
        headerScoreValue.textContent = current;
    }, stepDuration);
}

// Initialize Map
function initializeMap(placeData) {
    // Clear existing map
    if (AppState.map) {
        AppState.map.remove();
    }

    // Create map centered on main location with appropriate zoom
    const coords = placeData.coordinates || { lat: 0, lon: 0 };

    // Determine zoom based on location type
    let zoom = 13;
    if (placeData.type === 'city') zoom = 11;
    else if (placeData.type === 'nature') zoom = 10;
    else if (placeData.type === 'building' || placeData.type === 'monument') zoom = 16;

    AppState.map = L.map('map').setView([coords.lat, coords.lon], zoom);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(AppState.map);

    // Add main location marker
    const mainMarker = L.marker([coords.lat, coords.lon], {
        icon: L.divIcon({
            className: 'custom-marker main-marker',
            html: '<div class="marker-pin"></div>',
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        })
    }).addTo(AppState.map);

    mainMarker.bindPopup(`<strong>${placeData.name}</strong>`);

    // Add markers for mentioned places (but keep focus on main location)
    if (placeData.mentionedPlaces && placeData.mentionedPlaces.length > 0) {
        placeData.mentionedPlaces.forEach(place => {
            const marker = L.marker([place.lat, place.lon], {
                icon: L.divIcon({
                    className: 'custom-marker mentioned-marker',
                    html: '<div class="marker-pin-small"></div>',
                    iconSize: [20, 28],
                    iconAnchor: [10, 28]
                })
            }).addTo(AppState.map);

            marker.bindPopup(`<a href="#" onclick="handlePlaceLink(event, '${place.name}')">${place.name}</a>`);
        });
    }

    // Keep map centered on main location
    // Don't use fitBounds - just stay focused on the primary location
}

// Update Breadcrumb
function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = AppState.history.map((location, index) => {
        if (index === AppState.history.length - 1) {
            return `<span class="breadcrumb-current">${location}</span>`;
        }
        return `<a href="#" class="breadcrumb-link" onclick="navigateToBreadcrumb(${index})">${location}</a>`;
    }).join(' <span class="breadcrumb-separator">›</span> ');
}

function navigateToBreadcrumb(index) {
    event.preventDefault();
    const location = AppState.history[index];
    AppState.history = AppState.history.slice(0, index);
    loadPlace(location, true);
}

// Show Search Section
function showSearchSection() {
    document.getElementById('searchSection').style.display = 'flex';
    document.getElementById('placeSection').style.display = 'none';
    AppState.history = [];
    history.pushState({}, '', '#');

    // Hide bottom map
    document.getElementById('bottomMapContainer').style.display = 'none';
    document.getElementById('exploreBottomMapBtn').style.display = 'none';

    // Regenerate suggestions on return to home
    generateSuggestionChips();

    // Re-initialize home map if it was cleared
    if (!AppState.homeMap) {
        initializeHomeMap();
    }
}

// Show Notification
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Make functions globally available
window.handlePlaceLink = handlePlaceLink;
window.navigateToBreadcrumb = navigateToBreadcrumb;
