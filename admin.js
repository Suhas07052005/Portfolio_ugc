/* ============================================
   SAHUH AGENCY — Admin Dashboard Script
   Firebase CRUD + Vimeo Thumbnail Selector
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

    // Firestore references
    const CONFIG_REF = db.collection('portfolioConfig').doc('main');
    const VIDEOS_REF = db.collection('videos');

    // ===== STATE =====
    let currentThumbDocId = null;
    let thumbPlayer = null;
    let currentEditDocId = null;

    // ===== DOM HELPERS =====
    const $ = (s) => document.querySelector(s);
    const $id = (id) => document.getElementById(id);

    // ===== TOAST NOTIFICATIONS =====
    function showToast(message, type = 'success') {
        const container = $id('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 2800);
    }

    // ============================================
    //  TEXT SETTINGS
    // ============================================

    async function loadTextSettings() {
        try {
            const doc = await CONFIG_REF.get();
            if (doc.exists) {
                const d = doc.data();
                $id('txt-agencyName').value = d.agencyName || '';
                $id('txt-agencySubName').value = d.agencySubName || '';
                $id('txt-tagline').value = d.tagline || '';
                $id('txt-sectionTitle').value = d.sectionTitle || '';
                $id('txt-sectionAccent').value = d.sectionAccent || '';
                $id('txt-sectionSub').value = d.sectionSub || '';
                $id('txt-buttonText').value = d.buttonText || '';
                $id('txt-playHint').value = d.playHint || '';
                $id('txt-whatsapp').value = d.whatsappNumber || '';
                $id('txt-bgAudio').value = d.bgAudioUrl || '';
            }
        } catch (err) {
            console.error('Load text error:', err);
            showToast('Failed to load settings. Check Firebase rules.', 'error');
        }
    }

    async function saveTextSettings() {
        const btn = $id('saveTextBtn');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            await CONFIG_REF.set({
                agencyName: $id('txt-agencyName').value.trim(),
                agencySubName: $id('txt-agencySubName').value.trim(),
                tagline: $id('txt-tagline').value.trim(),
                sectionTitle: $id('txt-sectionTitle').value.trim(),
                sectionAccent: $id('txt-sectionAccent').value.trim(),
                sectionSub: $id('txt-sectionSub').value.trim(),
                buttonText: $id('txt-buttonText').value.trim(),
                playHint: $id('txt-playHint').value.trim(),
                whatsappNumber: $id('txt-whatsapp').value.trim(),
                bgAudioUrl: $id('txt-bgAudio').value.trim()
            }, { merge: true });

            showToast('Text settings saved!');
        } catch (err) {
            console.error('Save text error:', err);
            showToast('Failed to save. Check Firebase rules.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Text Settings`;
        }
    }

    // ============================================
    //  VIMEO LIBRARY — CRUD
    // ============================================

    async function addVideo() {
        const vimeoId = $id('new-vimeoId').value.trim();
        const name = $id('new-videoName').value.trim();

        if (!vimeoId) {
            showToast('Please enter a Vimeo ID', 'error');
            return;
        }
        if (!name) {
            showToast('Please give the video a name', 'error');
            return;
        }

        // Check for duplicate Vimeo ID
        try {
            const existing = await VIDEOS_REF.where('vimeoId', '==', vimeoId).get();
            if (!existing.empty) {
                showToast('This Vimeo ID is already in your library!', 'error');
                return;
            }
        } catch (err) {
            console.error('Duplicate check error:', err);
        }

        const btn = $id('addVideoBtn');
        btn.disabled = true;

        try {
            await VIDEOS_REF.add({
                vimeoId: vimeoId,
                name: name,
                thumbnailTime: 0,
                active: false,
                order: Date.now(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            $id('new-vimeoId').value = '';
            $id('new-videoName').value = '';
            showToast(`"${name}" added to library!`);
            loadVideos();
        } catch (err) {
            console.error('Add video error:', err);
            showToast('Failed to add video', 'error');
        } finally {
            btn.disabled = false;
        }
    }

    async function loadVideos() {
        try {
            const snapshot = await VIDEOS_REF.get();
            const list = $id('videoList');
            list.innerHTML = '';

            let activeCount = 0;
            const docs = [];
            snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
            docs.sort((a, b) => (a.order || 0) - (b.order || 0));

            if (docs.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📂</div>
                        <p>No videos yet</p>
                        <span>Add your first Vimeo video above</span>
                    </div>`;
                updateActiveCount(0);
                return;
            }

            docs.forEach(video => {
                if (video.active) activeCount++;
                list.appendChild(buildVideoCard(video.id, video));
            });

            updateActiveCount(activeCount);
        } catch (err) {
            console.error('Load videos error:', err);
            showToast('Failed to load videos', 'error');
        }
    }

    function updateActiveCount(count) {
        const badge = $id('activeCount');
        badge.querySelector('.count-badge').textContent = count;
    }

    function buildVideoCard(docId, data) {
        const card = document.createElement('div');
        card.className = `vlc${data.active ? ' is-active' : ''}`;
        card.dataset.id = docId;

        const thumbSrc = `https://vumbnail.com/${data.vimeoId}.jpg`;
        const thumbInfo = data.thumbnailTime > 0
            ? ` • Thumb: <span class="thumb-time">${data.thumbnailTime.toFixed(1)}s</span>`
            : '';

        card.innerHTML = `
            <div class="vlc-thumb">
                <img src="${thumbSrc}" alt="${data.name}" onerror="this.style.display='none'">
                <div class="vlc-thumb-ph">🎬</div>
            </div>
            <div class="vlc-info">
                <h4 class="vlc-name">${escapeHtml(data.name)}</h4>
                <p class="vlc-meta">ID: ${data.vimeoId}${thumbInfo}</p>
            </div>
            <div class="vlc-actions">
                <button class="vlc-btn toggle-active ${data.active ? 'on' : ''}" data-action="toggle" data-doc="${docId}" data-active="${data.active}">
                    ${data.active ? '✅ Active' : '⬜ Inactive'}
                </button>
                <button class="vlc-btn" data-action="edit" data-doc="${docId}" data-name="${escapeHtml(data.name)}" data-vimeo="${data.vimeoId}">
                    ✏️ Edit
                </button>
                <button class="vlc-btn" data-action="thumb" data-doc="${docId}" data-vimeo="${data.vimeoId}">
                    📸 Thumb
                </button>
                <button class="vlc-btn btn-del" data-action="delete" data-doc="${docId}" data-name="${escapeHtml(data.name)}">
                    🗑️
                </button>
            </div>
        `;

        return card;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== TOGGLE ACTIVE =====
    async function toggleActive(docId, currentlyActive) {
        const newState = currentlyActive === 'true' ? false : true;

        if (newState) {
            // Count current actives
            try {
                const snap = await VIDEOS_REF.where('active', '==', true).get();
                if (snap.size >= 4) {
                    showToast('Max 4 active videos. Deactivate one first.', 'error');
                    return;
                }
            } catch (err) {
                console.error(err);
            }
        }

        try {
            await VIDEOS_REF.doc(docId).update({ active: newState });
            showToast(newState ? 'Video activated on portfolio!' : 'Video deactivated');
            loadVideos();
        } catch (err) {
            console.error('Toggle error:', err);
            showToast('Failed to update', 'error');
        }
    }

    // ===== DELETE VIDEO =====
    async function deleteVideo(docId, name) {
        if (!confirm(`Delete "${name}" from your library?`)) return;

        try {
            await VIDEOS_REF.doc(docId).delete();
            showToast('Video removed from library');
            loadVideos();
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Failed to delete', 'error');
        }
    }

    // ============================================
    //  EDIT VIDEO
    // ============================================

    function openEditModal(docId, name, vimeoId) {
        currentEditDocId = docId;
        $id('edit-videoName').value = name;
        $id('edit-vimeoId').value = vimeoId;
        $id('editModal').classList.add('active');
        $id('edit-videoName').focus();
    }

    function closeEditModal() {
        $id('editModal').classList.remove('active');
        currentEditDocId = null;
    }

    async function saveEditChanges() {
        if (!currentEditDocId) return;

        const newName = $id('edit-videoName').value.trim();
        const newVimeoId = $id('edit-vimeoId').value.trim();

        if (!newName) {
            showToast('Please enter a video name', 'error');
            return;
        }
        if (!newVimeoId) {
            showToast('Please enter a Vimeo ID', 'error');
            return;
        }

        // Check for duplicate Vimeo ID (exclude the current doc)
        try {
            const existing = await VIDEOS_REF.where('vimeoId', '==', newVimeoId).get();
            let isDuplicate = false;
            existing.forEach(doc => {
                if (doc.id !== currentEditDocId) isDuplicate = true;
            });
            if (isDuplicate) {
                showToast('Another video already uses this Vimeo ID!', 'error');
                return;
            }
        } catch (err) {
            console.error('Duplicate check error:', err);
        }

        try {
            await VIDEOS_REF.doc(currentEditDocId).update({
                name: newName,
                vimeoId: newVimeoId
            });
            showToast('Video updated!');
            closeEditModal();
            loadVideos();
        } catch (err) {
            console.error('Edit save error:', err);
            showToast('Failed to save changes', 'error');
        }
    }

    // ============================================
    //  THUMBNAIL SELECTOR
    // ============================================

    function openThumbSelector(docId, vimeoId) {
        currentThumbDocId = docId;
        const modal = $id('thumbModal');
        const wrap = $id('thumbPlayerWrap');

        // Clear previous
        wrap.innerHTML = '';

        // Create Vimeo iframe
        const iframe = document.createElement('iframe');
        iframe.src = `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0`;
        iframe.allow = 'autoplay; fullscreen';
        iframe.allowFullscreen = true;
        iframe.id = 'thumbIframe';
        wrap.appendChild(iframe);

        // Init Vimeo Player API
        thumbPlayer = new Vimeo.Player(iframe);

        modal.classList.add('active');
    }

    async function captureThumbFrame() {
        if (!thumbPlayer || !currentThumbDocId) return;

        try {
            const time = await thumbPlayer.getCurrentTime();
            const rounded = Math.round(time * 10) / 10;

            await VIDEOS_REF.doc(currentThumbDocId).update({
                thumbnailTime: rounded
            });

            showToast(`Thumbnail set at ${rounded}s`);
            closeThumbModal();
            loadVideos();
        } catch (err) {
            console.error('Capture thumb error:', err);
            showToast('Failed to set thumbnail', 'error');
        }
    }

    function closeThumbModal() {
        $id('thumbModal').classList.remove('active');

        if (thumbPlayer) {
            thumbPlayer.destroy().catch(() => {});
            thumbPlayer = null;
        }
        $id('thumbPlayerWrap').innerHTML = '';
        currentThumbDocId = null;
    }

    // ============================================
    //  EVENT DELEGATION & LISTENERS
    // ============================================

    // Video list — delegated click handler
    $id('videoList').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;

        switch (action) {
            case 'toggle':
                toggleActive(btn.dataset.doc, btn.dataset.active);
                break;
            case 'edit':
                openEditModal(btn.dataset.doc, btn.dataset.name, btn.dataset.vimeo);
                break;
            case 'thumb':
                openThumbSelector(btn.dataset.doc, btn.dataset.vimeo);
                break;
            case 'delete':
                deleteVideo(btn.dataset.doc, btn.dataset.name);
                break;
        }
    });

    // Save text
    $id('saveTextBtn').addEventListener('click', saveTextSettings);

    // Add video
    $id('addVideoBtn').addEventListener('click', addVideo);

    // Enter key in add inputs
    $id('new-vimeoId').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $id('new-videoName').focus();
    });
    $id('new-videoName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addVideo();
    });

    // Thumbnail modal
    $id('setThumbBtn').addEventListener('click', captureThumbFrame);
    $id('closeThumbModal').addEventListener('click', closeThumbModal);
    $id('thumbModal').addEventListener('click', (e) => {
        if (e.target.id === 'thumbModal') closeThumbModal();
    });

    // Edit modal
    $id('saveEditBtn').addEventListener('click', saveEditChanges);
    $id('closeEditModal').addEventListener('click', closeEditModal);
    $id('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') closeEditModal();
    });
    $id('edit-vimeoId').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveEditChanges();
    });
    $id('edit-videoName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $id('edit-vimeoId').focus();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if ($id('editModal').classList.contains('active')) closeEditModal();
            else if ($id('thumbModal').classList.contains('active')) closeThumbModal();
        }
    });

    // ===== INIT =====
    loadTextSettings();
    loadVideos();
})();
