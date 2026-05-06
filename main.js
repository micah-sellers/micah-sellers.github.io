// ── Project config ─────────────────────────────────────────────────────────
// Add, remove, or reorder entries here — everything else updates automatically.
//
//   label : text shown on the box
//   page  : file to navigate to when the box is dropped in the hole
//   type  : 'square'   → school / work project  (brown crate with X-brace)
//           'triangle' → personal project        (blue prism)
//   image : preview screenshot path, or null
//
const PROJECTS = [
    // ── School / work projects  (square boxes) ───────────────────────────────
    { label: 'About',    page: 'about.html',    type: 'square',   image: null },
    { label: 'Projects', page: 'projects.html', type: 'square',   image: null },
    { label: 'Contact',  page: 'contact.html',  type: 'square',   image: null },
    { label: 'Resume',   page: 'resume.html',   type: 'square',   image: null },

    // ── Personal projects  (triangle boxes) ─────────────────────────────────
    // To add one: copy a line, uncomment it, and fill in your details.
    { label: 'MCTR 260', page: 'mctr260.html', type: 'triangle', image: 'img/260_robot/full_robot.png' },
    // { label: 'My App',   page: 'app.html',   type: 'triangle', image: 'img/app-thumb.png' },
];

// ── Constants ──────────────────────────────────────────────────────────────
const SCENE_W    = 900;
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
const TRIANGLE_R      = 36;          // circumradius for triangle boxes
// Matter.js Bodies.polygon(n=3) places vertex 0 at angle theta/2 = π/3.
// All triangle path / grab calculations must use this same offset.
const TRIANGLE_OFFSET = Math.PI / 3;
const FLOOR_Y    = SCENE_H - 50;
const CRATE_REST = FLOOR_Y - CRATE_H;
const CRATE_X0   = (SCENE_W - (PROJECTS.length * CRATE_W + (PROJECTS.length - 1) * CRATE_GAP)) / 2;

const CLAW_DEPTH = 28;
const GRAB_R     = 44;

const ZONE_W     = 160;
const ZONE_X     = SCENE_W - ZONE_W;

const POST_W = 5;
const POST_H = 70;

// ── DOM ────────────────────────────────────────────────────────────────────
const trolleyEl  = document.getElementById('trolley');
const clawEl     = document.getElementById('claw');
const dropZoneEl = document.getElementById('dropZone');
dropZoneEl.style.display = 'none';

const canvas  = document.getElementById('ropeCanvas');
const ctx     = canvas.getContext('2d');
canvas.width  = SCENE_W;

const sceneEl = document.getElementById('scene');
sceneEl.style.setProperty('--scene-w', SCENE_W + 'px');
sceneEl.style.setProperty('--scene-h', SCENE_H + 'px');
sceneEl.style.setProperty('--zone-x', ZONE_X + 'px');
sceneEl.style.setProperty('--zone-w', ZONE_W + 'px');

// Extend canvas to viewport bottom + buffer
const sceneRect  = sceneEl.getBoundingClientRect();
const PIPE_EXTRA = Math.max(200, Math.ceil(window.innerHeight - (sceneRect.top + FLOOR_Y)) + 100);
const PIPE_NAV_Y = Math.ceil(window.innerHeight - sceneRect.top) + CRATE_H;
canvas.height    = SCENE_H + PIPE_EXTRA;

// Tracks the CSS zoom applied to sceneEl for coordinate conversion
let currentZoom = 1;

// ── Preview panel ──────────────────────────────────────────────────────────
const previewEl      = document.getElementById('projectPreview');
const previewNameEl  = document.getElementById('previewName');
const previewTypeEl  = document.getElementById('previewType');
const previewImgEl   = document.getElementById('previewImg');
const previewEmptyEl = document.getElementById('previewEmpty');

function showPreview(c) {
    previewNameEl.textContent   = c.label;
    previewTypeEl.textContent   = c.type === 'triangle' ? 'Personal' : 'School';
    previewTypeEl.dataset.type  = c.type;
    if (c.image && c.image.complete && c.image.naturalWidth > 0) {
        previewImgEl.src          = c.image.src;
        previewImgEl.style.display  = 'block';
        previewEmptyEl.style.display = 'none';
    } else {
        previewImgEl.style.display  = 'none';
        previewEmptyEl.style.display = 'flex';
    }
    previewEl.classList.add('visible');
}

function hidePreview() {
    previewEl.classList.remove('visible');
}

