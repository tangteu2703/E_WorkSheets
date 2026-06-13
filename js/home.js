/* ================================================================
   E-WORKSHEETS CONSTRUCTION — Cinema Premium v3.0
   Three.js 3D House + GSAP ScrollTrigger + Lenis Smooth Scroll
   ================================================================ */

'use strict';

/* ════════════════════════════════════════════════════════════════
   LENIS SMOOTH SCROLL + GSAP INTEGRATION
   ════════════════════════════════════════════════════════════════ */
let lenis;

function initLenis() {
    if (typeof Lenis === 'undefined') return;
    lenis = new Lenis({
        lerp: 0.08,
        smoothWheel: true,
        direction: 'vertical',
        gestureDirection: 'vertical',
    });

    // Sync with GSAP ScrollTrigger
    lenis.on('scroll', () => {
        if (window.ScrollTrigger) ScrollTrigger.update();
    });

    // Direct requestAnimationFrame loop for maximum paint-rate smoothness
    function rafLoop(time) {
        lenis.raf(time);
        requestAnimationFrame(rafLoop);
    }
    requestAnimationFrame(rafLoop);

    if (window.gsap) {
        gsap.ticker.lagSmoothing(0);
    }
}

/* ════════════════════════════════════════════════════════════════
   THREE.JS — 3D HOUSE
   ════════════════════════════════════════════════════════════════ */
