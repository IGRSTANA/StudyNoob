// ============================================
//  STUDY WORLD — Lógica completa
// ============================================

const STORAGE_KEY = 'studyWorldSave_v2';

// ====== ESTADO ======
let state = {
  topics: [],              // { id, name, goalMinutes, done, totalMinutes, createdAt }
  rewards: [],             // { id, name, cost, redeemed }
  streak: 0,
  totalStudyMinutes: 0,
  coins: 0,
  lastStudyDate: null,
  activeTimer: null,       // { topicId, startedAt }
  selectedTopicId: null,
  soundOn: true,
  history: {},             // { 'YYYY-MM-DD': minutos }
  totalSessions: 0,
};

// ====== SONS 8-BIT (Web Audio API) ======
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  if (!state.soundOn) return;
  try {
    const ctx = getAudioCtx();
    const notes = {
      coin:    [{ f: 988, d: 0.08 }, { f: 1319, d: 0.15 }],
      levelup: [{ f: 523, d: 0.1 }, { f: 659, d: 0.1 }, { f: 784, d: 0.1 }, { f: 1047, d: 0.2 }],
      click:   [{ f: 440, d: 0.05 }],
      error:   [{ f: 200, d: 0.15 }],
      delete:  [{ f: 400, d: 0.08 }, { f: 200, d: 0.12 }],
    };
    const seq = notes[type] || notes.click;
    let t = ctx.currentTime;
    seq.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = n.f;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + n.d);
      t += n.d;
    });
  } catch (e) { /* ignora se não suportado */ }
}

// ====== PERSISTÊNCIA ======
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { state = { ...state, ...JSON.parse(raw) }; }
    catch (e) { console.warn('Erro ao carregar save:', e); }
  }
}

// ====== TOAST ======
let toastTimeout = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 2600);
}

// ====== RENDER PRINCIPAL ======
function render() {
  renderMap();
  renderTopicList();
  renderHUD();
  renderRewards();
  renderChart();
  renderActiveTopic();
  save();
}

function renderHUD() {
  document.getElementById('streak').textContent = state.streak;
  document.getElementById('totalTime').textContent = state.totalStudyMinutes;
  document.getElementById('coins').textContent = state.coins;
  document.getElementById('doneCount').textContent = state.topics.filter(t => t.done).length;
  document.getElementById('totalCount').textContent = state.topics.length;
  document.getElementById('soundToggle').textContent = `🔊 Som: ${state.soundOn ? 'ON' : 'OFF'}`;
}

// ====== MAPA DE FASES ======
function renderMap() {
  const map = document.getElementById('mapCanvas');
  map.innerHTML = '';

  if (state.topics.length === 0) {
    map.innerHTML = '<p style="color:#fff;text-shadow:1px 1px 0 #000;padding:20px;">Adicione um tema para começar sua jornada! 🍄</p>';
    return;
  }

  // Desbloqueio sequencial: primeira sempre aberta; a próxima abre quando a anterior é concluída
  let prevDone = true;

  state.topics.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'stage';
    const locked = !prevDone && !t.done && state.topics.slice(0, i).some(x => !x.done);
    const progress = Math.min(100, Math.round((t.totalMinutes / t.goalMinutes) * 100));

    if (t.done) el.classList.add('done');
    else if (locked) el.classList.add('locked');
    else if (t.totalMinutes > 0) el.classList.add('active');

    if (state.selectedTopicId === t.id) el.classList.add('selected');

    const icon = t.done ? '🏆' : locked ? '🔒' : t.totalMinutes > 0 ? '🟨' : '🟩';
    el.innerHTML = `
      <span class="stage-icon">${icon}</span>
      <div class="stage-name">${escapeHtml(t.name)}</div>
      <div class="stage-progress"><div style="width:${progress}%"></div></div>
      <div style="font-size:0.7rem;margin-top:2px;">${t.totalMinutes}/${t.goalMinutes}min</div>
    `;

    el.onclick = () => {
      if (locked) { playSound('error'); toast('🔒 Conclua a fase anterior primeiro!'); return; }
      state.selectedTopicId = t.id;
      playSound('click');
      render();
      toast(`⏱️ Fase selecionada: ${t.name}`);
    };

    map.appendChild(el);
    prevDone = t.done;
  });
}

