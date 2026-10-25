// SafeSteps Safe Map: real OpenStreetMap places + on-device community check-ins.
// Location and check-ins never leave the browser.

(function () {
  const PLACES = (window.SAFE_PLACES || []).map((r) => ({
    id: r[0], name: r[1], cat: r[2], lat: r[3], lng: r[4], far: r[5] === 1, hours: r[6], phone: r[7],
  }));

  const CATS = {
    police:   { label: "Police",            letter: "P", order: 0 },
    hospital: { label: "Hospital / clinic", letter: "H", order: 1 },
    transit:  { label: "Metro / rail",      letter: "M", order: 2 },
    campus:   { label: "Campus",            letter: "C", order: 3 },
    mall:     { label: "Mall",              letter: "S", order: 4 },
    other:    { label: "Emergency / 24-7",  letter: "E", order: 5 },
  };

  const FARIDABAD_CENTER = [28.4089, 77.3178];
  const STORE_KEY = "safesteps_checkins";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const state = { region: "far", cats: new Set(Object.keys(CATS)), query: "", user: null };
  let checkins = {};
  try { checkins = JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch (e) { checkins = {}; }
  const saveCheckins = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(checkins)); } catch (e) {} };

  function km(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const dist = (p) => (state.user ? km(state.user, p) : null);
  const fmtKm = (d) => (d < 1 ? Math.round(d * 1000) + " m" : d.toFixed(1) + " km");
  const directions = (p) => "https://www.google.com/maps/dir/?api=1&destination=" + p.lat + "," + p.lng;

  /* ---------- map ---------- */
  if (!window.L) {
    $("sm-map").innerHTML = '<div class="sm-tilefail-static">The map could not load. Your browser or network may be blocking the map files. Try another browser or connection, or search the area on <a href="https://www.openstreetmap.org/#map=12/28.4089/77.3178" target="_blank" rel="noopener">OpenStreetMap</a>.</div>';
    return;
  }
  const map = L.map("sm-map", { scrollWheelZoom: false, zoomControl: true }).setView(FARIDABAD_CENTER, 12);
  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  let tileErrors = 0;
  tiles.on("tileerror", () => {
    if (++tileErrors !== 6) return;
    const note = document.createElement("div");
    note.className = "sm-tilefail";
    note.innerHTML = 'The map pictures are not loading (your network or browser may be blocking them). The pins and the list still work. <a href="https://www.openstreetmap.org/#map=12/28.4089/77.3178" target="_blank" rel="noopener">Open the map on OpenStreetMap</a>.';
    $("sm-map").parentNode.appendChild(note);
  });
  map.on("click", () => map.scrollWheelZoom.enable());
  map.getContainer().addEventListener("mouseleave", () => map.scrollWheelZoom.disable());

  const cluster = L.markerClusterGroup({ maxClusterRadius: 45, showCoverageOnHover: false });
  map.addLayer(cluster);

  const markers = new Map();
  PLACES.forEach((p) => {
    const icon = L.divIcon({
      className: "sm-pin-wrap",
      html: '<span class="sm-pin sm-pin-' + p.cat + '">' + CATS[p.cat].letter + "</span>",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
    const m = L.marker([p.lat, p.lng], { icon, title: p.name, alt: p.name });
    m.bindPopup(() => popupHtml(p), { minWidth: 210 });
    markers.set(p.id, m);
  });

  function popupHtml(p) {
    const d = dist(p);
    const ci = checkins[p.id];
    const phone = p.phone && /^\+?[\d\s-]{5,}$/.test(p.phone)
      ? '<div class="sm-pop-line"><a href="tel:' + esc(p.phone.replace(/[^+\d]/g, "")) + '">' + esc(p.phone) + "</a></div>"
      : "";
    return (
      '<div class="sm-pop"><strong>' + esc(p.name) + "</strong>" +
      '<div class="sm-pop-cat">' + esc(CATS[p.cat].label) + (d != null ? " · " + fmtKm(d) + " away" : "") + "</div>" +
      (p.hours ? '<div class="sm-pop-line">Hours: ' + esc(p.hours) + "</div>" : "") +
      phone +
      (ci ? '<div class="sm-pop-line">Your check-in: ' + esc(ci.score) + "/5</div>" : "") +
      '<div class="sm-pop-actions"><a class="sm-pop-btn" target="_blank" rel="noopener" href="' + directions(p) + '">Directions</a>' +
      '<button type="button" class="sm-pop-btn sm-rate" data-id="' + esc(p.id) + '">' + (ci ? "Update check-in" : "Check in") + "</button></div></div>"
    );
  }
  map.on("popupopen", (e) => {
    const btn = e.popup.getElement().querySelector(".sm-rate");
    if (btn) btn.addEventListener("click", () => openDialog(btn.dataset.id));
  });

  /* ---------- filtering + render ---------- */
  function visible() {
    const tokens = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (p) => {
      if (!tokens.length) return true;
      const words = p.name.toLowerCase().split(/[^a-z0-9\u0900-\u097f]+/);
      return tokens.every((t) => words.some((w) => w.startsWith(t)));
    };
    const list = PLACES.filter((p) => (state.region === "all" || p.far) && state.cats.has(p.cat) && matches(p));
    if (state.user) {
      list.sort((a, b) => dist(a) - dist(b));
    } else {
      list.sort((a, b) => CATS[a.cat].order - CATS[b.cat].order || a.name.localeCompare(b.name));
    }
    return list;
  }

  function render(fit) {
    const list = visible();
    cluster.clearLayers();
    cluster.addLayers(list.map((p) => markers.get(p.id)));

    $("sm-list-count").textContent = list.length + (list.length === 1 ? " place" : " places") + (state.user ? ", nearest first" : "");
    const ul = $("sm-list");
    ul.innerHTML = "";
    list.forEach((p) => {
      const li = document.createElement("li");
      const d = dist(p);
      const ci = checkins[p.id];
      li.innerHTML =
        '<button type="button" class="sm-item" data-id="' + esc(p.id) + '">' +
        '<span class="sm-pin sm-pin-' + p.cat + ' sm-pin-sm">' + CATS[p.cat].letter + "</span>" +
        '<span class="sm-item-main"><span class="sm-item-name">' + esc(p.name) + "</span>" +
        '<span class="sm-item-meta">' + esc(CATS[p.cat].label) + (d != null ? " · " + fmtKm(d) : "") + (ci ? " · you: " + esc(ci.score) + "/5" : "") + "</span></span></button>";
      ul.appendChild(li);
    });

    $("sm-count-far").textContent = PLACES.filter((p) => p.far).length;
    $("sm-count-all").textContent = PLACES.length;
    $("sm-count-checkins").textContent = Object.keys(checkins).length;

    if (fit && list.length) {
      map.fitBounds(L.latLngBounds(list.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 15 });
    }
  }

  $("sm-list").addEventListener("click", (e) => {
    const btn = e.target.closest(".sm-item");
    if (!btn) return;
    const m = markers.get(btn.dataset.id);
    if (!m) return;
    $("sm-map").scrollIntoView({ behavior: "smooth", block: "center" });
    cluster.zoomToShowLayer(m, () => m.openPopup());
  });

  /* ---------- controls ---------- */
  const chips = $("sm-chips");
  Object.keys(CATS).forEach((k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sm-chip active";
    b.dataset.cat = k;
    b.innerHTML = '<span class="sm-pin sm-pin-' + k + ' sm-pin-xs">' + CATS[k].letter + "</span>" + esc(CATS[k].label);
    b.addEventListener("click", () => {
      if (state.cats.has(k)) state.cats.delete(k); else state.cats.add(k);
      b.classList.toggle("active", state.cats.has(k));
      render(false);
    });
    chips.appendChild(b);
  });

  document.querySelectorAll(".sm-seg-btn").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".sm-seg-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      state.region = b.dataset.region;
      render(state.region === "all" || !!state.user);
      if (state.region === "far" && !state.user) map.setView(FARIDABAD_CENTER, 12);
    })
  );

  $("sm-search").addEventListener("input", (e) => {
    state.query = e.target.value;
    const n = visible().length;
    render(!!state.query.trim() && n > 0 && n <= 80);
  });

  /* ---------- near me ---------- */
  let userMarker = null;
  $("sm-locate").addEventListener("click", () => {
    const btn = $("sm-locate");
    if (!navigator.geolocation) { btn.textContent = "Location unavailable"; return; }
    btn.textContent = "Locating...";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.user = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        btn.textContent = "Near me";
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([state.user.lat, state.user.lng], {
          icon: L.divIcon({ className: "sm-pin-wrap", html: '<span class="sm-you"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
          title: "You are here", zIndexOffset: 1000,
        }).addTo(map);
        map.setView([state.user.lat, state.user.lng], 14);
        showNearest();
        render(false);
      },
      () => { btn.textContent = "Near me"; alert("Couldn't get your location. You can still search by name or browse the map."); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });

  function showNearest() {
    const byDist = (cats, n) => PLACES.filter((p) => cats.includes(p.cat)).sort((a, b) => dist(a) - dist(b)).slice(0, n);
    const picks = byDist(["police"], 2).concat(byDist(["hospital"], 1), byDist(["transit"], 1));
    const box = $("sm-nearest-list");
    box.innerHTML = "";
    picks.forEach((p) => {
      const d = dist(p);
      const a = document.createElement("a");
      a.className = "sm-near-card";
      a.href = directions(p);
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML =
        '<span class="sm-pin sm-pin-' + p.cat + '">' + CATS[p.cat].letter + "</span>" +
        '<span><b>' + esc(p.name) + "</b><br><small>" + esc(CATS[p.cat].label) + " · " + fmtKm(d) + (d <= 2 ? " · ~" + Math.max(1, Math.round(d * 12)) + " min walk" : "") + "</small></span>";
      box.appendChild(a);
    });
    if (picks.length && dist(picks[0]) > 40) {
      const note = document.createElement("p");
      note.className = "sm-privacy";
      note.textContent = "You seem to be outside the NCR, so these are the closest mapped places, but they're far away.";
      box.appendChild(note);
    }
    $("sm-nearest").hidden = false;
  }

  /* ---------- check-in dialog ---------- */
  const dlg = $("sm-dialog"), form = $("sm-form");
  let currentId = null;

  function openDialog(id) {
    const p = PLACES.find((x) => x.id === id);
    if (!p) return;
    currentId = id;
    form.reset();
    const prev = checkins[id];
    if (prev) {
      ["when", "light", "crowd", "staff", "score"].forEach((k) => {
        const r = form.querySelector('input[name="' + k + '"][value="' + prev[k] + '"]');
        if (r) r.checked = true;
      });
      $("sm-note").value = prev.note || "";
    }
    $("sm-dialog-title").textContent = "Check in: " + p.name;
    map.closePopup();
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }
  const closeDialog = () => { if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open"); };

  form.addEventListener("submit", (e) => e.preventDefault());
  $("sm-cancel").addEventListener("click", closeDialog);
  $("sm-save").addEventListener("click", () => {
    const val = (n) => (form.querySelector('input[name="' + n + '"]:checked') || {}).value || "";
    const score = val("score");
    if (!score) { $("sm-scale").classList.add("sm-scale-error"); return; }
    $("sm-scale").classList.remove("sm-scale-error");
    checkins[currentId] = { score, when: val("when"), light: val("light"), crowd: val("crowd"), staff: val("staff"), note: $("sm-note").value.slice(0, 280), ts: Date.now() };
    saveCheckins();
    closeDialog();
    render(false);
  });

  /* ---------- go ---------- */
  $("sm-snapshot").textContent = window.SAFE_PLACES_SNAPSHOT || "";
  render(false);
})();
