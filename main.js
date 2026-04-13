// ── Constants ──────────────────────────────────────────────────────────────
const SCENE_W    = 900;//Math.min(window.innerWidth, 900);
const SCENE_H    = 500;

const MIN_X      = 50;
const MAX_X      = SCENE_W - 50;
const ROPE_MIN   = 10;
const X_SPEED    = 4;
const ROPE_SPEED = 3;

const N           = 8;
const GRAVITY     = 0.7;
const DAMPING     = 0.95;
const ITERS       = 5;
const HOLD_WEIGHT = 0.9;

const CRATE_W    = 64;
const CRATE_H    = 64;
const CRATE_GAP  = 14;
const FLOOR_Y    = SCENE_H - 50;
const CRATE_REST = FLOOR_Y - CRATE_H;
const CRATE_X0   = (SCENE_W - (4 * CRATE_W + 3 * CRATE_GAP)) / 2;

const CLAW_DEPTH = 28;
const GRAB_R     = 44;

const ZONE_W     = 160;
const ZONE_X     = SCENE_W - ZONE_W;   // hole runs to the right scene edge

const POST_W = 5;
const POST_H = 70;

// ── DOM ────────────────────────────────────────────────────────────────────
const trolleyEl  = document.getElementById('trolley');
const clawEl     = document.getElementById('claw');
const dropZoneEl = document.getElementById('dropZone');
dropZoneEl.style.display = 'none';

const canvas     = document.getElementById('ropeCanvas');
const ctx        = canvas.getContext('2d');
canvas.width     = SCENE_W;
canvas.height    = SCENE_H;

const sceneEl = document.getElementById('scene');
sceneEl.style.setProperty('--scene-w', SCENE_W + 'px');
sceneEl.style.setProperty('--scene-h', SCENE_H + 'px');
sceneEl.style.setProperty('--zone-x', ZONE_X + 'px');
sceneEl.style.setProperty('--zone-w', ZONE_W + 'px');

function getAnchorY() {
    const rect = trolleyEl.getBoundingClientRect();
    const sceneRect = sceneEl.getBoundingClientRect();
    return rect.bottom - sceneRect.top;
}

function getRopeMax() {
    return FLOOR_Y - 80 - getAnchorY();
}

// ── Rope nodes ─────────────────────────────────────────────────────────────
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

// ── Matter.js Physics ──────────────────────────────────────────────────────
const { Engine, World, Bodies, Body } = Matter;
const physEngine = Engine.create({ gravity: { x: 0, y: 1.8, scale: 0.001 } });

const leftFloorW  = ZONE_X + 100;
const rightFloorW = SCENE_W - (ZONE_X + ZONE_W) + 100;

World.add(physEngine.world, [
    // Only a left floor segment — hole runs all the way to the right scene wall
    Bodies.rectangle(
        ZONE_X - leftFloorW / 2,
        FLOOR_Y + 25,
        leftFloorW, 50,
        { isStatic: true, friction: 0.05, label: 'floor' }
    ),
    Bodies.rectangle(-25,          SCENE_H / 2, 50, SCENE_H * 2, { isStatic: true, label: 'wall' }),
    Bodies.rectangle(SCENE_W + 25, SCENE_H / 2, 50, SCENE_H * 2, { isStatic: true, label: 'wall' }),
    // Railing post — left edge of the hole
    Bodies.rectangle(
        ZONE_X - POST_W / 2,
        FLOOR_Y - POST_H / 2,
        POST_W, POST_H,
        { isStatic: true, label: 'railPost' }
    ),
]);

// ── Crate state ────────────────────────────────────────────────────────────
const crateEls    = [...document.querySelectorAll('.crate')];
const crateStates = crateEls.map((el, i) => {
    el.style.display = 'none';

    const x = CRATE_X0 + i * (CRATE_W + CRATE_GAP);
    const y = CRATE_REST;

    const body = Bodies.rectangle(
        x + CRATE_W / 2,
        y + CRATE_H / 2,
        CRATE_W, CRATE_H,
        { restitution: 0.25, friction: 0.45, frictionStatic: 0.65, label: 'crate' }
    );
    World.add(physEngine.world, body);

    const labelEl = el.querySelector('.crate-label');
    return {
        body,
        gone:  false,
        page:  el.dataset.page,
        label: labelEl ? labelEl.textContent.trim().toUpperCase() : '',
    };
});

let heldIdx    = -1;
let clawAngle  = 0;

// ── Input ──────────────────────────────────────────────────────────────────
const keys = new Set();

document.addEventListener('keydown', e => {
    keys.add(e.key);
    if (e.key.startsWith('Arrow')) e.preventDefault();
    if (e.key === ' ') { e.preventDefault(); onSpace(); }
});
document.addEventListener('keyup', e => keys.delete(e.key));

