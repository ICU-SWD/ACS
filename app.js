let state = {
    mode: '12lead', sync: false, defibMode: 'monitor', shockTimer: null, 
    currentX: 0, time: 0, lastY: null, lastY_12: Array(3).fill(null), lastY_II: null,
    beatPhase: 0, beatIndex: 0, phaseMultiplier: 1
};

const leads12 = [
    ['I', 'aVR', 'V1', 'V4'],
    ['II', 'aVL', 'V2', 'V5'],
    ['III', 'aVF', 'V3', 'V6']
];

function gaussian(x, a, b, c) { return a * Math.exp(-Math.pow(x - b, 2) / (2 * c * c)); }

function getECGValue(phase, rhythm, time, hr, beatIndex) {
    let isPacing = state.defibMode === 'pace';
    let paceMA = parseInt(document.getElementById('pace-ma').value) || 0;
    let paceRate = parseInt(document.getElementById('pace-rate').value) || 70;

    // ถ้ากำลัง Pacing และกระแสไฟฟ้าแรงพอ (>= 50 mA) ให้วาดคลื่น Paced QRS ทับคลื่นปกติ
    if (isPacing && paceMA >= 50) {
        let pacePhase = (time * (paceRate / 60)) % 1;
        let y = 0;
        y += gaussian(pacePhase, -10, 0.05, 0.015);
        y += gaussian(pacePhase, 60, 0.08, 0.025); // Wide QRS
        y += gaussian(pacePhase, -20, 0.11, 0.015);
        y += gaussian(pacePhase, -20, 0.30, 0.04); // Discordant T wave
        return -y;
    }

    if (rhythm === 'asystole') return (Math.random() - 0.5) * 3;
    if (rhythm === 'vf') return Math.sin(phase * Math.PI * 10) * 15 + Math.sin(phase * Math.PI * 22) * 10 + (Math.random()-0.5)*10;
    if (rhythm === 'vt') return Math.sin(phase * Math.PI * 6) * 40; 
    if (rhythm === 'tdp') { 
        let envelope = Math.sin(time * 1.5) * 25 + 15; 
        return -(Math.sin(time * 25) * envelope + (Math.random()-0.5)*5);
    }

    let pCenter = 0.15, qCenter = 0.28, rCenter = 0.30, sCenter = 0.32, tCenter = 0.55;
    let showP = true, showQRS = true, showT = true;
    
    if (rhythm === 'af') {
        showP = false; y += Math.sin(time * 25) * 2 + Math.sin(time * 15) * 3 + (Math.random()-0.5)*2; 
    } else if (rhythm === 'aflutter') {
        showP = false; y += Math.sin(time * 18) * 6 + Math.cos(time * 36) * 3; 
    } else if (rhythm === 'svt') {
        showP = false; tCenter = 0.80; 
    } else if (rhythm === '1st-avb') {
        pCenter = 0.05; 
    } else if (rhythm === '2nd-avb-1') { 
        let cycle = beatIndex % 4;
        if (cycle === 0) pCenter = 0.15; if (cycle === 1) pCenter = 0.10;
        if (cycle === 2) pCenter = 0.05; if (cycle === 3) { showQRS = false; showT = false; }
    } else if (rhythm === '2nd-avb-2') { 
        if (beatIndex % 3 === 2) { showQRS = false; showT = false; }
    } else if (rhythm === '3rd-avb') {
        showP = false; let pPhase = (time * (80 / 60)) % 1; y += gaussian(pPhase, 6, 0.15, 0.015);
    }

    if (showP) y += gaussian(phase, 6, pCenter, 0.015);
    if (showQRS) { y += gaussian(phase, -12, qCenter, 0.008); y += gaussian(phase, 60, rCenter, 0.01); y += gaussian(phase, -18, sCenter, 0.008); }
    if (showT) {
        if (rhythm === 'peak-t') y += gaussian(phase, 85, tCenter, 0.035); 
        else if (rhythm === 't-inv') y += gaussian(phase, -15, tCenter, 0.03);
        else if (rhythm === 'svt') y += gaussian(phase, 20, tCenter, 0.025); 
        else y += gaussian(phase, 15, tCenter, 0.03);
    }
    if (showQRS && rhythm === 'st-elev') { y += gaussian(phase, 25, 0.40, 0.04); y += gaussian(phase, 15, 0.45, 0.04); } 
    else if (showQRS && rhythm === 'st-dep') { y += gaussian(phase, -15, 0.40, 0.04); }

    return -y; 
}

