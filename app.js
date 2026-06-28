const DATA = window.TEST_MATCH_INVINCIBLE_DATA;
if (Array.isArray(window.TEST_MATCH_INVINCIBLE_PLAYERS) && window.TEST_MATCH_INVINCIBLE_PLAYERS.length) {
  DATA.players = window.TEST_MATCH_INVINCIBLE_PLAYERS;
  DATA.playerDataMeta = window.TEST_MATCH_INVINCIBLE_PLAYER_DATA_META || null;
}
const PLAYER_BY_ID = Object.fromEntries(DATA.players.map((player) => [player.id, player]));
const app = document.querySelector("#app");
const WICKET_PLAYBACK_MS = 650;

const state = {
  formationId: "classic",
  seriesLength: 3,
  scenario: null,
  selections: {},
  selectionMeta: {},
  currentSlotId: null,
  currentOffer: null,
  offerSort: "bat",
  rerollsRemaining: 1,
  results: [],
  seriesStatus: "draft",
  breakOriginalSelections: null,
  breakChangesRemaining: 0,
  activeMatchIndex: null,
  shareMessage: "",
  playback: {
    matchIndex: null,
    visibleCount: 0,
    timer: null
  }
};

state.scenario = createScenario();
render();

app.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;

  const action = button.dataset.action;
  if (action === "spin") {
    state.scenario = createScenario();
    state.selections = {};
    state.selectionMeta = {};
    state.currentOffer = null;
    resetSeriesState();
    render();
  }
  if (action === "set-slot") {
    state.currentSlotId = button.dataset.slot;
    render();
  }
  if (action === "spin-player") {
    spinPlayerOffer();
    render();
    jumpToPlayerOffers();
  }
  if (action === "reroll-offer") {
    rerollPlayerOffer();
    render();
    jumpToPlayerOffers();
  }
  if (action === "draft-offer") {
    draftOfferedPlayer(button.dataset.playerId, button.dataset.slot);
    render();
  }
  if (action === "auto-pick") {
    autoPick();
    resetSeriesState();
    render();
  }
  if (action === "clear-team") {
    state.selections = {};
    state.selectionMeta = {};
    state.currentOffer = null;
    resetSeriesState();
    render();
  }
  if (action === "play-series") {
    playSeries();
    render();
    jumpToWicketReplay();
  }
  if (action === "continue-series") {
    playNextMatch();
    render();
    jumpToWicketReplay();
  }
  if (action === "skip-replay") {
    skipWicketPlayback(Number(button.dataset.matchIndex));
    render();
    scrollWicketReplayToLatest();
  }
  if (action === "show-match") {
    state.activeMatchIndex = Number(button.dataset.matchIndex);
    render();
  }
  if (action === "jump-to-respins") {
    jumpToBreakRespins();
  }
  if (action === "copy-match-image" || action === "download-match-image") {
    await shareResultImage("match", action.startsWith("copy") ? "copy" : "download", Number(button.dataset.matchIndex));
  }
  if (action === "copy-series-image" || action === "download-series-image") {
    await shareResultImage("series", action.startsWith("copy") ? "copy" : "download");
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-control='formation']")) {
    state.formationId = target.value;
    state.selections = {};
    state.selectionMeta = {};
    state.currentOffer = null;
    resetSeriesState();
    render();
  }
  if (target.matches("[data-control='series-length']")) {
    state.seriesLength = Number(target.value);
    resetSeriesState();
    render();
  }
  if (target.matches("[data-control='offer-sort']")) {
    state.offerSort = target.value;
    render();
  }
});

function resetSeriesState() {
  clearPlaybackTimer();
  state.results = [];
  state.seriesStatus = "draft";
  state.breakOriginalSelections = null;
  state.breakChangesRemaining = 0;
  state.activeMatchIndex = null;
  state.shareMessage = "";
  state.currentOffer = null;
  state.rerollsRemaining = 1;
  state.playback = {
    matchIndex: null,
    visibleCount: 0,
    timer: null
  };
}

function clearPlaybackTimer() {
  if (state.playback.timer) {
    clearInterval(state.playback.timer);
    state.playback.timer = null;
  }
}

function render() {
  const formation = getFormation();
  const validation = validateSelections();
  const analysis = analyseTeam();

  app.innerHTML = `
    ${renderHero()}
    <div class="app-grid">
      <aside class="panel setup-panel">
        ${renderScenario()}
        ${renderControls(formation)}
      </aside>
      <section class="panel draft-panel">
        ${renderDraft(formation, validation, analysis)}
      </section>
    </div>
    ${renderResults()}
  `;
}

function renderPlaybackFrame() {
  render();
  scrollWicketReplayToLatest();
}

