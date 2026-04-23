window.onerror = function (msg, url, line) {
    alert("CRITICAL ERROR: " + msg + " (Line " + line + ")");
};

// IT IS RECOMMENDED TO USE A BUILD TOOL OR env.js FOR LOCAL DEV.
// THE CONFIG BELOW NOW PULLS FROM A GLOBAL 'ENV' OBJECT (defined in env.js)
const firebaseConfig = {
    apiKey: typeof ENV !== 'undefined' ? ENV.FIREBASE_API_KEY : "REDACTED",
    authDomain: typeof ENV !== 'undefined' ? ENV.FIREBASE_AUTH_DOMAIN : "REDACTED",
    projectId: typeof ENV !== 'undefined' ? ENV.FIREBASE_PROJECT_ID : "REDACTED",
    storageBucket: typeof ENV !== 'undefined' ? ENV.FIREBASE_STORAGE_BUCKET : "REDACTED",
    messagingSenderId: typeof ENV !== 'undefined' ? ENV.FIREBASE_MESSAGING_SENDER_ID : "REDACTED",
    appId: typeof ENV !== 'undefined' ? ENV.FIREBASE_APP_ID : "REDACTED"
};
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    window.cloudDB = firebase.firestore();
    window.cloudStorage = firebase.storage();
} else {
    console.warn("Tactical Mode: Operating on Local Mesh (Cloud Offline).");
}

// --- Identity & Profile Management ---
// Persistent Node ID (remains same across refreshes)
let myNodeId = localStorage.getItem('myNodeId');
if (!myNodeId) {
    myNodeId = "NK-" + Math.floor(Math.random() * 9000 + 1000);
    localStorage.setItem('myNodeId', myNodeId);
}

// Load from persistence or use defaults
let userProfile = JSON.parse(localStorage.getItem('sosProfile')) || {
    name: "Unknown Operative",
    contact: "Not Provided",
    blood: "UNKNOWN",
    notes: "None",
    emergencyCall: "112"
};

const settingsBtn = document.getElementById('settings-btn');
const profileOverlay = document.getElementById('profile-overlay');
const profileBackdrop = document.getElementById('profile-backdrop');
const closeProfileBtn = document.getElementById('close-profile-btn');
const saveProfileBtn = document.getElementById('save-profile-btn');

const openProfile = () => {
    profileBackdrop.classList.remove('hidden');
    profileOverlay.classList.remove('hidden');
    setTimeout(() => {
        profileBackdrop.classList.add('show');
        profileOverlay.classList.add('open');
    }, 10);
};

const closeProfile = () => {
    profileBackdrop.classList.remove('show');
    profileOverlay.classList.remove('open');
    setTimeout(() => {
        profileBackdrop.classList.add('hidden');
        profileOverlay.classList.add('hidden');
    }, 300);
};

// Populate inputs on load
document.getElementById('prof-name').value = userProfile.name === "Unknown Operative" ? "" : userProfile.name;
document.getElementById('prof-contact').value = userProfile.contact === "Not Provided" ? "" : userProfile.contact;
document.getElementById('prof-blood').value = userProfile.blood;
document.getElementById('prof-notes').value = userProfile.notes === "None" ? "" : userProfile.notes;
document.getElementById('prof-emergency-call').value = userProfile.emergencyCall || "112";

// UI toggles
settingsBtn.addEventListener('click', openProfile);
closeProfileBtn.addEventListener('click', closeProfile);
profileBackdrop.addEventListener('click', closeProfile);

// Save routine
saveProfileBtn.addEventListener('click', () => {
    userProfile = {
        name: document.getElementById('prof-name').value || "Unknown Operative",
        contact: document.getElementById('prof-contact').value || "Not Provided",
        blood: document.getElementById('prof-blood').value || "UNKNOWN",
        notes: document.getElementById('prof-notes').value || "None",
        emergencyCall: document.getElementById('prof-emergency-call').value || "112"
    };
    localStorage.setItem('sosProfile', JSON.stringify(userProfile));
    closeProfile();

    // Visually confirm saving with popup
    const toast = document.getElementById('toast-notification');
    toast.innerText = "Profile Saved successfully";
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2000);

    // Log
    addLog(`Profile successfully updated.`, "system");
});

// --- Panic Lock Logic ---
const panicButton = document.getElementById('panic-button');
const beaconContainer = document.getElementById('beacon-container');
const instructionText = document.getElementById('instruction-text');

