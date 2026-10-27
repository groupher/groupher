// Canonical wallpaper shader shared by runtime preview and static export.
import { liquidBlob, random2, rotateUv, valueNoise } from "./mesh-math.wgsl";

const MAX_COLORS: i32 = 6;
const FLOW_STRAND_COUNT: i32 = 7;
const MESH_MODEL_LINEAR: u32 = 0u;
const MESH_MODEL_LIQUID: u32 = 2u;
const MESH_MODEL_RADIAL: u32 = 3u;
const MESH_MODEL_IMAGE: u32 = 4u;

struct Params {
  color0: vec4f,
  color1: vec4f,
  color2: vec4f,
  color3: vec4f,
  color4: vec4f,
  color5: vec4f,
  stops0: vec4f,
  stops1: vec2f,
  colorCount: u32,
  meshModel: u32,
  flow: f32,
  softness: f32,
  meshSeed: f32,
  meshWarp: f32,
  meshScale: f32,
  meshBrightness: f32,
  meshContrast: f32,
  globalBrightness: f32,
  globalSaturation: f32,
  blurRadius: f32,
  radialCenter: vec2f,
  radialRadius: f32,
  textureType: u32,
  textureIntensity: f32,
  textureScale: f32,
  resolution: vec2f,
  imageSize: vec2f,
  imageReady: f32,
  patternColor: vec4f,
  patternRepeat: vec2f,
  patternOpacity: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var patternSampler: sampler;
@group(0) @binding(2) var patternTexture: texture_2d<f32>;
@group(0) @binding(3) var imageSampler: sampler;
@group(0) @binding(4) var imageTexture: texture_2d<f32>;

fn colorAt(index: i32) -> vec3f {
  if (index == 1) { return params.color1.rgb; }
  if (index == 2) { return params.color2.rgb; }
  if (index == 3) { return params.color3.rgb; }
  if (index == 4) { return params.color4.rgb; }
  if (index == 5) { return params.color5.rgb; }
  return params.color0.rgb;
}

fn stopAt(index: i32) -> f32 {
  if (index == 1) { return clamp(params.stops0.y, 0.0, 1.0); }
  if (index == 2) { return clamp(params.stops0.z, 0.0, 1.0); }
  if (index == 3) { return clamp(params.stops0.w, 0.0, 1.0); }
  if (index == 4) { return clamp(params.stops1.x, 0.0, 1.0); }
  if (index == 5) { return clamp(params.stops1.y, 0.0, 1.0); }
  return clamp(params.stops0.x, 0.0, 1.0);
}

fn sampleGradient(t: f32) -> vec3f {
  let count = i32(max(params.colorCount, 1u));
  if (count <= 1) { return colorAt(0); }

  let value = clamp(t, 0.0, 1.0);
  var color = colorAt(count - 1);

  for (var index = 0; index < MAX_COLORS - 1; index += 1) {
    if (index >= count - 1) { break; }

    let leftStop = stopAt(index);
    let rightStop = max(stopAt(index + 1), leftStop + 0.0001);
    if (value <= leftStop) {
      color = colorAt(index);
      break;
    }
    if (value <= rightStop) {
      let localT = clamp((value - leftStop) / (rightStop - leftStop), 0.0, 1.0);
      color = mix(colorAt(index), colorAt(index + 1), localT);
      break;
    }
  }

  return color;
}

fn sampleFlowMesh(uv: vec2f, feather: f32) -> vec3f {
  let flowAmount = clamp(params.softness / 100.0, 0.0, 1.0);
  let flowUv = rotateUv(uv - 0.5, params.flow - 90.0) + 0.5;
  let y = flowUv.y;
  let fieldNoise = valueNoise(
    vec2f(flowUv.x * 0.55, y * 0.85) + params.meshSeed * 0.012,
    params.meshSeed,
  );
  var shadeField = 0.0;
  var color = sampleGradient(0.02) * (0.7 + fieldNoise * 0.16);

  let spacing = mix(0.15, 0.102, flowAmount);
  let curveAmount = mix(0.72, 1.65, flowAmount);
  let widthScale = mix(1.22, 0.9, flowAmount);
  let shadeAmount = mix(0.035, 0.085, flowAmount);

  for (var index = 0; index < FLOW_STRAND_COUNT; index += 1) {
    let strand = f32(index);
    let anchor = -0.2 + strand * spacing;
    let phase = strand * 1.91 + params.meshSeed * 0.004;
    var curve = sin(y * (1.15 + strand * 0.12) + phase) *
      (0.075 + 0.05 * sin(strand * 0.83));
    curve += sin(y * (2.15 + strand * 0.21) + phase * 1.47) *
      (0.038 + 0.016 * cos(strand));
    curve *= curveAmount;
    let slant = (y - 0.5) * (0.12 * sin(strand * 1.13));
    let centerX = anchor + curve + slant;
    let distX = abs(flowUv.x - centerX);
    let width = (0.046 + 0.018 * sin(strand * 1.27 + 0.8)) * widthScale;
    let haloWidth = width * 3.3 + feather * 0.2;
    let halo = 1.0 - smoothstep(width, haloWidth, distX);
    let core = 1.0 - smoothstep(width * 0.18, width, distX);
    let rim = smoothstep(width * 0.92, width * 1.28, distX) *
      (1.0 - smoothstep(width * 1.28, width * 2.1, distX));
    let pulse = 0.82 + 0.18 * sin(y * 2.2 + phase);
    let colorT = fract(0.08 + strand * 0.135);
    let strandColor = sampleGradient(colorT);

    color = mix(color, strandColor, clamp(halo * pulse * 0.28, 0.0, 0.72));
    color += strandColor * core * pulse * 0.28;
    shadeField += rim * shadeAmount;
  }

  let warmBloom = 1.0 - smoothstep(0.04, 0.76, distance(flowUv, vec2f(0.86, 0.1)));
  let lowPink = 1.0 - smoothstep(0.1, 0.82, distance(flowUv, vec2f(0.6, 0.86)));
  color += sampleGradient(0.9) * warmBloom * 0.3;
  color += sampleGradient(0.62) * lowPink * 0.18;
  color = mix(color, sampleGradient(0.04), clamp(shadeField, 0.0, 0.42));
  return color;
}

fn sampleLiquidMesh(uv: vec2f, feather: f32, warp: f32) -> vec3f {
  let scale = mix(0.48, 1.35, clamp(params.meshScale / 100.0, 0.0, 1.0));
  let softness = clamp(params.softness / 100.0, 0.0, 1.0);
  let spread = smoothstep(0.0, 1.0, softness);
  let radiusScale = mix(0.72, 1.2, spread);
  let liquidFeather = mix(0.02, feather * 1.12, spread);
  let flowUv = rotateUv(uv - 0.5, params.flow - 180.0) + 0.5;
  let drift = vec2f(
    valueNoise(flowUv * scale + vec2f(2.1, 7.4) + params.meshSeed * 0.009, params.meshSeed),
    valueNoise(flowUv * scale + vec2f(8.7, 1.9) + params.meshSeed * 0.011, params.meshSeed),
  ) - 0.5;
  let liquidUv = flowUv + drift * (0.025 + warp * mix(0.08, 0.24, spread));
  let mist = valueNoise(liquidUv * (scale * 0.72) + params.meshSeed * 0.006, params.meshSeed);

  let milk = liquidBlob(liquidUv, vec2f(0.28, 0.26), (0.7 + liquidFeather * 0.32) * radiusScale, warp, spread, 0.7);
  let blush = liquidBlob(liquidUv, vec2f(0.12, 0.76), (0.48 + liquidFeather * 0.2) * radiusScale, warp, spread, 2.1);
  let orange = liquidBlob(liquidUv, vec2f(0.62, 0.76), (0.36 + liquidFeather * 0.28) * radiusScale, warp, spread, 4.4);
  let sky = liquidBlob(liquidUv, vec2f(0.93, 0.34), (0.42 + liquidFeather * 0.3) * radiusScale, warp, spread, 6.2);
  let cream = liquidBlob(liquidUv, vec2f(0.42, 0.48), (0.54 + liquidFeather * 0.32) * radiusScale, warp, spread, 8.6);

  var color = mix(sampleGradient(0.0), sampleGradient(0.2), milk * mix(0.36, 0.66, spread));
  color = mix(color, sampleGradient(0.18), cream * mix(0.18, 0.56, spread));
  color = mix(color, sampleGradient(0.94), blush * mix(0.22, 0.4, spread));
  color = mix(color, sampleGradient(0.5), orange * mix(0.56, 0.94, spread));
  color = mix(color, sampleGradient(0.76), sky * mix(0.56, 0.9, spread));

  let lightVeil = 1.0 - smoothstep(0.12, 0.58 + liquidFeather * 0.9, distance(liquidUv, vec2f(0.22, 0.32)));
  let warmCore = 1.0 - smoothstep(0.03, 0.24 + liquidFeather * 0.75, distance(liquidUv, vec2f(0.58, 0.72)));
  let coolEdge = smoothstep(0.64, 0.98, liquidUv.x);
  color = mix(color, sampleGradient(0.14), lightVeil * mix(0.08, 0.24, spread));
  color += sampleGradient(0.5) * warmCore * mix(0.2, 0.42, spread);
  color = mix(color, sampleGradient(0.78), coolEdge * mix(0.16, 0.42 + mist * 0.18, spread));
  color = mix(color, sampleGradient(clamp(mist * 0.75 + 0.1, 0.0, 1.0)), mix(0.02, 0.08, spread));
  return color;
}

fn sampleLinearGradient(uv: vec2f) -> vec3f {
  let angle = radians(params.flow - 90.0);
  let direction = vec2f(cos(angle), sin(angle));
  let start = vec2f(0.5) - direction * 0.5;
  return sampleGradient(dot(uv - start, direction));
}

fn sampleRadialGradient(uv: vec2f) -> vec3f {
  let distanceFromCenter = distance(uv, params.radialCenter);
  return sampleGradient(distanceFromCenter / max(params.radialRadius, 0.01));
}

fn sampleImageColor(uv: vec2f) -> vec3f {
  if (params.imageReady < 0.5) { return vec3f(0.0); }

  let imageAspect = params.imageSize.x / max(params.imageSize.y, 1.0);
  let surfaceAspect = params.resolution.x / max(params.resolution.y, 1.0);
  var imageUv = uv;
  if (imageAspect > surfaceAspect) {
    let visibleWidth = surfaceAspect / imageAspect;
    imageUv.x = (uv.x - 0.5) * visibleWidth + 0.5;
  } else {
    let visibleHeight = imageAspect / surfaceAspect;
    imageUv.y = (uv.y - 0.5) * visibleHeight + 0.5;
  }
  return textureSample(imageTexture, imageSampler, clamp(imageUv, vec2f(0.0), vec2f(1.0))).rgb;
}

fn sampleBaseColor(uv: vec2f) -> vec3f {
  let softness = clamp(params.softness / 100.0, 0.0, 1.0);
  let warp = clamp(params.meshWarp / 100.0, 0.0, 1.0);
  let feather = mix(0.16, 0.46, softness);
  var color: vec3f;

  if (params.meshModel == MESH_MODEL_LINEAR) {
    color = sampleLinearGradient(uv);
  } else if (params.meshModel == MESH_MODEL_RADIAL) {
    color = sampleRadialGradient(uv);
  } else if (params.meshModel == MESH_MODEL_IMAGE) {
    color = sampleImageColor(uv);
  } else if (params.meshModel == MESH_MODEL_LIQUID) {
    color = sampleLiquidMesh(uv, feather, warp);
  } else {
    color = sampleFlowMesh(uv, feather);
  }

  color = (color - 0.5) * params.meshContrast + 0.5;
  return color * params.meshBrightness;
}

fn textureLuminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.299, 0.587, 0.114));
}

