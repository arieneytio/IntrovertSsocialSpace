/* app.js — UI logic for Introverts' Social Space.
 *
 * Reads/writes through the Store module (storage.js). No network, no server;
 * pictures are read with FileReader into data URLs so they persist as text.
 */
(function () {
    "use strict";

    // ---- State ----
    var state = Store.load();
    var pendingImages = []; // data URLs staged in the composer, not yet posted
    var openAlbumId = null; // id of the album currently shown in detail view, or null
    var todoFilter = "all"; // all | active | done
    var openSheetId = null; // id of the spreadsheet currently open, or null

    // Availability cycle for the status dot.
    var AVAILABILITY = ["online", "away", "busy", "invis"];

    // Cap image size we accept so we don't blow the localStorage quota.
    var MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB per file

    // ---- Element handles ----
    var el = {
        profileName: document.getElementById("profileName"),
        statusInput: document.getElementById("statusInput"),
        statusDot: document.getElementById("statusDot"),
        avatar: document.getElementById("avatar"),
        avatarInput: document.getElementById("avatarInput"),
        avatarRemove: document.getElementById("avatarRemove"),

        // Daily reminders
        remindersDate: document.getElementById("remindersDate"),
        reminderList: document.getElementById("reminderList"),
        remindersEmptyState: document.getElementById("remindersEmptyState"),
        newReminderForm: document.getElementById("newReminderForm"),
        newReminderText: document.getElementById("newReminderText"),
        reminderProgress: document.getElementById("reminderProgress"),

        // Mascot
        mascot: document.getElementById("mascot"),
        mascotBubble: document.getElementById("mascotBubble"),
        mascotBody: document.getElementById("mascotBody"),
        mascotControls: document.querySelector(".mascot-controls"),
        mascotDesignBtn: document.getElementById("mascotDesignBtn"),
        mascotDismissBtn: document.getElementById("mascotDismissBtn"),
        mascotPicker: document.getElementById("mascotPicker"),
        mascotSummon: document.getElementById("mascotSummon"),
        postCount: document.getElementById("postCount"),
        albumCount: document.getElementById("albumCount"),
        todoCount: document.getElementById("todoCount"),
        sheetCount: document.getElementById("sheetCount"),
        composerText: document.getElementById("composerText"),
        charCount: document.getElementById("charCount"),
        imageInput: document.getElementById("imageInput"),
        previewStrip: document.getElementById("previewStrip"),
        postBtn: document.getElementById("postBtn"),
        feed: document.getElementById("feed"),
        emptyState: document.getElementById("emptyState"),
        postTemplate: document.getElementById("postTemplate"),

        // Tabs + panels
        tabFeed: document.getElementById("tabFeed"),
        tabAlbums: document.getElementById("tabAlbums"),
        tabSheets: document.getElementById("tabSheets"),
        tabPlay: document.getElementById("tabPlay"),
        feedPanel: document.getElementById("feedPanel"),
        albumsPanel: document.getElementById("albumsPanel"),
        todosPanel: document.getElementById("todosPanel"),
        sheetsPanel: document.getElementById("sheetsPanel"),
        playPanel: document.getElementById("playPanel"),
        layout: document.querySelector(".layout"),

        // Play with me (game)
        gameYouScore: document.getElementById("gameYouScore"),
        gameMascotScore: document.getElementById("gameMascotScore"),
        gameRound: document.getElementById("gameRound"),
        gameMascotFace: document.getElementById("gameMascotFace"),
        gameBubble: document.getElementById("gameBubble"),
        gameMascotHand: document.getElementById("gameMascotHand"),
        gameReveal: document.getElementById("gameReveal"),
        gameHand: document.getElementById("gameHand"),
        gameNewBtn: document.getElementById("gameNewBtn"),
        gameResetBtn: document.getElementById("gameResetBtn"),
        gameStats: document.getElementById("gameStats"),

        // To-Do
        newTodoForm: document.getElementById("newTodoForm"),
        newTodoText: document.getElementById("newTodoText"),
        todoList: document.getElementById("todoList"),
        todosEmptyState: document.getElementById("todosEmptyState"),
        todoFooter: document.getElementById("todoFooter"),
        todoRemaining: document.getElementById("todoRemaining"),
        clearCompletedBtn: document.getElementById("clearCompletedBtn"),

        // Albums — list view
        albumListView: document.getElementById("albumListView"),
        newAlbumForm: document.getElementById("newAlbumForm"),
        newAlbumName: document.getElementById("newAlbumName"),
        albumGrid: document.getElementById("albumGrid"),
        albumsEmptyState: document.getElementById("albumsEmptyState"),

        // Albums — detail view
        albumDetailView: document.getElementById("albumDetailView"),
        albumBackBtn: document.getElementById("albumBackBtn"),
        albumTitleInput: document.getElementById("albumTitleInput"),
        albumImageInput: document.getElementById("albumImageInput"),
        albumDeleteBtn: document.getElementById("albumDeleteBtn"),
        albumImages: document.getElementById("albumImages"),
        albumDetailEmptyState: document.getElementById("albumDetailEmptyState"),

        // Sheets — list view
        newSheetForm: document.getElementById("newSheetForm"),
        newSheetName: document.getElementById("newSheetName"),
        sheetGrid: document.getElementById("sheetGrid"),
        sheetsEmptyState: document.getElementById("sheetsEmptyState"),
        importNewCsvInput: document.getElementById("importNewCsvInput"),

        // Sheets — detail view
        sheetListView: document.getElementById("sheetListView"),
        sheetDetailView: document.getElementById("sheetDetailView"),
        sheetBackBtn: document.getElementById("sheetBackBtn"),
        sheetTitleInput: document.getElementById("sheetTitleInput"),
        addColumnBtn: document.getElementById("addColumnBtn"),
        addRowBtn: document.getElementById("addRowBtn"),
        exportCsvBtn: document.getElementById("exportCsvBtn"),
        importCsvInput: document.getElementById("importCsvInput"),
        appendCsvInput: document.getElementById("appendCsvInput"),
        sheetDeleteBtn: document.getElementById("sheetDeleteBtn"),
        sheetTableWrap: document.getElementById("sheetTableWrap"),
        sheetEmptyState: document.getElementById("sheetEmptyState")
    };

    // ---- Helpers ----
    function persist() {
        Store.save(state);
    }

    // A small stable id without relying on Date.now()/random being available everywhere.
    var idCounter = 0;
    function makeId() {
        idCounter += 1;
        return "p" + idCounter + "_" + (new Date().getTime());
    }

    function initial(name) {
        name = (name || "").trim();
        return name ? name.charAt(0).toUpperCase() : "🙂";
    }

    // Fill an avatar element with the custom picture if set, else the name initial.
    // Used for the top-bar avatar and each post's avatar so they stay in sync.
    function applyAvatar(node) {
        node.innerHTML = "";
        if (state.profile.avatar) {
            var img = document.createElement("img");
            img.src = state.profile.avatar;
            img.alt = "profile picture";
            img.className = "avatar-img";
            node.appendChild(img);
            node.classList.add("has-img");
        } else {
            node.textContent = initial(state.profile.name);
            node.classList.remove("has-img");
        }
    }

    // Take any image file, center-crop it to a square, downscale to AVATAR_SIZE,
    // and return a compact JPEG data URL. Keeps avatars tiny in localStorage and
    // sidesteps the upload size limit (huge photos become ~20–40 KB).
    var AVATAR_SIZE = 256;

    // Center-crop + downscale any image (given as a URL/data URL) to a compact
    // square JPEG. Shared by file uploads and "set this picture as my avatar".
    function rasterizeAvatar(srcUrl) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onerror = function () { reject(new Error("Could not load that image.")); };
            img.onload = function () {
                var side = Math.min(img.naturalWidth, img.naturalHeight);
                if (!side) { reject(new Error("That image appears to be empty.")); return; }
                var sx = (img.naturalWidth - side) / 2; // center crop
                var sy = (img.naturalHeight - side) / 2;

                var canvas = document.createElement("canvas");
                canvas.width = AVATAR_SIZE;
                canvas.height = AVATAR_SIZE;
                var ctx = canvas.getContext("2d");
                ctx.fillStyle = "#ffffff"; // flatten any transparency (JPEG has none)
                ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
                ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

                try {
                    resolve(canvas.toDataURL("image/jpeg", 0.85));
                } catch (e) {
                    reject(new Error("Could not process that image."));
                }
            };
            img.src = srcUrl;
        });
    }

    function processAvatar(file) {
        return new Promise(function (resolve, reject) {
            if (!file.type || file.type.indexOf("image/") !== 0) {
                reject(new Error("That file isn't an image."));
                return;
            }
            var reader = new FileReader();
            reader.onerror = function () { reject(reader.error || new Error("Could not read the file.")); };
            reader.onload = function () { rasterizeAvatar(reader.result).then(resolve, reject); };
            reader.readAsDataURL(file);
        });
    }

    // Adopt an existing picture (a feed/album image) as the profile avatar.
    function setAvatarFromPicture(srcUrl) {
        rasterizeAvatar(srcUrl).then(function (dataUrl) {
            var prev = state.profile.avatar;
            state.profile.avatar = dataUrl;
            if (!Store.save(state)) {
                state.profile.avatar = prev; // roll back on quota failure
                alert("Couldn't save the picture — storage may be full.");
                return;
            }
            renderProfile();
            renderFeed(); // refresh post avatars
        }).catch(function (err) {
            alert(err.message);
        });
    }

    // Human-friendly relative time ("just now", "5m", "3h", or a date).
    function relTime(ts) {
        var diff = Date.now() - ts;
        var sec = Math.floor(diff / 1000);
        if (sec < 45) return "just now";
        var min = Math.floor(sec / 60);
        if (min < 60) return min + "m";
        var hr = Math.floor(min / 60);
        if (hr < 24) return hr + "h";
        var day = Math.floor(hr / 24);
        if (day < 7) return day + "d";
        return new Date(ts).toLocaleDateString();
    }

    function escapeText(s) {
        // textContent does the escaping for us; this is just a guard for empties.
        return s == null ? "" : String(s);
    }

    // Local calendar date as "YYYY-MM-DD" — the key the daily reminders reset on.
    function fmtDate(d) {
        var m = String(d.getMonth() + 1);
        var day = String(d.getDate());
        if (m.length < 2) m = "0" + m;
        if (day.length < 2) day = "0" + day;
        return d.getFullYear() + "-" + m + "-" + day;
    }
    function todayStr() { return fmtDate(new Date()); }
    function yesterdayStr() {
        var d = new Date();
        d.setDate(d.getDate() - 1);
        return fmtDate(d);
    }

    // ---- Profile rendering ----
    function renderProfile() {
        el.profileName.value = state.profile.name;
        el.statusInput.value = state.profile.status;
        applyAvatar(el.avatar);
        el.avatarRemove.hidden = !state.profile.avatar;
        setAvailabilityClass(state.profile.availability);
    }

    function setAvailabilityClass(value) {
        el.statusDot.className = "status-dot"; // reset
        if (value === "away") el.statusDot.classList.add("away");
        else if (value === "busy") el.statusDot.classList.add("busy");
        else if (value === "invis") el.statusDot.classList.add("invis");
        el.statusDot.title = "Availability: " + value + " (click to change)";
    }

    // ---- Composer ----
    function updateCharCount() {
        el.charCount.textContent = String(el.composerText.value.length);
    }

    function refreshPostButton() {
        var hasText = el.composerText.value.trim().length > 0;
        el.postBtn.disabled = !hasText && pendingImages.length === 0;
    }

    function renderPreviews() {
        el.previewStrip.innerHTML = "";
        if (pendingImages.length === 0) {
            el.previewStrip.hidden = true;
            return;
        }
        el.previewStrip.hidden = false;
        pendingImages.forEach(function (dataUrl, idx) {
            var thumb = document.createElement("div");
            thumb.className = "preview-thumb";

            var img = document.createElement("img");
            img.src = dataUrl;
            img.alt = "pending image " + (idx + 1);

            var remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "✕";
            remove.title = "Remove";
            remove.addEventListener("click", function () {
                pendingImages.splice(idx, 1);
                renderPreviews();
                refreshPostButton();
            });

            thumb.appendChild(img);
            thumb.appendChild(remove);
            el.previewStrip.appendChild(thumb);
        });
    }

    function readImageFile(file) {
        return new Promise(function (resolve, reject) {
            if (!file.type || file.type.indexOf("image/") !== 0) {
                reject(new Error("Not an image: " + file.name));
                return;
            }
            if (file.size > MAX_IMAGE_BYTES) {
                reject(new Error(file.name + " is larger than 4 MB."));
                return;
            }
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(reader.error); };
            reader.readAsDataURL(file);
        });
    }

    function handleFiles(fileList) {
        var files = Array.prototype.slice.call(fileList);
        files.forEach(function (file) {
            readImageFile(file).then(function (dataUrl) {
                pendingImages.push(dataUrl);
                renderPreviews();
                refreshPostButton();
            }).catch(function (err) {
                alert(err.message);
            });
        });
    }

    function submitPost() {
        var text = el.composerText.value.trim();
        if (!text && pendingImages.length === 0) return;

        var post = {
            id: makeId(),
            text: text,
            images: pendingImages.slice(),
            likes: 0,
            liked: false,
            createdAt: Date.now()
        };

        state.posts.unshift(post); // newest first

        // Feed pictures are also filed into the default album automatically.
        var albumAdd = post.images.length ? addImagesToDefaultAlbum(post.images) : null;

        if (!Store.save(state)) {
            // Roll back the in-memory adds if persistence failed (quota).
            state.posts.shift();
            if (albumAdd) undoDefaultAlbumAdd(albumAdd);
            alert("Couldn't save — storage may be full. Try smaller or fewer images.");
            return;
        }

        // Reset composer.
        el.composerText.value = "";
        pendingImages = [];
        renderPreviews();
        updateCharCount();
        refreshPostButton();
        renderFeed();
        renderAlbumStats();
        if (!el.albumsPanel.hidden) renderAlbums(); // reflect new album/photos if visible
    }

    // ---- Default album (auto-collects feed pictures) ----
    var DEFAULT_ALBUM_NAME = "Feed Photos";

    // The default album is identified purely by its name. So if the user renames
    // or deletes "Feed Photos", it's no longer the default and the next feed
    // picture simply creates a fresh one.
    function getDefaultAlbum() {
        for (var i = 0; i < state.albums.length; i++) {
            if (state.albums[i].name === DEFAULT_ALBUM_NAME) return state.albums[i];
        }
        return null;
    }

    function addImagesToDefaultAlbum(images) {
        var album = getDefaultAlbum();
        var createdNew = false;
        if (!album) {
            album = { id: makeId(), name: DEFAULT_ALBUM_NAME, images: [], createdAt: Date.now() };
            state.albums.unshift(album);
            createdNew = true;
        }
        for (var i = 0; i < images.length; i++) album.images.push(images[i]);
        return { albumId: album.id, createdNew: createdNew, count: images.length };
    }

    function undoDefaultAlbumAdd(info) {
        for (var i = 0; i < state.albums.length; i++) {
            if (state.albums[i].id === info.albumId) {
                if (info.createdNew) state.albums.splice(i, 1);
                else state.albums[i].images.splice(state.albums[i].images.length - info.count, info.count);
                return;
            }
        }
    }

    // ---- Feed ----
    function renderFeed() {
        el.feed.innerHTML = "";
        el.postCount.textContent = String(state.posts.length);
        el.emptyState.hidden = state.posts.length > 0;

        state.posts.forEach(function (post) {
            el.feed.appendChild(buildPostNode(post));
        });
    }

    function buildPostNode(post) {
        var node = el.postTemplate.content.cloneNode(true);
        var author = state.profile.name.trim() || "You";

        applyAvatar(node.querySelector(".post-avatar"));
        node.querySelector(".post-author").textContent = author;

        var timeEl = node.querySelector(".post-time");
        timeEl.textContent = relTime(post.createdAt);
        timeEl.setAttribute("datetime", new Date(post.createdAt).toISOString());

        var textEl = node.querySelector(".post-text");
        if (post.text) {
            textEl.textContent = escapeText(post.text);
        } else {
            textEl.remove();
        }

        var imagesWrap = node.querySelector(".post-images");
        if (post.images && post.images.length) {
            var n = post.images.length;
            imagesWrap.classList.add(n === 1 ? "count-1" : n === 2 ? "count-2" : "count-3plus");
            post.images.forEach(function (src, i) {
                var img = document.createElement("img");
                img.src = src;
                img.alt = "post image " + (i + 1);
                img.addEventListener("click", function () { openLightbox(src); });
                imagesWrap.appendChild(img);
            });
        } else {
            imagesWrap.remove();
        }

        // Like button
        var likeBtn = node.querySelector(".like-btn");
        var likeCount = node.querySelector(".like-count");
        likeCount.textContent = String(post.likes);
        if (post.liked) likeBtn.classList.add("liked");
        likeBtn.firstChild.textContent = post.liked ? "❤️ " : "🤍 ";
        likeBtn.addEventListener("click", function () { toggleLike(post.id); });

        // Delete button
        node.querySelector(".post-delete").addEventListener("click", function () {
            deletePost(post.id);
        });

        return node;
    }

    function toggleLike(id) {
        var post = findPost(id);
        if (!post) return;
        post.liked = !post.liked;
        post.likes += post.liked ? 1 : -1;
        if (post.likes < 0) post.likes = 0;
        persist();
        renderFeed();
    }

    function deletePost(id) {
        if (!confirm("Delete this post?")) return;
        state.posts = state.posts.filter(function (p) { return p.id !== id; });
        persist();
        renderFeed();
    }

    function findPost(id) {
        for (var i = 0; i < state.posts.length; i++) {
            if (state.posts[i].id === id) return state.posts[i];
        }
        return null;
    }

    // ---- Lightbox ----
    function openLightbox(src) {
        var box = document.createElement("div");
        box.className = "lightbox";

        var img = document.createElement("img");
        img.src = src;
        box.appendChild(img);

        // Action bar (doesn't close the lightbox when clicked).
        var bar = document.createElement("div");
        bar.className = "lightbox-bar";
        var setBtn = document.createElement("button");
        setBtn.type = "button";
        setBtn.className = "lightbox-btn";
        setBtn.textContent = "👤 Set as profile picture";
        setBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            setAvatarFromPicture(src);
            box.remove();
        });
        bar.appendChild(setBtn);
        box.appendChild(bar);

        box.addEventListener("click", function () { box.remove(); });
        document.addEventListener("keydown", function esc(e) {
            if (e.key === "Escape") { box.remove(); document.removeEventListener("keydown", esc); }
        });
        document.body.appendChild(box);
    }

    // ---- Tabs ----
    function switchTab(tab) {
        var tabs = {
            feed:   { btn: el.tabFeed,   panel: el.feedPanel },
            albums: { btn: el.tabAlbums, panel: el.albumsPanel },
            sheets: { btn: el.tabSheets, panel: el.sheetsPanel },
            play:   { btn: el.tabPlay,   panel: el.playPanel }
        };
        Object.keys(tabs).forEach(function (key) {
            var active = key === tab;
            tabs[key].btn.classList.toggle("is-active", active);
            tabs[key].panel.hidden = !active;
        });
        // The duel (7 cards) and the spreadsheets both want room — give them the
        // full width by collapsing the side columns on those tabs.
        el.layout.classList.toggle("wide-mode", tab === "play" || tab === "sheets");
        if (tab === "albums") renderAlbums();
        if (tab === "sheets") renderSheets();
        if (tab === "play") renderGame();
    }

    // ---- Albums ----
    function findAlbum(id) {
        for (var i = 0; i < state.albums.length; i++) {
            if (state.albums[i].id === id) return state.albums[i];
        }
        return null;
    }

    function createAlbum(name) {
        name = (name || "").trim();
        if (!name) return;
        state.albums.unshift({
            id: makeId(),
            name: name,
            images: [],
            createdAt: Date.now()
        });
        persist();
        renderAlbums();
    }

    function deleteAlbum(id) {
        var album = findAlbum(id);
        if (!album) return;
        if (!confirm('Delete the album "' + album.name + '" and its ' +
                     album.images.length + ' picture(s)?')) return;
        state.albums = state.albums.filter(function (a) { return a.id !== id; });
        persist();
        openAlbumId = null;
        showAlbumList();
        renderAlbums();
    }

    function renameAlbum(id, name) {
        var album = findAlbum(id);
        if (!album) return;
        name = (name || "").trim();
        if (!name) return; // ignore empty rename; keep old name
        album.name = name;
        persist();
    }

    // Read each chosen file and append it to the album, saving as we go.
    function addImagesToAlbum(id, fileList) {
        var album = findAlbum(id);
        if (!album) return;
        var files = Array.prototype.slice.call(fileList);
        files.forEach(function (file) {
            readImageFile(file).then(function (dataUrl) {
                album.images.push(dataUrl);
                if (!Store.save(state)) {
                    album.images.pop();
                    alert("Couldn't save — storage may be full. Try smaller or fewer images.");
                    return;
                }
                if (openAlbumId === id) renderAlbumDetail();
                renderAlbumStats();
            }).catch(function (err) {
                alert(err.message);
            });
        });
    }

    function removeImageFromAlbum(id, index) {
        var album = findAlbum(id);
        if (!album) return;
        album.images.splice(index, 1);
        persist();
        renderAlbumDetail();
    }

    function renderAlbumStats() {
        el.albumCount.textContent = String(state.albums.length);
    }

    // List view: a grid of album cards.
    function renderAlbums() {
        renderAlbumStats();
        el.albumGrid.innerHTML = "";
        el.albumsEmptyState.hidden = state.albums.length > 0;

        state.albums.forEach(function (album) {
            var card = document.createElement("button");
            card.type = "button";
            card.className = "album-card";
            card.title = "Open album";

            var cover = document.createElement("div");
            cover.className = "album-cover";
            if (album.images.length) {
                var img = document.createElement("img");
                img.src = album.images[0];
                img.alt = album.name;
                cover.appendChild(img);
            } else {
                cover.textContent = "📁";
                cover.classList.add("empty");
            }

            var name = document.createElement("div");
            name.className = "album-card-name";
            name.textContent = album.name;

            var count = document.createElement("div");
            count.className = "album-card-count";
            count.textContent = album.images.length +
                (album.images.length === 1 ? " picture" : " pictures");

            card.appendChild(cover);
            card.appendChild(name);
            card.appendChild(count);
            card.addEventListener("click", function () { openAlbum(album.id); });
            el.albumGrid.appendChild(card);
        });
    }

    function showAlbumList() {
        el.albumDetailView.hidden = true;
        el.albumListView.hidden = false;
    }

    function openAlbum(id) {
        openAlbumId = id;
        el.albumListView.hidden = true;
        el.albumDetailView.hidden = false;
        renderAlbumDetail();
    }

    // Detail view: title, add/delete controls, and the album's pictures.
    function renderAlbumDetail() {
        var album = findAlbum(openAlbumId);
        if (!album) { showAlbumList(); return; }

        el.albumTitleInput.value = album.name;
        el.albumImages.innerHTML = "";
        el.albumDetailEmptyState.hidden = album.images.length > 0;

        album.images.forEach(function (src, index) {
            var cell = document.createElement("div");
            cell.className = "album-thumb";

            var img = document.createElement("img");
            img.src = src;
            img.alt = album.name + " picture " + (index + 1);
            img.addEventListener("click", function () { openLightbox(src); });

            var move = document.createElement("button");
            move.type = "button";
            move.className = "album-thumb-move";
            move.title = "Move to another album";
            move.textContent = "⇄";
            move.addEventListener("click", function (e) {
                e.stopPropagation();
                openMoveMenu(cell, album.id, index);
            });

            var setAv = document.createElement("button");
            setAv.type = "button";
            setAv.className = "album-thumb-avatar";
            setAv.title = "Use as profile picture";
            setAv.textContent = "👤";
            setAv.addEventListener("click", function (e) {
                e.stopPropagation();
                setAvatarFromPicture(src);
            });

            var del = document.createElement("button");
            del.type = "button";
            del.className = "album-thumb-del";
            del.title = "Remove picture";
            del.textContent = "✕";
            del.addEventListener("click", function () {
                removeImageFromAlbum(album.id, index);
            });

            cell.appendChild(img);
            cell.appendChild(move);
            cell.appendChild(setAv);
            cell.appendChild(del);
            el.albumImages.appendChild(cell);
        });
    }

    // Move a picture from one album to another.
    function moveImageToAlbum(fromId, index, toId) {
        if (fromId === toId) { closeMoveMenus(); return; }
        var from = findAlbum(fromId), to = findAlbum(toId);
        if (!from || !to) return;
        var img = from.images.splice(index, 1)[0];
        if (img == null) return;
        to.images.push(img);
        persist();
        closeMoveMenus();
        renderAlbumDetail();
        renderAlbumStats();
    }

    function closeMoveMenus() {
        var menus = document.querySelectorAll(".album-move-menu");
        Array.prototype.forEach.call(menus, function (m) { m.remove(); });
    }

    // Small popover listing the other albums (plus "new album") to move into.
    function openMoveMenu(anchorCell, fromId, index) {
        closeMoveMenus();
        var menu = document.createElement("div");
        menu.className = "album-move-menu";

        var others = state.albums.filter(function (a) { return a.id !== fromId; });
        if (!others.length) {
            var none = document.createElement("div");
            none.className = "album-move-empty";
            none.textContent = "No other albums yet";
            menu.appendChild(none);
        } else {
            others.forEach(function (a) {
                var opt = document.createElement("button");
                opt.type = "button";
                opt.className = "album-move-opt";
                opt.textContent = a.name + " (" + a.images.length + ")";
                opt.addEventListener("click", function (e) {
                    e.stopPropagation();
                    moveImageToAlbum(fromId, index, a.id);
                });
                menu.appendChild(opt);
            });
        }

        var newOpt = document.createElement("button");
        newOpt.type = "button";
        newOpt.className = "album-move-opt album-move-new";
        newOpt.textContent = "＋ New album…";
        newOpt.addEventListener("click", function (e) {
            e.stopPropagation();
            var name = prompt("New album name:");
            if (name == null) return;
            name = name.trim();
            if (!name) return;
            var album = { id: makeId(), name: name, images: [], createdAt: Date.now() };
            state.albums.unshift(album);
            moveImageToAlbum(fromId, index, album.id);
        });
        menu.appendChild(newOpt);

        anchorCell.appendChild(menu);
    }

    // ---- To-Do ----
    function findTodo(id) {
        for (var i = 0; i < state.todos.length; i++) {
            if (state.todos[i].id === id) return state.todos[i];
        }
        return null;
    }

    function activeTodoCount() {
        return state.todos.filter(function (t) { return !t.done; }).length;
    }

    function addTodo(text) {
        text = (text || "").trim();
        if (!text) return;
        state.todos.push({ // oldest first
            id: makeId(),
            text: text,
            done: false,
            createdAt: Date.now()
        });
        persist();
        renderTodos();
    }

    function toggleTodo(id) {
        var todo = findTodo(id);
        if (!todo) return;
        todo.done = !todo.done;
        persist();
        renderTodos();
    }

    function editTodo(id, text) {
        var todo = findTodo(id);
        if (!todo) return;
        text = (text || "").trim();
        if (!text) { deleteTodo(id, true); return; } // emptied -> remove
        todo.text = text;
        persist();
    }

    function deleteTodo(id, skipConfirm) {
        if (!skipConfirm && !confirm("Delete this task?")) return;
        state.todos = state.todos.filter(function (t) { return t.id !== id; });
        persist();
        renderTodos();
    }

    function clearCompleted() {
        var done = state.todos.filter(function (t) { return t.done; }).length;
        if (!done) return;
        if (!confirm("Remove " + done + " completed task(s)?")) return;
        state.todos = state.todos.filter(function (t) { return !t.done; });
        persist();
        renderTodos();
    }

    function setTodoFilter(filter) {
        todoFilter = filter;
        var btns = el.todosPanel.querySelectorAll(".todo-filter");
        Array.prototype.forEach.call(btns, function (b) {
            b.classList.toggle("is-active", b.getAttribute("data-filter") === filter);
        });
        renderTodos();
    }

    function renderTodoStats() {
        el.todoCount.textContent = String(activeTodoCount());
    }

    function renderTodos() {
        renderTodoStats();

        var visible = state.todos.filter(function (t) {
            if (todoFilter === "active") return !t.done;
            if (todoFilter === "done") return t.done;
            return true;
        });

        el.todoList.innerHTML = "";
        el.todosEmptyState.hidden = visible.length > 0;
        el.todoFooter.hidden = state.todos.length === 0;

        var remaining = activeTodoCount();
        el.todoRemaining.textContent = remaining + (remaining === 1 ? " item left" : " items left");

        visible.forEach(function (todo) {
            var li = document.createElement("li");
            li.className = "todo-item" + (todo.done ? " done" : "");

            var check = document.createElement("input");
            check.type = "checkbox";
            check.className = "todo-check";
            check.checked = todo.done;
            check.addEventListener("change", function () { toggleTodo(todo.id); });

            // Editable, wrapping text (contenteditable so long tasks wrap to
            // multiple lines instead of being clipped). Saves on blur.
            var text = document.createElement("div");
            text.className = "todo-text";
            text.contentEditable = "true";
            text.spellcheck = false;
            text.textContent = todo.text;
            text.addEventListener("blur", function () { editTodo(todo.id, text.textContent); });
            text.addEventListener("keydown", function (e) {
                if (e.key === "Enter") { e.preventDefault(); text.blur(); }
            });

            var del = document.createElement("button");
            del.type = "button";
            del.className = "todo-del";
            del.title = "Delete task";
            del.textContent = "✕";
            del.addEventListener("click", function () { deleteTodo(todo.id); });

            li.appendChild(check);
            li.appendChild(text);
            li.appendChild(del);
            el.todoList.appendChild(li);
        });
    }

    // ---- Sheets (mini spreadsheets) ----
    function findSheet(id) {
        for (var i = 0; i < state.sheets.length; i++) {
            if (state.sheets[i].id === id) return state.sheets[i];
        }
        return null;
    }

    // Pull a number out of a cell, tolerating "$", "kg", thousands commas, etc.
    // Returns null when the cell holds no number.
    function parseNum(value) {
        var cleaned = String(value == null ? "" : value).replace(/[^0-9.\-]/g, "");
        if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
        var n = parseFloat(cleaned);
        return isNaN(n) ? null : n;
    }

    function formatSum(n) {
        if (Number.isInteger(n)) return String(n);
        return n.toFixed(2);
    }

    function createSheet(name) {
        name = (name || "").trim();
        if (!name) return;
        state.sheets.unshift({
            id: makeId(),
            name: name,
            columns: ["Column 1", "Column 2"],
            rows: [["", ""]],
            createdAt: Date.now()
        });
        persist();
        renderSheets();
    }

    function deleteSheet(id) {
        var sheet = findSheet(id);
        if (!sheet) return;
        if (!confirm('Delete the spreadsheet "' + sheet.name + '"?')) return;
        state.sheets = state.sheets.filter(function (s) { return s.id !== id; });
        persist();
        openSheetId = null;
        showSheetList();
        renderSheets();
    }

    function renameSheet(id, name) {
        var sheet = findSheet(id);
        if (!sheet) return;
        name = (name || "").trim();
        if (!name) return;
        sheet.name = name;
        persist();
    }

    function addColumn(id) {
        var sheet = findSheet(id);
        if (!sheet) return;
        sheet.columns.push("Column " + (sheet.columns.length + 1));
        sheet.rows.forEach(function (row) { row.push(""); });
        persist();
        renderSheetDetail();
    }

    function deleteColumn(id, colIndex) {
        var sheet = findSheet(id);
        if (!sheet) return;
        if (!confirm('Delete column "' + sheet.columns[colIndex] + '"?')) return;
        sheet.columns.splice(colIndex, 1);
        sheet.rows.forEach(function (row) { row.splice(colIndex, 1); });
        persist();
        renderSheetDetail();
    }

    function renameColumn(id, colIndex, name) {
        var sheet = findSheet(id);
        if (!sheet) return;
        sheet.columns[colIndex] = (name || "").trim() || ("Column " + (colIndex + 1));
        persist();
    }

    function addRow(id) {
        var sheet = findSheet(id);
        if (!sheet) return;
        var blank = sheet.columns.map(function () { return ""; });
        sheet.rows.push(blank);
        persist();
        renderSheetDetail();
    }

    function deleteRow(id, rowIndex) {
        var sheet = findSheet(id);
        if (!sheet) return;
        sheet.rows.splice(rowIndex, 1);
        persist();
        renderSheetDetail();
    }

    // Update one cell without re-rendering, so tabbing between cells is smooth.
    function setCell(id, rowIndex, colIndex, value) {
        var sheet = findSheet(id);
        if (!sheet || !sheet.rows[rowIndex]) return;
        sheet.rows[rowIndex][colIndex] = value;
        persist();
        updateTotalsRow(sheet);
    }

    function columnSums(sheet) {
        return sheet.columns.map(function (_, c) {
            var any = false, total = 0;
            sheet.rows.forEach(function (row) {
                var n = parseNum(row[c]);
                if (n !== null) { any = true; total += n; }
            });
            return any ? formatSum(total) : "";
        });
    }

    function renderSheetStats() {
        el.sheetCount.textContent = String(state.sheets.length);
    }

    // List view: a grid of spreadsheet cards.
    function renderSheets() {
        renderSheetStats();
        el.sheetGrid.innerHTML = "";
        el.sheetsEmptyState.hidden = state.sheets.length > 0;

        state.sheets.forEach(function (sheet) {
            var card = document.createElement("button");
            card.type = "button";
            card.className = "sheet-card";
            card.title = "Open spreadsheet";

            var icon = document.createElement("div");
            icon.className = "sheet-card-icon";
            icon.textContent = "📊";

            var name = document.createElement("div");
            name.className = "sheet-card-name";
            name.textContent = sheet.name;

            var dims = document.createElement("div");
            dims.className = "sheet-card-dims";
            dims.textContent = sheet.rows.length + " × " + sheet.columns.length +
                " (rows × cols)";

            card.appendChild(icon);
            card.appendChild(name);
            card.appendChild(dims);
            card.addEventListener("click", function () { openSheet(sheet.id); });
            el.sheetGrid.appendChild(card);
        });
    }

    function showSheetList() {
        el.sheetDetailView.hidden = true;
        el.sheetListView.hidden = false;
    }

    function openSheet(id) {
        openSheetId = id;
        el.sheetListView.hidden = true;
        el.sheetDetailView.hidden = false;
        renderSheetDetail();
    }

    // Detail view: build the editable table from scratch.
    function renderSheetDetail() {
        var sheet = findSheet(openSheetId);
        if (!sheet) { showSheetList(); return; }

        el.sheetTitleInput.value = sheet.name;
        el.sheetTableWrap.innerHTML = "";

        var hasColumns = sheet.columns.length > 0;
        el.sheetEmptyState.hidden = hasColumns;
        el.addRowBtn.disabled = !hasColumns;
        if (!hasColumns) return;

        var table = document.createElement("table");
        table.className = "sheet-table";

        // --- Header: a rename input + delete button per column ---
        var thead = document.createElement("thead");
        var headRow = document.createElement("tr");
        headRow.appendChild(document.createElement("th")); // corner cell (row controls)

        sheet.columns.forEach(function (colName, c) {
            var th = document.createElement("th");

            var nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.className = "col-name";
            nameInput.value = colName;
            nameInput.maxLength = 40;
            nameInput.addEventListener("change", function () {
                renameColumn(sheet.id, c, nameInput.value);
            });

            var delCol = document.createElement("button");
            delCol.type = "button";
            delCol.className = "col-del";
            delCol.title = "Delete column";
            delCol.textContent = "✕";
            delCol.addEventListener("click", function () { deleteColumn(sheet.id, c); });

            th.appendChild(nameInput);
            th.appendChild(delCol);
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        // --- Body: one editable input per cell ---
        var tbody = document.createElement("tbody");
        sheet.rows.forEach(function (row, r) {
            var tr = document.createElement("tr");

            var ctrlCell = document.createElement("td");
            ctrlCell.className = "row-ctrl";
            var delRow = document.createElement("button");
            delRow.type = "button";
            delRow.className = "row-del";
            delRow.title = "Delete row";
            delRow.textContent = "✕";
            delRow.addEventListener("click", function () { deleteRow(sheet.id, r); });
            ctrlCell.appendChild(delRow);
            tr.appendChild(ctrlCell);

            sheet.columns.forEach(function (_, c) {
                var td = document.createElement("td");
                var cell = document.createElement("input");
                cell.type = "text";
                cell.className = "cell";
                cell.value = row[c] != null ? row[c] : "";
                cell.addEventListener("change", function () {
                    setCell(sheet.id, r, c, cell.value);
                });
                td.appendChild(cell);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        // --- Footer: per-column totals (blank when the column has no numbers) ---
        var tfoot = document.createElement("tfoot");
        table.appendChild(tfoot);

        el.sheetTableWrap.appendChild(table);
        updateTotalsRow(sheet);
    }

    // Rewrite just the totals row, leaving editable inputs (and focus) untouched.
    function updateTotalsRow(sheet) {
        var tfoot = el.sheetTableWrap.querySelector("tfoot");
        if (!tfoot) return;
        tfoot.innerHTML = "";

        var sums = columnSums(sheet);
        var tr = document.createElement("tr");
        tr.className = "totals-row";

        var label = document.createElement("td");
        label.className = "totals-label";
        label.textContent = "Σ";
        tr.appendChild(label);

        sums.forEach(function (sum) {
            var td = document.createElement("td");
            td.className = "totals-cell";
            td.textContent = sum;
            tr.appendChild(td);
        });
        tfoot.appendChild(tr);
    }

    // ---- Sheets: CSV export / import ----

    // Quote a field only when it contains a comma, quote, or newline (RFC 4180).
    function csvEscape(value) {
        var v = value == null ? "" : String(value);
        if (/[",\r\n]/.test(v)) {
            return '"' + v.replace(/"/g, '""') + '"';
        }
        return v;
    }

    function sheetToCsv(sheet) {
        var lines = [sheet.columns.map(csvEscape).join(",")];
        sheet.rows.forEach(function (row) {
            lines.push(row.map(csvEscape).join(","));
        });
        return lines.join("\r\n");
    }

    // Parse CSV text into an array of string arrays. Handles quoted fields,
    // embedded commas/newlines, doubled quotes, and CRLF or LF line endings.
    function csvParse(text) {
        var rows = [], row = [], field = "", inQuotes = false, i = 0;
        while (i < text.length) {
            var ch = text.charAt(i);
            if (inQuotes) {
                if (ch === '"') {
                    if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
                    inQuotes = false; i++; continue;
                }
                field += ch; i++; continue;
            }
            if (ch === '"') { inQuotes = true; i++; continue; }
            if (ch === ",") { row.push(field); field = ""; i++; continue; }
            if (ch === "\r") {
                if (text.charAt(i + 1) === "\n") i++;
                row.push(field); field = ""; rows.push(row); row = []; i++; continue;
            }
            if (ch === "\n") {
                row.push(field); field = ""; rows.push(row); row = []; i++; continue;
            }
            field += ch; i++;
        }
        row.push(field);
        rows.push(row);
        // Drop a trailing blank line (file ended with a newline).
        if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
            rows.pop();
        }
        return rows;
    }

    function normalizeRow(row, width) {
        var r = row.slice(0, width);
        while (r.length < width) r.push("");
        return r;
    }

    // Build a {columns, rows} grid from parsed CSV (first line = headers).
    function gridFromCsv(text) {
        var parsed = csvParse(text);
        if (!parsed.length) return null;
        var columns = parsed[0].map(function (h, i) {
            return String(h).trim() || ("Column " + (i + 1));
        });
        if (!columns.length) return null;
        var rows = parsed.slice(1).map(function (r) { return normalizeRow(r, columns.length); });
        return { columns: columns, rows: rows };
    }

    // Data rows from a CSV (header row skipped), each fitted to `width` columns.
    // Used by append-on-import so the existing sheet's columns are kept.
    function rowsFromCsvBody(text, width) {
        var parsed = csvParse(text);
        if (parsed.length < 2) return []; // header-only or empty -> no data
        return parsed.slice(1).map(function (r) { return normalizeRow(r, width); });
    }

    function sanitizeFilename(name) {
        return (name || "spreadsheet").replace(/[\\/:*?"<>|]+/g, "_").trim() || "spreadsheet";
    }

    function downloadCsv(filename, csv) {
        // Prepend a BOM so Excel reads UTF-8 correctly. Blob + object URL works on file://.
        var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    }

    function exportSheet(id) {
        var sheet = findSheet(id);
        if (!sheet) return;
        downloadCsv(sanitizeFilename(sheet.name) + ".csv", sheetToCsv(sheet));
    }

    function readTextFile(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(reader.error); };
            reader.readAsText(file);
        });
    }

    // Replace the open sheet's contents with an imported CSV.
    function importCsvIntoSheet(id, file) {
        var sheet = findSheet(id);
        if (!sheet) return;
        var hasData = sheet.rows.some(function (r) {
            return r.some(function (c) { return String(c).trim() !== ""; });
        });
        if (hasData && !confirm('Replace the contents of "' + sheet.name + '" with this CSV?')) return;

        readTextFile(file).then(function (text) {
            var grid = gridFromCsv(text);
            if (!grid) { alert("That CSV looks empty — nothing to import."); return; }
            sheet.columns = grid.columns;
            sheet.rows = grid.rows;
            if (!Store.save(state)) {
                alert("Couldn't save — storage may be full.");
                return;
            }
            renderSheetDetail();
        }).catch(function (err) {
            alert("Could not read the file: " + (err && err.message ? err.message : err));
        });
    }

    // Append a CSV's data rows to the end of the open sheet (columns unchanged).
    function appendCsvToSheet(id, file) {
        var sheet = findSheet(id);
        if (!sheet) return;
        if (!sheet.columns.length) {
            alert("Add a column first — there's nowhere to append rows yet.");
            return;
        }
        readTextFile(file).then(function (text) {
            var newRows = rowsFromCsvBody(text, sheet.columns.length);
            if (!newRows.length) {
                alert("No data rows to append (the CSV had only a header row, or was empty).");
                return;
            }
            sheet.rows = sheet.rows.concat(newRows);
            if (!Store.save(state)) {
                sheet.rows = sheet.rows.slice(0, sheet.rows.length - newRows.length); // roll back
                alert("Couldn't save — storage may be full.");
                return;
            }
            renderSheetDetail();
        }).catch(function (err) {
            alert("Could not read the file: " + (err && err.message ? err.message : err));
        });
    }

    // Create a brand-new sheet from a CSV file (named after the file).
    function importCsvAsNewSheet(file) {
        readTextFile(file).then(function (text) {
            var grid = gridFromCsv(text);
            if (!grid) { alert("That CSV looks empty — nothing to import."); return; }
            var name = file.name.replace(/\.csv$/i, "").trim() || "Imported sheet";
            state.sheets.unshift({
                id: makeId(),
                name: name,
                columns: grid.columns,
                rows: grid.rows,
                createdAt: Date.now()
            });
            if (!Store.save(state)) {
                state.sheets.shift();
                alert("Couldn't save — storage may be full.");
                return;
            }
            renderSheets();
        }).catch(function (err) {
            alert("Could not read the file: " + (err && err.message ? err.message : err));
        });
    }

    // ---- Daily reminders ----
    function findReminder(id) {
        var items = state.reminders.items;
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id) return items[i];
        }
        return null;
    }

    // If the day rolled over since the checks were last saved, clear them.
    // Returns true when something changed (so callers can persist).
    function rolloverReminders() {
        var today = todayStr();
        if (state.reminders.checkedDate !== today) {
            state.reminders.checkedDate = today;
            state.reminders.checked = {};
            return true;
        }
        return false;
    }

    function addReminder(text) {
        text = (text || "").trim();
        if (!text) return;
        state.reminders.items.push({ id: makeId(), text: text });
        persist();
        renderReminders();
    }

    function editReminder(id, text) {
        var item = findReminder(id);
        if (!item) return;
        text = (text || "").trim();
        if (!text) { deleteReminder(id); return; } // emptied -> remove
        item.text = text;
        persist();
    }

    function deleteReminder(id) {
        state.reminders.items = state.reminders.items.filter(function (r) { return r.id !== id; });
        delete state.reminders.checked[id];
        persist();
        renderReminders();
    }

    function toggleReminder(id) {
        if (state.reminders.checked[id]) {
            delete state.reminders.checked[id];
        } else {
            state.reminders.checked[id] = true;
        }
        creditStreakIfComplete();
        persist();
        renderReminders();
    }

    function uncheckedReminders() {
        return state.reminders.items.filter(function (it) {
            return !state.reminders.checked[it.id];
        });
    }

    function allRemindersDone() {
        return state.reminders.items.length > 0 && uncheckedReminders().length === 0;
    }

    // Bump the streak the first time every reminder is completed on a given day.
    function creditStreakIfComplete() {
        if (!allRemindersDone()) return;
        var today = todayStr();
        if (state.reminders.streakDate === today) return; // already credited today
        if (state.reminders.streakDate === yesterdayStr()) {
            state.reminders.streak = (state.reminders.streak || 0) + 1;
        } else {
            state.reminders.streak = 1; // start fresh
        }
        state.reminders.streakDate = today;
    }

    // The streak only "counts" if it was credited today or yesterday; a fully
    // missed day breaks it (shown as 0 until the user completes a day again).
    function effectiveStreak() {
        var sd = state.reminders.streakDate;
        if (sd === todayStr() || sd === yesterdayStr()) return state.reminders.streak || 0;
        return 0;
    }

    function renderReminders() {
        if (rolloverReminders()) persist(); // fresh day -> wipe yesterday's checks

        // Friendly date label, e.g. "Sun, Jun 1".
        var now = new Date();
        el.remindersDate.textContent = now.toLocaleDateString(undefined, {
            weekday: "short", month: "short", day: "numeric"
        });

        el.reminderList.innerHTML = "";
        var items = state.reminders.items;
        el.remindersEmptyState.hidden = items.length > 0;

        var doneCount = 0;
        items.forEach(function (item) {
            var done = !!state.reminders.checked[item.id];
            if (done) doneCount++;

            var li = document.createElement("li");
            li.className = "reminder-item" + (done ? " done" : "");

            var check = document.createElement("input");
            check.type = "checkbox";
            check.className = "reminder-check";
            check.checked = done;
            check.addEventListener("change", function () { toggleReminder(item.id); });

            var text = document.createElement("input");
            text.type = "text";
            text.className = "reminder-text";
            text.value = item.text;
            text.maxLength = 80;
            text.addEventListener("change", function () { editReminder(item.id, text.value); });
            text.addEventListener("keydown", function (e) { if (e.key === "Enter") text.blur(); });

            var del = document.createElement("button");
            del.type = "button";
            del.className = "reminder-del";
            del.title = "Remove reminder";
            del.textContent = "✕";
            del.addEventListener("click", function () { deleteReminder(item.id); });

            li.appendChild(check);
            li.appendChild(text);
            li.appendChild(del);
            el.reminderList.appendChild(li);
        });

        var streak = effectiveStreak();
        var progress = doneCount + " of " + items.length + " done today";
        el.reminderProgress.textContent = streak > 0 ? (progress + " · 🔥 " + streak + "-day streak") : progress;

        updateMascotLine(); // keep the mascot in sync with the latest state
    }

    // ---- Chibi mascot ----
    var QUOTES = [
        "“The secret of getting ahead is getting started.” ✨",
        "“Little by little, one travels far.” 🌱",
        "“You don't have to be great to start, but you have to start to be great.”",
        "“A year from now you'll wish you had started today.”",
        "“Progress, not perfection.” 💪",
        "“Do something today that your future self will thank you for.”",
        "“Small steps every day add up to big results.”",
        "“Be kind to yourself — you're doing better than you think.” 💜",
        "“The best time to plant a tree was 20 years ago. The second best is now.”",
        "“Discipline is choosing what you want most over what you want now.”"
    ];

    var lastMascotLine = "";

    function lower1(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
    function randOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // Assemble a pool of context-aware lines, then pick one.
    function buildMascotLines() {
        var lines = [];

        // Streak
        var streak = effectiveStreak();
        if (streak >= 2) lines.push("🔥 " + streak + "-day reminder streak! You're on a roll — keep it going!");
        else if (streak === 1) lines.push("That's a 1-day streak going. Come back tomorrow to build it! 🔥");

        // Reminders: all done, or nudges about missed ones
        var missed = uncheckedReminders();
        if (state.reminders.items.length && missed.length === 0) {
            lines.push("You've ticked off every daily reminder. Amazing work! 🎉");
        }
        missed.forEach(function (r) {
            lines.push("Don't forget to " + lower1(r.text) + " today!");
        });
        if (missed.length) {
            var m = randOf(missed);
            lines.push("Have you had a chance to " + lower1(m.text) + " yet?");
        }

        // To-do list
        var active = state.todos.filter(function (t) { return !t.done; });
        if (active.length) {
            lines.push("Psst… “" + randOf(active).text + "” is still on your to-do list.");
            if (active.length >= 3) lines.push("You've got " + active.length + " tasks waiting. Knock one out? ✅");
        }

        // Pictures / albums / feed
        if (state.posts.length === 0) lines.push("Your feed looks quiet — share what's on your mind! ✍️");
        lines.push("Maybe upload a photo from today? 📸");
        if (state.albums.length === 0) lines.push("Try starting an album to organize your pictures. 🖼");

        // Gentle prompts
        lines.push("How's your day going so far?");
        lines.push("Have you taken a quiet moment to pray today? 🙏");
        lines.push("What's one thing you're grateful for right now? 💜");
        lines.push("Anything on your mind you'd like to reflect on today?");
        lines.push("Did you learn something new today? 📚");
        if (!state.profile.status) lines.push("Set a status to capture how you're feeling today.");

        // Inspiration
        Array.prototype.push.apply(lines, QUOTES);

        return lines;
    }

    function updateMascotLine() {
        var lines = buildMascotLines();
        if (!lines.length) return;
        var line = randOf(lines), tries = 0;
        while (line === lastMascotLine && tries < 6 && lines.length > 1) { line = randOf(lines); tries++; }
        lastMascotLine = line;
        el.mascotBubble.textContent = line;
        // Replay the little pop animation.
        el.mascotBubble.classList.remove("pop");
        void el.mascotBubble.offsetWidth; // force reflow so the animation restarts
        el.mascotBubble.classList.add("pop");
    }

    // ---- Mascot designs (inline SVG, each with a kawaii face) ----
    var M_DEFS =
        '<defs>' +
        '<linearGradient id="mgP" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#9b8dff"/><stop offset="1" stop-color="#6d5dfc"/></linearGradient>' +
        '<linearGradient id="mgY" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#ffab00"/></linearGradient>' +
        '</defs>';

    // A reusable face centered at (cx, cy), scaled by s.
    function mFace(cx, cy, s) {
        s = s || 1;
        var g = 11 * s, er = 5 * s, sh = 1.7 * s, sm = 8 * s;
        function n(v) { return Math.round(v * 10) / 10; }
        return '' +
            '<ellipse cx="' + n(cx - g - 1) + '" cy="' + n(cy + 7 * s) + '" rx="' + n(5.5 * s) + '" ry="' + n(3.3 * s) + '" fill="#ff9ec4" opacity="0.7"/>' +
            '<ellipse cx="' + n(cx + g + 1) + '" cy="' + n(cy + 7 * s) + '" rx="' + n(5.5 * s) + '" ry="' + n(3.3 * s) + '" fill="#ff9ec4" opacity="0.7"/>' +
            '<circle cx="' + n(cx - g) + '" cy="' + n(cy) + '" r="' + n(er) + '" fill="#1c1e21"/>' +
            '<circle cx="' + n(cx + g) + '" cy="' + n(cy) + '" r="' + n(er) + '" fill="#1c1e21"/>' +
            '<circle cx="' + n(cx - g + sh) + '" cy="' + n(cy - sh) + '" r="' + n(sh) + '" fill="#fff"/>' +
            '<circle cx="' + n(cx + g + sh) + '" cy="' + n(cy - sh) + '" r="' + n(sh) + '" fill="#fff"/>' +
            '<path d="M' + n(cx - sm) + ' ' + n(cy + 9 * s) + ' Q' + n(cx) + ' ' + n(cy + 16 * s) + ' ' + n(cx + sm) + ' ' + n(cy + 9 * s) + '" stroke="#1c1e21" stroke-width="' + n(2.6 * s) + '" fill="none" stroke-linecap="round"/>';
    }

    function svgWrap(viewBox, inner) {
        return '<svg class="mascot-svg" viewBox="' + viewBox + '" xmlns="http://www.w3.org/2000/svg">' +
            M_DEFS + inner + '</svg>';
    }

    function tBarTicks() {
        var o = "";
        for (var x = 24; x <= 96; x += 12) {
            o += '<line x1="' + x + '" y1="33" x2="' + x + '" y2="40" stroke="#fff" stroke-width="2"/>';
        }
        return o;
    }
    function rulerTicks() {
        var o = "", i = 0;
        for (var y = 22; y <= 98; y += 11) {
            var len = (i % 2 === 0) ? 12 : 7;
            o += '<line x1="40" y1="' + y + '" x2="' + (40 + len) + '" y2="' + y + '" stroke="#fff" stroke-width="2"/>';
            i++;
        }
        return o;
    }
    function sunRays() {
        var o = "";
        for (var i = 0; i < 12; i++) {
            var a = (Math.PI * 2 / 12) * i;
            var x1 = 60 + Math.cos(a) * 34, y1 = 60 + Math.sin(a) * 34;
            var x2 = 60 + Math.cos(a) * 46, y2 = 60 + Math.sin(a) * 46;
            o += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) +
                '" y2="' + y2.toFixed(1) + '" stroke="#ffab00" stroke-width="5" stroke-linecap="round"/>';
        }
        return o;
    }

    var MASCOT_DESIGNS = [
        { key: "blob", name: "Blob", build: function () {
            return svgWrap("0 0 120 128",
                '<path d="M60 12 Q56 0 70 3" stroke="#6d5dfc" stroke-width="5" fill="none" stroke-linecap="round"/>' +
                '<path d="M60 10 C31 10 18 33 18 60 C18 98 34 122 60 122 C86 122 102 98 102 60 C102 33 89 10 60 10 Z" fill="url(#mgP)"/>' +
                mFace(60, 62, 1.15));
        } },
        { key: "tsquare", name: "T-square", build: function () {
            return svgWrap("0 0 120 120",
                '<rect x="14" y="16" width="92" height="22" rx="7" fill="#6d5dfc"/>' + tBarTicks() +
                '<rect x="48" y="34" width="24" height="74" rx="8" fill="#9b8dff"/>' +
                mFace(60, 74, 0.92));
        } },
        { key: "ruler", name: "Ruler", build: function () {
            return svgWrap("0 0 120 120",
                '<rect x="40" y="10" width="40" height="100" rx="8" fill="#9b8dff"/>' + rulerTicks() +
                mFace(62, 58, 0.95));
        } },
        { key: "floppy", name: "Floppy disc", build: function () {
            return svgWrap("0 0 120 120",
                '<rect x="16" y="16" width="88" height="88" rx="6" fill="#6d5dfc"/>' +
                '<rect x="58" y="16" width="26" height="30" fill="#bdb6ec"/>' +
                '<rect x="64" y="20" width="8" height="22" rx="1" fill="#6d5dfc"/>' +
                '<rect x="28" y="56" width="64" height="42" rx="3" fill="#fff"/>' +
                mFace(60, 73, 0.92));
        } },
        { key: "card", name: "Card", build: function () {
            return svgWrap("0 0 120 120",
                '<rect x="28" y="12" width="64" height="96" rx="10" fill="#fff" stroke="#6d5dfc" stroke-width="3"/>' +
                '<text x="40" y="34" font-size="16" fill="#e0405a" text-anchor="middle">&#9829;</text>' +
                '<text x="80" y="100" font-size="16" fill="#e0405a" text-anchor="middle">&#9829;</text>' +
                mFace(60, 60, 0.95));
        } },
        { key: "sun", name: "Sun", build: function () {
            return svgWrap("0 0 120 120",
                sunRays() + '<circle cx="60" cy="60" r="30" fill="url(#mgY)"/>' +
                mFace(60, 60, 1));
        } },
        { key: "moon", name: "Moon", build: function () {
            return svgWrap("0 0 120 120",
                '<circle cx="92" cy="36" r="2.5" fill="#f6e27a"/><circle cx="100" cy="60" r="2" fill="#f6e27a"/>' +
                '<path d="M64 22 A34 34 0 1 0 64 98 A24 24 0 1 1 64 22 Z" fill="#f6e27a"/>' +
                mFace(52, 60, 0.9));
        } }
    ];

    function currentDesign() {
        for (var i = 0; i < MASCOT_DESIGNS.length; i++) {
            if (MASCOT_DESIGNS[i].key === state.mascot.design) return MASCOT_DESIGNS[i];
        }
        return MASCOT_DESIGNS[0];
    }

    function renderMascotBody() {
        el.mascotBody.innerHTML = currentDesign().build();
    }

    function renderMascotPicker() {
        el.mascotPicker.innerHTML = "";
        MASCOT_DESIGNS.forEach(function (d) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "mascot-swatch" + (d.key === state.mascot.design ? " is-active" : "");
            btn.title = d.name;
            btn.innerHTML = '<span class="mascot-swatch-art">' + d.build() + '</span>' +
                '<span class="mascot-swatch-name">' + d.name + '</span>';
            btn.addEventListener("click", function () {
                state.mascot.design = d.key;
                persist();
                renderMascotBody();
                renderMascotPicker();
                el.mascotPicker.hidden = true;
            });
            el.mascotPicker.appendChild(btn);
        });
    }

    // ---- Mascot position (dragging) ----
    function positionMascot(x, y) {
        var w = el.mascot.offsetWidth, h = el.mascot.offsetHeight;
        var maxX = window.innerWidth - w - 4, maxY = window.innerHeight - h - 4;
        x = Math.max(4, Math.min(x, Math.max(4, maxX)));
        y = Math.max(4, Math.min(y, Math.max(4, maxY)));
        el.mascot.style.left = x + "px";
        el.mascot.style.top = y + "px";
        el.mascot.style.right = "auto";
        el.mascot.style.bottom = "auto";
    }

    function applyMascotPosition() {
        if (state.mascot.x != null && state.mascot.y != null) {
            positionMascot(state.mascot.x, state.mascot.y);
        } else {
            // Revert to the default CSS corner.
            el.mascot.style.left = "";
            el.mascot.style.top = "";
            el.mascot.style.right = "";
            el.mascot.style.bottom = "";
        }
    }

    // ---- Mascot visibility (dismiss / summon) ----
    function applyMascotVisibility() {
        el.mascot.hidden = state.mascot.dismissed;
        el.mascotSummon.hidden = !state.mascot.dismissed;
    }

    function renderMascot() {
        renderMascotBody();
        renderMascotPicker();
        applyMascotVisibility();
        applyMascotPosition();
    }

    // ---- Play with me (card duel vs the mascot) ----
    // Cards rank 1–7. Higher rank wins the round. Each card is used once over
    // 7 rounds; most round-wins takes the match. No armor, no power-ups.
    var GAME_CARDS = [
        { rank: 1, name: "Magikarp", emoji: "🐟" },
        { rank: 2, name: "Caterpie", emoji: "🐛" },
        { rank: 3, name: "Jigglypuff", emoji: "🎤" },
        { rank: 4, name: "Pikachu", emoji: "⚡" },
        { rank: 5, name: "Snorlax", emoji: "😴" },
        { rank: 6, name: "Charizard", emoji: "🔥" },
        { rank: 7, name: "Mewtwo", emoji: "🔮" }
    ];
    var GAME_BY_RANK = {};
    GAME_CARDS.forEach(function (c) { GAME_BY_RANK[c.rank] = c; });
    var GAME_RANKS = GAME_CARDS.map(function (c) { return c.rank; });

    // Always-excited mascot dialogue, keyed by event.
    var GAME_LINES = {
        start: [
            "Ooh a game! I'm SO ready — let's go! 🎉",
            "Yay, you came to play! This is gonna be fun!",
            "A duel?! Yes yes yes! Show me your best card!"
        ],
        thinking: [
            "Hmm, let me think 🤔",
            "Ooh, what to play",
            "Let me see 👀",
            "Decisions, decisions"
        ],
        mascotWin: [
            "Hehe, I got that one! So fun!",
            "Yes! Point for me — but you're doing great!",
            "Gotcha! Ooh I love this game!",
            "Woohoo, mine! What are you playing next?!"
        ],
        playerWin: [
            "Whoa, nice one! You're so good at this!",
            "Aww you got me — amazing! Again, again!",
            "Eee that was clever! I'm still having a blast!",
            "You win that round! This is the best!"
        ],
        tie: [
            "Twins! Hehe, same card! So cool!",
            "Whoa, a tie! What are the odds?! Love it!",
            "Matchy-matchy! This is exciting!"
        ],
        matchMascotWin: [
            "GG! I won this one — but that was super fun! Rematch?!",
            "Yay I got it! You pushed me hard though — again?!"
        ],
        matchPlayerWin: [
            "You WON! Amazing!! That was awesome — let's play again!",
            "Champion! You beat me and I loved every second! Rematch?!"
        ],
        matchTie: [
            "A perfect tie!! How exciting — one more game?!",
            "We matched evenly! So so fun — rematch?!"
        ]
    };
    function pickGameLine(cat) {
        var arr = GAME_LINES[cat];
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // Most-likely card the player plays at this round index, learned from the
    // last 100 games and restricted to cards they still hold. null if no data.
    function predictPlayerCard(roundIndex, playerHand) {
        var tally = {};
        state.game.history.forEach(function (g) {
            var c = g[roundIndex];
            if (c != null && playerHand.indexOf(c) >= 0) tally[c] = (tally[c] || 0) + 1;
        });
        var best = null, bestN = 0;
        Object.keys(tally).forEach(function (k) {
            if (tally[k] > bestN) { bestN = tally[k]; best = Number(k); }
        });
        return bestN > 0 ? best : null;
    }

    // Mascot's choice: beat the predicted card with the smallest winner;
    // otherwise beat the average of the player's remaining hand; else sacrifice
    // the lowest card. (Decided without seeing the player's actual pick.)
    function mascotPick(mascotHand, playerHand, predicted) {
        var sorted = mascotHand.slice().sort(function (a, b) { return a - b; });
        if (predicted != null && playerHand.indexOf(predicted) >= 0) {
            var beat = sorted.find(function (c) { return c > predicted; });
            return beat !== undefined ? beat : sorted[0];
        }
        var avg = playerHand.reduce(function (a, b) { return a + b; }, 0) / playerHand.length;
        var beatAvg = sorted.find(function (c) { return c > avg; });
        return beatAvg !== undefined ? beatAvg : sorted[0];
    }

    // A quick, dependency-free confetti shower. Pieces fall full-width and the
    // container removes itself once they're done. Skipped for reduced-motion.
    function burstConfetti() {
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        var colors = ["#6d5dfc", "#9b8dff", "#ff9ec4", "#ffd23f", "#31a24c", "#e0405a"];
        var box = document.createElement("div");
        box.className = "confetti";
        for (var i = 0; i < 90; i++) {
            var p = document.createElement("i");
            p.style.left = (Math.random() * 100) + "vw";
            p.style.background = colors[i % colors.length];
            p.style.width = (6 + Math.random() * 6).toFixed(1) + "px";
            p.style.height = (10 + Math.random() * 8).toFixed(1) + "px";
            p.style.setProperty("--dx", (Math.random() * 220 - 110).toFixed(0) + "px");
            p.style.animationDelay = (Math.random() * 0.25).toFixed(2) + "s";
            p.style.animationDuration = (1.1 + Math.random() * 0.9).toFixed(2) + "s";
            box.appendChild(p);
        }
        document.body.appendChild(box);
        setTimeout(function () { box.remove(); }, 2400);
    }

    var gameState = null;

    function newGame() {
        gameState = {
            playerHand: GAME_RANKS.slice(),
            mascotHand: GAME_RANKS.slice(),
            round: 0,
            playerScore: 0,
            mascotScore: 0,
            picks: [],
            lastPlayer: null,
            lastMascot: null,
            lastOutcome: null, // "thinking" | "player" | "mascot" | "tie"
            thinking: false,
            bubble: pickGameLine("start"),
            over: false,
            result: null // "player" | "mascot" | "tie"
        };
        renderGame();
    }

    function playerPlay(rank) {
        if (!gameState || gameState.over || gameState.thinking) return;
        var pIdx = gameState.playerHand.indexOf(rank);
        if (pIdx < 0) return; // already played / invalid

        // Mascot decides BEFORE the player's card is removed, so it never peeks.
        var predicted = predictPlayerCard(gameState.round, gameState.playerHand);
        var mRank = mascotPick(gameState.mascotHand, gameState.playerHand, predicted);

        gameState.playerHand.splice(pIdx, 1);
        gameState.mascotHand.splice(gameState.mascotHand.indexOf(mRank), 1);
        gameState.picks.push(rank);

        // Show the player's card, then let the mascot "think" before flipping.
        gameState.lastPlayer = rank;
        gameState.lastMascot = mRank;
        gameState.lastOutcome = "thinking";
        gameState.thinking = true;
        gameState.bubble = pickGameLine("thinking");
        renderGame();

        setTimeout(revealRound, 850);
    }

    // Second phase: resolve the round and flip the mascot's card face-up.
    function revealRound() {
        if (!gameState || !gameState.thinking) return; // bailed (e.g. New game pressed)
        gameState.thinking = false;

        var rank = gameState.lastPlayer, mRank = gameState.lastMascot;
        var outcome;
        if (rank > mRank) { outcome = "player"; gameState.playerScore++; }
        else if (mRank > rank) { outcome = "mascot"; gameState.mascotScore++; }
        else { outcome = "tie"; }

        gameState.lastOutcome = outcome;
        gameState.round++;

        if (gameState.round >= 7) {
            endMatch();
        } else {
            gameState.bubble = pickGameLine(
                outcome === "mascot" ? "mascotWin" : outcome === "player" ? "playerWin" : "tie"
            );
        }
        renderGame();
    }

    function endMatch() {
        gameState.over = true;
        var result = gameState.playerScore > gameState.mascotScore ? "player"
            : gameState.mascotScore > gameState.playerScore ? "mascot" : "tie";
        gameState.result = result;
        gameState.bubble = pickGameLine(
            result === "mascot" ? "matchMascotWin" : result === "player" ? "matchPlayerWin" : "matchTie"
        );

        // Persist: learning history (last 100) + cumulative score.
        state.game.history.push(gameState.picks.slice());
        if (state.game.history.length > 100) {
            state.game.history = state.game.history.slice(-100);
        }
        state.game.stats.matches++;
        if (result === "player") state.game.stats.playerWins++;
        else if (result === "mascot") state.game.stats.mascotWins++;
        else state.game.stats.ties++;
        persist();

        if (result === "player") burstConfetti(); // 🎉 celebrate the win
    }

    // Wipe the cumulative win/loss/tie record (keeps the current game and the
    // mascot's learning history intact).
    function resetGameScore() {
        if (!confirm("Reset your lifetime score (wins / losses / ties)?")) return;
        state.game.stats = { matches: 0, playerWins: 0, mascotWins: 0, ties: 0 };
        persist();
        renderGame();
    }

    function gameCardHTML(rank) {
        var c = GAME_BY_RANK[rank];
        return '<span class="game-card-emoji">' + c.emoji + '</span>' +
            '<span class="game-card-rank">' + c.rank + '</span>' +
            '<span class="game-card-name">' + c.name + '</span>';
    }

    function renderGame() {
        if (!gameState) { newGame(); return; } // first open seeds a fresh match (newGame re-renders)
        var g = gameState;

        el.gameMascotFace.innerHTML = currentDesign().build();
        if (g.thinking) {
            // Show the line plus an animated typing indicator during the pause.
            el.gameBubble.textContent = g.bubble + " ";
            var dots = document.createElement("span");
            dots.className = "typing-dots";
            dots.innerHTML = "<i></i><i></i><i></i>";
            el.gameBubble.appendChild(dots);
        } else {
            el.gameBubble.textContent = g.bubble;
        }

        // Mascot's remaining cards, face down.
        el.gameMascotHand.innerHTML = "";
        g.mascotHand.forEach(function () {
            var back = document.createElement("div");
            back.className = "game-card game-card-back";
            el.gameMascotHand.appendChild(back);
        });

        el.gameYouScore.textContent = String(g.playerScore);
        el.gameMascotScore.textContent = String(g.mascotScore);
        el.gameRound.textContent = g.over ? "Match over" : ("Round " + (g.round + 1) + " of 7");

        // Reveal area
        if (g.lastPlayer == null) {
            el.gameReveal.innerHTML = '<p class="game-hint">Pick a card to start the round! 👇</p>';
        } else if (g.lastOutcome === "thinking") {
            // Your card is shown; the mascot's stays face-down while it "thinks".
            el.gameReveal.innerHTML =
                '<div class="game-reveal-row">' +
                '<div class="game-card played from-left">' + gameCardHTML(g.lastPlayer) + '</div>' +
                '<span class="game-vs">vs</span>' +
                '<div class="game-card-back game-back-reveal thinking-pulse"></div>' +
                '</div>' +
                '<p class="game-reveal-label thinking">thinking…</p>';
        } else {
            var label = g.lastOutcome === "player" ? "You win the round! 🎉"
                : g.lastOutcome === "mascot" ? "Mascot wins the round!" : "It's a tie!";
            var pCls = g.lastOutcome === "player" ? "win" : g.lastOutcome === "mascot" ? "lose" : "tie";
            var mCls = g.lastOutcome === "mascot" ? "win" : g.lastOutcome === "player" ? "lose" : "tie";
            el.gameReveal.innerHTML =
                '<div class="game-reveal-row">' +
                '<div class="game-card played ' + pCls + '">' + gameCardHTML(g.lastPlayer) + '</div>' +
                '<span class="game-vs">vs</span>' +
                // Mascot's card flips from face-down to face-up.
                '<div class="gcf ' + mCls + '">' +
                '<div class="gcf-inner">' +
                '<div class="gcf-face gcf-back"></div>' +
                '<div class="gcf-face gcf-front">' + gameCardHTML(g.lastMascot) + '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '<p class="game-reveal-label ' + pCls + '">' + label + '</p>';
        }

        // Hand
        el.gameHand.innerHTML = "";
        if (g.over) {
            var resultText = g.result === "player" ? "🏆 You won the match!"
                : g.result === "mascot" ? "Mascot won the match!" : "The match is a tie!";
            var done = document.createElement("p");
            done.className = "game-result " + (g.result === "player" ? "win" : g.result === "mascot" ? "lose" : "tie");
            done.textContent = resultText + "  (" + g.playerScore + "–" + g.mascotScore + ")";
            el.gameHand.appendChild(done);
            el.gameNewBtn.textContent = "Play again";
        } else {
            g.playerHand.slice().sort(function (a, b) { return a - b; }).forEach(function (rank) {
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "game-card";
                btn.disabled = g.thinking; // no playing while the mascot decides
                btn.innerHTML = gameCardHTML(rank);
                btn.addEventListener("click", function () { playerPlay(rank); });
                el.gameHand.appendChild(btn);
            });
            el.gameNewBtn.textContent = "Restart game";
        }

        // Cumulative stats
        var s = state.game.stats;
        el.gameStats.textContent = "Record — you " + s.playerWins + " · mascot " + s.mascotWins +
            " · ties " + s.ties + "  (" + s.matches + " played, learning from last " +
            Math.min(state.game.history.length, 100) + ")";
    }

    // ---- Wire up events ----
    function bindEvents() {
        el.profileName.addEventListener("input", function () {
            state.profile.name = el.profileName.value;
            applyAvatar(el.avatar); // initial follows the name (when no custom picture)
            persist();
            renderFeed(); // author name (and avatar) on posts follows the profile
        });

        // --- Profile picture: change / remove ---
        el.avatar.addEventListener("click", function () { el.avatarInput.click(); });

        el.avatarInput.addEventListener("change", function () {
            var file = el.avatarInput.files[0];
            el.avatarInput.value = ""; // allow re-picking the same file
            if (!file) return;
            processAvatar(file).then(function (dataUrl) {
                var prev = state.profile.avatar;
                state.profile.avatar = dataUrl;
                if (!Store.save(state)) {
                    state.profile.avatar = prev; // roll back on quota failure
                    alert("Couldn't save the picture — storage may be full.");
                    return;
                }
                renderProfile();
                renderFeed(); // refresh post avatars
            }).catch(function (err) {
                alert(err.message);
            });
        });

        el.avatarRemove.addEventListener("click", function () {
            if (!state.profile.avatar) return;
            state.profile.avatar = null;
            persist();
            renderProfile();
            renderFeed();
        });

        // --- Daily reminders ---
        el.newReminderForm.addEventListener("submit", function (e) {
            e.preventDefault();
            addReminder(el.newReminderText.value);
            el.newReminderText.value = "";
        });

        // --- Mascot: drag to move, click (no drag) for a new line ---
        var drag = null;
        function onPointerMove(e) {
            if (!drag) return;
            var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
            if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
            positionMascot(drag.ox + dx, drag.oy + dy);
        }
        function onPointerUp() {
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            if (!drag) return;
            if (drag.moved) {
                var rect = el.mascot.getBoundingClientRect();
                state.mascot.x = rect.left;
                state.mascot.y = rect.top;
                persist();
            } else {
                // A tap with no movement = ask for a new thought.
                updateMascotLine();
                el.mascot.classList.remove("bounce");
                void el.mascot.offsetWidth;
                el.mascot.classList.add("bounce");
            }
            drag = null;
        }
        el.mascot.addEventListener("pointerdown", function (e) {
            // Let the control buttons and the design picker handle their own clicks.
            if (e.target.closest(".mascot-controls") || e.target.closest(".mascot-picker")) return;
            var rect = el.mascot.getBoundingClientRect();
            drag = { sx: e.clientX, sy: e.clientY, ox: rect.left, oy: rect.top, moved: false };
            document.addEventListener("pointermove", onPointerMove);
            document.addEventListener("pointerup", onPointerUp);
        });

        // --- Mascot: design picker, dismiss, summon ---
        el.mascotDesignBtn.addEventListener("click", function () {
            el.mascotPicker.hidden = !el.mascotPicker.hidden;
        });
        el.mascotDismissBtn.addEventListener("click", function () {
            state.mascot.dismissed = true;
            el.mascotPicker.hidden = true;
            persist();
            applyMascotVisibility();
        });
        el.mascotSummon.addEventListener("click", function () {
            state.mascot.dismissed = false;
            persist();
            applyMascotVisibility();
            applyMascotPosition();
            updateMascotLine();
        });

        // Keep the mascot on-screen if the window is resized.
        window.addEventListener("resize", applyMascotPosition);

        setInterval(updateMascotLine, 30000);

        el.statusInput.addEventListener("input", function () {
            state.profile.status = el.statusInput.value;
            persist();
        });

        el.statusDot.addEventListener("click", function () {
            var i = AVAILABILITY.indexOf(state.profile.availability);
            state.profile.availability = AVAILABILITY[(i + 1) % AVAILABILITY.length];
            setAvailabilityClass(state.profile.availability);
            persist();
        });

        el.composerText.addEventListener("input", function () {
            updateCharCount();
            refreshPostButton();
        });

        el.imageInput.addEventListener("change", function () {
            handleFiles(el.imageInput.files);
            el.imageInput.value = ""; // allow re-picking the same file
        });

        el.postBtn.addEventListener("click", submitPost);

        // Ctrl/Cmd+Enter to post quickly.
        el.composerText.addEventListener("keydown", function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                submitPost();
            }
        });

        // --- Tabs ---
        el.tabFeed.addEventListener("click", function () { switchTab("feed"); });
        el.tabAlbums.addEventListener("click", function () { switchTab("albums"); });
        el.tabSheets.addEventListener("click", function () { switchTab("sheets"); });
        el.tabPlay.addEventListener("click", function () { switchTab("play"); });

        // --- Play with me ---
        el.gameNewBtn.addEventListener("click", newGame);
        el.gameResetBtn.addEventListener("click", resetGameScore);

        // --- Albums: list view ---
        el.newAlbumForm.addEventListener("submit", function (e) {
            e.preventDefault();
            createAlbum(el.newAlbumName.value);
            el.newAlbumName.value = "";
        });

        // --- Albums: detail view ---
        el.albumBackBtn.addEventListener("click", function () {
            openAlbumId = null;
            showAlbumList();
            renderAlbums();
        });

        el.albumTitleInput.addEventListener("change", function () {
            if (openAlbumId) renameAlbum(openAlbumId, el.albumTitleInput.value);
        });

        el.albumImageInput.addEventListener("change", function () {
            if (openAlbumId) addImagesToAlbum(openAlbumId, el.albumImageInput.files);
            el.albumImageInput.value = ""; // allow re-picking the same file
        });

        el.albumDeleteBtn.addEventListener("click", function () {
            if (openAlbumId) deleteAlbum(openAlbumId);
        });

        // Close any open "move picture" menu when clicking elsewhere.
        document.addEventListener("click", function (e) {
            if (!e.target.closest(".album-move-menu") && !e.target.closest(".album-thumb-move")) {
                closeMoveMenus();
            }
        });

        // --- To-Do ---
        el.newTodoForm.addEventListener("submit", function (e) {
            e.preventDefault();
            addTodo(el.newTodoText.value);
            el.newTodoText.value = "";
        });

        var filterBtns = el.todosPanel.querySelectorAll(".todo-filter");
        Array.prototype.forEach.call(filterBtns, function (btn) {
            btn.addEventListener("click", function () {
                setTodoFilter(btn.getAttribute("data-filter"));
            });
        });

        el.clearCompletedBtn.addEventListener("click", clearCompleted);

        // --- Sheets: list view ---
        el.newSheetForm.addEventListener("submit", function (e) {
            e.preventDefault();
            createSheet(el.newSheetName.value);
            el.newSheetName.value = "";
        });

        el.importNewCsvInput.addEventListener("change", function () {
            if (el.importNewCsvInput.files[0]) importCsvAsNewSheet(el.importNewCsvInput.files[0]);
            el.importNewCsvInput.value = ""; // allow re-importing the same file
        });

        // --- Sheets: detail view ---
        el.sheetBackBtn.addEventListener("click", function () {
            openSheetId = null;
            showSheetList();
            renderSheets();
        });

        el.sheetTitleInput.addEventListener("change", function () {
            if (openSheetId) renameSheet(openSheetId, el.sheetTitleInput.value);
        });

        el.addColumnBtn.addEventListener("click", function () {
            if (openSheetId) addColumn(openSheetId);
        });

        el.addRowBtn.addEventListener("click", function () {
            if (openSheetId) addRow(openSheetId);
        });

        el.exportCsvBtn.addEventListener("click", function () {
            if (openSheetId) exportSheet(openSheetId);
        });

        el.importCsvInput.addEventListener("change", function () {
            if (openSheetId && el.importCsvInput.files[0]) {
                importCsvIntoSheet(openSheetId, el.importCsvInput.files[0]);
            }
            el.importCsvInput.value = ""; // allow re-importing the same file
        });

        el.appendCsvInput.addEventListener("change", function () {
            if (openSheetId && el.appendCsvInput.files[0]) {
                appendCsvToSheet(openSheetId, el.appendCsvInput.files[0]);
            }
            el.appendCsvInput.value = ""; // allow re-appending the same file
        });

        el.sheetDeleteBtn.addEventListener("click", function () {
            if (openSheetId) deleteSheet(openSheetId);
        });
    }

    // ---- Init ----
    function init() {
        renderProfile();
        updateCharCount();
        refreshPostButton();
        renderPreviews();
        renderFeed();
        renderAlbumStats();
        renderTodos(); // always-visible left panel now, so render the full list
        renderSheetStats();
        renderMascot();
        renderReminders();
        bindEvents();
    }

    // Expose a tiny bit for the test harness.
    window.IntrovertsSocialSpace = {
        getState: function () { return state; },
        _internals: {
            relTime: relTime,
            initial: initial,
            csvEscape: csvEscape,
            sheetToCsv: sheetToCsv,
            csvParse: csvParse,
            gridFromCsv: gridFromCsv,
            rowsFromCsvBody: rowsFromCsvBody,
            todayStr: todayStr,
            yesterdayStr: yesterdayStr,
            buildMascotLines: buildMascotLines,
            mascotDesigns: function () { return MASCOT_DESIGNS; },
            mascotPick: mascotPick
        }
    };

    document.addEventListener("DOMContentLoaded", init);
})();
