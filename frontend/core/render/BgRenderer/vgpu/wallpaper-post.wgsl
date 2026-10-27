// Sample the generated wallpaper instead of expanding its procedural shader per blur tap.
struct PostParams {
  resolution: vec2f,
  blurRadius: f32,
  brightness: f32,
  saturation: f32,
}

@group(0) @binding(0) var<uniform> params: PostParams;
@group(0) @binding(1) var wallpaperSampler: sampler;
@group(0) @binding(2) var wallpaperTexture: texture_2d<f32>;

fn sampleWallpaper(uv: vec2f) -> vec3f {
  return textureSample(wallpaperTexture, wallpaperSampler, clamp(uv, vec2f(0.0), vec2f(1.0))).rgb;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var color = sampleWallpaper(uv);
  if (params.blurRadius > 0.001) {
    let texel = vec2f(1.0) / max(params.resolution, vec2f(1.0));
    let first = texel * params.blurRadius * 1.384615;
    let second = texel * params.blurRadius * 3.230769;
    color *= 0.227027;
    color += (
      sampleWallpaper(uv + vec2f(first.x, 0.0)) +
      sampleWallpaper(uv - vec2f(first.x, 0.0)) +
      sampleWallpaper(uv + vec2f(0.0, first.y)) +
      sampleWallpaper(uv - vec2f(0.0, first.y))
    ) * 0.158108;
    color += (
      sampleWallpaper(uv + vec2f(second.x, 0.0)) +
      sampleWallpaper(uv - vec2f(second.x, 0.0)) +
      sampleWallpaper(uv + vec2f(0.0, second.y)) +
      sampleWallpaper(uv - vec2f(0.0, second.y))
    ) * 0.035135;
  }
  let luminance = dot(color, vec3f(0.299, 0.587, 0.114));
  color = mix(vec3f(luminance), color, max(params.saturation, 0.0));
  color *= max(params.brightness, 0.0);
  return vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), 1.0);
}
