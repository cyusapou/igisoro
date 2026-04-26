export class IgisoroGame {
    constructor() {
        this.board = Array(4).fill(null).map(() => Array(8).fill(0));
        this.currentPlayer = 0; // 0 or 1
        this.initBoard();
        this.gameOver = false;
        this.winner = null;
    }

    initBoard() {
        // Player 0: Rows 0 (back), 1 (front)
        // Player 1: Rows 2 (front), 3 (back)
        for (let c = 0; c < 8; c++) {
            this.board[0][c] = 4;
            this.board[3][c] = 4;
            this.board[1][c] = 0;
            this.board[2][c] = 0;
        }
    }

    // Helper to get pits in counter-clockwise order for a player
    getPitSequence(player, startR, startC, clockwise = false) {
        let sequence = [];
        if (player === 0) {
            // Rows 0 and 1
            // (0,0) -> (0,7) -> (1,7) -> (1,0)
            for (let c = 0; c < 8; c++) sequence.push({ r: 0, c });
            for (let c = 7; c >= 0; c--) sequence.push({ r: 1, c });
        } else {
            // Rows 2 and 3
            // (2,0) -> (2,7) -> (3,7) -> (3,0)
            // Wait, for player 2, it's mirrored.
            // If Player 2 sits opposite, their counter-clockwise is mirrored relative to P1.
            // P2 Rows are 2 (front) and 3 (back).
            // (3,7) -> (3,0) -> (2,0) -> (2,7)
            for (let c = 7; c >= 0; c--) sequence.push({ r: 3, c });
            for (let c = 0; c < 8; c++) sequence.push({ r: 2, c });
        }

        if (clockwise) sequence.reverse();

        // Reorder sequence to start from the pit AFTER the chosen pit
        const startIndex = sequence.findIndex(p => p.r === startR && p.c === startC);
        const reordered = [];
        for (let i = 1; i <= sequence.length; i++) {
            reordered.push(sequence[(startIndex + i) % sequence.length]);
        }
        return reordered;
    }

    isValidMove(r, c) {
        if (this.gameOver) return false;
        if (this.currentPlayer === 0 && (r !== 0 && r !== 1)) return false;
        if (this.currentPlayer === 1 && (r !== 2 && r !== 3)) return false;
        if (this.board[r][c] <= 1) return false; // Rule 7
        return true;
    }

    // This is a complex move that handles relay and captures
    // Now supports decisions for Capture/Pass and Direction
    // Returns { history, status: 'playing' | 'pending_capture' | 'finished', currentPos }
    makeMove(startR, startC, options = {}) {
        const { direction = 'ccw', decision = null } = options;
        if (!this.isValidMove(startR, startC) && !decision) return null;

        let history = [];
        let currentR = startR;
        let currentC = startC;
        let seeds = 0;
        
        const originalStartR = options.originalStartR || startR;
        const originalStartC = options.originalStartC || startC;
        let clockwise = (direction === 'cw');

        // If we are continuing from a decision
        if (decision === 'capture') {
            seeds = this.performCapture(options.lastR, options.lastC);
            currentR = originalStartR;
            currentC = originalStartC;
            history.push({
                type: 'capture',
                r: options.lastR,
                c: options.lastC,
                capturedSeeds: seeds,
                board: JSON.parse(JSON.stringify(this.board))
            });
        } else if (decision === 'pass') {
            // Rule 4: If pass, continue sowing from the current pit if it's a relay
            currentR = options.lastR;
            currentC = options.lastC;
            seeds = 0; // The pit already has its seeds from the previous sowing
            history.push({ type: 'pass', r: currentR, c: currentC });
        } else {
            // New move
            seeds = this.board[startR][startC];
            this.board[startR][startC] = 0;
        }

        while (seeds > 0 || this.canContinue(currentR, currentC)) {
            // Check for capture condition BEFORE sowing the relay pickup
            if (seeds === 0 && this.canCapture(currentR, currentC) && !decision) {
                return {
                    history,
                    status: 'pending_capture',
                    lastPos: { r: currentR, c: currentC },
                    originalPos: { r: originalStartR, c: originalStartC },
                    direction
                };
            }

            // Check for relay pickup if seeds in hand is 0
            if (seeds === 0 && this.board[currentR][currentC] > 1) {
                seeds = this.board[currentR][currentC];
                this.board[currentR][currentC] = 0;
                history.push({
                    type: 'pickup',
                    r: currentR,
                    c: currentC,
                    seedsInHand: seeds,
                    board: JSON.parse(JSON.stringify(this.board))
                });
            }

            if (seeds === 0) break;

            let sequence = this.getPitSequence(this.currentPlayer, currentR, currentC, clockwise);
            let seqIdx = 0;

            while (seeds > 0) {
                const pos = sequence[seqIdx % sequence.length];
                this.board[pos.r][pos.c]++;
                seeds--;
                currentR = pos.r;
                currentC = pos.c;
                seqIdx++;
                
                history.push({
                    type: 'sow',
                    r: currentR,
                    c: currentC,
                    seedsInHand: seeds,
                    board: JSON.parse(JSON.stringify(this.board))
                });
            }
        }

        this.switchTurn();
        this.checkGameOver();

        return { history, status: 'finished' };
    }

    canContinue(r, c) {
        return this.board[r][c] > 1;
    }

    retreat(player, col) {
        // Move seeds from front row to back row
        // P0: front 1, back 0
        // P1: front 2, back 3
        let frontR, backR;
        if (player === 0) {
            frontR = 1; backR = 0;
        } else {
            frontR = 2; backR = 3;
        }

        if (this.board[frontR][col] > 0) {
            this.board[backR][col] += this.board[frontR][col];
            this.board[frontR][col] = 0;
            return true;
        }
        return false;
    }

    canCapture(r, c) {
        // Condition: last seed sown in non-empty pit, and both opponent's pits opposite are not empty.
        // Rule 4
        if (this.board[r][c] <= 1) return false; // Last pit was empty before sowing (now has 1)
        
        let oppR1, oppR2;
        if (this.currentPlayer === 0) {
            oppR1 = 2; oppR2 = 3;
        } else {
            oppR1 = 1; oppR2 = 0;
        }

        return this.board[oppR1][c] > 0 && this.board[oppR2][c] > 0;
    }

    performCapture(r, c) {
        let oppR1, oppR2;
        if (this.currentPlayer === 0) {
            oppR1 = 2; oppR2 = 3;
        } else {
            oppR1 = 1; oppR2 = 0;
        }

        const captured = this.board[oppR1][c] + this.board[oppR2][c];
        this.board[oppR1][c] = 0;
        this.board[oppR2][c] = 0;
        return captured;
    }

    switchTurn() {
        this.currentPlayer = 1 - this.currentPlayer;
    }

    checkGameOver() {
        // Player loses if they cannot sow any seeds (no pit with > 1 seed)
        const canPlayerMove = (player) => {
            let rows = player === 0 ? [0, 1] : [2, 3];
            for (let r of rows) {
                for (let c = 0; c < 8; c++) {
                    if (this.board[r][c] > 1) return true;
                }
            }
            return false;
        };

        if (!canPlayerMove(this.currentPlayer)) {
            this.gameOver = true;
            this.winner = 1 - this.currentPlayer;
        }
    }

    // Basic AI logic
    getBotMove() {
        const player = this.currentPlayer;
        const rows = player === 0 ? [0, 1] : [2, 3];
        let bestMove = null;
        let maxValue = -1;

        for (let r of rows) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] > 1) {
                    // Evaluate move
                    // A simple greedy bot prefers moves that result in captures
                    let score = 0;
                    if (this.canCapture(r, c)) score += 100;
                    score += this.board[r][c]; // Prefer moving larger piles

                    if (score > maxValue) {
                        maxValue = score;
                        bestMove = { r, c, direction: 'ccw' };
                    }
                }
            }
        }
        return bestMove;
    }
}
