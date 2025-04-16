// --- 調整可能な設定値 ---
const STAR_COUNT = 800;
const STAR_RANGE = 1000;
const STAR_MIN_HUE = 0;
const STAR_MAX_HUE = 180;
const STAR_SATURATION = 100;
const STAR_LIGHTNESS = 70;
const STAR_GLOW_SIZE = 7.0;
const STAR_CORE_SIZE = 2.5;
const STAR_GLOW_ALPHA = 0.65;
const STAR_CORE_LIGHTNESS_OFFSET = 30;
const STAR_MOVE_SPEED = 3.5; // ★ 星が手前に流れてくる速度 (値を調整)

const LASER_COUNT = 5;
const MIN_LASER_SPEED = 0.008;
const MAX_LASER_SPEED = 0.025;
const MIN_LASER_HUE = 180;
const MAX_LASER_HUE = 300;
const LASER_SATURATION = 100;
const LASER_LIGHTNESS = 50;
const LASER_GLOW_WEIGHT = 8.0;
const LASER_CORE_WEIGHT = 1.2;
const LASER_GLOW_LIGHTNESS_OFFSET = -20;
const LASER_GLOW_ALPHA = 0.5;
const LASER_CORE_SATURATION_FACTOR = 0.2;
const LASER_CORE_LIGHTNESS_OFFSET = 45;
const LASER_VISIBLE_LENGTH = 60;

const TRAIL_LENGTH = 15;
const TRAIL_START_WEIGHT = 1.5;
const TRAIL_END_WEIGHT = 0.1;

// --- グローバル変数 ---
let stars = []; // { position: p5.Vector, color: color }[]
let lasers = []; // ★ fixedStartPoint, fixedEndPoint を追加
let canvas;
let gl;
let camZ; // ★ カメラのZ座標を保持

function setup() {
  canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('canvas-container');
  colorMode(HSL);

  gl = drawingContext;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);

  // 星の初期化 (変更なし)
  for (let i = 0; i < STAR_COUNT; i++) {
    let starHue = random(STAR_MIN_HUE, STAR_MAX_HUE);
    stars.push({
      position: createVector(
        random(-STAR_RANGE, STAR_RANGE),
        random(-STAR_RANGE, STAR_RANGE),
        random(-STAR_RANGE, STAR_RANGE) // Z座標もランダムに初期化
      ),
      color: color(starHue, STAR_SATURATION, STAR_LIGHTNESS)
    });
  }

  // レーザーの初期化 (fixedプロパティを追加)
  for (let i = 0; i < LASER_COUNT; i++) {
    lasers.push({
      startPoint: createVector(), // 計算用の一時的な始点（使わなくなるかも）
      endPoint: createVector(),   // 計算用の一時的な終点（使わなくなるかも）
      currentPos: createVector(),
      progress: 1.0,
      speed: random(MIN_LASER_SPEED, MAX_LASER_SPEED),
      color: color(random(MIN_LASER_HUE, MAX_LASER_HUE), LASER_SATURATION, LASER_LIGHTNESS),
      trail: [],
      fixedStartPoint: createVector(), // ★ レーザー開始時の始点座標
      fixedEndPoint: createVector()    // ★ レーザー開始時の終点座標
    });
  }

  perspective(PI / 3.0, width / height, 0.1, STAR_RANGE * 4);
}

function draw() {
  // カメラZ座標計算 (setupから移動、毎フレーム必要)
  camZ = (height / 2.0) / tan(PI / 6.0); // 基本Z位置
  camera(0, 0, camZ + STAR_RANGE * 0.6, 0, 0, 0, 0, 1, 0);

  background(0); // 完全クリア

  try {
    // --- 描画処理 ---
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    drawLaserTrails();
    drawStars('glow');
    drawLasers('glow'); // ★ fixedStart/End を使うように修正済み

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    drawStars('core');
    drawLasers('core'); // ★ fixedStart/End を使うように修正済み

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  } catch (e) {
      console.error("描画中にエラー:", e); noLoop();
  }

  try {
      // --- 更新処理 ---
      updateStars();   // ★ 星の位置更新を追加
      updateLasers(); // ★ fixedStart/End を使うように修正
  } catch (e) {
      console.error("更新中にエラー:", e); noLoop();
  }
}

