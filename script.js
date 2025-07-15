// ----------------
// 変数定義
// ----------------
let START_WORD = "";
let GOAL_WORD = "";

let clickCount = 0;
let currentWord = "";

// スコア関連
let score = 0;
const INITIAL_SCORE = 0; // スコアを0からスタート
const CLICK_PENALTY = 100; // 1クリックあたりの減点
const HINT_PENALTY = 2000; // ヒント1回あたりの減点
const SKIP_PENALTY = 5000; // スキップ1回あたりの減点
const ROUND_CLEAR_BONUS = 1000; // ラウンドクリア時のボーナス
let hintUsedThisRound = false; // このラウンドでヒントを使ったか

// ゲームモード関連
const DIFFICULTY_STEPS = [2, 3, 4]; // 各ラウンドの目標クリック数
const TOTAL_ROUNDS = DIFFICULTY_STEPS.length; // 総ラウンド数
let clearedRounds = 0; // クリアしたラウンド数

// ----------------
// DOM要素
// ----------------
let linksContainer;
let gameStateDiv;

// ----------------
// ゲームロジック
// ----------------

/**
 * ゲーム全体を開始する（初回または全ゲームクリア後）
 */
async function startGame() {
    clearedRounds = 0; // クリアラウンド数をリセット
    score = INITIAL_SCORE; // スコアを初期化
    await startNewRound();
}

/**
 * 新しいラウンドを開始する
 */
async function startNewRound() {
    // UIを初期化
    gameStateDiv.innerHTML = '<p>お題を読み込み中...</p>';
    linksContainer.innerHTML = '';
    

    // ラウンドごとの変数をリセット
    clickCount = 0;
    hintUsedThisRound = false;

    // 現在のラウンドの目標クリック数を取得
    const targetClicks = DIFFICULTY_STEPS[clearedRounds];
    if (targetClicks === undefined) {
        // 全ラウンドクリア後の処理（startGame()でリセットされるはずだが念のため）
        console.error("No more difficulty steps defined.");
        return;
    }

    let pathFound = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 10; // パスが見つからない場合の最大試行回数

    while (!pathFound && attempts < MAX_ATTEMPTS) {
        attempts++;
        // ランダムなゴール単語を取得
        const randomWords = await fetchRandomWords(1);
        if (!randomWords || randomWords.length === 0) {
            gameStateDiv.innerHTML = '<p>お題の取得に失敗しました。リロードしてください。</p>';
            return;
        }
        GOAL_WORD = randomWords[0];

        // ゴールから逆算してスタート単語を見つける
        START_WORD = await findStartWordByBacktracking(GOAL_WORD, targetClicks);

        if (START_WORD) {
            pathFound = true;
        } else {
            console.warn(`Attempt ${attempts}: Could not find a path of ${targetClicks} clicks to ${GOAL_WORD}. Retrying...`);
        }
    }

    if (!pathFound) {
        gameStateDiv.innerHTML = `<p>難易度 ${targetClicks} のお題を見つけられませんでした。リロードしてください。</p>`;
        return;
    }

    currentWord = START_WORD;

    updateUI();
    await fetchLinks(currentWord);
}

/**
 * ランダムな単語をWikipediaから取得する
 * @param {number} count - 取得する単語の数
 * @returns {Promise<string[]|null>}
 */
async function fetchRandomWords(count) {
    try {
        const url = `https://ja.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=${count}&format=json&origin=*`;
        const response = await fetch(url);
        const data = await response.json();
        return data.query.random.map(item => item.title);
    } catch (error) {
        console.error("Failed to fetch random words:", error);
        return null;
    }
}

/**
 * 指定された単語から指定されたクリック数だけ逆算してスタート単語を見つける
 * @param {string} goalWord - ゴールとなる単語
 * @param {number} clicks - 目標とするクリック数
 * @returns {Promise<string|null>} 見つかったスタート単語、またはnull
 */
async function findStartWordByBacktracking(goalWord, clicks) {
    let current = goalWord;
    let path = [goalWord];

    for (let i = 0; i < clicks; i++) {
        const backlinks = await fetchBacklinks(current);
        if (!backlinks || backlinks.length === 0) {
            return null; // パスが見つからない
        }
        // ランダムに1つ前の単語を選択
        const prevWord = backlinks[Math.floor(Math.random() * backlinks.length)];
        path.unshift(prevWord); // パスの先頭に追加
        current = prevWord;
    }
    return path[0]; // 最終的なスタート単語
}