fn textureLine(point: vec2f, start: vec2f, end: vec2f, width: f32) -> f32 {
  let pa = point - start;
  let ba = end - start;
  let denominator = max(dot(ba, ba), 0.0001);
  let h = clamp(dot(pa, ba) / denominator, 0.0, 1.0);
  return 1.0 - smoothstep(width, width + 0.035, length(pa - ba * h));
}

fn textureAsciiGlyph(glyph: f32, point: vec2f) -> f32 {
  let thin = 0.045;
  let medium = 0.06;
  if (glyph < 0.5) {
    return textureLine(point, vec2f(0.22, 0.56), vec2f(0.78, 0.56), medium);
  }
  if (glyph < 1.5) {
    return max(
      textureLine(point, vec2f(0.22, 0.42), vec2f(0.78, 0.42), thin),
      textureLine(point, vec2f(0.22, 0.64), vec2f(0.78, 0.64), thin)
    );
  }
  if (glyph < 2.5) {
    return max(
      textureLine(point, vec2f(0.22, 0.52), vec2f(0.78, 0.52), medium),
      textureLine(point, vec2f(0.5, 0.22), vec2f(0.5, 0.82), medium)
    );
  }
  if (glyph < 3.5) {
    return max(
      textureLine(point, vec2f(0.28, 0.28), vec2f(0.72, 0.72), medium),
      textureLine(point, vec2f(0.72, 0.28), vec2f(0.28, 0.72), medium)
    );
  }
  if (glyph < 4.5) {
    return max(
      textureLine(point, vec2f(0.18, 0.18), vec2f(0.82, 0.82), medium),
      textureLine(point, vec2f(0.82, 0.18), vec2f(0.18, 0.72), medium)
    );
  }
  return textureLine(point, vec2f(0.18, 0.5), vec2f(0.82, 0.5), medium);
}

