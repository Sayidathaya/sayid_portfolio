import { gsap } from "../core/gsap";
import { isCalmMotion } from "../core/motion";
import { q } from "../core/utils";

type PowerState = "off" | "loading" | "on" | "error";

interface AudioState {
  power: PowerState;
  muted: boolean;
  volume: number;
}

const DEFAULT_VOLUME = 0.72;

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
};

export function initAudioDeck(): (() => void) | null {
  const deck = q<HTMLElement>("[data-audio-deck]");
  if (!deck || deck.dataset.audioReady === "true") return null;
  deck.dataset.audioReady = "true";

  const audio = q<HTMLAudioElement>("[data-audio]", deck);
  const powerButton = q<HTMLButtonElement>("[data-audio-power]", deck);
  const muteButton = q<HTMLButtonElement>("[data-audio-mute]", deck);
  const powerState = q<HTMLElement>("[data-audio-power-state]", deck);
  const muteState = q<HTMLElement>("[data-audio-mute-state]", deck);
  const muteKey = q<HTMLElement>("[data-audio-mute-key]", deck);
  const status = q<HTMLElement>("[data-audio-status]", deck);
  const clock = q<HTMLElement>("[data-audio-clock]", deck);
  const led = q<HTMLElement>("[data-audio-led]", deck);
  const details = q<HTMLDetailsElement>("[data-audio-details]", deck);

  if (!audio || !powerButton || !muteButton) return null;

  const state: AudioState = { power: "off", muted: false, volume: DEFAULT_VOLUME };
  let playRequest = 0;
  let lastMessage = "Power off · press PWR";
  let note: string | null = null;

  audio.volume = state.volume;
  audio.muted = state.muted;

  const message = (): string => {
    if (note) return note;
    if (state.power === "loading") return "Synchronising audio…";
    if (state.power === "error") return "Playback blocked · press PWR to retry";
    if (state.power === "off" && state.muted) return "Power off · mute preserved";
    if (state.power === "off") return "Power off · press PWR";
    return state.muted ? "Playing · mute active" : "Playing · Press Start";
  };

  const render = (): void => {
    const powered = state.power === "on";
    const playing = powered && !audio.paused && !audio.ended;
    deck.dataset.audioPower = state.power;
    deck.dataset.audioMuted = String(state.muted);
    deck.dataset.audioPlaying = String(playing);

    powerButton.setAttribute("aria-pressed", String(powered));
    powerButton.setAttribute(
      "aria-label",
      powered ? "Power off Press Start audio" : "Power on Press Start audio",
    );
    powerButton.toggleAttribute("aria-busy", state.power === "loading");
    powerButton.disabled = state.power === "loading";

    muteButton.setAttribute("aria-pressed", String(state.muted));
    muteButton.setAttribute(
      "aria-label",
      state.muted ? "Unmute Press Start audio" : "Mute Press Start audio",
    );

    if (powerState) {
      powerState.textContent =
        state.power === "on"
          ? "ON"
          : state.power === "loading"
            ? "SYNC"
            : state.power === "error"
              ? "ERR"
              : "OFF";
    }
    if (muteState) muteState.textContent = state.muted ? "MUTED" : "SOUND ON";
    if (muteKey) muteKey.textContent = state.muted ? "UNMUTE" : "MUTE";

    const nextMessage = message();
    if (status && nextMessage !== lastMessage) {
      status.textContent = nextMessage;
      lastMessage = nextMessage;
    }

    // The LED follows audible playback, not just the power request; muting keeps
    // the transport running but dims the meter instead of pretending it is off.
    deck.toggleAttribute("data-audio-active", playing && !state.muted);
  };

  const animatePowerOn = (): void => {
    if (isCalmMotion()) return;
    const timeline = gsap.timeline({ defaults: { ease: "steps(4)" } });
    timeline
      .fromTo(powerButton, { scale: 0.92 }, { scale: 1.06, duration: 0.12 })
      .to(powerButton, { scale: 1, duration: 0.16 });
    if (led) {
      timeline.fromTo(
        led,
        { scale: 0.4, opacity: 0.4 },
        { scale: 1, opacity: 1, duration: 0.16 },
        0,
      );
    }
  };

  const animatePowerOff = (): void => {
    if (isCalmMotion()) return;
    gsap
      .timeline({ defaults: { ease: "steps(3)" } })
      .to(powerButton, { y: 2, duration: 0.08, yoyo: true, repeat: 1 });
  };

  const animateMute = (): void => {
    if (isCalmMotion()) return;
    gsap
      .timeline({ defaults: { ease: "steps(3)" } })
      .to(muteButton, { rotate: -2, duration: 0.06, repeat: 1, yoyo: true });
  };

  const animateError = (): void => {
    if (isCalmMotion()) return;
    gsap.fromTo(
      powerButton,
      { x: -3 },
      { x: 0, duration: 0.32, ease: "steps(6)", clearProps: "x" },
    );
  };

  const animateEnded = (): void => {
    if (isCalmMotion()) return;
    gsap.fromTo(deck, { opacity: 0.55 }, { opacity: 1, duration: 0.4, ease: "steps(4)" });
  };

  const updateClock = (): void => {
    if (!clock) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    clock.textContent = `${formatTime(audio.currentTime)} / ${formatTime(duration)}`;
  };

  const startPlayback = async (): Promise<void> => {
    const request = ++playRequest;
    note = null;
    state.power = "loading";
    render();

    audio.volume = state.volume;
    audio.muted = state.muted;
    try {
      audio.currentTime = 0;
    } catch {
      // Metadata may still be loading; play() starts at zero for a fresh source anyway.
    }

    try {
      await audio.play();
      if (request !== playRequest) return;
      state.power = "on";
      render();
      animatePowerOn();
    } catch {
      if (request !== playRequest) return;
      state.power = "error";
      render();
      animateError();
    }
  };

  const stopPlayback = (): void => {
    playRequest += 1;
    note = null;
    state.power = "off";
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Ignore: the element is already at its start.
    }
    render();
    updateClock();
    animatePowerOff();
  };

  powerButton.addEventListener("click", () => {
    if (state.power === "loading") return;
    if (state.power === "on") {
      stopPlayback();
    } else {
      void startPlayback();
    }
  });

  muteButton.addEventListener("click", () => {
    state.muted = !state.muted;
    audio.muted = state.muted;
    render();
    animateMute();
  });

  audio.addEventListener("playing", () => {
    if (state.power === "loading") state.power = "on";
    render();
  });

  audio.addEventListener("pause", () => {
    if (state.power === "off" || state.power === "error") {
      render();
      return;
    }
    if (audio.ended) return;
    state.power = "off";
    render();
  });

  audio.addEventListener("ended", () => {
    playRequest += 1;
    state.power = "off";
    note = "Track complete · press PWR to replay";
    try {
      audio.currentTime = 0;
    } catch {
      // Ignore.
    }
    render();
    updateClock();
    animateEnded();
  });

  audio.addEventListener("error", () => {
    playRequest += 1;
    state.power = "error";
    note = null;
    render();
  });

  audio.addEventListener("timeupdate", updateClock);
  audio.addEventListener("loadedmetadata", updateClock);

  render();
  updateClock();

  const onPageHide = (): void => {
    audio.pause();
  };
  window.addEventListener("pagehide", onPageHide);

  const onPageShow = (): void => {
    render();
  };
  window.addEventListener("pageshow", onPageShow);

  // Below desktop, and on desktop windows shorter than 50rem, the deck becomes
  // a compact disclosure so its fixed panel cannot sit on top of the landing
  // CTA, hero record, or section actions. Tall desktop keeps it open.
  const compactDeck = window.matchMedia(
    "(max-width: 63.99rem), (min-width: 64rem) and (max-height: 50rem)",
  );
  const syncDeck = (): void => {
    if (!details) return;
    details.open = !compactDeck.matches;
  };
  syncDeck();
  compactDeck.addEventListener("change", syncDeck);

  return () => {
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    compactDeck.removeEventListener("change", syncDeck);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  };
}