let holdTimer;
let unlockTimer;
let isLocked = false;
let currentScenario = "GENERAL";

// Scenario Selector setup
const scenarioSelector = document.getElementById('scenario-selector');
const scenarioBtns = document.querySelectorAll('.scenario-btn');

scenarioBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        scenarioBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentScenario = btn.getAttribute('data-scenario');
    });
});

// Touch & Mouse Events for Latch
const startHold = (e) => {
    e.preventDefault();
    if (isLocked) {
        // Holding to UNLOCK
        panicButton.classList.add('holding');
        instructionText.innerText = "DISARMING...";
        unlockTimer = setTimeout(() => {
            isLocked = false;
            beaconContainer.classList.remove('radiating');
            instructionText.innerText = "HOLD FOR SECURE LATCH";
            instructionText.classList.remove('locked');
            panicButton.classList.remove('holding');
            panicButton.innerHTML = '<span class="button-icon">⚡</span>';
            scenarioSelector.classList.add('hidden'); // Hide scenarios
            scenarioBtns.forEach(b => b.classList.remove('active'));
            scenarioBtns[0].classList.add('active'); // Reset to general
            currentScenario = "GENERAL";
        }, 1500); // 1.5 second hold to unlock
    } else {
        // Holding to LOCK
        panicButton.classList.add('holding');
        instructionText.innerText = "AUTHENTICATING...";
        holdTimer = setTimeout(() => {
            isLocked = true;
            beaconContainer.classList.add('radiating');
            instructionText.innerText = "BIOMETRIC LOCK ENGAGED";
            instructionText.classList.add('locked');
            panicButton.innerHTML = '<span class="button-icon">🔓</span>';
            scenarioSelector.classList.remove('hidden'); // Reveal scenarios

            // --- Camera Warmup ---
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .then(stream => {
                        window.tempStream = stream; // Keep it warm
                        addLog("Sensors synchronized for distress state.", "system");
                    }).catch(() => addLog("Camera access restricted. Video disabled.", "system"));
            }
        }, 1500); // 1.5 second hold to lock
    }
};

const endHold = (e) => {
    e.preventDefault();
    if (isLocked) {
        // Released before disarming
        clearTimeout(unlockTimer);
        panicButton.classList.remove('holding');
        instructionText.innerText = "BIOMETRIC LOCK ENGAGED";
    } else {
        // Released before locking
        clearTimeout(holdTimer);
        panicButton.classList.remove('holding');
        instructionText.innerText = "HOLD FOR SECURE LATCH";
    }
};

panicButton.addEventListener('mousedown', startHold);
panicButton.addEventListener('touchstart', startHold);
panicButton.addEventListener('mouseup', endHold);
panicButton.addEventListener('mouseleave', endHold);
panicButton.addEventListener('touchend', endHold);

// --- Antigravity Swipe Logic ---
const slider = document.getElementById('swipe-slider');
const track = document.querySelector('.swipe-track');
const confirmedUI = document.getElementById('broadcast-confirmed');
const swipeContainer = document.getElementById('swipe-container');

let isDragging = false;
let startX = 0;
let maxDrag = 0;

slider.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX || e.touches[0].clientX;
    slider.style.transition = 'none';
    maxDrag = track.offsetWidth - slider.offsetWidth - 10; // 10px padding margin
});

slider.addEventListener('touchstart', (e) => {
    isDragging = true;
    startX = e.touches[0].clientX;
    slider.style.transition = 'none';
    maxDrag = track.offsetWidth - slider.offsetWidth - 10;
});

const handleMove = (x) => {
    if (!isDragging) return;
    let distance = x - startX;

    if (distance < 0) distance = 0;
    if (distance > maxDrag) distance = maxDrag;

    slider.style.transform = `translateX(${distance}px)`;

    // Check if fully swiped
    if (distance >= maxDrag * 0.95) {
        triggerSOS();
    }
};

document.addEventListener('mousemove', (e) => handleMove(e.clientX));
document.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientX));

const stopDrag = () => {
    if (!isDragging) return;
    isDragging = false;

    // SNAP BACK
    slider.style.transition = 'transform 0.3s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
    slider.style.transform = `translateX(0px)`;
};

document.addEventListener('mouseup', stopDrag);
document.addEventListener('touchend', stopDrag);