function initThreeJS() {
    if (typeof THREE === 'undefined') { console.warn('Three.js not loaded'); return; }

    const canvas = document.getElementById('threeCanvas');
    const hero = document.getElementById('hero');
    if (!canvas || !hero) return;

    /* ── Scene ── */
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050408, 0.022);

    /* ── Camera ── */
    const W = hero.clientWidth, H = hero.clientHeight;
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
    camera.position.set(9, 5, 12);
    camera.lookAt(0, 1.8, 0);

    /* ── Renderer (PERFORMANCE OPTIMIZED) ── */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));   // cap PR at 1.5
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;                 // cheapest shadows
    renderer.setClearColor(0x000000, 0);

    /* ── MATERIALS (Lambert = no PBR, much faster) ── */
    const mWall = new THREE.MeshLambertMaterial({ color: 0x1e1a14 });
    const mAccent = new THREE.MeshLambertMaterial({ color: 0x2c2012 });
    const mRoof = new THREE.MeshLambertMaterial({ color: 0x111009 });
    const mRoofWire = new THREE.MeshBasicMaterial({ color: 0xe8a020, wireframe: true });
    const mGold = new THREE.MeshLambertMaterial({ color: 0xe8a020, emissive: 0x3a2800 });
    const mStone = new THREE.MeshLambertMaterial({ color: 0x2a1f10 });
    const mDarkWood = new THREE.MeshLambertMaterial({ color: 0x3d1f00 });
    const mGround = new THREE.MeshLambertMaterial({ color: 0x080509 });

    // Window: MeshBasicMaterial — emissive glow, no lighting calc
    const mWindow = new THREE.MeshBasicMaterial({ color: 0xf5c830, transparent: true, opacity: 0.92 });

    /* ── HOUSE GROUP ── */
    const house = new THREE.Group();

    // Foundation
    const found = new THREE.Mesh(new THREE.BoxGeometry(5.6, .25, 4.2), mStone);
    found.position.y = -.125;
    found.receiveShadow = true;
    house.add(found);

    // Main walls
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 3.8), mWall);
    body.position.y = 1.6;
    body.castShadow = body.receiveShadow = true;
    house.add(body);

    // Upper floor accent
    const upper = new THREE.Mesh(new THREE.BoxGeometry(5.1, .14, 3.85), mAccent);
    upper.position.y = 3.22;
    upper.castShadow = true;
    house.add(upper);

    // Gold facade strip
    const strip = new THREE.Mesh(new THREE.BoxGeometry(5.08, .1, .06), mGold);
    strip.position.set(0, 3.17, 1.96);
    house.add(strip);

    // Corner pillars (front)
    [-2.35, 2.35].forEach(x => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(.18, 3.2, .18), mAccent);
        pillar.position.set(x, 1.6, 1.92);
        pillar.castShadow = true;
        house.add(pillar);

        const cap = new THREE.Mesh(new THREE.BoxGeometry(.26, .1, .26), mGold);
        cap.position.set(x, 3.26, 1.92);
        house.add(cap);
    });

    /* ── ROOF (pyramid, 4-sided) ── */
    const roofGeom = new THREE.ConeGeometry(3.55, 2.3, 4);

    const roofSolid = new THREE.Mesh(roofGeom, mRoof);
    roofSolid.position.y = 4.5;
    roofSolid.rotation.y = Math.PI / 4;
    roofSolid.castShadow = true;
    house.add(roofSolid);

    // Wireframe golden overlay
    const roofWire = new THREE.Mesh(roofGeom, mRoofWire);
    roofWire.position.y = 4.5;
    roofWire.rotation.y = Math.PI / 4;
    house.add(roofWire);

    // Roof base trim
    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(5.4, .18, 4.2), mGold);
    roofTrim.position.y = 3.4;
    house.add(roofTrim);

    /* ── WINDOWS ── */
    const winDefs = [
        // front (pos z ~1.93)
        { pos: [-1.45, 2.25, 1.94], size: [.72, .9, .05] },
        { pos: [1.45, 2.25, 1.94], size: [.72, .9, .05] },
        { pos: [-1.45, .88, 1.94], size: [.72, .72, .05] },
        { pos: [1.45, .88, 1.94], size: [.72, .72, .05] },
        // back
        { pos: [-1.45, 2.25, -1.94], size: [.72, .9, .05] },
        { pos: [1.45, 2.25, -1.94], size: [.72, .9, .05] },
        // side
        { pos: [2.52, 1.8, .5], size: [.05, 1.0, .65] },
        { pos: [-2.52, 1.8, -.5], size: [.05, 1.0, .65] },
    ];

    // Only 1 shared interior PointLight (was 8 — huge perf win)
    const interiorLight = new THREE.PointLight(0xf5c840, 1.5, 10);
    interiorLight.position.set(0, 1.5, 0);
    house.add(interiorLight);

    winDefs.forEach(({ pos, size }) => {
        // Gold frame
        const fSize = [size[0] + .12, size[1] + .12, .02];
        if (size[0] === .05) { fSize[0] = .04; fSize[2] = size[2] + .12; }
        const frame = new THREE.Mesh(new THREE.BoxGeometry(...fSize), mGold);
        frame.position.set(...pos);
        house.add(frame);

        // Glass (MeshBasicMaterial — no lighting calc)
        const win = new THREE.Mesh(new THREE.BoxGeometry(...size), mWindow);
        win.position.set(...pos);
        house.add(win);
    });

    /* ── DOOR ── */
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.15, .06), mGold);
    doorFrame.position.set(0, 1.075, 1.94);
    house.add(doorFrame);

    const door = new THREE.Mesh(new THREE.BoxGeometry(.9, 2.0, .04), mDarkWood);
    door.position.set(0, 1.0, 1.96);
    house.add(door);

    // Door handle
    const handle = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 8), mGold);
    handle.position.set(.32, 1.0, 1.985);
    house.add(handle);

    // Door knocker ring
    const knocker = new THREE.Mesh(new THREE.TorusGeometry(.06, .012, 6, 12), mGold);
    knocker.position.set(0, 1.4, 1.985);
    knocker.rotation.x = Math.PI / 2;
    house.add(knocker);

    /* ── STEPS ── */
    [[1.4, .08, .32, 0, .04, 2.12],
    [1.2, .08, .28, 0, .12, 2.06],
    [1.0, .08, .22, 0, .2, 2.0]].forEach(([sw, sh, sd, x, y, z]) => {
        const step = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), mStone);
        step.position.set(x, y, z);
        house.add(step);
    });

    /* ── CHIMNEY ── */
    const chim = new THREE.Mesh(new THREE.BoxGeometry(.58, 1.3, .58), mStone);
    chim.position.set(1.5, 4.9, -.45);
    chim.castShadow = true;
    house.add(chim);

    const chimTop = new THREE.Mesh(new THREE.BoxGeometry(.68, .1, .68), mGold);
    chimTop.position.set(1.5, 5.56, -.45);
    house.add(chimTop);

    /* ── BALCONY (2nd floor front) ── */
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(2.0, .08, .6), mAccent);
    balcony.position.set(0, 1.72, 2.2);
    house.add(balcony);

    // Balcony rail
    const bRail = new THREE.Mesh(new THREE.BoxGeometry(2.05, .04, .04), mGold);
    bRail.position.set(0, 2.05, 2.5);
    house.add(bRail);

    [-1.0, -.5, 0, .5, 1.0].forEach(x => {
        const bPost = new THREE.Mesh(new THREE.BoxGeometry(.04, .32, .04), mGold);
        bPost.position.set(x, 1.88, 2.5);
        house.add(bPost);
    });

    /* ── TREES ── */
    const treeDefs = [
        { x: -3.6, z: .9, h: 2.1, r: .7 },
        { x: -4.5, z: -.8, h: 2.5, r: .6 },
        { x: 3.9, z: -1.1, h: 1.9, r: .58 },
    ];

    const mTrunk = new THREE.MeshLambertMaterial({ color: 0x1a0d00 });
    const mLeaves = new THREE.MeshLambertMaterial({ color: 0x091404 });

    treeDefs.forEach(({ x, z, h, r }) => {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.07, .13, .85, 5), mTrunk);
        trunk.position.set(x, .425, z);
        house.add(trunk);

        // 2 cone layers (was 3) — fewer draw calls
        [0, .55].forEach((offset, idx) => {
            const rad = r - idx * .2;
            const lHgt = h * .42;
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(rad, lHgt, 6), mLeaves);
            leaves.position.set(x, .85 + offset + lHgt * .5, z);
            house.add(leaves);
        });
    });

    /* ── FENCE (instanced for fewer draw calls) ── */
    const mFence = new THREE.MeshLambertMaterial({ color: 0xd49818 });
    for (let i = -4; i <= 4; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(.055, .85, .055), mFence);
        post.position.set(i * .75, .425, 2.75);
        house.add(post);
    }

    [.65, .3].forEach(y => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(6.1, .04, .04), mGold);
        rail.position.set(0, y, 2.75);
        house.add(rail);
    });

    /* ── GARDEN PATH ── */
    const mPath = new THREE.MeshLambertMaterial({ color: 0x181008 });
    for (let i = 0; i < 4; i++) {  // was 6
        const stone = new THREE.Mesh(
            new THREE.BoxGeometry(.55 + Math.random() * .2, .04, .3 + Math.random() * .12), mPath
        );
        stone.position.set((Math.random() - .5) * .2, .02, 2.3 + i * .65);
        stone.rotation.y = (Math.random() - .5) * .4;
        house.add(stone);
    }

    scene.add(house);

    /* ── GROUND ── */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), mGround);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(30, 20, 0x1a1208, 0x0d0a06);  // smaller, fewer lines
    grid.position.y = .01;
    scene.add(grid);

    /* ── STAR PARTICLES — static, no per-frame update ── */
    const starCount = 350;  // was 900
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        starPos[i * 3] = (Math.random() - .5) * 80;
        starPos[i * 3 + 1] = Math.random() * 28 + 6;
        starPos[i * 3 + 2] = (Math.random() - .5) * 80;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xe8d8a0, size: .07, transparent: true, opacity: .75 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    /* ── FIREFLY PARTICLES ── */
    const ffCount = 22;  // was 65
    const ffGeo = new THREE.BufferGeometry();
    const ffPos = new Float32Array(ffCount * 3);
    const ffPhase = new Float32Array(ffCount);

    for (let i = 0; i < ffCount; i++) {
        ffPos[i * 3] = (Math.random() - .5) * 14;
        ffPos[i * 3 + 1] = Math.random() * 4 + .4;
        ffPos[i * 3 + 2] = (Math.random() - .5) * 10;
        ffPhase[i] = Math.random() * Math.PI * 2;
    }
    ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    const ffMat = new THREE.PointsMaterial({ color: 0xf0c040, size: .09, transparent: true, opacity: .85 });
    const fireflies = new THREE.Points(ffGeo, ffMat);
    scene.add(fireflies);

    /* ── CHIMNEY SMOKE ── */
    const smokeCount = 14;  // was 35
    const smokeGeo = new THREE.BufferGeometry();
    const smokePos = new Float32Array(smokeCount * 3);
    const smokePhase = new Float32Array(smokeCount);

    for (let i = 0; i < smokeCount; i++) {
        smokePos[i * 3] = 1.5 + (Math.random() - .5) * .3;
        smokePos[i * 3 + 1] = 5.6 + Math.random() * 2;
        smokePos[i * 3 + 2] = -.45 + (Math.random() - .5) * .3;
        smokePhase[i] = Math.random() * Math.PI * 2;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    const smokeMat = new THREE.PointsMaterial({ color: 0x6b5e52, size: .12, transparent: true, opacity: .3 });
    const smokeParticles = new THREE.Points(smokeGeo, smokeMat);
    house.add(smokeParticles);

    /* ── LIGHTING (3 lights total, was 11) ── */
    const ambLight = new THREE.AmbientLight(0x203050, .9);  // brighter ambient = less need for extra lights
    scene.add(ambLight);

    // Moonlight — 1 shadow-casting DirectionalLight, small shadow map
    const moonLight = new THREE.DirectionalLight(0x4060b0, 1.2);
    moonLight.position.set(-12, 20, -8);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(512, 512);  // was 2048 — 16x cheaper
    moonLight.shadow.camera.left = -14;
    moonLight.shadow.camera.right = 14;
    moonLight.shadow.camera.top = 14;
    moonLight.shadow.camera.bottom = -14;
    moonLight.shadow.camera.far = 55;
    scene.add(moonLight);

    // Cinema golden fill — DirectionalLight (no shadows, cheap)
    const cinemaFill = new THREE.DirectionalLight(0xe8a020, 1.8);
    cinemaFill.position.set(5, 12, 8);
    scene.add(cinemaFill);
    // interior PointLight already added inside house group above

    /* ── SCROLL TRACKING ── */
    // Scroll tracking event listener removed to eliminate 1-frame rendering sync delays.
    // We query window.scrollY directly in the render loop.

    /* ── PAUSE RENDER WHEN HERO OFF-SCREEN (IntersectionObserver) ── */
    let isVisible = true;
    const visObs = new IntersectionObserver(entries => {
        isVisible = entries[0].isIntersecting;
    }, { threshold: 0 });
    visObs.observe(hero);

    /* ── ANIMATION LOOP ── */
    let time = 0;
    let rotAuto = 0;
    let frameCount = 0;  // used to throttle particle updates

    function animate() {
        requestAnimationFrame(animate);
        if (!isVisible) return;  // skip render when scrolled away

        frameCount++;
        time += .01;
        rotAuto += .003;

        // House slow rotation
        house.rotation.y = rotAuto;

        // Camera orbit + scroll zoom (optimized: direct scroll read)
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const heroHeight = hero.offsetHeight || window.innerHeight;
        const scrollProg = Math.min(scrollY / heroHeight, 1);
        const orbitRadius = 15 - scrollProg * 5;
        const orbitAngle = time * .08 + rotAuto * .18;

        camera.position.x = Math.sin(orbitAngle) * orbitRadius;
        camera.position.z = Math.cos(orbitAngle) * orbitRadius;
        camera.position.y = 5.5 + scrollProg * 3 - Math.sin(time * .25) * .25;
        camera.lookAt(0, 1.8, 0);

        // Pulse interior light every frame (cheap — just a number change)
        const pulse = Math.sin(time * 1.2) * .3 + .8;
        interiorLight.intensity = pulse * 1.5;

        // Particles update every 3rd frame only
        if (frameCount % 3 === 0) {
            const fp = ffGeo.attributes.position.array;
            for (let i = 0; i < ffCount; i++) {
                ffPhase[i] += .055;
                fp[i * 3] += Math.sin(ffPhase[i] + i * 1.3) * .018;
                fp[i * 3 + 1] += Math.sin(ffPhase[i] * .7 + i) * .012;
                fp[i * 3 + 2] += Math.cos(ffPhase[i] + i * .7) * .018;
                if (fp[i * 3 + 1] > 5.2) fp[i * 3 + 1] = .5;
                if (fp[i * 3 + 1] < .2) fp[i * 3 + 1] = .5;
            }
            ffGeo.attributes.position.needsUpdate = true;

            const sp = smokeGeo.attributes.position.array;
            for (let i = 0; i < smokeCount; i++) {
                sp[i * 3 + 1] += .03;
                sp[i * 3] += Math.sin(time * 3 + smokePhase[i]) * .004;
                if (sp[i * 3 + 1] > 8) {
                    sp[i * 3] = 1.5 + (Math.random() - .5) * .3;
                    sp[i * 3 + 1] = 5.6;
                    sp[i * 3 + 2] = -.45 + (Math.random() - .5) * .3;
                }
            }
            smokeGeo.attributes.position.needsUpdate = true;
        }

        // Stars: static — just slow rotation, no per-particle update
        stars.rotation.y += .00005;

        renderer.render(scene, camera);
    }

    animate();

    /* ── RESIZE HANDLER ── */
    function onResize() {
        const W2 = hero.clientWidth, H2 = hero.clientHeight;
        camera.aspect = W2 / H2;
        camera.updateProjectionMatrix();
        renderer.setSize(W2, H2);
    }
    window.addEventListener('resize', onResize);
}

