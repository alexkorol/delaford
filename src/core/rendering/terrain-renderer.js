const GRID_COLUMNS = 161;
const GRID_ROWS = 161;
const MAP_MARGIN_TILES = 8;
const BAKE_TILE_SIZE = 16;

const nextPowerOfTwo = (value) => {
  let result = 1;
  while (result < value) {
    result *= 2;
  }
  return result;
};

const compileShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error.';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

class TerrainRenderer {
  constructor(map, options = {}) {
    this.map = map;
    this.heightAt = typeof options.heightAt === 'function' ? options.heightAt : () => 0;
    this.skipBackgroundGids = options.skipBackgroundGids instanceof Set
      ? options.skipBackgroundGids
      : new Set();
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.ready = false;
    this.failed = false;
    this.program = null;
    this.locations = {};
    this.buffers = [];
    this.texture = null;
    this.indexCount = 0;
    this.contextLost = false;
    this.destroyed = false;
    this.stats = {
      anisotropy: 1,
      drawCalls: 0,
      textureSize: 0,
    };
    this.handleContextLost = this.handleContextLost.bind(this);
    this.handleContextRestored = this.handleContextRestored.bind(this);
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
  }

  initialize() {
    if (this.ready || this.failed || this.contextLost || this.destroyed) {
      return this.ready;
    }

    if (!this.gl) {
      this.failed = true;
      return false;
    }

    try {
      this.createProgram();
      this.createMesh();
      this.createGroundTexture();
      this.gl.enable(this.gl.DEPTH_TEST);
      this.ready = true;
    } catch (error) {
      console.warn('[renderer] WebGL terrain unavailable; using legacy ground.', error);
      this.failed = true;
      this.destroyResources();
    }

    return this.ready;
  }