// ── Physics helpers ────────────────────────────────────────────────────────
function getAnchorY() {
    const rect = trolleyEl.getBoundingClientRect();
    const sr   = sceneEl.getBoundingClientRect();
    // Divide by currentZoom: getBoundingClientRect returns viewport (zoomed) pixels,
    // but the rope physics operates in the original 900×500 coordinate space.
    return (rect.bottom - sr.top) / currentZoom;
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

const leftFloorW = ZONE_X + 100;

World.add(physEngine.world, [
    Bodies.rectangle(
        ZONE_X - leftFloorW / 2, FLOOR_Y + 25, leftFloorW, 50,
        { isStatic: true, friction: 0.4, frictionStatic: 0.8, label: 'floor' }
    ),
    Bodies.rectangle(-25,          SCENE_H / 2, 50, SCENE_H * 2, { isStatic: true, label: 'wall' }),
    Bodies.rectangle(SCENE_W + 25, SCENE_H / 2, 50, SCENE_H * 2, { isStatic: true, label: 'wall' }),
    // Rail posts — physics bodies are taller (top y=360 vs visual y=380) and slightly
    // wider than the 5px visual so triangle vertices (max reach y≈382) can never
    // tip over the top. Right faces stay flush with ZONE_X / SCENE_W respectively.
    Bodies.rectangle(ZONE_X  - 3, FLOOR_Y - 45, 6, 90, { isStatic: true, label: 'railPost' }),
    Bodies.rectangle(SCENE_W - 3, FLOOR_Y - 45, 6, 90, { isStatic: true, label: 'railPost' }),
]);

// ── Crate state ─────────────────────────────────────────────────────────────
const crateStates = PROJECTS.map((proj, i) => {
    const cx = CRATE_X0 + i * (CRATE_W + CRATE_GAP) + CRATE_W / 2;
    const cy = CRATE_REST + CRATE_H / 2;

    const bodyOpts = { restitution: 0.1, friction: 0.4, frictionStatic: 0.6, label: 'crate' };
    const body = proj.type === 'triangle'
        ? Bodies.polygon(cx, cy, 3, TRIANGLE_R, bodyOpts)
        : Bodies.rectangle(cx, cy, CRATE_W, CRATE_H, bodyOpts);
    World.add(physEngine.world, body);

    let imgEl = null;
    if (proj.image) {
        imgEl = new Image();
        imgEl.src = proj.image;
    }

    return {
        body,
        type:        proj.type,
        label:       proj.label.toUpperCase(),
        page:        proj.page,
        image:       imgEl,
        gone:        false,
        pipeFalling: false,
        pipeX: 0, pipeY: 0, pipeVx: 0, pipeVy: 0, pipeAngle: 0,
    };
});

let heldIdx      = -1;
let clawAngle    = 0;
let clawGripping = false;

// ── Input ──────────────────────────────────────────────────────────────────
const keys = new Set();

document.addEventListener('keydown', e => {
    keys.add(e.key);
    if (e.key.startsWith('Arrow')) e.preventDefault();
    if ('wasdWASD'.includes(e.key) && e.key.length === 1) e.preventDefault();
    if (e.key === ' ') { e.preventDefault(); onSpace(); }
});
document.addEventListener('keyup', e => keys.delete(e.key));

document.querySelectorAll('.control-btn[data-key]').forEach(btn => {
    const key = btn.dataset.key;
    btn.addEventListener('mousedown',  () => keys.add(key));
    btn.addEventListener('mouseup',    () => keys.delete(key));
    btn.addEventListener('mouseleave', () => keys.delete(key));
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.add(key); });
    btn.addEventListener('touchend',   (e) => { e.preventDefault(); keys.delete(key); });
});

document.querySelector('.control-grab').addEventListener('click', onSpace);