/* ════════════════════════════════════════════════════════════════
   PRELOADER — Cinema Curtain
   ════════════════════════════════════════════════════════════════ */
function initPreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader || typeof gsap === 'undefined') return;

    const spans = preloader.querySelectorAll('.preloader-countdown span');
    const logoWrap = preloader.querySelector('.preloader-logo-wrap');
    const tagline = preloader.querySelector('.preloader-tagline');

    // Film countdown 5..1
    spans.forEach((span, i) => {
        gsap.to(span, {
            opacity: 1,
            duration: .12,
            delay: i * .42,
            onComplete() {
                gsap.to(span, { opacity: 0, duration: .12, delay: .22 });
            }
        });
    });

    // Logo appears
    gsap.to(logoWrap, { opacity: 1, scale: 1, duration: .8, delay: .6, ease: 'back.out(1.6)', clearProps: 'all' });
    gsap.to(tagline, { opacity: 1, y: 0, duration: .7, delay: 1.4, ease: 'power2.out' });

    // Fade preloader content before curtains
    gsap.to('.preloader-center', { opacity: 0, duration: .4, delay: 2.5 });

    // Curtains OPEN
    gsap.to('.curtain-left', {
        xPercent: -100,
        duration: 1.3,
        delay: 2.7,
        ease: 'power4.inOut',
    });
    gsap.to('.curtain-right', {
        xPercent: 100,
        duration: 1.3,
        delay: 2.7,
        ease: 'power4.inOut',
        onComplete() {
            preloader.style.display = 'none';
            if (window.ScrollTrigger) {
                ScrollTrigger.refresh();
            }
        }
    });
}

