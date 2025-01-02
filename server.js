const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const words = require('./words');
require('dotenv').config();

// Hata yakalama için
process.on('uncaughtException', (err) => {
  console.error('Yakalanmamış istisna:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('İşlenmemiş promise reddi:', err);
});

const app = express();

// Production URL'ini ve port'u environment variable'dan al
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const PORT = process.env.PORT || 3002;

// CORS ayarları
app.use(cors({
  origin: [CLIENT_URL, "https://wordguess0.netlify.app"],
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Sağlık kontrolü endpoint'i
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Debug endpoint'i ekle
app.get('/debug/rooms', (req, res) => {
  console.log('Mevcut odalar:', {
    roomCount: Object.keys(rooms).length,
    rooms: Object.entries(rooms).map(([roomId, room]) => ({
      roomId,
      playerCount: room.players.length,
      players: room.players.map(p => ({ id: p.id, username: p.username })),
      team1: room.team1.map(p => ({ id: p.id, username: p.username })),
      team2: room.team2.map(p => ({ id: p.id, username: p.username }))
    }))
  });
  res.json({ rooms });
});

const server = http.createServer(app);

// Socket.IO yapılandırması
const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL, "https://wordguess0.netlify.app"],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000, // 60 saniye
  pingInterval: 25000 // 25 saniye
});

// Oyun durumunu tutacak objeler
let rooms = {};
let teams = {};

const TURN_DURATION = 60; // saniye
const WORDS_PER_TEAM = 5; // her takım için kelime sayısı
const PREPARATION_TIME = 10; // hazırlık süresi (saniye)

// Hazırlık süresini başlatan fonksiyon
const startPreparationTimer = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;

  room.isPreparation = true;
  room.preparationTime = PREPARATION_TIME;

  console.log('Hazırlık süresi başlıyor:', {
    currentTeam: room.currentTeam,
    preparationTime: room.preparationTime
  });

  const timer = setInterval(() => {
    if (rooms[roomId]) {
      rooms[roomId].preparationTime--;
      
      // Hazırlık süresi güncellemesini gönder
      io.to(roomId).emit('preparationUpdate', {
        timeRemaining: rooms[roomId].preparationTime,
        currentTeam: rooms[roomId].currentTeam
      });

      // Hazırlık süresi dolduğunda
      if (rooms[roomId].preparationTime <= 0) {
        clearInterval(timer);
        rooms[roomId].isPreparation = false;
        startTurnTimer(roomId);
      }
    } else {
      clearInterval(timer);
    }
  }, 1000);

  room.preparationTimer = timer;
};

// Tur süresini kontrol eden fonksiyon
const startTurnTimer = (roomId) => {
  console.log('Zamanlayıcı başlatılıyor:', roomId);
  
  const room = rooms[roomId];
  if (!room) {
    console.error('Zamanlayıcı başlatılamadı - oda bulunamadı:', roomId);
    return;
  }

  // Eğer önceki zamanlayıcı varsa temizle
  if (room.currentTimer) {
    console.log('Önceki zamanlayıcı temizleniyor');
    clearInterval(room.currentTimer);
  }

  room.timeRemaining = TURN_DURATION;
  console.log('Yeni tur başlatılıyor:', {
    currentTeam: room.currentTeam,
    currentWord: room.currentWord,
    timeRemaining: room.timeRemaining
  });

  // Her saniye süreyi güncelle
  const timer = setInterval(() => {
    if (rooms[roomId]) {
      rooms[roomId].timeRemaining--;
      
      // Süre güncellemesini gönder
      io.to(roomId).emit('timeUpdate', {
        timeRemaining: rooms[roomId].timeRemaining,
        currentTeam: rooms[roomId].currentTeam
      });

      // Süre dolduğunda
      if (rooms[roomId].timeRemaining <= 0) {
        console.log('Süre doldu');
        clearInterval(timer);
        
        // İlk takımın süresi dolduysa ikinci takıma geç, ikinci takımın süresi dolduysa oyunu bitir
        if (rooms[roomId].currentTeam === 'team1') {
          console.log('İlk takımın süresi doldu, ikinci takıma geçiliyor');
          switchToOtherTeam(roomId);
        } else {
          console.log('İkinci takımın süresi doldu, oyun bitiyor');
          endGame(roomId);
        }
      }
    } else {
      console.log('Oda silinmiş, zamanlayıcı durduruluyor');
      clearInterval(timer);
    }
  }, 1000);

  room.currentTimer = timer;
};

