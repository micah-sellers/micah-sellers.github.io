// ── Constants ──────────────────────────────────────────────────────────────
//og dimensions -> const SCENE_W    = 720;
//const SCENE_H    = 480;
const SCENE_W    = Math.min(window.innerWidth, 1300);
const SCENE_H    = 500;

const MIN_X      = 50;
const MAX_X      = SCENE_W - 50;
const ROPE_MIN   = 10;
const X_SPEED    = 4;
const ROPE_SPEED = 3;

const N          = 8;       // rope nodes
const GRAVITY    = 0.5;     // px / frame²
const DAMPING    = 0.98;
const ITERS      = 5;       // constraint solving iterations per frame
const HOLD_WEIGHT = 0.4;    // extra gravity on tip node when holding a crate

const CRATE_W    = 64;
const CRATE_H    = 64;
const CRATE_GAP  = 14;
const FLOOR_Y    = SCENE_H - 50;                           // 750 — top of floor surface
const CRATE_REST = FLOOR_Y - CRATE_H;                     // 686 — crate top when at rest
const CRATE_X0   = (SCENE_W - (4 * CRATE_W + 3 * CRATE_GAP)) / 2; // 268

const CLAW_DEPTH = 28;      // px below last rope node to the claw fingertips
const GRAB_R     = 44;      // grab detection radius in px

const ZONE_W     = 160;     // drop zone width
const ZONE_X     = SCENE_W - 50 - ZONE_W;  // drop zone left edge (50px from right)

// ── DOM ────────────────────────────────────────────────────────────────────
const trolleyEl  = document.getElementById('trolley');
const clawEl     = document.getElementById('claw');
const dropZoneEl = document.getElementById('dropZone');
const canvas     = document.getElementById('ropeCanvas');
const ctx        = canvas.getContext('2d');
canvas.width     = SCENE_W;
canvas.height    = SCENE_H;

// Link CSS dimensions to JS constants
const sceneEl = document.getElementById('scene');
sceneEl.style.setProperty('--scene-w', SCENE_W + 'px');
sceneEl.style.setProperty('--scene-h', SCENE_H + 'px');
sceneEl.style.setProperty('--zone-x', ZONE_X + 'px');
sceneEl.style.setProperty('--zone-w', ZONE_W + 'px');

// Get rope anchor point as the bottom-center of trolley
function getAnchorY() {
    const rect = trolleyEl.getBoundingClientRect();
    const sceneRect = sceneEl.getBoundingClientRect();
    return rect.bottom - sceneRect.top;
}

// Get maximum rope length (stops 40px above floor)
function getRopeMax() {
    return FLOOR_Y - 80 - getAnchorY();
}

// ── Rope nodes ─────────────────────────────────────────────────────────────
// Each node: { x, y, px, py }  (current position + previous for Verlet velocity)
let trolleyX   = SCENE_W / 2;
let ropeLength = 80;

const nodes = [];
(function initNodes() {
    const anchorY = getAnchorY();
    const seg = ropeLength / (N - 1);
    for (let i = 0; i < N; i++) {
        const y = anchorY + i * seg;
        nodes.push({ x: trolleyX, y, px: trolleyX, py: y });
    }
}());

// ── Crate state ────────────────────────────────────────────────────────────
const crateEls    = [...document.querySelectorAll('.crate')];
const crateStates = crateEls.map((el, i) => {
    const x = CRATE_X0 + i * (CRATE_W + CRATE_GAP);
    const y = CRATE_REST;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    return { el, x, y, vx: 0, vy: 0, falling: false, page: el.dataset.page };
});

let heldIdx = -1;   // index of the currently held crate, -1 = none

// ── Input ──────────────────────────────────────────────────────────────────
const keys = new Set();

document.addEventListener('keydown', e => {
    keys.add(e.key);
    if (e.key.startsWith('Arrow')) e.preventDefault();
    if (e.key === ' ') { e.preventDefault(); onSpace(); }
});
document.addEventListener('keyup', e => keys.delete(e.key));

function onSpace() {
    if (heldIdx === -1) {
        // Attempt to grab the nearest reachable crate
        const tipX = nodes[N - 1].x;
        const tipY = nodes[N - 1].y + CLAW_DEPTH;
        let best = -1, bestDist = GRAB_R;
        for (let i = 0; i < crateStates.length; i++) {
            const c = crateStates[i];
            if (c.falling) continue;
            const cx   = c.x + CRATE_W / 2;
            const cy   = c.y + 8;           // test against upper region of crate
            const dist = Math.hypot(tipX - cx, tipY - cy);
            if (dist < bestDist) { bestDist = dist; best = i; }
        }
        if (best !== -1) heldIdx = best;
    } else {
        // Release — inherit current rope-tip velocity
        const last = nodes[N - 1];
        const c    = crateStates[heldIdx];
        c.vx      = last.x - last.px;
        c.vy      = last.y - last.py;
        c.falling = true;
        heldIdx   = -1;
    }
}

