import { io } from 'socket.io-client';
import { IgisoroGame } from './game.js';

/* ── Socket ── */
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const socket = io(SOCKET_URL);

/* ── State ── */
let game = new IgisoroGame();
let mySide = null;        // 0 = bottom, 1 = top
let roomCode = null;
let isAnimating = false;
let isBotMode = false;
let currentMoveParams = null;
let isRetreatMode = false;

/* ── DOM refs ── */
const entryOverlay    = document.getElementById('entry-overlay');
const waitingOverlay  = document.getElementById('waiting-overlay');
const gameContainer   = document.getElementById('game-container');
const boardEl         = document.getElementById('board');
const statusMsg       = document.getElementById('status-msg');
const gameRoomCodeEl  = document.getElementById('game-room-code');
const displayRoomCode = document.getElementById('display-room-code');

const btnBot    = document.getElementById('btn-bot');
const btnCreate = document.getElementById('btn-create');
const btnJoin   = document.getElementById('btn-join');
const roomInput = document.getElementById('room-input');

const capturePanel  = document.getElementById('capture-decision');
const retreatPanel  = document.getElementById('retreat-notice');
const btnCapture    = document.getElementById('btn-capture');
const btnPassMove   = document.getElementById('btn-pass-move');

/* ── Ambient Particles ── */
(function spawnDust() {
    const container = document.getElementById('dust-particles');
    if (!container) return;
    for (let i = 0; i < 25; i++) {
        const d = document.createElement('div');
        d.className = 'dust';
        const size = Math.random() * 4 + 2;
        d.style.cssText = `
            width:${size}px; height:${size}px;
            left:${Math.random() * 100}%;
            animation-duration:${8 + Math.random() * 16}s;
            animation-delay:${Math.random() * 12}s;
        `;
        container.appendChild(d);
    }
})();

/* ── Entry Logic ── */
btnBot.onclick = () => {
    isBotMode = true;
    mySide = 0;
    game = new IgisoroGame();
    entryOverlay.classList.add('hidden');
    gameContainer.style.display = 'flex';
    gameRoomCodeEl.innerText = 'SINGLE PLAYER — VS BOT';
    initUI();
};

btnCreate.onclick = () => {
    isBotMode = false;
    socket.emit('create_room');
};

btnJoin.onclick = () => {
    isBotMode = false;
    const code = roomInput.value.trim().toUpperCase();
    if (code.length === 6) {
        socket.emit('join_room', code);
    } else {
        alert('Please enter a 6-character room code');
    }
};

roomInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnJoin.click();
});

/* ── Socket Communication ── */
socket.on('room_created', ({ roomCode: code, side }) => {
    roomCode = code;
    mySide = side;
    entryOverlay.classList.add('hidden');
    waitingOverlay.classList.remove('hidden');
    displayRoomCode.innerText = roomCode;
});

socket.on('room_joined', ({ roomCode: code, side }) => {
    roomCode = code;
    mySide = side;
    game = new IgisoroGame();
    entryOverlay.classList.add('hidden');
    gameContainer.style.display = 'flex';
    gameRoomCodeEl.innerText = `ROOM: ${roomCode}`;
    initUI();
});

socket.on('player_joined', ({ players }) => {
    if (players.length === 2) {
        waitingOverlay.classList.add('hidden');
        gameContainer.style.display = 'flex';
        statusMsg.innerText = 'Opponent Joined! Ready?';
        initUI();
    }
});

socket.on('game_move', async (moveData) => {
    if (isBotMode) return;

    if (moveData.decision === 'retreat') {
        game.retreat(1 - mySide, moveData.col);
        updateBoardView();
        hideRetreat();
        return;
    }

    const result = game.makeMove(moveData.r, moveData.c, moveData);
    if (!result) return;
    await animateMove(result.history);

    if (result.status === 'pending_capture') {
        statusMsg.innerText = "Opponent is deciding...";
    } else {
        updateInfo();
    }
});

socket.on('error', msg => alert(msg));

/* ── Move Decision ── */
btnCapture.onclick  = () => handleDecision('capture');
btnPassMove.onclick = () => handleDecision('pass');