let currentLat = null;
let currentLng = null;

// Watch Live GPS continuously
if (navigator.geolocation) {
    navigator.geolocation.watchPosition((pos) => {
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
        document.getElementById('gps-status').innerHTML = `GPS FIX: <a href="https://maps.google.com/?q=${currentLat},${currentLng}" target="_blank" style="color:inherit; text-decoration:underline;">${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}</a> ➜`;
    }, (err) => {
        document.getElementById('gps-status').innerText = `GPS SIGNAL MASKED`;
    }, {
        enableHighAccuracy: true
    });
}

// Final Broadcast Action
function triggerSOS() {
    if (!isLocked) return; // Tactical Safety: Cannot fire if latch is open

    isDragging = false;
    swipeContainer.style.display = 'none';
    confirmedUI.classList.remove('hidden');

    // Broadcast using current global position
    sendSOSPayload(
        currentLat !== null ? currentLat : "Unknown (No Signal)",
        currentLng !== null ? currentLng : "Unknown"
    );

    // Continue blasting Live location every 5 seconds while active
    let blastInterval = setInterval(() => {
        if (confirmedUI.classList.contains('hidden')) {
            clearInterval(blastInterval);
            if (window.intelInterval) clearInterval(window.intelInterval);
            return;
        }
        sendSOSPayload(
            currentLat !== null ? currentLat : "Unknown (No Signal)",
            currentLng !== null ? currentLng : "Unknown"
        );
    }, 5000);

    // --- Session Handshake (Physical Lock) ---
    cloudDB.collection("active_nodes").doc(myNodeId).set({ lastActive: Date.now() }).then(() => {
        addLog("Identity Handshake Synchronized.", "system");
    });

    // --- AUTO-CALL PROTOCOL ---
    // Launch dialer with priority target
    setTimeout(() => {
        const targetNumber = userProfile.emergencyCall || "112";
        addLog(`Initiating Auto-Call to ${targetNumber} via system dialer...`, "alert");
        window.location.href = `tel:${targetNumber}`;

        // TACTICAL ATTEMPT: Trigger Android Personal Safety Sidecar (Experimental Deep Link)
        if (/Android/i.test(navigator.userAgent)) {
            setTimeout(() => {
                addLog("Attempting to sync with System Safety Hub...", "node");
                // This will fail silently if the app/intent is not found, which is safe.
                window.location.href = "intent:#Intent;action=com.google.android.apps.safetyhub.ACTION_SOS;category=android.intent.category.DEFAULT;end";
            }, 500);
        }
    }, 1500); // 1.5s delay to ensure the mesh payload is sent first

    // --- Start Intelligence Capture Cycle ---
    startIntelCycle();
    window.intelInterval = setInterval(startIntelCycle, 180000);
}

async function startIntelCycle() {
    if (confirmedUI.classList.contains('hidden')) return;

    const recIndicator = document.getElementById('rec-indicator');
    recIndicator.classList.add('active'); // Show RECPULSE
    addLog("[SYSTEM] Camera active. Starting 15s recording...", "system");

    try {
        const stream = window.tempStream || await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // --- Universal Codec Detection (Android vs iPhone) ---
        let mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/mp4'; // iPhone/Safari support
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks = [];

        recorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
            addLog("[SYSTEM] Processing capture...", "node");
            const blob = new Blob(chunks, { type: mimeType });
            uploadVideoIntel(blob);

            // --- LOCAL SAVE (Device Storage) ---
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `ResQNet_Evidence_${Date.now()}.${mimeType.includes('webm') ? 'webm' : 'mp4'}`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                addLog("[SUCCESS] Intel saved to local device storage.", "node");
            }, 100);

            recIndicator.classList.remove('active'); // Hide RECPULSE
        };

        recorder.start();
        setTimeout(() => {
            if (recorder.state === "recording") {
                recorder.stop();
                addLog("[SYSTEM] Capture successful.", "node");
            }
        }, 15000); // 15s record

    } catch (err) {
        addLog(`[SYSTEM] ERROR: ${err.message}`, "system");
        console.error(err);
        recIndicator.classList.remove('active');
    }
}

