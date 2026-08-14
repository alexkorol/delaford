const MIN_VIEWPORT_SIZE = 10;
const MIN_ZOOM = 0.05;
const MIN_DEPTH = 40;

const defaultHeightAt = () => 0;
const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
const interpolate = (start, end, amount) => start + ((end - start) * amount);

class PerspectiveCamera {
  constructor(options = {}) {
    this.heightAt = typeof options.heightAt === 'function'
      ? options.heightAt
      : defaultHeightAt;
    this.userZoom = Number.isFinite(options.userZoom) ? options.userZoom : 1;
    this.valid = false;
    this.width = 0;
    this.height = 0;
    this.x = 0;
    this.y = 0;
    this.horizon = 0;
    this.focus = 0;
    this.zoom = MIN_ZOOM;
    this.depthToFocus = 1;
    this.projectionArea = 1;
    this.cameraFootY = 0;
    this.dofStrength = 1;
  }

  update({
    width,
    height,
    x,
    y,
    userZoom = this.userZoom,
  } = {}) {
    this.width = Number.isFinite(width) ? width : 0;
    this.height = Number.isFinite(height) ? height : 0;
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
    this.userZoom = Number.isFinite(userZoom) ? userZoom : 1;

    if (this.width < MIN_VIEWPORT_SIZE || this.height < MIN_VIEWPORT_SIZE) {
      this.valid = false;
      return false;
    }

    this.horizon = -0.45 * this.height;
    this.focus = 0.65 * this.height;
    this.zoom = Math.max(
      MIN_ZOOM,
      Math.max(this.width / 1150, this.height / 1500) * this.userZoom,
    );
    this.depthToFocus = (this.focus - this.horizon) / this.zoom;
    this.projectionArea = (this.focus - this.horizon) * this.depthToFocus;
    this.cameraFootY = this.y + this.depthToFocus;
    const zoomProgress = clamp((this.userZoom - 0.72) / 0.88, 0, 1);
    // The old miniature-effect blur made distant monsters and scenery dissolve
    // into the already dark ground. Retain just enough focus falloff to sell
    // depth without sacrificing combat readability.
    this.dofStrength = interpolate(0.32, 0.82, zoomProgress);
    this.valid = Number.isFinite(this.cameraFootY)
      && Number.isFinite(this.projectionArea)
      && this.depthToFocus > 0;
    return this.valid;
  }

  depthAt(worldY) {
    return Math.max(MIN_DEPTH, this.cameraFootY - worldY);
  }

  project(worldX, worldY, elevation = 0) {
    if (!this.valid) {
      return null;
    }

    const depth = this.depthAt(worldY);
    const scale = (this.zoom * this.depthToFocus) / depth;

    return {
      x: (this.width / 2) + ((worldX - this.x) * scale),
      y: this.horizon + (this.projectionArea / depth) - (elevation * scale),
      scale,
      depth,
    };
  }

  projectTerrain(worldX, worldY) {
    return this.project(worldX, worldY, this.heightAt(worldX, worldY));
  }

  unproject(screenX, screenY) {
    if (!this.valid) {
      return null;
    }

    const denominator = Math.max(1, screenY - this.horizon);
    const depth = this.projectionArea / denominator;
    const projectionScale = this.zoom * this.depthToFocus;

    return {
      x: this.x + (((screenX - (this.width / 2)) * depth) / projectionScale),
      y: this.cameraFootY - depth,
    };
  }

  projectWithShaderMath(worldX, worldY, elevation = 0) {
    if (!this.valid) {
      return null;
    }

    const depth = this.cameraFootY - worldY;
    const projectionScale = this.zoom * this.depthToFocus;
    const clipX = (2 / this.width) * (worldX - this.x) * projectionScale;
    const clipY = depth - ((2 / this.height) * (
      (this.horizon * depth) + this.projectionArea - (elevation * projectionScale)
    ));
    const normalizedX = clipX / depth;
    const normalizedY = clipY / depth;

    return {
      x: ((normalizedX + 1) * this.width) / 2,
      y: ((1 - normalizedY) * this.height) / 2,
    };
  }

  circleOfConfusion(depth) {
    if (!this.valid || !Number.isFinite(depth)) {
      return 0;
    }
    const distance = (Math.abs(depth - this.depthToFocus) / this.depthToFocus)
      * this.dofStrength;
    return clamp((distance - 0.04) / 0.92, 0, 1);
  }
}

export {
  MIN_DEPTH,
  MIN_VIEWPORT_SIZE,
  MIN_ZOOM,
  defaultHeightAt,
};
export default PerspectiveCamera;