function onSpace() {
    clawGripping = !clawGripping;
    clawEl.classList.toggle('holding', clawGripping);

    if (clawGripping) {
        // Attempt grab
        const tipX = nodes[N - 1].x;
        const tipY = nodes[N - 1].y + CLAW_DEPTH;
        let best = -1, bestDist = GRAB_R;
        for (let i = 0; i < crateStates.length; i++) {
            const c = crateStates[i];
            if (c.gone || c.pipeFalling) continue;
            let grabCx, grabCy;
            if (c.type === 'triangle') {
                // Grab from the topmost (apex) vertex, accounting for current rotation
                grabCy = Infinity;
                for (let v = 0; v < 3; v++) {
                    const a  = c.body.angle + v * (2 * Math.PI / 3) + TRIANGLE_OFFSET;
                    const vx = c.body.position.x + TRIANGLE_R * Math.cos(a);
                    const vy = c.body.position.y + TRIANGLE_R * Math.sin(a);
                    if (vy < grabCy) { grabCy = vy; grabCx = vx; }
                }
            } else {
                grabCx = c.body.position.x;
                grabCy = c.body.position.y - CRATE_H / 2 + 8;
            }
            const dist = Math.hypot(tipX - grabCx, tipY - grabCy);
            if (dist < bestDist) { bestDist = dist; best = i; }
        }
        if (best !== -1) {
            heldIdx = best;
            Body.setAngle(crateStates[best].body, 0);
            Body.setAngularVelocity(crateStates[best].body, 0);
            showPreview(crateStates[best]);
        }
    } else {
        // Release
        if (heldIdx !== -1) {
            const last = nodes[N - 1];
            Body.setVelocity(crateStates[heldIdx].body, { x: last.x - last.px, y: last.y - last.py });
            heldIdx = -1;
        }
        hidePreview();
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
        n.px = n.x; n.py = n.y;
        n.x += vx;  n.y += vy + ay;
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
        const c      = crateStates[heldIdx];
        const halfH  = c.type === 'triangle' ? TRIANGLE_R : CRATE_H / 2;
        const offset = CLAW_DEPTH + halfH;
        const tx = last.x - Math.sin(clawAngle) * offset;
        const ty = last.y + Math.cos(clawAngle) * offset;
        Body.setPosition(c.body, { x: tx, y: ty });
        Body.setVelocity(c.body, { x: last.x - last.px, y: last.y - last.py });
        // Triangles hang apex-up: offset body angle by -π/6 so vertex v2 (at 5π/3
        // body-relative) aligns with the "toward rope" direction at any clawAngle.
        Body.setAngle(c.body, c.type === 'triangle' ? clawAngle - Math.PI / 6 : clawAngle);
        Body.setAngularVelocity(c.body, 0);
    }

    Engine.update(physEngine, 1000 / 60);

    if (heldIdx !== -1) {
        const c      = crateStates[heldIdx];
        const halfH  = c.type === 'triangle' ? TRIANGLE_R : CRATE_H / 2;
        const offset = CLAW_DEPTH + halfH;
        Body.setPosition(c.body, {
            x: last.x - Math.sin(clawAngle) * offset,
            y: last.y + Math.cos(clawAngle) * offset,
        });
        Body.setAngle(c.body, c.type === 'triangle' ? clawAngle - Math.PI / 6 : clawAngle);
    }

    for (let i = 0; i < crateStates.length; i++) {
        if (i === heldIdx) continue;
        const c = crateStates[i];
        if (c.gone) continue;

        if (c.pipeFalling) {
            c.pipeVy    += GRAVITY;
            c.pipeX     += c.pipeVx;
            c.pipeY     += c.pipeVy;
            c.pipeVx    *= 0.94;
            c.pipeAngle *= 0.90;
            if (c.pipeY > PIPE_NAV_Y) {
                c.gone = true;
                window.location.href = c.page;
            }
            continue;
        }

        const cx = c.body.position.x;
        const cy = c.body.position.y;

        if (cy > FLOOR_Y + 5 && cx > ZONE_X && cx < ZONE_X + ZONE_W) {
            c.pipeFalling = true;
            c.pipeX     = cx;
            c.pipeY     = cy;
            c.pipeVx    = c.body.velocity.x;
            c.pipeVy    = Math.max(c.body.velocity.y, 3);
            c.pipeAngle = c.body.angle;
            World.remove(physEngine.world, c.body);
        }
    }
}

// ── Rendering ──────────────────────────────────────────────────────────────

