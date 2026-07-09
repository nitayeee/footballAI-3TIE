document.addEventListener("DOMContentLoaded", () => {
    const chatHistory = document.getElementById("chat-history");
    const restartBtn = document.getElementById("restart-btn");

    const FEATURES = {
        gym: { name: "Gym Assistant (Kel_3)", icon: "💪" },
        performance: { name: "Soccer Performance Prediction (Kel_5)", icon: "📈" },
        injury: { name: "Sport Injury Risk Prediction (Kel_6)", icon: "🏥" },
        object: { name: "Soccer Object Detection (Kel_7)", icon: "🔍" },
        tackle: { name: "Tackle Offence Prediction (Kel_8)", icon: "⚽" },
        event: { name: "Soccer Event Classifier (Kel_11)", icon: "📸" }
    };

    let selectedFeature = null;

    // Initialize chat
    startChatFlow();

    if (restartBtn) {
        restartBtn.addEventListener("click", () => {
            chatHistory.innerHTML = "";
            selectedFeature = null;
            startChatFlow();
        });
    }

    function startChatFlow() {
        appendSystemBubble("Halo! Saya adalah Asisten AI Olahraga Terpadu. Silakan pilih salah satu fitur deep learning di bawah ini untuk memulai analisis:");
        appendQuickReplyButtons();
    }

    // -------------------------------------------------------------
    // CHAT BUBBLE HELPERS
    // -------------------------------------------------------------
    function appendSystemBubble(htmlContent) {
        const bubble = document.createElement("div");
        bubble.className = "chat-bubble bubble-left";
        bubble.innerHTML = htmlContent;
        chatHistory.appendChild(bubble);
        scrollToBottom();
        return bubble;
    }

    function appendUserBubble(text) {
        const bubble = document.createElement("div");
        bubble.className = "chat-bubble bubble-right";
        bubble.textContent = text;
        chatHistory.appendChild(bubble);
        scrollToBottom();
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

    // -------------------------------------------------------------
    // QUICK REPLY BUTTONS
    // -------------------------------------------------------------
    function appendQuickReplyButtons() {
        const container = document.createElement("div");
        container.className = "quick-reply-container";
        
        Object.entries(FEATURES).forEach(([key, value]) => {
            const btn = document.createElement("button");
            btn.className = "quick-reply-btn";
            btn.innerHTML = `<span>${value.icon}</span> <span>${value.name}</span>`;
            btn.addEventListener("click", () => handleFeatureSelection(key, value.name));
            container.appendChild(btn);
        });

        chatHistory.appendChild(container);
        scrollToBottom();
    }

    function handleFeatureSelection(featureKey, featureName) {
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
                        <div class="sliders-grid">
                            ${renderSlider("Age", "Umur", 22, suffix, 10, 50, 1)}
                            <div class="form-group">
                                <label for="injury-gender-${suffix}">Jenis Kelamin:</label>
                                <select class="form-control" id="injury-gender-${suffix}" name="Gender">
                                    <option value="1">Pria</option>
                                    <option value="0">Wanita</option>
                                </select>
                            </div>
                            ${renderSlider("Height_cm", "Tinggi (cm)", 175, suffix, 120, 220, 1)}
                            ${renderSlider("Weight_kg", "Berat (kg)", 70, suffix, 30, 120, 1)}
                            ${renderSlider("BMI", "BMI", 22.8, suffix, 10, 40, 0.1)}
                            ${renderSlider("Training_Frequency", "Frekuensi Latihan (kali/minggu)", 4, suffix, 1, 14, 1)}
                            ${renderSlider("Training_Duration", "Durasi Latihan (menit)", 90, suffix, 15, 240, 5)}
                            ${renderSlider("Warmup_Time", "Durasi Pemanasan (menit)", 10, suffix, 0, 60, 1)}
                            ${renderSlider("Sleep_Hours", "Durasi Tidur (jam)", 7, suffix, 3, 12, 0.5)}
                            ${renderSlider("Flexibility_Score", "Skor Kelenturan (1-5)", 3, suffix, 1, 5, 1)}
                            ${renderSlider("Recovery_Time", "Waktu Pemulihan (hari)", 1, suffix, 0, 7, 0.5)}
                            <div class="form-group">
                                <label for="injury-history-${suffix}">Riwayat Cedera Sebelumnya:</label>
                                <select class="form-control" id="injury-history-${suffix}" name="Injury_History">
                                    <option value="0">Tidak Ada</option>
                                    <option value="1">Ada</option>
                                </select>
                            </div>
                            ${renderSlider("Stress_Level", "Tingkat Stres (1-10)", 4, suffix, 1, 10, 1)}
                            ${renderSlider("Training_Intensity", "Intensitas Latihan (1-5)", 3, suffix, 1, 5, 1)}
                        </div>
                        <button type="submit" class="btn btn-primary" style="margin-top:1rem; width:100%;">Hitung Risiko Cedera</button>
                    </form>
                </div>
            `);
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
                appendSystemBubble(`
                    <div>
                        <div class="result-header">
                            <span class="result-title">Hasil Analisis Latihan</span>
                            <span class="result-badge badge-success">OK</span>
                        </div>
                        <div class="details-grid">
                            <div class="detail-item"><strong>Jenis Latihan:</strong> ${data.exercise.toUpperCase()}</div>
                            <div class="detail-item"><strong>Conf Model:</strong> ${data.confidence}%</div>
                            <div class="detail-item"><strong>Jumlah Reps:</strong> <span style="font-size:1.2rem; color:var(--accent); font-weight:700;">${data.reps}</span></div>
                            <div class="detail-item"><strong>Feedback:</strong> ${data.feedback}</div>
                        </div>
                        <div class="processed-media">
                            <video src="${data.processed_video_url}" controls autoplay loop muted></video>
                        </div>
                        <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.5rem; text-align:right;">Diproses ${data.total_frames_processed} frame</p>
                    </div>
                `);
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

        // Hide autocomplete suggestion box when clicking outside
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
                const chartId = "chart-" + uuid();
                appendSystemBubble(`
                    <div>
                        <div class="result-header">
                            <span class="result-title">${playerName} - Proyeksi Karir</span>
                            <span class="result-badge badge-primary">${data.category}</span>
                        </div>
                        <div class="details-grid">
                            <div class="detail-item"><strong>Posisi Ideal:</strong> ${data.insights.best_position}</div>
                            <div class="detail-item"><strong>Rating Saat Ini:</strong> ${data.actual_ratings[data.actual_ratings.length - 1]}</div>
                            <div class="detail-item"><strong>Rating Potensial:</strong> ${data.pred_ratings[data.pred_ratings.length - 1]}</div>
                        </div>
                        <div style="margin-top:0.8rem; font-size:0.88rem; border-left:3px solid var(--primary); padding-left:0.5rem; background:rgba(255,255,255,0.03); padding-top:0.3rem; padding-bottom:0.3rem;">
                            <strong>Kebutuhan Latihan:</strong> ${data.insights.training_needs}
                        </div>
                        <div style="margin-top:0.5rem; font-size:0.88rem; border-left:3px solid var(--accent); padding-left:0.5rem; background:rgba(255,255,255,0.03); padding-top:0.3rem; padding-bottom:0.3rem;">
                            <strong>Keputusan Strategis:</strong> ${data.insights.strategic_decision}
                        </div>
                        <div class="chart-container-inner">
                            <canvas id="${chartId}"></canvas>
                        </div>
                    </div>
                `);
                
                // Render Chart.js
                setTimeout(() => {
                    const ctx = document.getElementById(chartId).getContext('2d');
                    
                    const labels = [...data.actual_years, ...data.pred_years];
                    const actualData = [...data.actual_ratings, ...Array(data.pred_ratings.length).fill(null)];
                    
                    // Connect prediction starting point to actual latest
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
                                legend: { labels: { color: '#475569' } }
                            },
                            scales: {
                                x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } },
                                y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' }, min: 40, max: 100 }
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
                    appendSystemBubble(`
                        <div>
                            <div class="result-header">
                                <span class="result-title">Hasil Prediksi Rating</span>
                                <span class="result-badge badge-primary">${data.category}</span>
                            </div>
                            <div class="details-grid">
                                <div class="detail-item" style="grid-column: span 2; text-align:center;">
                                    <div style="font-size:3rem; font-weight:800; color:var(--primary); line-height:1;">${data.rating}</div>
                                    <p style="color:var(--text-secondary); margin-top:0.25rem;">${data.desc}</p>
                                </div>
                                <div class="detail-item"><strong>Posisi Ideal:</strong> ${data.insights.best_position}</div>
                                <div class="detail-item"><strong>Prospek Karir:</strong> ${data.insights.potential}</div>
                            </div>
                            <div style="margin-top:0.8rem; font-size:0.88rem; border-left:3px solid var(--accent); padding-left:0.5rem; background:rgba(255,255,255,0.03); padding-top:0.3rem; padding-bottom:0.3rem;">
                                <strong>Kebutuhan Latihan:</strong> ${data.insights.training_needs}
                            </div>
                        </div>
                    `);
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
            const inputs = form.querySelectorAll("input[type='range']");
            inputs.forEach(i => {
                values[i.name] = parseFloat(i.value);
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
                    const badgeClass = data.risk_status.includes("Tinggi") ? "badge-danger" : "badge-success";
                    const progressColor = data.risk_status.includes("Tinggi") ? "var(--danger)" : "var(--accent)";
                    appendSystemBubble(`
                        <div>
                            <div class="result-header">
                                <span class="result-title">Hasil Prediksi Risiko Cedera</span>
                                <span class="result-badge ${badgeClass}">${data.risk_status}</span>
                            </div>
                            <div style="margin-bottom:1rem; text-align:center;">
                                <div style="font-size:2.5rem; font-weight:800; color:${progressColor};">${data.prob_percent}%</div>
                                <div style="width:100%; height:8px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden; margin-top:0.4rem;">
                                    <div style="width:${data.prob_percent}%; height:100%; background:${progressColor};"></div>
                                </div>
                            </div>
                            <div style="font-size:0.9rem; line-height:1.6; border-left:3px solid ${progressColor}; padding-left:0.75rem; background:rgba(255,255,255,0.03); padding-top:0.5rem; padding-bottom:0.5rem;">
                                <strong>Rekomendasi:</strong> ${data.recommendation}
                            </div>
                        </div>
                    `);
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
                if (data.file_type === "image") {
                    const counts = { ball: 0, goalkeeper: 0, player: 0, referee: 0 };
                    if (data.spatial_points) {
                        data.spatial_points.forEach(pt => {
                            counts[pt.class] = (counts[pt.class] || 0) + 1;
                        });
                    }
                    const totalDetections = counts.ball + counts.goalkeeper + counts.player + counts.referee;
                    const fieldId = "field-" + uuid();
                    const chartId = "chart-" + uuid();

                    appendSystemBubble(`
                        <div>
                            <div class="result-header">
                                <span class="result-title">Hasil Deteksi Gambar (Kel_7)</span>
                                <span class="result-badge badge-success">Selesai</span>
                            </div>
                            <div class="details-grid" style="margin-bottom:0.8rem;">
                                <div class="detail-item"><strong>Pemain:</strong> ${counts.player}</div>
                                <div class="detail-item"><strong>Bola:</strong> ${counts.ball}</div>
                                <div class="detail-item"><strong>Kiper:</strong> ${counts.goalkeeper}</div>
                                <div class="detail-item"><strong>Wasit:</strong> ${counts.referee}</div>
                                <div class="detail-item" style="grid-column: span 2;"><strong>Total Deteksi:</strong> ${totalDetections}</div>
                            </div>
                            <div class="processed-media">
                                <img src="${data.annotated_image_url}" alt="Hasil Deteksi YOLO">
                            </div>
                            <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                                <a href="${data.annotated_image_url}" download="hasil_deteksi.jpg" class="btn btn-secondary btn-sm" style="padding: 0.4rem 1rem; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary);">
                                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                    Unduh Gambar
                                </a>
                            </div>
                            <div style="margin-top: 1.25rem;">
                                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.4rem; font-weight: 600;">▸ PETA POSISI TAKTIS (SCATTER MAP)</p>
                                <div class="field-container">
                                    <div class="soccer-field" id="${fieldId}">
                                        <div class="field-center-line"></div>
                                        <div class="field-center-circle"></div>
                                        <div class="field-center-dot"></div>
                                        <div class="field-box-left"></div>
                                        <div class="field-box-right"></div>
                                        <div class="field-goal-left"></div>
                                        <div class="field-goal-right"></div>
                                        <div class="heatmap-tint"></div>
                                        <span class="map-coord-label" style="left:4px; top:4px;">0,0</span>
                                        <span class="map-coord-label" style="right:4px; top:4px;">100,0</span>
                                        <span class="map-coord-label" style="left:4px; bottom:4px;">0,100</span>
                                        <span class="map-coord-label" style="right:4px; bottom:4px;">100,100</span>
                                    </div>
                                    <div class="field-legend">
                                        <div class="legend-item"><div class="legend-dot" style="background:#3b82f6"></div>Pemain</div>
                                        <div class="legend-item"><div class="legend-dot" style="background:#10b981"></div>Bola</div>
                                        <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div>Kiper</div>
                                        <div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div>Wasit</div>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 1.25rem;">
                                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.4rem; font-weight: 600;">▸ SEBARAN DISTRIBUSI OBJEK</p>
                                <div class="chart-container-inner" style="height: 180px;">
                                    <canvas id="${chartId}"></canvas>
                                </div>
                            </div>
                        </div>
                    `);

                    setTimeout(() => {
                        const fieldEl = document.getElementById(fieldId);
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

                        const chartCanvas = document.getElementById(chartId);
                        if (chartCanvas) {
                            const ctx = chartCanvas.getContext('2d');
                            new Chart(ctx, {
                                type: 'bar',
                                data: {
                                    labels: ['BALL', 'KEEPER', 'PLAYER', 'REFEREE'],
                                    datasets: [{
                                        label: 'Detections',
                                        data: [counts.ball, counts.goalkeeper, counts.player, counts.referee],
                                        backgroundColor: ['rgba(16, 185, 129, 0.2)', 'rgba(245, 158, 11, 0.2)', 'rgba(59, 130, 246, 0.2)', 'rgba(239, 68, 68, 0.2)'],
                                        borderColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'],
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
                } else {
                    appendSystemBubble(`
                        <div>
                            <div class="result-header">
                                <span class="result-title">Hasil Tracking Video</span>
                                <span class="result-badge badge-success">Selesai</span>
                            </div>
                            <div class="details-grid" style="margin-bottom:0.8rem;">
                                <div class="detail-item"><strong>Jumlah ID Pemain Unik:</strong> ${data.total_unique_players}</div>
                                <div class="detail-item"><strong>Model Tracker:</strong> ByteTrack</div>
                            </div>
                            <div class="processed-media">
                                <video src="${data.annotated_video_url}" controls autoplay loop muted></video>
                            </div>
                            <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                                <a href="${data.annotated_video_url}" download="hasil_tracking.mp4" class="btn btn-secondary btn-sm" style="padding: 0.4rem 1rem; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary);">
                                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                    Unduh Video
                                </a>
                            </div>
                            <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.5rem; text-align:right;">Diproses ${data.total_frames_processed} frame</p>
                        </div>
                    `);
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
                    const isOffence = data.label === "Offense";
                    const badgeClass = isOffence ? "badge-danger" : "badge-success";
                    const color = isOffence ? "var(--danger)" : "var(--accent)";
                    
                    let keyframesHtml = "";
                    if (data.frames && data.frames.length > 0) {
                        keyframesHtml = `
                            <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:1rem; margin-bottom:0.4rem;">Galeri Cuplikan Keyframe:</p>
                            <div class="keyframes-strip">
                                ${data.frames.map(f => `
                                    <div class="keyframe-img-box">
                                        <img src="data:image/jpeg;base64,${f}" alt="Keyframe">
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }

                    appendSystemBubble(`
                        <div>
                            <div class="result-header">
                                <span class="result-title">Deteksi Tackle Pelanggaran</span>
                                <span class="result-badge ${badgeClass}">${data.label}</span>
                            </div>
                            <div style="margin-bottom:1rem; text-align:center;">
                                <div style="font-size:2.2rem; font-weight:800; color:${color};">${data.confidence.toFixed(1)}%</div>
                                <p style="font-size:0.85rem; color:var(--text-secondary);">Keyakinan Model (Threshold: ${data.threshold})</p>
                            </div>
                            <div style="font-size:0.9rem; line-height:1.6; border-left:3px solid ${color}; padding-left:0.75rem; background:rgba(255,255,255,0.03); padding-top:0.4rem; padding-bottom:0.4rem;">
                                <strong>Hasil Klasifikasi:</strong> ${isOffence ? "Tackle terdeteksi sebagai PELANGGARAN. Kurang sportif atau terlambat memotong bola." : "Tackle Bersih (TIDAK ADA PELANGGARAN). Perebutan bola dinilai bersih."}
                            </div>
                            ${keyframesHtml}
                        </div>
                    `);
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
                const isFoul = data.label === "Foul Tackle";
                const badgeClass = isFoul ? "badge-danger" : "badge-success";
                const color = isFoul ? "var(--danger)" : "var(--accent)";

                appendSystemBubble(`
                    <div>
                        <div class="result-header">
                            <span class="result-title">Deteksi Tackle Gambar (Kel_9)</span>
                            <span class="result-badge ${badgeClass}">${data.label}</span>
                        </div>
                        <div style="margin-bottom:1rem; text-align:center;">
                            <div style="font-size:2.2rem; font-weight:800; color:${color};">${data.confidence.toFixed(1)}%</div>
                            <p style="font-size:0.85rem; color:var(--text-secondary);">Keyakinan Model</p>
                        </div>
                        <div style="font-size:0.9rem; line-height:1.6; border-left:3px solid ${color}; padding-left:0.75rem; background:rgba(255,255,255,0.03); padding-top:0.4rem; padding-bottom:0.4rem; margin-bottom:1rem;">
                            <strong>Hasil Analisis:</strong> ${isFoul ? "Tackle terdeteksi sebagai PELANGGARAN. Kaki terangkat tinggi atau menyentuh fisik lawan sebelum bola." : "Tackle Bersih (TIDAK ADA PELANGGARAN). Kontak kaki langsung menyapu bola."}
                        </div>
                        <div class="processed-media">
                            <img src="${data.image_url}" alt="Tackle Image Analysis">
                        </div>
                    </div>
                `);
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
                const chartId = "chart-" + uuid();
                appendSystemBubble(`
                    <div>
                        <div class="result-header">
                            <span class="result-title">Klasifikasi Peristiwa Momen</span>
                            <span class="result-badge badge-primary">${data.event.toUpperCase()}</span>
                        </div>
                        <div style="margin-bottom:0.8rem; text-align:center;">
                            <div style="font-size:2.2rem; font-weight:800; color:var(--primary);">${data.confidence}%</div>
                            <p style="font-size:0.85rem; color:var(--text-secondary);">Tingkat Keyakinan</p>
                        </div>
                        <div class="chart-container-inner" style="height: 180px;">
                            <canvas id="${chartId}"></canvas>
                        </div>
                    </div>
                `);

                // Render Chart.js Horizontal Bar Chart
                setTimeout(() => {
                    const ctx = document.getElementById(chartId).getContext('2d');
                    
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

    // UUID Generator for chart elements
    function uuid() {
        return Math.random().toString(36).substring(2, 9);
    }
});
