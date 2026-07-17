// ==UserScript==
// @name         Instagram Clean Reel Controls
// @namespace    https://github.com/NabiKAZ
// @version      4.0
// @description  Replaces browser video controls with a minimal draggable reel controller.
// @author       Nabi K.A.Z. + Codex
// @match        https://www.instagram.com/p/*
// @match        https://www.instagram.com/reel/*
// @match        https://www.instagram.com/tv/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const PANEL_ID = "ig-clean-reel-panel";
  let speed = Number(localStorage.getItem("ig-clean-reel-speed")) || 1;
  let currentVideo = null;

  const style = document.createElement("style");
  style.textContent = `
    #${PANEL_ID} {
      position: fixed; z-index: 2147483647; width: 286px; box-sizing: border-box;
      padding: 12px; border: 1px solid rgba(255,255,255,.13); border-radius: 18px;
      color: #f8fafc; background: rgba(20, 24, 33, .88);
      box-shadow: 0 18px 48px rgba(0,0,0,.36); backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px); font: 500 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      user-select: none;
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .ig-header { display:flex; align-items:center; justify-content:space-between; margin:0 2px 10px; cursor:grab; }
    #${PANEL_ID} .ig-title { font-size:11px; font-weight:700; letter-spacing:.09em; color:#aeb9c9; text-transform:uppercase; }
    #${PANEL_ID} .ig-time { font-variant-numeric: tabular-nums; font-weight:700; color:#fff; }
    #${PANEL_ID} .ig-scrubber { width:100%; height:4px; margin:0 0 12px; accent-color:#56a8ff; cursor:pointer; }
    #${PANEL_ID} .ig-controls { display:grid; grid-template-columns:1.15fr .8fr 1fr .8fr 1.15fr; gap:6px; }
    #${PANEL_ID} button { height:34px; border:1px solid transparent; border-radius:10px; color:#eef4ff; background:rgba(255,255,255,.08); cursor:pointer; font:700 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; transition:background .15s, transform .15s; }
    #${PANEL_ID} button:hover { background:rgba(255,255,255,.17); }
    #${PANEL_ID} button:active { transform:scale(.96); }
    #${PANEL_ID} .ig-primary { background:#1687ed; color:#fff; }
    #${PANEL_ID} .ig-primary:hover { background:#2e9bff; }
    #${PANEL_ID} .ig-footer { display:flex; gap:6px; margin-top:10px; }
    #${PANEL_ID} .ig-footer button { flex:1; height:29px; font-size:11px; color:#c8d3e2; }
    #${PANEL_ID} .ig-dragging .ig-header { cursor:grabbing; }
  `;
  document.head.appendChild(style);

  const videos = () => [...document.querySelectorAll("video")];
  const visibleArea = video => {
    const box = video.getBoundingClientRect();
    const width = Math.max(0, Math.min(box.right, innerWidth) - Math.max(box.left, 0));
    const height = Math.max(0, Math.min(box.bottom, innerHeight) - Math.max(box.top, 0));
    return width * height;
  };
  const activeVideo = () => {
    // Prefer the reel Instagram has actually started, then the reel most visible in the viewport.
    if (currentVideo?.isConnected && visibleArea(currentVideo) > 0) return currentVideo;
    return videos().sort((a, b) => visibleArea(b) - visibleArea(a))[0] || null;
  };
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const formatTime = seconds => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return hours ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
  };

  function prepareVideos() {
    videos().forEach(video => {
      // This removes the browser's full native control bar from the reel.
      video.controls = false;
      video.removeAttribute("controls");
      video.playbackRate = speed;
      if (video.dataset.igCleanControlsReady) return;
      video.dataset.igCleanControlsReady = "true";
      ["play", "playing", "pointerdown", "touchstart"].forEach(type => {
        video.addEventListener(type, () => { currentVideo = video; }, { passive: true });
      });
    });
  }

  function changeTime(seconds) {
    const video = activeVideo();
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = clamp(video.currentTime + seconds, 0, video.duration);
  }

  function setSpeed(nextSpeed) {
    speed = clamp(Math.round(nextSpeed * 100) / 100, 0.25, 4);
    localStorage.setItem("ig-clean-reel-speed", speed);
    videos().forEach(video => { video.playbackRate = speed; });
  }

  async function copyLink(button) {
    try {
      await navigator.clipboard.writeText(location.href.split("?")[0]);
      const label = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => { button.textContent = label; }, 1200);
    } catch (_) {
      button.textContent = "Copy failed";
    }
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.style.right = localStorage.getItem("ig-clean-reel-right") || "24px";
    panel.style.bottom = localStorage.getItem("ig-clean-reel-bottom") || "24px";

    panel.innerHTML = `
      <div class="ig-header"><span class="ig-title">Reel controls</span><span class="ig-time">0:00 / 0:00</span></div>
      <input class="ig-scrubber" type="range" min="0" max="1000" value="0" aria-label="Reel timeline">
      <div class="ig-controls">
        <button type="button" data-action="back">Back 5s</button>
        <button type="button" data-action="slower">−</button>
        <button type="button" class="ig-primary" data-action="toggle">Play</button>
        <button type="button" data-action="faster">+</button>
        <button type="button" data-action="forward">Ahead 5s</button>
      </div>
      <div class="ig-footer">
        <button type="button" data-action="speed">Speed 1.00x</button>
        <button type="button" data-action="copy">Copy link</button>
      </div>`;
    document.body.appendChild(panel);

    const time = panel.querySelector(".ig-time");
    const scrubber = panel.querySelector(".ig-scrubber");
    const playButton = panel.querySelector('[data-action="toggle"]');
    const speedButton = panel.querySelector('[data-action="speed"]');

    panel.addEventListener("click", event => {
      const action = event.target.dataset.action;
      if (!action) return;
      const video = activeVideo();
      if (action === "back") changeTime(-5);
      if (action === "forward") changeTime(5);
      if (action === "slower") setSpeed(speed - 0.25);
      if (action === "faster") setSpeed(speed + 0.25);
      if (action === "speed") setSpeed(speed === 1 ? 1.5 : 1);
      if (action === "toggle" && video) video.paused ? video.play() : video.pause();
      if (action === "copy") copyLink(event.target);
    });
    scrubber.addEventListener("input", () => {
      const video = activeVideo();
      if (video && Number.isFinite(video.duration)) video.currentTime = video.duration * (Number(scrubber.value) / 1000);
    });

    setInterval(() => {
      const video = activeVideo();
      if (!video) return;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      time.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
      scrubber.value = duration ? String((video.currentTime / duration) * 1000) : "0";
      playButton.textContent = video.paused ? "Play" : "Pause";
      speedButton.textContent = `Speed ${speed.toFixed(2)}x`;
    }, 250);

    let dragging = false, startX, startY, startRight, startBottom;
    const header = panel.querySelector(".ig-header");
    header.addEventListener("pointerdown", event => {
      dragging = true;
      panel.classList.add("ig-dragging");
      startX = event.clientX; startY = event.clientY;
      startRight = parseFloat(panel.style.right) || 0; startBottom = parseFloat(panel.style.bottom) || 0;
      header.setPointerCapture(event.pointerId);
    });
    header.addEventListener("pointermove", event => {
      if (!dragging) return;
      const right = clamp(startRight - (event.clientX - startX), 0, innerWidth - panel.offsetWidth);
      const bottom = clamp(startBottom - (event.clientY - startY), 0, innerHeight - panel.offsetHeight);
      panel.style.right = `${right}px`; panel.style.bottom = `${bottom}px`;
    });
    header.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false; panel.classList.remove("ig-dragging");
      localStorage.setItem("ig-clean-reel-right", panel.style.right);
      localStorage.setItem("ig-clean-reel-bottom", panel.style.bottom);
    });
  }

  document.addEventListener("keydown", event => {
    if (["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (event.key === "[") setSpeed(speed - 0.25);
    if (event.key === "]") setSpeed(speed + 0.25);
    if (event.key === "\\") setSpeed(1);
  });

  prepareVideos();
  createPanel();
  document.addEventListener("pointerdown", event => {
    const reelVideo = event.target.closest?.("video");
    if (reelVideo) currentVideo = reelVideo;
  }, true);
  // Scrolling through the feed often exposes the next reel before it plays.
  // Selecting the largest visible video keeps the panel in sync during that transition.
  addEventListener("scroll", () => { currentVideo = null; }, { passive: true });
  new MutationObserver(prepareVideos).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(prepareVideos, 1000);
})();
