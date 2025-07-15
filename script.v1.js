// ----------------
// 変数定義
// ----------------
let START_WORD = "";
let GOAL_WORD = "";

let clickCount = 0;
let currentWord = "";

// ----------------
// DOM要素
// ----------------
let linksContainer;
let gameStateDiv;

// ----------------
// ゲームロジック
// ----------------

/**
 * ゲームを開始またはリセットする
 */
async function startGame() {
    // UIを初期化
    gameStateDiv.innerHTML = '<p>お題を読み込み中...</p>';
    linksContainer.innerHTML = '';
    document.body.style.backgroundColor = '#333'; // 背景色をリセット

    // ランダムな単語を2つ取得
    const randomWords = await fetchRandomWords(2);
    if (!randomWords || randomWords.length < 2) {
        gameStateDiv.innerHTML = '<p>お題の取得に失敗しました。リロードしてください。</p>';
        return;
    }

    [START_WORD, GOAL_WORD] = randomWords;
    currentWord = START_WORD;
    clickCount = 0;

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
 * UIの表示を現在の状態に合わせて更新する
 */
function updateUI() {
    // gameStateDivがクリアされている可能性があるので、中身を再構築
    gameStateDiv.innerHTML = `
        <p>現在地: <br><span id="currentWord" class="word-display"></span></p>
        <div class="game-center-controls">
            <p>クリック数: <span id="clickCount">0</span></p>
            <button id="hintButton">ヒントを見る</button>
        </div>
        <p class="goal-text">ゴール: <br><span id="goalWord" class="word-display"></span></p>
    `;
    document.getElementById('goalWord').textContent = GOAL_WORD;
    document.getElementById('clickCount').textContent = clickCount;
    document.getElementById('currentWord').textContent = currentWord;

    // ヒントボタンにイベントリスナーを追加
    const hintButton = document.getElementById('hintButton');
    if(hintButton) {
        hintButton.addEventListener('click', showHint);
    }
}

/**
 * ゴール単語のヒント（概要）を表示する
 */
async function showHint() {
    const hintButton = document.getElementById('hintButton');
    try {
        // ボタンを一時的に無効化
        hintButton.disabled = true;
        hintButton.textContent = '取得中...';

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
    } finally {
        // ボタンを元に戻す
        if(hintButton) {
            hintButton.disabled = false;
            hintButton.textContent = 'ヒントを見る';
        }
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
    currentWord = clickedWord;

    updateUI();

    if (currentWord === GOAL_WORD) {
        document.body.style.backgroundColor = '#28a745';
        linksContainer.innerHTML = `<h1>クリア！</h1><p>${clickCount}回でゴールに到達しました。</p><button id="restartButton">新しいゲームを始める</button>`;
        document.getElementById('restartButton').addEventListener('click', startGame);
        alert(`クリア！ ${clickCount}回でゴールしました！`);
    } else {
        await fetchLinks(currentWord);
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

    startGame();
});