/* ════════════════════════════════════════════════════════════════
   GSAP SCROLL ANIMATIONS
   ════════════════════════════════════════════════════════════════ */
function initGSAP() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    // ── Hero reveal (after preloader, ~3.2s) ──
    const DELAY = 3.2;

    gsap.to('#heroEyebrow', { opacity: 1, y: 0, duration: .8, delay: DELAY, ease: 'power3.out' });
    gsap.to('.hero-line-1', { opacity: 1, y: 0, duration: 1, delay: DELAY + .25, ease: 'power3.out' });
    gsap.to('.hero-line-2', { opacity: 1, y: 0, duration: 1, delay: DELAY + .5, ease: 'power3.out' });
    gsap.to('#heroRule', { opacity: 1, duration: .7, delay: DELAY + .75, ease: 'power2.out' });
    gsap.to('#heroSubtitle', { opacity: 1, y: 0, duration: .8, delay: DELAY + .95, ease: 'power2.out' });
    gsap.to('#heroBtnPrimary', { opacity: 1, y: 0, duration: .7, delay: DELAY + 1.2, ease: 'back.out(1.5)' });
    gsap.to('#heroBtnSecondary', { opacity: 1, y: 0, duration: .7, delay: DELAY + 1.4, ease: 'back.out(1.5)' });
    gsap.to('#heroStatsBar', { opacity: 1, duration: .8, delay: DELAY + 1.6, ease: 'power2.out' });
    gsap.to('#scrollIndicator', { opacity: 1, duration: .8, delay: DELAY + 2.0 });

    // Hero counter animation
    document.querySelectorAll('.hero-stat-num').forEach(el => {
        const target = parseInt(el.getAttribute('data-target') || '0');
        const suffix = el.textContent.includes('%') ? '%' : '+';
        setTimeout(() => {
            const obj = { val: 0 };
            gsap.to(obj, {
                val: target,
                duration: 2,
                ease: 'power2.out',
                onUpdate() { el.textContent = Math.round(obj.val) + suffix; }
            });
        }, (DELAY + 1.7) * 1000);
    });

    // ── Navbar scroll ──
    ScrollTrigger.create({
        start: 'top -80',
        onUpdate: self => {
            document.getElementById('mainNavbar')?.classList.toggle('scrolled', self.scroll() > 80);
        }
    });

    // ── Scroll indicator fade on scroll ──
    gsap.to('#scrollIndicator', {
        opacity: 0,
        scrollTrigger: { trigger: '#hero', start: 'top top', end: '20% top', scrub: true }
    });

    // ── Visualizer section ──
    gsap.from('#visualizer h2', {
        scrollTrigger: { trigger: '#visualizer', start: 'top 78%' },
        opacity: 0, y: 48, duration: .9, ease: 'power3.out'
    });

    gsap.from('#visualizer p', {
        scrollTrigger: { trigger: '#visualizer', start: 'top 72%' },
        opacity: 0, y: 28, duration: .8, delay: .15, ease: 'power2.out'
    });

    gsap.from('#visualizer .btn', {
        scrollTrigger: { trigger: '#visualizer', start: 'top 68%' },
        opacity: 0, y: 20, stagger: .12, duration: .7, delay: .25, ease: 'back.out(1.4)'
    });

    // ── Services cards ──
    gsap.from('#services .service-card', {
        scrollTrigger: { trigger: '#services', start: 'top 72%' },
        opacity: 0, y: 45, rotationY: 8,
        stagger: .14, duration: .85, ease: 'power3.out'
    });

    // ── Catalog ──
    gsap.from('#catalog h2', {
        scrollTrigger: { trigger: '#catalog', start: 'top 76%' },
        opacity: 0, x: -45, duration: .9, ease: 'power3.out'
    });

    // ── AI Lab ──
    gsap.from('.ai-lab-card', {
        scrollTrigger: { trigger: '.ai-lab-card', start: 'top 80%' },
        opacity: 0, scale: .94, y: 28, duration: .9, ease: 'back.out(1.6)'
    });

    // ── Contact ──
    gsap.from('#contact h2', {
        scrollTrigger: { trigger: '#contact', start: 'top 78%' },
        opacity: 0, y: 38, duration: .8
    });

    // ── Team image parallax ──
    gsap.to('.team-img-wrapper img', {
        scrollTrigger: {
            trigger: '.team-img-wrapper',
            start: 'top bottom', end: 'bottom top',
            scrub: true
        },
        yPercent: -15, ease: 'none'
    });

    // ── Category tabs reveal ──
    gsap.from('.category-tab', {
        scrollTrigger: { trigger: '.categories-wrapper', start: 'top 80%' },
        opacity: 0, scale: .85, stagger: .06, duration: .5, ease: 'back.out(1.4)'
    });

    // ── Footer ──
    gsap.from('footer .col-lg-4', {
        scrollTrigger: { trigger: 'footer', start: 'top 85%' },
        opacity: 0, y: 30, duration: .7, ease: 'power2.out'
    });
}