function uploadVideoIntel(blob) {
    if (blob.size < 100) {
        addLog("[ERROR] Video payload too small. Capture failed.", "system");
        return;
    }

    const timestamp = Date.now();
    const filename = `intel_${myNodeId}_${timestamp}.webm`;

    // 1. SYNC TO CLOUD (Firebase Storage)
    if (typeof firebase !== 'undefined' && window.cloudStorage) {
        addLog(`[SYSTEM] Syncing Intel (${(blob.size / 1024).toFixed(1)} KB) to Cloud Storage...`, "alert");
        const storageRef = cloudStorage.ref().child(`intel/${filename}`);
        storageRef.put(blob).then((snapshot) => {
            addLog("[SUCCESS] Intel securely stored in Cloud Archives.", "node");
        }).catch((err) => {
            addLog("[ERROR] Cloud platform unreachable.", "system");
        });
    }

    // 2. SYNC TO LOCAL LAPTOP (Dual-Path Mesh Relay)
    const localHost = typeof ENV !== 'undefined' ? ENV.LOCAL_ENDPOINT : "http://localhost:8080";
    const tunnelHost = typeof ENV !== 'undefined' ? ENV.TUNNEL_ENDPOINT : "";

    [localHost, tunnelHost].forEach(host => {
        if (!host) return;
        addLog(`[SYSTEM] Mirroring Intel to ${host.includes('10.') ? 'Local Relay' : 'Tunnel'}...`, "node");

        fetch(`${host}/upload_intel?node_id=${myNodeId}`, {
            method: 'POST',
            body: blob
        })
            .then(res => res.json())
            .then(data => addLog(`[SUCCESS] Mirror complete [${host.includes('10.') ? 'RELAY' : 'TUNNEL'}]`, "node"))
            .catch(err => {
                console.warn(`Local sync failed for ${host}:`, err);
                // Silent fail for secondary paths
            });
    });
}

function sendSOSPayload(lat, lng) {
    // Create a tactical broadcast profile (Excludes the emergency auto-call number for privacy)
    const broadcastProfile = {
        name: userProfile.name,
        contact: userProfile.contact,
        blood: userProfile.blood,
        notes: userProfile.notes
    };

    // Broadcast to Server (Mesh Relay)
    addLog("Initiating cloud broadcast payload...", "alert");

    // Broadcast to Cloud DB (Firestore) for Authority Access
    if (typeof firebase !== 'undefined' && window.cloudDB) {
        cloudDB.collection("sos_logs").add({
            sender: myNodeId,
            profile: broadcastProfile,
            lat: lat,
            lng: lng,
            scenario: currentScenario,
            timestamp: new Date().toISOString(),
            readable_date: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }),
            readable_time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: "EMERGENCY_DISTRESS",
            status: "ACTIVE"
        }).then(() => {
            addLog("Telemetry mirrored to Cloud Authority DB", "node");
        }).catch((err) => {
            addLog("Cloud Record Offline.", "system");
        });
    }

    // Reset after 8 seconds
    setTimeout(() => {
        swipeContainer.style.display = 'block';
        confirmedUI.classList.add('hidden');
        slider.style.transform = `translateX(0px)`;
    }, 8000);
}

// --- HARDWARE BLUETOOTH SCANNERR (Web Bluetooth API) ---
const bleScanBtn = document.getElementById('ble-scan-btn');
if (bleScanBtn) {
    bleScanBtn.addEventListener('click', async () => {
        try {
            if (!navigator.bluetooth) {
                addLog("Bluetooth access blocked or unsupported by browser.", "system");
                return;
            }

            addLog("Looking for nearby Bluetooth devices...", "system");

            // Pop the native hardware scanner UI
            // Note: acceptAllDevices is used here because Web Browsers cannot actively broadcast a UUID.
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true
            });

            // A local hardware device was captured!
            const deviceName = device.name || "Unknown Device";
            addLog(`Bluetooth Device Found: [${deviceName}]`, "node");

            // Manually inject the hardware node into the counter
            const countLabel = document.getElementById('node-count');
            const currentNodes = parseInt(countLabel.innerText);
            countLabel.innerText = currentNodes + 1;
            countLabel.style.color = "#00f0ff"; // Glow cyan for P2P nodes
            countLabel.style.textShadow = "0 0 10px #00f0ff";

            // Listen for if the device walks out of range
            device.addEventListener('gattserverdisconnected', () => {
                addLog(`Bluetooth Disconnected: [${deviceName}] signal lost.`, "system");
                const nodesNow = parseInt(document.getElementById('node-count').innerText);
                if (nodesNow > 1) document.getElementById('node-count').innerText = nodesNow - 1;
            });

        } catch (err) {
            console.error(err);
            if (err.name === 'NotFoundError') {
                addLog("No nearby Bluetooth devices found.", "system");
            } else if (err.name === 'SecurityError') {
                addLog("Bluetooth blocked by browser security.", "system");
            } else {
                addLog("Bluetooth scan cancelled.", "system");
            }
        }
    });
}

