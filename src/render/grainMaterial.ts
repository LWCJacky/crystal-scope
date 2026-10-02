import * as THREE from 'three'

/**
 * 多晶組織切面：以 Worley（Voronoi）雜訊在片元著色器中畫出晶粒，
 * 各晶粒依隨機方位略帶不同色調，晶界以螢幕空間固定寬度的深色線呈現，
 * 因此無論放大多少倍，晶界都清晰可見，且不增加任何幾何。
 * 晶粒大小與方位為假想的示意，不代表量測結果。
 */
export function createGrainMaterial(options: { seedsPerUnit: number; baseColor: string }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSeedsPerUnit: { value: options.seedsPerUnit },
      uBase: { value: new THREE.Color(options.baseColor) },
      uOpacity: { value: 1 },
      /** 目前視野高度（場景單位）；視野小於約 40 µm 時晶界逐漸消失（已在單一晶粒內）。 */
      uViewHeight: { value: 1 },
    },
    transparent: true,
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uSeedsPerUnit;
      uniform vec3 uBase;
      uniform float uOpacity;
      uniform float uViewHeight;
      varying vec3 vLocal;

      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      vec3 hsl2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
      }

      void main() {
        // 圓柱切面位於 xz 平面（軸為 y）
        vec2 p = vLocal.xz * uSeedsPerUnit;
        vec2 cell = floor(p);
        float d1 = 1e9;
        float d2 = 1e9;
        vec2 nearest = vec2(0.0);
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 c = cell + vec2(float(i), float(j));
            vec2 seed = c + hash2(c);
            float d = length(seed - p);
            if (d < d1) { d2 = d1; d1 = d; nearest = c; }
            else if (d < d2) { d2 = d; }
          }
        }
        // 各晶粒依「方位」帶不同色調（低飽和，維持金屬質感）
        vec2 h = hash2(nearest + 7.31);
        vec3 tint = hsl2rgb(vec3(h.x, 0.22, 0.52 + 0.16 * (h.y - 0.5)));
        vec3 color = mix(uBase, tint, 0.55);
        // 晶界：d2 − d1 接近 0 處；以導數換算成固定約 1.5 像素寬
        float edge = d2 - d1;
        float w = fwidth(edge) * 1.5;
        float boundary = smoothstep(0.0, w, edge);
        // 遠處（一顆晶粒不到數個像素）：晶粒細節淡成均勻金屬色，避免閃爍雜訊
        float perPixel = fwidth(p.x) + fwidth(p.y);
        float farDetail = 1.0 - smoothstep(0.08, 0.3, perPixel);
        // 近處（視野小於約 40 µm → 15 µm）：晶界淡出，相機隨後凍結在晶粒內的均勻色塊
        float nearDetail = smoothstep(0.0015, 0.004, uViewHeight);
        vec3 lined = mix(color * 0.25, color, boundary);
        // 近處：晶界與晶粒色調一起淡成基準色，與接手的表面晶格實心面同色
        color = mix(uBase, lined, nearDetail);
        color = mix(uBase, color, farDetail);
        gl_FragColor = vec4(color, uOpacity);
      }
    `,
  })
}