/* ════════════════════════════════════════════════════════════════
   PROJECT DATA
   ════════════════════════════════════════════════════════════════ */
const projectData = {
    "phong-khach": {
        title: "Phòng Khách Minimalist Modern",
        description: "Thiết kế mở phóng khoáng, kết hợp gỗ tự nhiên và đá marble cao cấp mang lại cảm giác ấm cúng.",
        sketch: "img/sketch_livingroom.png", render: "img/project_livingroom.png",
        price: "15,000,000đ - 35,000,000đ"
    },
    "phong-ngu": {
        title: "Phòng Ngủ Master Luxury",
        description: "Tông màu trầm ấm, tối ưu ánh sáng tự nhiên với hệ cửa kính sát trần panoramic tuyệt đẹp.",
        sketch: "img/sketch_bedroom.png", render: "img/project_bedroom.png",
        price: "20,000,000đ - 45,000,000đ"
    },
    "cua-hang": {
        title: "Cửa Hàng Trưng Bày Boutique",
        description: "Mặt tiền ấn tượng bằng kính cường lực và hệ khung thép sơn tĩnh điện sang trọng.",
        sketch: "img/sketch_Shop.jpg", render: "img/Shop.jpg",
        price: "80,000,000đ - 200,000,000đ"
    },
    "phong-tam": {
        title: "Phòng Tắm Smart Glass",
        description: "Thiết kế tối giản tích hợp bồn tắm jacuzzi và hệ thống thiết bị vệ sinh thông minh.",
        sketch: "img/sketch_Restroom.jpg", render: "img/Restroom.jpg",
        price: "25,000,000đ - 60,000,000đ"
    },
    "nha-bep": {
        title: "Nhà Bếp & Phòng Ăn Đảo Bếp",
        description: "Hệ tủ bếp âm tường tối giản cao kịch trần tích hợp phụ kiện thông minh.",
        sketch: "img/sketch_Kitchen.jpg", render: "img/Kitchen.jpg",
        price: "40,000,000đ - 90,000,000đ"
    },
    "nha-pho": {
        title: "Nhà Phố Mặt Tiền 6m Hiện Đại",
        description: "Giải pháp kiến trúc đón gió và ánh sáng tối đa cho nhà lô phố chật hẹp đô thị.",
        sketch: "img/sketch_Townhouse.jpg", render: "img/Townhouse.jpg",
        price: "1.2 - 2.5 Tỷ VNĐ"
    },
    "nha": {
        title: "Nhà Vườn Kiểu Nhật — Zen House",
        description: "Thiết kế nhà vườn phong cách tối giản Nhật Bản, vách trượt Shoji, vườn sỏi thiền.",
        sketch: "img/sketch_japanese.png", render: "img/project_japanese.png",
        price: "1.2 - 2.8 Tỷ VNĐ"
    },
    "biet-thu": {
        title: "Nhà Cổ 3 Gian Truyền Thống Việt Nam",
        description: "Tinh hoa kiến trúc truyền thống với nhà gỗ 3 gian mái ngói đỏ, cột gỗ lim vững chãi.",
        sketch: "img/sketch_traditional.png", render: "img/project_traditional.png",
        price: "2.5 - 5.5 Tỷ VNĐ"
    },
    "cao-oc": {
        title: "Tổ Hợp Chung Cư & Thương Mại",
        description: "Tháp căn hộ cao tầng biểu tượng kiến trúc mới giữa trung tâm thành phố.",
        sketch: "img/sketch_apartment.png", render: "img/project_apartment.png",
        price: "Dự án quy mô lớn"
    },
    "mall": {
        title: "Trung Tâm Thương Mại Commercial Center",
        description: "Quy hoạch không gian mua sắm hiện đại kết hợp khu vui chơi giải trí cao cấp.",
        sketch: "img/sketch_Mall.jpg", render: "img/Mall.jpg",
        price: "Dự án quy mô lớn"
    },
    "van-phong": {
        title: "Tòa Nhà Văn Phòng Glass Facade",
        description: "Thiết kế mặt đứng full kính Low-E tiết kiệm năng lượng vượt trội.",
        sketch: "img/sketch_Office.jpg", render: "img/Office.jpg",
        price: "3.2 - 8.5 Tỷ VNĐ"
    }
};

