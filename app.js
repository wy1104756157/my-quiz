/**
 * 智能刷题系统核心逻辑 - 理性建筑师版
 * 功能：全量进度持久化、错题二次正确剔除制、双向导航
 */

let allQuestions = []; // 原始总题库
let currentQueue = [];    // 当前练习队列
let currentIndex = 0;     // 当前题目索引
let selectedOptions = []; // 多选题暂存状态
let isWrongMode = false;  // 模式标识

// 1. 初始化：从本地读取数据并检查进度
fetch('questions.json')
    .then(response => response.json())
    .then(data => {
        allQuestions = data;
        initQuiz(); 
        updateWrongCountDisplay();
    })
    .catch(error => {
        document.getElementById('question-text').innerText = "题库加载失败，请检查 questions.json。";
        console.error(error);
    });

// 2. 初始化/恢复刷题进度
function initQuiz() {
    const savedQueue = localStorage.getItem('quiz_queue');
    const savedIndex = localStorage.getItem('quiz_index');

    if (savedQueue && savedIndex !== null) {
        // 恢复上次未完成的顺序和位置
        currentQueue = JSON.parse(savedQueue);
        currentIndex = parseInt(savedIndex);
        console.log("已恢复上次进度：第 " + (currentIndex + 1) + " 题");
    } else {
        // 全新开始：打乱全量题库并存入缓存
        currentQueue = shuffleArray([...allQuestions]);
        currentIndex = 0;
        saveProgress();
    }
    
    isWrongMode = false;
    updateUIForMode("全量刷题模式", "#all-quiz-btn");
    loadQuestion();
}

// 3. 进度持久化
function saveProgress() {
    if (!isWrongMode) {
        localStorage.setItem('quiz_queue', JSON.stringify(currentQueue));
        localStorage.setItem('quiz_index', currentIndex);
    }
}

// 4. 加载题目渲染
function loadQuestion() {
    if (currentQueue.length === 0) return;
    const q = currentQueue[currentIndex];
    selectedOptions = []; // 重置选中项
    
    // 更新基础UI信息
    document.getElementById('question-type').innerText = q.type;
    document.getElementById('progress').innerText = `${currentIndex + 1} / ${currentQueue.length}`;
    document.getElementById('question-text').innerText = `${q.id}. ${q.question}`;
    
    // 渲染选项按钮
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    for (const [key, value] of Object.entries(q.options)) {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = `${key}: ${value}`;
        btn.onclick = () => handleOptionClick(key, btn, q.type);
        container.appendChild(btn);
    }
    
    // 导航控制：第一题不显示“上一题”
    document.getElementById('prev-btn').classList.toggle('hidden', currentIndex === 0);
    resetFeedbackUI();
}

// 5. 判题核心路由
function handleResult(isCorrect) {
    const q = currentQueue[currentIndex];
    lockAllButtons();
    
    if (isCorrect) {
        // 错题模式下，累加正确计数
        if (isWrongMode) updateWrongProgression(q.id, true);
    } else {
        // 答错，无论什么模式都入库/重置
        addToWrongPool(q);
    }
    showExplanation();
}

// 6. 错题集逻辑：连续两次正确剔除制
function addToWrongPool(question) {
    let pool = getWrongPool();
    let existingIndex = pool.findIndex(item => item.id === question.id);
    
    if (existingIndex === -1) {
        // 首次入库，计数为0
        pool.push({ ...question, correctCount: 0 });
    } else {
        // 已在库中但又错了，计数归零（重新计算连续）
        pool[existingIndex].correctCount = 0;
    }
    saveWrongPool(pool);
}

function updateWrongProgression(qId, isCorrect) {
    let pool = getWrongPool();
    let index = pool.findIndex(item => item.id === qId);
    
    if (index !== -1 && isCorrect) {
        pool[index].correctCount += 1;
        // 只有连续两次答对才剔除
        if (pool[index].correctCount >= 2) {
            pool.splice(index, 1);
        }
        saveWrongPool(pool);
    }
}

