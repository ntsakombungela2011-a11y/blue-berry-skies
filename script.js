(() => {
  "use strict";
  const boardEl = document.getElementById("chessboard");
  const statusEl = document.getElementById("game-status");
  const turnLabel = document.getElementById("turn-label");
  const moveList = document.getElementById("move-list");
  const toastEl = document.getElementById("toast");
  if (!boardEl || typeof Chess === "undefined") {
    if (statusEl) statusEl.textContent = "The chessboard could not load. Please check your connection and refresh.";
    return;
  }

  const game = new Chess();
  const puzzleFen = "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1";
  const pieceGlyph = {wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟︎"};
  let selected = null;
  let legalTargets = [];
  let flipped = false;
  let lastMove = null;
  let puzzleMode = false;
  let pendingPromotion = null;
  let audioCtx = null;
  let soundOn = false;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toastEl.classList.remove("show"), 2300);
  }
  function getAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) audioCtx = new AudioContextClass();
    return audioCtx;
  }
  function tone(freq, duration, wave, volume) {
    if (!soundOn) return;
    const ctx = getAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = wave || "sine";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume || .035, now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + .02);
  }
  function soundMove(capture) {
    if (capture) {
      tone(260,.13,"triangle",.04);
      setTimeout(() => tone(180,.16,"sine",.03),55);
    } else {
      tone(460,.09,"triangle",.025);
    }
  }
  function soundWin() {
    tone(523,.16,"sine",.03);
    setTimeout(() => tone(659,.16,"sine",.03),100);
    setTimeout(() => tone(784,.24,"sine",.035),200);
  }
  document.getElementById("sound-toggle").addEventListener("click", async function () {
    if (!soundOn) {
      const ctx = getAudio();
      if (!ctx) { this.textContent = "No audio ♪"; return; }
      try {
        await ctx.resume();
        soundOn = true;
        this.setAttribute("aria-pressed","true");
        this.innerHTML = 'Sound on <span>♪</span>';
        tone(660,.12,"sine",.03);
        setTimeout(() => tone(880,.17,"sine",.03),100);
      } catch (error) {
        this.textContent = "Tap again ♪";
      }
    } else {
      soundOn = false;
      this.setAttribute("aria-pressed","false");
      this.innerHTML = 'Sound off <span>♪</span>';
    }
  });

  function clearSelection() { selected = null; legalTargets = []; }
  function renderMoves() {
    const history = game.history();
    if (!history.length) {
      moveList.innerHTML = '<p class="empty-moves">The first move is yours.</p>';
      return;
    }
    let html = "";
    for (let i = 0; i < history.length; i += 2) {
      html += '<div class="move-pair"><span class="move-number">' + (i / 2 + 1) + '.</span><span>' + history[i] + '</span><span>' + (history[i + 1] || "") + '</span></div>';
    }
    moveList.innerHTML = html;
    moveList.scrollTop = moveList.scrollHeight;
  }
  function renderStatus() {
    const turn = game.turn() === "w" ? "White" : "Black";
    turnLabel.textContent = turn.toUpperCase() + " TO MOVE";
    if (game.in_checkmate()) {
      statusEl.textContent = "Checkmate. " + (game.turn() === "w" ? "Black" : "White") + " wins. Nicely played.";
      if (puzzleMode) toast("Puzzle solved. Checkmate! ♛");
    } else if (game.in_draw()) {
      statusEl.textContent = "It's a draw. A perfectly respectable result.";
    } else if (game.in_check()) {
      statusEl.textContent = turn + " to move. Check!";
    } else if (puzzleMode) {
      statusEl.textContent = "Puzzle position. Find the move that ends the game.";
    } else {
      statusEl.textContent = turn + " to move. Make yourself at home.";
    }
  }
  function renderBoard() {
    const rows = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) rows.push({r:r,f:f});
    if (flipped) rows.reverse();
    const board = game.board();
    boardEl.innerHTML = "";
    rows.forEach(function (pos) {
      const rank = 8 - pos.r;
      const file = "abcdefgh"[pos.f];
      const square = file + rank;
      const piece = board[pos.r][pos.f];
      const isLight = (pos.r + pos.f) % 2 === 1;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "square " + (isLight ? "light" : "dark");
      button.dataset.square = square;
      button.setAttribute("aria-label", square + (piece ? " " + piece.color + " " + piece.type : " empty"));
      if (selected === square) button.classList.add("selected");
      if (lastMove && (lastMove.from === square || lastMove.to === square)) button.classList.add("last-move");
      if (legalTargets.some(m => m.to === square)) button.classList.add(piece ? "legal-capture" : "legal-target");
      if ((!flipped && pos.f === 0) || (flipped && pos.f === 7)) {
        const rankMark = document.createElement("span");
        rankMark.className = "coord rank";
        rankMark.textContent = rank;
        button.appendChild(rankMark);
      }
      if ((!flipped && pos.r === 7) || (flipped && pos.r === 0)) {
        const fileMark = document.createElement("span");
        fileMark.className = "coord file";
        fileMark.textContent = file;
        button.appendChild(fileMark);
      }
      if (piece) {
        const span = document.createElement("span");
        span.className = "piece " + (piece.color === "w" ? "white" : "black");
        span.textContent = pieceGlyph[piece.color + piece.type];
        button.appendChild(span);
      }
      boardEl.appendChild(button);
    });
  }
  function refresh() { renderBoard(); renderMoves(); renderStatus(); }
  function selectSquare(square) {
    const moves = game.moves({square:square,verbose:true});
    if (!moves.length) { clearSelection(); renderBoard(); return; }
    selected = square;
    legalTargets = moves;
    renderBoard();
  }
  function finishMove(move) {
    lastMove = {from:move.from,to:move.to};
    clearSelection();
    soundMove(!!move.captured);
    refresh();
    if (game.in_checkmate()) soundWin();
    if (puzzleMode) {
      if (move.from === "e1" && move.to === "e8" && game.in_checkmate()) {
        toast("You found it. Checkmate in one. ♕");
        puzzleMode = false;
      } else {
        toast("Not quite. Try the finishing move again.");
        setTimeout(loadPuzzle, 650);
      }
    }
  }
  function makeMove(from,to,promotion) {
    let move;
    try { move = game.move({from:from,to:to,promotion:promotion || "q"}); } catch (error) { move = null; }
    if (!move) return false;
    finishMove(move);
    return true;
  }
  function openPromotion(from,to) {
    pendingPromotion = {from:from,to:to};
    document.getElementById("promotion-modal").classList.add("open");
    document.getElementById("promotion-modal").setAttribute("aria-hidden","false");
  }
  function closePromotion() {
    document.getElementById("promotion-modal").classList.remove("open");
    document.getElementById("promotion-modal").setAttribute("aria-hidden","true");
    pendingPromotion = null;
  }
  boardEl.addEventListener("click", function (event) {
    const button = event.target.closest("[data-square]");
    if (!button || game.game_over() || pendingPromotion) return;
    const square = button.dataset.square;
    const piece = game.get(square);
    if (selected) {
      const target = legalTargets.find(m => m.to === square);
      if (target) {
        if (target.flags.indexOf("p") !== -1) openPromotion(selected,square);
        else makeMove(selected,square);
        return;
      }
    }
    if (piece && piece.color === game.turn()) { selectSquare(square); return; }
    clearSelection();
    renderBoard();
  });
  document.querySelectorAll("[data-promotion]").forEach(button => {
    button.addEventListener("click", function () {
      if (!pendingPromotion) return;
      const move = pendingPromotion;
      closePromotion();
      makeMove(move.from,move.to,this.dataset.promotion);
    });
  });
  document.getElementById("undo-move").addEventListener("click", function () {
    if (!game.history().length) return;
    game.undo();
    if (puzzleMode) puzzleMode = false;
    lastMove = null;
    clearSelection();
    refresh();
    tone(340,.1,"triangle",.025);
  });
  document.getElementById("flip-board").addEventListener("click", function () {
    flipped = !flipped;
    renderBoard();
  });
  document.getElementById("reset-game").addEventListener("click", function () {
    game.reset(); puzzleMode = false; lastMove = null; clearSelection(); refresh(); toast("Fresh board. White to move.");
  });
  function loadPuzzle() {
    game.load(puzzleFen);
    puzzleMode = true;
    lastMove = null;
    clearSelection();
    flipped = false;
    refresh();
    document.getElementById("the-game").scrollIntoView({behavior:"smooth",block:"start"});
    toast("White to move. One move to checkmate.");
  }
  document.getElementById("start-puzzle").addEventListener("click", loadPuzzle);

  const noteModal = document.getElementById("note-modal");
  document.querySelectorAll(".note-tile").forEach(function (tile) {
    tile.addEventListener("click", function () {
      document.getElementById("modal-title").textContent = tile.dataset.noteTitle;
      document.getElementById("modal-body").textContent = tile.dataset.noteBody;
      noteModal.classList.add("open");
      noteModal.setAttribute("aria-hidden","false");
    });
  });
  function closeNote() { noteModal.classList.remove("open"); noteModal.setAttribute("aria-hidden","true"); }
  document.querySelectorAll("[data-close-note]").forEach(el => el.addEventListener("click",closeNote));
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { closeNote(); closePromotion(); }
  });
  refresh();
})();