/**
 * 指定された単語にリンクしているページ（バックリンク）を取得する
 * @param {string} word - バックリンクを取得する単語
 * @returns {Promise<string[]|null>} バックリンクのタイトル配列、またはnull
 */
async function fetchBacklinks(word) {
    try {
        // blnamespace=0 で記事ページのみに限定
        const url = `https://ja.wikipedia.org/w/api.php?action=query&list=backlinks&bltitle=${encodeURIComponent(word)}&bllimit=max&format=json&origin=*&blnamespace=0`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.query && data.query.backlinks) {
            return data.query.backlinks.map(item => item.title);
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch backlinks:", error);
        return null;
    }
}

/**
 * UIの表示を現在の状態に合わせて更新する
 */
function updateUI() {
    // 現在の検索入力欄の値を保存
    const oldSearchInput = document.getElementById('searchInput');
    const savedSearchTerm = oldSearchInput ? oldSearchInput.value : '';

    const currentTargetClicks = DIFFICULTY_STEPS[clearedRounds] !== undefined ? DIFFICULTY_STEPS[clearedRounds] : 'N/A'; // Handle undefined for final round or error

    gameStateDiv.innerHTML = `
        <div class="location-info">
            <div class="location-box">
                <p class="location-label">現在地</p>
                <p id="currentWord" class="word-display"></p>
                <div class="hint-placeholder">&nbsp;</div>
            </div>
            <div class="arrow">→</div>
            <div class="location-box">
                <p class="location-label">ゴール</p>
                <p id="goalWord" class="word-display"></p>
                <span id="hintLink" class="hint-link">ヒントを見る</span>
            </div>
        </div>
        <div class="game-stats">
            <div class="stat-item">ラウンド: <span id="roundCount">${clearedRounds + 1}/${TOTAL_ROUNDS}</span></div>
            <div class="stat-item">目標クリック数: <span id="targetClicks">${currentTargetClicks}</span></div>
            <div class="stat-item">クリック数: <span id="clickCount">${clickCount}</span></div>
            <div class="stat-item">スコア: <span id="score">${score}</span></div>
        </div>
        <div class="controls">
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="リンクを検索">
            </div>
            <button id="skipButton">お題をスキップ</button>
        </div>
    `;
    document.getElementById('goalWord').textContent = GOAL_WORD;
    document.getElementById('currentWord').textContent = currentWord;

    document.getElementById('hintLink')?.addEventListener('click', showHint);
    document.getElementById('skipButton')?.addEventListener('click', skipGame);

    // 新しい検索入力欄に保存した値を設定し、イベントリスナーを再設定
    const newSearchInput = document.getElementById('searchInput');
    if (newSearchInput) {
        newSearchInput.value = savedSearchTerm;
        newSearchInput.addEventListener('input', filterAndScrollToLink);
        // 値を再設定した後、ハイライトを再適用
        filterAndScrollToLink();
    }
}

/**
 * リンクリストから指定された単語を検索し、スクロールしてハイライトする
 */
function filterAndScrollToLink() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase();
    const linkItems = linksContainer.querySelectorAll('.link-item');

    // 既存のハイライトを全て解除
    linkItems.forEach(item => {
        item.classList.remove('highlighted-link');
    });

    if (searchTerm === '') {
        return; // 検索語が空の場合は何もしない
    }

    let firstMatchFound = false;
    for (const item of linkItems) {
        if (item.textContent.toLowerCase().includes(searchTerm)) {
            item.classList.add('highlighted-link');
            if (!firstMatchFound) {
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstMatchFound = true;
            }
        }
    }
}

/**
 * ゴール単語のヒント（概要）を表示する
 */
async function showHint() {
    if (!hintUsedThisRound) {
        score -= HINT_PENALTY; // スコアを減点
        hintUsedThisRound = true;
        updateUI(); // スコアを更新
    }

    try {
        const url = `https://ja.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(GOAL_WORD)}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`;
        const response = await fetch(url);
        const data = await response.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        const extract = pages[pageId].extract;

        if (extract) {
            alert(`【ヒント：${GOAL_WORD}】\n\n${extract}`);
        } else {
            alert(`「${GOAL_WORD}」のヒントを取得できませんでした。`);
        }
    } catch (error) {
        console.error("Hint fetch error:", error);
        alert("ヒントの取得中にエラーが発生しました。");
    }
}

