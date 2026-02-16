// ==============================
// 💡 반짝반짝 패턴 게임 (Lights Out)
// ==============================

(function () {
    'use strict';

    // === State ===
    const state = {
        nickname: '',
        gridSize: 5,
        soundTheme: 'electronic',
        volume: 50,
        mode: 'play', // 'play' | 'create'
        grid: [],
        initialGrid: [],
        moves: 0,
        timerInterval: null,
        startTime: null,
        elapsedSeconds: 0,
        isPlaying: false,
    };

    // === DOM Elements ===
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const screens = {
        nickname: $('#nickname-screen'),
        menu: $('#menu-screen'),
        settings: $('#settings-screen'),
        game: $('#game-screen'),
        ranking: $('#ranking-screen'),
    };

    const modals = {
        clear: $('#clear-modal'),
        save: $('#save-modal'),
        load: $('#load-modal'),
    };

    // === Sound System ===
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // 15 sound definitions: 5 per theme
    const soundDefs = {
        electronic: [
            { type: 'square', freq: 880, duration: 0.08 },
            { type: 'sine', freq: 660, duration: 0.1 },
            { type: 'sawtooth', freq: 440, duration: 0.07 },
            { type: 'triangle', freq: 550, duration: 0.12 },
            { type: 'square', freq: 1100, duration: 0.06 },
        ],
        arcade: [
            { type: 'square', freq: 523, duration: 0.1, sweep: 1.5 },
            { type: 'square', freq: 784, duration: 0.08, sweep: 0.5 },
            { type: 'sawtooth', freq: 350, duration: 0.15, sweep: 2 },
            { type: 'square', freq: 1047, duration: 0.06, sweep: 0.3 },
            { type: 'triangle', freq: 262, duration: 0.2, sweep: 3 },
        ],
        animal: [
            // Cat meow-like
            { type: 'sine', freq: 700, duration: 0.25, sweep: 0.6, vibrato: 8 },
            // Bird chirp
            { type: 'sine', freq: 2000, duration: 0.1, sweep: 0.5 },
            // Dog bark-like
            { type: 'sawtooth', freq: 200, duration: 0.15, sweep: 1.5 },
            // Frog croak
            { type: 'square', freq: 150, duration: 0.2, sweep: 0.8 },
            // Duck quack
            { type: 'sawtooth', freq: 300, duration: 0.12, sweep: 2 },
        ],
    };

    function playSound(index) {
        if (state.volume === 0) return;
        const defs = soundDefs[state.soundTheme];
        const def = defs[index % defs.length];
        const vol = state.volume / 100;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = def.type;
        osc.frequency.setValueAtTime(def.freq, audioCtx.currentTime);

        if (def.sweep) {
            osc.frequency.exponentialRampToValueAtTime(
                def.freq * def.sweep,
                audioCtx.currentTime + def.duration
            );
        }

        if (def.vibrato) {
            const lfo = audioCtx.createOscillator();
            const lfoGain = audioCtx.createGain();
            lfo.frequency.value = def.vibrato;
            lfoGain.gain.value = 50;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start();
            lfo.stop(audioCtx.currentTime + def.duration);
        }

        gain.gain.setValueAtTime(vol * 0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + def.duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + def.duration + 0.05);
    }

    function playClearSound() {
        if (state.volume === 0) return;
        const vol = state.volume / 100;
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(vol * 0.2, audioCtx.currentTime + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.12 + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + i * 0.12);
            osc.stop(audioCtx.currentTime + i * 0.12 + 0.35);
        });
    }

    // === Grid Logic ===
    function createGrid(size) {
        return Array.from({ length: size }, () => Array(size).fill(false));
    }

    function toggleCell(grid, row, col) {
        const size = grid.length;
        const flip = (r, c) => {
            if (r >= 0 && r < size && c >= 0 && c < size) {
                grid[r][c] = !grid[r][c];
            }
        };
        flip(row, col);
        flip(row - 1, col);
        flip(row + 1, col);
        flip(row, col - 1);
        flip(row, col + 1);
    }

    function isCleared(grid) {
        return grid.every(row => row.every(cell => !cell));
    }

    function cloneGrid(grid) {
        return grid.map(row => [...row]);
    }

    function generatePuzzle(size) {
        const grid = createGrid(size);
        // Randomly toggle cells to create a solvable puzzle
        const numMoves = Math.floor(Math.random() * (size * size - 2)) + size;
        for (let i = 0; i < numMoves; i++) {
            const r = Math.floor(Math.random() * size);
            const c = Math.floor(Math.random() * size);
            toggleCell(grid, r, c);
        }
        // Ensure puzzle isn't already solved
        if (isCleared(grid)) {
            toggleCell(grid, 0, 0);
        }
        return grid;
    }

    // === Rendering ===
    function renderGrid() {
        const gridEl = $('#game-grid');
        gridEl.innerHTML = '';
        gridEl.style.gridTemplateColumns = `repeat(${state.gridSize}, 1fr)`;

        // Adjust cell size based on grid size
        const maxWidth = Math.min(window.innerWidth - 40, 500);
        const cellSize = Math.floor((maxWidth - (state.gridSize - 1) * 6) / state.gridSize);
        const clampedSize = Math.min(Math.max(cellSize, 36), 70);

        state.grid.forEach((row, r) => {
            row.forEach((isOn, c) => {
                const cell = document.createElement('button');
                cell.className = 'grid-cell' + (isOn ? ' on' : '');
                cell.style.width = clampedSize + 'px';
                cell.style.height = clampedSize + 'px';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.addEventListener('click', () => onCellClick(r, c));
                gridEl.appendChild(cell);
            });
        });
    }

    function updateStats() {
        $('#move-count').textContent = state.moves;
    }

    function updateTimer() {
        const elapsed = state.elapsedSeconds;
        const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const sec = String(elapsed % 60).padStart(2, '0');
        $('#timer').textContent = `${min}:${sec}`;
    }

    function startTimer() {
        stopTimer();
        state.startTime = Date.now();
        state.elapsedSeconds = 0;
        updateTimer();
        state.timerInterval = setInterval(() => {
            state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
            updateTimer();
        }, 1000);
    }

    function stopTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    // === Cell Click ===
    function onCellClick(row, col) {
        // Resume AudioContext if suspended (browser autoplay policy)
        if (audioCtx.state === 'suspended') audioCtx.resume();

        toggleCell(state.grid, row, col);
        state.moves++;

        // Start timer on first move in play mode
        if (state.mode === 'play' && state.moves === 1) {
            startTimer();
        }

        // Sound
        const soundIndex = (row * state.gridSize + col) % 5;
        playSound(soundIndex);

        // Ripple animation
        const cells = $$('.grid-cell');
        const idx = row * state.gridSize + col;
        const neighbors = [
            idx,
            row > 0 ? idx - state.gridSize : -1,
            row < state.gridSize - 1 ? idx + state.gridSize : -1,
            col > 0 ? idx - 1 : -1,
            col < state.gridSize - 1 ? idx + 1 : -1,
        ];
        neighbors.forEach(i => {
            if (i >= 0 && i < cells.length) {
                cells[i].classList.add('ripple');
                setTimeout(() => cells[i].classList.remove('ripple'), 400);
            }
        });

        renderGrid();
        updateStats();

        // Check clear in play mode
        if (state.mode === 'play' && isCleared(state.grid)) {
            stopTimer();
            onGameClear();
        }
    }

    // === Score Calculation ===
    function calculateScore(moves, seconds, gridSize) {
        // Optimal moves estimate
        const maxCells = gridSize * gridSize;
        // Lower is better for both moves and time
        // Move score: 100 if optimal (gridSize moves), decreasing
        const moveScore = Math.max(0, 100 - ((moves - gridSize) / maxCells) * 100);
        // Time score: 100 if under 10 seconds, decreasing
        const timeScore = Math.max(0, 100 - (seconds / (maxCells * 3)) * 100);
        // Final: 50% moves + 50% time
        const finalScore = Math.round((moveScore * 0.5 + timeScore * 0.5) * 10) / 10;
        return Math.max(0, Math.min(100, finalScore));
    }

    function onGameClear() {
        playClearSound();
        const score = calculateScore(state.moves, state.elapsedSeconds, state.gridSize);

        $('#clear-moves').textContent = state.moves;
        const min = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, '0');
        const sec = String(state.elapsedSeconds % 60).padStart(2, '0');
        $('#clear-time').textContent = `${min}:${sec}`;
        $('#clear-score').textContent = score.toFixed(1);

        // Save ranking
        saveRanking({
            nickname: state.nickname,
            gridSize: state.gridSize,
            moves: state.moves,
            time: state.elapsedSeconds,
            score: score,
            date: new Date().toISOString(),
        });

        showModal('clear');
    }

    // === Ranking (localStorage) ===
    function getRankings() {
        try {
            return JSON.parse(localStorage.getItem('lightsout_rankings') || '[]');
        } catch {
            return [];
        }
    }

    function saveRanking(entry) {
        const rankings = getRankings();
        rankings.push(entry);
        rankings.sort((a, b) => b.score - a.score);
        // Keep top 100
        localStorage.setItem('lightsout_rankings', JSON.stringify(rankings.slice(0, 100)));
    }

    function renderRankings(filterSize) {
        const rankings = getRankings();
        const filtered = filterSize === 'all'
            ? rankings
            : rankings.filter(r => r.gridSize === parseInt(filterSize));

        const listEl = $('#ranking-list');
        if (filtered.length === 0) {
            listEl.innerHTML = '<p class="empty-msg">아직 기록이 없습니다.</p>';
            return;
        }

        listEl.innerHTML = filtered.map((r, i) => {
            const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
            const min = String(Math.floor(r.time / 60)).padStart(2, '0');
            const sec = String(r.time % 60).padStart(2, '0');
            return `
                <div class="ranking-item">
                    <span class="ranking-rank ${rankClass}">${medal}</span>
                    <div class="ranking-info">
                        <div class="ranking-name">${escapeHtml(r.nickname)}</div>
                        <div class="ranking-detail">${r.gridSize}×${r.gridSize} | ${r.moves}회 | ${min}:${sec}</div>
                    </div>
                    <span class="ranking-score">${r.score.toFixed(1)}</span>
                </div>
            `;
        }).join('');
    }

    // === Patterns (localStorage) ===
    function getPatterns() {
        try {
            return JSON.parse(localStorage.getItem('lightsout_patterns') || '[]');
        } catch {
            return [];
        }
    }

    function savePattern(name, grid) {
        const patterns = getPatterns();
        patterns.push({
            name: name,
            gridSize: grid.length,
            grid: grid,
            date: new Date().toISOString(),
        });
        localStorage.setItem('lightsout_patterns', JSON.stringify(patterns));
    }

    function deletePattern(index) {
        const patterns = getPatterns();
        patterns.splice(index, 1);
        localStorage.setItem('lightsout_patterns', JSON.stringify(patterns));
    }

    function renderPatternList() {
        const patterns = getPatterns();
        const listEl = $('#pattern-list');

        if (patterns.length === 0) {
            listEl.innerHTML = '<p class="empty-msg">저장된 패턴이 없습니다.</p>';
            return;
        }

        listEl.innerHTML = patterns.map((p, i) => {
            const date = new Date(p.date).toLocaleDateString('ko-KR');
            return `
                <div class="pattern-item">
                    <div class="pattern-item-info">
                        <div class="pattern-item-name">${escapeHtml(p.name)}</div>
                        <div class="pattern-item-meta">${p.gridSize}×${p.gridSize} | ${date}</div>
                    </div>
                    <div class="pattern-item-actions">
                        <button class="btn btn-primary btn-small" onclick="window._loadPattern(${i})">▶ 풀기</button>
                        <button class="btn btn-danger btn-small" onclick="window._deletePattern(${i})">✕</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Global callbacks for pattern list buttons
    window._loadPattern = function (index) {
        const patterns = getPatterns();
        const p = patterns[index];
        if (!p) return;

        state.gridSize = p.gridSize;
        state.grid = cloneGrid(p.grid);
        state.initialGrid = cloneGrid(p.grid);
        state.mode = 'play';
        state.moves = 0;
        state.elapsedSeconds = 0;
        stopTimer();

        hideModal('load');
        showScreen('game');
        updateGameUI();
        renderGrid();
        updateStats();
        updateTimer();
    };

    window._deletePattern = function (index) {
        if (confirm('이 패턴을 삭제하시겠습니까?')) {
            deletePattern(index);
            renderPatternList();
        }
    };

    // === Markdown Export/Import ===
    function patternToMarkdown(name, grid) {
        const size = grid.length;
        let md = `# 💡 반짝반짝 패턴: ${name}\n\n`;
        md += `- **크기**: ${size}×${size}\n`;
        md += `- **저장일**: ${new Date().toLocaleDateString('ko-KR')}\n\n`;
        md += `## 패턴 데이터\n\n`;
        md += '```\n';
        grid.forEach(row => {
            md += row.map(cell => cell ? '⬛' : '⬜').join('') + '\n';
        });
        md += '```\n\n';
        md += `## 격자 (JSON)\n\n`;
        md += '```json\n';
        md += JSON.stringify({ name, gridSize: size, grid }, null, 2) + '\n';
        md += '```\n';
        return md;
    }

    function downloadMarkdown(name, grid) {
        const md = patternToMarkdown(name, grid);
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function loadMarkdownFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    // Find JSON block
                    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
                    if (jsonMatch) {
                        const data = JSON.parse(jsonMatch[1]);
                        resolve(data);
                    } else {
                        reject(new Error('유효한 패턴 데이터를 찾을 수 없습니다.'));
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }

    // === Screen/Modal Management ===
    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');
    }

    function showModal(name) {
        modals[name].classList.add('active');
    }

    function hideModal(name) {
        modals[name].classList.remove('active');
    }

    function updateGameUI() {
        $('#game-mode-label').textContent = state.mode === 'play' ? '퍼즐 풀기' : '패턴 만들기';
        $('#game-mode-label').style.background = state.mode === 'play'
            ? 'var(--color-primary)' : 'var(--color-secondary)';
        $('#grid-size-label').textContent = `${state.gridSize}×${state.gridSize}`;
        $('#save-pattern-btn').style.display = state.mode === 'create' ? 'inline-block' : 'none';
    }

    // === Utility ===
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // === Event Binding ===
    function init() {
        // Load saved settings
        const savedNickname = localStorage.getItem('lightsout_nickname');
        if (savedNickname) {
            $('#nickname-input').value = savedNickname;
        }
        const savedSize = localStorage.getItem('lightsout_gridSize');
        if (savedSize) {
            state.gridSize = parseInt(savedSize);
        }
        const savedTheme = localStorage.getItem('lightsout_soundTheme');
        if (savedTheme) {
            state.soundTheme = savedTheme;
        }
        const savedVolume = localStorage.getItem('lightsout_volume');
        if (savedVolume) {
            state.volume = parseInt(savedVolume);
        }

        // Update settings UI
        updateSettingsUI();

        // === Nickname Screen ===
        $('#start-btn').addEventListener('click', () => {
            const nick = $('#nickname-input').value.trim();
            if (!nick) {
                $('#nickname-input').focus();
                return;
            }
            state.nickname = nick;
            localStorage.setItem('lightsout_nickname', nick);
            $('#display-nickname').textContent = nick;
            showScreen('menu');
        });

        $('#nickname-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') $('#start-btn').click();
        });

        // === Menu ===
        $('#play-mode-btn').addEventListener('click', () => startGame('play'));
        $('#create-mode-btn').addEventListener('click', () => startGame('create'));
        $('#load-pattern-btn').addEventListener('click', () => {
            renderPatternList();
            showModal('load');
        });
        $('#ranking-btn').addEventListener('click', () => {
            renderRankings('all');
            // Reset filter buttons
            $$('.filter-btn').forEach(b => b.classList.remove('active'));
            $('.filter-btn[data-filter="all"]').classList.add('active');
            showScreen('ranking');
        });
        $('#settings-btn').addEventListener('click', () => {
            updateSettingsUI();
            showScreen('settings');
        });

        // === Settings ===
        $$('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.gridSize = parseInt(btn.dataset.size);
                localStorage.setItem('lightsout_gridSize', state.gridSize);
            });
        });

        $$('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.soundTheme = btn.dataset.theme;
                localStorage.setItem('lightsout_soundTheme', state.soundTheme);
                // Play sample sound
                if (audioCtx.state === 'suspended') audioCtx.resume();
                playSound(0);
            });
        });

        $('#volume-slider').addEventListener('input', (e) => {
            state.volume = parseInt(e.target.value);
            $('#volume-display').textContent = state.volume + '%';
            localStorage.setItem('lightsout_volume', state.volume);
        });

        $('#settings-back-btn').addEventListener('click', () => showScreen('menu'));

        // === Game ===
        $('#game-back-btn').addEventListener('click', () => {
            stopTimer();
            showScreen('menu');
        });

        $('#reset-btn').addEventListener('click', () => {
            if (state.mode === 'play') {
                state.grid = cloneGrid(state.initialGrid);
            } else {
                state.grid = createGrid(state.gridSize);
            }
            state.moves = 0;
            state.elapsedSeconds = 0;
            stopTimer();
            renderGrid();
            updateStats();
            updateTimer();
        });

        $('#save-pattern-btn').addEventListener('click', () => {
            $('#pattern-name-input').value = '';
            showModal('save');
            $('#pattern-name-input').focus();
        });

        // === Save Modal ===
        $('#save-confirm-btn').addEventListener('click', () => {
            const name = $('#pattern-name-input').value.trim();
            if (!name) {
                $('#pattern-name-input').focus();
                return;
            }
            savePattern(name, state.grid);
            hideModal('save');
            alert('패턴이 저장되었습니다!');
        });

        $('#save-md-btn').addEventListener('click', () => {
            const name = $('#pattern-name-input').value.trim() || '무제 패턴';
            downloadMarkdown(name, state.grid);
            hideModal('save');
        });

        $('#save-cancel-btn').addEventListener('click', () => hideModal('save'));

        // === Load Modal ===
        $('#load-cancel-btn').addEventListener('click', () => hideModal('load'));

        $('#load-file-btn').addEventListener('click', () => {
            $('#load-file-input').click();
        });

        $('#load-file-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const data = await loadMarkdownFile(file);
                state.gridSize = data.gridSize;
                state.grid = data.grid;
                state.initialGrid = cloneGrid(data.grid);
                state.mode = 'play';
                state.moves = 0;
                state.elapsedSeconds = 0;
                stopTimer();

                hideModal('load');
                showScreen('game');
                updateGameUI();
                renderGrid();
                updateStats();
                updateTimer();
            } catch (err) {
                alert('파일을 불러올 수 없습니다: ' + err.message);
            }
            e.target.value = '';
        });

        // === Clear Modal ===
        $('#clear-retry-btn').addEventListener('click', () => {
            hideModal('clear');
            startGame('play');
        });

        $('#clear-menu-btn').addEventListener('click', () => {
            hideModal('clear');
            showScreen('menu');
        });

        // === Ranking ===
        $$('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderRankings(btn.dataset.filter);
            });
        });

        $('#ranking-back-btn').addEventListener('click', () => showScreen('menu'));

        // === Close modals on backdrop click ===
        Object.values(modals).forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // === Window resize: re-render grid if game is active ===
        window.addEventListener('resize', () => {
            if (screens.game.classList.contains('active')) {
                renderGrid();
            }
        });
    }

    function updateSettingsUI() {
        $$('.size-btn').forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.size) === state.gridSize);
        });
        $$('.theme-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.theme === state.soundTheme);
        });
        $('#volume-slider').value = state.volume;
        $('#volume-display').textContent = state.volume + '%';
    }

    function startGame(mode) {
        state.mode = mode;
        state.moves = 0;
        state.elapsedSeconds = 0;
        stopTimer();

        if (mode === 'play') {
            state.grid = generatePuzzle(state.gridSize);
            state.initialGrid = cloneGrid(state.grid);
        } else {
            state.grid = createGrid(state.gridSize);
            state.initialGrid = createGrid(state.gridSize);
        }

        showScreen('game');
        updateGameUI();
        renderGrid();
        updateStats();
        updateTimer();
    }

    // Start
    init();
})();
