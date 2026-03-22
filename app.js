import { supabase, getUsernameFromEmail, submitScore, getLeaderboard } from './supabase.js';

// ==================== 状态管理 ====================
let currentUser = null;
let currentSession = null;
let isGuest = false; // 游客模式

// ==================== DOM 元素 ====================
const authContainer = document.getElementById('auth-container');
const gameContainer = document.getElementById('game-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const logoutBtn = document.getElementById('logout-btn');
const leaderboardList = document.getElementById('leaderboard-list');
const messageEl = document.querySelector('.message');

// ==================== 认证状态检查 ====================
async function checkAuthState() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    currentSession = session;
    currentUser = session.user;
    showGame();
  } else {
    showAuth();
  }

  // 监听认证状态变化
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentSession = session;
      currentUser = session.user;
      showGame();
    } else if (event === 'SIGNED_OUT') {
      currentSession = null;
      currentUser = null;
      showAuth();
    }
  });
}

// ==================== 界面切换 ====================
function showAuth() {
  authContainer.style.display = 'block';
  gameContainer.style.display = 'none';
  isGuest = false;
}

function showGame() {
  authContainer.style.display = 'none';
  gameContainer.style.display = 'flex';

  const userAvatar = document.getElementById('user-avatar');
  const logoutBtn = document.getElementById('logout-btn');

  if (isGuest) {
    // 游客模式
    userAvatar.style.display = 'none';
    logoutBtn.textContent = '返回登录';
    logoutBtn.style.display = 'inline-block';
  } else if (currentUser) {
    // 登录用户
    userAvatar.style.display = 'inline-block';
    userAvatar.src = getAvatarUrl(currentUser.email);
    logoutBtn.textContent = '退出登录';
    logoutBtn.style.display = 'inline-block';
  }

  updateLeaderboard();
}

// 生成头像 URL（基于邮箱生成固定动物头像）
function getAvatarUrl(email) {
  const seed = encodeURIComponent(email);
  return `https://api.dicebear.com/7.x/adventurer/png?seed=${seed}&backgroundColor=b6e3f4`;
}

// ==================== 表单切换 ====================
showRegister.addEventListener('click', () => {
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
  messageEl.style.display = 'none';
});

showLogin.addEventListener('click', () => {
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
  messageEl.style.display = 'none';
});

// ==================== 显示消息 ====================
function showMessage(text, type = 'error') {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

// ==================== 注册 ====================
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;

  if (password !== confirmPassword) {
    showMessage('两次密码输入不一致');
    return;
  }

  if (password.length < 6) {
    showMessage('密码至少需要6个字符');
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    showMessage(error.message);
  } else {
    showMessage('注册成功，请登录', 'success');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  }
});

// ==================== 登录 ====================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('登录错误:', error);
    showMessage(error.message || '邮箱或密码错误');
  } else {
    showGame();
  }
});

// ==================== 登出 ====================
logoutBtn.addEventListener('click', async () => {
  if (isGuest) {
    // 游客模式返回登录
    isGuest = false;
    showAuth();
  } else {
    await supabase.auth.signOut();
  }
});

// ==================== 游客试玩 ====================
document.getElementById('guest-btn').addEventListener('click', () => {
  isGuest = true;
  showGame();
});

// ==================== 更新排行榜 ====================
async function updateLeaderboard() {
  try {
    const leaderboard = await getLeaderboard();

    if (leaderboard.length === 0) {
      leaderboardList.innerHTML = '<div class="no-data">暂无排行榜数据</div>';
      return;
    }

    leaderboardList.innerHTML = leaderboard.map((item, index) => `
      <li class="leaderboard-item ${index < 3 ? 'top-3' : ''}">
        <span class="rank rank-${index + 1}">${index + 1}</span>
        <img class="leaderboard-avatar" src="${getAvatarUrl(item.username + '@avatar')}" alt="头像">
        <span class="username">${maskUsername(item.username)}</span>
        <span class="score">${item.score}</span>
      </li>
    `).join('');
  } catch (error) {
    console.error('获取排行榜失败:', error);
  }
}

// 用户名脱敏（保护隐私）
function maskUsername(username) {
  if (username.length <= 4) {
    return username[0] + '***';
  }
  const start = username.slice(0, 2);
  const end = username.slice(-2);
  const maskCount = Math.min(username.length - 4, 4);
  const mask = '*'.repeat(maskCount);
  return start + mask + end;
}

// HTML 转义防止 XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== 贪吃蛇游戏 ====================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 20;
const GRID_COUNT = 20;

canvas.width = GRID_SIZE * GRID_COUNT;
canvas.height = GRID_SIZE * GRID_COUNT;

let snake = [];
let food = { x: 0, y: 0 };
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let score = 0;
let gameLoop = null;
let gameRunning = false;

// 初始化游戏
function initGame() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  document.getElementById('score').textContent = score;
  spawnFood();
}

// 生成食物
function spawnFood() {
  do {
    food.x = Math.floor(Math.random() * GRID_COUNT);
    food.y = Math.floor(Math.random() * GRID_COUNT);
  } while (snake.some(segment => segment.x === food.x && segment.y === food.y));
}