/* ====================================================================
   ระบบประเมินผลการรักษา (Smart Evaluator Logic)
==================================================================== */
function showFeedback(isCorrect, message) {
    const modal = document.getElementById('feedback-modal');
    const msgEl = document.getElementById('feedback-msg');
    modal.className = isCorrect ? 'modal-success' : 'modal-error';
    msgEl.innerHTML = (isCorrect ? '✅ ' : '❌ ') + message;
    modal.style.display = 'block';
    setTimeout(() => { modal.style.display = 'none'; }, 4000); 
}

function closeFeedback() { document.getElementById('feedback-modal').style.display = 'none'; }

function evaluateAction(action) {
    let hr = parseInt(document.getElementById('hr-input').value) || 80;
    let rhythm = document.getElementById('rhythm-select').value;
    let isHypo = document.getElementById('sign-hypo').checked;
    let isUnstable = document.querySelectorAll('.checkbox-group input:checked').length > 0;

    let correct = false;
    let msg = "";

    // 1. Arrest Rhythms (Dead)
    if (['vf', 'vt', 'pea', 'asystole'].includes(rhythm)) {
        if (rhythm === 'vf' || rhythm === 'vt') {
            if (action === 'Shock (Defib)') { correct = true; msg = "ถูกต้อง! VF/pVT ต้องทำ Defibrillation (Asynchronized)"; }
            else if (action === 'CPR') { correct = true; msg = "ถูกต้อง! VF/pVT ต้องทำ CPR ควบคู่กันไปทันที"; }
            else { correct = false; msg = "ผิด! ภาวะ VF/pVT ต้องเริ่ม CPR และช็อกไฟฟ้า (Defib) ทันที"; }
        } else {
            if (action === 'CPR' || action === 'Adrenaline') { correct = true; msg = `ถูกต้อง! ${rhythm.toUpperCase()} ให้เน้น CPR และให้ Adrenaline`; }
            else { correct = false; msg = `ผิด! ${rhythm.toUpperCase()} ห้ามช็อกไฟฟ้า ให้รีบทำ CPR และพิจารณา Adrenaline`; }
        }
    }
    // 2. AV Blocks (1st, 2nd, 3rd)
    else if (rhythm.includes('avb')) {
        if (action === 'Pace') { correct = true; msg = "ยอดเยี่ยม! ผู้ป่วย AV Block สามารถพิจารณาทำ Transcutaneous Pacing ได้"; }
        else { correct = false; msg = "ผิด! ผู้ป่วยมีปัญหา AV Block การรักษาหลักคือการทำ Pacing"; }
    }
    // 3. Bradycardia (HR < 60)
    else if (hr < 60) {
        if (isUnstable) {
            if (['Dopamine', 'Adrenaline', 'Atropine', 'Pace'].includes(action)) { correct = true; msg = "ถูกต้อง! Bradycardia แบบ Unstable ให้ Atropine, Inotropes หรือ Pacing ได้"; }
            else { correct = false; msg = "ผิด! Unstable Bradycardia ควรให้ Atropine, Dopamine, Adrenaline หรือ Pace"; }
        } else {
            if (action === 'Observe') { correct = true; msg = "ถูกต้อง! Bradycardia แบบ Stable ให้สังเกตอาการ (Observe)"; }
            else { correct = false; msg = "ผิด! อาการยัง Stable ไม่จำเป็นต้องรีบแทรกแซงยา ให้สังเกตอาการต่อ"; }
        }
    }
    // 4. Tachycardia (AF, A-Flutter, SVT)
    else if (['af', 'aflutter', 'svt'].includes(rhythm)) {
        if (isUnstable) {
            if (action === 'Shock (Sync)') { correct = true; msg = "ยอดเยี่ยม! Tachyarrhythmia ที่ Unstable ต้องทำ Synchronized Cardioversion"; }
            else { correct = false; msg = "ผิด! ผู้ป่วย Unstable ต้องรีบทำ Synchronized Cardioversion (ช็อกโหมด Sync)"; }
        } else {
            if (['af', 'aflutter'].includes(rhythm) && action === 'Amiodarone') { correct = true; msg = "ถูกต้อง! AF/A-Flutter แบบ Stable ให้ยา Amiodarone"; }
            else if (rhythm === 'svt' && action === 'Adenosine') { correct = true; msg = "ถูกต้อง! SVT แบบ Stable ให้พิจารณา Adenosine"; }
            else { correct = false; msg = `ผิด! ${rhythm.toUpperCase()} แบบ Stable ควรให้ยาควบคุมการเต้นให้ตรงกับ Algorithm`; }
        }
    }
    // 5. Hypotension
    else if (isHypo) {
        if (['Dopamine', 'Adrenaline', 'Levophed'].includes(action)) { correct = true; msg = "ถูกต้อง! Hypotension สามารถให้ Vasopressor ได้ (Dopamine, Adrenaline, Levophed)"; }
        else { correct = false; msg = "ผิด! ผู้ป่วยความดันตก ควรให้ Vasopressor หรือ Inotropes"; }
    }
    // 6. Normal/Other Stable
    else {
        if (action === 'Observe') { correct = true; msg = "ถูกต้อง! ผู้ป่วยอาการปกติ ให้สังเกตอาการต่อไปได้"; }
        else { correct = false; msg = "ผิด! ผู้ป่วยอาการอยู่ในเกณฑ์ปกติ ไม่จำเป็นต้องแทรกแซงการรักษาเพิ่มเติม"; }
    }

    showFeedback(correct, msg);
}