// Diğer takıma geçiş
const switchToOtherTeam = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;

  if (room.currentTimer) {
    clearInterval(room.currentTimer);
  }

  console.log('Takım değişiyor. Mevcut durum:', {
    currentTeam: room.currentTeam,
    scores: room.scores
  });

  // Takımı değiştir ve yeni kelime seç
  room.currentTeam = 'team2'; // Her zaman team2'ye geç çünkü bu fonksiyon sadece team1'den sonra çağrılacak
  room.currentWord = selectNewWord(room);
  room.timeRemaining = TURN_DURATION;

  console.log('Takım değişti. Yeni durum:', {
    currentTeam: room.currentTeam,
    scores: room.scores
  });

  io.to(roomId).emit('teamSwitch', {
    currentTeam: room.currentTeam,
    timeRemaining: TURN_DURATION,
    currentWord: room.currentWord,
    scores: room.scores,
    isPreparation: true,
    preparationTime: PREPARATION_TIME
  });

  startPreparationTimer(roomId);
};

// Oyunu bitir
function endGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  console.log('Oyun bitiyor. Puanlar:', room.scores);

  // Kazananı belirle
  let winner = null;
  if (room.scores.team1 > room.scores.team2) {
    winner = 'team1';
  } else if (room.scores.team2 > room.scores.team1) {
    winner = 'team2';
  } else {
    winner = 'tie';
  }

  console.log('Oyun sonu durumu:', {
    winner,
    scores: room.scores,
    team1Players: room.team1.map(p => p.username),
    team2Players: room.team2.map(p => p.username)
  });

  // Oyun sonu durumunu gönder
  io.to(roomId).emit('gameEnded', {
    winner: winner,
    scores: room.scores,
    team1Players: room.team1.map(p => p.username),
    team2Players: room.team2.map(p => p.username)
  });

  // Odayı sıfırla
  room.isPlaying = false;
  room.currentWord = null;
  room.currentTeam = null;
  room.scores = { team1: 0, team2: 0 };
  room.completedTeams = [];
  
  if (room.currentTimer) {
    clearInterval(room.currentTimer);
    room.currentTimer = null;
  }
}

// Yeni kelime seçme fonksiyonu
function selectNewWord(room) {
  // Tüm kelimeler kullanıldıysa listeyi sıfırla
  if (room.usedWords.length >= words.length) {
    room.usedWords = [];
  }

  // Kullanılmamış kelimelerden rastgele seç
  const availableWords = words.filter(word => !room.usedWords.includes(word));
  const newWord = availableWords[Math.floor(Math.random() * availableWords.length)];
  
  // Seçilen kelimeyi kullanılanlar listesine ekle
  room.usedWords.push(newWord);
  return newWord;
}

