const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// กำหนดตำแหน่งเก็บไฟล์ข้อมูลไว้ที่โฟลเดอร์หลัก (ไม่ต้องมีโฟลเดอร์ data)
const DATA_FILE = path.join(__dirname, 'queues.json');

app.use(cors());
app.use(express.json());

// รองรับการเปิดหน้าเว็บทั้งจากโฟลเดอร์ public และหน้าหลัก
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// ฟังก์ชันโหลดข้อมูล
function loadQueues() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading data:', err);
    return [];
  }
}

// ฟังก์ชันบันทึกข้อมูล
function saveQueues(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

let queues = loadQueues();

// จัดการหน้าแรก ป้องกันปัญหา Cannot GET /
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io/')) return next();
  const publicPath = path.join(__dirname, 'public', 'index.html');
  const rootPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(publicPath)) {
    res.sendFile(publicPath);
  } else if (fs.existsSync(rootPath)) {
    res.sendFile(rootPath);
  } else {
    res.status(404).send('หาไฟล์ index.html ไม่เจอ กรุณาตรวจสอบตำแหน่งไฟล์บน GitHub');
  }
});

// ระบบ Real-Time ผ่าน Socket.io
io.on('connection', (socket) => {
  socket.emit('init_data', queues);

  socket.on('add_queue', (newQueue) => {
    queues.unshift(newQueue);
    saveQueues(queues);
    io.emit('queue_added', newQueue);
  });

  socket.on('toggle_status', (id) => {
    const queue = queues.find(q => q.id === id);
    if (queue) {
      queue.status = queue.status === 'completed' ? 'pending' : 'completed';
      saveQueues(queues);
      io.emit('status_updated', { id: queue.id, status: queue.status });
    }
  });

  socket.on('update_queue', (updatedData) => {
    const index = queues.findIndex(q => q.id === updatedData.id);
    if (index !== -1) {
      queues[index] = { ...queues[index], ...updatedData };
      saveQueues(queues);
      io.emit('queue_updated', queues[index]);
    }
  });

  socket.on('delete_queue', (id) => {
    queues = queues.filter(q => q.id !== id);
    saveQueues(queues);
    io.emit('queue_deleted', id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`เซิร์ฟเวอร์เปิดทำงานแล้วที่ Port ${PORT}`);
});
