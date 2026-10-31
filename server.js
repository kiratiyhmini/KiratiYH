const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// ====== ใส่รหัสจาก JSONBin.io เรียบร้อยแล้ว ======
const BIN_ID = process.env.BIN_ID || '6ae61279ffd5d160539b90b5';
const MASTER_KEY = process.env.MASTER_KEY || '$2a$10$uv1IidlkVb0.JjJwB0dd8eu1ir..lJ3sZx/9AqcxOmmxHwi4CnURO';
// ============================================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let queues = [];

// ดึงข้อมูลจาก Cloud เมื่อเริ่มรันเซิร์ฟเวอร์
async function loadQueuesFromCloud() {
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: {
        'X-Master-Key': MASTER_KEY
      }
    });

    if (!response.ok) {
      console.error('ไม่สามารถดึงข้อมูลได้ รหัสสถานะ:', response.status);
      return [];
    }

    const result = await response.json();
    return Array.isArray(result.record) ? result.record : [];
  } catch (err) {
    console.error('Error fetching data from JSONBin:', err);
    return [];
  }
}

// ส่งข้อมูลไปบันทึกบน Cloud
async function saveQueuesToCloud(data) {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY
      },
      body: JSON.stringify(data)
    });
  } catch (err) {
    console.error('Error saving data to JSONBin:', err);
  }
}

io.on('connection', (socket) => {
  socket.emit('init_data', queues);

  socket.on('add_queue', (newQueue) => {
    queues.unshift(newQueue);
    saveQueuesToCloud(queues);
    io.emit('queue_added', newQueue);
  });

  socket.on('toggle_status', (id) => {
    const queue = queues.find(q => q.id === id);
    if (queue) {
      queue.status = queue.status === 'completed' ? 'pending' : 'completed';
      saveQueuesToCloud(queues);
      io.emit('status_updated', { id: queue.id, status: queue.status });
    }
  });

  socket.on('update_queue', (updatedData) => {
    const index = queues.findIndex(q => q.id === updatedData.id);
    if (index !== -1) {
      queues[index] = { ...queues[index], ...updatedData };
      saveQueuesToCloud(queues);
      io.emit('queue_updated', queues[index]);
    }
  });

  socket.on('delete_queue', (id) => {
    queues = queues.filter(q => q.id !== id);
    saveQueuesToCloud(queues);
    io.emit('queue_deleted', id);
  });
});

async function startServer() {
  console.log('กำลังโหลดข้อมูลคิวจาก Cloud...');
  queues = await loadQueuesFromCloud();
  console.log(`โหลดข้อมูลสำเร็จ พบทั้งหมด ${queues.length} รายการ`);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`เซิร์ฟเวอร์เปิดทำงานแล้วที่ Port ${PORT}`);
  });
}

startServer();