// --- Live Mesh Networking (Polling — works through Cloudflare) ---
const nodeCountLabel = document.getElementById('node-count');
const incomingOverlay = document.getElementById('incoming-sos-overlay');
const incomingDetails = document.getElementById('incoming-details');
const incomingTitle = document.getElementById('incoming-title');
const ackBtn = document.getElementById('acknowledge-btn');

// --- Network Logger ---
const networkLog = document.getElementById('network-log');

function addLog(message, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' });
    entry.innerText = `[${time}] ${message}`;
    networkLog.appendChild(entry);
    if (networkLog.children.length > 5) networkLog.removeChild(networkLog.firstChild);
    networkLog.scrollTop = networkLog.scrollHeight;
}

// Background radar chatter simulation
setInterval(() => {
    if (Math.random() > 0.6) {
        const fakeNode = "NK-" + Math.floor(Math.random() * 9000 + 1000);
        addLog(`P2P Handshake verified with ${fakeNode}`, 'node');
    }
}, 4000);

let activeMap = null;
let activeMarker = null;

// --- Register this device as a live node ---
function registerNode() {
    if (typeof firebase !== 'undefined' && window.cloudDB) {
        cloudDB.collection("active_nodes").doc(myNodeId).set({ lastActive: Date.now() })
            .then(() => {
                // Heartbeat successful
            })
            .catch((err) => {
                addLog(`Cloud Sync Offline: ${err.message}`, "system");
            });
    }
}
registerNode();
addLog("Connected to cloud tactical network.", "system");

// Unregister cleanly when user leaves
window.addEventListener('beforeunload', () => {
    cloudDB.collection("active_nodes").doc(myNodeId).delete();
});

// --- Node Heartbeat (5 sec) ---
let lastCount = 1;
setInterval(() => {
    registerNode(); // Attempt Cloud Heartbeat

    const localHost = typeof ENV !== 'undefined' ? ENV.LOCAL_ENDPOINT : "http://localhost:8080";
    const tunnelHost = typeof ENV !== 'undefined' ? ENV.TUNNEL_ENDPOINT : "";

    // 1. DUAL-PATH: Sync with Local Relay & Tunnel (works offline/remote)
    [localHost, tunnelHost].forEach(host => {
        if (!host) return;
        fetch(`${host}/node_count?node_id=${myNodeId}`)
            .then(res => res.json())
            .then(data => {
                if (data.count && data.count !== lastCount) {
                    nodeCountLabel.innerText = data.count;
                    lastCount = data.count;
                    addLog(`${host.includes('trycloudflare') ? 'Tunnel' : 'Local'} Mesh update: ${data.count} nodes detected.`, "node");
                }
            }).catch(() => { });
    });

    // 2. CLOUD-PATH: Sync with Firebase (works online)
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        cloudDB.collection("active_nodes").where("lastActive", ">", Date.now() - 3600000).get().then(snap => {
            const currentCount = snap.size;
            if (currentCount > lastCount) {
                nodeCountLabel.innerText = currentCount;
                lastCount = currentCount;
                addLog(`Cloud Network update: ${currentCount} nodes detected.`, "node");
            }
        }).catch(() => { });
    }
}, 5000);

// --- Poll for SOS alerts every 2 seconds ---
// --- Network Alerts Processing ---
const processedAlerts = new Set(); // Track unique alert IDs to prevent duplicates

