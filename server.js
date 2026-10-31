const express = require('express'); 
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// รหัสจาก JSONBin.io
const BIN_ID = '6ae61279ffd5d160539b90b5';
const MASTER_KEY = '$2a$10$uv1IidlkVb0.JjJwB0dd8eu1ir..lJ3sZx/9AqcxOmmxHwi4CnURO';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let queues = [];

// ฟังก์ชันดึงข้อมูลจาก Cloud
async function loadQueuesFromCloud() {
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: {
        'X-Master-Key': MASTER_KEY
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[โหลดข้อมูลล้มเหลว] Status: ${response.status} | ข้อความ: ${errText}`);
      return [];
    }

    const result = await response.json();
    return Array.isArray(result.record) ? result.record : [];
  } catch (err) {
    console.error('[Network Error ตอนดึงข้อมูล]:', err.message);
    return [];
  }
}

// ฟังก์ชันส่งข้อมูลไปบันทึกบน Cloud
async function saveQueuesToCloud(data) {
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[บันทึกข้อมูลล้มเหลว] Status: ${response.status} | ข้อความ: ${errText}`);
    } else {
      console.log(`[บันทึกข้อมูลสำเร็จ] จำนวนคิวปัจจุบัน: ${data.length} รายการ`);
    }
  } catch (err) {
    console.error('[Network Error ตอนบันทึกข้อมูล]:', err.message);
  }
}

io.on('connection', (socket) => {
  socket.emit('init_data', queues);

  socket.on('add_queue', async (newQueue) => {
    queues.unshift(newQueue);
    await saveQueuesToCloud(queues);
    io.emit('queue_added', newQueue);
  });

  socket.on('toggle_status', async (id) => {
    const queue = queues.find(q => q.id === id);
    if (queue) {
      queue.status = queue.status === 'completed' ? 'pending' : 'completed';
      await saveQueuesToCloud(queues);
      io.emit('status_updated', { id: queue.id, status: queue.status });
    }
  });

  socket.on('update_queue', async (updatedData) => {
    const index = queues.findIndex(q => q.id === updatedData.id);
    if (index !== -1) {
      queues[index] = { ...queues[index], ...updatedData };
      await saveQueuesToCloud(queues);
      io.emit('queue_updated', queues[index]);
    }
  });

  socket.on('delete_queue', async (id) => {
    queues = queues.filter(q => q.id !== id);
    await saveQueuesToCloud(queues);
    io.emit('queue_deleted', id);
  });
});

async function startServer() {
  console.log('--- กำลังเชื่อมต่อ JSONBin.io ---');
  queues = await loadQueuesFromCloud();
  console.log(`--- โหลดข้อมูลสำเร็จ: พบทั้งหมด ${queues.length} รายการ ---`);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`เซิร์ฟเวอร์เปิดทำงานแล้วที่ Port ${PORT}`);
  });
}

startServer();
