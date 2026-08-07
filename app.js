let state = {
    mode: '12lead', sync: false, defibMode: 'monitor', shockTimer: null, 
    currentX: 0, time: 0, lastY: null, lastY_12: Array(3).fill(null), lastY_II: null
};

const leads12 = [
    ['I', 'aVR', 'V1', 'V4'],
    ['II', 'aVL', 'V2', 'V5'],
    ['III', 'aVF', 'V3', 'V6']
];

function gaussian(x, a, b, c) {
    return a * Math.exp(-Math.pow(x - b, 2) / (2 * c * c));
}

function getECGValue(phase, rhythm) {
    let y = 0;
    if (rhythm === 'asystole') return (Math.random() - 0.5) * 3;
    if (rhythm === 'vf') return Math.sin(phase * Math.PI * 10) * 15 + Math.sin(phase * Math.PI * 22) * 10 + (Math.random()-0.5)*10;
    if (rhythm === 'vt') return Math.sin(phase * Math.PI * 6) * 40; 
    
    if (rhythm === 'pea' || rhythm === 'nsr' || rhythm.includes('st') || rhythm.includes('t')) {
        y += gaussian(phase, 6, 0.15, 0.015);   // P Wave
        y += gaussian(phase, -12, 0.28, 0.008); // Q Wave
        y += gaussian(phase, 60, 0.30, 0.01);   // R Wave
        y += gaussian(phase, -18, 0.32, 0.008); // S Wave
        
        if (rhythm === 'peak-t') y += gaussian(phase, 35, 0.55, 0.03);
        else if (rhythm === 't-inv') y += gaussian(phase, -15, 0.55, 0.03);
        else y += gaussian(phase, 15, 0.55, 0.03);

        if (rhythm === 'st-elev') {
            y += gaussian(phase, 25, 0.40, 0.04); 
            y += gaussian(phase, 15, 0.45, 0.04); 
        } else if (rhythm === 'st-dep') {
            y += gaussian(phase, -15, 0.40, 0.04);
        }
    }
    return -y; 
}

function toggleRhythmDisplay() {
    const el = document.getElementById('rhythm-display');
    const btn = document.getElementById('btn-show-rhythm');
    if(el.style.display === 'none') {
        el.style.display = 'inline'; btn.innerText = 'ซ่อน';
    } else {
        el.style.display = 'none'; btn.innerText = 'แสดง';
    }
}

