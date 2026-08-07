let state = {
    mode: '12lead', 
    sync: false, 
    defibMode: 'monitor',
    shockTimer: null
};

// สลับโหมดหน้าจอระหว่าง Nihon และ Zoll
function toggleMachine() {
    const mode = document.getElementById('machine-mode').value;
    state.mode = mode;
    const body = document.getElementById('app-body');
    const defibControls = document.getElementById('defib-controls');
    
    if(mode === 'defib') {
        body.className = 'theme-zoll';
        defibControls.style.display = 'block';
    } else {
        body.className = 'theme-nihon';
        defibControls.style.display = 'none';
    }
}

// เลือกโหมดย่อยของ Defib (Monitor, Defib, Pace)
function setDefibMode(mode) {
    state.defibMode = mode;
    document.getElementById('defib-sub-panel').style.display = mode === 'defib' ? 'block' : 'none';
    document.getElementById('pace-sub-panel').style.display = mode === 'pace' ? 'block' : 'none';
}

// เปิด/ปิดโหมด Sync
function toggleSync() {
    state.sync = !state.sync;
    document.getElementById('sync-status').style.display = state.sync ? 'inline-block' : 'none';
    document.getElementById('btn-sync').style.background = state.sync ? '#00cc00' : '#555';
}

// ระบบกดช็อก (รองรับการกดแช่ในโหมด Sync)
function startShock() {
    const energy = document.getElementById('energy-select').value;
    
    if(state.sync) {
        document.getElementById('shock-progress').style.display = 'block';
        // จำลองการกดแช่ 1.5 วินาที เพื่อปล่อยพลังงานในโหมด Sync
        state.shockTimer = setTimeout(() => {
            deliverShock(energy);
            document.getElementById('shock-progress').style.display = 'none';
        }, 1500);
    } else {
        deliverShock(energy);
    }
}

function cancelShock() {
    if(state.shockTimer && state.sync) {
        clearTimeout(state.shockTimer);
        document.getElementById('shock-progress').style.display = 'none';
    }
}

function deliverShock(energy) {
    alert(`⚡ ปล่อยพลังงานช็อกที่ ${energy} Joules!`);
}

// แสดง Feedback ให้ผู้สอน/ผู้เรียนเวลาให้ยาหรือทำ CPR
function triggerAction(actionName) {
    // แสดง Alert ง่ายๆ หน้าจอ ไม่ต้องส่งไปหลังบ้าน
    alert(`ผู้เรียนดำเนินการ: ${actionName}`);
}

// วาดคลื่น EKG จำลองบน Canvas
function drawEKG() {
    const canvas = document.getElementById('ekg-canvas');
    const ctx = canvas.getContext('2d');
    
    // ปรับขนาด Canvas ให้พอดีกับ Container
    function resizeCanvas() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight * 0.7;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    let x = 0;
    
    function render() {
        // วาดพื้นหลังตามโหมด
        ctx.fillStyle = state.mode === 'defib' ? '#111' : '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const hr = parseInt(document.getElementById('hr-input').value) || 80;
        const rhythm = document.getElementById('rhythm-select').value;
        
        ctx.beginPath();
        ctx.strokeStyle = state.mode === 'defib' ? '#0f0' : '#000';
        ctx.lineWidth = 2;

        // วาดเส้นกราฟ (คณิตศาสตร์จำลอง)
        for(let i = 0; i < canvas.width; i++) {
            let y = canvas.height / 2;
            let time = (i + x) * (hr / 60) * 0.05; 
            
            if(rhythm === 'vf') {
                y += Math.sin(time * 5) * 40 + Math.random() * 20; 
            } else if (rhythm === 'vt') {
                y += Math.sin(time * 3) * 60; 
            } else if (rhythm === 'asystole') {
                y += Math.random() * 2; 
            } else {
                // โครงสร้าง P-QRS-T พื้นฐาน
                let phase = time % 10;
                if(phase > 1 && phase < 1.5) y -= 10; // P wave
                if(phase > 2 && phase < 2.2) y += 10; // Q
                
                if(phase > 2.2 && phase < 2.5) { 
                    y -= 60; // R wave
                    // มาร์คเกอร์สีเหลืองสำหรับโหมด Sync
                    if(state.sync && i % 200 === 0) {
                        ctx.fillStyle = 'yellow';
                        ctx.fillRect(i-2, y-20, 4, 10);
                    }
                }
                
                if(phase > 2.5 && phase < 2.8) y += 20; // S
                if(phase > 4 && phase < 5) {
                    y -= (rhythm === 'peak-t' ? 40 : (rhythm === 't-inv' ? -15 : 15)); // T wave
                }
                
                // ความผิดปกติของ ST segment
                if(rhythm === 'st-elev' && phase > 2.8 && phase < 4) y -= 25;
                if(rhythm === 'st-dep' && phase > 2.8 && phase < 4) y += 20;
            }
            
            i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
        }
        ctx.stroke();
        x += 2; // ความเร็วในการเลื่อนกราฟ
        requestAnimationFrame(render);
    }
    render();
}

// อัปเดตตัวเลข Vitals Sign บนหน้าจอมอนิเตอร์ทุกๆ 1 วินาที
setInterval(() => {
    document.getElementById('display-hr').innerText = document.getElementById('hr-input').value;
    document.getElementById('display-bp').innerText = document.getElementById('bp-input').value;
}, 1000);

// เริ่มการทำงานของระบบเมื่อโหลดหน้าเว็บเสร็จ
window.onload = () => {
    toggleMachine();
    drawEKG();
};
