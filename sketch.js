// =====================================================================
//  《流动的抽象 · Flowing Abstraction》— 起始文件 / starter
//  PART A（下面）是身体姿态引擎，不要修改。/ PART A (below) is the pose engine: don't change it.
//  PART B 只留下 5 个 ★ 标记的函数：每一步让 Qwen 改写其中一个。
//  PART B leaves 5 functions marked with ★: at each step, Qwen rewrites one of them.
// =====================================================================


// ---------------------------------------------------------------------
//  PART A — 身体姿态引擎（三个项目完全相同，不要修改）
//  PART A — body pose engine (identical in all three projects, don't change it)
// ---------------------------------------------------------------------
const MP_VERSION = "0.10.21";
// MediaPipe 的两个下载来源：先用国内镜像 npmmirror，失败再用 jsDelivr
const MP_URLS = [
  `https://registry.npmmirror.com/@mediapipe/tasks-vision/${MP_VERSION}/files`,
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`,
];
// 姿态模型：先找项目文件夹里的 pose_landmarker_lite.task，没有再从 Google 下载
const MODEL_URLS = [
  "pose_landmarker_lite.task",
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
];

// 常用的身体关键点编号（一共 33 个点）。画面是镜像的：你的左手显示在画面左边。
// Body landmark numbers (33 in total). The picture is mirrored: your left hand is on the left of the screen.
const BODY = {
  NOSE: 0,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
};

let video;                 // 摄像头画面 / the webcam
let poseLandmarker = null; // MediaPipe 姿态模型 / the pose model
let poses = [];            // 每一帧：看到的所有人（最多 2 个）。每个人 = 33 个点 {x, y, z, visibility}
                           // every frame: the people the camera sees (max 2); each = 33 points {x, y, z, visibility}
                           // x、y 是画布像素坐标（已经镜像）/ x, y are canvas pixels (already mirrored)
let lastVideoTime = -1;
let started = false;
let showCamera = false;
let showSkeleton = false;

async function loadPoseLandmarker() {
  setStatus("正在加载姿态模型… / Loading the pose model…");
  for (const base of MP_URLS) {
    let vision, fileset;
    try {
      vision = await import(`${base}/vision_bundle.mjs`);
      fileset = await vision.FilesetResolver.forVisionTasks(`${base}/wasm`);
    } catch (e) {
      continue;
    }
    for (const model of MODEL_URLS) {
      for (const delegate of ["GPU", "CPU"]) {
        try {
          poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: model, delegate },
            runningMode: "VIDEO",
            numPoses: 2,
          });
          return;
        } catch (e) {
          // 失败就试下一个 / try the next one
        }
      }
    }
  }
  setStatus("⚠️ 姿态模型加载失败：请把 pose_landmarker_lite.task 放进项目文件夹 / Pose model failed to load: put pose_landmarker_lite.task in the project folder");
}

// 每一帧调用一次 / call once per frame
let cameraOk = null;
function updatePoses() {
  if (!poseLandmarker || !video) return;
  const ok = video.elt.readyState >= 2;
  if (ok !== cameraOk) {
    cameraOk = ok;
    setStatus(ok ? "退后一点，让摄像头看到你的上半身 🧍 / Step back so the camera sees your upper body"
                 : "正在等待摄像头… / Waiting for the camera…");
  }
  if (!ok) return;
  if (video.elt.currentTime === lastVideoTime) return;
  lastVideoTime = video.elt.currentTime;

  const result = poseLandmarker.detectForVideo(video.elt, performance.now());
  poses = result.landmarks.map((pts) =>
    pts.map((p) => ({ x: (1 - p.x) * width, y: p.y * height, z: p.z, visibility: p.visibility === undefined ? 1 : p.visibility }))
  );
}

// 这个点看得清楚吗？/ is this point clearly visible?
function isVisible(p) {
  return p && p.visibility > 0.5 && p.x > -50 && p.x < width + 50 && p.y > -50 && p.y < height + 50;
}

// 画出细细的骨架（学习和调试用，按 K 显示/隐藏）/ thin skeleton for learning and debugging (key K)
const SKELETON = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
function drawSkeleton() {
  push();
  for (const pose of poses) {
    stroke(255, 255, 0, 200);
    strokeWeight(2);
    for (const [a, b] of SKELETON) {
      if (isVisible(pose[a]) && isVisible(pose[b])) line(pose[a].x, pose[a].y, pose[b].x, pose[b].y);
    }
    noStroke();
    fill(255, 80, 80);
    for (const i of Object.values(BODY)) if (isVisible(pose[i])) circle(pose[i].x, pose[i].y, 8);
  }
  pop();
}

function drawCamera() {
  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 90);
  image(video, 0, 0, width, height);
  pop();
}

function setStatus(msg) {
  select("#status").html(msg);
}


// ---------------------------------------------------------------------
//  PART B — 作品：《流动的抽象》（致敬赵无极）
//  PART B — artwork: "Flowing Abstraction" (after Zao Wou-Ki)
// ---------------------------------------------------------------------

const GROUND = "#16130f";        // 深色的底色 / dark ground
const GROUND_RGB = [0.086, 0.075, 0.059];
// 冷色和暖色两套颜色：双手举过肩膀用暖色 / cool and warm palettes: warm when both wrists are above the shoulders
const COOL = ["#1f4e79", "#3f88a8", "#9fd0d6", "#f2efe4", "#16324a"];
const WARM = ["#c2452d", "#e8a33d", "#f5d79e", "#7a2e1f", "#fff4e0"];
const BRUSHES = [15, 16, 13, 14, 0];          // 手腕、手肘、鼻子都是画笔 / wrists, elbows and nose are brushes
const BELLS = [62, 64, 66, 69, 71, 74, 76, 78]; // D 大调五声音阶 / D major pentatonic

let flowShader = null;
let shaderError = "";
let prevPts = {};        // 每个画笔上一帧的位置 / last position of each brush
let lastSide = {};       // 手腕在画面中线的哪一边 / which side of the centre line each wrist is on
let open = 0.5;          // 双臂张开的程度 / how open the arms are
let speed = 0;           // 画笔的速度 / brush speed

// 声音 / sound
let padFilter, delay, reverb, comp;
let pad = [];
let swish, swishFilter;
let bells = [];
let nextBell = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  background(GROUND);
  makeShader();
  select("#start").mouseClicked(startExperience);
}

// 把 2 个 GLSL 小函数拼成流动的着色器 / put the 2 small GLSL functions together into the flow shader
function makeShader() {
  const src = `precision highp float;
varying vec2 vTexCoord;
uniform sampler2D tex0;
uniform vec2 texelSize;
uniform float uTime;
uniform vec3 uGround;

${glslNoise()}

${glslFlow()}

void main() {
  vec2 uv = vTexCoord;
  vec2 v = flow(uv * 3.0, uTime * 0.05);
  vec2 src = uv - v * 0.0025;
  vec4 c = texture2D(tex0, src) * 0.6;
  c += texture2D(tex0, src + vec2(texelSize.x, 0.0)) * 0.1;
  c += texture2D(tex0, src - vec2(texelSize.x, 0.0)) * 0.1;
  c += texture2D(tex0, src + vec2(0.0, texelSize.y)) * 0.1;
  c += texture2D(tex0, src - vec2(0.0, texelSize.y)) * 0.1;
  c.rgb = mix(c.rgb, uGround, 0.004);
  gl_FragColor = vec4(c.rgb, 1.0);
}`;
  shaderError = glslError(src);
  flowShader = shaderError ? null : createFilterShader(src);
  if (shaderError) setStatus("⚠️ GLSL: " + shaderError);
}

function startExperience() {
  userStartAudio();
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // 声音链：和弦 → 低通滤波 → 回声 → 混响 → 压缩器 / chain: pad → low-pass → echo → reverb → compressor
  padFilter = new p5.LowPass();
  padFilter.freq(800);
  padFilter.res(2);
  padFilter.disconnect();
  delay = new p5.Delay();
  delay.process(padFilter, 0.5, 0.4, 2500);
  delay.drywet(0.3);
  delay.disconnect();
  reverb = new p5.Reverb();
  reverb.process(delay, 6, 2);
  reverb.drywet(0.45);
  reverb.disconnect();
  comp = new p5.Compressor();
  comp.process(reverb, 0.005, 6, 6, -24, 0.25);

  const voicing = [[50, "sine"], [57, "triangle"], [64, "sine"], [66, "sine"], [69, "sine"]]; // Dmaj9
  for (const [m, type] of voicing) {
    const osc = new p5.Oscillator(type);
    osc.disconnect();
    osc.connect(padFilter);
    osc.freq(midiToFreq(m));
    osc.amp(0.045, 3);
    osc.start();
    pad.push(osc);
  }

  swishFilter = new p5.BandPass();
  swishFilter.res(3);
  swishFilter.disconnect();
  swishFilter.connect(reverb);
  swish = new p5.Noise("pink");
  swish.disconnect();
  swish.connect(swishFilter);
  swish.amp(0);
  swish.start();

  for (let i = 0; i < 4; i++) {
    const osc = new p5.Oscillator("triangle");
    osc.disconnect();
    osc.connect(delay);
    osc.amp(0);
    osc.start();
    const env = new p5.Envelope();
    env.setADSR(0.003, 1.5, 0, 0.5);
    env.setRange(0.1, 0);
    bells.push({ osc, env });
  }

  select("#intro").hide();
  started = true;
  loadPoseLandmarker();
}

function draw() {
  // 不画背景：上一帧的画留在画布上，着色器让它继续流动
  // no background(): last frame stays on the canvas and the shader keeps it flowing
  if (started) {
    updatePoses();
    const pose = poses[0];
    let fastest = 0;
    if (pose) {
      open = lerp(open, armOpenness(pose), 0.1);
      const warm = isVisible(pose[15]) && isVisible(pose[16]) && isVisible(pose[11]) &&
        pose[15].y < pose[11].y && pose[16].y < pose[12].y;
      const pal = warm ? WARM : COOL;
      BRUSHES.forEach((i, k) => {
        const p = pose[i];
        if (!isVisible(p)) return;
        const prev = prevPts[i] || p;
        const s = dist(p.x, p.y, prev.x, prev.y);
        fastest = max(fastest, s);
        if (s < 150) splat(p.x, p.y, map(s, 0, 40, 18, 60, true) * (i === 0 ? 0.6 : 1), pal[k % pal.length]);
        prevPts[i] = { x: p.x, y: p.y };
      });
      ringBells(pose);
    } else {
      prevPts = {};
    }
    speed = lerp(speed, fastest, 0.2);
    if (pad.length) soundFromBody(open, speed);
  }

  if (flowShader) {
    flowShader.setUniform("uTime", millis() / 1000);
    flowShader.setUniform("uGround", GROUND_RGB);
    filter(flowShader);
  }
  if (started && showSkeleton) drawSkeleton();
}

// ★★★★★★ 第 1 步 开始 / STEP 1 START：splat（把整个函数换成 Qwen 写的版本 / replace the whole function with Qwen's version）★★★★★★
function splat(x, y, r, col) {
  // 临时版本：一个小小的实心圆 / placeholder: a small solid circle
  noStroke();
  fill(col);
  circle(x, y, r * 0.5);
}
// ★★★★★★ 第 1 步 结束 / STEP 1 END ★★★★★★

// ★★★★★★ 第 2 步 开始 / STEP 2 START：glslNoise（把整个函数换成 Qwen 写的版本 / replace the whole function with Qwen's version）★★★★★★
function glslNoise() {
  // 临时版本：到处都一样 / placeholder: the same everywhere
  return `float noise(vec2 p) {
  return 0.5;
}`;
}
// ★★★★★★ 第 2 步 结束 / STEP 2 END ★★★★★★

// ★★★★★★ 第 3 步 开始 / STEP 3 START：glslFlow（把整个函数换成 Qwen 写的版本 / replace the whole function with Qwen's version）★★★★★★
function glslFlow() {
  // 临时版本：颜料不流动 / placeholder: the paint doesn't flow
  return `vec2 flow(vec2 p, float t) {
  return vec2(0.0, 0.0);
}`;
}
// ★★★★★★ 第 3 步 结束 / STEP 3 END ★★★★★★

// ★★★★★★ 第 4 步 开始 / STEP 4 START：armOpenness（把整个函数换成 Qwen 写的版本 / replace the whole function with Qwen's version）★★★★★★
function armOpenness(pose) {
  // 临时版本：永远是一半 / placeholder: always half
  return 0.5;
}
// ★★★★★★ 第 4 步 结束 / STEP 4 END ★★★★★★

// ★★★★★★ 第 5 步 开始 / STEP 5 START：soundFromBody（把整个函数换成 Qwen 写的版本 / replace the whole function with Qwen's version）★★★★★★
function soundFromBody(open, speed) {
  // 临时版本：声音不跟着身体变化 / placeholder: the sound doesn't follow the body
}
// ★★★★★★ 第 5 步 结束 / STEP 5 END ★★★★★★

// ---------- 下面这些已经写好了，不需要改 / already written, no need to change ----------

// 手腕穿过画面中线时，响一声铃 / a bell rings when a wrist crosses the centre line
function ringBells(pose) {
  for (const i of [15, 16]) {
    const p = pose[i];
    if (!isVisible(p)) continue;
    const side = p.x < width / 2 ? "L" : "R";
    if (lastSide[i] && lastSide[i] !== side && bells.length) {
      const v = bells[nextBell];
      nextBell = (nextBell + 1) % bells.length;
      v.osc.freq(midiToFreq(BELLS[floor(map(p.y, height, 0, 0, BELLS.length - 0.01, true))]));
      v.env.play(v.osc);
    }
    lastSide[i] = side;
  }
}

function glslError(src) {
  const gl = document.createElement("canvas").getContext("webgl");
  if (!gl) return "";
  const s = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? "" : (gl.getShaderInfoLog(s) || "compile error").split("\n")[0];
}

function keyPressed() {
  if (key === "c" || key === "C") background(GROUND);
  if (key === "s" || key === "S") saveCanvas("my-zao-wou-ki", "png");
  if (key === "k" || key === "K") showSkeleton = !showSkeleton;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(GROUND);
}