/* ════════════════════════════════════════════════════════════════
   CATALOG DATA
   ════════════════════════════════════════════════════════════════ */
const catalogData = [
    { title: "Gói Thiết Kế Bản Vẽ Biệt Thự Hiện Đại 3D", category: "biet-thu", price: "12,500,000đ", originalPrice: "18,000,000đ", image: "img/project_villa.png", rating: 5, badge: "Bán chạy" },
    { title: "Bản Vẽ Chi Tiết Nhà Vườn Kiểu Nhật Zen Garden", category: "nha", price: "9,500,000đ", originalPrice: "14,000,000đ", image: "img/project_japanese.png", rating: 4.9, badge: "Kiểu Nhật" },
    { title: "Thiết Kế Nhà Cổ 3 Gian Truyền Thống Việt Nam", category: "biet-thu", price: "18,000,000đ", originalPrice: "26,000,000đ", image: "img/project_traditional.png", rating: 5, badge: "Nhà Cổ" },
    { title: "Gói Thiết Kế Nội Thất Phòng Khách Luxury", category: "phong-khach", price: "4,200,000đ", originalPrice: "6,000,000đ", image: "img/project_livingroom.png", rating: 4.8, badge: "Khuyên dùng" },
    { title: "Thiết Kế Nội Thất Phòng Ngủ Master Panoramic", category: "phong-ngu", price: "3,800,000đ", originalPrice: "5,500,000đ", image: "img/project_bedroom.png", rating: 4.9, badge: "Hiện đại" },
    { title: "Gói Thiết Kế Bếp & Đảo Bếp Thông Minh", category: "nha-bep", price: "5,200,000đ", originalPrice: "7,500,000đ", image: "img/project_kitchen.png", rating: 4.8, badge: "Yêu thích" },
    { title: "Mẫu Thiết Kế Phòng Tắm Smart Glass 3D", category: "phong-tam", price: "2,500,000đ", originalPrice: "3,800,000đ", image: "img/project_Restroom.jpg", rating: 4.7, badge: "Tiết kiệm" },
    { title: "Bản Vẽ Kiến Trúc Nhà Phố 3 Tầng Mặt Tiền 5m", category: "nha-pho", price: "8,900,000đ", originalPrice: "12,000,000đ", image: "img/project_apartment.png", rating: 4.9, badge: "Mới" },
    { title: "Gói Thiết Kế Bản Vẽ Cửa Hàng Trưng Bày Boutique", category: "cua-hang", price: "7,500,000đ", originalPrice: "11,000,000đ", image: "img/project_shop.jpg", rating: 4.8, badge: "Thương mại" },
    { title: "Thiết Kế Không Gian Văn Phòng Làm Việc Coworking", category: "van-phong", price: "15,000,000đ", originalPrice: "22,000,000đ", image: "img/project_office.png", rating: 4.7, badge: "Ưu đãi" },
];

/* ════════════════════════════════════════════════════════════════
   COMPARISON SLIDER
   ════════════════════════════════════════════════════════════════ */
