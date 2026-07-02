// eslint-disable-next-line import/no-unresolved -- Vite raw shader imports use query suffixes.
import fragmentSource from '@/assets/shaders/wizard-orb.frag?raw';

import artUrl from '@/assets/orbs/wizard/art.jpg';
import emptyUrl from '@/assets/orbs/wizard/empty_aligned.jpg';
import maskUrl from '@/assets/orbs/wizard/mask.png';
import normalUrl from '@/assets/orbs/wizard/normal_aligned.jpg';
import packUrl from '@/assets/orbs/wizard/pack_aligned.jpg';
import stoneUrl from '@/assets/orbs/wizard/stone_aligned.jpg';

const VERTEX_SOURCE = `#version 300 es
layout(location=0) in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const SAMPLERS = [
  ['uArt', artUrl],
  ['uMask', maskUrl],
  ['uNorm', normalUrl],
  ['uEmpty', emptyUrl],
  ['uPack', packUrl],
  ['uStone', stoneUrl],
];

const FLOAT_UNIFORMS = [
  'uTime',
  'uHP',
  'uMP',
  'uLvlL',
  'uLvlR',
  'uSloshL',
  'uSloshR',
  'uBeat',
  'uFlashL',
  'uFlashR',
  'uFullL',
  'uFullR',
  'uPoison',
  'uBleed',
  'uResL',
  'uResR',
  'uResLvlL',
  'uResLvlR',
  'uMotion',
  'uSide',
  'uCrop',
];

const INT_UNIFORMS = ['uOct'];
const ORB_SIDE = { hp: 0, mp: 1 };
const CROP_OFFSET_X = { hp: -0.52, mp: 0.52 };

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const clamp01 = value => clamp(value, 0, 1);

const levelFromFill = (fill) => {
  const f = clamp01(fill);
  const fc = clamp(f, 0.0005, 0.9995);
  let h = (2 * fc) - 1;

  for (let i = 0; i < 6; i += 1) {
    const volume = (2 + (3 * h) - (h * h * h)) / 4;
    const derivative = Math.max((3 - (3 * h * h)) / 4, 0.001);
    h = clamp(h - ((volume - fc) / derivative), -1, 1);
  }

  const volumetric = h * 0.94;
  const linear = ((2 * f) - 1) * 1.045;
  const topBlend = smoothstep(0.70, 0.95, f);
  const bottomBlend = smoothstep(0.30, 0.05, f);
  const weight = clamp01(topBlend + bottomBlend);
  return (volumetric * (1 - weight)) + (linear * weight);
};

const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - (2 * t));
};

const patchedFragmentSource = () => {
  const withUniforms = fragmentSource.replace(
    'uniform float uMotion;    // 1.0 normal, lower if reduced motion',
    `uniform float uMotion;    // 1.0 normal, lower if reduced motion
uniform float uSide;      // 0 = life crop, 1 = mana crop
uniform float uCrop;      // art-pixel crop size around selected orb
uniform vec2 uCropOffset; // radius-scaled art-pixel offset from orb center`,
  );

  const withCrop = withUniforms.replace(
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    `  vec2 localUv = gl_FragCoord.xy / uRes;
  vec3 activeOrb = uSide < 0.5 ? ORBL : ORBR;
  float cropSize = activeOrb.z * uCrop;
  vec2 cropCenter = activeOrb.xy + uCropOffset * activeOrb.z;
  vec2 px = cropCenter + (localUv - vec2(0.5)) * cropSize;
  vec2 uv = px / ART;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    outColor = vec4(0.0);
    return;
  }`,
  );

  return withCrop.replace('  vec2 px = uv * ART;', '  // px is mapped into a square crop around the selected orb.');
};

const loadImage = url => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = url;
});

const createShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || 'Failed to compile shader.');
  }
  return shader;
};

const createProgram = (gl) => {
  const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, patchedFragmentSource());
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message || 'Failed to link shader program.');
  }

  return program;
};

