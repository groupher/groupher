import type { TWallpaperRenderDescriptor } from './types'

const MAX_COLORS = 6
const MAX_ANCHORS = 8
const MAX_BLUR_PX = 6
const DPR_CAP = 2

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = vec2((aPosition.x + 1.0) * 0.5, (1.0 - aPosition.y) * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision mediump float;

const int MAX_COLORS = ${MAX_COLORS};
const int MAX_ANCHORS = ${MAX_ANCHORS};

uniform int uMode;
uniform int uColorCount;
uniform int uAnchorCount;
uniform int uTextureType;
uniform int uBgMode;
uniform float uFlow;
uniform float uSoftness;
uniform float uBrightness;
uniform float uSaturation;
uniform float uTextureStrength;
uniform float uBlurPx;
uniform float uMeshBrightness;
uniform float uMeshContrast;
uniform float uImageReady;
uniform vec2 uResolution;
uniform vec2 uImageSize;
uniform vec3 uColors[MAX_COLORS];
uniform vec3 uAnchors[MAX_ANCHORS];
uniform sampler2D uImage;

varying vec2 vUv;

float random(vec2 value) {
  return fract(sin(dot(value, vec2(12.9898, 78.233))) * 43758.5453123);
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

vec3 sampleGradient(float t) {
  if (uColorCount <= 1) return colorAt(0);

  float scaled = clamp(t, 0.0, 1.0) * float(uColorCount - 1);
  int leftIndex = int(floor(scaled));
  int rightIndex = leftIndex + 1;

  if (rightIndex >= uColorCount) {
    rightIndex = uColorCount - 1;
  }

  return mix(colorAt(leftIndex), colorAt(rightIndex), fract(scaled));
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

vec4 sampleBase(vec2 uv) {
  if (uMode == 3) return imageColor(uv);

  float rad = radians(uFlow - 90.0);
  vec2 dir = vec2(cos(rad), sin(rad));
  float t = dot(uv - (vec2(0.5) - dir * 0.5), dir);
  vec3 color = sampleGradient(t);

  if (uMode == 2) {
    float radius = 0.16 + uSoftness * 0.0038;
    float hardStop = clamp(0.04 + uSoftness / 280.0, 0.04, 0.34);
    float alpha = clamp(0.72 - uSoftness / 220.0, 0.26, 0.72);

    for (int i = 0; i < MAX_ANCHORS; i++) {
      if (i >= uAnchorCount) break;

      vec3 anchor = uAnchors[i];
      vec3 anchorColor = colorAt(int(anchor.z + 0.5));
      float dist = distance(uv, anchor.xy);
      float mask = 1.0 - smoothstep(hardStop, radius, dist);
      color = mix(color, anchorColor, mask * alpha);
    }

    color = (color - 0.5) * uMeshContrast + 0.5;
    color *= uMeshBrightness;
  }

  return vec4(clamp(color, 0.0, 1.0), 1.0);
}

vec4 sampleBaseBlurred(vec2 uv) {
  if (uBlurPx <= 0.05) return sampleBase(uv);

  vec2 px = uBlurPx / max(uResolution, vec2(1.0));
  vec4 color = sampleBase(uv) * 0.32;
  color += sampleBase(uv + vec2(px.x, 0.0)) * 0.12;
  color += sampleBase(uv - vec2(px.x, 0.0)) * 0.12;
  color += sampleBase(uv + vec2(0.0, px.y)) * 0.12;
  color += sampleBase(uv - vec2(0.0, px.y)) * 0.12;
  color += sampleBase(uv + px) * 0.05;
  color += sampleBase(uv - px) * 0.05;
  color += sampleBase(uv + vec2(px.x, -px.y)) * 0.05;
  color += sampleBase(uv + vec2(-px.x, px.y)) * 0.05;

  return color;
}

float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float bayer4(vec2 coord) {
  vec2 cell = mod(floor(coord), 4.0);
  float x = cell.x;
  float y = cell.y;

  if (y < 0.5) {
    if (x < 0.5) return 0.0 / 15.0;
    if (x < 1.5) return 8.0 / 15.0;
    if (x < 2.5) return 2.0 / 15.0;
    return 10.0 / 15.0;
  }
  if (y < 1.5) {
    if (x < 0.5) return 12.0 / 15.0;
    if (x < 1.5) return 4.0 / 15.0;
    if (x < 2.5) return 14.0 / 15.0;
    return 6.0 / 15.0;
  }
  if (y < 2.5) {
    if (x < 0.5) return 3.0 / 15.0;
    if (x < 1.5) return 11.0 / 15.0;
    if (x < 2.5) return 1.0 / 15.0;
    return 9.0 / 15.0;
  }

  if (x < 0.5) return 15.0 / 15.0;
  if (x < 1.5) return 7.0 / 15.0;
  if (x < 2.5) return 13.0 / 15.0;
  return 5.0 / 15.0;
}

vec3 applyTexture(vec3 color, vec2 uv) {
  float strength = clamp(uTextureStrength, 0.0, 1.0);
  if (strength <= 0.001 || uTextureType == 0) return color;

  if (uTextureType == 1) {
    float noise = random(gl_FragCoord.xy + vec2(37.0, 91.0));
    return clamp(color + (noise - 0.5) * strength * 0.22, 0.0, 1.0);
  }

  if (uTextureType == 3) {
    float cell = mix(8.0, 4.5, strength);
    vec2 center = mod(gl_FragCoord.xy, cell) - cell * 0.5;
    float lum = luminance(color);
    float radius = cell * mix(0.18, 0.42, (1.0 - lum) * strength);
    float dotMask = 1.0 - smoothstep(radius, radius + 0.8, length(center));

    return mix(color, color * 0.64, dotMask * (0.35 + strength * 0.42));
  }

  if (uTextureType == 4) {
    float threshold = (bayer4(gl_FragCoord.xy) - 0.5) * 0.28 * strength;
    vec3 adjusted = clamp(color + threshold, 0.0, 1.0);
    vec3 quantized = floor(adjusted * 6.0 + 0.5) / 6.0;

    return mix(color, quantized, strength * 0.78);
  }

  return color;
}

vec3 applyColorAdjust(vec3 color) {
  float gray = luminance(color);
  vec3 saturated = mix(vec3(gray), color, uSaturation);

  return clamp(saturated * uBrightness, 0.0, 1.0);
}

void main() {
  if (uMode == 0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 uv = vUv;
  if (uTextureType == 2 && uTextureStrength > 0.001) {
    float blockSize = mix(2.0, 8.0, uTextureStrength);
    uv = (floor(uv * uResolution / blockSize) + 0.5) * blockSize / uResolution;
  }

  vec4 baseColor = sampleBaseBlurred(uv);
  vec3 color = applyColorAdjust(baseColor.rgb);
  color = applyTexture(color, uv);

  gl_FragColor = vec4(color, baseColor.a);
}
`

const MODE = {
  none: 0,
  'linear-gradient': 1,
  'mesh-gradient': 2,
  image: 3,
} as const

const TEXTURE_TYPE = {
  grain: 1,
  pixelate: 2,
  screentone: 3,
  dither: 4,
} as const

type TUniforms = {
  mode: WebGLUniformLocation | null
  colorCount: WebGLUniformLocation | null
  anchorCount: WebGLUniformLocation | null
  textureType: WebGLUniformLocation | null
  bgMode: WebGLUniformLocation | null
  flow: WebGLUniformLocation | null
  softness: WebGLUniformLocation | null
  brightness: WebGLUniformLocation | null
  saturation: WebGLUniformLocation | null
  textureStrength: WebGLUniformLocation | null
  blurPx: WebGLUniformLocation | null
  meshBrightness: WebGLUniformLocation | null
  meshContrast: WebGLUniformLocation | null
  imageReady: WebGLUniformLocation | null
  resolution: WebGLUniformLocation | null
  imageSize: WebGLUniformLocation | null
  colors: WebGLUniformLocation | null
  anchors: WebGLUniformLocation | null
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
  if (!vertex || !fragment) return null

  const program = gl.createProgram()
  if (!program) return null

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
  anchorCount: gl.getUniformLocation(program, 'uAnchorCount'),
  textureType: gl.getUniformLocation(program, 'uTextureType'),
  bgMode: gl.getUniformLocation(program, 'uBgMode'),
  flow: gl.getUniformLocation(program, 'uFlow'),
  softness: gl.getUniformLocation(program, 'uSoftness'),
  brightness: gl.getUniformLocation(program, 'uBrightness'),
  saturation: gl.getUniformLocation(program, 'uSaturation'),
  textureStrength: gl.getUniformLocation(program, 'uTextureStrength'),
  blurPx: gl.getUniformLocation(program, 'uBlurPx'),
  meshBrightness: gl.getUniformLocation(program, 'uMeshBrightness'),
  meshContrast: gl.getUniformLocation(program, 'uMeshContrast'),
  imageReady: gl.getUniformLocation(program, 'uImageReady'),
  resolution: gl.getUniformLocation(program, 'uResolution'),
  imageSize: gl.getUniformLocation(program, 'uImageSize'),
  colors: gl.getUniformLocation(program, 'uColors[0]'),
  anchors: gl.getUniformLocation(program, 'uAnchors[0]'),
  image: gl.getUniformLocation(program, 'uImage'),
})

const textureTypeToUniform = (descriptor: TWallpaperRenderDescriptor): number => {
  if (descriptor.texture.strength <= 0) return 0

  return TEXTURE_TYPE[descriptor.texture.type] ?? 0
}

class WallpaperWebglRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGLRenderingContext
  private readonly program: WebGLProgram
  private readonly uniforms: TUniforms
  private readonly vertexBuffer: WebGLBuffer
  private readonly imageTexture: WebGLTexture
  private frame: number | null = null
  private descriptor: TWallpaperRenderDescriptor | null = null
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
  ) {
    this.canvas = canvas
    this.gl = gl
    this.program = program
    this.vertexBuffer = vertexBuffer
    this.imageTexture = imageTexture
    this.uniforms = getUniforms(gl, program)

    this.prepare()
  }

  update(descriptor: TWallpaperRenderDescriptor): void {
    this.descriptor = descriptor

    if (descriptor.kind === 'image' && descriptor.imageUrl !== this.imageUrl) {
      this.loadImage(descriptor.imageUrl)
    }

    if (descriptor.kind !== 'image') {
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
    this.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    const width = Math.max(1, Math.round(rect.width * this.dpr))
    const height = Math.max(1, Math.round(rect.height * this.dpr))

    if (this.canvas.width === width && this.canvas.height === height) return

    this.canvas.width = width
    this.canvas.height = height
    this.gl.viewport(0, 0, width, height)
  }

  private render(): void {
    const descriptor = this.descriptor
    if (!descriptor) return

    const { gl, uniforms } = this
    this.syncSize()

    const colors = new Float32Array(MAX_COLORS * 3)
    const descriptorColors = descriptor.colors.slice(0, MAX_COLORS)
    for (let index = 0; index < descriptorColors.length; index += 1) {
      const color = descriptorColors[index]
      const rgb = parseColor(color)
      colors[index * 3] = rgb[0]
      colors[index * 3 + 1] = rgb[1]
      colors[index * 3 + 2] = rgb[2]
    }

    const anchors = new Float32Array(MAX_ANCHORS * 3)
    const descriptorAnchors = descriptor.meshRecipe?.anchors.slice(0, MAX_ANCHORS) ?? []
    for (let index = 0; index < descriptorAnchors.length; index += 1) {
      const anchor = descriptorAnchors[index]
      anchors[index * 3] = clamp(anchor.x, 0, 1)
      anchors[index * 3 + 1] = clamp(anchor.y, 0, 1)
      anchors[index * 3 + 2] = clamp(anchor.color, 0, MAX_COLORS - 1)
    }

    const isContain = descriptor.bgSize === 'contain'
    const meshBrightness = descriptor.meshRecipe?.brightness
      ? descriptor.meshRecipe.brightness / 100
      : 1
    const meshContrast = descriptor.meshRecipe?.contrast ? descriptor.meshRecipe.contrast / 100 : 1

    gl.useProgram(this.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture)

    gl.uniform1i(uniforms.mode, MODE[descriptor.kind])
    gl.uniform1i(uniforms.colorCount, Math.max(1, descriptorColors.length))
    gl.uniform1i(uniforms.anchorCount, descriptorAnchors.length)
    gl.uniform1i(uniforms.textureType, textureTypeToUniform(descriptor))
    gl.uniform1i(uniforms.bgMode, isContain ? 1 : 0)
    gl.uniform1f(uniforms.flow, descriptor.flow)
    gl.uniform1f(uniforms.softness, descriptor.meshRecipe?.softness ?? 0)
    gl.uniform1f(uniforms.brightness, descriptor.brightness / 100)
    gl.uniform1f(uniforms.saturation, descriptor.saturation / 100)
    gl.uniform1f(uniforms.textureStrength, clamp(descriptor.texture.strength, 0, 100) / 100)
    gl.uniform1f(
      uniforms.blurPx,
      (clamp(descriptor.blurIntensity, 0, 100) / 100) * MAX_BLUR_PX * this.dpr,
    )
    gl.uniform1f(uniforms.meshBrightness, meshBrightness)
    gl.uniform1f(uniforms.meshContrast, meshContrast)
    gl.uniform1f(uniforms.imageReady, this.imageReady ? 1 : 0)
    gl.uniform2f(uniforms.resolution, this.canvas.width, this.canvas.height)
    gl.uniform2f(uniforms.imageSize, this.imageWidth, this.imageHeight)
    gl.uniform3fv(uniforms.colors, colors)
    gl.uniform3fv(uniforms.anchors, anchors)

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}

export const createWallpaperWebglRenderer = (
  canvas: HTMLCanvasElement,
): WallpaperWebglRenderer | null => {
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

  return new WallpaperWebglRenderer(canvas, gl, program, vertexBuffer, imageTexture)
}
