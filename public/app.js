const socket = io();
let queues = [];
let currentFilter = 'all';
let searchQuery = '';

const queueListEl = document.getElementById('queueList');
const emptyStateEl = document.getElementById('emptyState');
const modalBackdrop = document.getElementById('modalBackdrop');
const queueForm = document.getElementById('queueForm');
const btnOpenModal = document.getElementById('btnOpenModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const editIdInput = document.getElementById('editId');
const searchInput = document.getElementById('searchInput');
const tabButtons = document.querySelectorAll('.tab-btn');
const toastEl = document.getElementById('toast');
const liveStatus = document.getElementById('liveStatus');

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2000);
}

function updateStats() {
  const total = queues.length;
  const completed = queues.filter(q => q.status === 'completed').length;
  const pending = total - completed;
  const amount = queues.reduce((sum, q) => sum + (parseFloat(q.amount) || 0), 0);

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statCompleted').textContent = completed;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statIncome').textContent = '฿' + amount.toLocaleString('th-TH');
}

function render() {
  const filtered = queues.filter(q => {
    if (currentFilter === 'pending' && q.status !== 'pending') return false;
    if (currentFilter === 'completed' && q.status !== 'completed') return false;
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      const qNo = (q.queueNo || '').toLowerCase();
      const job = (q.jobTitle || '').toLowerCase();
      return qNo.includes(term) || job.includes(term);
    }
    return true;
  });

  if (filtered.length === 0) {
    queueListEl.innerHTML = '';
    emptyStateEl.style.display = 'block';
    return;
  }

  emptyStateEl.style.display = 'none';

  queueListEl.innerHTML = filtered.map(q => {
    const isDone = q.status === 'completed';
    return `
      <div class="queue-card ${isDone ? 'completed' : 'pending'}">
        <div class="card-top">
          <span class="card-badge">${escapeHtml(q.queueNo)}</span>
          <span class="card-datetime">📅 ${q.date} ⏰ ${q.time} น.</span>
        </div>
        <div class="card-job">${escapeHtml(q.jobTitle)}</div>
        ${q.notes ? `<div class="card-notes">📝 ${escapeHtml(q.notes)}</div>` : ''}
        <div class="card-bottom">
          <div class="amount">฿${(parseFloat(q.amount) || 0).toLocaleString('th-TH')}</div>
          <button class="btn-toggle ${isDone ? 'completed' : 'pending'}" onclick="toggleStatus('${q.id}')">
            ${isDone ? '🟢 เสร็จแล้ว' : '🔴 ยังไม่เสร็จ'}
          </button>
          <div class="card-actions">
            <button class="btn-icon" title="แก้ไข" onclick="openEdit('${q.id}')">✏️</button>
            <button class="btn-icon" title="ลบ" onclick="deleteQueue('${q.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

socket.on('connect', () => {
  liveStatus.textContent = '● เชื่อมต่อ Real-Time แล้ว';
  liveStatus.style.color = '#10b981';
});

socket.on('disconnect', () => {
  liveStatus.textContent = '● ขาดการเชื่อมต่อ';
  liveStatus.style.color = '#ef4444';
});

socket.on('init_data', data => {
  queues = data;
  updateStats();
  render();
});

socket.on('queue_added', item => {
  queues.unshift(item);
  updateStats();
  render();
  showToast(`⚡ มีคิวใหม่: ${item.queueNo}`);
});

socket.on('status_updated', ({ id, status }) => {
  const item = queues.find(q => q.id === id);
  if (item) {
    item.status = status;
    updateStats();
    render();
    showToast(`🔄 คิว ${item.queueNo} เปลี่ยนสถานะแล้ว`);
  }
});

socket.on('queue_updated', item => {
  const idx = queues.findIndex(q => q.id === item.id);
  if (idx !== -1) {
    queues[idx] = item;
    updateStats();
    render();
    showToast(`✏️ อัพเดตคิว ${item.queueNo}`);
  }
});

socket.on('queue_deleted', id => {
  queues = queues.filter(q => q.id !== id);
  updateStats();
  render();
  showToast('🗑️ ลบคิวเรียบร้อย');
});

window.toggleStatus = function(id) {
  if (navigator.vibrate) navigator.vibrate(40);
  socket.emit('toggle_status', id);
};

window.deleteQueue = function(id) {
  if (confirm('คุณต้องการลบคิวนี้หรือไม่?')) {
    socket.emit('delete_queue', id);
  }
};

window.openEdit = function(id) {
  const q = queues.find(item => item.id === id);
  if (!q) return;
  document.getElementById('modalTitle').textContent = `แก้ไขคิว: ${q.queueNo}`;
  editIdInput.value = q.id;
  document.getElementById('queueNo').value = q.queueNo;
  document.getElementById('amount').value = q.amount;
  document.getElementById('date').value = q.date;
  document.getElementById('time').value = q.time;
  document.getElementById('jobTitle').value = q.jobTitle;
  document.getElementById('notes').value = q.notes || '';
  modalBackdrop.classList.add('open');
};

btnOpenModal.onclick = () => {
  document.getElementById('modalTitle').textContent = 'เพิ่มคิวงานใหม่';
  queueForm.reset();
  editIdInput.value = '';
  const now = new Date();
  document.getElementById('date').value = now.toISOString().split('T')[0];
  document.getElementById('time').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  document.getElementById('queueNo').value = `Q-${String(queues.length + 1).padStart(3, '0')}`;
  modalBackdrop.classList.add('open');
};

function closeModal() { modalBackdrop.classList.remove('open'); }
btnCloseModal.onclick = closeModal;
btnCancelModal.onclick = closeModal;

queueForm.onsubmit = e => {
  e.preventDefault();
  const id = editIdInput.value;
  const data = {
    queueNo: document.getElementById('queueNo').value.trim(),
    amount: parseFloat(document.getElementById('amount').value) || 0,
    date: document.getElementById('date').value,
    time: document.getElementById('time').value,
    jobTitle: document.getElementById('jobTitle').value.trim(),
    notes: document.getElementById('notes').value.trim()
  };

  if (id) {
    socket.emit('update_queue', { id, ...data });
  } else {
    socket.emit('add_queue', {
      id: 'q-' + Date.now(),
      ...data,
      status: 'pending'
    });
  }
  closeModal();
};

searchInput.oninput = e => {
  searchQuery = e.target.value;
  render();
};

tabButtons.forEach(btn => {
  btn.onclick = () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  };
});