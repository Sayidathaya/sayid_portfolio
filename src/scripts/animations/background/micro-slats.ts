import { Mesh, Program, Renderer, RenderTarget, Triangle } from "ogl";

type SwellPreset = "swell" | "tide" | "storm" | "signal";
type Rgba = [number, number, number, number];

interface WaveValues {
  scale: number;
  speed: number;
  direction: number;
  chop: number;
  stretch: number;
  glint: number;
  contrast: number;
  perspective: number;
  fog: number;
}

interface Settings extends WaveValues {
  color: Rgba;
  glintColor: Rgba;
  backgroundColor: Rgba;
  slatWidth: number;
  slatHeight: number;
  gap: number;
  roundness: number;
  introDuration: number;
}

interface GridLayout {
  slatW: number;
  slatH: number;
  grid: number[];
  origin: number[];
}

type Uniform = { value: unknown };

type FieldUniforms = {
  uSize: Uniform;
  uGrid: Uniform;
  uOrigin: Uniform;
  uSlat: Uniform;
  uTime: Uniform;
  uScale: Uniform;
  uDirection: Uniform;
  uChop: Uniform;
  uStretch: Uniform;
  uGlint: Uniform;
  uContrast: Uniform;
  uPerspective: Uniform;
  uFog: Uniform;
  uIntro: Uniform;
  uPointer: Uniform;
  uPointerStrength: Uniform;
};

type SlatUniforms = {
  tField: Uniform;
  uSize: Uniform;
  uDpr: Uniform;
  uGrid: Uniform;
  uOrigin: Uniform;
  uSlat: Uniform;
  uRound: Uniform;
  uColor: Uniform;
  uGlintColor: Uniform;
  uBackground: Uniform;
};

export interface MicroSlatsOptions {
  preset?: SwellPreset;
  color: string;
  glintColor: string;
  backgroundColor: string;
  slatWidth?: number;
  slatHeight?: number;
  gap?: number;
  roundness?: number;
  overrides?: Partial<WaveValues>;
  introDuration?: number;
}

export interface MicroSlatsInstance {
  destroy: () => void;
  playIntro: () => void;
  setTheme: (color: string, glintColor: string, backgroundColor: string) => void;
  setPaused: (paused: boolean) => void;
  setMotion: (calm: boolean) => void;
}

const SWELL_PRESETS: Record<SwellPreset, WaveValues> = {
  swell: {
    scale: 1.5,
    speed: 0.6,
    direction: 250,
    chop: 0.55,
    stretch: 0,
    glint: 0.7,
    contrast: 1.25,
    perspective: 0.55,
    fog: 0.55,
  },
  tide: {
    scale: 1.3,
    speed: 0.5,
    direction: 262,
    chop: 0.2,
    stretch: 0.12,
    glint: 0.45,
    contrast: 1.1,
    perspective: 0.5,
    fog: 0.4,
  },
  storm: {
    scale: 0.55,
    speed: 1.6,
    direction: 236,
    chop: 1,
    stretch: 0.3,
    glint: 1.3,
    contrast: 1.8,
    perspective: 0.8,
    fog: 0.35,
  },
  signal: {
    scale: 0.85,
    speed: 1.2,
    direction: 180,
    chop: 0.6,
    stretch: 0.85,
    glint: 0.25,
    contrast: 1.2,
    perspective: 0,
    fog: 0,
  },
};

const PIXEL_BUDGET = 2.4e6;
const FRAME_INTERVAL = 1000 / 30;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const parseColor = (value: string, fallback: Rgba): Rgba => {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return fallback;
    ctx.fillStyle = "#000000";
    ctx.fillStyle = value;
    const resolved = ctx.fillStyle;
    if (resolved.startsWith("#")) {
      const n = Number.parseInt(resolved.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
    }
    const parts = resolved.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return fallback;
    return [
      Number(parts[0]) / 255,
      Number(parts[1]) / 255,
      Number(parts[2]) / 255,
      parts[3] ? Number(parts[3]) : 1,
    ];
  } catch {
    return fallback;
  }
};

const passVertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fieldFragment = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform vec4 uGrid;
uniform vec2 uOrigin;
uniform vec2 uSlat;
uniform float uTime;
uniform float uScale;
uniform float uDirection;
uniform float uChop;
uniform float uStretch;
uniform float uGlint;
uniform float uContrast;
uniform float uPerspective;
uniform float uFog;
uniform float uIntro;
uniform vec2 uPointer;
uniform float uPointerStrength;
out vec4 fragColor;

const float TURN[4] = float[4](0.0, -0.95, 0.78, 1.62);
const float LENGTH[4] = float[4](2.6, 1.7, 1.12, 0.76);
const float HEIGHT[4] = float[4](1.0, 0.75, 0.5, 0.3);
const float SHIFT[4] = float[4](0.0, 2.3, 4.1, 1.1);

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  float row = uGrid.y - 1.0 - cell.y;
  vec2 center = uOrigin + vec2(cell.x, row) * uGrid.zw + uSlat * 0.5;
  float v = clamp(center.y / uSize.y, 0.0, 1.0);

  float horizon = mix(8.0, 0.5, uPerspective);
  float depth = (1.0 + horizon) / (v + horizon);
  vec2 world = vec2((center.x - uSize.x * 0.5) / uSize.y * depth, (depth - 1.0) * horizon * 2.2);
  world /= max(uScale, 0.05);

  float meander = 0.55 * sin(dot(world, vec2(0.23, 0.41)) * 0.9 + uTime * 0.13)
    + 0.3 * sin(dot(world, vec2(-0.37, 0.19)) * 1.4 - uTime * 0.09);

  float steep = uChop * 0.45;
  float height = 0.0;
  float total = 0.0;
  for (int i = 0; i < 4; i++) {
    float angle = uDirection + TURN[i];
    vec2 heading = vec2(cos(angle), sin(angle));
    float k = 6.2831853 / LENGTH[i];
    float omega = sqrt(9.81 * k) * 0.35;
    float theta = k * dot(world, heading) - omega * uTime + SHIFT[i] + meander * (0.6 + 0.3 * float(i));
    height += HEIGHT[i] * (cos(theta) + steep * cos(2.0 * theta));
    total += HEIGHT[i] * (1.0 + steep);
  }
  float level = clamp(0.5 + 0.5 * height / (total * 0.85), 0.0, 1.0);
  float ptrDist = length(world - vec2((uPointer.x - 0.5) * uSize.x / max(uScale, 0.05), (uPointer.y - 0.5) * uSize.y / max(uScale, 0.05)));
  height += sin(ptrDist * 6.2831853 / LENGTH[0] - uTime * 1.7) * (0.22 * uPointerStrength);
  float crest = smoothstep(0.6, 1.0, level);
  float glint = crest * crest * uGlint;

  float haze = mix(1.0, 1.0 - uFog, pow(1.0 - v, 1.4));
  float light = (pow(level, uContrast) + (glint + uPointerStrength * exp(-ptrDist * 2.2) * 0.85) * 0.8) * haze;

  float front = uIntro * 1.35;
  float reveal = 1.0 - smoothstep(front - 0.35, front, v);
  float sweep = exp(-pow((v - front + 0.22) / 0.07, 2.0)) * (1.0 - uIntro);
  light = (light + sweep * 0.8) * reveal;
  light = max(light, 0.045 * reveal);
  float span = mix(1.0 - uStretch, 1.0, level);
  span = clamp(span, 0.08, 1.0) * mix(0.1, 1.0, reveal);
  float tint = clamp(glint * 1.4 + sweep, 0.0, 1.0);

  fragColor = vec4(clamp(light, 0.0, 1.0), span, tint, 0.5);
}
`;

const slatFragment = `#version 300 es
precision highp float;
uniform sampler2D tField;
uniform vec2 uSize;
uniform float uDpr;
uniform vec4 uGrid;
uniform vec2 uOrigin;
uniform vec2 uSlat;
uniform float uRound;
uniform vec3 uColor;
uniform vec3 uGlintColor;
uniform vec4 uBackground;
out vec4 fragColor;