// ★ 星の位置を更新する関数
function updateStars() {
    // 星を再配置するZ座標の閾値（カメラより少し手前）
    const resetThresholdZ = camZ + STAR_RANGE * 0.5; // カメラZ位置より少し手前
    // 再配置されるZ座標の範囲（遠方）
    const resetPosZMin = -STAR_RANGE * 1.2;
    const resetPosZMax = -STAR_RANGE * 1.0;

    for (let star of stars) {
        // Z座標を更新 (手前に移動)
        star.position.z += STAR_MOVE_SPEED;

        // 閾値を超えたら遠方に再配置
        if (star.position.z > resetThresholdZ) {
            star.position.x = random(-STAR_RANGE, STAR_RANGE);
            star.position.y = random(-STAR_RANGE, STAR_RANGE);
            star.position.z = random(resetPosZMin, resetPosZMax); // 遠方のランダムなZ位置へ
            // 任意: 色も再設定
            // let starHue = random(STAR_MIN_HUE, STAR_MAX_HUE);
            // star.color = color(starHue, STAR_SATURATION, STAR_LIGHTNESS);
        }
    }
}

// レーザーの状態更新 (fixedStart/End を使用)
function updateLasers() {
  if (stars.length < 2) return;
  for (let laser of lasers) {
    // 軌跡データの更新
    if (laser.progress < 1.0 && laser.progress >= 0) {
        if (laser.currentPos && typeof laser.currentPos.copy === 'function') {
             laser.trail.push(laser.currentPos.copy());
             if (laser.trail.length > TRAIL_LENGTH) {
                 laser.trail.shift();
             }
        }
    }
    // 進行度と位置の更新
    if (laser.progress >= 1.0) {
       // 新しいターゲットの星を選択
       let startIndex = floor(random(stars.length));
       let endIndex = floor(random(stars.length));
       while (endIndex === startIndex) {
         endIndex = floor(random(stars.length));
       }
       // 選択した星が存在するか確認
       if (stars[startIndex] && stars[startIndex].position && stars[endIndex] && stars[endIndex].position) {
           // ★ fixedStart/End に現在の星の位置をコピーして固定
           laser.fixedStartPoint.set(stars[startIndex].position);
           laser.fixedEndPoint.set(stars[endIndex].position);
           laser.progress = 0.0;
           laser.currentPos.set(laser.fixedStartPoint); // 開始位置は固定始点
           // 新しい色と速度を設定
           let randomHue = random(MIN_LASER_HUE, MAX_LASER_HUE);
           laser.color = color(randomHue, LASER_SATURATION, LASER_LIGHTNESS);
           laser.speed = random(MIN_LASER_SPEED, MAX_LASER_SPEED);
           laser.trail = []; // 軌跡リセット
       } else {
           laser.progress = 1.0; // エラーの場合は待機
       }
    } else if (laser.progress >= 0) {
       laser.progress += laser.speed;
       laser.progress = min(laser.progress, 1.0);
       // ★ fixedStart/End を使って現在位置を計算
       if (laser.fixedStartPoint && laser.fixedEndPoint) {
           laser.currentPos = p5.Vector.lerp(laser.fixedStartPoint, laser.fixedEndPoint, laser.progress);
       }
    }
  }
}