// Draw a triangle path matching Matter.js Bodies.polygon(n=3) vertex layout.
// Uses TRIANGLE_OFFSET = π/3 defined in the constants block above.
function pathTriangle(r) {
    ctx.beginPath();
    for (let v = 0; v < 3; v++) {
        const a  = v * (2 * Math.PI / 3) + TRIANGLE_OFFSET;
        const vx = Math.cos(a) * r;
        const vy = Math.sin(a) * r;
        if (v === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
}

// ── Per-type draw functions ────────────────────────────────────────────────
// To add a new shape type:
//   1. Add a drawBox_<type>(held) function here.
//   2. Add the type string to the dispatch table in drawCrates().
//   3. Add entries to PROJECTS with that type string.

function drawBox_triangle(held, drawAngle) {
    // Blue prism — personal project
    const fill   = held ? '#6db8d4' : '#2d7aaa';
    const stroke = '#0d3d5e';

    // Outer triangle
    pathTriangle(TRIANGLE_R);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = 3;
    ctx.stroke();

    // Subtle inner triangle detail
    pathTriangle(TRIANGLE_R * 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Label — horizontal at the centroid.
    // Counter-rotate by drawAngle so the text is always screen-upright.
    ctx.save();
    ctx.rotate(-drawAngle);
    let fs = 13;
    ctx.font = `bold ${fs}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 4;
    ctx.fillStyle    = 'rgba(210,240,255,1.0)';
    ctx.fillText(this.label, 0, 0);
    ctx.shadowColor  = 'transparent';
    ctx.restore();
}

function drawBox_square(held, drawAngle) {
    // Brown crate — school / work project
    const fill   = held ? '#c48b4a' : '#8a5c2e';
    const stroke = '#5a3010';
    const hw = CRATE_W / 2, hh = CRATE_H / 2;

    ctx.fillStyle = fill;
    ctx.fillRect(-hw, -hh, CRATE_W, CRATE_H);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = 3;
    ctx.strokeRect(-hw, -hh, CRATE_W, CRATE_H);

    // Wood-plank horizontal lines
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = 'butt';
    ctx.beginPath();
    ctx.moveTo(-hw + 3, -hh + CRATE_H / 3);
    ctx.lineTo( hw - 3, -hh + CRATE_H / 3);
    ctx.moveTo(-hw + 3,  hh - CRATE_H / 3);
    ctx.lineTo( hw - 3,  hh - CRATE_H / 3);
    ctx.stroke();

    // X-brace
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(-hw + 5, -hh + 5); ctx.lineTo( hw - 5,  hh - 5);
    ctx.moveTo( hw - 5, -hh + 5); ctx.lineTo(-hw + 5,  hh - 5);
    ctx.stroke();

    // Label — horizontal at the centroid
    ctx.save();
    ctx.rotate(-drawAngle);
    ctx.font         = 'bold 13px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 4;
    ctx.fillStyle    = 'rgba(255,240,200,1.0)';
    ctx.fillText(this.label, 0, 0);
    ctx.shadowColor  = 'transparent';
    ctx.restore();
}

// Dispatch table — maps type string → draw function
const BOX_DRAW = {
    triangle: drawBox_triangle,
    square:   drawBox_square,
};

function drawCrates() {
    for (let i = 0; i < crateStates.length; i++) {
        const c    = crateStates[i];
        if (c.gone) continue;
        const held = (i === heldIdx);

        ctx.save();

        // Position & rotate around the correct pivot; track total rotation for label use
        let drawAngle;
        if (held) {
            const last  = nodes[N - 1];
            const halfH = c.type === 'triangle' ? TRIANGLE_R : CRATE_H / 2;
            ctx.translate(last.x, last.y);
            ctx.rotate(clawAngle);
            ctx.translate(0, CLAW_DEPTH + halfH);
            if (c.type === 'triangle') ctx.rotate(-Math.PI / 6);
            drawAngle = c.type === 'triangle' ? clawAngle - Math.PI / 6 : clawAngle;
        } else if (c.pipeFalling) {
            ctx.translate(c.pipeX, c.pipeY);
            ctx.rotate(c.pipeAngle);
            drawAngle = c.pipeAngle;
        } else {
            ctx.translate(c.body.position.x, c.body.position.y);
            ctx.rotate(c.body.angle);
            drawAngle = c.body.angle;
        }

        // Drop shadow
        ctx.shadowColor   = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur    = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 4;

        // Call the correct draw function for this box type
        const drawFn = BOX_DRAW[c.type] || BOX_DRAW.square;
        drawFn.call(c, held, drawAngle);

        ctx.restore();
    }
}

function drawFloor() {
    ctx.fillStyle = '#242424';
    ctx.fillRect(0, FLOOR_Y, ZONE_X, SCENE_H - FLOOR_Y);
    ctx.fillStyle = '#363636';
    ctx.fillRect(0, FLOOR_Y, ZONE_X, 2);

    // ── Legend: drawn only when both types exist in PROJECTS ────────────────
    const types = [...new Set(PROJECTS.map(p => p.type))];
    if (types.length < 2) return;
    const legendX = 8;
    let legendY   = FLOOR_Y + 14;
    const labels  = { square: 'School / Work', triangle: 'Personal' };
    ctx.save();
    ctx.font         = 'bold 9px sans-serif';
    ctx.textBaseline = 'middle';
    for (const t of ['square', 'triangle']) {
        if (!types.includes(t)) continue;
        ctx.save();
        ctx.translate(legendX + 8, legendY);
        if (t === 'square') {
            ctx.fillStyle   = '#8a5c2e';
            ctx.fillRect(-6, -6, 12, 12);
            ctx.strokeStyle = '#5a3010';
            ctx.lineWidth   = 1.5;
            ctx.strokeRect(-6, -6, 12, 12);
        } else {
            ctx.beginPath();
            for (let v = 0; v < 3; v++) {
                const a = v * (2 * Math.PI / 3) + TRIANGLE_OFFSET;
                const vx = Math.cos(a) * 8, vy = Math.sin(a) * 8;
                if (v === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
            }
            ctx.closePath();
            ctx.fillStyle   = '#2d7aaa';
            ctx.fill();
            ctx.strokeStyle = '#0d3d5e';
            ctx.lineWidth   = 1.5;
            ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle  = '#aaa';
        ctx.textAlign  = 'left';
        ctx.fillText(labels[t], legendX + 20, legendY);
        legendY += 18;
    }
    ctx.restore();
}

function drawRailing() {
    const postH  = POST_H;
    const postW  = POST_W;
    const railH  = 4;
    const lx     = ZONE_X;
    const topY   = FLOOR_Y - postH;
    const midY   = FLOOR_Y - Math.round(postH * 0.52);
    const railEnd = SCENE_W;
    const rx     = SCENE_W;

    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(lx - postW, topY, postW, postH);
    ctx.fillRect(rx - postW, topY, postW, postH);
    ctx.fillRect(lx, topY, railEnd - lx, railH);
    ctx.fillRect(lx, midY, railEnd - lx, railH);

    ctx.fillStyle = '#646464';
    ctx.fillRect(lx - postW, topY, postW + (railEnd - lx), 1);
    ctx.fillRect(rx - postW, topY, postW, 1);
    ctx.fillRect(lx, midY, railEnd - lx, 1);

    ctx.fillStyle = '#585858';
    ctx.fillRect(lx - postW - 2, topY - 5, postW + 4, 5);
    ctx.fillRect(rx - postW - 2, topY - 5, postW + 4, 5);
    ctx.fillStyle = '#707070';
    ctx.fillRect(lx - postW - 2, topY - 5, postW + 4, 1);
    ctx.fillRect(rx - postW - 2, topY - 5, postW + 4, 1);
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
    if (keys.has('ArrowLeft')  || keys.has('a') || keys.has('A')) trolleyX   = Math.max(MIN_X,        trolleyX   - X_SPEED);
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) trolleyX   = Math.min(MAX_X,        trolleyX   + X_SPEED);
    if (keys.has('ArrowUp')    || keys.has('w') || keys.has('W')) ropeLength = Math.max(ROPE_MIN,     ropeLength - ROPE_SPEED);
    if (keys.has('ArrowDown')  || keys.has('s') || keys.has('S')) ropeLength = Math.min(getRopeMax(), ropeLength + ROPE_SPEED);

    updateRope();
    clawAngle = -Math.atan2(nodes[N-1].x - nodes[N-2].x, nodes[N-1].y - nodes[N-2].y);
    updateCrates();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFloor();
    drawCrates();
    drawRailing();
    drawRope();

    const CLAW_HALF_W = 17;
    const last = nodes[N - 1];
    clawEl.style.left      = (last.x - CLAW_HALF_W) + 'px';
    clawEl.style.top       = last.y + 'px';
    clawEl.style.transform = `rotate(${clawAngle}rad)`;
    trolleyEl.style.left   = trolleyX + 'px';

    requestAnimationFrame(tick);
}

// ── Mode toggle ────────────────────────────────────────────────────────────
const modeToggleBtn = document.getElementById('modeToggle');
modeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('simple-mode');
    modeToggleBtn.textContent = document.body.classList.contains('simple-mode')
        ? 'Fun View'
        : 'Simple View';
});

tick();

// ── Responsive scene scaling ───────────────────────────────────────────────
// Apply CSS zoom to the scene element so it fits narrow viewports.
// zoom affects layout dimensions (unlike transform: scale), preventing
// horizontal overflow. The physics coordinate space stays at 900×500;
// only getAnchorY() needs to divide by currentZoom to convert back.
function resizeScene() {
    const availW = Math.min(SCENE_W, window.innerWidth - 32);
    const scale  = availW / SCENE_W;
    if (scale < 0.99) {
        currentZoom      = scale;
        sceneEl.style.zoom = String(scale);
    } else {
        currentZoom        = 1;
        sceneEl.style.zoom = '';
    }
}

window.addEventListener('resize', resizeScene);
resizeScene();