/**
 * 指定された単語のWikipediaページからリンクを取得し、画面に表示する
 * @param {string} word - 取得するページの単語
 */
async function fetchLinks(word) {
    linksContainer.innerHTML = '<p>読み込み中...</p>';
    try {
        const url = `https://ja.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(word)}&prop=links&pllimit=max&format=json&origin=*`;
        const response = await fetch(url);
        const data = await response.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];

        if (pageId === "-1") {
            linksContainer.innerHTML = `<p>ページ「${word}」が見つかりません。</p>`;
            return;
        }

        const links = pages[pageId].links ? pages[pageId].links.map(link => link.title) : [];
        linksContainer.innerHTML = '';

        if (links.length === 0) {
            linksContainer.innerHTML = '<p>このページにはリンクがありません。</p>';
            return;
        }

        links.forEach(linkTitle => {
            const linkElement = document.createElement('a');
            linkElement.className = 'link-item';
            linkElement.href = '#';
            linkElement.textContent = linkTitle;
            linksContainer.appendChild(linkElement);
        });
    } catch (error) {
        console.error('Error fetching links:', error);
        linksContainer.innerHTML = '<p>リンクの取得中にエラーが発生しました。</p>';
    }
}

/**
 * リンクがクリックされたときの処理
 * @param {string} clickedWord - クリックされた単語
 */
async function handleLinkClick(clickedWord) {
    if (currentWord === GOAL_WORD) return; // ゲーム終了後は何もしない

    clickCount++;
    score -= CLICK_PENALTY; // スコアを減点
    currentWord = clickedWord;

    updateUI();

    if (currentWord === GOAL_WORD) {
        const targetClicks = DIFFICULTY_STEPS[clearedRounds];
        score += ROUND_CLEAR_BONUS; // ラウンドクリアボーナスを加算

        let roundClearMessage = `ラウンド${clearedRounds + 1}クリア！`;
        if (clickCount === targetClicks) {
            roundClearMessage += ` 目標クリック数 ${targetClicks} でゴールに到達しました！`;
        } else {
            roundClearMessage += ` ${clickCount}クリックでゴールに到達しました。（目標: ${targetClicks}クリック）`;
        }

        clearedRounds++;
        if (clearedRounds === TOTAL_ROUNDS) {
            // 全ラウンドクリア！
            linksContainer.innerHTML = `<h1>全ラウンドクリア！</h1><p>${TOTAL_ROUNDS}ラウンドをクリアしました！</p><p>最終スコア: ${score}点</p><button id="restartButton">もう一度プレイする</button>`;
            document.getElementById('restartButton').addEventListener('click', startGame);
            alert(`全ラウンドクリア！ ${TOTAL_ROUNDS}ラウンドをクリアしました！ 最終スコア: ${score}点`);
        } else {
            // ラウンドクリア！次のラウンドへ
            linksContainer.innerHTML = `<h1>${roundClearMessage}</h1><p>次のラウンドへ進みます...</p>`;
            alert(roundClearMessage + ` 次のラウンドへ進みます。`);
            setTimeout(() => {
                startNewRound();
            }, 1500); // 1.5秒後に次のラウンドを開始
        }
    } else {
        await fetchLinks(currentWord);
    }
}

/**
 * 現在のお題をスキップして新しいラウンドを開始する
 */
function skipGame() {
    if (confirm("現在のお題をスキップして新しいゲームを始めますか？スコアが減点されます。")) {
        score -= SKIP_PENALTY; // スコアを減点
        startNewRound(); // 新しいラウンドを開始
    }
}

// ----------------
// イベントリスナー
// ----------------

document.addEventListener('DOMContentLoaded', () => {
    linksContainer = document.getElementById('linksContainer');
    gameStateDiv = document.getElementById('gameState');

    linksContainer.addEventListener('click', (event) => {
        if (event.target && event.target.classList.contains('link-item')) {
            event.preventDefault();
            const clickedWord = event.target.textContent;
            handleLinkClick(clickedWord);
        }
    });

    startGame(); // ゲーム全体を開始
});