// レーザー軌跡の描画関数 (変更なし)
function drawLaserTrails() {
  // (前回のコードと同じ)
  for (let laser of lasers) {
    if (laser.trail && laser.trail.length > 1) {
      let baseHue = hue(laser.color); let baseSat = saturation(laser.color); let baseLight = lightness(laser.color);
      beginShape(LINES);
      for (let i = 0; i < laser.trail.length; i++) {
        if (!(laser.trail[i] instanceof p5.Vector)) continue;
        if (i > 0 && !(laser.trail[i-1] instanceof p5.Vector)) continue;
        let trailProgress = (laser.trail.length === 1) ? 1 : i / (laser.trail.length - 1);
        let alpha = map(trailProgress, 0, 1, 0.02, LASER_GLOW_ALPHA * 0.7);
        let weight = map(trailProgress, 0, 1, TRAIL_END_WEIGHT, TRAIL_START_WEIGHT);
        let light = lerp(baseLight * 0.4, baseLight * 0.8, trailProgress);
        strokeWeight(max(0.1, weight)); stroke(baseHue, baseSat, light, max(0, alpha));
        if (i > 0) { vertex(laser.trail[i-1].x, laser.trail[i-1].y, laser.trail[i-1].z); vertex(laser.trail[i].x, laser.trail[i].y, laser.trail[i].z); }
      }
      endShape();
    }
  }
}

// 星の描画関数 (変更なし)
function drawStars(type) {
  // (前回のコードと同じ)
  noStroke();
  for (let star of stars) {
    if (!star || !star.position || !star.color) continue;
    let baseHue = hue(star.color); let baseSat = saturation(star.color); let baseLight = lightness(star.color);
    let drawColor, diameter;
    if (type === 'glow') { diameter = STAR_GLOW_SIZE; let glowAlpha = STAR_GLOW_ALPHA; drawColor = color(baseHue, baseSat, baseLight, glowAlpha); }
    else { diameter = STAR_CORE_SIZE; let coreLight = constrain(baseLight + STAR_CORE_LIGHTNESS_OFFSET, 0, 100); drawColor = color(baseHue, baseSat, coreLight); }
    fill(drawColor); push(); translate(star.position.x, star.position.y, star.position.z); ellipse(0, 0, diameter, diameter); pop();
  }
}

// レーザー描画専用関数 (fixedStart/End を使用)
function drawLasers(type) {
  for (let laser of lasers) {
     // ★ fixedStart/End をチェック
     if (!laser || !laser.color || !laser.fixedStartPoint || !laser.fixedEndPoint || !laser.currentPos) continue;

    let displayStartPos;
    // ★ 距離計算も fixed を使用
    const totalDistance = laser.fixedStartPoint.dist(laser.fixedEndPoint);

    if (totalDistance > 0.001 && laser.progress > 0) {
        const lengthProgress = LASER_VISIBLE_LENGTH / totalDistance;
        const startProgress = constrain(laser.progress - lengthProgress, 0, laser.progress);
        // ★ lerp も fixed を使用
        displayStartPos = p5.Vector.lerp(laser.fixedStartPoint, laser.fixedEndPoint, startProgress);
    } else {
         displayStartPos = laser.currentPos;
    }

    if (displayStartPos.dist(laser.currentPos) < 0.1) { continue; }

    let baseHue = hue(laser.color); let baseSat = saturation(laser.color); let baseLight = lightness(laser.color);
    let drawColor, weight;
    if (type === 'glow') { weight = LASER_GLOW_WEIGHT; let glowLight = constrain(baseLight + LASER_GLOW_LIGHTNESS_OFFSET, 0, 100); let glowAlpha = LASER_GLOW_ALPHA; drawColor = color(baseHue, baseSat, glowLight, glowAlpha); }
    else { weight = LASER_CORE_WEIGHT; let coreSat = baseSat * LASER_CORE_SATURATION_FACTOR; let coreLight = constrain(baseLight + LASER_CORE_LIGHTNESS_OFFSET, 0, 100); drawColor = color(baseHue, coreSat, coreLight); }

    strokeWeight(max(0.1, weight)); stroke(drawColor);

    // ★ line() も fixedStart/End から計算した座標を使う
    if (displayStartPos && isFinite(displayStartPos.x) && laser.currentPos && isFinite(laser.currentPos.x) /* ... */ ) {
        line(
          displayStartPos.x, displayStartPos.y, displayStartPos.z,
          laser.currentPos.x, laser.currentPos.y, laser.currentPos.z
        );
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  perspective(PI / 3.0, width / height, 0.1, STAR_RANGE * 4);
}