  createProgram() {
    const gl = this.gl;
    const vertexSource = `
      attribute vec2 aPosition;
      attribute float aHeight;
      uniform vec2 uCamera;
      uniform float uCameraFootY;
      uniform float uProjectionScale;
      uniform float uProjectionArea;
      uniform float uHorizon;
      uniform float uWidth;
      uniform float uHeight;
      uniform float uNear;
      uniform float uFar;
      uniform vec2 uWorldOrigin;
      uniform vec2 uWorldSize;
      varying vec2 vUv;
      varying float vDepth;

      void main() {
        float depth = uCameraFootY - aPosition.y;
        float clipX = (2.0 / uWidth) * (aPosition.x - uCamera.x) * uProjectionScale;
        float clipY = depth - (2.0 / uHeight) * (
          uHorizon * depth + uProjectionArea - aHeight * uProjectionScale
        );
        float clipZ = depth * (2.0 * (depth - uNear) / (uFar - uNear) - 1.0);
        gl_Position = vec4(clipX, clipY, clipZ, depth);
        vUv = (aPosition - uWorldOrigin) / uWorldSize;
        vDepth = depth;
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform sampler2D uTexture;
      uniform float uDepthToFocus;
      uniform float uDofStrength;
      uniform vec3 uSky;
      varying vec2 vUv;
      varying float vDepth;

      void main() {
        float focusDistance = abs(vDepth - uDepthToFocus) / uDepthToFocus * uDofStrength;
        float circleOfConfusion = clamp((focusDistance - 0.20) / 0.65, 0.0, 1.0);
        vec3 sharp = texture2D(uTexture, vUv).rgb;
        vec3 soft = texture2D(uTexture, vUv, 1.8).rgb;
        vec3 colour = mix(sharp, soft, circleOfConfusion);
        colour = pow(max(colour, vec3(0.0)), vec3(0.82));
        float luminance = dot(colour, vec3(0.2126, 0.7152, 0.0722));
        colour = mix(vec3(luminance), colour, 1.10);
        float haze = clamp((vDepth / uDepthToFocus - 1.48) / 1.62, 0.0, 1.0) * 0.24;
        gl_FragColor = vec4(mix(colour, uSky, haze), 1.0);
      }
    `;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(this.program) || 'Could not link terrain shader.');
    }

    gl.useProgram(this.program);
    [
      'uCamera',
      'uCameraFootY',
      'uProjectionScale',
      'uProjectionArea',
      'uHorizon',
      'uWidth',
      'uHeight',
      'uNear',
      'uFar',
      'uWorldOrigin',
      'uWorldSize',
      'uDepthToFocus',
      'uDofStrength',
      'uSky',
      'uTexture',
    ].forEach((name) => {
      this.locations[name] = gl.getUniformLocation(this.program, name);
    });
  }

  createBuffer(target, data) {
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(target, buffer);
    this.gl.bufferData(target, data, this.gl.STATIC_DRAW);
    this.buffers.push(buffer);
    return buffer;
  }

  createMesh() {
    const gl = this.gl;
    const tileSize = this.map.config.map.tileset.tile.width;
    const mapSize = this.map.config.map.size;
    const margin = MAP_MARGIN_TILES * tileSize;
    const worldWidth = mapSize.x * tileSize;
    const worldHeight = mapSize.y * tileSize;
    const originX = -margin;
    const originY = -margin;
    const meshWidth = worldWidth + (margin * 2);
    const meshHeight = worldHeight + (margin * 2);
    const stepX = meshWidth / (GRID_COLUMNS - 1);
    const stepY = meshHeight / (GRID_ROWS - 1);
    const positions = new Float32Array(GRID_COLUMNS * GRID_ROWS * 2);
    const heights = new Float32Array(GRID_COLUMNS * GRID_ROWS);

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let column = 0; column < GRID_COLUMNS; column += 1) {
        const worldX = originX + (column * stepX);
        const worldY = originY + (row * stepY);
        const vertex = (row * GRID_COLUMNS) + column;
        positions[vertex * 2] = worldX;
        positions[(vertex * 2) + 1] = worldY;
        heights[vertex] = this.heightAt(worldX, worldY);
      }
    }

    const indices = new Uint16Array((GRID_COLUMNS - 1) * (GRID_ROWS - 1) * 6);
    let index = 0;
    for (let row = 0; row < GRID_ROWS - 1; row += 1) {
      for (let column = 0; column < GRID_COLUMNS - 1; column += 1) {
        const topLeft = (row * GRID_COLUMNS) + column;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + GRID_COLUMNS;
        const bottomRight = bottomLeft + 1;
        indices[index] = topLeft;
        indices[index + 1] = bottomLeft;
        indices[index + 2] = topRight;
        indices[index + 3] = topRight;
        indices[index + 4] = bottomLeft;
        indices[index + 5] = bottomRight;
        index += 6;
      }
    }
    this.indexCount = index;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.createBuffer(gl.ARRAY_BUFFER, positions));
    const positionLocation = gl.getAttribLocation(this.program, 'aPosition');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.createBuffer(gl.ARRAY_BUFFER, heights));
    const heightLocation = gl.getAttribLocation(this.program, 'aHeight');
    gl.enableVertexAttribArray(heightLocation);
    gl.vertexAttribPointer(heightLocation, 1, gl.FLOAT, false, 0, 0);

    this.createBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    this.worldOrigin = { x: originX, y: originY };
    this.worldSize = { width: meshWidth, height: meshHeight };
  }

  createGroundTexture() {
    const gl = this.gl;
    const ground = this.map.bakeGroundTexture({
      tileSize: BAKE_TILE_SIZE,
      marginTiles: MAP_MARGIN_TILES,
      flattenForeground: false,
      skipBackgroundGids: this.skipBackgroundGids,
    });
    const requestedSize = nextPowerOfTwo(Math.max(ground.width, ground.height));
    const maximumSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const textureSize = Math.min(requestedSize, maximumSize);
    this.stats.textureSize = textureSize;
    const uploadCanvas = document.createElement('canvas');
    uploadCanvas.width = textureSize;
    uploadCanvas.height = textureSize;
    const uploadContext = uploadCanvas.getContext('2d');
    uploadContext.imageSmoothingEnabled = false;
    uploadContext.drawImage(ground, 0, 0, textureSize, textureSize);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      uploadCanvas,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic')
      || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
      || gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
    if (anisotropy) {
      const available = gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      this.stats.anisotropy = Math.min(8, available);
      gl.texParameterf(
        gl.TEXTURE_2D,
        anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
        this.stats.anisotropy,
      );
    }

    gl.uniform1i(this.locations.uTexture, 0);
    ground.width = 1;
    ground.height = 1;
    uploadCanvas.width = 1;
    uploadCanvas.height = 1;
  }

  render(camera, skyColour) {
    if (!camera || !camera.valid || !this.initialize()) {
      return false;
    }

    const gl = this.gl;
    const width = Math.max(1, Math.floor(camera.width));
    const height = Math.max(1, Math.floor(camera.height));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform2f(this.locations.uCamera, camera.x, camera.y);
    gl.uniform1f(this.locations.uCameraFootY, camera.cameraFootY);
    gl.uniform1f(this.locations.uProjectionScale, camera.zoom * camera.depthToFocus);
    gl.uniform1f(this.locations.uProjectionArea, camera.projectionArea);
    gl.uniform1f(this.locations.uHorizon, camera.horizon);
    gl.uniform1f(this.locations.uWidth, width);
    gl.uniform1f(this.locations.uHeight, height);
    gl.uniform1f(this.locations.uNear, 60);
    gl.uniform1f(this.locations.uFar, camera.depthToFocus * 3.2);
    gl.uniform2f(
      this.locations.uWorldOrigin,
      this.worldOrigin.x,
      this.worldOrigin.y,
    );
    gl.uniform2f(
      this.locations.uWorldSize,
      this.worldSize.width,
      this.worldSize.height,
    );
    gl.uniform1f(this.locations.uDepthToFocus, camera.depthToFocus);
    gl.uniform1f(this.locations.uDofStrength, camera.dofStrength);
    gl.uniform3f(
      this.locations.uSky,
      skyColour[0] / 255,
      skyColour[1] / 255,
      skyColour[2] / 255,
    );
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    this.stats.drawCalls = 1;
    return true;
  }

  handleContextLost(event) {
    event.preventDefault();
    this.contextLost = true;
    this.ready = false;
    this.failed = false;
    this.buffers = [];
    this.texture = null;
    this.program = null;
    this.locations = {};
    this.stats.drawCalls = 0;
  }

  handleContextRestored() {
    if (this.destroyed) {
      return;
    }
    this.contextLost = false;
    this.failed = false;
    this.ready = false;
    this.initialize();
  }

  destroyResources() {
    if (!this.gl || this.contextLost) {
      return;
    }
    this.buffers.forEach(buffer => this.gl.deleteBuffer(buffer));
    this.buffers = [];
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
    this.ready = false;
  }

  destroy() {
    this.destroyed = true;
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored, false);
    this.destroyResources();
    const extension = this.gl && this.gl.getExtension('WEBGL_lose_context');
    if (extension) {
      extension.loseContext();
    }
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}

export {
  BAKE_TILE_SIZE,
  GRID_COLUMNS,
  GRID_ROWS,
  MAP_MARGIN_TILES,
  nextPowerOfTwo,
};
export default TerrainRenderer;