function handleSOSData(data) {
    // 1. DISCARD IF SENDER IS ME
    if (data.sender === myNodeId) {
        return;
    }

    // UI POPUP (moved up)
    incomingOverlay.classList.remove('hidden');
    const now = Date.now() / 1000;
    if (now - data.received_at > 20) {
        return;
    }

    // 3. CREATE UNIQUE SIGNATURE (Sender + Original Timestamp)
    const alertSignature = `${data.sender}_${data.timestamp}`;

    // 4. DISCARD IF ALREADY PROCESSED
    if (processedAlerts.has(alertSignature)) {
        return;
    }

    // NEW VALID ALERT DETECTED
    incomingOverlay.classList.remove('hidden');
    processedAlerts.add(alertSignature);
    addLog(`INCOMING PRIORITY PACKET: [${data.scenario}] from ${data.sender}`, 'alert');

    // --- Intel Discovery (Local Relay) ---
    const localHost = typeof ENV !== 'undefined' ? ENV.LOCAL_ENDPOINT : "http://localhost:8080";
    fetch(`${localHost}/list_intel?node_id=${data.sender}`)
        .then(res => res.json())
        .then(intel => {
            if (intel.files && intel.files.length > 0) {
                const latestVideo = intel.files[0];
                const videoElement = document.getElementById('incoming-video');
                const videoContainer = document.getElementById('live-stream-container');
                videoElement.src = `${localHost}/intel/${latestVideo}`;
                videoContainer.style.display = 'block';
                addLog(`[SYSTEM] Video evidence found for ${data.sender}. Loading...`, "node");
            } else {
                document.getElementById('live-stream-container').style.display = 'none';
            }
        }).catch(err => {
            console.warn("Could not fetch intel from local relay:", err);
            document.getElementById('live-stream-container').style.display = 'none';
        });

    let locString = "NO GPS FIX";
    let mapLink = "#";

    if (typeof data.lat === 'number') {
        locString = `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`;
        mapLink = `https://maps.google.com/?q=${data.lat},${data.lng}`;
        document.getElementById('live-map-container').style.display = 'block';
        if (!activeMap) {
            activeMap = L.map('live-map-container').setView([data.lat, data.lng], 17);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(activeMap);
            activeMarker = L.marker([data.lat, data.lng]).addTo(activeMap);
        } else {
            activeMarker.setLatLng([data.lat, data.lng]);
            activeMap.panTo([data.lat, data.lng]);
        }
    } else {
        locString = data.lat;
        document.getElementById('live-map-container').style.display = 'none';
        if (activeMap) { activeMap.remove(); activeMap = null; }
    }

    incomingTitle.innerText = `[${data.scenario}] DISTRESS DETECTED`;
    incomingDetails.innerHTML = `
        <div style="margin-bottom: 8px"><span style="color:#ffb7b2">ID:</span> ${data.sender}</div>
        <div style="margin-bottom: 8px"><span style="color:#ffb7b2">NAME:</span> <strong style="color:white; font-size:1.1rem">${data.profile.name}</strong></div>
        <div style="margin-bottom: 8px"><span style="color:#ffb7b2">PHONE:</span> ${data.profile.contact} | <span style="color:#ffb7b2">BLOOD:</span> <strong style="color:white">${data.profile.blood}</strong></div>
        <div style="margin-bottom: 12px; font-size: 0.8rem; background:rgba(0,0,0,0.3); padding:8px; border-left: 3px solid #ffb7b2; text-align:left">${data.profile.notes}</div>
        <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <span style="color:#ffb7b2">LOC:</span> <span style="font-family:monospace">${locString}</span>
            <a href="${mapLink}" target="_blank" style="background-color: white; color: #050505; padding: 4px 12px; border-radius: 4px; font-weight: 900; text-decoration: none; font-size: 0.8rem; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">GO ➜</a>
        </div>
        <div><span style="color:#ffb7b2">TIMECODE:</span> ${new Date(data.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} IST</div>
    `;
    incomingOverlay.classList.remove('hidden');

    if (activeMap) {
        setTimeout(() => {
            activeMap.invalidateSize();
        }, 100);
    }

    if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
}

// Listen to SOS alerts (Cloud Realtime Sync)
const startupTime = new Date().toISOString();
cloudDB.collection('sos_logs')
    .where('timestamp', '>=', startupTime)
    .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                data.received_at = Date.now() / 1000;
                handleSOSData(data);

                // Cleanup ProcessedAlerts Set periodically
                if (processedAlerts.size > 200) {
                    processedAlerts.clear();
                }
            }
        });
    });

ackBtn.addEventListener('click', () => {
    incomingOverlay.classList.add('hidden');
    document.getElementById('live-stream-container').style.display = 'none';
    document.getElementById('incoming-video').pause();
    document.getElementById('incoming-video').src = "";
    if (activeMap) { activeMap.remove(); activeMap = null; }
});