class WizardOrbRenderer {
  constructor(canvas, {
    variant = 'hp',
    fill = 1,
    crop = 3.25,
  } = {}) {
    this.canvas = canvas;
    this.variant = variant;
    this.side = ORB_SIDE[variant] ?? 0;
    this.crop = crop;
    this.currentFill = clamp01(fill);
    this.targetFill = this.currentFill;
    this.displayFill = this.currentFill;
    this.slosh = 0;
    this.sloshVelocity = 0;
    this.flash = 0;
    this.fullBloom = 0;
    this.previousLevel = levelFromFill(this.displayFill);
    this.beat = 0;
    this.startedAt = performance.now();
    this.lastFrameAt = this.startedAt;
    this.raf = null;
    this.ready = false;
    this.destroyed = false;
    this.locations = {};

    this.gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });

    if (!this.gl) {
      this.drawFallback();
      return;
    }

    this.initialise().catch((error) => {
      console.warn('[WizardOrbRenderer] Falling back to 2D orb renderer.', error);
      this.gl = null;
      this.drawFallback();
    });
  }

  async initialise() {
    const gl = this.gl;
    this.program = createProgram(gl);
    gl.useProgram(this.program);

    const quad = gl.createBuffer();
    this.quad = quad;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.locations.uRes = gl.getUniformLocation(this.program, 'uRes');
    this.locations.uCropOffset = gl.getUniformLocation(this.program, 'uCropOffset');
    [...FLOAT_UNIFORMS, ...INT_UNIFORMS].forEach((name) => {
      this.locations[name] = gl.getUniformLocation(this.program, name);
    });

    const images = await Promise.all(SAMPLERS.map(([, url]) => loadImage(url)));
    if (this.destroyed) {
      return;
    }

    images.forEach((image, index) => {
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, this.createTexture(image));
      const location = gl.getUniformLocation(this.program, SAMPLERS[index][0]);
      if (location) {
        gl.uniform1i(location, index);
      }
    });

    this.ready = true;
    this.render = this.render.bind(this);
    this.raf = requestAnimationFrame(this.render);
  }

  createTexture(image) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  setVariant(variant) {
    this.variant = variant;
    this.side = ORB_SIDE[variant] ?? 0;
  }

  setFill(fill) {
    const next = clamp01(fill);
    const delta = next - this.targetFill;
    this.targetFill = next;
    this.sloshVelocity += -delta * (delta < 0 ? 9 : 5);
    if (Math.abs(delta) > 0.08) {
      this.flash = Math.min(1.8, this.flash + (Math.abs(delta) * 2.4));
    }
  }

  resize() {
    const gl = this.gl;
    if (!gl) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(2, Math.round((rect.width || this.canvas.width || 128) * dpr));
    const height = Math.max(2, Math.round((rect.height || this.canvas.height || 128) * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  setFloat(name, value) {
    const location = this.locations[name];
    if (location !== null && location !== undefined) {
      this.gl.uniform1f(location, value);
    }
  }

  setInt(name, value) {
    const location = this.locations[name];
    if (location !== null && location !== undefined) {
      this.gl.uniform1i(location, value);
    }
  }

  render(timestamp) {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.render);
    if (!this.ready || !this.gl) return;

    const gl = this.gl;
    const dt = Math.min((timestamp - this.lastFrameAt) / 1000, 0.05);
    this.lastFrameAt = timestamp;

    this.currentFill += (this.targetFill - this.currentFill) * (1 - Math.exp(-dt * 12));
    this.displayFill += (this.currentFill - this.displayFill) * (1 - Math.exp(-dt * 5));

    this.sloshVelocity += ((-110 * this.slosh) - (7.5 * this.sloshVelocity)) * dt;
    this.slosh = clamp(this.slosh + (this.sloshVelocity * dt), -0.2, 0.2);
    this.flash *= Math.exp(-dt * 3.2);

    const level = levelFromFill(this.displayFill);
    if (level >= 0.95 && this.previousLevel < 0.95) {
      this.fullBloom = 1;
    }
    this.previousLevel = level;
    this.fullBloom *= Math.exp(-dt * 1.6);

    const lowHealth = this.variant === 'hp' ? smoothstep(0.55, 0.06, this.displayFill) : 0;
    this.beat += dt * (42 + (126 * lowHealth)) / 60;

    this.resize();
    gl.useProgram(this.program);
    gl.uniform2f(this.locations.uRes, this.canvas.width, this.canvas.height);
    this.setFloat('uTime', (timestamp - this.startedAt) / 1000);
    this.setFloat('uHP', this.variant === 'hp' ? this.displayFill : 1);
    this.setFloat('uMP', this.variant === 'mp' ? this.displayFill : 1);
    this.setFloat('uLvlL', this.variant === 'hp' ? level : levelFromFill(1));
    this.setFloat('uLvlR', this.variant === 'mp' ? level : levelFromFill(1));
    this.setFloat('uSloshL', this.variant === 'hp' ? this.slosh : 0);
    this.setFloat('uSloshR', this.variant === 'mp' ? this.slosh : 0);
    this.setFloat('uBeat', this.beat);
    this.setFloat('uFlashL', this.variant === 'hp' ? this.flash : 0);
    this.setFloat('uFlashR', this.variant === 'mp' ? this.flash : 0);
    this.setFloat('uFullL', this.variant === 'hp' ? this.fullBloom : 0);
    this.setFloat('uFullR', this.variant === 'mp' ? this.fullBloom : 0);
    this.setFloat('uPoison', 0);
    this.setFloat('uBleed', 0);
    this.setFloat('uResL', 0);
    this.setFloat('uResR', 0);
    this.setFloat('uResLvlL', 2);
    this.setFloat('uResLvlR', 2);
    this.setFloat('uMotion', 1);
    this.setFloat('uSide', this.side);
    this.setFloat('uCrop', this.crop);
    if (this.locations.uCropOffset) {
      this.gl.uniform2f(this.locations.uCropOffset, CROP_OFFSET_X[this.variant] ?? 0, 0);
    }
    this.setInt('uOct', 4);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  drawFallback() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const width = this.canvas.width || 128;
    const height = this.canvas.height || 128;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.42;
    ctx.clearRect(0, 0, width, height);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    if (this.variant === 'hp') {
      grad.addColorStop(0, '#ff4a3f');
      grad.addColorStop(1, '#430406');
    } else {
      grad.addColorStop(0, '#62a0ff');
      grad.addColorStop(1, '#071948');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  destroy() {
    this.destroyed = true;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }
}

export default WizardOrbRenderer;
