document.addEventListener("DOMContentLoaded", () => {
    const chatHistory = document.getElementById("chat-history");
    const restartBtn = document.getElementById("restart-btn");

    const FEATURES = {
        gym: { name: "Gym Assistant (Kel_3)", icon: "💪", desc: "Menganalisis pose latihan Anda (squat, curl, push-up) & menghitung repetisi secara live." },
        epl: { name: "EPL Match Predictor (Kel_2)", icon: "🏆", desc: "Memproyeksikan probabilitas hasil pertandingan Liga Inggris berdasarkan performa sekuensial." },
        performance_ann: { name: "Soccer Performance Prediction (Kel_1 - ANN)", icon: "📊", desc: "Prediksi rating performa pemain sepak bola berdasarkan posisinya menggunakan model ANN." },
        gym: { name: "Gym Assistant (Kel_3)", icon: "💪", desc: "Mendeteksi pose latihan & menghitung repetisi secara live." },
        epl: { name: "EPL Match Predictor (Kel_2)", icon: "🏆", desc: "Memproyeksikan hasil pertandingan Liga Inggris." },
        performance_ann: { name: "Soccer Performance Prediction (Kel_1 - ANN)", icon: "📊", desc: "Prediksi rating pemain sepak bola berbasis ANN." },
        performance: { name: "Soccer Performance Prediction (Kel_5 - LSTM)", icon: "📈", desc: "Proyeksi karir pemain menggunakan model LSTM." },
        injury_cnn: { name: "Sport Injury Risk Prediction (Kel_4 - LSTM)", icon: "⚡", desc: "Deteksi risiko cedera atlet menggunakan LSTM." },
        injury: { name: "Sport Injury Risk Prediction (Kel_6 - ANN)", icon: "🏥", desc: "Prediksi kerawanan cedera berbasis data medis." },
        object: { name: "Soccer Object Detection (Kel_7)", icon: "🔍", desc: "Deteksi objek (bola, pemain, wasit) memakai YOLOv8." },
        tackle: { name: "Tackle Offence Prediction (Kel_8)", icon: "⚽", desc: "Klasifikasi pelanggaran tackle memakai LSTM." },
        event_cnn: { name: "Soccer Event Classifier (Kel_10 - CNN)", icon: "🎯", desc: "Klasifikasi peristiwa sepak bola dengan CNN." },
        event: { name: "Soccer Event Classifier (Kel_11 - MobileNet)", icon: "📸", desc: "Klasifikasi peristiwa sepak bola dengan MobileNetV2." }
    };

    let selectedFeature = null;
    let currentRoomId = localStorage.getItem("activeRoomId") || null;
    
    const sidebar = document.getElementById("chat-sidebar");
    const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
    const newChatBtn = document.getElementById("new-chat-btn");
    const roomsList = document.getElementById("rooms-list");

    initChatRooms();

    async function initChatRooms() {
        if (sidebarToggleBtn && sidebar) {
            sidebarToggleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                sidebar.classList.toggle("active");
            });
            document.addEventListener("click", (e) => {
                if (sidebar.classList.contains("active") && !sidebar.contains(e.target) && e.target !== sidebarToggleBtn) {
                    sidebar.classList.remove("active");
                }
            });
        }

        if (newChatBtn) {
            newChatBtn.addEventListener("click", () => {
                createNewRoom();
            });
        }

        await refreshRoomsList();

        if (currentRoomId) {
            await switchRoom(currentRoomId);
        } else {
            await createNewRoom();
        }
    }

    async function refreshRoomsList() {
        if (!roomsList) return;
        try {
            const res = await fetch("/api/chat/rooms");
            const rooms = await res.json();
            roomsList.innerHTML = "";
            rooms.forEach(room => {
                const roomItem = document.createElement("div");
                roomItem.className = `room-item ${room.id === currentRoomId ? 'active' : ''}`;
                roomItem.dataset.id = room.id;
                
                roomItem.innerHTML = `
                    <div class="room-title-wrapper">
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                        <span class="room-title-text" title="${escapeHtml(room.title)}">${escapeHtml(room.title)}</span>
                    </div>
                    <button class="room-delete-btn" title="Hapus Percakapan">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                `;

                roomItem.addEventListener("click", () => {
                    switchRoom(room.id);
                });

                const delBtn = roomItem.querySelector(".room-delete-btn");
                delBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    deleteRoom(room.id);
                });

                roomsList.appendChild(roomItem);
            });
        } catch (err) {
            console.error("Error fetching rooms:", err);
        }
    }

    async function createNewRoom(title = "Percakapan Baru") {
        try {
            const res = await fetch("/api/chat/rooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title })
            });
            const data = await res.json();
            if (data.success) {
                currentRoomId = data.room_id;
                localStorage.setItem("activeRoomId", currentRoomId);
                await refreshRoomsList();
                await switchRoom(currentRoomId);
            }
        } catch (err) {
            console.error("Error creating room:", err);
        }
    }

    async function deleteRoom(roomId) {
        if (!confirm("Apakah Anda yakin ingin menghapus percakapan ini?")) return;
        try {
            const res = await fetch(`/api/chat/rooms/${roomId}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                if (currentRoomId === roomId) {
                    currentRoomId = null;
                    localStorage.removeItem("activeRoomId");
                }
                await refreshRoomsList();
                const remaining = document.querySelectorAll(".room-item");
                if (remaining.length > 0) {
                    if (!currentRoomId) {
                        const nextId = remaining[0].dataset.id;
                        await switchRoom(nextId);
                    }
                } else {
                    await createNewRoom();
                }
            }
        } catch (err) {
            console.error("Error deleting room:", err);
        }
    }

    async function switchRoom(roomId) {
        currentRoomId = roomId;
        localStorage.setItem("activeRoomId", roomId);
        
        document.querySelectorAll(".room-item").forEach(item => {
            if (item.dataset.id === roomId) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        if (sidebar) sidebar.classList.remove("active");

        chatHistory.innerHTML = "";
        selectedFeature = null;

        try {
            const res = await fetch(`/api/chat/rooms/${roomId}/messages`);
            const messages = await res.json();

            if (messages.length === 0) {
                startChatFlow();
            } else {
                messages.forEach(msg => {
                    if (msg.sender === "user") {
                        appendUserBubbleDirect(msg.content);
                    } else {
                        appendSystemBubbleDirect(msg.content);
                        if (msg.metadata) {
                            reconstructVisualizations(msg.metadata.suffix || msg.metadata.chart_id, msg.metadata);
                        }
                    }
                });
            }
        } catch (err) {
            console.error("Error switching room:", err);
            startChatFlow();
        }
    }

    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function saveMessage(roomId, sender, content, metadata = null) {
        if (!roomId) return;
        try {
            await fetch(`/api/chat/rooms/${roomId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sender, content, metadata })
            });
        } catch (err) {
            console.error("Error saving message:", err);
        }
    }

    function reconstructVisualizations(suffix, data) {
        if (!data) return;
        setTimeout(() => {
            if (data.chart_id) {
                const chartCanvas = document.getElementById("chart-" + data.chart_id);
                if (chartCanvas) {
                    const ctx = chartCanvas.getContext('2d');
                    const labels = [...(data.actual_years || []), ...(data.pred_years || [])];
                    const actualData = [...(data.actual_ratings || []), ...Array((data.pred_ratings || []).length).fill(null)];
                    const predData = [
                        ...Array((data.actual_ratings || []).length - 1).fill(null),
                        (data.actual_ratings || [])[(data.actual_ratings || []).length - 1],
                        ...(data.pred_ratings || [])
                    ];
                    new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [
                                {
                                    label: 'Rating Historis',
                                    data: actualData,
                                    borderColor: '#3b82f6',
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    tension: 0.2,
                                    fill: true
                                },
                                {
                                    label: 'Proyeksi LSTM',
                                    data: predData,
                                    borderColor: '#10b981',
                                    borderDash: [5, 5],
                                    tension: 0.2,
                                    fill: false
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { labels: { color: '#e2e8f0' } }
                            },
                            scales: {
                                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' }, min: 40, max: 100 }
                            }
                        }
                    });
                }
            }

            if (data.file_type === "image" && data.spatial_points) {
                const fieldEl = document.getElementById("field-" + suffix);
                if (fieldEl) {
                    fieldEl.querySelectorAll('.object-dot').forEach(el => el.remove());
                    data.spatial_points.forEach(pt => {
                        const dot = document.createElement('div');
                        dot.className = 'object-dot';
                        dot.style.left = pt.x + '%';
                        dot.style.top = pt.y + '%';

                        if (pt.class === 'player') dot.classList.add('dot-player');
                        else if (pt.class === 'ball') dot.classList.add('dot-ball');
                        else if (pt.class === 'referee') dot.classList.add('dot-referee');
                        else if (pt.class === 'goalkeeper') dot.classList.add('dot-goalkeeper');

                        fieldEl.appendChild(dot);
                    });
                }
                const chartCanvas = document.getElementById("chart-" + suffix);
                if (chartCanvas) {
                    const ctx = chartCanvas.getContext('2d');
                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: ['BALL', 'KEEPER', 'PLAYER', 'REFEREE'],
                            datasets: [{
                                label: 'Detections',
                                data: [
                                    data.ball_count,
                                    data.goalkeeper_count,
                                    data.player_count,
                                    data.referee_count
                                ],
                                backgroundColor: ['rgba(200, 255, 0, 0.2)', 'rgba(255, 149, 0, 0.2)', 'rgba(0, 229, 255, 0.2)', 'rgba(255, 45, 85, 0.2)'],
                                borderColor: ['#C8FF00', '#FF9500', '#00E5FF', '#FF2D55'],
                                borderWidth: 1,
                                borderRadius: 4,
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                x: { ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                                y: { ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
                            }
                        }
                    });
                }
            }

            if (data.all_predictions && data.event && !data.chart_id) {
                const chartCanvas = document.getElementById("chart-" + suffix);
                if (chartCanvas) {
                    const ctx = chartCanvas.getContext('2d');
                    const events = Object.keys(data.all_predictions);
                    const scores = Object.values(data.all_predictions);

                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: events.map(e => e.replace('_', ' ')),
                            datasets: [{
                                label: 'Probabilitas (%)',
                                data: scores,
                                backgroundColor: events.map(e => e.toLowerCase() === data.event.toLowerCase() ? '#3b82f6' : 'rgba(255,255,255,0.15)'),
                                borderRadius: 4,
                                borderSkipped: false
                            }]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                x: { ticks: { color: '#9ca3af', font: { size: 9 } }, grid: { display: false } },
                                y: { ticks: { color: '#e2e8f0', font: { size: 10 } }, grid: { display: false } }
                            }
                        }
                    });
                }
            }
        }, 150);
    }

    if (restartBtn) {
        restartBtn.addEventListener("click", () => {
            createNewRoom();
        });
    }

    function startChatFlow() {
        appendSystemBubbleDirect("Halo! Saya adalah Asisten AI Olahraga Terpadu. Silakan pilih salah satu fitur deep learning di bawah ini untuk memulai analisis:");
        appendQuickReplyButtons();
    }

    function appendSystemBubbleDirect(htmlContent) {
        const bubble = document.createElement("div");
        bubble.className = "chat-bubble bubble-left";
        bubble.innerHTML = htmlContent;
        chatHistory.appendChild(bubble);
        scrollToBottom();
        return bubble;
    }

    function appendSystemBubble(htmlContent, metadata = null) {
        const bubble = appendSystemBubbleDirect(htmlContent);
        saveMessage(currentRoomId, "system", htmlContent, metadata);
        return bubble;
    }

    function appendUserBubbleDirect(text) {
        const bubble = document.createElement("div");
        bubble.className = "chat-bubble bubble-right";
        bubble.textContent = text;
        chatHistory.appendChild(bubble);
        scrollToBottom();
        return bubble;
    }

    function appendUserBubble(text) {
        appendUserBubbleDirect(text);
        saveMessage(currentRoomId, "user", text, null);
    }

    function appendLoaderBubble() {
        const bubble = document.createElement("div");
        bubble.className = "chat-bubble bubble-left loader-bubble";
        bubble.innerHTML = `
            <div class="loader-dots">
                <div class="loader-dot"></div>
                <div class="loader-dot"></div>
                <div class="loader-dot"></div>
            </div>
        `;
        chatHistory.appendChild(bubble);
        scrollToBottom();
        return bubble;
    }

    function removeLoader(loaderBubble) {
        if (loaderBubble && loaderBubble.parentNode) {
            loaderBubble.parentNode.removeChild(loaderBubble);
        }
    }

    function scrollToBottom() {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function appendQuickReplyButtons() {
        const container = document.createElement("div");
        container.className = "quick-reply-container";
        
        Object.entries(FEATURES).forEach(([key, value]) => {
            const btn = document.createElement("button");
            btn.className = "quick-reply-card";
            btn.innerHTML = `
                <div class="quick-reply-card-icon">${value.icon}</div>
                <div class="quick-reply-card-content">
                    <div class="quick-reply-card-title">${value.name}</div>
                    <div class="quick-reply-card-desc">${value.desc}</div>
                </div>
            `;
            btn.addEventListener("click", () => handleFeatureSelection(key, value.name));
            container.appendChild(btn);
        });

        chatHistory.appendChild(container);
        scrollToBottom();
    }

    async function handleFeatureSelection(featureKey, featureName) {
        try {
            const currentTitle = document.querySelector(`.room-item[data-id="${currentRoomId}"] .room-title-text`);
            if (currentTitle && currentTitle.textContent === "Percakapan Baru") {
                await fetch(`/api/chat/rooms/${currentRoomId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: featureName })
                });
                await refreshRoomsList();
            }
        } catch (err) {
            console.error("Error renaming room:", err);
        }

        // Clear all quick reply containers currently at the end
        const containers = document.querySelectorAll(".quick-reply-container");
        containers.forEach(c => c.remove());

        appendUserBubble(featureName);
        selectedFeature = featureKey;

        const loader = appendLoaderBubble();
        setTimeout(() => {
            removeLoader(loader);
            promptFeatureInput();
        }, 600);
    }

    // -------------------------------------------------------------
    // PROMPT FOR FEATURE INPUTS
    // -------------------------------------------------------------
    function promptFeatureInput() {
        const suffix = Math.random().toString(36).substr(2, 9);
        if (selectedFeature === "gym") {
            appendSystemBubble(`
                <div>
                    <strong>Gym Assistant</strong> menganalisis pose olahraga Anda (Squat, Push-up, Shoulder Press, Biceps Curl) dan menghitung repetisinya secara otomatis.<br><br>
                    Pilih salah satu metode input:
                    <div style="display:flex; gap:0.5rem; margin-top:1rem; margin-bottom:1rem;">
                        <button class="btn btn-primary btn-sm" id="btn-gym-webcam-${suffix}" style="padding:0.4rem 1rem; font-size:0.85rem;">Kamera Live (Webcam)</button>
                        <button class="btn btn-secondary btn-sm" id="btn-gym-upload-${suffix}" style="padding:0.4rem 1rem; font-size:0.85rem;">Unggah Video</button>
                    </div>
                    <div id="gym-input-area-${suffix}"></div>
                </div>
            `);

            const btnWebcam = document.getElementById(`btn-gym-webcam-${suffix}`);
            const btnUpload = document.getElementById(`btn-gym-upload-${suffix}`);
            const inputArea = document.getElementById(`gym-input-area-${suffix}`);

            btnWebcam.addEventListener("click", () => {
                if (window.gymPollInterval) {
                    clearInterval(window.gymPollInterval);
                }
                
                inputArea.innerHTML = `
                    <div style="margin-top:1rem; text-align:center;">
                        <div class="processed-media" style="border: 2px solid var(--primary); border-radius:12px; overflow:hidden; background:#000;">
                            <img src="/api/gym/video_feed?t=${Date.now()}" alt="Live Webcam Feed" style="width:100%; display:block;">
                        </div>
                        <div class="details-grid" style="margin-top:1rem; text-align:left;">
                            <div class="detail-item"><strong>Latihan:</strong> <span id="live-ex-${suffix}">—</span></div>
                            <div class="detail-item"><strong>Conf:</strong> <span id="live-conf-${suffix}">—</span></div>
                            <div class="detail-item"><strong>Repetisi:</strong> <span id="live-reps-${suffix}" style="font-size:1.2rem; color:var(--accent); font-weight:700;">0</span></div>
                            <div class="detail-item"><strong>Feedback:</strong> <span id="live-feedback-${suffix}">Ready</span></div>
                        </div>
                        <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                            <button class="btn btn-secondary btn-sm" id="btn-gym-reset-${suffix}" style="flex:1;">Reset Repetisi</button>
                            <button class="btn btn-danger btn-sm" id="btn-gym-stop-${suffix}" style="flex:1;">Hentikan Kamera</button>
                        </div>
                    </div>
                `;

                // Reset counter on start
                fetch("/api/gym/reset", { method: "POST" }).catch(console.error);

                // Polling status
                window.gymPollInterval = setInterval(() => {
                    const elEx = document.getElementById(`live-ex-${suffix}`);
                    if (!elEx) {
                        clearInterval(window.gymPollInterval);
                        return;
                    }
                    fetch("/api/gym/status")
                    .then(res => res.json())
                    .then(data => {
                        const elEx = document.getElementById(`live-ex-${suffix}`);
                        const elConf = document.getElementById(`live-conf-${suffix}`);
                        const elReps = document.getElementById(`live-reps-${suffix}`);
                        const elFeedback = document.getElementById(`live-feedback-${suffix}`);
                        if (elEx && elConf && elReps && elFeedback) {
                            elEx.textContent = data.exercise.toUpperCase();
                            elConf.textContent = data.confidence + "%";
                            elReps.textContent = data.reps;
                            elFeedback.textContent = data.feedback;
                        }
                    })
                    .catch(console.error);
                }, 500);

                // Reset button event
                document.getElementById(`btn-gym-reset-${suffix}`).addEventListener("click", () => {
                    fetch("/api/gym/reset", { method: "POST" })
                    .then(() => {
                        const elReps = document.getElementById(`live-reps-${suffix}`);
                        const elFeedback = document.getElementById(`live-feedback-${suffix}`);
                        if (elReps && elFeedback) {
                            elReps.textContent = "0";
                            elFeedback.textContent = "Reset Done";
                        }
                    });
                });

                // Stop button event
                document.getElementById(`btn-gym-stop-${suffix}`).addEventListener("click", () => {
                    clearInterval(window.gymPollInterval);
                    const img = inputArea.querySelector("img");
                    if (img) img.src = "";
                    inputArea.innerHTML = `<p style="font-size:0.9rem; color:var(--text-secondary); margin-top:1rem;">Kamera dihentikan.</p>`;
                    appendQuickReplyButtons();
                });
            });

            btnUpload.addEventListener("click", () => {
                if (window.gymPollInterval) {
                    clearInterval(window.gymPollInterval);
                }
                inputArea.innerHTML = `
                    <div class="upload-dropzone" id="gym-dropzone-${suffix}" style="margin-top:1rem;">
                        <svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                        <p>Klik atau Seret file video ke sini</p>
                        <input type="file" id="gym-file-input-${suffix}" accept="video/*" style="display:none">
                    </div>
                `;
                setupFileDropzone(`gym-dropzone-${suffix}`, `gym-file-input-${suffix}`, handleGymUpload);
            });

            // Trigger webcam by default
            btnWebcam.click();
        }
        else if (selectedFeature === "performance_ann") {
            appendSystemBubble(`
                <div>
                    <strong>Soccer Performance Prediction (ANN)</strong> memprediksi rating pemain berdasarkan statistik posisi (Kel_1).<br><br>
                    Pilih Posisi Pemain:
                    <select class="form-control" id="perf-ann-pos-${suffix}" style="margin-bottom:1rem;">
                        <option value="attacker">Attacker (Penyerang)</option>
                        <option value="midfielder">Midfielder (Gelandang)</option>
                        <option value="defender">Defender (Bek)</option>
                        <option value="gk">Goalkeeper (Kiper)</option>
                    </select>
                    <form class="bubble-form" id="perf-ann-form-${suffix}">
                        <div id="perf-ann-sliders-${suffix}"></div>
                        <button type="submit" class="btn btn-primary" style="margin-top:0.8rem; width:100%;">Prediksi Rating (ANN)</button>
                    </form>
                </div>
            `);
            const posSelect = document.getElementById(`perf-ann-pos-${suffix}`);
            const slidersDiv = document.getElementById(`perf-ann-sliders-${suffix}`);
            
            const featureSets = {
                attacker: [
                    { id: 'potential', label: 'Potential', val: 75 },
                    { id: 'finishing', label: 'Finishing', val: 70 },
                    { id: 'positioning', label: 'Positioning', val: 72 },
                    { id: 'shot_power', label: 'Shot Power', val: 68 },
                    { id: 'dribbling', label: 'Dribbling', val: 74 },
                    { id: 'ball_control', label: 'Ball Control', val: 73 },
                    { id: 'acceleration', label: 'Acceleration', val: 75 },
                    { id: 'sprint_speed', label: 'Sprint Speed', val: 76 },
                    { id: 'agility', label: 'Agility', val: 72 },
                    { id: 'reactions', label: 'Reactions', val: 70 },
                    { id: 'crossing', label: 'Crossing', val: 62 },
                    { id: 'heading_accuracy', label: 'Heading Accuracy', val: 60 },
                    { id: 'volleys', label: 'Volleys', val: 58 }
                ],
                midfielder: [
                    { id: 'potential', label: 'Potential', val: 76 },
                    { id: 'short_passing', label: 'Short Passing', val: 75 },
                    { id: 'long_passing', label: 'Long Passing', val: 70 },
                    { id: 'vision', label: 'Vision', val: 72 },
                    { id: 'ball_control', label: 'Ball Control', val: 74 },
                    { id: 'dribbling', label: 'Dribbling', val: 70 },
                    { id: 'stamina', label: 'Stamina', val: 75 },
                    { id: 'reactions', label: 'Reactions', val: 71 },
                    { id: 'crossing', label: 'Crossing', val: 68 },
                    { id: 'interceptions', label: 'Interceptions', val: 60 },
                    { id: 'standing_tackle', label: 'Standing Tackle', val: 58 },
                    { id: 'finishing', label: 'Finishing', val: 62 },
                    { id: 'positioning', label: 'Positioning', val: 65 }
                ],
                defender: [
                    { id: 'potential', label: 'Potential', val: 74 },
                    { id: 'standing_tackle', label: 'Standing Tackle', val: 75 },
                    { id: 'sliding_tackle', label: 'Sliding Tackle', val: 72 },
                    { id: 'marking', label: 'Marking', val: 74 },
                    { id: 'interceptions', label: 'Interceptions', val: 70 },
                    { id: 'heading_accuracy', label: 'Heading Accuracy', val: 68 },
                    { id: 'strength', label: 'Strength', val: 78 },
                    { id: 'aggression', label: 'Aggression', val: 75 },
                    { id: 'reactions', label: 'Reactions', val: 68 },
                    { id: 'jumping', label: 'Jumping', val: 72 }
                ],
                gk: [
                    { id: 'potential', label: 'Potential', val: 75 },
                    { id: 'gk_diving', label: 'GK Diving', val: 74 },
                    { id: 'gk_handling', label: 'GK Handling', val: 72 },
                    { id: 'gk_kicking', label: 'GK Kicking', val: 68 },
                    { id: 'gk_positioning', label: 'GK Positioning', val: 73 },
                    { id: 'gk_reflexes', label: 'GK Reflexes', val: 76 },
                    { id: 'reactions', label: 'Reactions', val: 70 }
                ]
            };

            function updateSliders() {
                const pos = posSelect.value;
                const list = featureSets[pos];
                let html = '<div class="sliders-grid">';
                list.forEach(f => {
                    html += renderSlider(f.id, f.label, f.val, suffix);
                });
                html += '</div>';
                slidersDiv.innerHTML = html;
            }

            posSelect.addEventListener("change", updateSliders);
            updateSliders();
            setupPerformanceAnnSubmit(suffix);
        }
        else if (selectedFeature === "injury_cnn") {
            appendSystemBubble(`
                <div>
                    <strong>Injury Risk Prediction (LSTM)</strong> memprediksi potensi cedera pemain berdasarkan parameter biomekanik (Kel_4).<br><br>
                    Isi statistik latihan Anda di bawah ini:
                    <form class="bubble-form" id="injury-cnn-form-${suffix}" style="margin-top:1rem;">
                        
                        <div class="injury-section-card">
                            <div class="injury-section-header">
                                <span class="injury-section-title">Demografis & Fisik</span>
                            </div>
                            <div class="sliders-grid">
                                <div class="form-group">
                                    <label for="inj-cnn-age-${suffix}">Usia (Tahun)</label>
                                    <input type="number" class="form-control" id="inj-cnn-age-${suffix}" name="Age" min="18" max="40" placeholder="18 – 40" required>
                                </div>
                                <div class="form-group">
                                    <label for="inj-cnn-gender-${suffix}">Jenis Kelamin</label>
                                    <select class="form-control" id="inj-cnn-gender-${suffix}" name="Gender" required>
                                        <option value="" disabled selected>-- Pilih --</option>
                                        <option value="1">Pria</option>
                                        <option value="0">Wanita</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="inj-cnn-height-${suffix}">Tinggi Badan (cm)</label>
                                    <input type="number" class="form-control" id="inj-cnn-height-${suffix}" name="Height_cm" placeholder="contoh: 175" required>
                                </div>
                                <div class="form-group">
                                    <label for="inj-cnn-weight-${suffix}">Berat Badan (kg)</label>
                                    <input type="number" class="form-control" id="inj-cnn-weight-${suffix}" name="Weight_kg" placeholder="contoh: 70" required>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label for="inj-cnn-bmi-${suffix}">BMI (Otomatis)</label>
                                    <input type="number" class="form-control" id="inj-cnn-bmi-${suffix}" name="BMI" placeholder="Dihitung otomatis" readonly style="background: rgba(37, 99, 235, 0.05); border-color: rgba(37, 99, 235, 0.2); color: var(--primary);">
                                </div>
                            </div>
                        </div>

                        <div class="injury-section-card" style="margin-top:0.8rem;">
                            <div class="injury-section-header">
                                <span class="injury-section-title">Aktivitas & Intensitas</span>
                            </div>
                            <div class="sliders-grid">
                                <div class="form-group">
                                    <label for="inj-cnn-freq-${suffix}">Frekuensi/Minggu</label>
                                    <input type="number" class="form-control" id="inj-cnn-freq-${suffix}" name="Training_Frequency" min="1" max="7" placeholder="1 – 7 kali" required>
                                </div>
                                <div class="form-group">
                                    <label for="inj-cnn-duration-${suffix}">Durasi (Menit)</label>
                                    <input type="number" class="form-control" id="inj-cnn-duration-${suffix}" name="Training_Duration" min="30" max="180" placeholder="30 – 180" required>
                                </div>
                                <div class="form-group">
                                    <label for="inj-cnn-warmup-${suffix}">Pemanasan (Menit)</label>
                                    <input type="number" class="form-control" id="inj-cnn-warmup-${suffix}" name="Warmup_Time" min="0" max="30" placeholder="0 – 30" required>
                                </div>
                                <div class="form-group">
                                    <label for="inj-cnn-intensity-${suffix}">Intensitas Latihan (1-10)</label>
                                    <input type="number" class="form-control" id="inj-cnn-intensity-${suffix}" name="Training_Intensity" step="any" min="1" max="10" placeholder="skala 1 – 10" required>
                                </div>
                            </div>
                        </div>

                        <div class="injury-section-card" style="margin-top:0.8rem;">
                            <div class="injury-section-header">
                                <span class="injury-section-title">Medis & Kesehatan</span>
                            </div>
                            <div class="sliders-grid">
                                <div class="form-group">
                                    <label for="inj-cnn-sleep-${suffix}">Jam Tidur</label>
                                    <input type="number" class="form-control" id="inj-cnn-sleep-${suffix}" name="Sleep_Hours" step="any" min="4" max="10" placeholder="4 – 10" required>
                                </div>
                                <div class="form-group">
                                    <label for="inj-cnn-flex-${suffix}">Skor Fleksibilitas</label>
                                    <input type="number" class="form-control" id="inj-cnn-flex-${suffix}" name="Flexibility_Score" step="any" min="0" max="100" placeholder="0 – 100" required>
                                </div>
                                <div class="form-group">
                                    <label for="inj-cnn-asym-${suffix}">Asimetri Otot (%)</label>
                                    <input type="number" class="form-control" id="inj-cnn-asym-${suffix}" name="Muscle_Asymmetry" step="any" min="0" max="100" placeholder="0 – 100" required>
                                </div>
                                <div class="form-group">
                                    <label for="inj-cnn-recov-${suffix}">Waktu Recovery (s)</label>
                                    <input type="number" class="form-control" id="inj-cnn-recov-${suffix}" name="Recovery_Time" min="30" max="150" placeholder="30 – 150" required>
                                </div>
                                <div class="form-group">
                                    <label for="inj-cnn-history-${suffix}">Riwayat Cedera (0-5)</label>
                                    <input type="number" class="form-control" id="inj-cnn-history-${suffix}" name="Injury_History" min="0" max="5" placeholder="0 – 5" required>
                                </div>
                                <div class="form-group">
                                    <label for="inj-cnn-stress-${suffix}">Tingkat Stres (1-10)</label>
                                    <input type="number" class="form-control" id="inj-cnn-stress-${suffix}" name="Stress_Level" min="1" max="10" placeholder="skala 1 – 10" required>
                                </div>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary" style="margin-top:1rem; width:100%;">Hitung Risiko Cedera (LSTM)</button>
                    </form>
                </div>
            `);
            const heightInp = document.getElementById(`inj-cnn-height-${suffix}`);
            const weightInp = document.getElementById(`inj-cnn-weight-${suffix}`);
            const bmiInp = document.getElementById(`inj-cnn-bmi-${suffix}`);
            
            function calcBmi() {
                const h = parseFloat(heightInp.value);
                const w = parseFloat(weightInp.value);
                if (h > 0 && w > 0) {
                    bmiInp.value = (w / ((h / 100) ** 2)).toFixed(2);
                } else {
                    bmiInp.value = '';
                }
            }
            if (heightInp && weightInp) {
                heightInp.addEventListener("input", calcBmi);
                weightInp.addEventListener("input", calcBmi);
            }
            setupInjuryCnnSubmit(suffix);
        }
        else if (selectedFeature === "event_cnn") {
            appendSystemBubble(`
                <div>
                    <strong>Soccer Event Classifier (CNN)</strong> mengklasifikasi peristiwa pertandingan sepak bola dari sebuah foto menggunakan custom CNN model (Kel_10).<br><br>
                    Silakan unggah foto aksi momen pertandingan sepak bola:
                    <div class="upload-dropzone" id="event-cnn-dropzone-${suffix}">
                        <svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        <p>Klik atau Seret file foto ke sini</p>
                        <input type="file" id="event-cnn-file-input-${suffix}" accept="image/*" style="display:none">
                    </div>
                </div>
            `);
            setupFileDropzone(`event-cnn-dropzone-${suffix}`, `event-cnn-file-input-${suffix}`, (file) => handleEventCnnUpload(file, suffix));
        }
        else if (selectedFeature === "epl") {
            appendSystemBubble(`
                <div>
                    <strong>EPL Match Predictor</strong> memproyeksikan peluang hasil pertandingan Liga Utama Inggris (EPL) berikutnya untuk tim pilihan Anda menggunakan model LSTM.<br><br>
                    <form class="bubble-form" id="epl-form-${suffix}" style="margin-top:1rem;">
                        <div class="form-group">
                            <label for="epl-team-select-${suffix}">Pilih Tim Premier League:</label>
                            <select class="form-control" id="epl-team-select-${suffix}" name="team" required>
                                <option value="" disabled selected>Memuat daftar tim...</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="btn-epl-predict-${suffix}" style="margin-top:1rem; width:100%;" disabled>Prediksi Pertandingan</button>
                    </form>
                </div>
            `);
            
            const selectEl = document.getElementById(`epl-team-select-${suffix}`);
            const btnPredict = document.getElementById(`btn-epl-predict-${suffix}`);
            
            fetch("/api/epl/teams")
            .then(res => res.json())
            .then(teams => {
                if (selectEl) {
                    selectEl.innerHTML = '<option value="" disabled selected>— Pilih Tim —</option>';
                    teams.forEach(t => {
                        const opt = document.createElement("option");
                        opt.value = t;
                        opt.textContent = t;
                        selectEl.appendChild(opt);
                    });
                    btnPredict.disabled = false;
                }
            })
            .catch(err => {
                if (selectEl) {
                    selectEl.innerHTML = '<option value="" disabled selected>Gagal memuat tim</option>';
                }
            });
            
            setupEplSubmit(suffix);
        }
        else if (selectedFeature === "performance") {
            appendSystemBubble(`
                <div>
                    <strong>Soccer Performance Prediction</strong> memproyeksikan rating keseluruhan pemain menggunakan model LSTM.<br><br>
                    Pilih salah satu metode input:
                    <div style="display:flex; gap:0.5rem; margin-top:1rem; margin-bottom:1rem;">
                        <button class="btn btn-primary btn-sm" id="btn-perf-search-${suffix}" style="padding:0.4rem 1rem; font-size:0.85rem;">Cari dari Database</button>
                        <button class="btn btn-secondary btn-sm" id="btn-perf-manual-${suffix}" style="padding:0.4rem 1rem; font-size:0.85rem;">Input Atribut Manual</button>
                    </div>
                    <div id="perf-input-area-${suffix}"></div>
                </div>
            `);

            const btnSearch = document.getElementById(`btn-perf-search-${suffix}`);
            const btnManual = document.getElementById(`btn-perf-manual-${suffix}`);
            const inputArea = document.getElementById(`perf-input-area-${suffix}`);

            btnSearch.addEventListener("click", () => {
                inputArea.innerHTML = `
                    <div class="form-group" style="position:relative;">
                        <label for="player-search-${suffix}">Nama Pemain (Database SQLite):</label>
                        <input type="text" class="form-control" id="player-search-${suffix}" placeholder="Ketik nama pemain, misal: Lionel Messi, Ronaldo..." autocomplete="off">
                        <div class="autocomplete-suggestions" id="player-suggestions-${suffix}" style="display:none;"></div>
                    </div>
                `;
                setupPlayerAutocomplete(suffix);
            });

            btnManual.addEventListener("click", () => {
                inputArea.innerHTML = `
                    <form class="bubble-form" id="perf-manual-form-${suffix}">
                        <p style="font-size:0.85rem; color:var(--text-secondary);">Geser slider untuk menyesuaikan statistik (0-99):</p>
                        <div class="sliders-grid">
                            ${renderSlider("potential", "Potential (Potensi)", 75, suffix)}
                            ${renderSlider("reactions", "Reactions (Reaksi)", 70, suffix)}
                            ${renderSlider("ball_control", "Ball Control", 70, suffix)}
                            ${renderSlider("dribbling", "Dribbling", 65, suffix)}
                            ${renderSlider("crossing", "Crossing", 60, suffix)}
                            ${renderSlider("finishing", "Finishing", 60, suffix)}
                            ${renderSlider("short_passing", "Short Passing", 68, suffix)}
                            ${renderSlider("long_passing", "Long Passing", 62, suffix)}
                            ${renderSlider("sprint_speed", "Sprint Speed", 72, suffix)}
                            ${renderSlider("stamina", "Stamina", 75, suffix)}
                        </div>
                        <button type="submit" class="btn btn-primary" style="margin-top:0.5rem; width:100%; font-size:0.9rem;">Prediksi Rating Pemain</button>
                    </form>
                `;
                setupPerformanceManualSubmit(suffix);
            });

            btnSearch.click(); // trigger search layout as default
        }
        else if (selectedFeature === "injury") {
            appendSystemBubble(`
                <div>
                    <strong>Injury Risk Prediction</strong> memprediksi risiko cedera berdasarkan parameter latihan Anda menggunakan model ANN.<br><br>
                    Isi statistik latihan Anda di bawah ini:
                    <form class="bubble-form" id="injury-form-${suffix}" style="margin-top:1rem;">
                        
                        <!-- Section 1: Demografis & Fisik -->
                        <div class="injury-section-card">
                            <div class="injury-section-header">
                                <span class="injury-section-title">Demografis & Fisik</span>
                            </div>
                            <div class="sliders-grid">
                                <div class="form-group">
                                    <label for="injury-age-${suffix}">Usia (Tahun)</label>
                                    <input type="number" class="form-control" id="injury-age-${suffix}" name="Age" min="18" max="40" placeholder="18 – 40" required>
                                </div>
                                <div class="form-group">
                                    <label for="injury-gender-${suffix}">Jenis Kelamin</label>
                                    <select class="form-control" id="injury-gender-${suffix}" name="Gender" required>
                                        <option value="" disabled selected>-- Pilih --</option>
                                        <option value="1">Pria</option>
                                        <option value="0">Wanita</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="injury-height-${suffix}">Tinggi Badan (cm)</label>
                                    <input type="number" class="form-control" id="injury-height-${suffix}" name="Height_cm" placeholder="contoh: 170" required>
                                </div>
                                <div class="form-group">
                                    <label for="injury-weight-${suffix}">Berat Badan (kg)</label>
                                    <input type="number" class="form-control" id="injury-weight-${suffix}" name="Weight_kg" placeholder="contoh: 65" required>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label for="injury-bmi-${suffix}">BMI (Otomatis)</label>
                                    <input type="number" class="form-control" id="injury-bmi-${suffix}" name="BMI" placeholder="Dihitung otomatis" readonly style="background: rgba(37, 99, 235, 0.05); border-color: rgba(37, 99, 235, 0.2); color: var(--primary);">
                                </div>
                            </div>
                        </div>

                        <!-- Section 2: Perilaku & Intensitas Latihan -->
                        <div class="injury-section-card">
                            <div class="injury-section-header">
                                <span class="injury-section-title">Perilaku & Intensitas Latihan</span>
                            </div>
                            <div class="sliders-grid">
                                <div class="form-group">
                                    <label for="injury-freq-${suffix}">Frekuensi Latihan/Minggu</label>
                                    <input type="number" class="form-control" id="injury-freq-${suffix}" name="Training_Frequency" min="1" max="7" placeholder="1 – 7 kali" required>
                                </div>
                                <div class="form-group">
                                    <label for="injury-duration-${suffix}">Durasi Latihan (Menit)</label>
                                    <input type="number" class="form-control" id="injury-duration-${suffix}" name="Training_Duration" min="30" max="180" placeholder="30 – 180 menit" required>
                                </div>
                                <div class="form-group">
                                    <label for="injury-warmup-${suffix}">Waktu Pemanasan (Menit)</label>
                                    <input type="number" class="form-control" id="injury-warmup-${suffix}" name="Warmup_Time" min="0" max="30" placeholder="0 – 30 menit" required>
                                </div>
                                <div class="form-group">
                                    <label for="injury-intensity-${suffix}">Intensitas Latihan (1-10)</label>
                                    <input type="number" class="form-control" id="injury-intensity-${suffix}" name="Training_Intensity" step="any" min="1" max="10" placeholder="skala 1 – 10" required>
                                </div>
                            </div>
                        </div>

                        <!-- Section 3: Indikator Fisiologis & Medis -->
                        <div class="injury-section-card">
                            <div class="injury-section-header">
                                <span class="injury-section-title">Indikator Fisiologis & Medis</span>
                            </div>
                            <div class="sliders-grid">
                                <div class="form-group">
                                    <label for="injury-sleep-${suffix}">Jam Tidur Rata-rata</label>
                                    <input type="number" class="form-control" id="injury-sleep-${suffix}" name="Sleep_Hours" step="any" min="4" max="10" placeholder="4 – 10 jam/hari" required>
                                </div>
                                <div class="form-group">
                                    <label for="injury-flexibility-${suffix}">Skor Fleksibilitas (0-100)</label>
                                    <input type="number" class="form-control" id="injury-flexibility-${suffix}" name="Flexibility_Score" step="any" min="0" max="100" placeholder="0 – 100" required>
                                </div>
                                <div class="form-group">
                                    <label for="injury-recovery-${suffix}">Pemulihan Detak Jantung</label>
                                    <input type="number" class="form-control" id="injury-recovery-${suffix}" name="Recovery_Time" min="30" max="150" placeholder="30 – 150 detik" required>
                                </div>
                                <div class="form-group">
                                    <label for="injury-history-${suffix}">Riwayat Cedera (0-5)</label>
                                    <input type="number" class="form-control" id="injury-history-${suffix}" name="Injury_History" min="0" max="5" placeholder="0 – 5" required>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label for="injury-stress-${suffix}">Tingkat Stres (1-10)</label>
                                    <input type="number" class="form-control" id="injury-stress-${suffix}" name="Stress_Level" min="1" max="10" placeholder="skala 1 – 10" required>
                                </div>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary" style="margin-top:1rem; width:100%;">Hitung Risiko Cedera</button>
                    </form>
                </div>
            `);
            
            // Add BMI calculation event listeners
            const heightInp = document.getElementById(`injury-height-${suffix}`);
            const weightInp = document.getElementById(`injury-weight-${suffix}`);
            const bmiInp = document.getElementById(`injury-bmi-${suffix}`);
            
            function calcBmi() {
                const h = parseFloat(heightInp.value);
                const w = parseFloat(weightInp.value);
                if (h > 0 && w > 0) {
                    bmiInp.value = (w / ((h / 100) ** 2)).toFixed(2);
                } else {
                    bmiInp.value = '';
                }
            }
            if (heightInp && weightInp) {
                heightInp.addEventListener("input", calcBmi);
                weightInp.addEventListener("input", calcBmi);
            }
            
            setupInjurySubmit(suffix);
        }
        else if (selectedFeature === "object") {
            appendSystemBubble(`
                <div>
                    <strong>Soccer Object Detection</strong> mendeteksi letak bola, pemain, kiper, dan wasit dalam foto atau video menggunakan YOLOv8.<br><br>
                    Silakan unggah foto atau video pertandingan sepak bola Anda:
                    <div class="upload-dropzone" id="obj-dropzone-${suffix}">
                        <svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        <p>Klik atau Seret file foto/video ke sini</p>
                        <input type="file" id="obj-file-input-${suffix}" accept="image/*,video/*" style="display:none">
                    </div>
                    <div class="form-group" style="margin-top:1rem;">
                        <label for="obj-confidence-${suffix}">Confidence Threshold: <span id="conf-val-${suffix}">0.4</span></label>
                        <input type="range" class="form-control" id="obj-confidence-${suffix}" min="0.1" max="0.9" step="0.05" value="0.4">
                    </div>
                </div>
            `);
            const confSlider = document.getElementById(`obj-confidence-${suffix}`);
            const confVal = document.getElementById(`conf-val-${suffix}`);
            confSlider.addEventListener("input", (e) => {
                confVal.textContent = e.target.value;
            });
            setupFileDropzone(`obj-dropzone-${suffix}`, `obj-file-input-${suffix}`, (file) => handleObjectUpload(file, suffix));
        }
        else if (selectedFeature === "tackle") {
            appendSystemBubble(`
                <div>
                    <strong>Tackle Offence Prediction</strong> memprediksi apakah sebuah tackle melanggar peraturan (Offence) atau bersih (No Offence).<br><br>
                    Pilih tipe input untuk menganalisis tackle:
                    <div style="display:flex; gap:0.5rem; margin-top:1rem; margin-bottom:1rem;">
                        <button class="btn btn-primary btn-sm" id="btn-tackle-video-${suffix}" style="padding:0.4rem 1rem; font-size:0.85rem;">Unggah Video (Kel_8)</button>
                        <button class="btn btn-secondary btn-sm" id="btn-tackle-image-${suffix}" style="padding:0.4rem 1rem; font-size:0.85rem;">Unggah Gambar (Kel_9)</button>
                    </div>
                    <div id="tackle-input-area-${suffix}"></div>
                </div>
            `);

            const btnVideo = document.getElementById(`btn-tackle-video-${suffix}`);
            const btnImage = document.getElementById(`btn-tackle-image-${suffix}`);
            const inputArea = document.getElementById(`tackle-input-area-${suffix}`);

            btnVideo.addEventListener("click", () => {
                inputArea.innerHTML = `
                    <form id="tackle-form-${suffix}" class="bubble-form" style="margin-top:1rem;">
                        <div class="form-group">
                            <label>Klip 1 (Kamera Live / Utama - .mp4):</label>
                            <input type="file" class="form-control" name="clip_0" accept="video/mp4" required>
                        </div>
                        <div class="form-group">
                            <label>Klip 2 (Highlight 1 - Opsional):</label>
                            <input type="file" class="form-control" name="clip_1" accept="video/mp4">
                        </div>
                        <div class="form-group">
                            <label>Klip 3 (Highlight 2 - Opsional):</label>
                            <input type="file" class="form-control" name="clip_2" accept="video/mp4">
                        </div>
                        <button type="submit" class="btn btn-primary" style="margin-top:0.8rem; width:100%;">Analisis Tackle Video (Kel_8)</button>
                    </form>
                `;
                setupTackleSubmit(suffix);
            });

            btnImage.addEventListener("click", () => {
                inputArea.innerHTML = `
                    <div class="upload-dropzone" id="tackle-image-dropzone-${suffix}" style="margin-top:1rem;">
                        <svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        <p>Klik atau Seret file foto tackle ke sini</p>
                        <input type="file" id="tackle-image-file-input-${suffix}" accept="image/*" style="display:none">
                    </div>
                `;
                setupFileDropzone(`tackle-image-dropzone-${suffix}`, `tackle-image-file-input-${suffix}`, (file) => handleTackleImageUpload(file, suffix));
            });

            // Default to video mode
            btnVideo.click();
        }
        else if (selectedFeature === "event") {
            appendSystemBubble(`
                <div>
                    <strong>Soccer Event Classifier</strong> mengklasifikasi jenis peristiwa pertandingan sepak bola (Penalty kick, substitute, Corner Kick, Red/Yellow Card, Free Kick, dll) dari sebuah foto.<br><br>
                    Silakan unggah foto aksi momen pertandingan sepak bola:
                    <div class="upload-dropzone" id="event-dropzone-${suffix}">
                        <svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        <p>Klik atau Seret file foto ke sini</p>
                        <input type="file" id="event-file-input-${suffix}" accept="image/*" style="display:none">
                    </div>
                </div>
            `);
            setupFileDropzone(`event-dropzone-${suffix}`, `event-file-input-${suffix}`, handleEventUpload);
        }
    }

    function renderSlider(id, label, defaultVal, suffix, min=0, max=99, step=1) {
        const uniqueId = suffix ? `${id}-${suffix}` : id;
        const valId = suffix ? `val-${id}-${suffix}` : `val-${id}`;
        return `
            <div class="slider-container">
                <div class="slider-label-row">
                    <label for="${uniqueId}">${label}</label>
                    <span id="${valId}">${defaultVal}</span>
                </div>
                <input type="range" id="${uniqueId}" name="${id}" min="${min}" max="${max}" step="${step}" value="${defaultVal}" 
                    oninput="document.getElementById('${valId}').textContent = this.value">
            </div>
        `;
    }

    // -------------------------------------------------------------
    // FILE DRAG AND DROP SETUP
    // -------------------------------------------------------------
    function setupFileDropzone(zoneId, inputId, uploadCallback) {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);

        if (!zone || !input) return;

        zone.addEventListener("click", () => input.click());

        zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            zone.classList.add("dragover");
        });

        zone.addEventListener("dragleave", () => {
            zone.classList.remove("dragover");
        });

        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.classList.remove("dragover");
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadCallback(files[0]);
            }
        });

        input.addEventListener("change", (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                uploadCallback(files[0]);
            }
        });
    }

    // -------------------------------------------------------------
    // 1. GYM ASSISTANT SUBMIT
    // -------------------------------------------------------------
    function handleGymUpload(file) {
        appendUserBubble(`Mengunggah video latihan: ${file.name}`);
        const loader = appendLoaderBubble();

        const formData = new FormData();
        formData.append("video", file);

        fetch("/api/predict/gym_assistant", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            removeLoader(loader);
            if (data.error) {
                appendSystemBubble(`❌ Gagal memproses video: ${data.error}`);
            } else {
                appendSystemBubble(data.html, data);
            }
            appendQuickReplyButtons();
        })
        .catch(err => {
            removeLoader(loader);
            appendSystemBubble(`❌ Terjadi kesalahan server: ${err.message}`);
            appendQuickReplyButtons();
        });
    }

    // -------------------------------------------------------------
    // 2. SOCCER PERFORMANCE SUBMITS
    // -------------------------------------------------------------
    function setupPlayerAutocomplete(suffix) {
        const input = document.getElementById(`player-search-${suffix}`);
        const suggestionsBox = document.getElementById(`player-suggestions-${suffix}`);

        if (!input || !suggestionsBox) return;

        input.addEventListener("input", () => {
            const val = input.value.trim();
            if (val.length < 2) {
                suggestionsBox.style.display = "none";
                return;
            }

            fetch(`/api/search_players?q=${encodeURIComponent(val)}`)
            .then(res => res.json())
            .then(players => {
                if (players.length === 0) {
                    suggestionsBox.style.display = "none";
                    return;
                }
                suggestionsBox.innerHTML = "";
                players.forEach(p => {
                    const div = document.createElement("div");
                    div.className = "autocomplete-suggestion";
                    div.textContent = p.name;
                    div.addEventListener("click", () => {
                        input.value = p.name;
                        suggestionsBox.style.display = "none";
                        handlePlayerSubmit(p.id, p.name);
                    });
                    suggestionsBox.appendChild(div);
                });
                suggestionsBox.style.display = "block";
            })
            .catch(() => {});
        });

        document.addEventListener("click", (e) => {
            if (e.target !== input) {
                suggestionsBox.style.display = "none";
            }
        });
    }

    function handlePlayerSubmit(playerId, playerName) {
        appendUserBubble(`Memprediksi karir pemain: ${playerName}`);
        const loader = appendLoaderBubble();

        fetch(`/api/predict/performance_player/${playerId}?years=5`)
        .then(res => res.json())
        .then(data => {
            removeLoader(loader);
            if (data.error) {
                appendSystemBubble(`❌ Gagal memproyeksikan performa: ${data.error}`);
            } else {
                appendSystemBubble(data.html, data);
                
                // Render Chart.js
                setTimeout(() => {
                    const ctx = document.getElementById("chart-" + data.chart_id).getContext('2d');
                    
                    const labels = [...data.actual_years, ...data.pred_years];
                    const actualData = [...data.actual_ratings, ...Array(data.pred_ratings.length).fill(null)];
                    
                    const predData = [
                        ...Array(data.actual_ratings.length - 1).fill(null),
                        data.actual_ratings[data.actual_ratings.length - 1],
                        ...data.pred_ratings
                    ];

                    new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [
                                {
                                    label: 'Rating Historis',
                                    data: actualData,
                                    borderColor: '#3b82f6',
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    tension: 0.2,
                                    fill: true
                                },
                                {
                                    label: 'Proyeksi LSTM',
                                    data: predData,
                                    borderColor: '#10b981',
                                    borderDash: [5, 5],
                                    tension: 0.2,
                                    fill: false
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { labels: { color: '#e2e8f0' } }
                            },
                            scales: {
                                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' }, min: 40, max: 100 }
                            }
                        }
                    });
                }, 100);
            }
            appendQuickReplyButtons();
        })
        .catch(err => {
            removeLoader(loader);
            appendSystemBubble(`❌ Kesalahan memproses API: ${err.message}`);
            appendQuickReplyButtons();
        });
    }

    function setupPerformanceManualSubmit(suffix) {
        const form = document.getElementById(`perf-manual-form-${suffix}`);
        if (!form) return;

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            appendUserBubble("Mengirim statistik parameter manual");
            const loader = appendLoaderBubble();

            const values = {};
            const inputs = form.querySelectorAll("input[type='range']");
            inputs.forEach(i => {
                values[i.name] = parseInt(i.value);
            });

            fetch("/api/predict/performance_manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            })
            .then(res => res.json())
            .then(data => {
                removeLoader(loader);
                if (data.error) {
                    appendSystemBubble(`❌ Gagal memprediksi rating: ${data.error}`);
                } else {
                    appendSystemBubble(data.html, data);
                }
                appendQuickReplyButtons();
            })
            .catch(err => {
                removeLoader(loader);
                appendSystemBubble(`❌ Terjadi kesalahan: ${err.message}`);
                appendQuickReplyButtons();
            });
        });
    }

    // -------------------------------------------------------------
    // 3. SPORT INJURY RISK SUBMIT
    // -------------------------------------------------------------
    function setupInjurySubmit(suffix) {
        const form = document.getElementById(`injury-form-${suffix}`);
        if (!form) return;

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            appendUserBubble("Mengirim parameter data fisiologis");
            const loader = appendLoaderBubble();

            const values = {};
            const inputs = form.querySelectorAll("input");
            inputs.forEach(i => {
                if (i.value !== "") {
                    values[i.name] = parseFloat(i.value);
                }
            });
            const selects = form.querySelectorAll("select");
            selects.forEach(s => {
                values[s.name] = parseInt(s.value);
            });

            fetch("/api/predict/injury_risk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            })
            .then(res => res.json())
            .then(data => {
                removeLoader(loader);
                if (data.error) {
                    appendSystemBubble(`❌ Gagal memprediksi risiko cedera: ${data.error}`);
                } else {
                    appendSystemBubble(data.html, data);
                }
                appendQuickReplyButtons();
            })
            .catch(err => {
                removeLoader(loader);
                appendSystemBubble(`❌ Kesalahan server: ${err.message}`);
                appendQuickReplyButtons();
            });
        });
    }

    // -------------------------------------------------------------
    // 4. SOCCER OBJECT DETECTION SUBMIT
    // -------------------------------------------------------------
    function handleObjectUpload(file, suffix) {
        appendUserBubble(`Mengunggah file deteksi objek: ${file.name}`);
        const loader = appendLoaderBubble();

        const conf = document.getElementById(`obj-confidence-${suffix}`).value;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("confidence", conf);

        fetch("/api/predict/object_detection", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            removeLoader(loader);
            if (data.error) {
                appendSystemBubble(`❌ Gagal mendeteksi objek: ${data.error}`);
            } else {
                appendSystemBubble(data.html, data);
                
                if (data.file_type === "image") {
                    setTimeout(() => {
                        const fieldEl = document.getElementById("field-" + data.suffix);
                        if (fieldEl && data.spatial_points) {
                            data.spatial_points.forEach(pt => {
                                const dot = document.createElement('div');
                                dot.className = 'object-dot';
                                dot.style.left = pt.x + '%';
                                dot.style.top = pt.y + '%';

                                if (pt.class === 'player') dot.classList.add('dot-player');
                                else if (pt.class === 'ball') dot.classList.add('dot-ball');
                                else if (pt.class === 'referee') dot.classList.add('dot-referee');
                                else if (pt.class === 'goalkeeper') dot.classList.add('dot-goalkeeper');

                                fieldEl.appendChild(dot);
                            });
                        }

                        const chartCanvas = document.getElementById("chart-" + data.suffix);
                        if (chartCanvas) {
                            const ctx = chartCanvas.getContext('2d');
                            new Chart(ctx, {
                                type: 'bar',
                                data: {
                                    labels: ['BALL', 'KEEPER', 'PLAYER', 'REFEREE'],
                                    datasets: [{
                                        label: 'Detections',
                                        data: [
                                            data.ball_count,
                                            data.goalkeeper_count,
                                            data.player_count,
                                            data.referee_count
                                        ],
                                        backgroundColor: ['rgba(200, 255, 0, 0.2)', 'rgba(255, 149, 0, 0.2)', 'rgba(0, 229, 255, 0.2)', 'rgba(255, 45, 85, 0.2)'],
                                        borderColor: ['#C8FF00', '#FF9500', '#00E5FF', '#FF2D55'],
                                        borderWidth: 1,
                                        borderRadius: 4,
                                    }]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { display: false }
                                    },
                                    scales: {
                                        x: {
                                            ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } },
                                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                                        },
                                        y: {
                                            ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } },
                                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                                        }
                                    }
                                }
                            });
                        }
                    }, 100);
                }
            }
            appendQuickReplyButtons();
        })
        .catch(err => {
            removeLoader(loader);
            appendSystemBubble(`❌ Kesalahan server: ${err.message}`);
            appendQuickReplyButtons();
        });
    }

    // -------------------------------------------------------------
    // 5. TACKLE OFFENCE SUBMIT
    // -------------------------------------------------------------
    function setupTackleSubmit(suffix) {
        const form = document.getElementById(`tackle-form-${suffix}`);
        if (!form) return;

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            appendUserBubble("Mengunggah video klip tackle");
            const loader = appendLoaderBubble();

            const formData = new FormData(form);

            fetch("/api/predict/tackle_offence", {
                method: "POST",
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                removeLoader(loader);
                if (data.error || !data.success) {
                    appendSystemBubble(`❌ Gagal menganalisis tackle: ${data.error || "Format tidak valid"}`);
                } else {
                    appendSystemBubble(data.html, data);
                }
                appendQuickReplyButtons();
            })
            .catch(err => {
                removeLoader(loader);
                appendSystemBubble(`❌ Kesalahan server: ${err.message}`);
                appendQuickReplyButtons();
            });
        });
    }

    function handleTackleImageUpload(file, suffix) {
        appendUserBubble(`Mengunggah gambar tackle: ${file.name}`);
        const loader = appendLoaderBubble();

        const formData = new FormData();
        formData.append("file", file);

        fetch("/api/predict/tackle_image", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            removeLoader(loader);
            if (data.error || !data.success) {
                appendSystemBubble(`❌ Gagal menganalisis gambar tackle: ${data.error || "Format salah"}`);
            } else {
                appendSystemBubble(data.html, data);
            }
            appendQuickReplyButtons();
        })
        .catch(err => {
            removeLoader(loader);
            appendSystemBubble(`❌ Kesalahan server: ${err.message}`);
            appendQuickReplyButtons();
        });
    }

    // -------------------------------------------------------------
    // 6. SOCCER EVENT SUBMIT
    // -------------------------------------------------------------
    function handleEventUpload(file) {
        appendUserBubble(`Mengunggah gambar event: ${file.name}`);
        const loader = appendLoaderBubble();

        const formData = new FormData();
        formData.append("file", file);

        fetch("/api/predict/soccer_event", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            removeLoader(loader);
            if (data.error || !data.success) {
                appendSystemBubble(`❌ Gagal menganalisis event gambar: ${data.error || "Format salah"}`);
            } else {
                appendSystemBubble(data.html, data);

                // Render Chart.js Horizontal Bar Chart
                setTimeout(() => {
                    const ctx = document.getElementById("chart-" + data.suffix).getContext('2d');
                    
                    const events = Object.keys(data.all_predictions);
                    const scores = Object.values(data.all_predictions);

                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: events.map(e => e.replace('_', ' ')),
                            datasets: [{
                                label: 'Probabilitas (%)',
                                data: scores,
                                backgroundColor: events.map(e => e.toLowerCase() === data.event.toLowerCase() ? '#3b82f6' : 'rgba(255,255,255,0.15)'),
                                borderRadius: 4,
                                borderSkipped: false
                            }]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' }, max: 100 },
                                y: { ticks: { color: '#f3f4f6' }, grid: { display: false } }
                            }
                        }
                    });
                }, 100);
            }
            appendQuickReplyButtons();
        })
        .catch(err => {
            removeLoader(loader);
            appendSystemBubble(`❌ Kesalahan server: ${err.message}`);
            appendQuickReplyButtons();
        });
    }

    function setupEplSubmit(suffix) {
        const form = document.getElementById(`epl-form-${suffix}`);
        if (!form) return;
        
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const teamSelect = document.getElementById(`epl-team-select-${suffix}`);
            const team = teamSelect.value;
            appendUserBubble(`Memprediksi pertandingan selanjutnya untuk ${team}`);
            const loader = appendLoaderBubble();
            
            fetch("/api/predict/epl_match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ team: team })
            })
            .then(res => res.json())
            .then(data => {
                removeLoader(loader);
                if (data.error || !data.success) {
                    appendSystemBubble(`❌ Gagal memprediksi hasil pertandingan: ${data.error || "Terjadi kesalahan"}`);
                } else {
                    appendSystemBubble(data.html, data);
                }
                appendQuickReplyButtons();
            })
            .catch(err => {
                removeLoader(loader);
                appendSystemBubble(`❌ Kesalahan server: ${err.message}`);
                appendQuickReplyButtons();
            });
        });
    }

    // -------------------------------------------------------------
    // NEW SUBMIT HANDLERS FOR KEL 1, 4, 10
    // -------------------------------------------------------------
    function setupPerformanceAnnSubmit(suffix) {
        const form = document.getElementById(`perf-ann-form-${suffix}`);
        const posSelect = document.getElementById(`perf-ann-pos-${suffix}`);
        if (!form || !posSelect) return;

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            appendUserBubble(`Mengirim statistik parameter manual (${posSelect.value})`);
            const loader = appendLoaderBubble();

            const values = { position: posSelect.value };
            const inputs = form.querySelectorAll("input[type='range']");
            inputs.forEach(i => {
                values[i.name] = parseInt(i.value);
            });

            fetch("/api/predict/performance_ann", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            })
            .then(res => res.json())
            .then(data => {
                removeLoader(loader);
                if (data.error || !data.success) {
                    appendSystemBubble(`❌ Gagal memprediksi rating: ${data.error || "Terjadi kesalahan"}`);
                } else {
                    appendSystemBubble(data.html, data);
                }
                appendQuickReplyButtons();
            })
            .catch(err => {
                removeLoader(loader);
                appendSystemBubble(`❌ Terjadi kesalahan: ${err.message}`);
                appendQuickReplyButtons();
            });
        });
    }

    function setupInjuryCnnSubmit(suffix) {
        const form = document.getElementById(`injury-cnn-form-${suffix}`);
        if (!form) return;

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            appendUserBubble("Mengirim parameter biomekanik tubuh");
            const loader = appendLoaderBubble();

            const values = {};
            const inputs = form.querySelectorAll("input");
            inputs.forEach(i => {
                if (i.value !== "") {
                    values[i.name] = parseFloat(i.value);
                }
            });
            const selects = form.querySelectorAll("select");
            selects.forEach(s => {
                values[s.name] = parseInt(s.value);
            });

            fetch("/api/predict/injury_cnn", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            })
            .then(res => res.json())
            .then(data => {
                removeLoader(loader);
                if (data.error || !data.success) {
                    appendSystemBubble(`❌ Gagal memprediksi risiko: ${data.error || "Terjadi kesalahan"}`);
                } else {
                    appendSystemBubble(data.html, data);
                }
                appendQuickReplyButtons();
            })
            .catch(err => {
                removeLoader(loader);
                appendSystemBubble(`❌ Kesalahan server: ${err.message}`);
                appendQuickReplyButtons();
            });
        });
    }

    function handleEventCnnUpload(file, suffix) {
        appendUserBubble(`Mengunggah foto aksi: ${file.name}`);
        const loader = appendLoaderBubble();

        const formData = new FormData();
        formData.append("file", file);

        fetch("/api/predict/soccer_event_cnn", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            removeLoader(loader);
            if (data.error || !data.success) {
                appendSystemBubble(`❌ Gagal mengklasifikasi momen: ${data.error || "Terjadi kesalahan"}`);
            } else {
                appendSystemBubble(data.html, data);
            }
            appendQuickReplyButtons();
        })
        .catch(err => {
            removeLoader(loader);
            appendSystemBubble(`❌ Kesalahan server: ${err.message}`);
            appendQuickReplyButtons();
        });
    }

    // UUID Generator for chart elements
    function uuid() {
        return Math.random().toString(36).substring(2, 9);
    }
});