io.on('connection', (socket) => {
  console.log('Yeni socket bağlantısı:', {
    socketId: socket.id,
    query: socket.handshake.query
  });

  // Odaya katılma
  socket.on('joinRoom', async ({ roomId, username }, callback) => {
    try {
      console.log('Odaya katılma isteği:', { roomId, username, socketId: socket.id });
      
      if (!callback || typeof callback !== 'function') {
        console.error('Callback fonksiyonu eksik veya geçersiz');
        return;
      }

      if (!roomId || !username) {
        throw new Error('Geçersiz oda katılım isteği');
      }

      // Önceki odalardan çık
      for (const room of [...socket.rooms]) {
        if (room !== socket.id) {
          await socket.leave(room);
        }
      }
      
      // Yeni odaya katıl
      await socket.join(roomId);

      // Oda yoksa oluştur
      if (!rooms[roomId]) {
        rooms[roomId] = {
          players: [],
          team1: [],
          team2: [],
          scores: { team1: 0, team2: 0 },
          currentWord: '',
          isPlaying: false,
          lastActivity: Date.now(),
          usedWords: []
        };
      }

      const room = rooms[roomId];

      // Mevcut oyuncuyu kontrol et
      const existingPlayerIndex = room.players.findIndex(p => p.username === username);
      if (existingPlayerIndex !== -1) {
        // Mevcut oyuncunun socket ID'sini güncelle
        room.players[existingPlayerIndex].id = socket.id;
      } else {
        // Yeni oyuncuyu ekle
        const playerInfo = { id: socket.id, username };
        room.players.push(playerInfo);
        
        // Diğer oyunculara bildir
        socket.to(roomId).emit('playerJoined', {
          username,
          totalPlayers: room.players.length
        });
      }

      room.lastActivity = Date.now();

      // Oda güncellemesini gönder
      const roomUpdate = {
        players: room.players,
        team1: room.team1,
        team2: room.team2,
        scores: room.scores,
        currentWord: room.currentWord,
        currentTeam: room.currentTeam,
        isPlaying: room.isPlaying
      };

      console.log('Oda güncellemesi gönderiliyor:', roomUpdate);
      io.to(roomId).emit('roomUpdate', roomUpdate);

      callback(null);
    } catch (error) {
      console.error('Odaya katılma hatası:', error);
      if (callback && typeof callback === 'function') {
        callback({ message: error.message });
      }
    }
  });

  // Takım seçme
  socket.on('selectTeam', ({ roomId, team }, callback) => {
    try {
      console.log('Takım seçme isteği alındı:', { roomId, team, socketId: socket.id });
      
      if (!callback || typeof callback !== 'function') {
        console.error('Callback fonksiyonu eksik veya geçersiz');
        return;
      }

      if (!roomId || !team) {
        throw new Error('Geçersiz takım seçme isteği');
      }
      
      const room = rooms[roomId];
      if (!room) {
        throw new Error('Oda bulunamadı');
      }

      const player = room.players.find(p => p.id === socket.id);
      if (!player) {
        throw new Error('Oyuncu bulunamadı');
      }

      console.log('Mevcut oyuncu:', player);
      console.log('Mevcut takımlar:', {
        team1: room.team1,
        team2: room.team2
      });

      // Takım dolu mu kontrol et
      const targetTeam = team === 'team1' ? room.team1 : room.team2;
      if (targetTeam.length >= 2 && !targetTeam.some(p => p.id === socket.id)) {
        throw new Error('Seçilen takım dolu (maksimum 2 kişi)');
      }

      // Önce her iki takımdan da çıkar
      room.team1 = room.team1.filter(p => p.id !== socket.id);
      room.team2 = room.team2.filter(p => p.id !== socket.id);

      // Seçilen takıma ekle
      const playerInfo = { id: socket.id, username: player.username };
      if (team === 'team1') {
        room.team1.push(playerInfo);
      } else if (team === 'team2') {
        room.team2.push(playerInfo);
      }

      console.log('Takımlar güncellendi:', {
        team1: room.team1.map(p => ({ id: p.id, username: p.username })),
        team2: room.team2.map(p => ({ id: p.id, username: p.username }))
      });

      // Oda güncellemesini gönder
      const roomUpdate = {
        players: room.players,
        team1: room.team1,
        team2: room.team2,
        scores: room.scores,
        currentWord: room.currentWord,
        currentTeam: room.currentTeam,
        isPlaying: room.isPlaying
      };

      console.log('Oda güncellemesi gönderiliyor:', roomUpdate);
      io.to(roomId).emit('roomUpdate', roomUpdate);

      callback(null);
    } catch (error) {
      console.error('Takım seçme hatası:', error);
      if (callback && typeof callback === 'function') {
        callback({ message: error.message });
      }
    }
  });

  // Oyunu başlatma
  socket.on('startGame', (roomId) => {
    console.log('Oyun başlatma isteği alındı:', roomId);
    
    if (!roomId) {
      console.error('Geçersiz oyun başlatma isteği - roomId yok');
      return;
    }
    
    const room = rooms[roomId];
    if (!room) {
      console.error('Oda bulunamadı:', roomId);
      return;
    }

    if (room.team1.length >= 2 && room.team2.length >= 2) {
      console.log('Oyun başlatılıyor...');
      
      // Oyun durumunu sıfırla
      room.isPlaying = true;
      room.currentTeam = 'team1';
      room.currentWord = selectNewWord(room);
      room.timeRemaining = TURN_DURATION;
      room.scores = { team1: 0, team2: 0 };
      room.completedTeams = [];
      room.lastActivity = Date.now();
      
      console.log('Oyun durumu güncellendi:', {
        isPlaying: room.isPlaying,
        currentTeam: room.currentTeam,
        currentWord: room.currentWord,
        timeRemaining: room.timeRemaining,
        scores: room.scores
      });

      io.to(roomId).emit('gameStarted', {
        isPlaying: room.isPlaying,
        currentTeam: room.currentTeam,
        currentWord: room.currentWord,
        timeRemaining: room.timeRemaining,
        scores: room.scores,
        isPreparation: true,
        preparationTime: PREPARATION_TIME
      });

      startPreparationTimer(roomId);
    }
  });

  // Kelime tahmin etme
  socket.on('makeGuess', ({ roomId, guess }) => {
    console.log('Tahmin yapıldı:', { roomId, guess });
    
    if (!roomId || !guess) {
      console.error('Geçersiz tahmin isteği:', { roomId, guess });
      return;
    }
    
    const room = rooms[roomId];
    if (!room) {
      console.error('Oda bulunamadı:', roomId);
      return;
    }

    // Oyuncunun hangi takımda olduğunu kontrol et
    let playerTeam = null;
    if (room.team1.some(p => p.id === socket.id)) {
      playerTeam = 'team1';
    } else if (room.team2.some(p => p.id === socket.id)) {
      playerTeam = 'team2';
    }

    // Sadece kendi takım arkadaşları tahmin yapabilir
    if (playerTeam === room.currentTeam && room.currentWord.toLowerCase() === guess.toLowerCase()) {
      console.log('Doğru tahmin yapıldı!');
      
      // Tahmin yapan takıma puan ver
      room.scores[playerTeam]++;

      // Güncel durumu tüm oyunculara bildir
      io.to(roomId).emit('correctGuess', {
        team: playerTeam,
        scores: room.scores,
        timeRemaining: room.timeRemaining,
        currentWord: room.currentWord,
        currentTeam: room.currentTeam,
        guessingPlayer: room.players.find(p => p.id === socket.id)?.username,
        guess: guess
      });

      console.log('Güncel durum:', {
        team: playerTeam,
        scores: room.scores
      });

      // 5 kelime bilindiğinde
      if (room.scores[playerTeam] >= WORDS_PER_TEAM) {
        if (room.currentTeam === 'team1') {
          // İlk takım 5 kelimeyi bildi, ikinci takıma geç
          console.log('İlk takım 5 kelimeyi bildi, ikinci takıma geçiliyor');
          switchToOtherTeam(roomId);
        } else {
          // İkinci takım 5 kelimeyi bildi, oyunu bitir
          console.log('İkinci takım 5 kelimeyi bildi, oyun bitiyor');
          endGame(roomId);
        }
      } else {
        // Yeni kelime seç
        room.currentWord = selectNewWord(room);
        console.log('Yeni kelime seçildi:', room.currentWord);
        
        // Yeni kelimeyi tüm oyunculara bildir
        io.to(roomId).emit('wordUpdate', {
          currentWord: room.currentWord,
          timeRemaining: room.timeRemaining,
          currentTeam: room.currentTeam
        });
      }
    }
  });

  // Ses verisi yönetimi
  socket.on('audio', (data, callback) => {
    try {
      console.log('Ses verisi alındı:', {
        username: data.username,
        roomId: data.roomId,
        socketId: socket.id
      });

      // Oda kontrolü
      const room = rooms[data.roomId];
      if (!room) {
        console.error('Oda bulunamadı:', data.roomId);
        if (callback) callback({ error: 'Oda bulunamadı' });
        return;
      }

      // Oyuncunun takımını kontrol et
      let senderTeam = null;
      if (room.team1.some(p => p.id === socket.id)) {
        senderTeam = 'team1';
      } else if (room.team2.some(p => p.id === socket.id)) {
        senderTeam = 'team2';
      }

      if (!senderTeam) {
        console.error('Gönderen oyuncu bir takımda değil:', data.username);
        if (callback) callback({ error: 'Gönderen oyuncu bir takımda değil' });
        return;
      }

      // Ses verisini odadaki diğer takım arkadaşlarına ilet
      const recipients = room[senderTeam]
        .filter(p => p.id !== socket.id);

      if (recipients.length > 0) {
        recipients.forEach(recipient => {
          socket.to(recipient.id).emit('audio', {
            audio: data.audio,
            username: data.username,
            timestamp: data.timestamp,
            sampleRate: data.sampleRate,
            channels: data.channels,
            format: data.format
          });
        });

        console.log('Ses verisi iletildi:', {
          from: data.username,
          to: recipients.map(r => r.username).join(', ')
        });
        
        if (callback) callback(null);
      } else {
        console.log('İletilecek takım arkadaşı bulunamadı');
        if (callback) callback({ error: 'İletilecek takım arkadaşı bulunamadı' });
      }
    } catch (error) {
      console.error('Ses verisi işleme hatası:', error);
      if (callback) callback({ error: error.message });
    }
  });

  // WebRTC sinyal işleme
  socket.on('offer', ({ offer, targetUsername, fromUsername }) => {
    const targetSocket = [...io.sockets.sockets.values()].find(s => 
      rooms[Object.keys(s.rooms)[0]]?.players.find(p => p.username === targetUsername)
    );
    
    if (targetSocket) {
      targetSocket.emit('offer', { offer, fromUsername });
    }
  });

  socket.on('answer', ({ answer, targetUsername, fromUsername }) => {
    const targetSocket = [...io.sockets.sockets.values()].find(s => 
      rooms[Object.keys(s.rooms)[0]]?.players.find(p => p.username === targetUsername)
    );
    
    if (targetSocket) {
      targetSocket.emit('answer', { answer, fromUsername });
    }
  });

  socket.on('ice-candidate', ({ candidate, targetUsername, fromUsername }) => {
    const targetSocket = [...io.sockets.sockets.values()].find(s => 
      rooms[Object.keys(s.rooms)[0]]?.players.find(p => p.username === targetUsername)
    );
    
    if (targetSocket) {
      targetSocket.emit('ice-candidate', { candidate, fromUsername });
    }
  });

  // Bağlantı koptuğunda
  socket.on('disconnect', () => {
    console.log('Kullanıcı ayrıldı:', socket.id);
    
    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        room.team1 = room.team1.filter(p => p.id !== socket.id);
        room.team2 = room.team2.filter(p => p.id !== socket.id);
        
        if (room.players.length === 0) {
          if (room.currentTimer) {
            clearInterval(room.currentTimer);
          }
          delete rooms[roomId];
        } else {
          io.to(roomId).emit('roomUpdate', room);
        }
      }
    });
  });

  socket.on('get-room-users', (roomId, callback) => {
    try {
      const currentSocket = socket;
      console.log('Oda kullanıcıları istendi:', {
        roomId,
        socketId: currentSocket.id,
        allRooms: rooms,
        requestedRoom: rooms[roomId],
        currentSocketRooms: Array.from(currentSocket.rooms || [])
      });
      
      // Callback fonksiyonu kontrolü
      if (typeof callback !== 'function') {
        console.error('Callback fonksiyonu bulunamadı');
        return;
      }

      // Room ID kontrolü
      if (!roomId) {
        console.error('Room ID bulunamadı');
        callback({ message: 'Room ID gerekli' });
        return;
      }

      // Odanın varlığını kontrol et
      const room = rooms[roomId];
      if (!room) {
        console.error('Oda bulunamadı:', {
          roomId,
          availableRooms: Object.keys(rooms)
        });
        callback({ message: 'Oda bulunamadı' });
        return;
      }

      // Kullanıcının odada olup olmadığını kontrol et
      const isUserInRoom = room.players.some(p => p.id === currentSocket.id);
      if (!isUserInRoom) {
        console.error('Kullanıcı odada değil:', {
          socketId: currentSocket.id,
          roomPlayers: room.players
        });
        callback({ message: 'Bu odaya erişim izniniz yok' });
        return;
      }

      // Kullanıcı listesini hazırla
      const usernames = room.players.map(p => p.username);
      
      console.log('Kullanıcı listesi gönderiliyor:', {
        roomId,
        usernames,
        totalUsers: usernames.length,
        currentPlayers: room.players
      });

      // Callback ile kullanıcı listesini gönder
      callback(null, usernames);
    } catch (error) {
      console.error('get-room-users işlenirken hata:', error);
      if (typeof callback === 'function') {
        callback({ message: error.message });
      }
    }
  });

  // Oda kontrolü
  socket.on('checkRoom', ({ roomId }, callback) => {
    try {
      console.log('Oda kontrolü yapılıyor:', {
        roomId,
        socketId: socket.id,
        availableRooms: Object.keys(rooms)
      });

      if (!roomId) {
        throw new Error('RoomId bulunamadı');
      }

      const room = rooms[roomId];
      if (!room) {
        throw new Error('Oda bulunamadı');
      }

      // Socket'in odaya katılmış olduğunu kontrol et
      const socketRooms = Array.from(socket.rooms);
      if (!socketRooms.includes(roomId)) {
        console.log('Socket odaya katılmamış, katılım yapılıyor...');
        socket.join(roomId);
      }

      // Oyuncunun odada olduğunu kontrol et
      const player = room.players.find(p => p.id === socket.id);
      if (!player) {
        console.log('Oyuncu odada bulunamadı, ekleniyor...');
        const username = room.players.find(p => p.username === socket.handshake.query.username)?.username;
        if (username) {
          room.players.push({ id: socket.id, username });
        }
      }

      console.log('Oda durumu:', {
        roomId,
        players: room.players.map(p => ({ id: p.id, username: p.username })),
        team1: room.team1.map(p => ({ id: p.id, username: p.username })),
        team2: room.team2.map(p => ({ id: p.id, username: p.username }))
      });

      callback(null, {
        players: room.players,
        team1: room.team1,
        team2: room.team2
      });
    } catch (error) {
      console.error('Oda kontrolü hatası:', error);
      callback({ message: error.message });
    }
  });
});

// Aktif olmayan odaları temizle (her 1 saatte bir)
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach(roomId => {
    if (now - rooms[roomId].lastActivity > 3600000) { // 1 saat
      console.log('Aktif olmayan oda siliniyor:', roomId);
      delete rooms[roomId];
    }
  });
}, 3600000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});