function jumpToWicketReplay() {
  const target = document.querySelector("#wicket-replay");
  if (target && typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function jumpToPlayerOffers() {
  if (window.innerWidth > 680) return;
  setTimeout(() => {
    const target = document.querySelector(".offer-list .offer-player");
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 0);
}

function jumpToBreakRespins() {
  const target = document.querySelector(".match-break-respin");
  if (target && typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function scrollWicketReplayToLatest() {
  const list = document.querySelector("#wicket-replay .wicket-list");
  if (list && typeof list.scrollHeight === "number") {
    list.scrollTop = list.scrollHeight;
  }
  const latest = document.querySelector("#wicket-replay .latest-replay-row") || document.querySelector("#wicket-replay .latest-wicket-row");
  if (latest && typeof latest.scrollIntoView === "function") {
    latest.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }
}

function renderHero() {
  return `
    <header class="hero">
      <div class="hero-copy">
        <a class="back-link" href="/">Brent Clark Games</a>
        <h1>Test Match Invincible</h1>
        <p>Draft an all-era Test XI against a classic national side. To clear the challenge, every match must be won by an innings, with no draws, ties, chases, or second-innings rescue acts.</p>
      </div>
      <div class="score-tile" aria-label="Current challenge">
        <span>${state.seriesLength}-Test</span>
        <strong>${state.scenario.hostCountry}</strong>
        <em>v ${state.scenario.opponent.name}</em>
      </div>
    </header>
  `;
}

function renderScenario() {
  const opponent = state.scenario.opponent;
  const venues = state.scenario.venues.slice(0, state.seriesLength);

  return `
    <section class="panel-section section-scenario">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Series spin</p>
          <h2>${state.scenario.hostCountry} tour</h2>
        </div>
        <button class="secondary-btn" type="button" data-action="spin">Spin Series</button>
      </div>
      <div class="scenario-grid">
        <div>
          <span class="mini-label">Computer team</span>
          <strong>${opponent.name}</strong>
          <p>${opponent.nickname}</p>
        </div>
        <div>
          <span class="mini-label">Outright rule</span>
          <strong>Win by an innings</strong>
        </div>
      </div>
      <div class="venue-list series-${state.seriesLength}" aria-label="Known venues">
        ${venues.map((entry, index) => renderVenue(entry, index)).join("")}
      </div>
    </section>
  `;
}

function renderVenue(entry, index) {
  const condition = entry.condition;
  return `
    <article class="venue-card">
      <div class="venue-main">
        <span class="mini-label">Test ${index + 1} - ${entry.ground.city}</span>
        <strong>${entry.ground.name}</strong>
      </div>
      <div class="condition-tags">
        <span>${condition.pitchName}</span>
        <span>${condition.weather}</span>
        <span>${condition.rainLost} overs rain</span>
      </div>
      <p class="venue-pitch">${entry.ground.pitch}</p>
    </article>
  `;
}

function renderControls(formation) {
  const seriesLocked = state.seriesStatus !== "draft" || state.results.length > 0;
  return `
    <section class="panel-section compact-section section-controls">
      <label class="field-label" for="series-length">Series length</label>
      <select id="series-length" data-control="series-length" ${seriesLocked ? "disabled" : ""}>
        ${[1, 3, 5].map((length) => `<option value="${length}" ${state.seriesLength === length ? "selected" : ""}>${length} ${length === 1 ? "Test" : "Tests"}${length === 3 ? " - default" : ""}</option>`).join("")}
      </select>

      <label class="field-label" for="formation">Squad setup</label>
      <select id="formation" data-control="formation" ${seriesLocked ? "disabled" : ""}>
        ${DATA.formations.map((item) => `<option value="${item.id}" ${item.id === state.formationId ? "selected" : ""}>${item.name}</option>`).join("")}
      </select>
      <p class="setup-copy">${formation.summary}</p>
      <div class="button-row">
        <button class="ghost-btn" type="button" data-action="clear-team" ${seriesLocked ? "disabled" : ""}>Reset Draft</button>
      </div>
    </section>
  `;
}

function renderTeamSummary(analysis, validation) {
  const statusClass = validation.ok ? "ready" : "needs-work";
  const statusText = validation.ok ? "Ready to play" : validation.messages[0] || "Pick your XI";

  return `
    <section class="team-summary-strip section-summary">
      <div class="readiness ${statusClass}">
        <span>${statusText}</span>
        <strong>${analysis ? Math.round(analysis.overall) : "--"}</strong>
      </div>
      <div class="rating-grid">
        ${renderRating("Batting", analysis?.batting)}
        ${renderRating("Pace", analysis?.pace)}
        ${renderRating("Spin", analysis?.spin)}
        ${renderRating("Field", analysis?.fielding)}
      </div>
      <ul class="check-list">
        <li>${validation.selectedCount}/11 selected</li>
        <li>${validation.spinnerCount} spinner${validation.spinnerCount === 1 ? "" : "s"} picked, optional</li>
        <li>${validation.keeperCount} wicket keeper${validation.keeperCount === 1 ? "" : "s"} picked</li>
      </ul>
    </section>
  `;
}

function renderRating(label, value) {
  const width = value ? clamp(value, 0, 100) : 0;
  return `
    <div class="rating">
      <span>${label}</span>
      <strong>${value ? Math.round(value) : "--"}</strong>
      <i style="--w:${width}%"></i>
    </div>
  `;
}

function renderDraft(formation, validation, analysis) {
  const offer = state.currentOffer;
  const inBreak = state.seriesStatus === "break";
  const breakReady = inBreak && isLatestPlaybackComplete();
  const breakChangesText = state.breakChangesRemaining === 1 ? "1 change" : `${state.breakChangesRemaining} changes`;
  const playDisabled = validation.ok ? "" : "disabled";
  const playLabel = state.results.length ? "Restart Series" : "Start Series";

  return `
    <div class="draft-header">
      <div>
        <p class="eyebrow">Selection room</p>
        <h2>Pick the XI</h2>
        <p>Spin a country and decade, then place one of the offered players into any eligible position. You do not have to pick positions in order.</p>
        ${breakReady ? `<p class="change-note">Between Tests: you may respin and replace up to 2 players. ${breakChangesText} left, or continue with the current XI.</p>` : ""}
      </div>
      <button class="play-btn" type="button" data-action="play-series" ${state.seriesStatus === "break" ? "disabled" : playDisabled}>${playLabel}</button>
    </div>
    ${breakReady ? "" : renderSpinPanel(offer, validation)}
    <div class="slot-list">
      ${formation.slots.map((slot, index) => renderSlot(slot, index)).join("")}
    </div>
    ${renderTeamSummary(analysis, validation)}
    ${validation.messages.length ? `<div class="warning-box">${validation.messages.map((message) => `<p>${message}</p>`).join("")}</div>` : ""}
  `;
}

function renderSpinPanel(offer, validation) {
  const breakReady = isBreakChangeWindow();
  const draftOpen = state.seriesStatus === "draft" && !state.results.length;
  const canSpin = canSpinPlayerOffer(validation);
  const canReroll = canRerollPlayerOffer(validation);
  const rerollLabel = state.rerollsRemaining > 0 ? `Re-roll ${state.rerollsRemaining}` : "Re-roll used";
  const sortedCandidates = offer ? sortOfferCandidates(offer.candidates, state.offerSort) : [];
  const offerContent = offer
    ? `
      <div class="offer-meta">
        <span class="mini-label">Your country/decade spin</span>
        <strong class="offer-spin-value" aria-label="${offer.country}, ${offer.decade}s">
          <span class="offer-spin-country">${offer.country}</span>
          <span class="offer-spin-decade">${offer.decade}s</span>
        </strong>
        <div class="offer-sort-row">
          <p>${offer.candidates.length} ${offer.country} player${offer.candidates.length === 1 ? "" : "s"} active in the ${offer.decade}s. ${breakReady ? "Choose a position to replace. This spends 1 between-Test change." : "Only players from the spun country and decade can be picked."}</p>
          <label class="offer-sort-control">
            <span>Sort players</span>
            <select data-control="offer-sort" aria-label="Sort offered players by rating">
              <option value="bat" ${state.offerSort === "bat" ? "selected" : ""}>Batting rating</option>
              <option value="bowl" ${state.offerSort === "bowl" ? "selected" : ""}>Bowling rating</option>
              <option value="allrounder" ${state.offerSort === "allrounder" ? "selected" : ""}>All-rounder rating</option>
              <option value="keep" ${state.offerSort === "keep" ? "selected" : ""}>Wicketkeeping rating</option>
            </select>
          </label>
        </div>
      </div>
      <div class="offer-list">
        ${sortedCandidates.map((player) => renderOfferPlayer(player, offer)).join("")}
      </div>
    `
    : `
      <div class="offer-empty">
        <strong>${breakReady ? "No break respin yet" : "No player spin yet"}</strong>
        <p>${breakReady ? `Spin now to draw a replacement pool. ${state.breakChangesRemaining} between-Test change${state.breakChangesRemaining === 1 ? "" : "s"} left.` : "Spin now to draw a country and decade. Then choose which position to fill from the player cards."}</p>
      </div>
    `;

  return `
    <section class="spin-panel">
      <div class="spin-panel-head">
        <div>
          <p class="eyebrow">Draft spin</p>
          <h3>${breakReady ? "Between-Test respin" : "Country and decade pool"}</h3>
          <p>${breakReady ? "Replace up to two players before the next Test." : "Pick any available position after the spin lands."}</p>
        </div>
        <div class="spin-actions">
          <button class="primary-btn" type="button" data-action="spin-player" ${canSpin ? "" : "disabled"}>${breakReady ? "Respin Players" : "Spin Players"}</button>
          <button class="mini-auto-btn reroll-btn" type="button" data-action="reroll-offer" ${canReroll ? "" : "disabled"}>${rerollLabel}</button>
          <button class="mini-auto-btn" type="button" data-action="auto-pick" ${draftOpen && !validation.ok ? "" : "disabled"}>Auto fill empty</button>
        </div>
      </div>
      ${offerContent}
    </section>
  `;
}

function renderOfferPlayer(player, offer) {
  const breakReady = isBreakChangeWindow();
  const slotButtons = getOfferSlots(player).map((slot) => {
    if (!breakReady) {
      return `<button class="slot-pick-btn" type="button" data-action="draft-offer" data-player-id="${player.id}" data-slot="${slot.id}">${slot.label}</button>`;
    }

    const incumbent = PLAYER_BY_ID[state.selections[slot.id]];
    const positionRating = getPositionRating(incumbent, slot);
    const incumbentName = incumbent?.name || "Current player";
    return `
      <button class="slot-pick-btn replacement-pick-btn" type="button" data-action="draft-offer" data-player-id="${player.id}" data-slot="${slot.id}" aria-label="Replace ${incumbentName}, rated ${positionRating.value} for ${slot.label}, with ${player.name}">
        <span class="replacement-name">Replace ${incumbentName}</span>
        <span class="replacement-detail">${slot.label}</span>
        <b>${positionRating.label} ${positionRating.value}</b>
      </button>
    `;
  }).join("");

  return `
    <article class="offer-player">
      <div>
        <strong>${player.name}</strong>
        <p>${player.country}, ${getPlayerDecadeLabel(player, offer)}</p>
      </div>
      <span class="stat-line">
        ${renderStatPill("bat", "BAT", player.bat)}
        ${renderStatPill("bowl", "BOWL", player.bowl)}
        ${player.keep ? renderStatPill("keep", "KEEP", player.keep) : ""}
      </span>
      <span class="player-chips">${renderPlayerChips(player, null, offer)}</span>
      <span class="offer-slot-buttons">${slotButtons || "<i>No legal slot</i>"}</span>
    </article>
  `;
}

function getPositionRating(player, slot) {
  if (!player) return { label: "RATING", value: "-" };
  if (slot.kind === "keeper") return { label: "KEEP", value: Math.round(player.keep || 0) };
  if (slot.kind === "allrounder") {
    return { label: "AR", value: getAllRounderRating(player) };
  }
  if (["bowler", "spinner", "pace"].includes(slot.kind)) {
    return { label: "BOWL", value: Math.round(player.bowl || 0) };
  }
  return { label: "BAT", value: Math.round(player.bat || 0) };
}

function sortOfferCandidates(candidates, sortBy) {
  return [...candidates].sort((a, b) => {
    const ratingDifference = getOfferSortRating(b, sortBy) - getOfferSortRating(a, sortBy);
    if (ratingDifference) return ratingDifference;
    const bestDifference = Math.max(b.bat, b.bowl, b.keep || 0) - Math.max(a.bat, a.bowl, a.keep || 0);
    return bestDifference || a.name.localeCompare(b.name);
  });
}

function getOfferSortRating(player, sortBy) {
  if (sortBy === "bowl") return player.bowl || 0;
  if (sortBy === "keep") return player.keep || 0;
  if (sortBy === "allrounder") return getAllRounderRating(player);
  return player.bat || 0;
}

function getAllRounderRating(player) {
  return Math.round((player.bat || 0) * 0.48 + (player.bowl || 0) * 0.52);
}

function renderStatPill(kind, label, value) {
  const palette = {
    bat: { hue: 34, saturation: 92 },
    bowl: { hue: 206, saturation: 82 },
    keep: { hue: 282, saturation: 72 }
  }[kind];
  const lightness = Math.round(clamp(86 - value * 0.48, 34, 78));
  const foreground = lightness < 54 ? "#ffffff" : "#061108";
  return `<b class="stat-pill stat-${kind}" style="--stat-bg:hsl(${palette.hue} ${palette.saturation}% ${lightness}%);--stat-fg:${foreground};">${label} ${value}</b>`;
}

function renderSlot(slot, index) {
  const selectedId = state.selections[slot.id] || "";
  const selectedPlayer = selectedId ? PLAYER_BY_ID[selectedId] : null;
  const changedThisBreak = state.seriesStatus === "break" && state.breakOriginalSelections && state.breakOriginalSelections[slot.id] && state.breakOriginalSelections[slot.id] !== selectedId;

  return `
    <article class="slot-row ${selectedPlayer ? "filled" : "empty"} ${changedThisBreak ? "break-changed" : ""}">
      <span class="slot-index">${index + 1}</span>
      <span class="slot-title">
        <strong>${slot.label}</strong>
        <em>${changedThisBreak ? "Changed this break" : selectedPlayer ? "Locked" : describeSlot(slot)}</em>
      </span>
      <span class="slot-player">
        ${selectedPlayer ? `<strong>${selectedPlayer.name}</strong><em>${selectedPlayer.country}, ${getSelectionDecadeLabel(selectedPlayer, slot.id)}</em>` : "<strong>Empty</strong><em>Spin for this position</em>"}
      </span>
      <span class="player-chips">
        ${selectedPlayer ? renderPlayerChips(selectedPlayer, slot.id) : "<i>No player selected</i>"}
      </span>
    </article>
  `;
}

function renderPlayerChips(player, slotId, metaOverride = null) {
  const meta = metaOverride || state.selectionMeta[slotId];
  const tags = [
    meta ? `${meta.country} ${meta.decade}s spin` : `${player.country} ${getPlayerDecadeLabel(player)}`,
    isSpinner(player) ? "Spin" : null,
    isPace(player) ? "Pace" : null
  ].filter(Boolean);

  return tags.map((tag) => `<b>${tag}</b>`).join("") || "<i>Wildcard pick</i>";
}

function getPlayerDecades(player) {
  return Array.isArray(player.decades) && player.decades.length ? player.decades : [player.decade];
}

function isPlayerInOffer(player, offer) {
  return Boolean(player && offer && player.country === offer.country && getPlayerDecades(player).includes(Number(offer.decade)));
}

function getPlayerDecadeLabel(player, offer = null) {
  if (offer && isPlayerInOffer(player, offer)) return `${offer.decade}s`;
  const decades = getPlayerDecades(player).filter((decade) => Number.isFinite(Number(decade))).sort((a, b) => a - b);
  if (!decades.length) return `${player.decade}s`;
  if (decades.length === 1) return `${decades[0]}s`;
  return `${decades[0]}s-${decades[decades.length - 1]}s`;
}

function getSelectionDecadeLabel(player, slotId) {
  const meta = state.selectionMeta[slotId];
  return meta && isPlayerInOffer(player, meta) ? `${meta.decade}s` : getPlayerDecadeLabel(player);
}

function renderResults() {
  if (!state.results.length) return "";

  const validation = validateSelections();
  const inBreak = state.seriesStatus === "break";
  const activeMatchIndex = state.activeMatchIndex || state.results[state.results.length - 1].index;
  const activeMatch = state.results.find((result) => result.index === activeMatchIndex) || state.results[state.results.length - 1];
  const latestMatch = state.results[state.results.length - 1];
  const latestLive = latestMatch && !isMatchReplayComplete(latestMatch);
  const completedResults = latestLive ? state.results.slice(0, -1) : state.results;
  const completedOutrights = completedResults.filter((result) => result.outright).length;
  const resultSummary = completedResults.length ? getSeriesChallengeSummary(completedResults) : null;
  const seriesSummary = state.seriesStatus === "complete" && !latestLive ? getSeriesSummary(state.results) : null;

  return `
    <section id="results" class="results-shell">
      <div class="results-head">
        <div>
          <p class="eyebrow">Series result</p>
          <h2>${latestLive ? `Test ${latestMatch.index} in progress` : state.seriesStatus === "complete" ? resultSummary.title : `Test ${state.results.length} complete`}</h2>
          <p>${latestLive ? "Watch the wicket replay to reveal the match. The result is hidden until the final wicket is shown." : state.seriesStatus === "complete" ? resultSummary.context : `${completedOutrights}/${completedResults.length} innings wins after ${completedResults.length} of ${state.seriesLength} ${state.seriesLength === 1 ? "Test" : "Tests"}. You need an innings win in every match.`}</p>
        </div>
        <button class="secondary-btn" type="button" data-action="play-series">${state.seriesStatus === "complete" ? "Replay Same XI" : "Restart Series"}</button>
      </div>
      ${state.shareMessage ? `<p class="share-message">${state.shareMessage}</p>` : ""}
      ${inBreak && isLatestPlaybackComplete() ? renderMatchBreak(validation) : ""}
      ${renderMatchTabs(activeMatch.index)}
      ${renderMatchResult(activeMatch)}
      ${inBreak && isLatestPlaybackComplete() && activeMatch.index === latestMatch.index ? renderBottomBreakActions(validation) : ""}
      ${seriesSummary ? renderSeriesSummary(seriesSummary) : ""}
    </section>
  `;
}

function renderMatchTabs(activeMatchIndex) {
  return `
    <nav class="match-tabs" aria-label="Test match scorecards">
      ${state.results.map((match) => `
        <button class="match-tab ${match.index === activeMatchIndex ? "active" : ""}" type="button" data-action="show-match" data-match-index="${match.index}">
          <span>Test ${match.index}</span>
          ${isMatchReplayComplete(match) ? `<b class="${match.outright ? "win" : match.winner === "draw" || match.winner === "user" ? "draw" : "loss"}">${match.outright ? "Innings" : match.winner === "draw" ? "Draw" : match.winner === "user" ? "Win" : "Lost"}</b>` : `<b class="live">Live</b>`}
        </button>
      `).join("")}
    </nav>
  `;
}

function renderMatchBreak(validation) {
  const playbackDone = isLatestPlaybackComplete();
  const respinWord = state.breakChangesRemaining === 1 ? "respin" : "respins";
  return `
    <div class="match-break">
      <div class="match-break-head">
        <div>
          <p class="eyebrow">Between Tests</p>
          <h3>Choose up to 2 position respins</h3>
          <p>${playbackDone ? `${state.breakChangesRemaining} of 2 position ${respinWord} remaining. Each new player can replace one occupied position, or you can continue unchanged.` : "The next Test unlocks after every wicket has been shown."}</p>
        </div>
        <div class="break-respin-count" aria-label="${state.breakChangesRemaining} of 2 position respins remaining">
          <strong>${state.breakChangesRemaining}</strong>
          <span>of 2 left</span>
        </div>
        <button class="play-btn" type="button" data-action="continue-series" ${validation.ok && playbackDone ? "" : "disabled"}>Play Next Test</button>
      </div>
      <div class="match-break-respin">
        ${renderSpinPanel(state.currentOffer, validation)}
      </div>
    </div>
  `;
}

function renderBottomBreakActions(validation) {
  const respinLabel = state.breakChangesRemaining === 1 ? "1 respin left" : `${state.breakChangesRemaining} respins left`;
  return `
    <div class="bottom-break-actions">
      <div>
        <p class="eyebrow">Between Tests</p>
        <strong>Ready for the next match?</strong>
      </div>
      <div class="bottom-break-buttons">
        <button class="secondary-btn" type="button" data-action="jump-to-respins" ${state.breakChangesRemaining > 0 ? "" : "disabled"}>Use Respins - ${respinLabel}</button>
        <button class="play-btn" type="button" data-action="continue-series" ${validation.ok ? "" : "disabled"}>Play Next Test</button>
      </div>
    </div>
  `;
}

function isLatestPlaybackComplete() {
  const latest = state.results[state.results.length - 1];
  if (!latest) return true;
  return isMatchReplayComplete(latest);
}

function isMatchReplayComplete(match) {
  if (!match) return true;
  if (state.playback.matchIndex !== match.index) return true;
  return state.playback.visibleCount >= match.wicketEvents.length;
}

function renderMatchResult(match) {
  const wicketEvents = getVisibleWicketEvents(match);
  const replayComplete = isMatchReplayComplete(match);
  const badgeClass = match.outright ? "win" : match.winner === "draw" || match.winner === "user" ? "draw" : "loss";
  const badgeText = match.outright ? "Innings win" : match.winner === "draw" ? "Draw" : match.winner === "user" ? "Win, not outright" : "Opponent win";
  const matchSummary = replayComplete ? getMatchSummary(match) : null;
  return `
    <article class="match-card">
      <div class="match-head">
        <div>
          <span class="mini-label">Test ${match.index}</span>
          <h3>${replayComplete ? match.resultText : `Test ${match.index} in progress`}</h3>
          <p>${match.venue.ground.name}, ${match.venue.ground.city} - ${match.condition.pitchName}, ${match.condition.weather}</p>
        </div>
        <div class="match-actions">
          <div class="match-badge ${replayComplete ? badgeClass : "live"}">${replayComplete ? badgeText : "Live replay"}</div>
          ${replayComplete ? renderShareActions("match", match.index) : `<button class="share-btn skip-replay-btn" type="button" data-action="skip-replay" data-match-index="${match.index}">Skip simulation</button>`}
        </div>
      </div>
      ${matchSummary ? renderMatchScoreboard(matchSummary) : ""}
      <div class="weather-strip">
        ${match.condition.days.map((day) => `<span>Day ${day.day}: ${day.weather}, ${day.lostOvers} overs lost</span>`).join("")}
      </div>
      ${renderWicketFeed(match, wicketEvents)}
    </article>
  `;
}

function getVisibleWicketEvents(match) {
  if (state.playback.matchIndex === match.index) {
    return match.wicketEvents.slice(0, state.playback.visibleCount);
  }
  return match.wicketEvents;
}

function renderWicketFeed(match, wicketEvents) {
  const total = match.wicketEvents.length;
  const remaining = total - wicketEvents.length;
  return `
    <section id="wicket-replay" class="wicket-feed">
      <div class="wicket-feed-head">
        <strong>Wicket replay</strong>
        <span>${wicketEvents.length}/${total} wickets shown${remaining > 0 ? `, ${remaining} to come` : ""}</span>
      </div>
      <div class="wicket-list scorecard-scroll">
        ${wicketEvents.length ? `
          <table class="wicket-table">
            <thead>
              <tr>
                <th>Wkt</th>
                <th>Batter</th>
                <th>Score</th>
                <th>How out</th>
                <th>FOW</th>
                <th>Ov</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${wicketEvents.map((event, index) => `
                ${index === 0 || wicketEvents[index - 1].inningsLabel !== event.inningsLabel ? `<tr class="wicket-innings-row innings-${event.teamId}"><td colspan="7">${event.inningsLabel}</td></tr>` : ""}
                <tr class="innings-${event.teamId} ${index === wicketEvents.length - 1 ? "latest-wicket-row" : ""} ${Number(event.batterRuns) >= 100 ? "milestone-row century-row" : ""}">
                  <td>${event.wicket}</td>
                  <td>${event.batter}</td>
                  <td>${event.batterRuns}</td>
                  <td>${event.how}</td>
                  <td>${event.wicket}-${event.score}</td>
                  <td>${formatOvers(event.over)}</td>
                  <td>${isFinalVisibleInningsWicket(match, event) ? `${event.inningsTotal}/${event.inningsWickets}${event.inningsWickets === 10 ? " ao" : ""}` : ""}</td>
                </tr>
                ${isFinalVisibleInningsWicket(match, event) ? renderReplayInningsClose(match, event, index === wicketEvents.length - 1) : ""}
              `).join("")}
            </tbody>
          </table>
        ` : "<p>Wickets will appear here as the match plays out.</p>"}
      </div>
    </section>
  `;
}

function isFinalVisibleInningsWicket(match, event) {
  const fullIndex = match.wicketEvents.indexOf(event);
  if (fullIndex === -1) return false;
  const next = match.wicketEvents[fullIndex + 1];
  return !next || next.inningsLabel !== event.inningsLabel;
}

function renderReplayInningsClose(match, event, isLatest) {
  const innings = match.innings[event.inningsIndex];
  if (!innings) return "";
  const notOutRows = innings.batting
    .filter((row) => row.how === "not out" && Number.isFinite(Number(row.runs)))
    .map((row) => `
      <tr class="innings-${innings.teamId} innings-not-out-row">
        <td>-</td>
        <td>${row.name}</td>
        <td>${row.runs}</td>
        <td>not out</td>
        <td>-</td>
        <td>-</td>
        <td>${innings.score}/${innings.wickets}${innings.wickets === 10 ? " ao" : ""}</td>
      </tr>
    `).join("");

  return `
    ${notOutRows}
    <tr class="innings-bowling-row ${isLatest ? "latest-replay-row" : ""}">
      <td colspan="7">
        <div class="bowling-summary">
          <div class="bowling-summary-head">
            <strong>Bowling summary</strong>
            <span>${innings.teamName} innings</span>
          </div>
          <table class="bowling-summary-table">
            <thead>
              <tr>
                <th>Bowler</th>
                <th><span class="wide-column-label">Overs</span><span class="compact-column-label">O</span></th>
                <th><span class="wide-column-label">Maidens</span><span class="compact-column-label">M</span></th>
                <th><span class="wide-column-label">Runs</span><span class="compact-column-label">R</span></th>
                <th><span class="wide-column-label">Wickets</span><span class="compact-column-label">W</span></th>
                <th><span class="wide-column-label">Economy</span><span class="compact-column-label">Econ</span></th>
              </tr>
            </thead>
            <tbody>
              ${innings.bowling.map((row) => `
                <tr class="${row.wickets >= 5 ? "milestone-row fivefor-row" : ""}">
                  <td>${row.name}</td>
                  <td>${formatOvers(row.overs)}</td>
                  <td>${row.maidens}</td>
                  <td>${row.runs}</td>
                  <td>${row.wickets}</td>
                  <td>${row.overs > 0 ? (row.runs / row.overs).toFixed(2) : "0.00"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  `;
}

function renderInnings(innings) {
  const battingRows = innings.batting.map((row) => {
    const isCentury = Number(row.runs) >= 100;
    return `<tr class="${isCentury ? "milestone-row century-row" : ""}"><td>${row.name}</td><td>${row.runs}</td><td>${row.how}</td></tr>`;
  }).join("");
  const bowlingRows = innings.bowling.map((row) => {
    const isFiveFor = row.wickets >= 5;
    return `<tr class="${isFiveFor ? "milestone-row fivefor-row" : ""}"><td>${row.name}</td><td>${formatOvers(row.overs)}</td><td>${row.maidens}</td><td>${row.runs}</td><td>${row.wickets}</td></tr>`;
  }).join("");

  return `
    <section class="innings-card innings-${innings.teamId}">
      <div class="innings-title">
        <strong>${innings.teamName}</strong>
        <span>${innings.score}/${innings.wickets}${innings.wickets === 10 ? " all out" : ""} (${formatOvers(innings.overs)} ov)</span>
      </div>
      <table>
        <thead>
          <tr><th>Batter</th><th>R</th><th>How out</th></tr>
        </thead>
        <tbody>
          ${battingRows}
          <tr class="extras-row"><td>Extras</td><td>${innings.extras}</td><td>${innings.status}</td></tr>
        </tbody>
      </table>
      <div class="fow">
        <strong>Fall of wickets</strong>
        <p>${innings.fow.length ? innings.fow.map((item) => `${item.wicket}-${item.score} (${item.batter}, ${formatOvers(item.over)} ov)`).join("; ") : "No wickets"}</p>
      </div>
      <table>
        <thead>
          <tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th></tr>
        </thead>
        <tbody>
          ${bowlingRows}
        </tbody>
      </table>
    </section>
  `;
}

function renderShareActions(kind, matchIndex = "") {
  const label = kind === "series" ? "series" : "match";
  return `
    <div class="share-actions" aria-label="Share ${label} result">
      <button class="share-btn" type="button" data-action="copy-${kind}-image" ${matchIndex ? `data-match-index="${matchIndex}"` : ""}>Copy image</button>
      <button class="share-btn" type="button" data-action="download-${kind}-image" ${matchIndex ? `data-match-index="${matchIndex}"` : ""}>Download image</button>
    </div>
  `;
}

function renderMatchScoreboard(summary) {
  return `
    <div class="match-scoreboard">
      <div class="scoreboard-title">
        <strong>Match summary</strong>
        <span>${summary.resultText}</span>
      </div>
      <div class="scoreboard-innings-list">
        ${summary.innings.map(renderScoreboardInnings).join("")}
      </div>
      <div class="scoreboard-result">${summary.resultText}</div>
    </div>
  `;
}

function renderScoreboardInnings(innings) {
  return `
    <section class="scoreboard-innings innings-${innings.teamId}">
      <div class="scoreboard-team">
        <strong>${innings.teamName}</strong>
        <b>${innings.total}</b>
        <span>${innings.inningsLabel}</span>
      </div>
      <div class="scoreboard-columns">
        <div>
          ${innings.batters.map((row) => `
            <p class="${row.runs >= 100 ? "summary-milestone" : ""}"><span>${row.name}</span><b>${row.runs}${row.notOut ? "*" : ""}</b></p>
          `).join("") || "<p><span>No standout batting</span><b>-</b></p>"}
        </div>
        <div>
          ${innings.bowlers.map((row) => `
            <p class="${row.wickets >= 5 ? "summary-milestone" : ""}"><span>${row.name}</span><b>${row.wickets}-${row.runs}</b></p>
          `).join("") || "<p><span>No wicket takers</span><b>-</b></p>"}
        </div>
      </div>
    </section>
  `;
}

function renderSeriesSummary(summary) {
  return `
    <article class="series-summary">
      <div class="series-summary-head">
        <div>
          <p class="eyebrow">Series summary</p>
          <h3>${summary.overall}</h3>
          <p>${summary.context}</p>
        </div>
        ${renderShareActions("series")}
      </div>
      <div class="series-player-strip">
        <span class="mini-label">Player of the series</span>
        <strong>${summary.player.name}</strong>
        <p>${summary.player.why}</p>
      </div>
      <div class="series-match-grid">
        ${summary.matchSummaries.map(renderSeriesMatchSummary).join("")}
      </div>
    </article>
  `;
}

function getMatchSummary(match) {
  const batting = collectBattingEfforts([match]).sort((a, b) => b.runs - a.runs);
  const bowling = collectBowlingEfforts([match]).sort((a, b) => b.wickets - a.wickets || a.runs - b.runs);
  const teamInnings = {};
  const innings = match.innings.map((entry) => {
    teamInnings[entry.teamId] = (teamInnings[entry.teamId] || 0) + 1;
    return {
      teamName: entry.teamName,
      teamId: entry.teamId,
      total: formatInningsTotalShort(entry),
      inningsLabel: teamInnings[entry.teamId] === 1 ? "First innings" : "Second innings",
      batters: entry.batting
        .filter((row) => Number.isFinite(Number(row.runs)))
        .map((row) => ({ name: row.name, runs: Number(row.runs), notOut: row.how === "not out" }))
        .sort((a, b) => b.runs - a.runs)
        .slice(0, 4),
      bowlers: entry.bowling
        .filter((row) => row.wickets > 0)
        .map((row) => ({ name: row.name, wickets: row.wickets, runs: row.runs }))
        .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
        .slice(0, 4)
    };
  });
  const inningsLine = innings.map((entry) => `${entry.teamName} ${entry.total}`).join(" | ");
  return {
    inningsLine,
    topScore: batting[0] || null,
    topBowling: bowling[0] || null,
    innings,
    resultText: match.resultText,
    matchIndex: match.index
  };
}

function renderSeriesMatchSummary(summary) {
  return `
    <section class="series-match-card">
      <div class="series-match-card-head">
        <span>Test ${summary.matchIndex}</span>
        <strong>${summary.resultText}</strong>
      </div>
      <div class="series-innings-lines">
        ${summary.innings.map((innings) => `
          <p><span>${innings.teamName} ${innings.inningsLabel.replace(" innings", "")}</span><b>${innings.total}</b></p>
        `).join("")}
      </div>
      <div class="series-key-efforts">
        <p class="${summary.topScore?.runs >= 100 ? "summary-milestone" : ""}">${summary.topScore ? `Bat: ${summary.topScore.name} ${summary.topScore.runs}` : "Bat: -"}</p>
        <p class="${summary.topBowling?.wickets >= 5 ? "summary-milestone" : ""}">${summary.topBowling ? `Bowl: ${summary.topBowling.name} ${summary.topBowling.wickets}-${summary.topBowling.runs}` : "Bowl: -"}</p>
      </div>
    </section>
  `;
}

function formatInningsTotalShort(innings) {
  return innings.wickets >= 10 ? `${innings.score}` : `${innings.wickets}-${innings.score}`;
}

function getSeriesChallengeSummary(matches) {
  const inningsWins = matches.filter((match) => match.outright).length;
  const allOutright = matches.length === state.seriesLength && inningsWins === state.seriesLength;
  const record = getSeriesRecord(matches);
  const testWord = matches.length === 1 ? "Test" : "Tests";
  const inningsPhrase = `${inningsWins}/${matches.length} ${testWord} ${inningsWins === 1 ? "was" : "were"} won by an innings`;

  if (allOutright) {
    return {
      title: "Invincible run complete",
      context: `${record.line}. All ${state.seriesLength} ${state.seriesLength === 1 ? "Test was" : "Tests were"} won by an innings.`
    };
  }

  return {
    title: `${record.title}, challenge missed`,
    context: `${record.line}, but only ${inningsPhrase}, so the Invincible challenge was not met.`
  };
}

function getSeriesRecord(matches) {
  const userWins = matches.filter((match) => match.winner === "user").length;
  const opponentWins = matches.filter((match) => match.winner === "opponent").length;
  const draws = matches.filter((match) => match.winner === "draw").length;
  const drawText = draws ? ` with ${draws} draw${draws === 1 ? "" : "s"}` : "";
  const score = `${userWins}-${opponentWins}${drawText}`;

  if (userWins > opponentWins) {
    return {
      title: "Series won",
      line: `Invincible XI won the series ${score}`
    };
  }
  if (userWins < opponentWins) {
    return {
      title: "Series lost",
      line: `Invincible XI lost the series ${score}`
    };
  }
  return {
    title: "Series drawn",
    line: `Invincible XI drew the series ${score}`
  };
}

function getSeriesSummary(matches) {
  const inningsWins = matches.filter((match) => match.outright).length;
  const challengeSummary = getSeriesChallengeSummary(matches);
  const batting = collectBattingEfforts(matches);
  const bowling = collectBowlingEfforts(matches);
  const player = pickPlayerOfSeries(batting, bowling);
  const majorScores = batting
    .filter((effort) => effort.runs >= 100)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 5);
  const majorBowling = bowling
    .filter((effort) => effort.wickets >= 5)
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
    .slice(0, 5);

  return {
    overall: challengeSummary.title,
    context: `${challengeSummary.context} Opponent: ${state.scenario.opponent.name}.`,
    player,
    majorScores: majorScores.length ? majorScores : batting.sort((a, b) => b.runs - a.runs).slice(0, 3),
    majorBowling: majorBowling.length ? majorBowling : bowling.sort((a, b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 3),
    matchSummaries: matches.map(getMatchSummary),
    matches
  };
}

function collectBattingEfforts(matches) {
  return matches.flatMap((match) => match.innings.flatMap((innings) => innings.batting
    .filter((row) => Number.isFinite(Number(row.runs)))
    .map((row) => ({
      name: row.name,
      teamName: innings.teamName,
      teamId: innings.teamId,
      matchIndex: match.index,
      runs: Number(row.runs),
      how: row.how
    }))));
}

function collectBowlingEfforts(matches) {
  return matches.flatMap((match) => match.innings.flatMap((innings) => innings.bowling
    .filter((row) => row.wickets > 0)
    .map((row) => ({
      name: row.name,
      teamName: innings.teamId === "user" ? state.scenario.opponent.name : "Invincible XI",
      bowlingTo: innings.teamName,
      matchIndex: match.index,
      wickets: row.wickets,
      runs: row.runs,
      overs: row.overs
    }))));
}

function pickPlayerOfSeries(batting, bowling) {
  const players = new Map();
  for (const effort of batting) {
    const item = players.get(effort.name) || { name: effort.name, runs: 0, wickets: 0, centuries: 0, fiveFors: 0, highest: 0, bestWickets: 0, bestRuns: 999 };
    item.runs += effort.runs;
    item.centuries += effort.runs >= 100 ? 1 : 0;
    item.highest = Math.max(item.highest, effort.runs);
    players.set(effort.name, item);
  }
  for (const effort of bowling) {
    const item = players.get(effort.name) || { name: effort.name, runs: 0, wickets: 0, centuries: 0, fiveFors: 0, highest: 0, bestWickets: 0, bestRuns: 999 };
    item.wickets += effort.wickets;
    item.fiveFors += effort.wickets >= 5 ? 1 : 0;
    if (effort.wickets > item.bestWickets || effort.wickets === item.bestWickets && effort.runs < item.bestRuns) {
      item.bestWickets = effort.wickets;
      item.bestRuns = effort.runs;
    }
    players.set(effort.name, item);
  }
  const ranked = [...players.values()].map((player) => ({
    ...player,
    points: player.runs / 7 + player.wickets * 24 + player.centuries * 24 + player.fiveFors * 34
  })).sort((a, b) => b.points - a.points);
  const winner = ranked[0] || { name: "No standout", runs: 0, wickets: 0, centuries: 0, fiveFors: 0, highest: 0, bestWickets: 0, bestRuns: 0 };
  const why = winner.runs >= 180 && winner.wickets >= 8
    ? `${winner.runs} runs and ${winner.wickets} wickets across the series.`
    : winner.wickets > winner.runs / 18
      ? `${winner.wickets} wickets${winner.fiveFors ? ` with ${winner.fiveFors} five-wicket haul${winner.fiveFors === 1 ? "" : "s"}` : ""}.`
      : `${winner.runs} runs${winner.centuries ? ` with ${winner.centuries} hundred${winner.centuries === 1 ? "" : "s"}` : ""}.`;
  return { ...winner, why };
}

function formatBattingEffort(effort) {
  return `${effort.name} ${effort.runs} (${effort.teamName}, Test ${effort.matchIndex})`;
}

function formatBowlingEffort(effort) {
  return `${effort.name} ${effort.wickets}/${effort.runs} (Test ${effort.matchIndex})`;
}

async function shareResultImage(kind, mode, matchIndex = null) {
  try {
    const canvas = kind === "match"
      ? createMatchShareCanvas(state.results.find((match) => match.index === matchIndex))
      : createSeriesShareCanvas(getSeriesSummary(state.results));
    if (!canvas) return;
    const filename = kind === "match" ? `test-match-invincible-test-${matchIndex}.png` : "test-match-invincible-series.png";

    if (mode === "copy") {
      try {
        await copyCanvasImage(canvas);
        state.shareMessage = "Result image copied to clipboard.";
      } catch (error) {
        await downloadCanvasImage(canvas, filename);
        state.shareMessage = "Clipboard image copy is not available here, so the image was downloaded instead.";
      }
    } else {
      await downloadCanvasImage(canvas, filename);
      state.shareMessage = "Result image downloaded.";
    }
  } catch (error) {
    state.shareMessage = "Could not create the result image in this browser.";
  }
  render();
}

function createMatchShareCanvas(match) {
  if (!match) return null;
  const summary = getMatchSummary(match);
  const lines = [
    match.resultText,
    `${match.venue.ground.name}, ${match.venue.ground.city}`,
    summary.inningsLine,
    summary.topScore ? `Top score: ${formatBattingEffort(summary.topScore)}` : "",
    summary.topBowling ? `Best bowling: ${formatBowlingEffort(summary.topBowling)}` : ""
  ].filter(Boolean);
  return createResultImageCanvas({
    eyebrow: "Test Match Invincible",
    title: `Test ${match.index}: ${match.outright ? "Innings win" : match.winner === "user" ? "Win, not outright" : match.winner === "draw" ? "Draw" : "Opponent win"}`,
    lines
  });
}

function createSeriesShareCanvas(summary) {
  if (!summary) return null;
  const lines = [
    summary.context,
    `Player of the series: ${summary.player.name}`,
    summary.player.why,
    ...summary.matchSummaries.slice(0, 5).map((match) => `Test ${match.matchIndex}: ${match.inningsLine}`)
  ];
  return createResultImageCanvas({
    eyebrow: "Test Match Invincible",
    title: summary.overall,
    lines
  });
}

function createResultImageCanvas({ eyebrow, title, lines }) {
  const canvas = document.createElement("canvas");
  const width = 1200;
  const height = 630;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#07120d";
  context.fillRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(183, 244, 93, 0.24)");
  gradient.addColorStop(0.55, "rgba(88, 183, 255, 0.12)");
  gradient.addColorStop(1, "rgba(211, 74, 63, 0.16)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(231, 255, 235, 0.26)";
  context.lineWidth = 3;
  context.strokeRect(34, 34, width - 68, height - 68);

  context.fillStyle = "#b7f45d";
  context.font = "700 30px Arial, sans-serif";
  context.fillText(eyebrow, 70, 100);
  context.fillStyle = "#f3fff5";
  context.font = "900 58px Arial, sans-serif";
  drawWrappedCanvasText(context, title, 70, 172, width - 140, 66, 2);

  context.font = "700 30px Arial, sans-serif";
  let y = 300;
  for (const line of lines) {
    context.fillStyle = line.includes("Player of the series") || line.includes("Top score") || line.includes("Best bowling") ? "#f6cf62" : "#e6f7e7";
    y = drawWrappedCanvasText(context, line, 70, y, width - 140, 40, 2) + 22;
    if (y > height - 82) break;
  }

  context.fillStyle = "rgba(7, 18, 13, 0.72)";
  context.fillRect(70, height - 78, width - 140, 34);
  context.fillStyle = "#b9cbbc";
  context.font = "700 20px Arial, sans-serif";
  context.fillText("brent-clark.com | Prototype result card", 86, height - 55);
  return canvas;
}

function drawWrappedCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).split(" ");
  let line = "";
  let lines = 0;
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(lines === maxLines - 1 && index < words.length - 1 ? `${line}...` : line, x, y);
      y += lineHeight;
      lines += 1;
      line = word;
      if (lines >= maxLines) return y;
    } else {
      line = testLine;
    }
  }
  if (line && lines < maxLines) {
    context.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No image blob")), "image/png");
  });
}

async function copyCanvasImage(canvas) {
  const blob = await canvasToBlob(canvas);
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard images are not supported");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

async function downloadCanvasImage(canvas, filename) {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createScenario() {
  const opponent = randomItem(DATA.historicalTeams);
  const hostCountry = opponent.country;
  const grounds = createVenuesForCountry(hostCountry);

  return { hostCountry, opponent, venues: grounds };
}

function createVenuesForCountry(country) {
  const homeGrounds = DATA.grounds.filter((ground) => ground.country === country);
  const available = homeGrounds.length ? shuffle(homeGrounds) : shuffle(DATA.grounds);
  return Array.from({ length: 5 }, (_, index) => {
    const ground = available[index % available.length];
    return {
      ground,
      condition: createCondition(ground, index)
    };
  });
}

function createCondition(ground, index) {
  const variants = [
    { name: "Green first morning", pace: 0.13, spin: -0.05, batting: -0.07, rain: 0.03 },
    { name: "Hard and true", pace: 0.02, spin: -0.02, batting: 0.10, rain: -0.02 },
    { name: "Dry turner", pace: -0.09, spin: 0.18, batting: -0.05, rain: -0.03 },
    { name: "Slow wearing pitch", pace: -0.03, spin: 0.11, batting: -0.02, rain: 0 },
    { name: "Cracked fifth-day surface", pace: 0.04, spin: 0.14, batting: -0.10, rain: -0.01 }
  ];
  const variant = randomItem(variants);
  const weather = randomItem(ground.weather);
  const weatherRain = weather.includes("showers") || weather.includes("storm") ? 0.16 : weather.includes("Overcast") || weather.includes("cloud") ? 0.08 : -0.03;
  const settledDry = /^(Bright|Hot and dry|Dry breeze|Dry heat|Hazy sun|Cool evening)$/i.test(weather);
  const rainChance = settledDry ? 0 : clamp(ground.rain + variant.rain + weatherRain, 0.02, 0.58);
  const dryWeather = ground.weather.filter((label) => !/(rain|shower|storm|thunder)/i.test(label));
  const days = Array.from({ length: 5 }, (_, dayIndex) => {
    const wet = rainChance > 0 && Math.random() < rainChance + dayIndex * 0.015;
    const heavy = wet && Math.random() < rainChance * 0.75;
    const lostOvers = wet ? Math.round(randomBetween(8, heavy ? 48 : 24)) : 0;
    return {
      day: dayIndex + 1,
      weather: wet ? (heavy ? "rain suspension" : "passing showers") : randomItem(dryWeather.length ? dryWeather : ["Bright"]),
      lostOvers
    };
  });

  return {
    pitchName: variant.name,
    weather,
    pace: clamp(ground.pace + variant.pace, 0.72, 1.45),
    spin: clamp(ground.spin + variant.spin, 0.70, 1.50),
    batting: clamp(ground.batting + variant.batting, 0.78, 1.25),
    rainChance,
    rainLost: days.reduce((total, day) => total + day.lostOvers, 0),
    days,
    index
  };
}

function getFormation() {
  return DATA.formations.find((formation) => formation.id === state.formationId) || DATA.formations[0];
}

function getActiveSlot() {
  const formation = getFormation();
  return formation.slots.find((slot) => slot.id === state.currentSlotId) || formation.slots[0];
}

function spinPlayerOffer() {
  if (!canSpinPlayerOffer()) return;
  state.currentOffer = createPlayerOffer();
}

function canUsePlayerSpinPhase(validation = validateSelections()) {
  const breakReady = isBreakChangeWindow();
  const draftOpen = state.seriesStatus === "draft" && !state.results.length;
  return draftOpen ? !validation.ok : breakReady && state.breakChangesRemaining > 0;
}

function canSpinPlayerOffer(validation = validateSelections()) {
  return canUsePlayerSpinPhase(validation) && !state.currentOffer;
}

function canRerollPlayerOffer(validation = validateSelections()) {
  return Boolean(state.currentOffer) && state.rerollsRemaining > 0 && canUsePlayerSpinPhase(validation);
}

function rerollPlayerOffer() {
  if (!canRerollPlayerOffer()) return;
  state.currentOffer = createPlayerOffer();
  state.rerollsRemaining = Math.max(0, state.rerollsRemaining - 1);
}

function createPlayerOffer() {
  const used = new Set(Object.values(state.selections));
  const combos = shuffle(getOfferCombos());
  const combo = combos[0] || { country: randomItem(DATA.countries), decade: randomItem(DATA.decades) };
  const candidates = buildOfferCandidates(combo, used);

  return {
    country: combo.country,
    decade: combo.decade,
    candidates
  };
}

function getOfferCombos() {
  const seen = new Set();
  return DATA.players
    .flatMap((player) => getPlayerDecades(player).map((decade) => ({ country: player.country, decade })))
    .filter((combo) => {
      const key = `${combo.country}-${combo.decade}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildOfferCandidates(combo, used) {
  const pickedIds = new Set(used);

  return DATA.players
    .filter((player) => !pickedIds.has(player.id))
    .filter((player) => isPlayerInOffer(player, combo))
    .filter((player) => getOfferSlots(player).length)
    .sort((a, b) => offerPlayerScore(b, combo) - offerPlayerScore(a, combo));
}

function offerPlayerScore(player, combo) {
  const exact = isPlayerInOffer(player, combo) ? 80 : 0;
  const sameCountry = player.country === combo.country ? 30 : 0;
  const eraFit = getPlayerDecades(player).includes(combo.decade) ? 30 : 0;
  return exact + sameCountry + eraFit + Math.max(player.bat, player.bowl, player.keep || 0);
}

function draftOfferedPlayer(playerId, slotId) {
  const offer = state.currentOffer;
  if (!offer || !offer.candidates.some((player) => player.id === playerId)) return;

  const player = PLAYER_BY_ID[playerId];
  const slot = getFormation().slots.find((item) => item.id === slotId);
  const breakReady = isBreakChangeWindow();
  if (!player || !slot || !isEligible(player, slot)) return;
  if (!isPlayerInOffer(player, offer)) return;
  if (state.selections[slotId] && !breakReady) return;
  if (breakReady && state.breakChangesRemaining <= 0) return;
  if (breakReady && !state.selections[slotId]) return;
  if (Object.entries(state.selections).some(([currentSlotId, selectedId]) => currentSlotId !== slotId && selectedId === playerId)) return;

  state.selections[slotId] = player.id;
  state.selectionMeta[slotId] = {
    country: offer.country,
    decade: offer.decade
  };
  state.currentSlotId = slotId;
  state.currentOffer = null;
  if (breakReady) {
    state.breakChangesRemaining = Math.max(0, state.breakChangesRemaining - 1);
  }
}

function getOfferSlots(player) {
  const breakReady = isBreakChangeWindow();
  return getFormation().slots.filter((slot) => {
    if (!breakReady && state.selections[slot.id]) return false;
    if (breakReady && !state.selections[slot.id]) return false;
    if (breakReady && state.breakOriginalSelections?.[slot.id] !== state.selections[slot.id]) return false;
    if (!isEligible(player, slot)) return false;
    const selectedElsewhere = Object.entries(state.selections).some(([slotId, playerId]) => slotId !== slot.id && playerId === player.id);
    if (selectedElsewhere) return false;
    return true;
  });
}

function isBreakChangeWindow() {
  return state.seriesStatus === "break" && isLatestPlaybackComplete();
}

function eligiblePlayers(slot) {
  return DATA.players
    .filter((player) => isEligible(player, slot))
    .sort((a, b) => playerPickScore(b, slot) - playerPickScore(a, slot));
}

function isEligible(player, slot) {
  if (slot.kind === "bat") return player.roles.includes("bat") || player.roles.includes("allrounder") || player.roles.includes("keeper");
  if (slot.kind === "keeper") return player.roles.includes("keeper");
  if (slot.kind === "allrounder") return player.roles.includes("allrounder");
  if (slot.kind === "spinner") return isSpinner(player) && player.bowl >= 55;
  if (slot.kind === "pace") return isPace(player) && player.bowl >= 58;
  if (slot.kind === "bowler") return player.bowl >= 62 && (player.roles.includes("bowler") || player.roles.includes("spinner") || player.roles.includes("allrounder"));
  return true;
}

function playerPickScore(player, slot, offer = null) {
  const condition = averageCondition();
  let score = player.bat;

  if (slot.kind === "keeper") score = player.keep * 0.62 + player.bat * 0.54;
  if (slot.kind === "allrounder") score = player.bat * 0.52 + player.bowl * 0.58;
  if (slot.kind === "bowler") score = player.bowl * (isSpinner(player) ? condition.spin : condition.pace) + player.bat * 0.08;
  if (slot.kind === "spinner") score = player.bowl * condition.spin + player.bat * 0.06;
  if (slot.kind === "pace") score = player.bowl * condition.pace + player.bat * 0.06;
  if (slot.tags.includes("opener") && player.tags.includes("opener")) score += 8;
  if (slot.tags.includes("top-order") && player.tags.includes("top-order")) score += 5;
  if (slot.tags.includes("middle-order") && player.tags.includes("middle-order")) score += 4;

  if (offer) {
    score += player.country === offer.country ? 7 : 0;
    const decadeGap = Math.abs(player.decade - offer.decade);
    score += decadeGap === 0 ? 7 : decadeGap <= 10 ? 4 : decadeGap <= 20 ? 2 : 0;
  }
  return score;
}

function describeSlot(slot) {
  if (slot.kind === "spinner") return "specialist spin required";
  if (slot.kind === "pace") return "fast or seam bowling";
  if (slot.kind === "allrounder") return "batting plus bowling value";
  if (slot.kind === "keeper") return "gloves matter";
  if (slot.tags.includes("opener")) return "opening technique preferred";
  return "batting position";
}

function autoPick() {
  const formation = getFormation();
  state.currentOffer = null;

  for (const slot of formation.slots) {
    if (state.selections[slot.id]) continue;
    let offer = null;
    let pick = null;
    const used = new Set(Object.values(state.selections));
    for (const combo of shuffle(getOfferCombos())) {
      const candidates = buildOfferCandidates(combo, used).filter((player) => isEligible(player, slot));
      if (!candidates.length) continue;
      offer = combo;
      pick = candidates[0];
      break;
    }
    if (pick && offer) {
      state.selections[slot.id] = pick.id;
      state.selectionMeta[slot.id] = {
        country: offer.country,
        decade: offer.decade
      };
    }
  }
  state.currentSlotId = formation.slots.find((slot) => !state.selections[slot.id])?.id || null;
}

function validateSelections() {
  const formation = getFormation();
  const selectedIds = formation.slots.map((slot) => state.selections[slot.id]).filter(Boolean);
  const uniqueIds = new Set(selectedIds);
  const players = selectedIds.map((id) => PLAYER_BY_ID[id]).filter(Boolean);
  const spinnerCount = players.filter(isSpinner).length;
  const keeperCount = players.filter((player) => player.roles.includes("keeper")).length;
  const spunCount = formation.slots.filter((slot) => state.selections[slot.id] && state.selectionMeta[slot.id]).length;
  const validSpinCount = formation.slots.filter((slot) => {
    const player = PLAYER_BY_ID[state.selections[slot.id]];
    const meta = state.selectionMeta[slot.id];
    return player && meta && isPlayerInOffer(player, meta);
  }).length;
  const messages = [];

  if (selectedIds.length < 11) messages.push("Pick all 11 players before starting.");
  if (spunCount !== selectedIds.length) messages.push("Every pick must come from a country/decade spin.");
  if (validSpinCount !== selectedIds.length) messages.push("Every picked player must match the spun country and decade.");
  if (uniqueIds.size !== selectedIds.length) messages.push("A player can only be picked once.");
  if (keeperCount < 1) messages.push("Pick a wicket keeper.");

  return {
    ok: messages.length === 0,
    messages,
    selectedCount: selectedIds.length,
    spinnerCount,
    keeperCount
  };
}

function analyseTeam() {
  const formation = getFormation();
  const selectedPlayers = formation.slots.map((slot) => PLAYER_BY_ID[state.selections[slot.id]]).filter(Boolean);
  if (!selectedPlayers.length) return null;

  const topSeven = selectedPlayers.slice(0, 7);
  const keepers = selectedPlayers.filter((player) => player.roles.includes("keeper"));
  const bowlers = selectedPlayers.filter((player) => player.bowl >= 55);
  const paceBowlers = bowlers.filter(isPace);
  const spinBowlers = bowlers.filter(isSpinner);
  const condition = averageCondition();
  const batting = avg(topSeven.map((player) => player.bat)) * condition.batting + avg(selectedPlayers.map((player) => player.temperament)) * 0.08;
  const pace = paceBowlers.length ? avgTop(paceBowlers.map((player) => player.bowl), 4) * condition.pace : 30;
  const spin = spinBowlers.length ? avgTop(spinBowlers.map((player) => player.bowl), 3) * condition.spin : 22;
  const fielding = avg(selectedPlayers.map((player) => player.field));
  const keeper = keepers.length ? Math.max(...keepers.map((player) => player.keep)) : 30;
  const spinFits = formation.slots.filter((slot) => {
    const player = PLAYER_BY_ID[state.selections[slot.id]];
    const meta = state.selectionMeta[slot.id];
    return player && meta && isPlayerInOffer(player, meta);
  }).length;
  const homeExperience = selectedPlayers.filter((player) => player.country === state.scenario.hostCountry).length;
  const chemistry = clamp(spinFits * 0.55 + homeExperience * 0.25, 0, 9);
  const attack = Math.max(pace, spin) * 0.66 + Math.min(pace, spin) * 0.26 + bowlers.length * 0.8;
  const battingCeiling = avgTop(topSeven.map((player) => player.bat), 5);
  const bowlingCeiling = avgTop(bowlers.map((player) => player.bowl), 4);
  const legendCount = selectedPlayers.filter((player) => Math.max(player.bat, player.bowl, player.keep || 0) >= 95).length;
  const bradmanBonus = selectedPlayers.some(isBradman) ? 2.5 : 0;
  const starPower = clamp((battingCeiling - 88) * 0.18 + (bowlingCeiling - 88) * 0.22 + Math.max(0, legendCount - 3) * 0.46 + bradmanBonus, 0, 6);
  const overall = batting * 0.38 + attack * 0.38 + fielding * 0.12 + keeper * 0.06 + chemistry + starPower;

  return {
    players: selectedPlayers,
    slots: formation.slots,
    batting,
    pace,
    spin,
    attack,
    fielding,
    keeper,
    chemistry,
    starPower,
    overall
  };
}

function averageCondition() {
  const venues = state.scenario.venues.slice(0, state.seriesLength).map((entry) => entry.condition);
  return {
    pace: avg(venues.map((item) => item.pace)),
    spin: avg(venues.map((item) => item.spin)),
    batting: avg(venues.map((item) => item.batting)),
    rainLost: avg(venues.map((item) => item.rainLost))
  };
}

function playSeries() {
  const validation = validateSelections();
  if (!validation.ok) return;

  const restartingCompleteSeries = state.seriesStatus === "complete";
  clearPlaybackTimer();
  state.results = [];
  state.seriesStatus = "draft";
  state.breakOriginalSelections = null;
  state.breakChangesRemaining = 0;
  if (restartingCompleteSeries) state.rerollsRemaining = 1;
  playNextMatch();
}

function playNextMatch() {
  const validation = validateSelections();
  if (!validation.ok) return;

  state.currentOffer = null;
  state.breakChangesRemaining = 0;
  const analysis = analyseTeam();
  const matchIndex = state.results.length;
  const venue = state.scenario.venues[matchIndex];
  if (!venue) return;

  const match = simulateMatch(matchIndex + 1, analysis, state.scenario.opponent, venue);
  state.results.push(match);
  state.activeMatchIndex = match.index;

  if (state.results.length < state.seriesLength) {
    state.seriesStatus = "break";
    state.breakOriginalSelections = { ...state.selections };
    state.breakChangesRemaining = 2;
  } else {
    state.seriesStatus = "complete";
    state.breakOriginalSelections = null;
    state.breakChangesRemaining = 0;
  }

  startWicketPlayback(match);
}

function startWicketPlayback(match) {
  clearPlaybackTimer();
  state.playback.matchIndex = match.index;
  state.playback.visibleCount = 0;
  const total = match.wicketEvents.length;

  state.playback.timer = setInterval(() => {
    state.playback.visibleCount += 1;
    if (state.playback.visibleCount >= total) {
      state.playback.visibleCount = total;
      clearPlaybackTimer();
    }
    renderPlaybackFrame();
  }, WICKET_PLAYBACK_MS);
}

function skipWicketPlayback(matchIndex = state.playback.matchIndex) {
  const match = state.results.find((result) => result.index === matchIndex) || state.results.find((result) => result.index === state.playback.matchIndex);
  if (!match) return;
  state.playback.matchIndex = match.index;
  state.playback.visibleCount = match.wicketEvents.length;
  clearPlaybackTimer();
}

function simulateMatch(index, analysis, opponent, venue) {
  const condition = venue.condition;
  const userTeam = makeUserTeam(analysis);
  const opponentTeam = makeOpponentTeam(opponent);
  const opponentConditionAttack = opponent.pace * condition.pace * 0.58 + opponent.spin * condition.spin * 0.42;
  const opponentOverall = opponent.batting * 0.38 + opponentConditionAttack * 0.38 + opponent.fielding * 0.12 + opponent.resilience * 0.12;
  const fatigue = state.seriesLength === 5 ? (index - 1) * 2.4 : state.seriesLength === 3 ? (index - 1) * 1.2 : 0;
  const ratingGap = analysis.overall - opponentOverall - fatigue;
  const modernResultBias = opponent.year >= 2010 ? 0.035 : opponent.year >= 1990 ? 0.02 : opponent.year >= 1970 ? 0.01 : 0;
  const drawChance = clamp(0.085 + condition.rainLost / 380 + Math.max(0, condition.batting - 1) * 0.14 - Math.max(0, analysis.attack + opponentConditionAttack - 175) / 650 - modernResultBias, 0.025, 0.38);
  const eliteBonus = clamp((analysis.overall - 90) * 0.010, 0, 0.17);
  const attackBonus = clamp((analysis.attack - opponentConditionAttack) * 0.006, -0.05, 0.13);
  const battingBonus = clamp((analysis.batting - opponent.batting) * 0.005, -0.04, 0.11);
  const stackedBonus = clamp(Math.max(0, ratingGap) * 0.008 + Math.max(0, analysis.overall - 96) * 0.012, 0, 0.16);
  let userWinChance = clamp(0.45 + ratingGap * 0.030 + eliteBonus + attackBonus + battingBonus + stackedBonus, 0.10, 0.88);
  userWinChance += state.seriesLength === 1 ? 0.06 : state.seriesLength === 5 ? -0.07 : -0.02;
  userWinChance = clamp(userWinChance, 0.10, 1 - drawChance - 0.04);

  const roll = Math.random();
  let outcome = "opponent";
  if (roll < drawChance) outcome = "draw";
  else if (roll < drawChance + userWinChance) outcome = "user";

  const userBatsFirst = Math.random() < 0.5;
  return buildMatchScorecard({
    index,
    outcome,
    userBatsFirst,
    userTeam,
    opponentTeam,
    userRatings: analysis,
    opponentRatings: {
      batting: opponent.batting,
      attack: opponentConditionAttack,
      fielding: opponent.fielding,
      overall: opponentOverall
    },
    venue,
    condition
  });
}

function makeUserTeam(analysis) {
  const players = analysis.players.map((player) => ({
    name: player.name,
    bat: player.bat,
    bowl: player.bowl,
    keep: player.keep,
    style: player.style,
    field: player.field,
    temperament: player.temperament
  }));
  const bowlers = players
    .filter((player) => player.bowl >= 55)
    .sort((a, b) => b.bowl - a.bowl)
    .slice(0, 5);

  return {
    id: "user",
    name: "Invincible XI",
    batters: players,
    bowlers,
    batting: analysis.batting,
    attack: analysis.attack,
    fielding: analysis.fielding,
    keeper: players.find((player) => player.keep > 0)?.name || "keeper"
  };
}

function makeOpponentTeam(opponent) {
  const batters = opponent.xi.map((name, index) => ({
    name,
    bat: clamp(opponent.batting + randomBetween(-10, 10) - Math.max(0, index - 5) * 7, 20, 99),
    bowl: opponent.bowlers.find((bowler) => bowler.name === name)?.rating || (index > 6 ? randomBetween(45, 70) : randomBetween(2, 25)),
    style: opponent.bowlers.find((bowler) => bowler.name === name)?.style || "part-time",
    field: opponent.fielding,
    keep: index === 6 ? 86 : 0,
    temperament: opponent.resilience
  }));

  return {
    id: "opponent",
    name: opponent.name,
    batters,
    bowlers: opponent.bowlers.map((bowler) => ({
      name: bowler.name,
      bat: batters.find((player) => player.name === bowler.name)?.bat || 35,
      bowl: bowler.rating,
      style: bowler.style,
      field: opponent.fielding,
      keep: 0,
      temperament: opponent.resilience
    })),
    batting: opponent.batting,
    attack: opponent.pace * 0.58 + opponent.spin * 0.42,
    fielding: opponent.fielding,
    keeper: batters.find((player) => player.keep > 0)?.name || "keeper"
  };
}

function buildMatchScorecard(config) {
  const first = config.userBatsFirst ? config.userTeam : config.opponentTeam;
  const second = config.userBatsFirst ? config.opponentTeam : config.userTeam;
  const firstRatings = config.userBatsFirst ? config.userRatings : config.opponentRatings;
  const secondRatings = config.userBatsFirst ? config.opponentRatings : config.userRatings;
  const winnerTeamId = config.outcome === "draw" ? "draw" : config.outcome;
  const firstWins = winnerTeamId === first.id;
  const secondWins = winnerTeamId === second.id;

  let first1 = inningsTotal(firstRatings.batting, secondRatings.attack, config.condition, "normal");
  let second1 = inningsTotal(secondRatings.batting, firstRatings.attack, config.condition, firstWins ? "under" : "normal");
  const tiltedFirstInnings = applyUserDominanceToFirstInnings(config, first, second, firstRatings, secondRatings, first1, second1);
  first1 = tiltedFirstInnings.first1;
  second1 = tiltedFirstInnings.second1;
  const forcedFollowOn = buildForcedFollowOnScorecard(config, first, second, firstRatings, secondRatings, first1, second1);
  if (forcedFollowOn) return forcedFollowOn;

  const inningsWinner = firstWins ? first : second;
  const inningsVictory = config.outcome !== "draw" && shouldWinByInnings(
    firstWins ? firstRatings : secondRatings,
    firstWins ? secondRatings : firstRatings,
    config.condition,
    inningsWinner.id === "user"
  );

  if (inningsVictory) {
    const winner = firstWins ? first : second;
    const loser = firstWins ? second : first;
    const winnerRatings = firstWins ? firstRatings : secondRatings;
    const loserRatings = firstWins ? secondRatings : firstRatings;
    let winnerScore = inningsTotal(winnerRatings.batting, loserRatings.attack, config.condition, "dominate");
    let loserFirst = inningsTotal(loserRatings.batting, winnerRatings.attack, config.condition, "collapse");
    let loserSecond = inningsTotal(loserRatings.batting, winnerRatings.attack, config.condition, "followOn");
    const targetMargin = randomInt(18, Math.max(45, Math.round((ratingOverall(winnerRatings) - ratingOverall(loserRatings)) * 1.4 + 70)));
    let margin = winnerScore - loserFirst - loserSecond;

    if (margin < targetMargin) {
      const adjustment = targetMargin - margin;
      winnerScore = clamp(winnerScore + Math.round(adjustment * 0.42), 220, 760);
      loserSecond = clamp(loserSecond - Math.round(adjustment * 0.26), 65, Math.max(65, winnerScore - loserFirst - 1));
      margin = winnerScore - loserFirst - loserSecond;
    }
    if (margin <= 0) {
      loserSecond = Math.max(65, winnerScore - loserFirst - randomInt(18, 80));
      margin = winnerScore - loserFirst - loserSecond;
    }
    if (margin <= 0) {
      winnerScore = clamp(winnerScore + Math.abs(margin) + randomInt(18, 80), 220, 760);
      margin = winnerScore - loserFirst - loserSecond;
    }

    const winnerWickets = Math.random() < 0.34 ? randomInt(5, 8) : 10;
    const innings = firstWins
      ? [
        createInnings(winner, loser, winnerScore, winnerWickets, winnerWickets === 10 ? "all out" : "declared", config.condition),
        createInnings(loser, winner, loserFirst, 10, "all out", config.condition),
        createInnings(loser, winner, loserSecond, 10, "follow-on all out", config.condition)
      ]
      : [
        createInnings(loser, winner, loserFirst, 10, "all out", config.condition),
        createInnings(winner, loser, winnerScore, winnerWickets, winnerWickets === 10 ? "all out" : "declared", config.condition),
        createInnings(loser, winner, loserSecond, 10, "follow-on all out", config.condition)
      ];
    const wicketEvents = buildWicketEvents(innings);

    return {
      index: config.index,
      winner: config.outcome,
      inningsWin: true,
      outright: config.outcome === "user",
      resultText: `${winner.name} won by an innings and ${margin} runs`,
      venue: config.venue,
      condition: config.condition,
      innings,
      wicketEvents
    };
  }

  let first2 = inningsTotal(firstRatings.batting, secondRatings.attack, config.condition, secondWins ? "under" : "press");

  if (secondWins && second1 > first1 + first2 - 70) first2 += Math.round(second1 - first1 + 110);
  if (firstWins && first1 + first2 - second1 < 180) first2 += Math.round(190 - (first1 + first2 - second1));
  if (config.outcome === "draw" && first1 + first2 - second1 < 160) first2 += Math.round(170 - (first1 + first2 - second1));

  const target = Math.max(1, first1 + first2 - second1 + 1);
  let second2 = 0;
  let fourthWickets = 10;
  let fourthStatus = "all out";
  let resultText = "";

  if (config.outcome === "draw") {
    const shortBy = Math.round(randomBetween(25, 150));
    second2 = Math.max(80, target - shortBy);
    fourthWickets = randomInt(3, 8);
    fourthStatus = "time expired";
    resultText = `Match drawn, ${second.name} ${shortBy} short when stumps were pulled`;
  } else if (secondWins) {
    second2 = target;
    fourthWickets = randomInt(2, 8);
    fourthStatus = "target reached";
    resultText = `${second.name} won by ${10 - fourthWickets} wickets`;
  } else {
    const margin = Math.round(randomBetween(28, 175));
    second2 = Math.max(60, target - margin);
    fourthWickets = 10;
    fourthStatus = "all out";
    resultText = `${first.name} won by ${target - second2} runs`;
  }

  const innings = [
    createInnings(first, second, first1, 10, "all out", config.condition),
    createInnings(second, first, second1, 10, "all out", config.condition),
    createInnings(first, second, first2, Math.random() < 0.18 ? randomInt(6, 9) : 10, Math.random() < 0.18 ? "declared" : "all out", config.condition),
    createInnings(second, first, second2, fourthWickets, fourthStatus, config.condition)
  ];
  const wicketEvents = buildWicketEvents(innings);

  return {
    index: config.index,
    winner: config.outcome,
    inningsWin: false,
    outright: false,
    resultText,
    venue: config.venue,
    condition: config.condition,
    innings,
    wicketEvents
  };
}

function applyUserDominanceToFirstInnings(config, first, second, firstRatings, secondRatings, first1, second1) {
  if (config.outcome !== "user") return { first1, second1 };

  const userIsFirst = first.id === "user";
  const userRatings = userIsFirst ? firstRatings : secondRatings;
  const opponentRatings = userIsFirst ? secondRatings : firstRatings;
  const dominance = userDominanceScore(userRatings, opponentRatings);
  if (dominance < 5) return { first1, second1 };

  const userOverall = ratingOverall(userRatings);
  const seriesPressure = state.seriesLength === 5 ? 0.16 : state.seriesLength === 3 ? 0.11 : 0;
  const followOnChance = clamp(0.05 + dominance * 0.008 + Math.max(0, userOverall - 94) * 0.010 - config.condition.rainLost / 410 - seriesPressure, 0.04, state.seriesLength === 1 ? 0.42 : state.seriesLength === 3 ? 0.30 : 0.24);
  if (Math.random() > followOnChance) return { first1, second1 };

  const currentLead = userIsFirst ? first1 - second1 : second1 - first1;
  const targetLead = randomInt(200, Math.max(212, Math.round(202 + dominance * 2.2 + Math.max(0, userOverall - 94) * 2.6)));
  if (currentLead >= targetLead) return { first1, second1 };

  const adjustment = targetLead - currentLead;
  const battingLift = Math.round(adjustment * randomBetween(0.32, 0.50));
  const bowlingSqueeze = adjustment - battingLift;

  if (userIsFirst) {
    return {
      first1: clamp(first1 + battingLift, 160, 720),
      second1: clamp(second1 - bowlingSqueeze, 70, 540)
    };
  }

  return {
    first1: clamp(first1 - bowlingSqueeze, 70, 540),
    second1: clamp(second1 + battingLift, 160, 720)
  };
}

function buildForcedFollowOnScorecard(config, first, second, firstRatings, secondRatings, first1, second1) {
  const userIsFirst = first.id === "user";
  const userTeam = userIsFirst ? first : second;
  const opponentTeam = userIsFirst ? second : first;
  const userRatings = userIsFirst ? firstRatings : secondRatings;
  const opponentRatings = userIsFirst ? secondRatings : firstRatings;
  const lead = userIsFirst ? first1 - second1 : second1 - first1;
  if (lead < 200) return null;

  let opponentFollowOn = inningsTotal(opponentRatings.batting, userRatings.attack, config.condition, "followOn");
  const dominance = userDominanceScore(userRatings, opponentRatings);
  const pressure = clamp((lead - 200) * 0.25 + Math.max(0, dominance) * 1.15 + ((userRatings.attack || 0) - (opponentRatings.batting || 0)) * 0.90, 0, 105);
  const collapseChance = clamp(0.09 + Math.max(0, dominance) * 0.008 + (lead - 200) * 0.0007 + Math.max(0, (userRatings.attack || 0) - 90) * 0.005 - (state.seriesLength === 5 ? 0.07 : state.seriesLength === 3 ? 0.03 : 0), 0.07, state.seriesLength === 1 ? 0.44 : 0.34);
  const collapseBonus = Math.random() < collapseChance ? randomBetween(20, 85) : 0;
  opponentFollowOn = clamp(Math.round(opponentFollowOn - pressure - collapseBonus + gaussian(0, 22)), 45, 620);
  const crushChance = clamp(0.03 + Math.max(0, dominance) * 0.004 + Math.max(0, lead - 225) * 0.0005 - (state.seriesLength === 5 ? 0.04 : state.seriesLength === 3 ? 0.02 : 0), 0.015, state.seriesLength === 1 ? 0.20 : 0.14);
  if (opponentFollowOn >= lead && Math.random() < crushChance) {
    opponentFollowOn = randomInt(80, Math.max(85, lead - randomInt(8, 55)));
  }
  const inningsWin = opponentFollowOn < lead;
  const innings = userIsFirst
    ? [
      createInnings(userTeam, opponentTeam, first1, 10, "all out", config.condition),
      createInnings(opponentTeam, userTeam, second1, 10, "all out", config.condition),
      createInnings(opponentTeam, userTeam, opponentFollowOn, 10, "follow-on all out", config.condition)
    ]
    : [
      createInnings(opponentTeam, userTeam, first1, 10, "all out", config.condition),
      createInnings(userTeam, opponentTeam, second1, 10, "all out", config.condition),
      createInnings(opponentTeam, userTeam, opponentFollowOn, 10, "follow-on all out", config.condition)
    ];

  let resultText = `${userTeam.name} won by an innings and ${lead - opponentFollowOn} runs`;
  let winner = "user";
  let outright = true;

  if (!inningsWin) {
    const target = opponentFollowOn - lead + 1;
    const chaseWickets = randomInt(2, 7);
    innings.push(createInnings(userTeam, opponentTeam, target, chaseWickets, "target reached", config.condition));
    resultText = `${userTeam.name} won by ${10 - chaseWickets} wickets after enforcing the follow-on`;
    outright = false;
  }

  return {
    index: config.index,
    winner,
    inningsWin,
    outright,
    resultText,
    venue: config.venue,
    condition: config.condition,
    innings,
    wicketEvents: buildWicketEvents(innings)
  };
}

function shouldWinByInnings(winnerRatings, loserRatings, condition, userWinner = false) {
  const gap = ratingOverall(winnerRatings) - ratingOverall(loserRatings);
  const battingEdge = (winnerRatings.batting || 0) - (loserRatings.batting || 0);
  const attackEdge = (winnerRatings.attack || 0) - (loserRatings.attack || 0);
  const dominance = gap * 0.62 + Math.max(0, battingEdge) * 0.34 + Math.max(0, attackEdge) * 0.40 + Math.min(0, battingEdge + attackEdge) * 0.20;
  const winnerOverall = ratingOverall(winnerRatings);
  const eliteLift = clamp((winnerOverall - 90) * 0.012, 0, 0.18);
  const userLift = userWinner ? clamp(Math.max(0, winnerOverall - 92) * 0.010 + Math.max(0, gap) * 0.010, 0, 0.14) : 0;
  const seriesDrag = userWinner ? (state.seriesLength === 5 ? 0.12 : state.seriesLength === 3 ? 0.05 : 0) : 0;
  const floor = userWinner ? clamp(Math.max(0, winnerOverall - 90) * 0.010 + Math.max(0, gap) * 0.008, 0.06, 0.30) : 0.04;
  const ceiling = userWinner ? (state.seriesLength === 5 ? 0.58 : state.seriesLength === 3 ? 0.68 : 0.78) : 0.72;
  const chance = clamp(0.10 + dominance * 0.020 + eliteLift + userLift - condition.rainLost / 300 - seriesDrag, floor, ceiling);
  return Math.random() < chance;
}

function userDominanceScore(userRatings, opponentRatings) {
  const gap = ratingOverall(userRatings) - ratingOverall(opponentRatings);
  const battingEdge = (userRatings.batting || 0) - (opponentRatings.batting || 0);
  const attackEdge = (userRatings.attack || 0) - (opponentRatings.attack || 0);
  return gap * 0.82 + battingEdge * 0.48 + attackEdge * 0.56 + Math.max(0, ratingOverall(userRatings) - 94) * 0.45;
}

function ratingOverall(ratings) {
  return ratings.overall || (ratings.batting || 0) * 0.45 + (ratings.attack || 0) * 0.45 + (ratings.fielding || 0) * 0.10;
}

function buildWicketEvents(innings) {
  const teamInnings = {};
  return innings.flatMap((inningsEntry, inningsIndex) => {
    teamInnings[inningsEntry.teamId] = (teamInnings[inningsEntry.teamId] || 0) + 1;
    const inningsLabel = `${inningsEntry.teamName} innings ${teamInnings[inningsEntry.teamId]}`;
    return inningsEntry.wicketEvents.map((event) => ({
      ...event,
      inningsIndex,
      inningsLabel,
      teamId: inningsEntry.teamId,
      inningsTotal: inningsEntry.score,
      inningsWickets: inningsEntry.wickets
    }));
  });
}

function inningsTotal(batting, bowling, condition, mode) {
  const modeShift = {
    normal: 0,
    press: 42,
    under: -54,
    dominate: 108,
    collapse: -84,
    followOn: -68
  }[mode] || 0;
  const mean = 284 + (batting - bowling) * 4.85 + (condition.batting - 1) * 92 + modeShift;
  return clamp(Math.round(mean + gaussian(0, mode === "dominate" ? 62 : 54)), 55, mode === "dominate" ? 840 : 650);
}

function createInnings(battingTeam, bowlingTeam, score, wickets, status, condition) {
  wickets = clamp(Math.round(wickets), 0, 10);
  const allOut = wickets === 10;
  const battedCount = allOut ? 11 : clamp(wickets + 2, 2, 11);
  const overs = estimatedOvers(score, status);
  const extras = clamp(Math.round(score * randomBetween(0.025, 0.07)), 3, Math.max(3, Math.round(score * 0.14)));
  const batRuns = Math.max(0, score - extras);
  const batters = battingTeam.batters.slice(0, 11);
  while (batters.length < 11) {
    batters.push({ name: `Sub ${batters.length + 1}`, bat: 35, bowl: 20, style: "part-time", field: 70, keep: 0 });
  }

  const scores = distributeRuns(batters.slice(0, battedCount), batRuns);
  const dismissedIndices = chooseDismissedIndices(battedCount, wickets);
  const fowScores = buildFowScores(score, wickets, allOut);
  const wicketBowlers = [];
  const battingRows = batters.map((batter, index) => {
    if (index >= battedCount) {
      return { name: batter.name, runs: "-", how: "did not bat" };
    }
    const dismissedOrder = dismissedIndices.indexOf(index);
    if (dismissedOrder === -1) {
      return { name: batter.name, runs: scores[index], how: "not out" };
    }
    const bowler = pickWicketBowler(bowlingTeam.bowlers, condition, wicketBowlers);
    const dismissal = makeDismissal(bowler, bowlingTeam, condition);
    if (dismissal.creditsBowler) wicketBowlers.push(bowler.name);
    return { name: batter.name, runs: scores[index], how: dismissal.text };
  });

  const fow = dismissedIndices.map((batterIndex, index) => ({
    wicket: index + 1,
    score: fowScores[index],
    batter: batters[batterIndex].name,
    over: fowScores[index] / Math.max(score, 1) * overs
  }));
  const wicketEvents = fow.map((item) => {
    const row = battingRows.find((batter) => batter.name === item.batter);
    return {
      wicket: item.wicket,
      score: item.score,
      over: item.over,
      batter: item.batter,
      batterRuns: row?.runs ?? 0,
      how: row?.how || "out"
    };
  });

  const bowling = createBowlingFigures(bowlingTeam.bowlers, score, wickets, wicketBowlers, overs, condition);

  return {
    teamName: battingTeam.name,
    teamId: battingTeam.id,
    score,
    wickets,
    overs,
    status,
    extras,
    batting: battingRows,
    fow,
    wicketEvents,
    bowling
  };
}

function distributeRuns(batters, totalRuns) {
  const weights = batters.map((batter, index) => {
    const rating = Math.max(22, batter.bat || 35);
    const ratingEdge = Math.pow(rating / 72, 2.55);
    const volatility = Math.exp(gaussian(0, 0.46));
    const bradman = isBradman(batter);
    const bigDayChance = bradman ? 0.72 : clamp((rating - 70) / 90, 0.02, 0.36);
    const bigDayBoost = Math.random() < bigDayChance ? randomBetween(bradman ? 1.75 : 1.25, bradman ? 2.85 : 2.15) : 1;
    const battingOrderDrag = Math.max(0, index - 5) * 0.16;
    return Math.max(7, 78 * ratingEdge * volatility * bigDayBoost * (1 - battingOrderDrag));
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let scores = weights.map((weight) => Math.max(0, Math.round(totalRuns * weight / weightTotal + gaussian(0, 10))));
  let diff = totalRuns - scores.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  while (diff !== 0 && scores.length) {
    const step = diff > 0 ? 1 : -1;
    if (scores[cursor] + step >= 0) {
      scores[cursor] += step;
      diff -= step;
    }
    cursor = (cursor + 1) % scores.length;
  }
  return shapeBattingScores(batters, scores, totalRuns);
}

function shapeBattingScores(batters, scores, totalRuns) {
  if (totalRuns < 145 || scores.length < 2) return scores;
  scores = maybePromoteBradmanCentury(batters, scores, totalRuns);
  const bestBatter = batters.reduce((best, batter, index) => {
    if (!best || (batter.bat || 0) > (best.batter.bat || 0)) return { batter, index };
    return best;
  }, null);
  if (!bestBatter) return scores;

  const currentTop = Math.max(...scores);
  const topRating = bestBatter.batter.bat || 35;
  const inningsFactor = clamp((totalRuns - 180) / 330, 0, 0.62);
  const ratingFactor = clamp((topRating - 68) / 62, 0, 0.44);
  const centuryChance = clamp(0.04 + inningsFactor + ratingFactor, 0.04, 0.72);
  if (currentTop < 100 && Math.random() <= centuryChance) {
    const candidates = batters.map((batter, index) => ({
      index,
      weight: Math.pow(Math.max(1, (batter.bat || 35) - 50), 2.15) * (index < 6 ? 1.15 : 0.72)
    }));
    const candidate = weightedItem(candidates);
    const target = clamp(Math.round(100 + randomBetween(0, Math.max(18, (batters[candidate.index].bat || 50) - 48)) + gaussian(0, 16)), 100, Math.min(totalRuns, 220));
    scores = promoteScoreToTarget(scores, candidate.index, target);
  }
  return promotePartnershipScores(batters, scores, totalRuns);
}

function promotePartnershipScores(batters, scores, totalRuns) {
  if (totalRuns < 220 || scores.length < 3) return scores;
  const topOrderLength = Math.min(7, batters.length);
  const topOrder = batters.slice(0, topOrderLength);
  const battingQuality = avg(topOrder.map((batter) => batter.bat || 35));
  const partnershipChance = clamp(0.12 + (totalRuns - 240) / 420 + (battingQuality - 75) / 45, 0.08, 0.88);
  const milestone = totalRuns >= 300 ? 70 : 60;
  let desiredScores = 1;
  if (Math.random() < partnershipChance) desiredScores = 2;
  if (totalRuns >= 380 && Math.random() < partnershipChance * 0.55) desiredScores = 3;

  const highScoreIndices = new Set(scores
    .map((runs, index) => ({ runs, index }))
    .filter((entry) => entry.runs >= milestone)
    .map((entry) => entry.index));
  if (highScoreIndices.size >= desiredScores) return scores;

  const anchorIndex = scores.indexOf(Math.max(...scores));
  const candidates = topOrder
    .map((batter, index) => ({ batter, index }))
    .filter((entry) => !highScoreIndices.has(entry.index) && (entry.batter.bat || 0) >= 72)
    .sort((a, b) => Math.abs(a.index - anchorIndex) - Math.abs(b.index - anchorIndex) || (b.batter.bat || 0) - (a.batter.bat || 0));

  for (const candidate of candidates) {
    if (highScoreIndices.size >= desiredScores) break;
    const rating = candidate.batter.bat || 72;
    const makeCentury = totalRuns >= 430 && rating >= 90 && Math.random() < 0.22;
    const target = makeCentury
      ? randomInt(100, Math.min(125, totalRuns))
      : randomInt(milestone, Math.min(98, milestone + 12 + Math.max(0, rating - 78)));
    scores = promoteScoreToTarget(scores, candidate.index, target);
    if (scores[candidate.index] >= milestone) highScoreIndices.add(candidate.index);
  }
  return scores;
}

function maybePromoteBradmanCentury(batters, scores, totalRuns) {
  const bradmanIndex = batters.findIndex(isBradman);
  if (bradmanIndex === -1 || totalRuns < 135 || scores[bradmanIndex] >= 100) return scores;
  const chance = clamp(0.48 + (totalRuns - 160) / 360, 0.42, 0.88);
  if (Math.random() > chance) return scores;
  const target = clamp(Math.round(112 + randomBetween(0, 78) + gaussian(0, 12)), 100, Math.min(totalRuns, 260));
  return promoteScoreToTarget(scores, bradmanIndex, target);
}

function promoteScoreToTarget(scores, targetIndex, target) {
  let needed = target - scores[targetIndex];
  if (needed <= 0) return scores;
  const donors = scores
    .map((runs, index) => {
      const protectedRuns = runs >= 100 ? 100 : runs >= 70 ? 70 : randomInt(0, 10);
      return { index, spare: index === targetIndex ? 0 : Math.max(0, runs - protectedRuns) };
    })
    .sort((a, b) => b.spare - a.spare);

  for (const donor of donors) {
    if (needed <= 0) break;
    const transfer = Math.min(donor.spare, needed);
    scores[donor.index] -= transfer;
    scores[targetIndex] += transfer;
    needed -= transfer;
  }
  return scores;
}

function chooseDismissedIndices(battedCount, wickets) {
  const indices = Array.from({ length: battedCount }, (_, index) => index);
  const protectedCount = wickets === 10 ? 1 : 2;
  const protectedIndices = new Set();
  while (protectedIndices.size < Math.min(protectedCount, indices.length)) {
    protectedIndices.add(randomItem(indices));
  }
  return indices
    .filter((index) => !protectedIndices.has(index))
    .slice(0, wickets);
}

function buildFowScores(score, wickets, allOut) {
  if (!wickets) return [];
  const scores = [];
  let previous = 0;
  for (let index = 0; index < wickets; index += 1) {
    const target = allOut && index === wickets - 1 ? score : Math.round(score * (index + 1) / (wickets + randomBetween(0.8, 1.8)) + gaussian(0, 18));
    const next = clamp(Math.max(previous + randomInt(1, 35), target), previous + 1, allOut && index === wickets - 1 ? score : score - 1);
    scores.push(next);
    previous = next;
  }
  return scores;
}

function createBowlingFigures(bowlers, score, wickets, wicketBowlers, overs, condition) {
  const attack = bowlers.length ? bowlers : [{ name: "Part-time bowler", style: "part-time", bowl: 45 }];
  const weights = attack.map((bowler) => bowler.bowl * (String(bowler.style).includes("spin") ? condition.spin : condition.pace) * randomBetween(0.82, 1.18));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  let remainingRuns = score;
  let remainingOvers = overs;

  return attack.map((bowler, index) => {
    const isLast = index === attack.length - 1;
    const share = isLast ? 1 : weights[index] / totalWeight;
    const bowlerOvers = isLast ? remainingOvers : Math.max(1, Math.round(overs * share * 10) / 10);
    const runs = isLast ? remainingRuns : Math.max(8, Math.round(score * share * randomBetween(0.82, 1.16)));
    remainingOvers = Math.max(0, remainingOvers - bowlerOvers);
    remainingRuns = Math.max(0, remainingRuns - runs);
    return {
      name: bowler.name,
      overs: bowlerOvers,
      maidens: Math.max(0, Math.round(bowlerOvers * randomBetween(0.06, 0.18))),
      runs,
      wickets: wicketBowlers.filter((name) => name === bowler.name).length
    };
  });
}

function pickWicketBowler(bowlers, condition, wicketBowlers = []) {
  const attack = bowlers.length ? bowlers : [{ name: "Part-time bowler", style: "part-time", bowl: 45 }];
  const weighted = attack.map((bowler) => {
    const currentWickets = wicketBowlers.filter((name) => name === bowler.name).length;
    const conditionFit = String(bowler.style).includes("spin") ? condition.spin : condition.pace;
    const ratingEdge = Math.pow(Math.max(25, bowler.bowl || 45) / 72, 2.15);
    const hotHand = 1 + currentWickets * 0.23 + (currentWickets >= 3 ? 0.38 : 0);
    return {
      bowler,
      weight: Math.max(1, 72 * ratingEdge * conditionFit * hotHand * randomBetween(0.72, 1.28))
    };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.bowler;
  }
  return weighted[0].bowler;
}

function makeDismissal(bowler, bowlingTeam, condition) {
  const keeper = bowlingTeam.keeper || "keeper";
  const fielders = bowlingTeam.batters.map((player) => player.name).filter((name) => name !== bowler.name);
  const isSpinBowler = String(bowler.style).includes("spin");
  const options = [
    { text: `b ${bowler.name}`, creditsBowler: true, weight: 18 },
    { text: `lbw b ${bowler.name}`, creditsBowler: true, weight: isSpinBowler ? 22 * condition.spin : 16 },
    { text: `c ${randomItem(fielders)} b ${bowler.name}`, creditsBowler: true, weight: 32 },
    { text: `c ${keeper} b ${bowler.name}`, creditsBowler: true, weight: 20 },
    { text: `run out (${randomItem(fielders)})`, creditsBowler: false, weight: 5 }
  ];
  if (isSpinBowler) options.push({ text: `st ${keeper} b ${bowler.name}`, creditsBowler: true, weight: 8 * condition.spin });
  return weightedItem(options);
}

function estimatedOvers(score, status) {
  const baseRate = status === "target reached" ? randomBetween(3.4, 4.7) : status === "time expired" ? randomBetween(2.55, 3.35) : randomBetween(3.05, 3.95);
  return clamp(Math.round((score / baseRate) * 10) / 10, 18, status === "time expired" ? 180 : 170);
}

function isSpinner(player) {
  return player.roles.includes("spinner") || player.style === "spin";
}

function isPace(player) {
  return ["pace", "seam", "left-arm pace", "left-arm seam"].includes(player.style);
}

function isBradman(player) {
  return player?.name === "Don Bradman";
}

function avg(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function avgTop(values, count) {
  return avg([...values].sort((a, b) => b - a).slice(0, count));
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function weightedItem(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[0];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function gaussian(mean = 0, sd = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatOvers(value) {
  const overs = Math.floor(value);
  const balls = Math.round((value - overs) * 6);
  if (balls >= 6) return `${overs + 1}.0`;
  return `${overs}.${balls}`;
}