function updateSummary() {
    let hr = document.getElementById('hr-input').value;
    let bp = document.getElementById('bp-input').value;
    let rhythm = document.getElementById('rhythm-select').options[document.getElementById('rhythm-select').selectedIndex].text;
    let defectLeads = document.getElementById('lead-defect').value;
    
    let signs = [];
    if(document.getElementById('sign-loc').checked) signs.push("ซึม/สับสน");
    if(document.getElementById('sign-hf').checked) signs.push("น้ำท่วมปอด/หอบเหนื่อย");
    if(document.getElementById('sign-cp').checked) signs.push("เจ็บแน่นหน้าอก");
    if(document.getElementById('sign-hypo').checked) signs.push("ความดันตก");
    if(document.getElementById('sign-shock').checked) signs.push("ช็อก/ปลายมือเย็น");
    
    let statusHTML = signs.length > 0 
        ? `<span style="color:#d93025; font-weight:bold;">UNSTABLE</span> (พบ: ${signs.join(', ')})` 
        : `<span style="color:#0f9d58; font-weight:bold;">STABLE</span>`;
        
    document.getElementById('summary-content').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items: center;">
            <span><b>HR:</b> ${hr} bpm | <b>BP:</b> ${bp} mmHg</span>
            <span>
                <b>Rhythm:</b> 
                <span id="rhythm-display" style="display:none; color:#d93025; font-weight:bold;">
                    ${rhythm} ${defectLeads.toLowerCase() !== 'all' ? `(ที่ Lead: ${defectLeads})` : ''}
                </span>
                <button id="btn-show-rhythm" class="btn-blue btn-small" style="margin-left:8px;" onclick="toggleRhythmDisplay()">แสดง</button>
            </span>
        </div>
        <div style="margin-top:5px;"><b>สถานะผู้ป่วย:</b> ${statusHTML}</div>
    `;
    
    document.getElementById('display-hr').innerText = hr;
    document.getElementById('display-bp').innerText = bp;
}

function drawEKG() {
    const canvas = document.getElementById('ekg-canvas');
    const ctx = canvas.getContext('2d');
    
    function render() {
        requestAnimationFrame(render);
        
        // ทำให้แน่ใจว่าขนาด Canvas ตรงกับหน้าจอเสมอ (ป้องกัน EKG สั้น)
        let displayWidth = canvas.parentElement.clientWidth;
        let displayHeight = canvas.parentElement.clientHeight;
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            state.currentX = 0;
        }

        const hr = parseInt(document.getElementById('hr-input').value) || 80;
        const mainRhythm = document.getElementById('rhythm-select').value;
        const defectText = document.getElementById('lead-defect').value.toUpperCase();
        
        let speed = 2; // ความเร็วในการกวาด (พิกเซลต่อเฟรม)
        ctx.lineWidth = 2;

        for (let i = 0; i < speed; i++) {
            state.currentX++;
            state.time += 0.004; // สเกลเวลา (ยิ่งน้อยคลื่นยิ่งกว้าง)
            
            if (state.currentX >= canvas.width) {
                state.currentX = 0;
                state.lastY = null;
                state.lastY_12.fill(null);
                state.lastY_II = null;
            }
            
            let phase = (state.time * (hr / 60)) % 1; 
            
            // ยางลบ (ลบเส้นล่วงหน้า 15 พิกเซล)
            ctx.clearRect(state.currentX, 0, 15, canvas.height);
            
            if(state.mode === 'defib') {
                ctx.strokeStyle = '#00ff00';
                let y = (canvas.height / 2) + getECGValue(phase, mainRhythm);
                
                // วาดเส้นแบบ Pixel-by-Pixel ต่อเนื่อง
                if (state.currentX > 0 && state.lastY !== null) {
                    ctx.beginPath();
                    ctx.moveTo(state.currentX - 1, state.lastY);
                    ctx.lineTo(state.currentX, y);
                    ctx.stroke();
                }
                state.lastY = y;
                
                if(state.sync && phase > 0.29 && phase < 0.31) {
                    ctx.fillStyle = 'yellow';
                    ctx.fillRect(state.currentX, y - 30, 2, 15);
                }
            } else {
                // โหมด 12-Lead
                ctx.strokeStyle = '#333333';
                let cellW = canvas.width / 4;
                let cellH = canvas.height / 4; 
                
                let col = Math.floor(state.currentX / cellW);
                let prevCol = Math.floor((state.currentX - 1) / cellW);
                let crossBoundary = col !== prevCol; // ป้องกันเส้นลากข้ามคอลัมน์
                if (col > 3) col = 3;
                
                for(let row = 0; row < 3; row++) {
                    let leadName = leads12[row][col];
                    let isDefect = defectText === 'ALL' || defectText.includes(leadName);
                    let rhythmToUse = isDefect ? mainRhythm : 'nsr';
                    let yOffset = (row * cellH) + (cellH / 2) + getECGValue(phase, rhythmToUse);
                    
                    if (!crossBoundary && state.currentX > 0 && state.lastY_12[row] !== null) {
                        ctx.beginPath();
                        ctx.moveTo(state.currentX - 1, state.lastY_12[row]);
                        ctx.lineTo(state.currentX, yOffset);
                        ctx.stroke();
                    }
                    state.lastY_12[row] = yOffset;
                }

                // แถวล่างสุด Rhythm Strip (Lead II ยาวตลอดแนว)
                let isDefectII = defectText === 'ALL' || defectText.includes('II');
                let yOffsetII = (3 * cellH) + (cellH / 2) + getECGValue(phase, isDefectII ? mainRhythm : 'nsr');
                if (state.currentX > 0 && state.lastY_II !== null) {
                    ctx.beginPath();
                    ctx.moveTo(state.currentX - 1, state.lastY_II);
                    ctx.lineTo(state.currentX, yOffsetII);
                    ctx.stroke();
                }
                state.lastY_II = yOffsetII;
            }
        }
        
        // วาดตัวหนังสือทับเสมอเพื่อไม่ให้ยางลบลบหายไป
        if (state.mode === 'defib') {
            ctx.fillStyle = '#0f0';
            ctx.font = 'bold 18px Prompt';
            ctx.fillText('Lead II', 15, 30);
        } else {
            let cellW = canvas.width / 4;
            let cellH = canvas.height / 4; 
            ctx.font = 'bold 14px Prompt';
            for(let c = 0; c < 4; c++) {
                for(let r = 0; r < 3; r++) {
                    ctx.fillStyle = '#005bb5';
                    ctx.fillText(leads12[r][c], (c * cellW) + 10, (r * cellH) + 25);
                }
            }
            ctx.fillStyle = '#d93025';
            ctx.fillText('II (Rhythm Strip)', 10, (3 * cellH) + 25);
        }
    }
    render();
}

function toggleMachine() {
    state.mode = document.getElementById('machine-mode').value;
    const body = document.getElementById('app-body');
    const defibControls = document.getElementById('defib-controls');
    const canvas = document.getElementById('ekg-canvas');
    const ctx = canvas.getContext('2d');
    
    if(state.mode === 'defib') {
        body.className = 'theme-zoll';
        defibControls.style.display = 'block';
    } else {
        body.className = 'theme-nihon';
        defibControls.style.display = 'none';
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.currentX = 0; 
    state.lastY = null;
    state.lastY_12.fill(null);
    state.lastY_II = null;
}

function setDefibMode(mode) {
    state.defibMode = mode;
    document.getElementById('defib-sub-panel').style.display = mode === 'defib' ? 'block' : 'none';
    document.getElementById('pace-sub-panel').style.display = mode === 'pace' ? 'block' : 'none';
}
function toggleSync() {
    state.sync = !state.sync;
    document.getElementById('sync-status').style.display = state.sync ? 'inline-block' : 'none';
    document.getElementById('btn-sync').style.background = state.sync ? '#0f9d58' : '#005bb5';
}
function startShock() {
    const energy = document.getElementById('energy-select').value;
    if(state.sync) {
        document.getElementById('shock-progress').style.display = 'block';
        state.shockTimer = setTimeout(() => {
            alert(`⚡ ปล่อยพลังงานช็อกที่ ${energy} Joules (SYNC)`);
            document.getElementById('shock-progress').style.display = 'none';
        }, 1500);
    } else {
        alert(`⚡ ปล่อยพลังงานช็อกที่ ${energy} Joules (ASYNC)`);
    }
}
function cancelShock() {
    if(state.shockTimer && state.sync) {
        clearTimeout(state.shockTimer);
        document.getElementById('shock-progress').style.display = 'none';
    }
}
function triggerAction(actionName) { alert(`📝 บันทึกการรักษา: ${actionName}`); }

window.onload = () => {
    updateSummary();
    drawEKG(); // เรียกครั้งเดียวพอ
    toggleMachine();
};