fn applyNoiseTexture(color: vec3f, uv: vec2f, strength: f32) -> vec3f {
  let pixel = uv * params.resolution;
  let field = valueNoise(pixel / 92.0 + vec2f(7.0, 19.0), params.meshSeed);
  let fine = valueNoise(pixel / max(1.0, 2.65 * params.textureScale), params.meshSeed + 17.0);
  let amount = clamp((0.025 + strength * strength * 0.68) * mix(0.78, 1.22, field), 0.0, 0.9);
  let delta = (fine - 0.5) * amount * 0.18;
  return clamp(color + vec3f(delta), vec3f(0.0), vec3f(1.0));
}

fn applyTileTexture(color: vec3f, uv: vec2f, strength: f32) -> vec3f {
  let amount = strength * strength * (3.0 - 2.0 * strength);
  let tileHeight = max(3.0, mix(8.0, 30.0, amount) * params.textureScale);
  let tileWidth = tileHeight * 0.72;
  let pixel = uv * params.resolution;
  let tileSize = vec2f(tileWidth, tileHeight);
  let grid = pixel / tileSize;
  let cell = floor(grid);
  let local = fract(grid) * tileSize;
  let center = tileSize * 0.5;
  let halfSize = tileSize * 0.5 - vec2f(mix(0.45, 1.05, amount));
  let radius = min(tileHeight * 0.14, min(halfSize.x, halfSize.y));
  let q = abs(local - center) - (halfSize - vec2f(radius));
  let roundedRect = length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - radius;
  let tileMask = 1.0 - smoothstep(-0.25, 0.75, roundedRect);
  let tileUv = clamp((cell + vec2f(0.5)) * tileSize / params.resolution, vec2f(0.0), vec2f(1.0));
  let tileColor = sampleBaseColor(tileUv);
  let grout = color * (0.5 + strength * 0.08);
  return mix(grout, tileColor, tileMask);
}