// 7. 存储辅助函数
function getWrongPool() {
    return JSON.parse(localStorage.getItem('smart_wrong_pool_v4')) || [];
}

function saveWrongPool(pool) {
    localStorage.setItem('smart_wrong_pool_v4', JSON.stringify(pool));
    updateWrongCountDisplay();
}

function updateWrongCountDisplay() {
    document.getElementById('wrong-count').innerText = getWrongPool().length;
}

// 8. 事件监听：模式切换
document.getElementById('all-quiz-btn').addEventListener('click', () => {
    if (isWrongMode) initQuiz(); // 切回全量，恢复进度
});

document.getElementById('wrong-pool-btn').addEventListener('click', () => {
    let pool = getWrongPool();
    if (pool.length === 0) {
        alert("错题集目前是空的，请继续全量刷题！");
        return;
    }
    isWrongMode = true;
    currentQueue = shuffleArray([...pool]); // 错题集始终洗牌
    currentIndex = 0;
    updateUIForMode("错题练习模式", "#wrong-pool-btn");
    loadQuestion();
});

// 9. 答题交互处理
function handleOptionClick(key, btn, type) {
    if (type === '单选题' || type === '判断题') {
        const isCorrect = (key === currentQueue[currentIndex].answer);
        btn.classList.add(isCorrect ? 'correct' : 'wrong');
        handleResult(isCorrect);
    } else {
        // 多选题逻辑
        const idx = selectedOptions.indexOf(key);
        if (idx > -1) { 
            selectedOptions.splice(idx, 1); 
            btn.classList.remove('selected'); 
        } else { 
            selectedOptions.push(key); 
            btn.classList.add('selected'); 
        }
        document.getElementById('submit-btn').classList.toggle('hidden', selectedOptions.length === 0);
    }
}

document.getElementById('submit-btn').addEventListener('click', () => {
    const q = currentQueue[currentIndex];
    const userAns = selectedOptions.sort().join('');
    const correctAns = q.answer.split('').sort().join('');
    const isCorrect = (userAns === correctAns);
    
    document.querySelectorAll('.option-btn').forEach(btn => {
        const key = btn.innerText.split(':')[0];
        if (selectedOptions.includes(key)) btn.classList.add(isCorrect ? 'correct' : 'wrong');
    });
    document.getElementById('submit-btn').classList.add('hidden');
    handleResult(isCorrect);
});

// 10. 翻页控制
document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex--;
        if (!isWrongMode) saveProgress();
        loadQuestion();
    }
});

document.getElementById('next-btn').addEventListener('click', () => {
    if (currentIndex < currentQueue.length - 1) {
        currentIndex++;
        if (!isWrongMode) saveProgress();
        loadQuestion();
    } else {
        if (isWrongMode) {
            alert("错题轮次练习结束！");
        } else {
            alert("恭喜！全量题库已刷完。即将重新洗牌开启新一轮。");
            localStorage.removeItem('quiz_queue');
            localStorage.removeItem('quiz_index');
            initQuiz();
        }
    }
});

// --- 基础工具函数 ---
function updateUIForMode(title, activeBtnId) {
    document.getElementById('mode-badge').innerText = title;
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(activeBtnId).classList.add('active');
}

function lockAllButtons() {
    document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);
}

function resetFeedbackUI() {
    document.getElementById('explanation-box').classList.add('hidden');
    document.getElementById('next-btn').classList.add('hidden');
    document.getElementById('submit-btn').classList.add('hidden');
}

function showExplanation() {
    const q = currentQueue[currentIndex];
    document.getElementById('correct-answer').innerText = q.answer;
    document.getElementById('explanation-text').innerText = q.explanation;
    document.getElementById('explanation-box').classList.remove('hidden');
    document.getElementById('next-btn').classList.remove('hidden');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

document.getElementById('clear-wrong-btn').addEventListener('click', () => {
    if(confirm("确定要清空所有错题记录吗？进度也将重置。")) {
        localStorage.clear();
        location.reload();
    }
});