document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const status = document.getElementById('status');
    const evalElement = document.getElementById('eval');
    const iGoFirstBtn = document.getElementById('iGoFirst');
    const undoMoveBtn = document.getElementById('undoMove');
    const newGameBtn = document.getElementById('newGame');
    const analyzeBtn = document.getElementById('analyze');
    
    // إعداد لوحة الشطرنج
    const chess = new Chess();
    let boardHistory = [chess.fen()];
    let selectedSquare = null;
    let moveFrom = null;
    let humanColor = 'b'; // اللاعب يلعب بالأسود افتراضياً
    let stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');
    let engineReady = false;
    
    // تهيئة Stockfish
    stockfish.onmessage = (event) => {
        const message = event.data;
        
        if (message === 'uciok') {
            engineReady = true;
            configureEngine();
        } else if (message.startsWith('bestmove')) {
            const bestMove = message.split(' ')[1];
            if (bestMove && bestMove !== '(none)') {
                makeEngineMove(bestMove);
            }
        } else if (message.startsWith('info depth') && message.includes('score cp')) {
            // تحديث تقييم المحرك
            const scoreMatch = message.match(/score cp (-?\d+)/);
            if (scoreMatch) {
                const score = parseInt(scoreMatch[1]) / 100;
                updateEvaluation(score);
            }
        }
    };
    
    stockfish.postMessage('uci');
    
    function configureEngine() {
        stockfish.postMessage('setoption name Skill Level value 20'); // أقصى مستوى مهارة
        stockfish.postMessage('setoption name Contempt value 0');
        stockfish.postMessage('setoption name Threads value 4');
        stockfish.postMessage('setoption name Hash value 2048');
    }
    
    function updateEvaluation(score) {
        let evalText = 'تقييم: ';
        if (score > 0) {
            evalText += `+${score.toFixed(2)} (أفضل للأبيض)`;
        } else if (score < 0) {
            evalText += `${score.toFixed(2)} (أفضل للأسود)`;
        } else {
            evalText += '0.00 (متوازن)';
        }
        evalElement.textContent = evalText;
    }
    
    // إنشاء لوحة الشطرنج
    function createBoard() {
        board.innerHTML = '';
        
        // إنشاء المربعات (للأسود في الأسفل)
        for (let i = 7; i >= 0; i--) {
            for (let j = 0; j < 8; j++) {
                const square = document.createElement('div');
                square.classList.add('square');
                square.classList.add((i + j) % 2 === 0 ? 'light' : 'dark');
                square.dataset.row = i;
                square.dataset.col = j;
                
                square.addEventListener('click', () => handleSquareClick(i, j));
                
                board.appendChild(square);
            }
        }
        
        updateBoard();
    }
    
    // تحديث لوحة الشطرنج
    function updateBoard() {
        const squares = document.querySelectorAll('.square');
        
        // إزالة جميع العلامات
        squares.forEach(square => {
            square.classList.remove('last-move');
            square.classList.remove('check');
            square.classList.remove('selected');
            square.classList.remove('highlight');
            
            const existingPiece = square.querySelector('.piece');
            if (existingPiece) {
                square.removeChild(existingPiece);
            }
        });
        
        // تحديث القطع
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = chess.get(`${String.fromCharCode(97 + j)}${8 - i}`);
                const square = document.querySelector(`.square[data-row="${i}"][data-col="${j}"]`);
                
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.classList.add('piece');
                    pieceElement.dataset.type = piece.type;
                    pieceElement.dataset.color = piece.color;
                    
                    const pieceSymbol = getPieceSymbol(piece.type, piece.color);
                    pieceElement.textContent = pieceSymbol;
                    pieceElement.style.fontSize = '40px';
                    pieceElement.style.lineHeight = '1';
                    
                    square.appendChild(pieceElement);
                }
            }
        }
        
        // تحديث حالة اللعبة
        if (chess.isCheck()) {
            const kingPos = findKing(humanColor);
            if (kingPos) {
                const square = document.querySelector(`.square[data-row="${7 - (kingPos.y - 0)}"][data-col="${kingPos.x.charCodeAt(0) - 97}"]`);
                square.classList.add('check');
            }
        }
        
        updateGameStatus();
    }
    
    function findKing(color) {
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const square = `${String.fromCharCode(97 + j)}${8 - i}`;
                const piece = chess.get(square);
                if (piece && piece.type === 'k' && piece.color === color) {
                    return { x: String.fromCharCode(97 + j), y: 8 - i };
                }
            }
        }
        return null;
    }
    
    // الحصول على رمز القطعة
    function getPieceSymbol(type, color) {
        const symbols = {
            p: color === '