async function handleDecision(decision) {
    capturePanel.classList.add('hidden');
    if (!currentMoveParams) return;

    const params = {
        ...currentMoveParams,
        decision,
        lastR:         currentMoveParams.lastPos.r,
        lastC:         currentMoveParams.lastPos.c,
        originalStartR: currentMoveParams.originalPos.r,
        originalStartC: currentMoveParams.originalPos.c,
    };

    if (!isBotMode) socket.emit('game_move', { roomCode, moveData: params });
    const result = game.makeMove(params.r, params.c, params);
    if (!result) return;
    await animateMove(result.history);
    handleMoveResult(result);
}

function handleMoveResult(result) {
    if (!result) return;
    if (result.status === 'pending_capture') {
        currentMoveParams = result;
        if (isBotMode && game.currentPlayer === 1) {
            setTimeout(() => handleDecision('capture'), 700);
        } else {
            capturePanel.classList.remove('hidden');
            statusMsg.innerText = '⚡ Capture Available!';
        }
    } else {
        updateInfo();
    }
}

/* ── UI Core ── */
function initUI() {
    renderBoard();
    updateInfo();
}

function renderBoard() {
    boardEl.querySelectorAll('.row').forEach(r => r.remove());

    // Display rows: 3 (opponent back), 2 (opponent front), 1 (my front), 0 (my back)
    for (let r = 3; r >= 0; r--) {
        const rowEl = document.createElement('div');
        rowEl.className = 'row';
        rowEl.id = `row-${r}`;

        const isMySide = (mySide === 0 && (r === 0 || r === 1)) || (mySide === 1 && (r === 2 || r === 3));

        for (let c = 0; c < 8; c++) {
            const pitEl = document.createElement('div');
            pitEl.className = 'pit' + (isMySide ? ' active' : ' opponent');
            pitEl.id = `pit-${r}-${c}`;
            pitEl.onclick = () => handlePitClick(r, c);

            const visualEl = document.createElement('div');
            visualEl.className = 'seeds-visual';
            pitEl.appendChild(visualEl);

            const countEl = document.createElement('div');
            countEl.className = 'seed-count';
            pitEl.appendChild(countEl);

            rowEl.appendChild(pitEl);
        }
        boardEl.appendChild(rowEl);
    }
    updateBoardView();
}

function updateBoardView() {
    for (let r = 0; r < 4; r++)
        for (let c = 0; c < 8; c++)
            updatePitUI(r, c);
}

function updatePitUI(r, c) {
    const pitEl = document.getElementById(`pit-${r}-${c}`);
    if (!pitEl) return;

    const count = game.board[r][c];
    const countEl = pitEl.querySelector('.seed-count');
    countEl.innerText = count > 0 ? count : '';

    const visualEl = pitEl.querySelector('.seeds-visual');
    visualEl.innerHTML = '';

    const showCount = Math.min(count, 18);
    for (let i = 0; i < showCount; i++) {
        const seed = document.createElement('div');
        const angle  = i * 137.508 * (Math.PI / 180);
        const radius = Math.sqrt(i + 1) * 6.5;
        const x = 43 + Math.cos(angle) * radius - 8;
        const y = 43 + Math.sin(angle) * radius - 6;

        seed.className = `seed seed-type-${i % 3}`;
        seed.style.left = `${x}px`;
        seed.style.top  = `${y}px`;
        seed.style.transform = `rotate(${(i * 67) % 360}deg)`;

        visualEl.appendChild(seed);
    }
}

function updateInfo() {
    const p0 = document.getElementById('player-0-info');
    const p1 = document.getElementById('player-1-info');

    p0.classList.toggle('active', game.currentPlayer === 0);
    p1.classList.toggle('active', game.currentPlayer === 1);

    p0.querySelector('.turn-indicator').classList.toggle('hidden', game.currentPlayer !== 0);
    p1.querySelector('.turn-indicator').classList.toggle('hidden', game.currentPlayer !== 1);

    const isMyTurn = game.currentPlayer === mySide;
    if (!game.gameOver) {
        statusMsg.innerText = isMyTurn ? 'Your Turn' : "Opponent's Turn";
    }

    if (game.gameOver) {
        showGameOver();
    } else if (isBotMode && game.currentPlayer === 1) {
        setTimeout(doBotTurn, 900);
    }
}

