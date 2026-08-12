// --- AUDIO INITIALIZATION ---
let audioCtx;
let isMuted = false;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Toggle Mute Function
function toggleMute() {
    isMuted = !isMuted;
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
    }
}

// Food Collect Sound (High pitched quick chirp)
function playFoodSFX() {
    if (isMuted) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

// Jump Sound (Quick frequency sweep upward)
function playJumpSFX() {
    if (isMuted) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

// Game Over Sound (Frequency drops down)
function playGameOverSFX() {
    if (isMuted) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

// Win Fanfare Sound (Triumphant double-beep)
function playWinSFX() {
    if (isMuted) return;
    initAudio();
    const notes = [261.63, 329.63, 392.00, 523.25]; // C, E, G, High C
    notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const startTime = audioCtx.currentTime + (index * 0.1);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + 0.12);
    });
}

// --- GAME SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Dynamic dimensions
let W = 800;
let H = 400;
let GROUND_Y = 330;
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 32;

// --- DOM ELEMENTS ---
const menuScreen = document.getElementById('menu-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const winScreen = document.getElementById('win-screen');
const hudEl = document.getElementById('hud');
const scoreDisplay = document.getElementById('score-display');
const nameDisplay = document.getElementById('player-name-display');
// const nameInput = document.getElementById('player-name');

// --- GAME STATE ---
let gameState = 'menu';
let score = 0;
let catColor = 'orange';
let playerName = 'Player';
let speed = 1.8;
let frameCount = 0;

// --- ASSETS ---
const catOrangeImg = new Image();
catOrangeImg.src = 'images/oyen.png';
const catGreyImg = new Image();
catGreyImg.src = 'images/oyem.png';
let catImg = catOrangeImg;

const foodImages = [];
for (let i = 1; i <= 7; i++) {
    const img = new Image();
    img.src = `images/food-${i}.png`;
    foodImages.push(img);
}

const groundImg = new Image();
groundImg.src = 'images/land.png';

const obstacleImages = [
    new Image(),
    new Image(),
    new Image(),
    new Image()
];
obstacleImages[0].src = 'images/obstacle1.png';
obstacleImages[1].src = 'images/obstacle2.png';
obstacleImages[2].src = 'images/awan1.png';
obstacleImages[3].src = 'images/awan2.png';

function isVisualObstacle(img) {
    return img === obstacleImages[2] || img === obstacleImages[3];
}

// --- GAME OBJECTS ---
const player = {
    x: 60,
    y: GROUND_Y - PLAYER_HEIGHT,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT,
    vy: 0,
    gravity: 0.42,
    jumpPower: -14,
    onGround: true,
    frame: 0,
    frameTimer: 0
};

let foods = [];
let obstacles = [];
let floatingTexts = [];

// --- RESIZE LOGIC (Placed after variable declarations) ---
function resizeCanvas() {
    const isMobile = window.innerWidth <= 640;

    if (isMobile) {
        W = 400;
        H = 700;
        GROUND_Y = 620;
    } else {
        W = 800;
        H = 400;
        GROUND_Y = 330;
    }

    canvas.width = W;
    canvas.height = H;

    if (player && player.onGround) {
        player.y = GROUND_Y - player.h;
    }
}

// Initialize canvas resolution
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- INPUT ---
const keys = { left: false, right: false, jump: false };

// --- HELPER FUNCTIONS ---
function rectCollide(r1, r2) {
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
        r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}

// --- MAIN GAME LOGIC ---
function update() {
    if (gameState !== 'playing') return;
    frameCount++;

    if (keys.left) player.x -= 2.6;
    if (keys.right) player.x += 2.6;
    player.x = Math.max(0, Math.min(W - player.w, player.x));

    if (keys.left || keys.right) {
        player.frameTimer++;
        if (player.frameTimer > 6) {
            player.frameTimer = 0;
            player.frame = (player.frame + 1) % 3;
        }
    } else {
        player.frame = 0;
        player.frameTimer = 0;
    }

    if (keys.jump && player.onGround) {
        player.vy = player.jumpPower;
        player.onGround = false;
        playJumpSFX();
    }

    player.vy += player.gravity;
    player.y += player.vy;

    if (player.y >= GROUND_Y - player.h) {
        player.y = GROUND_Y - player.h;
        player.vy = 0;
        player.onGround = true;
    }

    if (frameCount % 70 === 0) {
        if (Math.random() < 0.6) {
            const randomFood = foodImages[Math.floor(Math.random() * foodImages.length)];
            const foodW = 32;
            const foodH = 32;
            const yPos = GROUND_Y - foodH - Math.random() * 80;
            const proposedFood = {
                x: W + 20,
                y: yPos,
                w: foodW,
                h: foodH,
                img: randomFood
            };

            const overlapsObstacle = obstacles.some((obs) => {
                const buffer = 10;
                return (
                    proposedFood.x < obs.x + obs.w + buffer &&
                    proposedFood.x + proposedFood.w > obs.x - buffer &&
                    proposedFood.y < obs.y + obs.h + buffer &&
                    proposedFood.y + proposedFood.h > obs.y - buffer
                );
            });

            if (!overlapsObstacle) {
                foods.push(proposedFood);
            }
        }

        if (Math.random() < 0.4) {
            const obstacleImg = obstacleImages[Math.floor(Math.random() * obstacleImages.length)];
            const obstacleH = isVisualObstacle(obstacleImg) ? 28 : 40;
            const obstacleY = isVisualObstacle(obstacleImg) ? 60 + Math.random() * 120 : GROUND_Y - obstacleH;

            obstacles.push({
                x: W + 20,
                y: obstacleY,
                w: isVisualObstacle(obstacleImg) ? 48 : 32,
                h: obstacleH,
                img: obstacleImg
            });
        }
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= speed;
        if (obstacles[i].x + obstacles[i].w < 0) obstacles.splice(i, 1);
    }
    for (let i = foods.length - 1; i >= 0; i--) {
        foods[i].x -= speed;
        if (foods[i].x + foods[i].w < 0) foods.splice(i, 1);
    }

    for (let obs of obstacles) {
        const safeMargin = 12;
        const playerBox = {
            x: player.x + safeMargin,
            y: player.y + safeMargin,
            w: player.w - safeMargin * 2,
            h: player.h - safeMargin * 2
        };

        if (isVisualObstacle(obs.img)) {
            continue;
        }

        if (rectCollide(playerBox, obs)) {
            gameState = 'gameover';
            gameoverScreen.classList.remove('hidden');
            playGameOverSFX();
            return;
        }
    }

    for (let i = foods.length - 1; i >= 0; i--) {
        const f = foods[i];
        if (rectCollide(player, f)) {
            score += 3;
            scoreDisplay.textContent = score;
            playFoodSFX();

            floatingTexts.push({
                x: f.x,
                y: f.y - 10,
                text: '+3',
                life: 45,
                maxLife: 45
            });

            foods.splice(i, 1);

            // total score
            if (score >= 69) {
                gameState = 'win';
                winScreen.classList.remove('hidden');
                hudEl.classList.add('hidden');
                playWinSFX();
                // --- PUSH WIN EVENT TO GTM ---
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({
                    'event': 'game_win',
                    'winning_character': playerName // Sends 'Oyen' or 'Onyet'
                });

                return;
            }
        }
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 1.5;
        ft.life -= 1;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
}

function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, W, H);

    if (groundImg.complete) {
        ctx.drawImage(groundImg, 0, GROUND_Y, W, H - GROUND_Y);
    } else {
        ctx.fillStyle = '#654321';
        ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
        ctx.fillStyle = '#8B5A2B';
        ctx.fillRect(0, GROUND_Y, W, 5);
    }

    for (let obs of obstacles) {
        if (obs.img && obs.img.complete) {
            ctx.drawImage(obs.img, obs.x, obs.y, obs.w, obs.h);
        } else {
            ctx.fillStyle = '#2d6a2e';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            ctx.fillRect(obs.x - 8, obs.y + 10, 8, 6);
            ctx.fillRect(obs.x + obs.w, obs.y + 15, 8, 6);
        }
    }

    for (let f of foods) {
        if (f.img.complete) {
            ctx.drawImage(f.img, f.x, f.y, f.w, f.h);
        } else {
            ctx.fillStyle = 'yellow';
            ctx.fillRect(f.x, f.y, f.w, f.h);
        }
    }

    if (catImg.complete) {
        ctx.drawImage(catImg, player.x, player.y, player.w, player.h);
    } else {
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(player.x, player.y, player.w, player.h);
    }

    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (let ft of floatingTexts) {
        ctx.globalAlpha = ft.life / ft.maxLife;
        ctx.fillStyle = '#FFD700';
        ctx.fillText(ft.text, ft.x + player.w / 2, ft.y);
    }
    ctx.globalAlpha = 1.0;
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function selectCat(color) {
    catColor = color;
    catImg = (color === 'orange') ? catOrangeImg : catGreyImg;

    // Automatically set the display name to the selected cat's name
    playerName = (color === 'orange') ? 'Oyen' : 'Onyet';

    document.getElementById('cat-orange-btn').style.borderColor = 'transparent';
    document.getElementById('cat-grey-btn').style.borderColor = 'transparent';
    document.getElementById('cat-' + color + '-btn').style.borderColor = '#fbbf24';
}

function startGame() {
    // If the player clicks start without selecting first, default to 'Oyen'
    if (!playerName) {
        playerName = 'Oyen';
    }

    nameDisplay.textContent = playerName;

    menuScreen.classList.add('hidden');
    hudEl.classList.remove('hidden');
    score = 0;
    scoreDisplay.textContent = '0';
    gameState = 'playing';
    player.x = 60;
    player.y = GROUND_Y - player.h;
    foods = [];
    obstacles = [];
    floatingTexts = [];
}

function restartGame() {
    gameoverScreen.classList.add('hidden');
    winScreen.classList.add('hidden');
    hudEl.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    gameState = 'menu';
    score = 0;
    scoreDisplay.textContent = '0';
    // nameInput.value = '';
    nameDisplay.textContent = '';

    // --- RESET SELECTION STATE ---
    catColor = null;
    playerName = null;

    // --- REMOVE SELECTION BORDER HIGHLIGHTS ---
    const orangeBtn = document.getElementById('cat-orange-btn');
    const greyBtn = document.getElementById('cat-grey-btn');
    if (orangeBtn) orangeBtn.style.borderColor = 'transparent';
    if (greyBtn) greyBtn.style.borderColor = 'transparent';

    player.x = 60;
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
    foods = [];
    obstacles = [];
    floatingTexts = [];
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === ' ') {
        e.preventDefault();
        keys.jump = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === ' ') {
        keys.jump = false;
    }
});

function getTouchPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e.changedTouches[0];
    const x = (touch.clientX - rect.left) / rect.width * W;
    const y = (touch.clientY - rect.top) / rect.height * H;
    return { x, y };
}

document.addEventListener('touchstart', (e) => {
    if (gameState !== 'playing') return;
    const { x, y } = getTouchPos(e);
    keys.left = x < W / 3;
    keys.right = x > (W / 3) * 2;
    keys.jump = y < H / 3;
    e.preventDefault();
});

document.addEventListener('touchmove', (e) => {
    if (gameState !== 'playing') return;
    const { x, y } = getTouchPos(e);
    keys.left = x < W / 3;
    keys.right = x > (W / 3) * 2;
    keys.jump = y < H / 3;
    e.preventDefault();
});

document.addEventListener('touchend', () => {
    keys.left = false;
    keys.right = false;
    keys.jump = false;
});

gameLoop();