float pill(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 local = p - uOrigin;
  vec2 cell = floor(local / uGrid.zw);
  vec4 background = vec4(uBackground.rgb * uBackground.a, uBackground.a);
  vec4 slat = vec4(0.0);
  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= uGrid.x || cell.y >= uGrid.y) {
    fragColor = slat + background * (1.0 - slat.a);
    return;
  }
  vec4 field = texelFetch(tField, ivec2(int(cell.x), int(uGrid.y - 1.0 - cell.y)), 0);
  vec2 offset = local - cell * uGrid.zw - uSlat * 0.5;
  vec2 halfSize = vec2(uSlat.x * 0.5, uSlat.y * 0.5 * field.g);
  float radius = uRound * min(halfSize.x, halfSize.y);
  float alpha = clamp(0.5 - pill(offset, halfSize, radius) * uDpr, 0.0, 1.0) * field.r;
  slat = vec4(mix(uColor, uGlintColor, field.b) * alpha, alpha);
  fragColor = slat + background * (1.0 - slat.a);
}
`;

export function createMicroSlats(
  mount: HTMLElement,
  options: MicroSlatsOptions,
): MicroSlatsInstance | null {
  const preset = SWELL_PRESETS[options.preset ?? "tide"];
  const overrides = options.overrides ?? {};
  const baseSlatWidth = clamp(options.slatWidth ?? 12, 1, 64);
  const baseSlatHeight = clamp(options.slatHeight ?? 28, 2, 240);
  const baseGap = clamp(options.gap ?? 4, 0, 64);
  const settings: Settings = {
    ...preset,
    ...overrides,
    color: parseColor(options.color, [0.25, 0.32, 0.75, 1]),
    glintColor: parseColor(options.glintColor, [0.8, 0.9, 1, 1]),
    backgroundColor: parseColor(options.backgroundColor, [0, 0, 0, 0]),
    slatWidth: baseSlatWidth,
    slatHeight: baseSlatHeight,
    gap: baseGap,
    roundness: clamp(options.roundness ?? 0.78, 0, 1),
    introDuration: Math.max(0.2, options.introDuration ?? 1.6),
  };

  let renderer: Renderer;
  try {
    renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
    });
  } catch {
    return null;
  }

  const gl = renderer.gl;
  if (!renderer.isWebgl2) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }

  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "auto";
  canvas.setAttribute("aria-hidden", "true");
  mount.appendChild(canvas);

  const geometry = new Triangle(gl);
  const fieldTarget = new RenderTarget(gl, {
    width: 1,
    height: 1,
    depth: false,
    minFilter: gl.NEAREST,
    magFilter: gl.NEAREST,
  });

  const fieldUniforms: FieldUniforms = {
    uSize: { value: [1, 1] },
    uGrid: { value: [1, 1, 1, 1] },
    uOrigin: { value: [0, 0] },
    uSlat: { value: [1, 1] },
    uTime: { value: 0 },
    uScale: { value: settings.scale },
    uDirection: { value: (settings.direction * Math.PI) / 180 },
    uChop: { value: settings.chop },
    uStretch: { value: settings.stretch },
    uGlint: { value: settings.glint },
    uContrast: { value: settings.contrast },
    uPerspective: { value: settings.perspective },
    uFog: { value: settings.fog },
    uIntro: { value: 1 },
    uPointer: { value: [0.5, 0.5] },
    uPointerStrength: { value: 0 },
  };

  const fieldMesh = new Mesh(gl, {
    geometry,
    program: new Program(gl, {
      vertex: passVertex,
      fragment: fieldFragment,
      uniforms: fieldUniforms,
      depthTest: false,
      depthWrite: false,
    }),
  });

  const slatUniforms: SlatUniforms = {
    tField: { value: fieldTarget.texture },
    uSize: { value: [1, 1] },
    uDpr: { value: 1 },
    uGrid: { value: [1, 1, 1, 1] },
    uOrigin: { value: [0, 0] },
    uSlat: { value: [1, 1] },
    uRound: { value: settings.roundness },
    uColor: { value: settings.color.slice(0, 3) },
    uGlintColor: { value: settings.glintColor.slice(0, 3) },
    uBackground: { value: settings.backgroundColor },
  };

  const slatMesh = new Mesh(gl, {
    geometry,
    program: new Program(gl, {
      vertex: passVertex,
      fragment: slatFragment,
      uniforms: slatUniforms,
      depthTest: false,
      depthWrite: false,
    }),
  });

  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = document.documentElement.dataset.motion === "calm" || reducedQuery.matches;
  let paused = false;
  let width = 1;
  let height = 1;
  let raf = 0;
  let last = performance.now();
  let lastRender = 0;
  let time = 0;
  let introClock = document.querySelector("[data-intro]") ? 0 : 1;
  let visible = true;
  let alive = true;
  let gridCache: GridLayout | null = null;
  let pointer: [number, number] = [0.5, 0.5];
  let pointerStrength = 0;

  const layout = (): GridLayout => {
    const pitchX = settings.slatWidth + settings.gap;
    const pitchY = settings.slatHeight + settings.gap;
    const cols = Math.min(2048, Math.ceil((width + settings.gap) / pitchX) + 1);
    const rows = Math.min(2048, Math.ceil((height + settings.gap) / pitchY) + 1);
    const originX = (width - (cols * pitchX - settings.gap)) / 2;
    const originY = (height - (rows * pitchY - settings.gap)) / 2;

    if (fieldTarget.width !== cols || fieldTarget.height !== rows) {
      fieldTarget.setSize(cols, rows);
      slatUniforms.tField.value = fieldTarget.texture;
    }

    return {
      slatW: settings.slatWidth,
      slatH: settings.slatHeight,
      grid: [cols, rows, pitchX, pitchY],
      origin: [originX, originY],
    };
  };

  const render = (now: number, advance: boolean): void => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    if (advance && !reduced && !paused) {
      time += dt * settings.speed;
      introClock = Math.min(1, introClock + dt / settings.introDuration);
    }

    const introEase =
      introClock < 0.5
        ? 4 * introClock * introClock * introClock
        : 1 - (-2 * introClock + 2) ** 3 / 2;
    const grid = gridCache ?? layout();
    gridCache = grid;

    fieldUniforms.uSize.value = [width, height];
    fieldUniforms.uGrid.value = grid.grid;
    fieldUniforms.uOrigin.value = grid.origin;
    fieldUniforms.uSlat.value = [grid.slatW, grid.slatH];
    fieldUniforms.uTime.value = time;
    fieldUniforms.uScale.value = settings.scale;
    fieldUniforms.uDirection.value = (settings.direction * Math.PI) / 180;
    fieldUniforms.uChop.value = settings.chop;
    fieldUniforms.uStretch.value = settings.stretch;
    fieldUniforms.uGlint.value = settings.glint;
    fieldUniforms.uContrast.value = settings.contrast;
    fieldUniforms.uPerspective.value = settings.perspective;
    fieldUniforms.uFog.value = settings.fog;
    fieldUniforms.uIntro.value = reduced ? 1 : introEase;
    fieldUniforms.uPointer.value = pointer;
    fieldUniforms.uPointerStrength.value = reduced ? 0 : pointerStrength;

    renderer.render({ scene: fieldMesh, target: fieldTarget });

    slatUniforms.uSize.value = [width, height];
    slatUniforms.uDpr.value = renderer.dpr;
    slatUniforms.uGrid.value = grid.grid;
    slatUniforms.uOrigin.value = grid.origin;
    slatUniforms.uSlat.value = [grid.slatW, grid.slatH];
    slatUniforms.uRound.value = settings.roundness;
    slatUniforms.uColor.value = settings.color.slice(0, 3);
    slatUniforms.uGlintColor.value = settings.glintColor.slice(0, 3);
    slatUniforms.uBackground.value = settings.backgroundColor;

    renderer.render({ scene: slatMesh });
  };

  const shouldAnimate = (): boolean => alive && visible && !document.hidden && !reduced && !paused;

  const tick = (now: number): void => {
    raf = 0;
    if (!alive) return;
    /* The slats drift slowly; 30fps halves the GPU/main-thread cost without a
       visible difference, leaving more frame budget for scroll choreography. */
    if (now - lastRender >= FRAME_INTERVAL - 1) {
      lastRender = now;
      render(now, true);
    }
    if (shouldAnimate()) raf = requestAnimationFrame(tick);
  };

  const start = (): void => {
    if (raf || !shouldAnimate()) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const stop = (): void => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const resize = (): void => {
    width = Math.max(1, mount.clientWidth);
    height = Math.max(1, mount.clientHeight);

    // Denser slats on phones, wider slats on desktop; both keep the same visual pitch.
    const compact = width < 768;
    settings.slatWidth = compact ? Math.min(baseSlatWidth, 10) : baseSlatWidth;
    settings.slatHeight = compact ? Math.min(baseSlatHeight, 24) : baseSlatHeight;
    settings.gap = compact ? Math.min(baseGap, 3) : baseGap;

    const budgetDpr = Math.sqrt(PIXEL_BUDGET / (width * height));
    renderer.dpr = Math.min(window.devicePixelRatio || 1, 2, Math.max(1, budgetDpr));
    renderer.setSize(width, height);
    gridCache = null;
    render(performance.now(), false);
    start();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
      else stop();
    },
    { threshold: 0.01 },
  );
  intersectionObserver.observe(mount);

  const onVisibility = (): void => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const setPointerFromEvent = (event: PointerEvent): void => {
    const rect = mount.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    pointer = [(event.clientX - rect.left) / width, (event.clientY - rect.top) / height];
    pointerStrength = event.pointerType === "touch" ? 0 : 1;
  };
  const clearPointer = (): void => {
    pointer = [0.5, 0.5];
    pointerStrength = 0;
  };
  const onPointerMove = (event: PointerEvent): void => setPointerFromEvent(event);
  const onPointerDown = (event: PointerEvent): void => setPointerFromEvent(event);
  const onPointerLeave = (): void => clearPointer();
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
  canvas.addEventListener("pointerleave", onPointerLeave);

  const onReducedChange = (event: MediaQueryListEvent): void => {
    reduced = event.matches;
    if (reduced) {
      stop();
      render(performance.now(), false);
    } else {
      start();
    }
  };
  reducedQuery.addEventListener("change", onReducedChange);

  resize();

  return {
    destroy: () => {
      alive = false;
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", onReducedChange);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      gl.deleteFramebuffer(fieldTarget.buffer);
      gl.deleteTexture(fieldTarget.texture.texture);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    },
    playIntro: () => {
      introClock = 0;
      start();
      if (reduced) render(performance.now(), false);
    },
    setTheme: (color, glintColor, backgroundColor) => {
      settings.color = parseColor(color, settings.color);
      settings.glintColor = parseColor(glintColor, settings.glintColor);
      settings.backgroundColor = parseColor(backgroundColor, settings.backgroundColor);
      if (!raf) render(performance.now(), false);
    },
    setPaused: (next) => {
      paused = next;
      if (paused) stop();
      else {
        last = performance.now();
        start();
      }
    },
    setMotion: (calm) => {
      reduced = calm;
      if (calm) {
        stop();
        render(performance.now(), false);
      } else {
        start();
      }
    },
  };
}
