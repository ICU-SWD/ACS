let state = {
    mode: '12lead', sync: false, defibMode: 'monitor', shockTimer: null, currentX: 0
};

const leads12 = [
    ['I', 'aVR', 'V1', 'V4'],
    ['II', 'aVL', 'V2', 'V5'],
    ['III', 'aVF', 'V3', 'V6']
];

// ฟังก์ชันจำลองคลื่น Gaussian ให้โค้งมนสมจริง
function gaussian(x, a, b, c) {
    return a * Math.exp(-Math.pow(x - b, 2) / (2 * c * c));
}

function getECGValue(phase, rhythm) {
    let y = 0;
    if (rhythm === 'asystole') return (Math.random() - 0.5) * 3;
    if (rhythm === 'vf') return Math.sin(phase * Math.PI * 10) * 15 + Math.sin(phase * Math.PI * 25) * 10 + (Math.random()-0.5)*10;
    if (rhythm === 'vt') return Math.sin(phase * Math.PI * 5) * 35;
    if (rhythm === 'pea' || rhythm === 'nsr' || rhythm.includes('st') || rhythm.includes('t')) {
        y += gaussian(phase, 8, 0.15, 0.02);   // P Wave
        y += gaussian(phase, -10, 0.28, 0.01); // Q Wave
        y += gaussian(phase, 45, 0.30, 0.015); // R Wave
        y += gaussian(phase, -15, 0.32, 0.015);// S Wave
        
        if (rhythm === 'peak-t') y += gaussian(phase, 30, 0.55, 0.04);
        else if (rhythm === 't-inv') y += gaussian(phase, -12, 0.55, 0.04);
        else y += gaussian(phase, 12, 0.55, 0.04);

        if (rhythm === 'st-elev') {
            y += gaussian(phase, 20, 0.40, 0.03); 
            y += gaussian(phase, 15, 0.45, 0.04); 
        } else if (rhythm === 'st-dep') {
            y += gaussian(phase, -12, 0.40, 0.03);
        }
    }
    return -y; 
}

// เปิด-ปิด การแสดงผลเฉลย Rhythm
function toggleRhythmDisplay() {
    const el = document.getElementById('rhythm-display');
    const btn = document.getElementById('btn-show-rhythm');
    if(el.style.display === 'none') {
        el.style.display = 'inline';
        btn.innerText = 'ซ่อน';
    } else {
        el.style.display = 'none';
        btn.innerText = 'แสดง';
    }
}

// อัปเดตข้อมูลสรุปอาการคนไข้
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

// ระบบวาด EKG แบบ Continuous Sweep เต็มจอ
function drawEKG() {
    const canvas = document.getElementById('ekg-canvas');
    const ctx = canvas.getContext('2d');
    
    function resizeCanvas() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    function render() {
        const hr = parseInt(document.getElementById('hr-input').value) || 80;
        const mainRhythm = document.getElementById('rhythm-select').value;
        const defectText = document.getElementById('lead-defect').value.toUpperCase();
        
        let timeInSeconds = (state.currentX * 0.022); 
        let phase = (timeInSeconds * (hr / 60)) % 1; 
        
        // Eraser Bar ลบเส้นล่วงหน้า
        const eraseWidth = 20;
        ctx.clearRect(state.currentX, 0, eraseWidth, canvas.height);
        
        ctx.lineWidth = 2;

        if(state.mode === 'defib') {
            // โหมด Defib
            ctx.strokeStyle = '#00ff00';
            ctx.beginPath();
            let y = (canvas.height / 2) + getECGValue(phase, mainRhythm);
            ctx.moveTo(state.currentX, y);
            ctx.lineTo(state.currentX + 2, y);
            ctx.stroke();
            
            if(state.sync && phase > 0.29 && phase < 0.31) {
                ctx.fillStyle = 'yellow';
                ctx.fillRect(state.currentX, y - 30, 4, 15);
            }
            
            if (!(state.currentX + eraseWidth > 10 && state.currentX < 80)) {
                ctx.fillStyle = '#0f0';
                ctx.font = 'bold 16px Prompt';
                ctx.fillText('Lead II', 10, 30);
            }
            
        } else {
            // โหมด 12-Lead
            ctx.strokeStyle = '#333333';
            let cellW = canvas.width / 4;
            let cellH = canvas.height / 4; 
            
            let col = Math.floor(state.currentX / cellW);
            if(col > 3) col = 3;
            
            for(let row = 0; row < 3; row++) {
                let leadName = leads12[row][col];
                let isDefect = defectText === 'ALL' || defectText.includes(leadName);
                let rhythmToUse = isDefect ? mainRhythm : 'nsr';
                
                let yOffset = (row * cellH) + (cellH / 2) + getECGValue(phase, rhythmToUse);
                
                ctx.beginPath();
                ctx.moveTo(state.currentX, yOffset);
                ctx.lineTo(state.currentX + 2, yOffset);
                ctx.stroke();
            }

            let isDefectII = defectText === 'ALL' || defectText.includes('II');
            let yOffsetII = (3 * cellH) + (cellH / 2) + getECGValue(phase, isDefectII ? mainRhythm : 'nsr');
            ctx.beginPath();
            ctx.moveTo(state.currentX, yOffsetII);
            ctx.lineTo(state.currentX + 2, yOffsetII);
            ctx.stroke();

            ctx.font = 'bold 14px Prompt';
            for(let c = 0; c < 4; c++) {
                let colX = c * cellW;
                if (!(state.currentX + eraseWidth > colX + 5 && state.currentX < colX + 40)) {
                    for(let r = 0; r < 3; r++) {
                        ctx.fillStyle = '#005bb5';
                        ctx.fillText(leads12[r][c], colX + 10, (r * cellH) + 25);
                    }
                }
            }
            if (!(state.currentX + eraseWidth > 5 && state.currentX < 140)) {
                ctx.fillStyle = '#d93025';
                ctx.fillText('II (Rhythm Strip)', 10, (3 * cellH) + 25);
            }
        }
        
        state.currentX += 2; 
        if(state.currentX >= canvas.width) {
            state.currentX = 0;
        }
        
        requestAnimationFrame(render);
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
    toggleMachine();
    drawEKG();
};