// ── On-screen button controls ──────────────────────────────────────────────
document.querySelectorAll('.control-btn[data-key]').forEach(btn => {
    const key = btn.dataset.key;
    btn.addEventListener('mousedown', () => keys.add(key));
    btn.addEventListener('mouseup', () => keys.delete(key));
    btn.addEventListener('mouseleave', () => keys.delete(key));
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.add(key); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys.delete(key); });
});

document.querySelector('.control-grab').addEventListener('click', onSpace);

function onSpace() {
    if (heldIdx === -1) {
        const tipX = nodes[N - 1].x;
        const tipY = nodes[N - 1].y + CLAW_DEPTH;
        let best = -1, bestDist = GRAB_R;
        for (let i = 0; i < crateStates.length; i++) {
            const c = crateStates[i];
            if (c.gone) continue;
            const cx   = c.body.position.x;
            const cy   = c.body.position.y - CRATE_H / 2 + 8;
            const dist = Math.hypot(tipX - cx, tipY - cy);
            if (dist < bestDist) { bestDist = dist; best = i; }
        }
        if (best !== -1) {
            heldIdx = best;
            Body.setAngle(crateStates[best].body, 0);
            Body.setAngularVelocity(crateStates[best].body, 0);
            clawEl.classList.add('holding');
        }
    } else {
        const last = nodes[N - 1];
        const c    = crateStates[heldIdx];
        Body.setVelocity(c.body, { x: last.x - last.px, y: last.y - last.py });
        heldIdx = -1;
        clawEl.classList.remove('holding');
    }
}

// ── Rope physics (Verlet) ──────────────────────────────────────────────────
function updateRope() {
    const anchorY = getAnchorY();
    const segLen  = ropeLength / (N - 1);

    for (let i = 1; i < N; i++) {
        const n  = nodes[i];
        const ay = GRAVITY + (i === N - 1 && heldIdx !== -1 ? HOLD_WEIGHT : 0);
        const vx = (n.x - n.px) * DAMPING;
        const vy = (n.y - n.py) * DAMPING;
        n.px = n.x;  n.py = n.y;
        n.x += vx;   n.y += vy + ay;
    }

    for (let iter = 0; iter < ITERS; iter++) {
        nodes[0].x = trolleyX;
        nodes[0].y = anchorY;
        for (let i = 0; i < N - 1; i++) {
            const a = nodes[i], b = nodes[i + 1];
            const dx = b.x - a.x, dy = b.y - a.y;
            const d  = Math.sqrt(dx * dx + dy * dy);
            if (d < 0.001) continue;
            const diff = (d - segLen) / d;
            const cx = dx * diff * 0.5, cy = dy * diff * 0.5;
            if (i !== 0) { a.x += cx; a.y += cy; }
            b.x -= cx; b.y -= cy;
        }
    }
    nodes[0].x = trolleyX;
    nodes[0].y = anchorY;
}

// ── Crate physics ──────────────────────────────────────────────────────────
function updateCrates() {
    const last = nodes[N - 1];

    if (heldIdx !== -1) {
        const c  = crateStates[heldIdx];
        const offset = CLAW_DEPTH + CRATE_H / 2;
        const tx = last.x - Math.sin(clawAngle) * offset;
        const ty = last.y + Math.cos(clawAngle) * offset;
        Body.setPosition(c.body, { x: tx, y: ty });
        Body.setVelocity(c.body, { x: last.x - last.px, y: last.y - last.py });
        Body.setAngle(c.body, clawAngle);
        Body.setAngularVelocity(c.body, 0);
    }

    Engine.update(physEngine, 1000 / 60);

    if (heldIdx !== -1) {
        const c  = crateStates[heldIdx];
        const offset = CLAW_DEPTH + CRATE_H / 2;
        Body.setPosition(c.body, {
            x: last.x - Math.sin(clawAngle) * offset,
            y: last.y + Math.cos(clawAngle) * offset,
        });
        Body.setAngle(c.body, clawAngle);
    }

    for (let i = 0; i < crateStates.length; i++) {
        if (i === heldIdx) continue;
        const c  = crateStates[i];
        if (c.gone) continue;

        const cx = c.body.position.x;
        const cy = c.body.position.y;

        if (cy > FLOOR_Y + 5 && cx > ZONE_X && cx < ZONE_X + ZONE_W) {
            c.gone = true;
            World.remove(physEngine.world, c.body);
            setTimeout(() => { window.location.href = c.page; }, 300);
        }
    }
}