fn applyDotsTexture(color: vec3f, uv: vec2f, strength: f32) -> vec3f {
  let amount = strength * strength * (3.0 - 2.0 * strength);
  let pixel = uv * params.resolution;
  let cellSize = max(4.0, 14.0 * params.textureScale);
  let row = floor(pixel.y / cellSize);
  let rowOffset = select(0.0, cellSize * 0.5, fract(row * 0.5) > 0.25);
  let grid = vec2f((pixel.x + rowOffset) / cellSize, pixel.y / cellSize);
  let cellId = floor(grid);
  let local = fract(grid) - 0.5;
  let density = clamp(mix(0.08, 0.92, amount) * mix(0.86, 1.12, random2(vec2f(row, 41.0))), 0.0, 0.96);
  let keep = step(random2(cellId + vec2f(17.0, 79.0)), density);
  let centerPx = vec2f((cellId.x + 0.5) * cellSize - rowOffset, (cellId.y + 0.5) * cellSize);
  let centerUv = clamp(centerPx / params.resolution, vec2f(0.0), vec2f(1.0));
  let sampled = sampleBaseColor(centerUv);
  let radius = max(1.0, mix(3.0, 3.8, amount) * params.textureScale)
    * mix(0.92, 1.08, random2(cellId + vec2f(61.0, 13.0)));
  let dotMask = 1.0 - smoothstep(radius, radius + 1.05, length(local * cellSize));
  let alpha = dotMask * keep * (0.58 + amount * 0.2);
  let lum = textureLuminance(sampled);
  let chroma = sampled - vec3f(lum);
  let dotColor = clamp(vec3f(lum + 0.16 + amount * 0.08) + chroma * (1.12 + amount * 0.22), vec3f(0.0), vec3f(1.0));
  return mix(color, dotColor, alpha);
}

fn applyAsciiTexture(color: vec3f, uv: vec2f, strength: f32) -> vec3f {
  let pixel = uv * params.resolution;
  let cellSize = max(vec2f(4.0, 6.0), vec2f(mix(14.0, 8.0, strength), mix(18.0, 12.0, strength)) * params.textureScale);
  let cell = floor(pixel / cellSize);
  let local = fract(pixel / cellSize);
  let cellUv = clamp((cell + vec2f(0.5)) * cellSize / params.resolution, vec2f(0.0), vec2f(1.0));
  let sampled = sampleBaseColor(cellUv);
  let lum = textureLuminance(sampled);
  let jitter = (random2(cell + vec2f(17.0, 53.0)) - 0.5) * 0.14;
  let glyph = floor(clamp(lum + jitter, 0.0, 0.999) * 8.0);
  let mask = textureAsciiGlyph(glyph, local);
  let softened = mix(color, sampled * mix(0.84, 0.64, strength), strength * 0.42);
  let ink = clamp(mix(sampled, vec3f(1.0), 0.28 + strength * 0.48), vec3f(0.0), vec3f(1.0));
  let alpha = mask * (0.34 + strength * 0.54) * (0.34 + lum * 0.76);
  return mix(softened, ink, alpha);
}