function initSlider() {
    const cont = document.getElementById('showcaseContainer');
    const sketch = document.getElementById('showcaseSketch');
    const sliderBar = document.getElementById('sliderBar');
    const sketchPreview = document.getElementById('sketchPreview');
    const sketchImg = document.getElementById('sketchPreviewImg');
    if (!cont || !sketch) return;

    let dragging = false;

    function setPos(clientX) {
        const r = cont.getBoundingClientRect();
        let pct = ((clientX - r.left) / r.width) * 100;
        pct = Math.max(0, Math.min(100, pct));
        sketch.style.clipPath = `polygon(0 0,${pct}% 0,${pct}% 100%,0 100%)`;
        sliderBar.style.left = `${pct}%`;
    }

    function resetSlider() {
        sketch.style.clipPath = 'polygon(0 0,50% 0,50% 100%,0 100%)';
        sliderBar.style.left = '50%';
    }

    resetSlider();

    cont.addEventListener('mousedown', e => { dragging = true; setPos(e.clientX); });
    window.addEventListener('mousemove', e => { if (dragging) setPos(e.clientX); });
    window.addEventListener('mouseup', () => { dragging = false; });
    cont.addEventListener('touchstart', e => { dragging = true; if (e.touches[0]) setPos(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchmove', e => { if (dragging && e.touches[0]) setPos(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchend', () => { dragging = false; });

    // Sketch preview click — cinematic sweep
    sketchPreview?.addEventListener('click', () => {
        if (window.gsap) {
            gsap.timeline()
                .to(sliderBar, {
                    left: '100%', duration: .75, ease: 'power2.inOut', onUpdate() {
                        const p = parseFloat(sliderBar.style.left);
                        sketch.style.clipPath = `polygon(0 0,${p}% 0,${p}% 100%,0 100%)`;
                    }
                })
                .to(sliderBar, {
                    left: '0%', duration: .9, ease: 'power2.inOut', onUpdate() {
                        const p = parseFloat(sliderBar.style.left);
                        sketch.style.clipPath = `polygon(0 0,${p}% 0,${p}% 100%,0 100%)`;
                    }
                })
                .to(sliderBar, {
                    left: '50%', duration: .7, ease: 'back.out(1.2)', onUpdate() {
                        const p = parseFloat(sliderBar.style.left);
                        sketch.style.clipPath = `polygon(0 0,${p}% 0,${p}% 100%,0 100%)`;
                    }
                });
        }
    });

    return { resetSlider, sketchImg, sketch };
}

/* ════════════════════════════════════════════════════════════════
   CATEGORY SWITCH
   ════════════════════════════════════════════════════════════════ */
function initCategories(sliderFns) {
    const tabs = document.querySelectorAll('.category-tab');
    const projectTitle = document.getElementById('projectTitle');
    const projectDesc = document.getElementById('projectDesc');
    const projectCost = document.getElementById('projectCost');
    let activeCategory = 'nha-pho';

    function switchCategory(cat) {
        activeCategory = cat;
        const proj = projectData[cat];
        if (!proj) return;

        tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-cat') === cat));

        if (window.gsap) {
            gsap.to([projectTitle, projectDesc, projectCost], {
                opacity: 0, y: -6, duration: .2, stagger: .04,
                onComplete() {
                    projectTitle.textContent = proj.title;
                    projectDesc.textContent = proj.description;
                    projectCost.textContent = proj.price;

                    document.querySelector('.showcase-render').style.backgroundImage = `url(${proj.render})`;
                    document.getElementById('showcaseSketch').style.backgroundImage = `url(${proj.sketch})`;
                    if (sliderFns) {
                        sliderFns.sketchImg.src = proj.sketch;
                        sliderFns.resetSlider();
                    }

                    gsap.to([projectTitle, projectDesc, projectCost], { opacity: 1, y: 0, duration: .4, stagger: .05 });
                }
            });
        } else {
            projectTitle.textContent = proj.title;
            projectDesc.textContent = proj.description;
            projectCost.textContent = proj.price;
            document.querySelector('.showcase-render').style.backgroundImage = `url(${proj.render})`;
            document.getElementById('showcaseSketch').style.backgroundImage = `url(${proj.sketch})`;
            if (sliderFns) { sliderFns.sketchImg.src = proj.sketch; sliderFns.resetSlider(); }
        }

        renderCatalog(cat);
    }

    tabs.forEach(tab => tab.addEventListener('click', () => switchCategory(tab.getAttribute('data-cat'))));

    switchCategory(activeCategory);

    return { getActive: () => activeCategory };
}

/* ════════════════════════════════════════════════════════════════
   CATALOG RENDER
   ════════════════════════════════════════════════════════════════ */
function renderCatalog(filterCat = 'all') {
    const grid = document.getElementById('catalogGrid');
    if (!grid) return;
    grid.innerHTML = '';

    let items = catalogData;
    if (filterCat !== 'all') {
        const matched = catalogData.filter(i => i.category === filterCat);
        if (matched.length >= 3) {
            items = matched;
        } else if (matched.length > 0) {
            // Pad with other items to fill grid (min 3 shown)
            const others = catalogData.filter(i => i.category !== filterCat);
            items = [...matched, ...others].slice(0, Math.max(3, matched.length));
        } else {
            items = catalogData.slice(0, 3);
        }
    }

    items.forEach(item => {
        const stars = Array.from({ length: 5 }, (_, i) =>
            `<i class="bi bi-star-fill" style="font-size:.8rem;color:${i < Math.round(item.rating) ? 'var(--primary)' : 'rgba(255,255,255,.15)'}"></i>`
        ).join(' ');

        const card = document.createElement('div');
        card.className = 'col-12 col-md-6 col-lg-4';
        card.setAttribute('data-aos', 'fade-up');
        card.innerHTML = `
            <div class="premium-card h-100 position-relative" style="cursor:default">
                <div class="position-relative overflow-hidden" style="height:200px">
                    <img src="${item.image}" alt="${item.title}"
                        class="w-100 h-100"
                        style="object-fit:cover;object-position:center;transition:transform .5s ease">
                    <span class="position-absolute premium-badge" style="top:12px;left:12px">${item.badge}</span>
                    <div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(5,5,8,.55) 0%,transparent 55%);pointer-events:none"></div>
                </div>
                <div class="p-4 d-flex flex-column justify-content-between" style="min-height:175px">
                    <div>
                        <div class="mb-2">${stars}</div>
                        <h5 class="fs-6 mb-2 text-truncate-2" style="color:var(--text-primary)">${item.title}</h5>
                    </div>
                    <div class="d-flex align-items-center justify-content-between mt-3">
                        <div>
                            <span class="text-decoration-line-through small d-block" style="color:var(--text-muted)">${item.originalPrice}</span>
                            <div class="fw-bold fs-5" style="color:var(--primary)">${item.price}</div>
                        </div>
                        <button class="btn btn-primary btn-sm px-3 rounded-pill glow-btn add-to-cart-btn" data-title="${item.title}">
                            <i class="bi bi-cart-plus-fill me-1"></i>Mua
                        </button>
                    </div>
                </div>
            </div>`;
        grid.appendChild(card);
    });

    // Image hover scale
    grid.querySelectorAll('.premium-card').forEach(c => {
        const img = c.querySelector('img');
        c.addEventListener('mouseenter', () => { if (img) img.style.transform = 'scale(1.08)'; });
        c.addEventListener('mouseleave', () => { if (img) img.style.transform = 'scale(1)'; });
    });

    // Cart buttons
    grid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            showToast(`Đã thêm "${btn.getAttribute('data-title')}" vào giỏ hàng!`);
        });
    });

    // Re-trigger AOS on new cards
    if (window.AOS) window.AOS.refresh();
}