// ── Physics ────────────────────────────────────────────────────────────────
function updateRope() {
    const anchorY = getAnchorY();
    const segLen = ropeLength / (N - 1);

    // Verlet integration for free nodes 1..N-1
    for (let i = 1; i < N; i++) {
        const n  = nodes[i];
        const ay = GRAVITY + (i === N - 1 && heldIdx !== -1 ? HOLD_WEIGHT : 0);
        const vx = (n.x - n.px) * DAMPING;
        const vy = (n.y - n.py) * DAMPING;
        n.px = n.x;
        n.py = n.y;
        n.x += vx;
        n.y += vy + ay;
    }

    // Iterative constraint solving (maintains segment lengths)
    for (let iter = 0; iter < ITERS; iter++) {
        // Re-pin anchor to trolley bottom center
        nodes[0].x = trolleyX;
        nodes[0].y = anchorY;

        for (let i = 0; i < N - 1; i++) {
            const a  = nodes[i];
            const b  = nodes[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d  = Math.sqrt(dx * dx + dy * dy);
            if (d < 0.001) continue;
            const diff = (d - segLen) / d;
            const cx   = dx * diff * 0.5;
            const cy   = dy * diff * 0.5;
            if (i !== 0) { a.x += cx; a.y += cy; }  // anchor stays fixed
            b.x -= cx;
            b.y -= cy;
        }
    }

    // Final anchor pin (constraints may have drifted it slightly)
    nodes[0].x = trolleyX;
    nodes[0].y = anchorY;
}

// Called when a falling crate comes to rest — checks for zone landing
function landCrate(c) {
    const cx = c.x + CRATE_W / 2;
    if (cx >= ZONE_X && cx <= ZONE_X + ZONE_W) {
        dropZoneEl.classList.add('active');
        setTimeout(() => { window.location.href = c.page; }, 0); // change the second parameter to adjust delay in ms before navigation
    }
}

function updateCrates() {
    const last = nodes[N - 1];

    // Held crate tracks the rope tip
    if (heldIdx !== -1) {
        const c = crateStates[heldIdx];
        c.x = last.x - CRATE_W / 2;
        c.y = last.y + 14;      // top of crate just inside the claw fingers
        c.el.style.left = c.x + 'px';
        c.el.style.top  = c.y + 'px';
    }

    // Highlight drop zone when a held crate is positioned over it
    if (heldIdx !== -1) {
        const cx = crateStates[heldIdx].x + CRATE_W / 2;
        dropZoneEl.classList.toggle('active', cx >= ZONE_X && cx <= ZONE_X + ZONE_W);
    } else {
        dropZoneEl.classList.remove('active');
    }

    // Falling crates under gravity
    for (const c of crateStates) {
        if (!c.falling) continue;
        c.vy += GRAVITY;
        c.x  += c.vx;
        c.y  += c.vy;

        // Floor collision
        if (c.y >= CRATE_REST) {
            c.y  = CRATE_REST;
            c.vy = 0;
            c.vx *= 0.55;               // sliding friction
            if (Math.abs(c.vx) < 0.4) {
                c.vx = 0;
                c.falling = false;
                landCrate(c);
            }
        }

        // Scene wall clamp
        if (c.x < 0)                  { c.x = 0;                  c.vx = 0; }
        if (c.x > SCENE_W - CRATE_W)  { c.x = SCENE_W - CRATE_W; c.vx = 0; }

        c.el.style.left = c.x + 'px';
        c.el.style.top  = c.y + 'px';
    }
}

// ── Rendering ──────────────────────────────────────────────────────────────
function drawRope() {
    ctx.clearRect(0, 0, SCENE_W, SCENE_H);
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);

    // Smooth curve through intermediate nodes via quadratic bezier midpoints
    for (let i = 1; i <= N - 2; i++) {
        const mx = (nodes[i].x + nodes[i + 1].x) / 2;
        const my = (nodes[i].y + nodes[i + 1].y) / 2;
        ctx.quadraticCurveTo(nodes[i].x, nodes[i].y, mx, my);
    }
    ctx.lineTo(nodes[N - 1].x, nodes[N - 1].y);

    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.stroke();
}

// ── Main loop ──────────────────────────────────────────────────────────────
function tick() {
    // Movement input
    if (keys.has('ArrowLeft'))  trolleyX   = Math.max(MIN_X,         trolleyX   - X_SPEED);
    if (keys.has('ArrowRight')) trolleyX   = Math.min(MAX_X,         trolleyX   + X_SPEED);
    if (keys.has('ArrowUp'))    ropeLength = Math.max(ROPE_MIN,      ropeLength - ROPE_SPEED);
    if (keys.has('ArrowDown'))  ropeLength = Math.min(getRopeMax(),  ropeLength + ROPE_SPEED);

    // Physics
    updateRope();
    updateCrates();

    // Render
    drawRope();
    const last = nodes[N - 1];
    clawEl.style.left    = last.x + 'px';
    clawEl.style.top     = last.y + 'px';
    trolleyEl.style.left = trolleyX + 'px';

    requestAnimationFrame(tick);
}

tick();