// ── Rendering ──────────────────────────────────────────────────────────────
function drawCrates() {
    for (let i = 0; i < crateStates.length; i++) {
        const c = crateStates[i];
        if (c.gone) continue;

        const held  = (i === heldIdx);

        ctx.save();
        if (held) {
            // Rotate around the rope attachment point (same pivot as CSS claw)
            const last = nodes[N - 1];
            ctx.translate(last.x, last.y);
            ctx.rotate(clawAngle);
            ctx.translate(0, CLAW_DEPTH + CRATE_H / 2);
        } else {
            const { x: bx, y: by } = c.body.position;
            ctx.translate(bx, by);
            ctx.rotate(c.body.angle);
        }

        ctx.shadowColor   = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur    = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 4;

        ctx.fillStyle = held ? '#c48b4a' : '#9b6b3b';
        ctx.fillRect(-CRATE_W / 2, -CRATE_H / 2, CRATE_W, CRATE_H);

        ctx.shadowColor = 'transparent';

        ctx.strokeStyle = '#6b4825';
        ctx.lineWidth   = 3;
        ctx.strokeRect(-CRATE_W / 2, -CRATE_H / 2, CRATE_W, CRATE_H);

        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth   = 2.5;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(-CRATE_W / 2 + 5,  -CRATE_H / 2 + 5);
        ctx.lineTo( CRATE_W / 2 - 5,   CRATE_H / 2 - 5);
        ctx.moveTo( CRATE_W / 2 - 5,  -CRATE_H / 2 + 5);
        ctx.lineTo(-CRATE_W / 2 + 5,   CRATE_H / 2 - 5);
        ctx.stroke();

        ctx.fillStyle    = 'rgba(255,235,200,0.9)';
        ctx.font         = 'bold 9px sans-serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.label, 0, 0);

        ctx.restore();
    }
}

function drawFloor() {
    ctx.fillStyle = '#242424';
    ctx.fillRect(0, FLOOR_Y, ZONE_X, SCENE_H - FLOOR_Y);
    ctx.fillStyle = '#363636';
    ctx.fillRect(0, FLOOR_Y, ZONE_X, 2);
}

function drawRailing() {
    const postH  = POST_H;
    const postW  = POST_W;
    const railH  = 4;
    const lx     = ZONE_X;          // left edge of hole / post position
    const topY   = FLOOR_Y - postH;
    const midY   = FLOOR_Y - Math.round(postH * 0.52);
    const railEnd = SCENE_W;        // rails connect to right scene wall

    // ── Fill ────────────────────────────────────────────────────────────────
    ctx.fillStyle = '#4a4a4a';

    // Single post at left edge of hole
    ctx.fillRect(lx - postW, topY, postW, postH);

    // Top rail spanning inward across the hole to the right wall
    ctx.fillRect(lx, topY, railEnd - lx, railH);

    // Mid rail
    ctx.fillRect(lx, midY, railEnd - lx, railH);

    // ── Top-face highlights ─────────────────────────────────────────────────
    ctx.fillStyle = '#646464';
    ctx.fillRect(lx - postW, topY, postW + (railEnd - lx), 1);  // post top + top rail
    ctx.fillRect(lx,         midY, railEnd - lx,            1);  // mid rail

    // ── Post cap ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#585858';
    ctx.fillRect(lx - postW - 2, topY - 5, postW + 4, 5);
    ctx.fillStyle = '#707070';
    ctx.fillRect(lx - postW - 2, topY - 5, postW + 4, 1);
}

function drawRope() {
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
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
    if (keys.has('ArrowLeft'))  trolleyX   = Math.max(MIN_X,        trolleyX   - X_SPEED);
    if (keys.has('ArrowRight')) trolleyX   = Math.min(MAX_X,        trolleyX   + X_SPEED);
    if (keys.has('ArrowUp'))    ropeLength = Math.max(ROPE_MIN,     ropeLength - ROPE_SPEED);
    if (keys.has('ArrowDown'))  ropeLength = Math.min(getRopeMax(), ropeLength + ROPE_SPEED);

    updateRope();
    clawAngle = -Math.atan2(nodes[N-1].x - nodes[N-2].x, nodes[N-1].y - nodes[N-2].y);
    updateCrates();

    ctx.clearRect(0, 0, SCENE_W, SCENE_H);
    drawFloor();
    drawCrates();
    drawRailing();
    drawRope();

    const CLAW_HALF_W = 17; // half of 34px claw width
    const last = nodes[N - 1];
    clawEl.style.left      = (last.x - CLAW_HALF_W) + 'px';
    clawEl.style.top       = last.y + 'px';
    clawEl.style.transform = `rotate(${clawAngle}rad)`;
    trolleyEl.style.left   = trolleyX + 'px';

    requestAnimationFrame(tick);
}

tick();