/* ════════════════════════════════════════════════════════════════
   TOAST NOTIFICATION
   ════════════════════════════════════════════════════════════════ */
function showToast(msg) {
    let cont = document.getElementById('toastCont');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'toastCont';
        Object.assign(cont.style, {
            position: 'fixed', bottom: '24px', right: '24px',
            zIndex: '10001', display: 'flex', flexDirection: 'column', gap: '10px'
        });
        document.body.appendChild(cont);
    }

    const t = document.createElement('div');
    Object.assign(t.style, {
        background: 'rgba(8,6,14,.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--primary)',
        borderRadius: '12px',
        padding: '12px 18px',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: '280px',
        boxShadow: '0 10px 30px rgba(0,0,0,.5), 0 0 20px rgba(232,160,32,.1)',
        transform: 'translateX(130%)',
        transition: 'transform .4s cubic-bezier(0.16,1,.3,1)',
    });
    t.innerHTML = `<i class="bi bi-check-circle-fill" style="color:var(--primary);font-size:1.2rem;flex-shrink:0"></i>
                   <span class="small fw-semibold">${msg}</span>`;
    cont.appendChild(t);

    requestAnimationFrame(() => requestAnimationFrame(() => { t.style.transform = 'translateX(0)'; }));

    setTimeout(() => {
        t.style.transform = 'translateX(130%)';
        setTimeout(() => t.remove(), 400);
    }, 3200);
}

/* ════════════════════════════════════════════════════════════════
   THEME SWITCH
   ════════════════════════════════════════════════════════════════ */
function initTheme() {
    const btn = document.getElementById('themeToggleBtn');
    const icon = document.getElementById('themeIcon');
    const text = document.getElementById('themeText');
    if (!btn) return;

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'light') {
            icon.className = 'bi bi-sun-fill theme-switch-icon';
            text.textContent = 'Giao diện: Sáng';
            icon.style.color = '#f0c040';
        } else {
            icon.className = 'bi bi-moon-stars-fill theme-switch-icon';
            text.textContent = 'Giao diện: Tối';
            icon.style.color = 'var(--primary)';
        }
    }

    applyTheme(localStorage.getItem('theme') || 'dark');

    btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        if (window.gsap) {
            gsap.fromTo(icon, { scale: .5, rotate: -30 }, { scale: 1, rotate: 0, duration: .4, ease: 'back.out(1.6)' });
        }
    });
}

/* ════════════════════════════════════════════════════════════════
   CONSULTATION FORM
   ════════════════════════════════════════════════════════════════ */
function initForm() {
    const form = document.getElementById('consultationForm');
    if (!form) return;

    form.addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('clientName')?.value.trim();
        const phone = document.getElementById('clientPhone')?.value.trim();

        if (!name || !phone) {
            showToast('⚠️ Vui lòng điền đầy đủ Họ tên và Số điện thoại.');
            return;
        }

        showToast(`✅ Đăng ký thành công! Kỹ sư sẽ liên hệ với ${name} sớm nhất.`);
        form.reset();
    });
}

/* ════════════════════════════════════════════════════════════════
   CATALOG FILTER BUTTONS
   ════════════════════════════════════════════════════════════════ */
function initFilterBtns(catFns) {
    const btnActive = document.getElementById('btnFilterActive');
    const btnAll = document.getElementById('btnFilterAll');
    if (!btnActive || !btnAll) return;

    btnActive.addEventListener('click', () => {
        btnActive.classList.add('active');
        btnAll.classList.remove('active');
        renderCatalog(catFns.getActive());
    });

    btnAll.addEventListener('click', () => {
        btnAll.classList.add('active');
        btnActive.classList.remove('active');
        renderCatalog('all');
    });
}

/* ════════════════════════════════════════════════════════════════
   CSS UTILITIES (dynamic)
   ════════════════════════════════════════════════════════════════ */
(function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
        .text-truncate-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
    `;
    document.head.appendChild(s);
})();

/* ════════════════════════════════════════════════════════════════
   INIT — DOMContentLoaded
   ════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

    // 1. Smooth Scroll (Lenis)
    initLenis();

    // 2. Three.js 3D House
    initThreeJS();

    // 3. Preloader Cinema Curtain
    initPreloader();

    // 4. GSAP Scroll Animations
    setTimeout(initGSAP, 80);

    // 5. Theme toggle
    initTheme();

    // 6. Comparison slider
    const sliderFns = initSlider();

    // 7. Category tabs + initial render
    const catFns = initCategories(sliderFns);

    // 8. Filter buttons
    initFilterBtns(catFns);

    // 9. Form
    initForm();

    // 10. Navbar scroll highlight (active link)
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link-custom');

    const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                navLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            }
        });
    }, { threshold: .4 });

    sections.forEach(sec => io.observe(sec));
});
