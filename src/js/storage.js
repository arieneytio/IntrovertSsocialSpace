/* storage.js — the only place that talks to localStorage.
 *
 * Everything is kept under a single namespaced key as one JSON blob so the
 * whole app state can be read, written, exported or cleared in one shot.
 * Works from file:// with no server. Images live inline as data URLs.
 */
(function (global) {
    "use strict";

    // Internal storage key kept as-is across the renames (OfflineGram →
    // Introverts' Social Space) so existing saved data isn't orphaned.
    // It's never shown to the user.
    var KEY = "offlinegram.v1";

    var DEFAULTS = {
        profile: {
            name: "",
            status: "",
            availability: "online", // online | away | busy | invis
            avatar: null // data URL of a custom profile picture, or null for the initial
        },
        posts: [], // newest first: { id, text, images:[dataURL], likes, liked, createdAt }
        albums: [], // newest first: { id, name, images:[dataURL], createdAt }
        todos: [], // oldest first: { id, text, done, createdAt }
        sheets: [], // newest first: { id, name, columns:[string], rows:[[cell,...]], createdAt }

        // Daily reminders: the item list persists; `checked` resets each new day.
        reminders: {
            items: [
                { id: "r1", text: "Eat breakfast" },
                { id: "r2", text: "Eat lunch" },
                { id: "r3", text: "Eat supper" },
                { id: "r4", text: "Exercise" },
                { id: "r5", text: "Study something new" },
                { id: "r6", text: "Clean your room" },
                { id: "r7", text: "Organize your things" }
            ],
            checkedDate: "", // "YYYY-MM-DD" the checks below apply to
            checked: {},     // { itemId: true } for that day
            streak: 0,       // consecutive days all reminders were completed
            streakDate: ""   // "YYYY-MM-DD" the streak was last credited
        },

        // Chibi mascot: chosen design, whether it's hidden, and its dragged position.
        mascot: {
            design: "blob",  // blob | tsquare | ruler | floppy | card | sun | moon
            dismissed: false,
            x: null,         // fixed left/top in px once dragged, else null (default corner)
            y: null
        },

        // "Play with me" card duel — cumulative score + the mascot's learning data.
        game: {
            stats: { matches: 0, playerWins: 0, mascotWins: 0, ties: 0 },
            history: [] // up to 100 finished games; each is the player's picks per round, e.g. [4,2,7,...]
        }
    };

    // Deep-ish clone so callers never mutate DEFAULTS by reference.
    function freshState() {
        return JSON.parse(JSON.stringify(DEFAULTS));
    }

    function load() {
        try {
            var raw = global.localStorage.getItem(KEY);
            if (!raw) return freshState();
            var parsed = JSON.parse(raw);
            // Merge so older/partial saves still get all expected fields.
            var rem = parsed.reminders;
            var reminders;
            if (rem && typeof rem === "object") {
                reminders = {
                    items: Array.isArray(rem.items) ? rem.items : freshState().reminders.items,
                    checkedDate: typeof rem.checkedDate === "string" ? rem.checkedDate : "",
                    checked: (rem.checked && typeof rem.checked === "object") ? rem.checked : {},
                    streak: typeof rem.streak === "number" ? rem.streak : 0,
                    streakDate: typeof rem.streakDate === "string" ? rem.streakDate : ""
                };
            } else {
                // Existing saves predate reminders — seed the default list once.
                reminders = freshState().reminders;
            }

            var m = parsed.mascot;
            var mascot;
            if (m && typeof m === "object") {
                mascot = {
                    design: typeof m.design === "string" ? m.design : "blob",
                    dismissed: !!m.dismissed,
                    x: typeof m.x === "number" ? m.x : null,
                    y: typeof m.y === "number" ? m.y : null
                };
            } else {
                mascot = freshState().mascot;
            }

            var g = parsed.game;
            var game;
            if (g && typeof g === "object") {
                var st = (g.stats && typeof g.stats === "object") ? g.stats : {};
                game = {
                    stats: {
                        matches: Number(st.matches) || 0,
                        playerWins: Number(st.playerWins) || 0,
                        mascotWins: Number(st.mascotWins) || 0,
                        ties: Number(st.ties) || 0
                    },
                    history: Array.isArray(g.history) ? g.history.slice(-100) : []
                };
            } else {
                game = freshState().game;
            }

            return {
                profile: Object.assign({}, DEFAULTS.profile, parsed.profile),
                posts: Array.isArray(parsed.posts) ? parsed.posts : [],
                albums: Array.isArray(parsed.albums) ? parsed.albums : [],
                todos: Array.isArray(parsed.todos) ? parsed.todos : [],
                sheets: Array.isArray(parsed.sheets) ? parsed.sheets : [],
                reminders: reminders,
                mascot: mascot,
                game: game
            };
        } catch (err) {
            console.warn("Introverts' Social Space: could not read saved data, starting fresh.", err);
            return freshState();
        }
    }

    function save(state) {
        try {
            global.localStorage.setItem(KEY, JSON.stringify(state));
            return true;
        } catch (err) {
            // Most likely the 5–10 MB localStorage quota — usually too many/large images.
            console.error("Introverts' Social Space: save failed (storage full?).", err);
            return false;
        }
    }

    function clear() {
        global.localStorage.removeItem(KEY);
    }

    global.Store = {
        KEY: KEY,
        load: load,
        save: save,
        clear: clear,
        freshState: freshState
    };
})(window);
