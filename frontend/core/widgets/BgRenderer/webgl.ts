import { WALLPAPER_BG_SIZE } from '~/const/wallpaper'
import { BG_RENDER_TYPE } from '~/lib/bg/constant'
import type { TBgRenderSpec } from '~/lib/bg/spec'
import { GRADIENT_RENDERER, WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'
import {
  TEXTURE_SHADER_BRANCHES,
  TEXTURE_SHADER_HELPERS,
  TEXTURE_SHADER_UV,
  TEXTURE_TYPE,
} from '~/lib/wallpaperMesh/texture/shader'

const MAX_COLORS = 6
const DPR_CAP = 2
// Flow is the highest fragment-cost renderer, so full-canvas output uses a
// lower internal pixel ratio while CSS keeps the visual size unchanged.
const FLOW_DPR_CAP = 1
const OIL_TEXTURE_DPR_CAP = 1
const FLOW_STRAND_COUNT = 7

const MESH_MODEL_UNIFORM = {
  [GRADIENT_RENDERER.FLOW]: 1,
  [GRADIENT_RENDERER.LIQUID]: 2,
} as const

const MESH_MODEL_SHADER_CONSTANTS = `
const int MESH_MODEL_FLOW = ${MESH_MODEL_UNIFORM[GRADIENT_RENDERER.FLOW]};
const int MESH_MODEL_LIQUID = ${MESH_MODEL_UNIFORM[GRADIENT_RENDERER.LIQUID]};
const int FLOW_STRAND_COUNT = ${FLOW_STRAND_COUNT};
`

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = vec2((aPosition.x + 1.0) * 0.5, (1.0 - aPosition.y) * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

const int MAX_COLORS = ${MAX_COLORS};
${MESH_MODEL_SHADER_CONSTANTS}
uniform int uMode;
uniform int uColorCount;
uniform int uMeshModel;
uniform int uTextureType;
uniform int uBgMode;
uniform float uFlow;
uniform float uSoftness;
uniform float uMeshSeed;
uniform float uMeshWarp;
uniform float uMeshScale;
uniform float uRadialRadius;
uniform float uTextureIntensity;
uniform float uTextureScale;
uniform float uMeshBrightness;
uniform float uMeshContrast;
uniform float uImageReady;
uniform vec2 uResolution;
uniform vec2 uImageSize;
uniform vec2 uRadialCenter;
uniform float uColorStops[MAX_COLORS];
uniform vec3 uColors[MAX_COLORS];
uniform sampler2D uImage;

varying vec2 vUv;

float random(vec2 value) {
  vec3 mixed = fract(vec3(value.xyx) * vec3(0.1031, 0.1030, 0.0973));
  mixed += dot(mixed, mixed.yzx + 33.33);
  return fract((mixed.x + mixed.y) * mixed.z);
}

float valueNoise(vec2 value) {
  vec2 cell = floor(value);
  vec2 local = fract(value);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  float a = random(cell + uMeshSeed * 0.017);
  float b = random(cell + vec2(1.0, 0.0) + uMeshSeed * 0.017);
  float c = random(cell + vec2(0.0, 1.0) + uMeshSeed * 0.017);
  float d = random(cell + vec2(1.0, 1.0) + uMeshSeed * 0.017);

  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

vec2 rotateUv(vec2 value, float angle) {
  float rad = radians(angle);
  float c = cos(rad);
  float s = sin(rad);

  return vec2(value.x * c - value.y * s, value.x * s + value.y * c);
}

vec3 colorAt(int index) {
  vec3 color = uColors[0];

  for (int i = 0; i < MAX_COLORS; i++) {
    if (i == index) {
      color = uColors[i];
    }
  }

  return color;
}

float stopAt(int index) {
  float stop = uColorStops[0];

  for (int i = 0; i < MAX_COLORS; i++) {
    if (i == index) {
      stop = uColorStops[i];
    }
  }

  return clamp(stop, 0.0, 1.0);
}

vec3 sampleGradient(float t) {
  if (uColorCount <= 1) return colorAt(0);

  float value = clamp(t, 0.0, 1.0);
  vec3 color = colorAt(uColorCount - 1);

  for (int i = 0; i < MAX_COLORS - 1; i++) {
    if (i >= uColorCount - 1) break;

    float leftStop = stopAt(i);
    float rightStop = max(stopAt(i + 1), leftStop + 0.0001);

    if (value <= leftStop) {
      color = colorAt(i);
      break;
    }

    if (value <= rightStop) {
      float localT = clamp((value - leftStop) / (rightStop - leftStop), 0.0, 1.0);
      color = mix(colorAt(i), colorAt(i + 1), localT);
      break;
    }
  }

  return color;
}

vec2 coverUv(vec2 uv) {
  if (uImageSize.x <= 0.0 || uImageSize.y <= 0.0) return uv;

  vec2 visible = vec2(1.0);
  float scale = max(uResolution.x / uImageSize.x, uResolution.y / uImageSize.y);
  visible.x = uResolution.x / (scale * uImageSize.x);
  visible.y = uResolution.y / (scale * uImageSize.y);

  return (uv - 0.5) * visible + 0.5;
}

vec4 containColor(vec2 uv) {
  if (uImageSize.x <= 0.0 || uImageSize.y <= 0.0) return vec4(0.0);

  float scale = min(uResolution.x / uImageSize.x, uResolution.y / uImageSize.y);
  vec2 drawSize = uImageSize * scale;
  vec2 rect = drawSize / uResolution;
  vec2 minUv = 0.5 - rect * 0.5;
  vec2 maxUv = 0.5 + rect * 0.5;

  if (uv.x < minUv.x || uv.y < minUv.y || uv.x > maxUv.x || uv.y > maxUv.y) {
    return vec4(0.0);
  }

  return texture2D(uImage, (uv - minUv) / rect);
}

vec4 imageColor(vec2 uv) {
  if (uImageReady < 0.5) return vec4(0.0);
  if (uBgMode == 1) return containColor(uv);

  return texture2D(uImage, coverUv(uv));
}

vec3 sampleFlowMesh(vec2 uv, float feather, float warp) {
  float flowAmount = clamp(uSoftness / 100.0, 0.0, 1.0);
  // Flow renders a field of curved ribbons. The UI angle rotates the field,
  // while each strand bends independently along y so the result keeps a
  // distinct renderer identity instead of becoming a straight gradient.
  vec2 flowUv = rotateUv(uv - 0.5, uFlow - 90.0) + 0.5;
  float y = flowUv.y;
  float fieldNoise = valueNoise(vec2(flowUv.x * 0.55, y * 0.85) + uMeshSeed * 0.012);
  float shadeField = 0.0;
  vec3 color = sampleGradient(0.02) * (0.7 + fieldNoise * 0.16);

  // FLOW intentionally reuses the UI "Spread" slider via uSoftness:
  // higher values make the strands denser, curvier, slightly thinner,
  // and increase dark groove contrast between adjacent strands.
  float spacing = mix(0.15, 0.102, flowAmount);
  float curveAmount = mix(0.72, 1.65, flowAmount);
  float widthScale = mix(1.22, 0.9, flowAmount);
  float shadeAmount = mix(0.035, 0.085, flowAmount);

  for (int i = 0; i < FLOW_STRAND_COUNT; i++) {
    float fi = float(i);
    float anchor = -0.2 + fi * spacing;
    float phase = fi * 1.91 + uMeshSeed * 0.004;
    float curve = sin(y * (1.15 + fi * 0.12) + phase) * (0.075 + 0.05 * sin(fi * 0.83));
    curve += sin(y * (2.15 + fi * 0.21) + phase * 1.47) * (0.038 + 0.016 * cos(fi));
    curve *= curveAmount;
    float slant = (y - 0.5) * (0.12 * sin(fi * 1.13));
    float centerX = anchor + curve + slant;
    float distX = abs(flowUv.x - centerX);
    float width = (0.046 + 0.018 * sin(fi * 1.27 + 0.8)) * widthScale;
    float haloWidth = width * 3.3 + feather * 0.2;
    float halo = 1.0 - smoothstep(width, haloWidth, distX);
    float core = 1.0 - smoothstep(width * 0.18, width, distX);
    float rim = smoothstep(width * 0.92, width * 1.28, distX) *
      (1.0 - smoothstep(width * 1.28, width * 2.1, distX));
    float pulse = 0.82 + 0.18 * sin(y * 2.2 + phase);
    float colorT = fract(0.08 + fi * 0.135);
    vec3 strandColor = sampleGradient(colorT);

    color = mix(color, strandColor, clamp(halo * pulse * 0.28, 0.0, 0.72));
    color += strandColor * core * pulse * 0.28;
    shadeField += rim * shadeAmount;
  }

  float warmBloom = 1.0 - smoothstep(0.04, 0.76, distance(flowUv, vec2(0.86, 0.1)));
  float lowPink = 1.0 - smoothstep(0.1, 0.82, distance(flowUv, vec2(0.6, 0.86)));
  color += sampleGradient(0.9) * warmBloom * 0.3;
  color += sampleGradient(0.62) * lowPink * 0.18;
  color = mix(color, sampleGradient(0.04), clamp(shadeField, 0.0, 0.42));

  return color;
}

float liquidBlob(vec2 uv, vec2 center, float radius, float wobble, float melt, float phase) {
  vec2 delta = uv - center;
  float angle = atan(delta.y, delta.x);
  float edge = 1.0 + wobble * (
    sin(angle * 2.0 + phase) * 0.08 +
    sin(angle * 3.0 - phase * 1.4) * 0.05
  );
  float safeRadius = max(radius * edge, 0.01);
  float innerRadius = safeRadius * mix(0.86, 0.34, melt);

  return 1.0 - smoothstep(innerRadius, safeRadius, length(delta));
}

vec3 sampleLiquidMesh(vec2 uv, float feather, float warp) {
  float scale = mix(0.48, 1.35, clamp(uMeshScale / 100.0, 0.0, 1.0));
  float softness = clamp(uSoftness / 100.0, 0.0, 1.0);
  float spread = smoothstep(0.0, 1.0, softness);
  float radiusScale = mix(0.72, 1.2, spread);
  float liquidFeather = mix(0.02, feather * 1.12, spread);
  vec2 flowUv = rotateUv(uv - 0.5, uFlow - 180.0) + 0.5;
  vec2 drift = vec2(
    valueNoise(flowUv * scale + vec2(2.1, 7.4) + uMeshSeed * 0.009),
    valueNoise(flowUv * scale + vec2(8.7, 1.9) + uMeshSeed * 0.011)
  ) - 0.5;
  vec2 liquidUv = flowUv + drift * (0.025 + warp * mix(0.08, 0.24, spread));
  float mist = valueNoise(liquidUv * (scale * 0.72) + uMeshSeed * 0.006);

  float milk = liquidBlob(liquidUv, vec2(0.28, 0.26), (0.7 + liquidFeather * 0.32) * radiusScale, warp, spread, 0.7);
  float blush = liquidBlob(liquidUv, vec2(0.12, 0.76), (0.48 + liquidFeather * 0.2) * radiusScale, warp, spread, 2.1);
  float orange = liquidBlob(liquidUv, vec2(0.62, 0.76), (0.36 + liquidFeather * 0.28) * radiusScale, warp, spread, 4.4);
  float sky = liquidBlob(liquidUv, vec2(0.93, 0.34), (0.42 + liquidFeather * 0.3) * radiusScale, warp, spread, 6.2);
  float cream = liquidBlob(liquidUv, vec2(0.42, 0.48), (0.54 + liquidFeather * 0.32) * radiusScale, warp, spread, 8.6);

  vec3 color = mix(sampleGradient(0.0), sampleGradient(0.2), milk * mix(0.36, 0.66, spread));
  color = mix(color, sampleGradient(0.18), cream * mix(0.18, 0.56, spread));
  color = mix(color, sampleGradient(0.94), blush * mix(0.22, 0.4, spread));
  color = mix(color, sampleGradient(0.5), orange * mix(0.56, 0.94, spread));
  color = mix(color, sampleGradient(0.76), sky * mix(0.56, 0.9, spread));

  float lightVeil = 1.0 - smoothstep(0.12, 0.58 + liquidFeather * 0.9, distance(liquidUv, vec2(0.22, 0.32)));
  float warmCore = 1.0 - smoothstep(0.03, 0.24 + liquidFeather * 0.75, distance(liquidUv, vec2(0.58, 0.72)));
  float coolEdge = smoothstep(0.64, 0.98, liquidUv.x);
  color = mix(color, sampleGradient(0.14), lightVeil * mix(0.08, 0.24, spread));
  color += sampleGradient(0.5) * warmCore * mix(0.2, 0.42, spread);
  color = mix(color, sampleGradient(0.78), coolEdge * mix(0.16, 0.42 + mist * 0.18, spread));
  color = mix(color, sampleGradient(clamp(mist * 0.75 + 0.1, 0.0, 1.0)), mix(0.02, 0.08, spread));

  return color;
}

vec3 sampleProceduralMesh(vec2 uv) {
  float softness = clamp(uSoftness / 100.0, 0.0, 1.0);
  float warp = clamp(uMeshWarp / 100.0, 0.0, 1.0);
  float feather = mix(0.16, 0.46, softness);

  if (uMeshModel == MESH_MODEL_LIQUID) {
    return sampleLiquidMesh(uv, feather, warp);
  }

  return sampleFlowMesh(uv, feather, warp);
}

vec4 sampleBase(vec2 uv) {
  if (uMode == 4) return imageColor(uv);
  if (uMode == 3) {
    vec3 meshColor = sampleProceduralMesh(uv);
    meshColor = (meshColor - 0.5) * uMeshContrast + 0.5;
    meshColor *= uMeshBrightness;

    return vec4(clamp(meshColor, 0.0, 1.0), 1.0);
  }

  float t = 0.0;
  if (uMode == 2) {
    t = distance(uv, uRadialCenter) / max(uRadialRadius, 0.01);
  } else {
    float rad = radians(uFlow - 90.0);
    vec2 dir = vec2(cos(rad), sin(rad));
    t = dot(uv - (vec2(0.5) - dir * 0.5), dir);
  }
  vec3 color = sampleGradient(t);

  return vec4(clamp(color, 0.0, 1.0), 1.0);
}

float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

${TEXTURE_SHADER_HELPERS}

vec3 applyTexture(vec3 color, vec2 uv) {
  float strength = clamp(uTextureIntensity, 0.0, 1.0);
  float textureScale = clamp(uTextureScale, 0.35, 1.4);
  if (uTextureType == 0 || strength <= 0.0) return color;

${TEXTURE_SHADER_BRANCHES}

  return color;
}

void main() {
  if (uMode == 0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 uv = vUv;
${TEXTURE_SHADER_UV}

  vec4 baseColor = sampleBase(uv);
  vec3 color = baseColor.rgb;
  color = applyTexture(color, uv);

  gl_FragColor = vec4(color, baseColor.a);
}
`

const MODE = {
  [BG_RENDER_TYPE.NONE]: 0,
  [BG_RENDER_TYPE.LINEAR_GRADIENT]: 1,
  [BG_RENDER_TYPE.RADIAL_GRADIENT]: 2,
  [BG_RENDER_TYPE.MESH_GRADIENT]: 3,
  [BG_RENDER_TYPE.IMAGE]: 4,
} as const

const getDprCap = (renderSpec: TBgRenderSpec | null): number => {
  if (renderSpec?.hasTexture && renderSpec.texture.type === WALLPAPER_TEXTURE.OIL) {
    return OIL_TEXTURE_DPR_CAP
  }

  if (
    renderSpec?.type === BG_RENDER_TYPE.MESH_GRADIENT &&
    renderSpec.meshRecipe?.renderer === GRADIENT_RENDERER.FLOW
  ) {
    return FLOW_DPR_CAP
  }

  return DPR_CAP
}

type TUniforms = {
  mode: WebGLUniformLocation | null
  colorCount: WebGLUniformLocation | null
  meshModel: WebGLUniformLocation | null
  textureType: WebGLUniformLocation | null
  bgMode: WebGLUniformLocation | null
  flow: WebGLUniformLocation | null
  softness: WebGLUniformLocation | null
  meshSeed: WebGLUniformLocation | null
  meshWarp: WebGLUniformLocation | null
  meshScale: WebGLUniformLocation | null
  radialRadius: WebGLUniformLocation | null
  textureIntensity: WebGLUniformLocation | null
  textureScale: WebGLUniformLocation | null
  meshBrightness: WebGLUniformLocation | null
  meshContrast: WebGLUniformLocation | null
  imageReady: WebGLUniformLocation | null
  resolution: WebGLUniformLocation | null
  imageSize: WebGLUniformLocation | null
  radialCenter: WebGLUniformLocation | null
  colorStops: WebGLUniformLocation | null
  colors: WebGLUniformLocation | null
  image: WebGLUniformLocation | null
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const parseColor = (value: string): [number, number, number] => {
  const color = value.trim()
  const fallback: [number, number, number] = [0.85, 0.73, 0.89]

  if (!color.startsWith('#')) return fallback

  const hex = color.slice(1)
  const fullHex =
    hex.length === 3
      ? hex
          .split('')
          .map((item) => `${item}${item}`)
          .join('')
      : hex

  if (!/^[0-9a-f]{6}$/i.test(fullHex)) return fallback

  return [
    Number.parseInt(fullHex.slice(0, 2), 16) / 255,
    Number.parseInt(fullHex.slice(2, 4), 16) / 255,
    Number.parseInt(fullHex.slice(4, 6), 16) / 255,
  ]
}

const compileShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Wallpaper WebGL shader compile failed', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }

  return shader
}

const createProgram = (gl: WebGLRenderingContext): WebGLProgram | null => {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex)
    if (fragment) gl.deleteShader(fragment)
    return null
  }

  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    return null
  }

  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Wallpaper WebGL program link failed', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }

  return program
}

const getUniforms = (gl: WebGLRenderingContext, program: WebGLProgram): TUniforms => ({
  mode: gl.getUniformLocation(program, 'uMode'),
  colorCount: gl.getUniformLocation(program, 'uColorCount'),
  meshModel: gl.getUniformLocation(program, 'uMeshModel'),
  textureType: gl.getUniformLocation(program, 'uTextureType'),
  bgMode: gl.getUniformLocation(program, 'uBgMode'),
  flow: gl.getUniformLocation(program, 'uFlow'),
  softness: gl.getUniformLocation(program, 'uSoftness'),
  meshSeed: gl.getUniformLocation(program, 'uMeshSeed'),
  meshWarp: gl.getUniformLocation(program, 'uMeshWarp'),
  meshScale: gl.getUniformLocation(program, 'uMeshScale'),
  radialRadius: gl.getUniformLocation(program, 'uRadialRadius'),
  textureIntensity: gl.getUniformLocation(program, 'uTextureIntensity'),
  meshBrightness: gl.getUniformLocation(program, 'uMeshBrightness'),
  meshContrast: gl.getUniformLocation(program, 'uMeshContrast'),
  imageReady: gl.getUniformLocation(program, 'uImageReady'),
  resolution: gl.getUniformLocation(program, 'uResolution'),
  imageSize: gl.getUniformLocation(program, 'uImageSize'),
  radialCenter: gl.getUniformLocation(program, 'uRadialCenter'),
  colorStops: gl.getUniformLocation(program, 'uColorStops[0]'),
  colors: gl.getUniformLocation(program, 'uColors[0]'),
  image: gl.getUniformLocation(program, 'uImage'),
  textureScale: gl.getUniformLocation(program, 'uTextureScale'),
})

const textureTypeToUniform = (renderSpec: TBgRenderSpec): number => {
  if (!renderSpec.hasTexture) return 0

  return TEXTURE_TYPE[renderSpec.texture.type] ?? 0
}

class BgWebglRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGLRenderingContext
  private readonly program: WebGLProgram
  private readonly uniforms: TUniforms
  private readonly vertexBuffer: WebGLBuffer
  private readonly imageTexture: WebGLTexture
  private readonly textureScale: number
  private frame: number | null = null
  private renderSpec: TBgRenderSpec | null = null
  private imageUrl = ''
  private imageWidth = 1
  private imageHeight = 1
  private imageReady = false
  private imageToken = 0
  private dpr = 1
  private disposed = false

  constructor(
    canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    vertexBuffer: WebGLBuffer,
    imageTexture: WebGLTexture,
    textureScale: number,
  ) {
    this.canvas = canvas
    this.gl = gl
    this.program = program
    this.vertexBuffer = vertexBuffer
    this.imageTexture = imageTexture
    this.textureScale = textureScale
    this.uniforms = getUniforms(gl, program)

    this.prepare()
  }

  update(renderSpec: TBgRenderSpec): void {
    this.renderSpec = renderSpec

    if (renderSpec.type === BG_RENDER_TYPE.IMAGE && renderSpec.imageUrl !== this.imageUrl) {
      this.loadImage(renderSpec.imageUrl)
    }

    if (renderSpec.type !== BG_RENDER_TYPE.IMAGE) {
      this.imageUrl = ''
      this.imageReady = false
    }

    this.scheduleRender()
  }

  resize(): void {
    this.scheduleRender()
  }

  destroy(): void {
    this.disposed = true
    if (this.frame) window.cancelAnimationFrame(this.frame)

    this.gl.deleteBuffer(this.vertexBuffer)
    this.gl.deleteTexture(this.imageTexture)
    this.gl.deleteProgram(this.program)
  }

  private prepare(): void {
    const { gl } = this
    const position = gl.getAttribLocation(this.program, 'aPosition')

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    )

    gl.useProgram(this.program)
    gl.uniform1i(this.uniforms.image, 0)
    gl.clearColor(0, 0, 0, 0)
  }

  private loadImage(url: string): void {
    this.imageUrl = url
    this.imageReady = false
    this.imageToken += 1

    if (!url) {
      this.scheduleRender()
      return
    }

    const token = this.imageToken
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (this.disposed || token !== this.imageToken) return

      const { gl } = this
      this.imageWidth = image.naturalWidth || 1
      this.imageHeight = image.naturalHeight || 1
      this.imageReady = true

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.imageTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      this.scheduleRender()
    }
    image.onerror = () => {
      if (token !== this.imageToken) return

      this.imageReady = false
      this.scheduleRender()
    }
    image.src = url
  }

  private scheduleRender(): void {
    if (this.disposed || this.frame) return

    this.frame = window.requestAnimationFrame(() => {
      this.frame = null
      this.render()
    })
  }

  private syncSize(): void {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, getDprCap(this.renderSpec))
    const width = Math.max(1, Math.round(rect.width * this.dpr))
    const height = Math.max(1, Math.round(rect.height * this.dpr))

    if (this.canvas.width === width && this.canvas.height === height) return

    this.canvas.width = width
    this.canvas.height = height
    this.gl.viewport(0, 0, width, height)
  }

  private render(): void {
    const renderSpec = this.renderSpec
    if (!renderSpec) return

    const { gl, uniforms } = this
    this.syncSize()

    const colors = new Float32Array(MAX_COLORS * 3)
    const colorStops = new Float32Array(MAX_COLORS)
    const renderSpecColors = renderSpec.colors.slice(0, MAX_COLORS)
    for (let index = 0; index < renderSpecColors.length; index += 1) {
      const color = renderSpecColors[index]
      const rgb = parseColor(color)
      colors[index * 3] = rgb[0]
      colors[index * 3 + 1] = rgb[1]
      colors[index * 3 + 2] = rgb[2]
      colorStops[index] = clamp(renderSpec.colorStops[index] ?? 0, 0, 100) / 100
    }

    const isContain = renderSpec.bgSize === WALLPAPER_BG_SIZE.CONTAIN
    const meshRecipe = renderSpec.meshRecipe
    const meshModel =
      meshRecipe?.renderer === GRADIENT_RENDERER.LIQUID
        ? MESH_MODEL_UNIFORM[GRADIENT_RENDERER.LIQUID]
        : MESH_MODEL_UNIFORM[GRADIENT_RENDERER.FLOW]
    const meshSeed = meshRecipe?.seed ?? 1
    const meshWarp = meshRecipe?.warp ?? 55
    const meshScale = meshRecipe?.scale ?? 55
    const meshBrightness = renderSpec.meshRecipe?.brightness
      ? renderSpec.meshRecipe.brightness / 100
      : 1
    const meshContrast = renderSpec.meshRecipe?.contrast ? renderSpec.meshRecipe.contrast / 100 : 1
    const radialRecipe =
      renderSpec.gradientRecipe?.renderer === GRADIENT_RENDERER.RADIAL
        ? renderSpec.gradientRecipe
        : null
    const radialRadius = radialRecipe ? clamp(radialRecipe.radius / 100, 0.01, 1) : 0.72
    const radialCenter = radialRecipe?.center ?? { x: 0.5, y: 0.5 }
    gl.useProgram(this.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture)

    gl.uniform1i(uniforms.mode, MODE[renderSpec.type])
    gl.uniform1i(uniforms.colorCount, Math.max(1, renderSpecColors.length))
    gl.uniform1i(uniforms.meshModel, meshModel)
    gl.uniform1i(uniforms.textureType, textureTypeToUniform(renderSpec))
    gl.uniform1i(uniforms.bgMode, isContain ? 1 : 0)
    gl.uniform1f(uniforms.flow, renderSpec.flow)
    gl.uniform1f(uniforms.softness, renderSpec.meshRecipe?.softness ?? 0)
    gl.uniform1f(uniforms.meshSeed, meshSeed)
    gl.uniform1f(uniforms.meshWarp, meshWarp)
    gl.uniform1f(uniforms.meshScale, meshScale)
    gl.uniform1f(uniforms.radialRadius, radialRadius)
    // CSS owns global post-processing filters. Keep WebGL focused on content
    // generation and texture effects so gradient, mesh, picture, and pattern
    // share one blur/brightness/saturation behavior at the final layer.
    gl.uniform1f(
      uniforms.textureIntensity,
      renderSpec.hasTexture ? clamp(renderSpec.texture.intensity, 0, 100) / 100 : 0,
    )
    gl.uniform1f(uniforms.textureScale, clamp(this.textureScale, 0.35, 1.4))
    gl.uniform1f(uniforms.meshBrightness, meshBrightness)
    gl.uniform1f(uniforms.meshContrast, meshContrast)
    gl.uniform1f(uniforms.imageReady, this.imageReady ? 1 : 0)
    gl.uniform2f(uniforms.resolution, this.canvas.width, this.canvas.height)
    gl.uniform2f(uniforms.imageSize, this.imageWidth, this.imageHeight)
    gl.uniform2f(uniforms.radialCenter, radialCenter.x, radialCenter.y)
    gl.uniform1fv(uniforms.colorStops, colorStops)
    gl.uniform3fv(uniforms.colors, colors)

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}

export const createBgWebglRenderer = (
  canvas: HTMLCanvasElement,
  textureScale = 1,
): BgWebglRenderer | null => {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: false,
    premultipliedAlpha: true,
    stencil: false,
  })
  if (!gl) return null

  const program = createProgram(gl)
  const vertexBuffer = gl.createBuffer()
  const imageTexture = gl.createTexture()
  if (!program || !vertexBuffer || !imageTexture) return null

  return new BgWebglRenderer(canvas, gl, program, vertexBuffer, imageTexture, textureScale)
}