// ====== LISTA DE TEMAS ======
function renderTopicList() {
  const ul = document.getElementById('topicList');
  ul.innerHTML = '';
  if (state.topics.length === 0) {
    ul.innerHTML = '<li style="justify-content:center;color:#888;">Nenhuma fase ainda. Adicione uma! 🎮</li>';
    return;
  }

  state.topics.forEach(t => {
    const li = document.createElement('li');
    if (t.done) li.classList.add('done');

    const info = document.createElement('div');
    info.className = 'topic-info';
    info.innerHTML = `
      <b>${escapeHtml(t.name)}</b>
      <small>🎯 ${t.goalMinutes}min · ⏱️ ${t.totalMinutes}min ${t.done ? '· 🏆' : ''}</small>
    `;

    const actions = document.createElement('div');
    actions.className = 'topic-actions';

    const selBtn = document.createElement('button');
    selBtn.textContent = '⏱️';
    selBtn.title = 'Selecionar para estudar';
    selBtn.onclick = () => {
      state.selectedTopicId = t.id;
      playSound('click');
      render();
      toast(`⏱️ Selecionado: ${t.name}`);
    };

    const doneBtn = document.createElement('button');
    doneBtn.textContent = t.done ? '↩️' : '✅';
    doneBtn.title = t.done ? 'Reabrir' : 'Concluir';
    doneBtn.onclick = () => {
      t.done = !t.done;
      playSound(t.done ? 'levelup' : 'click');
      render();
      if (t.done) toast('🏆 Fase concluída!');
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.title = 'Excluir';
    delBtn.onclick = () => {
      if (confirm(`Excluir "${t.name}"?`)) {
        state.topics = state.topics.filter(x => x.id !== t.id);
        if (state.activeTimer?.topicId === t.id) state.activeTimer = null;
        if (state.selectedTopicId === t.id) state.selectedTopicId = null;
        playSound('delete');
        render();
        toast('🗑️ Fase removida');
      }
    };

    actions.append(selBtn, doneBtn, delBtn);
    li.append(info, actions);
    ul.appendChild(li);
  });
}

// ====== SELECIONADO ======
function renderActiveTopic() {
  const label = document.getElementById('activeTopicLabel');
  const t = state.topics.find(x => x.id === state.selectedTopicId);
  label.textContent = t ? `Tema ativo: ${t.name}` : 'Nenhum tema selecionado';
}

// ====== ADICIONAR TEMA (com validação) ======
document.getElementById('addBtn').onclick = () => {
  const input = document.getElementById('newTopic');
  const name = input.value.trim();
  const goal = Math.max(1, parseInt(document.getElementById('newMinutes').value) || 30);

  if (!name) { playSound('error'); toast('⚠️ Digite o nome do tema!'); return; }
  if (name.length > 60) { playSound('error'); toast('⚠️ Nome muito longo (máx 60).'); return; }
  if (state.topics.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    playSound('error');
    toast('⚠️ Já existe uma fase com esse nome!');
    return;
  }

  state.topics.push({
    id: Date.now().toString(),
    name,
    goalMinutes: goal,
    done: false,
    totalMinutes: 0,
    createdAt: new Date().toISOString(),
  });

  input.value = '';
  document.getElementById('newMinutes').value = 30;
  playSound('coin');
  render();
  toast('✨ Nova fase criada!');
};

// ====== CRONÔMETRO ======
let timerInterval = null;

document.getElementById('startBtn').onclick = () => {
  if (!state.selectedTopicId) {
    playSound('error');
    return toast('⚠️ Selecione uma fase no mapa primeiro!');
  }
  if (state.activeTimer) { playSound('error'); return toast('⚠️ Já há uma sessão em andamento.'); }

  state.activeTimer = { topicId: state.selectedTopicId, startedAt: Date.now() };
  playSound('click');
  save();
  startTimerTick();
  toast('▶️ Sessão iniciada! Bora estudar!');
};

document.getElementById('stopBtn').onclick = () => {
  if (!state.activeTimer) { playSound('error'); return toast('Nada para parar.'); }
  stopTimerTick();
  state.activeTimer = null;
  save();
  document.getElementById('timerDisplay').textContent = '00:00';
  playSound('click');
  toast('⏸️ Sessão interrompida (não contabilizada).');
};

document.getElementById('finishBtn').onclick = () => {
  if (!state.activeTimer) { playSound('error'); return toast('⚠️ Nenhuma sessão em andamento.'); }
  stopTimerTick();

  const elapsedMs = Date.now() - state.activeTimer.startedAt;
  const minutes = Math.max(1, Math.round(elapsedMs / 60000));

  const topic = state.topics.find(t => t.id === state.activeTimer.topicId);
  if (topic) {
    topic.totalMinutes += minutes;
    if (topic.totalMinutes >= topic.goalMinutes && !topic.done) {
      topic.done = true;
      playSound('levelup');
      toast(`🏆 Fase "${topic.name}" concluída!`);
    }
  }

  state.totalStudyMinutes += minutes;
  state.coins += minutes;
  state.totalSessions += 1;

  // Histórico diário
  const today = getTodayKey();
  state.history[today] = (state.history[today] || 0) + minutes;

  updateStreak();

  state.activeTimer = null;
  save();
  document.getElementById('timerDisplay').textContent = '00:00';
  playSound('coin');
  render();
  toast(`✅ +${minutes}min · +${minutes}🪙 · Sequência: ${state.streak}⭐`);
};

function startTimerTick() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!state.activeTimer) return;
    const sec = Math.floor((Date.now() - state.activeTimer.startedAt) / 1000);
    document.getElementById('timerDisplay').textContent = formatTime(sec);
  }, 250);
}
function stopTimerTick() {
  clearInterval(timerInterval);
  timerInterval = null;
}
function formatTime(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ====== STREAK ======
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getYesterdayKey() {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updateStreak() {
  const today = getTodayKey();
  if (state.lastStudyDate === today) return;
  if (state.lastStudyDate === getYesterdayKey()) state.streak += 1;
  else state.streak = 1;
  state.lastStudyDate = today;
}

// ====== GRÁFICO SEMANAL ======
function renderChart() {
  const canvas = document.getElementById('weekChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Ajusta canvas para retina
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 700 * dpr;
  canvas.height = 220 * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '220px';
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  // Últimos 7 dias
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({
      key,
      label: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()],
      minutes: state.history[key] || 0,
    });
  }

  const maxMin = Math.max(30, ...days.map(d => d.minutes));
  const padding = { top: 20, bottom: 40, left: 40, right: 20 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const barW = chartW / days.length * 0.6;
  const gap = chartW / days.length;

  // Linhas de grade
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = '#666';
    ctx.font = '11px Trebuchet MS';
    ctx.textAlign = 'right';
    const val = Math.round(maxMin - (maxMin / 4) * i);
    ctx.fillText(val + 'm', padding.left - 6, y + 4);
  }

  // Barras
  days.forEach((d, i) => {
    const x = padding.left + gap * i + (gap - barW) / 2;
    const h = (d.minutes / maxMin) * chartH;
    const y = padding.top + chartH - h;

    // Barra estilo Mario (bloco)
    ctx.fillStyle = d.minutes > 0 ? '#ffcc00' : '#ddd';
    ctx.fillRect(x, y, barW, h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barW, h);

    // Valor
    if (d.minutes > 0) {
      ctx.fillStyle = '#000';
      ctx.font = 'bold 12px Trebuchet MS';
      ctx.textAlign = 'center';
      ctx.fillText(d.minutes + 'm', x + barW / 2, y - 6);
    }

    // Dia
    ctx.fillStyle = '#333';
    ctx.font = 'bold 13px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x + barW / 2, H - 12);
  });
}

// ====== RECOMPENSAS ======
function renderRewards() {
  const list = document.getElementById('rewardsList');
  list.innerHTML = '';
  if (state.rewards.length === 0) {
    list.innerHTML = '<p style="font-size:0.85rem;color:#888;">Nenhuma recompensa criada ainda.</p>';
    return;
  }

  state.rewards.forEach(r => {
    const el = document.createElement('div');
    el.className = 'reward-item' + (state.coins >= r.cost ? ' affordable' : '');
    el.innerHTML = `<span>🎁 <b>${escapeHtml(r.name)}</b> · ${r.cost}🪙</span>`;

    const buyBtn = document.createElement('button');
    buyBtn.textContent = 'Resgatar';
    buyBtn.disabled = state.coins < r.cost;
    buyBtn.style.opacity = state.coins < r.cost ? 0.4 : 1;
    buyBtn.onclick = () => {
      if (state.coins < r.cost) return;
      state.coins -= r.cost;
      playSound('levelup');
      render();
      toast(`🎉 Recompensa resgatada: ${r.name}!`);
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.onclick = () => {
      if (!confirm(`Remover recompensa "${r.name}"?`)) return;
      state.rewards = state.rewards.filter(x => x.id !== r.id);
      playSound('delete');
      render();
    };

    el.append(buyBtn, delBtn);
    list.appendChild(el);
  });
}

document.getElementById('addRewardBtn').onclick = () => {
  const name = document.getElementById('rewardName').value.trim();
  const cost = Math.max(1, parseInt(document.getElementById('rewardCost').value) || 50);
  if (!name) { playSound('error'); return toast('⚠️ Dê um nome à recompensa.'); }
  state.rewards.push({ id: Date.now().toString(), name, cost, redeemed: false });
  document.getElementById('rewardName').value = '';
  document.getElementById('rewardCost').value = 50;
  playSound('click');
  render();
  toast('🎁 Recompensa adicionada!');
};

// ====== EXPORTAR / IMPORTAR ======
document.getElementById('exportBtn').onclick = () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `study-world-save-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  playSound('coin');
  toast('💾 Save exportado!');
};

document.getElementById('importBtn').onclick = () => {
  document.getElementById('importFile').click();
};

document.getElementById('importFile').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.topics || !Array.isArray(data.topics)) throw new Error('Formato inválido');
      if (!confirm('Substituir todo o progresso atual pelo arquivo importado?')) return;
      state = { ...state, ...data };
      save();
      render();
      playSound('levelup');
      toast('📂 Save importado com sucesso!');
    } catch (err) {
      playSound('error');
      toast('⚠️ Arquivo inválido: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
};

// ====== SOM TOGGLE ======
document.getElementById('soundToggle').onclick = () => {
  state.soundOn = !state.soundOn;
  save();
  renderHUD();
  if (state.soundOn) playSound('click');
  toast(`Som ${state.soundOn ? 'ativado 🔊' : 'desativado 🔇'}`);
};

// ====== RESET ======
document.getElementById('resetAll').onclick = () => {
  if (!confirm('⚠️ Apagar TODO o progresso, temas, recompensas e histórico? Não pode ser desfeito!')) return;
  if (!confirm('Tem certeza absoluta?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = {
    topics: [], rewards: [], streak: 0, totalStudyMinutes: 0, coins: 0,
    lastStudyDate: null, activeTimer: null, selectedTopicId: null,
    soundOn: state.soundOn, history: {}, totalSessions: 0,
  };
  stopTimerTick();
  document.getElementById('timerDisplay').textContent = '00:00';
  playSound('delete');
  render();
  toast('🗑️ Tudo resetado.');
};

// ====== UTILS ======
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

// ====== INICIALIZAÇÃO ======
load();
render();
if (state.activeTimer) startTimerTick();

// Re-renderiza gráfico ao redimensionar
window.addEventListener('resize', () => renderChart());

// Aviso ao fechar com sessão ativa
window.addEventListener('beforeunload', (e) => {
  if (state.activeTimer) {
    e.preventDefault();
    e.returnValue = '';
  }
});