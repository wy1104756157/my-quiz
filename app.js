let allQuestions = []; 
let currentQueue = [];    
let currentIndex = 0;
let selectedOptions = []; // 统一存储用户选中的选项
let isWrongMode = false;

// 1. 初始化
fetch('questions.json')
    .then(response => response.json())
    .then(data => {
        allQuestions = data;
        initQuiz(); 
        updateWrongCountDisplay();
    });

function initQuiz() {
    const savedQueue = localStorage.getItem('quiz_queue');
    const savedIndex = localStorage.getItem('quiz_index');
    if (savedQueue && savedIndex !== null) {
        currentQueue = JSON.parse(savedQueue);
        currentIndex = parseInt(savedIndex);
    } else {
        currentQueue = shuffleArray([...allQuestions]);
        currentIndex = 0;
        saveProgress();
    }
    isWrongMode = false;
    updateUIForMode("全量刷题模式", "#all-quiz-btn");
    loadQuestion();
}

function saveProgress() {
    if (!isWrongMode) {
        localStorage.setItem('quiz_queue', JSON.stringify(currentQueue));
        localStorage.setItem('quiz_index', currentIndex);
    }
}

// 2. 加载题目
function loadQuestion() {
    if (currentQueue.length === 0) return;
    const q = currentQueue[currentIndex];
    selectedOptions = []; // 清空之前的选择
    
    document.getElementById('question-type').innerText = q.type;
    document.getElementById('progress').innerText = `${currentIndex + 1} / ${currentQueue.length}`;
    document.getElementById('question-text').innerText = `${q.id}. ${q.question}`;
    
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    for (const [key, value] of Object.entries(q.options)) {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = `${key}: ${value}`;
        btn.onclick = () => handleOptionClick(key, btn, q.type);
        container.appendChild(btn);
    }
    
    document.getElementById('prev-btn').classList.toggle('hidden', currentIndex === 0);
    resetFeedbackUI();
}

// 3. 【核心修改】点击选项逻辑：只负责选中，不判题
function handleOptionClick(key, btn, type) {
    if (btn.disabled) return;

    if (type === '单选题' || type === '判断题') {
        // 单选/判断：互斥选中（只能选一个）
        selectedOptions = [key];
        document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    } else {
        // 多选题：多选/反选
        const idx = selectedOptions.indexOf(key);
        if (idx > -1) {
            selectedOptions.splice(idx, 1);
            btn.classList.remove('selected');
        } else {
            selectedOptions.push(key);
            btn.classList.add('selected');
        }
    }
    
    // 只要有选中，就显示提交按钮
    document.getElementById('submit-btn').classList.toggle('hidden', selectedOptions.length === 0);
}

// 4. 【核心修改】点击提交按钮逻辑：真正开始判题
document.getElementById('submit-btn').addEventListener('click', () => {
    const q = currentQueue[currentIndex];
    const userAns = selectedOptions.sort().join('');
    const correctAns = q.answer.split('').sort().join('');
    const isCorrect = (userAns === correctAns);
    
    // 涂色反馈
    document.querySelectorAll('.option-btn').forEach(btn => {
        const key = btn.innerText.split(':')[0];
        btn.disabled = true; // 锁定按钮
        if (selectedOptions.includes(key)) {
            btn.classList.remove('selected');
            btn.classList.add(isCorrect ? 'correct' : 'wrong');
        }
    });

    document.getElementById('submit-btn').classList.add('hidden');
    handleResult(isCorrect);
});

// 5. 判题结果处理（维持之前的错题逻辑）
function handleResult(isCorrect) {
    const q = currentQueue[currentIndex];
    if (isCorrect) {
        if (isWrongMode) updateWrongProgression(q.id, true);
    } else {
        addToWrongPool(q);
    }
    showExplanation();
}

// ---------------- 错题与工具函数 (保持不变) ----------------

function addToWrongPool(question) {
    let pool = getWrongPool();
    let existing = pool.find(item => item.id === question.id);
    if (!existing) {
        pool.push({ ...question, correctCount: 0 });
    } else {
        existing.correctCount = 0;
    }
    saveWrongPool(pool);
}

function updateWrongProgression(qId, isCorrect) {
    let pool = getWrongPool();
    let index = pool.findIndex(item => item.id === qId);
    if (index !== -1 && isCorrect) {
        pool[index].correctCount += 1;
        if (pool[index].correctCount >= 2) pool.splice(index, 1);
        saveWrongPool(pool);
    }
}

function getWrongPool() { return JSON.parse(localStorage.getItem('smart_wrong_pool_v4')) || []; }
function saveWrongPool(pool) { 
    localStorage.setItem('smart_wrong_pool_v4', JSON.stringify(pool)); 
    updateWrongCountDisplay();
}
function updateWrongCountDisplay() { document.getElementById('wrong-count').innerText = getWrongPool().length; }

function showExplanation() {
    const q = currentQueue[currentIndex];
    document.getElementById('correct-answer').innerText = q.answer;
    document.getElementById('explanation-text').innerText = q.explanation;
    document.getElementById('explanation-box').classList.remove('hidden');
    document.getElementById('next-btn').classList.remove('hidden');
}

function resetFeedbackUI() {
    document.getElementById('explanation-box').classList.add('hidden');
    document.getElementById('next-btn').classList.add('hidden');
    document.getElementById('submit-btn').classList.add('hidden');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function updateUIForMode(title, activeBtnId) {
    document.getElementById('mode-badge').innerText = title;
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(activeBtnId).classList.add('active');
}

// 翻页控制
document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentIndex > 0) { currentIndex--; if(!isWrongMode) saveProgress(); loadQuestion(); }
});

document.getElementById('next-btn').addEventListener('click', () => {
    if (currentIndex < currentQueue.length - 1) {
        currentIndex++; if(!isWrongMode) saveProgress(); loadQuestion();
    } else {
        if (!isWrongMode) {
            alert("全量刷题完成！即将开启新一轮随机。");
            localStorage.removeItem('quiz_queue'); localStorage.removeItem('quiz_index'); initQuiz();
        } else { alert("错题练习结束！"); }
    }
});

document.getElementById('all-quiz-btn').addEventListener('click', () => { if(isWrongMode) initQuiz(); });
document.getElementById('wrong-pool-btn').addEventListener('click', () => {
    let pool = getWrongPool();
    if (pool.length === 0) { alert("错题集为空！"); return; }
    isWrongMode = true; currentQueue = shuffleArray([...pool]); currentIndex = 0;
    updateUIForMode("错题练习模式", "#wrong-pool-btn"); loadQuestion();
});
document.getElementById('clear-wrong-btn').addEventListener('click', () => {
    if(confirm("确定清空吗？")) { localStorage.clear(); location.reload(); }
});