// 绘制游戏
function draw() {
  // 清空画布
  ctx.fillStyle = '#0f0f23';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制网格（可选）
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.1)';
  for (let i = 0; i <= GRID_COUNT; i++) {
    ctx.beginPath();
    ctx.moveTo(i * GRID_SIZE, 0);
    ctx.lineTo(i * GRID_SIZE, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * GRID_SIZE);
    ctx.lineTo(canvas.width, i * GRID_SIZE);
    ctx.stroke();
  }

  // 绘制食物
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(
    food.x * GRID_SIZE + GRID_SIZE / 2,
    food.y * GRID_SIZE + GRID_SIZE / 2,
    GRID_SIZE / 2 - 2,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // 绘制蛇
  snake.forEach((segment, index) => {
    const gradient = ctx.createRadialGradient(
      segment.x * GRID_SIZE + GRID_SIZE / 2,
      segment.y * GRID_SIZE + GRID_SIZE / 2,
      0,
      segment.x * GRID_SIZE + GRID_SIZE / 2,
      segment.y * GRID_SIZE + GRID_SIZE / 2,
      GRID_SIZE / 2
    );

    if (index === 0) {
      gradient.addColorStop(0, '#4ade80');
      gradient.addColorStop(1, '#22c55e');
    } else {
      gradient.addColorStop(0, '#86efac');
      gradient.addColorStop(1, '#4ade80');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(
      segment.x * GRID_SIZE + 1,
      segment.y * GRID_SIZE + 1,
      GRID_SIZE - 2,
      GRID_SIZE - 2,
      4
    );
    ctx.fill();
  });
}

// 游戏更新
function update() {
  direction = nextDirection;

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
  };

  // 碰撞检测 - 墙壁
  if (head.x < 0 || head.x >= GRID_COUNT || head.y < 0 || head.y >= GRID_COUNT) {
    gameOver();
    return;
  }

  // 碰撞检测 - 自身
  if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
    gameOver();
    return;
  }

  snake.unshift(head);

  // 检测是否吃到食物
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    document.getElementById('score').textContent = score;
    spawnFood();
  } else {
    snake.pop();
  }
}

// 游戏循环
function startGame() {
  if (gameRunning) return;

  initGame();
  gameRunning = true;

  gameLoop = setInterval(() => {
    update();
    draw();
  }, 150);
}

// 游戏结束
async function gameOver() {
  gameRunning = false;
  clearInterval(gameLoop);

  // 游客模式不记入排行榜
  if (isGuest) {
    document.getElementById('final-score').textContent = score;
    document.getElementById('game-over-modal').classList.add('show');
    return;
  }

  if (currentUser) {
    try {
      const username = getUsernameFromEmail(currentUser.email);

      // 获取用户之前的最高分
      const previousBest = await getUserBestScore(currentUser.id);

      // 提交分数（只保留最高分）
      await submitScore(currentUser.id, username, score);
      await updateLeaderboard();

      // 获取本次游戏的排名
      const rank = await getUserRank(currentUser.id);

      // 只有本次分数比之前高，才判断是否进入前三
      if (score > previousBest && rank && rank <= 3) {
        // 进入前三，显示恭喜弹窗
        document.getElementById('congrats-score').textContent = score;
        document.getElementById('congrats-rank').textContent = `第 ${rank} 名`;
        document.getElementById('congrats-modal').classList.add('show');
      } else {
        // 未进入前三，显示普通结束弹窗
        document.getElementById('final-score').textContent = score;
        document.getElementById('game-over-modal').classList.add('show');
      }
    } catch (error) {
      console.error('提交分数失败:', error);
      document.getElementById('final-score').textContent = score;
      document.getElementById('game-over-modal').classList.add('show');
    }
  } else {
    document.getElementById('final-score').textContent = score;
    document.getElementById('game-over-modal').classList.add('show');
  }
}

// 获取用户之前的最高分
async function getUserBestScore(userId) {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('score')
    .eq('user_id', userId)
    .order('score', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return 0;
  return data[0].score;
}

// 获取用户排名
async function getUserRank(userId) {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('user_id, score')
    .order('score', { ascending: false })
    .limit(10);

  if (error || !data) return null;

  const index = data.findIndex(item => item.user_id === userId);
  return index === -1 ? null : index + 1;
}

// 重新开始游戏
document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('game-over-modal').classList.remove('show');
  startGame();
});

// 恭喜弹窗重新开始游戏
document.getElementById('congrats-restart-btn').addEventListener('click', () => {
  document.getElementById('congrats-modal').classList.remove('show');
  startGame();
});

// 退出按钮 - 游戏结束弹窗
document.getElementById('exit-btn').addEventListener('click', () => {
  console.log('exit-btn clicked');
  document.getElementById('game-over-modal').classList.remove('show');
});

// 退出按钮 - 恭喜弹窗
document.getElementById('congrats-exit-btn').addEventListener('click', () => {
  console.log('congrats-exit-btn clicked');
  document.getElementById('congrats-modal').classList.remove('show');
});

// 键盘控制
document.addEventListener('keydown', (e) => {
  // 阻止方向键滚动页面
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }

  if (!gameRunning) {
    if (e.key === ' ' || e.key === 'Enter') {
      if (document.getElementById('game-over-modal').classList.contains('show')) {
        document.getElementById('game-over-modal').classList.remove('show');
        startGame();
      } else if (document.getElementById('congrats-modal').classList.contains('show')) {
        document.getElementById('congrats-modal').classList.remove('show');
        startGame();
      }
      startGame();
    }
    return;
  }

  switch (e.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
      break;
  }
});

// 开始按钮
document.getElementById('start-btn').addEventListener('click', startGame);

// ==================== 初始化 ====================
checkAuthState();
