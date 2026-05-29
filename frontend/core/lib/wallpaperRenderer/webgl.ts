import { GRADIENT_TYPE, MESH_GRADIENT_MODEL } from '~/lib/wallpaperMesh'
import {
  TEXTURE_SHADER_BRANCHES,
  TEXTURE_SHADER_HELPERS,
  TEXTURE_SHADER_UV,
  TEXTURE_TYPE,
} from '~/lib/wallpaperMesh/texture/shader'

import type { TWallpaperRenderDescriptor } from './spec'

const MAX_COLORS = 6
const DPR_CAP = 2
const FLOW_STRAND_COUNT = 11

const MESH_MODEL_UNIFORM = {
  [MESH_GRADIENT_MODEL.HAZE]: 0,
  [MESH_GRADIENT_MODEL.RIDGE]: 1,
  [MESH_GRADIENT_MODEL.BRUSHED]: 2,
  [MESH_GRADIENT_MODEL.RIBBON]: 3,
  [MESH_GRADIENT_MODEL.SCANLINE]: 4,
  [MESH_GRADIENT_MODEL.GLOW]: 5,
  [MESH_GRADIENT_MODEL.FLOW]: 6,
  [MESH_GRADIENT_MODEL.LIQUID]: 7,
} as const

const MESH_MODEL_SHADER_CONSTANTS = `
const int MESH_MODEL_HAZE = ${MESH_MODEL_UNIFORM[MESH_GRADIENT_MODEL.HAZE]};
const int MESH_MODEL_RIDGE = ${MESH_MODEL_UNIFORM[MESH_GRADIENT_MODEL.RIDGE]};
const int MESH_MODEL_BRUSHED = ${MESH_MODEL_UNIFORM[MESH_GRADIENT_MODEL.BRUSHED]};
const int MESH_MODEL_RIBBON = ${MESH_MODEL_UNIFORM[MESH_GRADIENT_MODEL.RIBBON]};
const int MESH_MODEL_SCANLINE = ${MESH_MODEL_UNIFORM[MESH_GRADIENT_MODEL.SCANLINE]};
const int MESH_MODEL_GLOW = ${MESH_MODEL_UNIFORM[MESH_GRADIENT_MODEL.GLOW]};
const int MESH_MODEL_FLOW = ${MESH_MODEL_UNIFORM[MESH_GRADIENT_MODEL.FLOW]};
const int MESH_MODEL_LIQUID = ${MESH_MODEL_UNIFORM[MESH_GRADIENT_MODEL.LIQUID]};
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

float fbm(vec2 value) {
  float total = 0.0;
  float amplitude = 0.5;

  for (int i = 0; i < 5; i++) {
    total += valueNoise(value) * amplitude;
    value = value * 2.03 + 17.17;
    amplitude *= 0.5;
  }

  return total;
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

vec3 sampleRibbonMesh(float along, float across, float baseNoise, float warp, float feather) {
  float wave = across + sin(along * 2.4 + baseNoise * 1.2) * (0.08 + warp * 0.1);
  float laneA = 1.0 - smoothstep(0.02, feather * 0.95, abs(wave + 0.22));
  float laneB = 1.0 - smoothstep(0.02, feather * 0.9, abs(wave - 0.08));
  float laneC = 1.0 - smoothstep(0.02, feather * 1.05, abs(wave - 0.34));
  vec3 color = mix(sampleGradient(0.04), sampleGradient(0.18), 0.5 + along * 0.28);
  color = mix(color, sampleGradient(0.66), laneA * 0.58);
  color = mix(color, sampleGradient(0.36), laneB * 0.46);
  color = mix(color, sampleGradient(0.86), laneC * 0.52);

  return color;
}

vec3 sampleFlowMesh(vec2 uv, float feather, float warp) {
  float flowAmount = clamp(uSoftness / 100.0, 0.0, 1.0);
  // FLOW renders a field of gaussian ribbons. The UI angle rotates the field,
  // while each strand bends independently along y so the result avoids the
  // straight, linear-gradient look.
  vec2 flowUv = rotateUv(uv - 0.5, uFlow - 90.0) + 0.5;
  float y = flowUv.y;
  float fieldNoise = fbm(vec2(flowUv.x * 0.55, y * 0.85) + uMeshSeed * 0.012);
  float shadeField = 0.0;
  vec3 color = sampleGradient(0.02) * (0.7 + fieldNoise * 0.16);

  // FLOW intentionally reuses the UI "Spread" slider via uSoftness:
  // higher values make the strands denser, curvier, slightly thinner,
  // and increase dark groove contrast between adjacent strands.
  float spacing = mix(0.15, 0.102, flowAmount);
  float curveAmount = mix(0.72, 1.65, flowAmount);
  float noiseAmount = mix(0.08, 0.2, flowAmount);
  float widthScale = mix(1.14, 0.82, flowAmount);
  float shadeAmount = mix(0.045, 0.11, flowAmount);

  for (int i = 0; i < FLOW_STRAND_COUNT; i++) {
    float fi = float(i);
    float anchor = -0.2 + fi * spacing;
    float phase = fi * 1.91 + uMeshSeed * 0.004;
    float curve = sin(y * (1.15 + fi * 0.12) + phase) * (0.075 + 0.05 * sin(fi * 0.83));
    curve += sin(y * (2.15 + fi * 0.21) + phase * 1.47) * (0.038 + 0.016 * cos(fi));
    curve += sin(y * (3.35 + fi * 0.11) + phase * 0.53) * (0.012 + 0.01 * sin(fi * 1.7));
    curve *= curveAmount;
    curve += (fbm(vec2(y * (1.08 + fi * 0.08), fi * 0.31) + uMeshSeed * 0.01) - 0.5) * warp * noiseAmount;
    float slant = (y - 0.5) * (0.12 * sin(fi * 1.13));
    float centerX = anchor + curve + slant;
    float distX = abs(flowUv.x - centerX);
    float width = (0.046 + 0.018 * sin(fi * 1.27 + 0.8)) * widthScale;
    float haloWidth = width * 3.3 + feather * 0.2;
    float halo = exp(-pow(distX / haloWidth, 2.0));
    float core = exp(-pow(distX / width, 2.0));
    float rim = exp(-pow((distX - width * 1.35) / (width * 0.85), 2.0));
    float pulse = 0.76 + 0.24 * fbm(vec2(y * 2.6 + phase, fi * 0.23));
    float colorT = fract(0.09 + fi * 0.115 + sin(fi * 2.1) * 0.08);
    vec3 haloColor = sampleGradient(colorT);
    vec3 coreColor = sampleGradient(fract(colorT + 0.16));

    color = mix(color, haloColor, clamp(halo * pulse * 0.34, 0.0, 0.82));
    color += coreColor * core * pulse * 0.34;
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
    sin(angle * 3.0 - phase * 1.4) * 0.05 +
    sin(angle * 5.0 + phase * 0.7) * 0.025
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
    fbm(flowUv * scale + vec2(2.1, 7.4) + uMeshSeed * 0.009),
    fbm(flowUv * scale + vec2(8.7, 1.9) + uMeshSeed * 0.011)
  ) - 0.5;
  vec2 liquidUv = flowUv + drift * (0.025 + warp * mix(0.08, 0.24, spread));
  float mist = fbm(liquidUv * (scale * 0.72) + uMeshSeed * 0.006);

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
  float scale = mix(1.15, 4.4, clamp(uMeshScale / 100.0, 0.0, 1.0));
  float feather = mix(0.16, 0.46, softness);
  float flowRad = radians(uFlow);
  vec2 dir = vec2(cos(flowRad), sin(flowRad));
  vec2 crossDir = vec2(-dir.y, dir.x);
  float baseNoise = fbm(uv * scale + uMeshSeed * 0.011);
  vec2 warpNoise = vec2(
    fbm(uv * (scale * 0.74) + vec2(8.1, 2.4) + uMeshSeed * 0.007),
    fbm(uv * (scale * 0.74) + vec2(1.7, 9.3) + uMeshSeed * 0.009)
  ) - 0.5;
  vec2 warped = uv + warpNoise * (0.035 + warp * 0.12);
  vec2 warpedCentered = warped - 0.5;
  float along = dot(warpedCentered, dir);
  float across = dot(warpedCentered, crossDir);
  float t = clamp(dot(warped, dir) + 0.5 + (baseNoise - 0.5) * warp * 0.28, 0.0, 1.0);
  vec3 color = sampleGradient(t);

  if (uMeshModel == MESH_MODEL_HAZE) {
    float cloud = fbm(warped * (scale * 0.42) + 12.5);
    float warmBlob = 1.0 - smoothstep(0.18, 0.72 + feather, distance(warped, vec2(0.36, 0.72)));
    float hotBlob = 1.0 - smoothstep(0.12, 0.42 + feather * 0.72, distance(warped, vec2(0.66, 0.72)));
    float coolBlob = 1.0 - smoothstep(0.14, 0.7 + feather, distance(warped, vec2(0.98, 0.36)));
    float milk = 1.0 - smoothstep(0.18, 0.82, distance(warped, vec2(0.22, 0.32)));
    color = mix(sampleGradient(0.12 + cloud * 0.22), sampleGradient(0.9), coolBlob * 0.7);
    color = mix(color, sampleGradient(0.02), milk * 0.55);
    color = mix(color, sampleGradient(0.42), warmBlob * 0.5);
    color = mix(color, sampleGradient(0.55), hotBlob * 0.58);
  } else if (uMeshModel == MESH_MODEL_RIDGE) {
    float ridgeCurve = across + sin(along * 3.9 + baseNoise * 1.25) * (0.1 + warp * 0.14);
    float ridge = 1.0 - smoothstep(0.02, feather * 0.95, abs(ridgeCurve));
    float lowShade = smoothstep(-0.22, 0.34, across + baseNoise * 0.12);
    float upperGlow = 1.0 - smoothstep(0.18, 0.86, distance(warped, vec2(0.58, 0.15)));
    color = mix(sampleGradient(0.78), sampleGradient(0.18 + lowShade * 0.42), 0.72);
    color = mix(color, sampleGradient(0.4), ridge * 0.52);
    color = mix(color, sampleGradient(0.02), upperGlow * 0.5);
    color = mix(color, sampleGradient(0.96), smoothstep(0.15, 0.62, across) * 0.42);
  } else if (uMeshModel == MESH_MODEL_BRUSHED) {
    float sweep = fbm(vec2(uv.x * 0.85, uv.y * (scale * 1.9)) + uMeshSeed * 0.013);
    float grain = fbm(vec2(uv.x * 1.35, uv.y * 11.0) + uMeshSeed * 0.021);
    float band = uv.y + sin(uv.x * 2.4 + sweep * 2.6) * (0.025 + warp * 0.05);
    t = clamp(band * 0.92 + 0.05 + (grain - 0.5) * 0.14, 0.0, 1.0);
    color = sampleGradient(t);
    color = mix(color, sampleGradient(clamp(t + 0.14, 0.0, 1.0)), grain * 0.1);
    color = mix(color, sampleGradient(0.08), (1.0 - smoothstep(0.18, 0.58, uv.y)) * 0.35);
  } else if (uMeshModel == MESH_MODEL_RIBBON) {
    color = sampleRibbonMesh(along, across, baseNoise, warp, feather);
  } else if (uMeshModel == MESH_MODEL_FLOW) {
    color = sampleFlowMesh(uv, feather, warp);
  } else if (uMeshModel == MESH_MODEL_LIQUID) {
    color = sampleLiquidMesh(uv, feather, warp);
  } else if (uMeshModel == MESH_MODEL_SCANLINE) {
    float columns = mix(12.0, 28.0, clamp(uMeshScale / 100.0, 0.0, 1.0));
    float bentX = uv.x + sin(uv.y * 3.7 + baseNoise * 1.4) * warp * 0.025;
    float column = fract(bentX * columns);
    float beam = 1.0 - smoothstep(0.2, 0.5, abs(column - 0.5));
    float rowDot = 0.88 + 0.12 * smoothstep(0.12, 0.34, fract(uv.y * 56.0));
    float veil = fbm(vec2(uv.x * 3.0, uv.y * 1.2) + uMeshSeed * 0.019);
    t = clamp(0.08 + uv.x * 0.78 + (veil - 0.5) * 0.12, 0.0, 1.0);
    color = sampleGradient(t);
    color = mix(color, sampleGradient(clamp(t + 0.18, 0.0, 1.0)), beam * 0.34);
    color *= 0.82 + beam * rowDot * 0.3;
  } else if (uMeshModel == MESH_MODEL_GLOW) {
    float glowA = 1.0 - smoothstep(0.1, 0.68 + feather, distance(warped, vec2(0.18, 0.82)));
    float glowB = 1.0 - smoothstep(0.14, 0.74 + feather, distance(warped, vec2(0.86, 0.22)));
    float diagonal = smoothstep(-0.58, 0.68, dot(warpedCentered, normalize(vec2(0.86, -0.52))));
    float veil = fbm(rotateUv(warpedCentered, uFlow) * (scale * 0.5) + 3.5);
    color = mix(sampleGradient(0.18 + veil * 0.18), sampleGradient(0.68), diagonal);
    color = mix(color, sampleGradient(0.92), glowA * 0.34);
    color = mix(color, sampleGradient(0.38), glowB * 0.32);
  } else {
    color = sampleGradient(t);
  }

  color = mix(color, sampleGradient(t), 0.06 * (1.0 - softness));

  return color;
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
  if (strength <= 0.001 || uTextureType == 0) return color;

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
  none: 0,
  'linear-gradient': 1,
  'radial-gradient': 2,
  'mesh-gradient': 3,
  image: 4,
} as const

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

const textureTypeToUniform = (descriptor: TWallpaperRenderDescriptor): number => {
  if (!descriptor.hasTexture) return 0
  if (descriptor.texture.intensity <= 0) return 0

  return TEXTURE_TYPE[descriptor.texture.type] ?? 0
}

class WallpaperWebglRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGLRenderingContext
  private readonly program: WebGLProgram
  private readonly uniforms: TUniforms
  private readonly vertexBuffer: WebGLBuffer
  private readonly imageTexture: WebGLTexture
  private readonly textureScale: number
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
    const colorStops = new Float32Array(MAX_COLORS)
    const descriptorColors = descriptor.colors.slice(0, MAX_COLORS)
    for (let index = 0; index < descriptorColors.length; index += 1) {
      const color = descriptorColors[index]
      const rgb = parseColor(color)
      colors[index * 3] = rgb[0]
      colors[index * 3 + 1] = rgb[1]
      colors[index * 3 + 2] = rgb[2]
      colorStops[index] = clamp(descriptor.colorStops[index] ?? 0, 0, 100) / 100
    }

    const isContain = descriptor.bgSize === 'contain'
    const meshRecipe = descriptor.meshRecipe
    const meshModel = meshRecipe
      ? MESH_MODEL_UNIFORM[meshRecipe.model]
      : MESH_MODEL_UNIFORM[MESH_GRADIENT_MODEL.HAZE]
    const meshSeed = meshRecipe?.seed ?? 1
    const meshWarp = meshRecipe?.warp ?? 55
    const meshScale = meshRecipe?.scale ?? 55
    const meshBrightness = descriptor.meshRecipe?.brightness
      ? descriptor.meshRecipe.brightness / 100
      : 1
    const meshContrast = descriptor.meshRecipe?.contrast ? descriptor.meshRecipe.contrast / 100 : 1
    const radialRecipe =
      descriptor.gradientRecipe?.kind === GRADIENT_TYPE.RADIAL ? descriptor.gradientRecipe : null
    const radialRadius = radialRecipe ? clamp(radialRecipe.radius / 100, 0.01, 1) : 0.72
    const radialCenter = radialRecipe?.center ?? { x: 0.5, y: 0.5 }

    gl.useProgram(this.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture)

    gl.uniform1i(uniforms.mode, MODE[descriptor.kind])
    gl.uniform1i(uniforms.colorCount, Math.max(1, descriptorColors.length))
    gl.uniform1i(uniforms.meshModel, meshModel)
    gl.uniform1i(uniforms.textureType, textureTypeToUniform(descriptor))
    gl.uniform1i(uniforms.bgMode, isContain ? 1 : 0)
    gl.uniform1f(uniforms.flow, descriptor.flow)
    gl.uniform1f(uniforms.softness, descriptor.meshRecipe?.softness ?? 0)
    gl.uniform1f(uniforms.meshSeed, meshSeed)
    gl.uniform1f(uniforms.meshWarp, meshWarp)
    gl.uniform1f(uniforms.meshScale, meshScale)
    gl.uniform1f(uniforms.radialRadius, radialRadius)
    // CSS owns global post-processing filters. Keep WebGL focused on content
    // generation and texture effects so gradient, mesh, picture, and pattern
    // share one blur/brightness/saturation behavior at the final layer.
    gl.uniform1f(
      uniforms.textureIntensity,
      descriptor.hasTexture ? clamp(descriptor.texture.intensity, 0, 100) / 100 : 0,
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

export const createWallpaperWebglRenderer = (
  canvas: HTMLCanvasElement,
  textureScale = 1,
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

  return new WallpaperWebglRenderer(canvas, gl, program, vertexBuffer, imageTexture, textureScale)
}