/* ── Bot Moves ── */
async function doBotTurn() {
    if (!isBotMode || game.currentPlayer !== 1 || isAnimating) return;
    const move = game.getBotMove();
    if (!move) return;
    const result = game.makeMove(move.r, move.c, move);
    if (!result) return;
    await animateMove(result.history);
    handleMoveResult(result);
}

/* ── Interaction ── */
async function handlePitClick(r, c) {
    if (isRetreatMode) {
        const isFront = (mySide === 0 && r === 1) || (mySide === 1 && r === 2);
        if (isFront && game.board[r][c] > 0) {
            game.retreat(mySide, c);
            if (!isBotMode) socket.emit('game_move', { roomCode, moveData: { decision: 'retreat', col: c } });
            hideRetreat();
            updateBoardView();
        }
        return;
    }

    if (isAnimating || game.currentPlayer !== mySide || !game.isValidMove(r, c)) return;

    let direction = 'ccw';
    if (game.canCapture(r, c)) {
        direction = confirm('Direct Capture! Sow CLOCKWISE?') ? 'cw' : 'ccw';
    }

    const params = { r, c, direction };
    if (!isBotMode) socket.emit('game_move', { roomCode, moveData: params });
    const result = game.makeMove(r, c, params);
    if (!result) return;
    await animateMove(result.history);
    handleMoveResult(result);
}

/* ── Retreat Logic ── */
function showRetreat() {
    isRetreatMode = true;
    retreatPanel.classList.remove('hidden');
    const frontRow = mySide === 0 ? 1 : 2;
    for (let c = 0; c < 8; c++) {
        const pit = document.getElementById(`pit-${frontRow}-${c}`);
        if (pit && game.board[frontRow][c] > 0) pit.classList.add('retreat-hint');
    }
}

function hideRetreat() {
    isRetreatMode = false;
    retreatPanel.classList.add('hidden');
    document.querySelectorAll('.retreat-hint').forEach(p => p.classList.remove('retreat-hint'));
}

/* ── Animation ── */
async function animateMove(history) {
    if (!history || history.length === 0) return;
    isAnimating = true;

    for (const step of history) {
        if (step.type === 'pass') {
            if (game.currentPlayer === mySide || isBotMode) showRetreat();
            await new Promise(r => setTimeout(r, 600));
            continue;
        }

        const pitEl = document.getElementById(`pit-${step.r}-${step.c}`);
        if (!pitEl) continue;

        if (step.board) game.board = step.board;
        updatePitUI(step.r, step.c);

        if (step.type === 'sow') {
            pitEl.classList.add('sowing');
            await new Promise(r => setTimeout(r, 85));
            pitEl.classList.remove('sowing');
        } else if (step.type === 'pickup') {
            pitEl.classList.add('lit');
            await new Promise(r => setTimeout(r, 260));
            pitEl.classList.remove('lit');
            updateBoardView();
        } else if (step.type === 'capture') {
            pitEl.classList.add('captured');
            await new Promise(r => setTimeout(r, 480));
            pitEl.classList.remove('captured');
            updateBoardView();
        }
    }

    isAnimating = false;
}

/* ── Game End ── */
function showGameOver() {
    const overlay    = document.getElementById('gameover-overlay');
    const winnerText = document.getElementById('winner-text');
    const icon       = document.getElementById('gameover-icon');
    const reason     = document.getElementById('win-reason');

    overlay.classList.remove('hidden');

    if (game.winner === mySide) {
        icon.innerText = '👑';
        winnerText.innerText = 'Victory!';
        reason.innerText = 'Umukino urarangiye. Watsinze!';
    } else {
        icon.innerText = '💀';
        winnerText.innerText = 'Defeated';
        reason.innerText = 'Umukino urarangiye. Batsinzwe.';
    }
}