fn applyBeamTexture(color: vec3f, uv: vec2f, strength: f32) -> vec3f {
  let pixel = uv * params.resolution;
  let amount = clamp(0.58 + pow(strength, 0.48) * 0.42, 0.0, 1.0);
  let spacing = mix(54.0, 13.0, pow(strength, 0.72)) * params.textureScale;
  let column = floor(pixel.x / max(4.0, spacing));
  let variance = random2(vec2f(column, 42137.0));
  let center = (column + 0.5 + (variance - 0.5) * 0.18) * spacing;
  let sourceUv = clamp(vec2f(center / params.resolution.x, uv.y), vec2f(0.0), vec2f(1.0));
  let sampled = sampleBaseColor(sourceUv);
  let ridge = smoothstep(0.56, 0.92, fract(pixel.x / max(4.0, spacing)));
  let glass = mix(color, sampled, 0.42 + amount * 0.3);
  return clamp(glass + vec3f(ridge * (0.012 + amount * 0.04)), vec3f(0.0), vec3f(1.0));
}

fn applyOilTexture(color: vec3f, uv: vec2f, strength: f32) -> vec3f {
  let amount = strength * strength * (3.0 - 2.0 * strength);
  let fieldScale = mix(6.0, 2.1, amount);
  let angleSeed = valueNoise(uv * vec2f(fieldScale, fieldScale * 0.82) + vec2f(47.0, 131.0), params.meshSeed);
  let bend = valueNoise(uv * vec2f(fieldScale * 1.43, fieldScale * 1.18) + vec2f(7.0, 23.0), params.meshSeed + 9.0) - 0.5;
  let angle = (angleSeed - 0.5) * 1.18 + bend * 0.46;
  let direction = vec2f(cos(angle), sin(angle));
  let drag = direction * mix(26.0, 92.0, amount) / params.resolution * mix(0.62, 1.34, amount);
  var dragged = color * mix(0.34, 0.18, amount);
  dragged += sampleBaseColor(clamp(uv - drag * 0.34, vec2f(0.0), vec2f(1.0))) * 0.18;
  dragged += sampleBaseColor(clamp(uv - drag * 0.72, vec2f(0.0), vec2f(1.0))) * 0.17;
  dragged += sampleBaseColor(clamp(uv - drag * 1.12, vec2f(0.0), vec2f(1.0))) * 0.14;
  dragged += sampleBaseColor(clamp(uv - drag * 1.58, vec2f(0.0), vec2f(1.0))) * mix(0.08, 0.14, amount);
  dragged /= 0.9;
  return clamp(mix(color, dragged, 0.46 + amount * 0.5), vec3f(0.0), vec3f(1.0));
}

fn applyTexture(color: vec3f, uv: vec2f) -> vec3f {
  let strength = clamp(params.textureIntensity, 0.0, 1.0);
  if (params.textureType == 0u || strength <= 0.0) { return color; }
  if (params.textureType == 1u) { return applyNoiseTexture(color, uv, strength); }
  if (params.textureType == 5u) { return applyBeamTexture(color, uv, strength); }
  if (params.textureType == 6u) { return applyAsciiTexture(color, uv, strength); }
  if (params.textureType == 7u) { return applyDotsTexture(color, uv, strength); }
  if (params.textureType == 8u) { return applyTileTexture(color, uv, strength); }
  if (params.textureType == 9u) { return applyOilTexture(color, uv, strength); }
  return color;
}

fn sampleWallpaperBaseColor(uv: vec2f) -> vec3f {
  var color = sampleBaseColor(uv);
  color = applyTexture(color, uv);
  let patternMask = textureSample(patternTexture, patternSampler, fract(uv * params.patternRepeat)).a;
  let patternAmount = clamp(patternMask * params.patternOpacity, 0.0, 1.0);
  color = mix(color, params.patternColor.rgb, patternAmount);
  return color;
}

// Generation runs once per pixel; blur and color effects sample this pass in wallpaper-post.wgsl.
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return vec4f(sampleWallpaperBaseColor(uv), 1.0);
}
