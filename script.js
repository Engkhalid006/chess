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
            p: color === 'w' ? '♙' : '♟',
            n: color === 'w' ? '♘' : '♞',
            b: color === 'w' ? '♗' : '♝',
            r: color === 'w' ? '♖' : '♜',
            q: color === 'w' ? '♕' : '♛',
            k: color === 'w' ? '♔' : '♚'
        };
        return symbols[type];
    }
    
    // التعامل مع النقر على المربع
    function handleSquareClick(row, col) {
        const square = `${String.fromCharCode(97 + col)}${8 - row}`;
        
        // إذا كان اللون الحالي ليس لون اللاعب، لا تفعل شيئاً
        if (chess.turn() !== humanColor) return;
        
        // إذا لم يكن هناك مربع محدد، نحدد المربع إذا كان يحتوي على قطعة اللاعب
        if (moveFrom === null) {
            const piece = chess.get(square);
            if (piece && piece.color === humanColor) {
                moveFrom = square;
                highlightMoves(square);
            }
        } else {
            // محاولة تحريك القطعة
            const move = {
                from: moveFrom,
                to: square,
                promotion: 'q' // ترقية إلى وزير دائماً
            };
            
            const legalMove = chess.move(move);
            
            if (legalMove) {
                boardHistory.push(chess.fen());
                moveFrom = null;
                clearHighlights();
                updateBoard();
                
                // إذا لم تنته اللعبة، انتقل إلى الكمبيوتر
                if (!chess.isGameOver()) {
                    setTimeout(() => {
                        getEngineMove();
                    }, 100);
                }
            } else {
                // إذا كانت الحركة غير قانونية، تحقق إذا كان النقر على قطعة أخرى للاعب
                const piece = chess.get(square);
                if (piece && piece.color === humanColor) {
                    moveFrom = square;
                    highlightMoves(square);
                } else {
                    moveFrom = null;
                    clearHighlights();
                }
            }
        }
    }
    
    // تمييز الحركات الممكنة
    function highlightMoves(square) {
        clearHighlights();
        
        // تمييز المربع المحدد
        const [col, row] = [square[0], square[1]];
        const boardRow = 7 - (parseInt(row) - 1);
        const boardCol = col.charCodeAt(0) - 97;
        const selectedSquare = document.querySelector(`.square[data-row="${boardRow}"][data-col="${boardCol}"]`);
        selectedSquare.classList.add('selected');
        
        // تمييز الحركات الممكنة
        const moves = chess.moves({
            square: square,
            verbose: true
        });
        
        moves.forEach(move => {
            const [toCol, toRow] = [move.to[0], move.to[1]];
            const toBoardRow = 7 - (parseInt(toRow) - 1);
            const toBoardCol = toCol.charCodeAt(0) - 97;
            const toSquare = document.querySelector(`.square[data-row="${toBoardRow}"][data-col="${toBoardCol}"]`);
            toSquare.classList.add('highlight');
        });
    }
    
    // إزالة التمييز
    function clearHighlights() {
        document.querySelectorAll('.square').forEach(sq => {
            sq.classList.remove('selected');
            sq.classList.remove('highlight');
        });
    }
    
    // الحصول على حركة المحرك
    function getEngineMove() {
        if (!engineReady || chess.isGameOver()) return;
        
        status.textContent = 'الكمبيوتر يفكر...';
        
        stockfish.postMessage('position fen ' + chess.fen());
        stockfish.postMessage('go depth 18'); // زيادة العمق لضمان القوة القصوى
    }
    
    // تنفيذ حركة المحرك
    function makeEngineMove(move) {
        const result = chess.move(move);
        
        if (result) {
            boardHistory.push(chess.fen());
            updateBoard();
            
            // تمييز آخر حركة
            const [fromCol, fromRow] = [result.from[0], result.from[1]];
            const [toCol, toRow] = [result.to[0], result.to[1]];
            
            const fromBoardRow = 7 - (parseInt(fromRow) - 1);
            const fromBoardCol = fromCol.charCodeAt(0) - 97;
            const toBoardRow = 7 - (parseInt(toRow) - 1);
            const toBoardCol = toCol.charCodeAt(0) - 97;
            
            document.querySelector(`.square[data-row="${fromBoardRow}"][data-col="${fromBoardCol}"]`)
                .classList.add('last-move');
            document.querySelector(`.square[data-row="${toBoardRow}"][data-col="${toBoardCol}"]`)
                .classList.add('last-move');
        }
    }
    
    // تحديث حالة اللعبة
    function updateGameStatus() {
        if (chess.isCheckmate()) {
            status.textContent = `كش مات! ${chess.turn() === 'w' ? 'الأسود يفوز' : 'الأبيض يفوز'}`;
        } else if (chess.isDraw()) {
            status.textContent = 'تعادل! ' + (
                chess.isStalemate() ? 'جمود' :
                chess.isThreefoldRepetition() ? 'تكرار ثلاثي' :
                chess.isInsufficientMaterial() ? 'مادة غير كافية' :
                'قاعدة الخمسين حركة'
            );
        } else {
            if (chess.isCheck()) {
                status.textContent = `كش! حان دور ${chess.turn() === 'w' ? 'الأبيض' : 'الأسود'}`;
            } else {
                status.textContent = `حان دور ${chess.turn() === 'w' ? 'الأبيض' : 'الأسود'}`;
            }
        }
    }
    
    // زر "أنا الأول"
    iGoFirstBtn.addEventListener('click', () => {
        chess.reset();
        humanColor = 'w'; // اللاعب يلعب بالأبيض
        boardHistory = [chess.fen()];
        moveFrom = null;
        clearHighlights();
        updateBoard();
        status.textContent = 'أنت تبدأ باللون الأبيض. حرك أي قطعة.';
    });
    
    // زر تراجع عن الحركة
    undoMoveBtn.addEventListener('click', () => {
        if (boardHistory.length > 1) {
            boardHistory.pop();
            chess.load(boardHistory[boardHistory.length - 1]);
            moveFrom = null;
            clearHighlights();
            updateBoard();
            status.textContent = 'تم التراجع عن الحركة الأخيرة.';
        } else {
            status.textContent = 'لا يمكن التراجع أكثر!';
        }
    });
    
    // زر لعبة جديدة
    newGameBtn.addEventListener('click', () => {
        chess.reset();
        humanColor = 'b'; // افتراضي: اللاعب بالأسود
        boardHistory = [chess.fen()];
        moveFrom = null;
        clearHighlights();
        updateBoard();
        status.textContent = 'لعبة جديدة! ارسم حركات خصمك.';
    });
    
    // زر تحليل الوضعية
    analyzeBtn.addEventListener('click', () => {
        if (chess.isGameOver()) return;
        
        status.textContent = 'جارٍ التحليل...';
        stockfish.postMessage('position fen ' + chess.fen());
        stockfish.postMessage('go depth 20 movetime 5000');
        
        setTimeout(() => {
            stockfish.postMessage('stop');
            status.textContent = 'تم التحليل. انظر إلى تقييم المحرك.';
        }, 5000);
    });
    
    // بدء اللعبة
    createBoard();
});
