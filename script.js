/* ============================================
   SAHUH AGENCY — Portfolio Script
   Reads config & videos from Firebase Firestore
   ============================================ */

(function () {
    'use strict';

    // ===== FIREBASE CONFIG =====
    const firebaseConfig = {
        apiKey: "AIzaSyDG8_q8sNmwu7DPzYYtxe8q0Ffcx5d5Nyk",
        authDomain: "portfolio-158cf.firebaseapp.com",
        projectId: "portfolio-158cf",
        storageBucket: "portfolio-158cf.firebasestorage.app",
        messagingSenderId: "988587196436",
        appId: "1:988587196436:web:f6ddeaf97c7b290edee701",
        measurementId: "G-6T61VM20NY"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    const CONFIG_REF = db.collection('portfolioConfig').doc('main');
    const VIDEOS_REF = db.collection('videos');

    // ===== STATE =====
    let portfolioConfig = {};
    let activeVideos = [];
    let adminClickCount = 0;
    let adminClickTimer = null;
    let particleAnimId = null;

    // ===== DOM =====
    const $ = (s) => document.querySelector(s);
    const $id = (id) => document.getElementById(id);

    const dom = {
        canvas: $id('particles'),
        bgAudio: $id('bgAudio'),
        adminDot: $id('adminDot'),
        introScreen: $id('introScreen'),
        portfolioScreen: $id('portfolioScreen'),
        mainPlayBtn: $id('mainPlayBtn'),
        videoGrid: $id('videoGrid'),
        ctaBtn: $id('ctaBtn'),
        ctaBtnText: $id('ctaBtnText'),
        videoOverlay: $id('videoOverlay'),
        closeVideoBtn: $id('closeVideo'),
        videoPlayerContainer: $id('videoPlayerContainer'),
        // Dynamic text elements
        nameMain: $id('nameMain'),
        nameSub: $id('nameSub'),
        tagline: $id('tagline'),
        playHint: $id('playHint'),
        secTitle: $id('secTitle'),
        secAccent: $id('secAccent'),
        secSub: $id('secSub')
    };

    // ===== TOAST =====
    function showToast(msg) {
        const existing = $('.toast');
        if (existing) existing.remove();

        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 300);
        }, 2500);
    }

    // ===== PARTICLE SYSTEM =====
    function initParticles() {
        const canvas = dom.canvas;
        const ctx = canvas.getContext('2d');
        let particles = [];
        const COUNT = 55;
        const LINK_DIST = 120;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        function spawn() {
            return {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 1.5 + 0.5,
                a: Math.random() * 0.4 + 0.1
            };
        }

        function init() {
            resize();
            particles = Array.from({ length: COUNT }, spawn);
        }

        function loop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < LINK_DIST) {
                        ctx.strokeStyle = `rgba(59,130,246,${(1 - d / LINK_DIST) * 0.12})`;
                        ctx.lineWidth = 0.6;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }

            for (const p of particles) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(59,130,246,${p.a})`;
                ctx.fill();
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < -10) p.x = canvas.width + 10;
                if (p.x > canvas.width + 10) p.x = -10;
                if (p.y < -10) p.y = canvas.height + 10;
                if (p.y > canvas.height + 10) p.y = -10;
            }

            particleAnimId = requestAnimationFrame(loop);
        }

        init();
        loop();
        window.addEventListener('resize', resize);
    }

    // ============================================
    //  FIREBASE DATA LOADING
    // ============================================

    async function loadConfig() {
        try {
            const doc = await CONFIG_REF.get();
            if (doc.exists) {
                portfolioConfig = doc.data();
                applyText();
            }
        } catch (err) {
            console.warn('Config load failed, using defaults:', err.message);
        }
    }

    async function loadActiveVideos() {
        try {
            // Fetch ALL videos (no compound query = no composite index needed)
            const snap = await VIDEOS_REF.get();

            activeVideos = [];
            snap.forEach(doc => {
                const data = doc.data();
                if (data.active) {
                    activeVideos.push({ id: doc.id, ...data });
                }
            });

            // Sort by order client-side
            activeVideos.sort((a, b) => (a.order || 0) - (b.order || 0));

            renderVideoGrid();
        } catch (err) {
            console.error('Videos load failed:', err);
            showToast('⚠️ Failed to load videos. Check Firestore rules.');
            // Show empty grid
            dom.videoGrid.innerHTML = '';
        }
    }

    // ===== APPLY TEXT FROM CONFIG =====
    function applyText() {
        const c = portfolioConfig;
        if (c.agencyName) dom.nameMain.textContent = c.agencyName;
        if (c.agencySubName) dom.nameSub.textContent = c.agencySubName;
        if (c.tagline) dom.tagline.textContent = c.tagline;
        if (c.playHint) dom.playHint.textContent = c.playHint;
        if (c.sectionTitle) dom.secTitle.textContent = c.sectionTitle;
        if (c.sectionAccent) dom.secAccent.textContent = c.sectionAccent;
        if (c.sectionSub) dom.secSub.textContent = c.sectionSub;
        if (c.buttonText) dom.ctaBtnText.textContent = c.buttonText;
    }

    // ============================================
    //  VIDEO GRID
    // ============================================

    function renderVideoGrid() {
        dom.videoGrid.innerHTML = '';

        if (activeVideos.length === 0) return;

        activeVideos.forEach((video, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'video-card-wrapper';

            const card = document.createElement('div');
            card.className = 'video-card';

            // --- Thumbnail: Always use Vimeo iframe for proper 9:16 display ---
            const thumbFrame = document.createElement('div');
            thumbFrame.className = 'card-vimeo-thumb';
            thumbFrame.id = `thumb-player-${idx}`;

            const iframe = document.createElement('iframe');
            iframe.src = `https://player.vimeo.com/video/${video.vimeoId}?background=1&quality=auto&app_id=58479&transparent=0`;
            iframe.allow = 'autoplay';
            iframe.setAttribute('loading', 'lazy');
            iframe.style.cssText = 'width:100%;height:100%;border:none;pointer-events:none;';
            thumbFrame.appendChild(iframe);
            card.appendChild(thumbFrame);

            // Seek to custom thumbnail time if set, then pause
            try {
                const player = new Vimeo.Player(iframe);
                const seekTime = (video.thumbnailTime && video.thumbnailTime > 0) ? video.thumbnailTime : 0;
                player.on('play', function onFirstPlay() {
                    player.setCurrentTime(seekTime).then(() => {
                        player.pause();
                    });
                    player.off('play', onFirstPlay);
                });
            } catch (e) {
                console.warn('Vimeo thumb player error:', e);
            }

            // Overlay gradient
            const overlay = document.createElement('div');
            overlay.className = 'card-overlay';
            card.appendChild(overlay);

            // Label
            const label = document.createElement('span');
            label.className = 'card-number';
            label.textContent = video.name || `REEL 0${idx + 1}`;
            card.appendChild(label);

            wrapper.appendChild(card);

            // Play button below card
            const playBtn = document.createElement('button');
            playBtn.className = 'card-play-btn';
            playBtn.setAttribute('aria-label', `Play ${video.name || 'video'}`);
            playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

            const vimeoId = video.vimeoId;
            playBtn.addEventListener('click', () => playVideo(vimeoId));
            card.addEventListener('click', () => playVideo(vimeoId));

            wrapper.appendChild(playBtn);
            dom.videoGrid.appendChild(wrapper);
        });
    }

    // ============================================
    //  VIDEO PLAYER (FULLSCREEN)
    // ============================================

    function playVideo(vimeoId) {
        if (!vimeoId) {
            showToast('No video configured.');
            return;
        }

        // Pause background audio
        if (dom.bgAudio && !dom.bgAudio.paused) {
            dom.bgAudio.pause();
        }

        dom.videoPlayerContainer.innerHTML = `
            <iframe
                src="https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0&loop=0&muted=0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowfullscreen
                style="width:100%;height:100%;border:none;">
            </iframe>`;

        dom.videoOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeVideo() {
        dom.videoOverlay.classList.remove('active');
        setTimeout(() => {
            dom.videoPlayerContainer.innerHTML = '';
        }, 400);

        // Resume background audio
        if (dom.bgAudio && dom.bgAudio.src && portfolioConfig.bgAudioUrl) {
            dom.bgAudio.play().catch(() => {});
        }
        document.body.style.overflow = '';
    }

    // ============================================
    //  SCREEN TRANSITIONS
    // ============================================

    function showPortfolio() {
        dom.introScreen.classList.remove('active');
        setTimeout(() => dom.portfolioScreen.classList.add('active'), 400);

        // Start background audio
        const audioUrl = portfolioConfig.bgAudioUrl;
        if (audioUrl) {
            dom.bgAudio.src = audioUrl;
            dom.bgAudio.volume = 0.35;
            dom.bgAudio.play().catch(e => {
                console.log('Audio autoplay blocked:', e.message);
            });
        }
    }

    // ============================================
    //  WHATSAPP CTA
    // ============================================

    function openWhatsApp() {
        let num = portfolioConfig.whatsappNumber || '';
        num = num.replace(/[\s\-\(\)]/g, '');
        if (num.startsWith('+')) num = num.substring(1);

        if (!num) {
            showToast('WhatsApp number not configured.');
            return;
        }

        const msg = encodeURIComponent('Hi! I\'m interested in getting a sample edit.');
        window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
    }

    // ============================================
    //  ADMIN DOT (triple-click → admin.html)
    // ============================================

    function handleAdminDotClick() {
        adminClickCount++;
        if (adminClickTimer) clearTimeout(adminClickTimer);
        adminClickTimer = setTimeout(() => { adminClickCount = 0; }, 600);

        if (adminClickCount >= 3) {
            adminClickCount = 0;
            clearTimeout(adminClickTimer);
            window.open('admin.html', '_blank');
        }
    }

    // ============================================
    //  EVENT LISTENERS
    // ============================================

    function bindEvents() {
        dom.mainPlayBtn.addEventListener('click', showPortfolio);
        dom.adminDot.addEventListener('click', handleAdminDotClick);
        dom.ctaBtn.addEventListener('click', openWhatsApp);
        dom.closeVideoBtn.addEventListener('click', closeVideo);
        dom.videoOverlay.addEventListener('click', (e) => {
            if (e.target === dom.videoOverlay) closeVideo();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dom.videoOverlay.classList.contains('active')) {
                closeVideo();
            }
        });
    }

    // ============================================
    //  INIT
    // ============================================

    async function init() {
        initParticles();
        bindEvents();

        // Load data from Firebase
        await Promise.all([loadConfig(), loadActiveVideos()]);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