// ----------------------------------------------------------------------

function updateLeadDefectUI() {
    const mode = document.getElementById('lead-defect-mode').value;
    document.getElementById('custom-lead-selector').style.display = mode === 'CUSTOM' ? 'grid' : 'none';
}

function getDefectiveLeads() {
    const mode = document.getElementById('lead-defect-mode').value;
    if(mode === 'ALL') return ['ALL'];
    if(mode === 'INFERIOR') return ['II', 'III', 'aVF'];
    if(mode === 'ANTERIOR') return ['V1', 'V2', 'V3', 'V4'];
    if(mode === 'LATERAL') return ['I', 'aVL', 'V5', 'V6'];
    if(mode === 'CUSTOM') {
        let checks = document.querySelectorAll('#custom-lead-selector input:checked');
        return Array.from(checks).map(cb => cb.value);
    }
    return [];
}

function toggleRhythmDisplay() {
    const el = document.getElementById('rhythm-display');
    const btn = document.getElementById('btn-show-rhythm');
    if(el.style.display === 'none') { el.style.display = 'inline'; btn.innerText = 'ซ่อน'; } 
    else { el.style.display = 'none'; btn.innerText = 'แสดง'; }
}

function updateSummary() {
    let hr = document.getElementById('hr-input').value;
    let bp = document.getElementById('bp-input').value;
    let rhythm = document.getElementById('rhythm-select').options[document.getElementById('rhythm-select').selectedIndex].text;
    
    let defLeads = getDefectiveLeads();
    let defectString = defLeads.includes('ALL') ? 'All Leads' : defLeads.join(', ');
    if(defectString === '') defectString = 'None';
    
    let signs = [];
    if(document.getElementById('sign-loc').checked) signs.push("ซึม/สับสน");
    if(document.getElementById('sign-hf').checked) signs.push("น้ำท่วมปอด/หอบเหนื่อย");
    if(document.getElementById('sign-cp').checked) signs.push("เจ็บแน่นหน้าอก");
    if(document.getElementById('sign-hypo').checked) signs.push("ความดันตก");
    if(document.getElementById('sign-shock').checked) signs.push("ช็อก/ปลายมือเย็น");
    
    let statusHTML = signs.length > 0 ? `<span style="color:#d93025; font-weight:bold;">UNSTABLE</span> (พบ: ${signs.join(', ')})` : `<span style="color:#0f9d58; font-weight:bold;">STABLE</span>`;
        
    document.getElementById('summary-content').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items: center;">
            <span><b>HR:</b> ${hr} bpm | <b>BP:</b> ${bp} mmHg</span>
            <span>
                <b>Rhythm:</b> <span id="rhythm-display" style="display:none; color:#d93025; font-weight:bold;">${rhythm} ${defectString !== 'All Leads' && defectString !== 'None' ? `(พบที่: ${defectString})` : ''}</span>
                <button id="btn-show-rhythm" class="btn-blue btn-small" style="margin-left:8px;" onclick="toggleRhythmDisplay()">แสดง</button>
            </span>
        </div>
        <div style="margin-top:5px;"><b>สถานะผู้ป่วย:</b> ${statusHTML}</div>
    `;
    
    document.getElementById('display-hr').innerText = hr; document.getElementById('display-bp').innerText = bp;
}

function exportEKG() {
    const canvas = document.getElementById('ekg-canvas'); const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width; exportCanvas.height = canvas.height; const eCtx = exportCanvas.getContext('2d');
    if (state.mode === '12lead') {
        eCtx.fillStyle = '#ffffff'; eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height); eCtx.lineWidth = 1;
        for(let x = 0; x < exportCanvas.width; x += 10) {
            eCtx.beginPath(); eCtx.moveTo(x, 0); eCtx.lineTo(x, exportCanvas.height);
            eCtx.strokeStyle = (x % 50 === 0) ? 'rgba(255, 0, 0, 0.4)' : 'rgba(255, 192, 203, 0.6)'; eCtx.stroke();
        }
        for(let y = 0; y < exportCanvas.height; y += 10) {
            eCtx.beginPath(); eCtx.moveTo(0, y); eCtx.lineTo(exportCanvas.width, y);
            eCtx.strokeStyle = (y % 50 === 0) ? 'rgba(255, 0, 0, 0.4)' : 'rgba(255, 192, 203, 0.6)'; eCtx.stroke();
        }
    } else { eCtx.fillStyle = '#111111'; eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height); }
    eCtx.drawImage(canvas, 0, 0);
    const rhythmName = document.getElementById('rhythm-select').options[document.getElementById('rhythm-select').selectedIndex].text;
    const hr = document.getElementById('hr-input').value;
    const link = document.createElement('a'); link.download = `EKG_${state.mode}_${rhythmName}_${hr}BPM.png`;
    link.href = exportCanvas.toDataURL('image/png'); link.click();
}

function toggleFullScreen() {
    const elem = document.getElementById("monitor-display"); const btn = document.getElementById("fullscreen-btn");
    if (!document.fullscreenElement) {
        if (elem.requestFullscreen) { elem.requestFullscreen(); } else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); } 
        btn.innerText = "ย่อจอ";
    } else {
        if (document.exitFullscreen) { document.exitFullscreen(); } else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); } 
        btn.innerText = "⛶ เต็มจอ";
    }
}
document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) { document.getElementById("fullscreen-btn").innerText = "⛶ เต็มจอ"; }
});

function drawEKG() {
    const canvas = document.getElementById('ekg-canvas');
    const ctx = canvas.getContext('2d');
    
    function render() {
        requestAnimationFrame(render);
        
        let displayWidth = canvas.parentElement.clientWidth; let displayHeight = canvas.parentElement.clientHeight;
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth; canvas.height = displayHeight; state.currentX = 0;
        }

        const hr = parseInt(document.getElementById('hr-input').value) || 80;
        const mainRhythm = document.getElementById('rhythm-select').value;
        const defectLeadsList = getDefectiveLeads();
        
        let isPacing = state.defibMode === 'pace';
        let paceRate = parseInt(document.getElementById('pace-rate').value) || 70;
        let speed = 2; ctx.lineWidth = 2;

        for (let i = 0; i < speed; i++) {
            state.currentX++; state.time += 0.004; 
            
            if (state.currentX >= canvas.width) {
                state.currentX = 0; state.lastY = null; state.lastY_12.fill(null); state.lastY_II = null;
            }
            
            // Pacer Spikes Logic (ลากแท่งไฟฟ้า)
            let prevPacePhase = ((state.time - 0.004) * (paceRate / 60)) % 1;
            let currPacePhase = (state.time * (paceRate / 60)) % 1;
            if (isPacing && currPacePhase < prevPacePhase) {
                ctx.fillStyle = '#ffffff'; ctx.fillRect(state.currentX, 0, 2, canvas.height); // ลากเส้น Pacing Spike ขาวๆ เต็มจอ
            }

            let baseStep = (hr / 60) * 0.004;
            if (mainRhythm === 'af') { baseStep *= (state.phaseMultiplier || 1); }
            state.beatPhase += baseStep;
            if (state.beatPhase >= 1) {
                state.beatPhase -= 1; state.beatIndex++;
                if (mainRhythm === 'af') { state.phaseMultiplier = 0.6 + Math.random() * 0.9; } else { state.phaseMultiplier = 1; }
            }
            let phase = state.beatPhase;
            
            ctx.clearRect(state.currentX, 0, 15, canvas.height); 
            
            if(state.mode === 'defib') {
                ctx.strokeStyle = '#00ff00';
                let y = (canvas.height / 2) + getECGValue(phase, mainRhythm, state.time, hr, state.beatIndex);
                if (state.currentX > 0 && state.lastY !== null) { ctx.beginPath(); ctx.moveTo(state.currentX - 1, state.lastY); ctx.lineTo(state.currentX, y); ctx.stroke(); }
                state.lastY = y;
                if(state.sync && phase > 0.29 && phase < 0.31) { ctx.fillStyle = 'yellow'; ctx.fillRect(state.currentX, y - 30, 2, 15); }
            } else {
                ctx.strokeStyle = '#333333'; let cellW = canvas.width / 4; let cellH = canvas.height / 4; 
                let col = Math.floor(state.currentX / cellW); let prevCol = Math.floor((state.currentX - 1) / cellW); let crossBoundary = col !== prevCol; if (col > 3) col = 3;
                
                for(let row = 0; row < 3; row++) {
                    let leadName = leads12[row][col]; let isDefect = defectLeadsList.includes('ALL') || defectLeadsList.includes(leadName); let rhythmToUse = isDefect ? mainRhythm : 'nsr';
                    let yOffset = (row * cellH) + (cellH / 2) + getECGValue(phase, rhythmToUse, state.time, hr, state.beatIndex);
                    if (!crossBoundary && state.currentX > 0 && state.lastY_12[row] !== null) { ctx.beginPath(); ctx.moveTo(state.currentX - 1, state.lastY_12[row]); ctx.lineTo(state.currentX, yOffset); ctx.stroke(); }
                    state.lastY_12[row] = yOffset;
                }
                let isDefectII = defectLeadsList.includes('ALL') || defectLeadsList.includes('II');
                let yOffsetII = (3 * cellH) + (cellH / 2) + getECGValue(phase, isDefectII ? mainRhythm : 'nsr', state.time, hr, state.beatIndex);
                if (state.currentX > 0 && state.lastY_II !== null) { ctx.beginPath(); ctx.moveTo(state.currentX - 1, state.lastY_II); ctx.lineTo(state.currentX, yOffsetII); ctx.stroke(); }
                state.lastY_II = yOffsetII;
            }
        }
        
        if (state.mode === 'defib') {
            ctx.fillStyle = '#0f0'; ctx.font = 'bold 18px Prompt'; ctx.fillText('Lead II', 15, 30);
        } else {
            let cellW = canvas.width / 4; let cellH = canvas.height / 4; ctx.font = 'bold 14px Prompt';
            for(let c = 0; c < 4; c++) { for(let r = 0; r < 3; r++) { ctx.fillStyle = '#005bb5'; ctx.fillText(leads12[r][c], (c * cellW) + 10, (r * cellH) + 25); } }
            ctx.fillStyle = '#d93025'; ctx.fillText('II (Rhythm Strip)', 10, (3 * cellH) + 25);
        }
    }
    render();
}

function toggleMachine() {
    state.mode = document.getElementById('machine-mode').value;
    const body = document.getElementById('app-body');
    const defibControls = document.getElementById('defib-controls');
    const ctx = document.getElementById('ekg-canvas').getContext('2d');
    
    if(state.mode === 'defib') { body.className = 'theme-zoll'; defibControls.style.display = 'block'; } 
    else { body.className = 'theme-nihon'; defibControls.style.display = 'none'; }
    ctx.clearRect(0, 0, document.getElementById('ekg-canvas').width, document.getElementById('ekg-canvas').height);
    state.currentX = 0; state.lastY = null; state.lastY_12.fill(null); state.lastY_II = null; state.beatPhase = 0; 
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
    if(state.sync) {
        document.getElementById('shock-progress').style.display = 'block';
        state.shockTimer = setTimeout(() => {
            document.getElementById('shock-progress').style.display = 'none';
            evaluateAction('Shock (Sync)');
        }, 1500);
    } else {
        evaluateAction('Shock (Defib)');
    }
}

function cancelShock() {
    if(state.shockTimer && state.sync) {
        clearTimeout(state.shockTimer);
        document.getElementById('shock-progress').style.display = 'none';
    }
}

function evaluatePace() {
    let ma = parseInt(document.getElementById('pace-ma').value) || 0;
    if(ma >= 50) {
        evaluateAction('Pace');
    } else {
        showFeedback(false, "ตั้งค่าพลังงาน Pacing ต่ำเกินไป (ต้อง ≥ 50 mA จึงจะเกิด Capture)");
    }
}

function triggerAction(actionName) { evaluateAction(actionName); }

window.onload = () => { updateSummary(); drawEKG(); toggleMachine(); };
