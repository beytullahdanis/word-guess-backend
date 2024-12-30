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
  origin: CLIENT_URL,
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

// Production'da statik dosyaları serve et
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const server = http.createServer(app);

// Socket.IO yapılandırması
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket']
});

// Sağlık kontrolü endpoint'i
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
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
  console.log('Bir kullanıcı bağlandı:', socket.id);

  // Odaya katılma
  socket.on('joinRoom', ({ roomId, username, currentTeam }) => {
    console.log('Odaya katılma isteği:', { roomId, username, socketId: socket.id, currentTeam });
    
    if (!roomId || !username) {
      console.error('Geçersiz oda katılım isteği:', { roomId, username });
      return;
    }
    
    socket.join(roomId);
    if (!rooms[roomId]) {
      console.log('Yeni oda oluşturuluyor:', roomId);
      rooms[roomId] = {
        players: [],
        team1: [],
        team2: [],
        currentRound: 0,
        scores: { team1: 0, team2: 0 },
        currentWord: '',
        isPlaying: false,
        lastActivity: Date.now(),
        usedWords: []
      };
    }

    // Eğer oyuncu zaten odada varsa, eski bağlantıyı kaldır
    const existingPlayerIndex = rooms[roomId].players.findIndex(p => p.username === username);
    if (existingPlayerIndex !== -1) {
      console.log('Mevcut oyuncu yeniden bağlanıyor:', username);
      rooms[roomId].players.splice(existingPlayerIndex, 1);
      
      // Eski takım üyeliklerini temizle
      rooms[roomId].team1 = rooms[roomId].team1.filter(p => p.username !== username);
      rooms[roomId].team2 = rooms[roomId].team2.filter(p => p.username !== username);
    }

    // Oyuncuyu odaya ekle
    const playerInfo = { id: socket.id, username };
    rooms[roomId].players.push(playerInfo);
    rooms[roomId].lastActivity = Date.now();

    // Eğer önceki takım bilgisi varsa, o takıma ekle
    if (currentTeam) {
      console.log('Oyuncu önceki takımına ekleniyor:', { username, currentTeam });
      if (currentTeam === 'team1') {
        rooms[roomId].team1.push(playerInfo);
      } else if (currentTeam === 'team2') {
        rooms[roomId].team2.push(playerInfo);
      }
    }
    
    // Eğer aktif bir oyun varsa, oyun durumunu gönder
    if (rooms[roomId].isPlaying) {
      console.log('Aktif oyun durumu gönderiliyor:', rooms[roomId]);
      socket.emit('gameStarted', {
        isPlaying: rooms[roomId].isPlaying,
        currentTeam: rooms[roomId].currentTeam,
        currentWord: rooms[roomId].currentWord,
        timeRemaining: rooms[roomId].timeRemaining,
        scores: rooms[roomId].scores,
        isPreparation: rooms[roomId].isPreparation,
        preparationTime: rooms[roomId].preparationTime
      });
    }
    
    console.log('Oda durumu güncellendi:', rooms[roomId]);
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
  });

  // Takım seçme
  socket.on('selectTeam', ({ roomId, team }) => {
    console.log('Takım seçme isteği:', { roomId, team, socketId: socket.id });
    
    if (!roomId || !team) {
      console.error('Geçersiz takım seçme isteği:', { roomId, team });
      return;
    }
    
    const room = rooms[roomId];
    if (!room) {
      console.error('Oda bulunamadı:', roomId);
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      console.error('Oyuncu bulunamadı:', socket.id);
      return;
    }
    
    // Oyuncunun mevcut takımını kontrol et ve çıkar
    room.team1 = room.team1.filter(p => p.id !== socket.id);
    room.team2 = room.team2.filter(p => p.id !== socket.id);
    
    // Yeni takıma ekle
    if (team === 'team1') {
      room.team1.push(player);
      console.log('Oyuncu Takım 1\'e eklendi:', player);
    } else if (team === 'team2') {
      room.team2.push(player);
      console.log('Oyuncu Takım 2\'ye eklendi:', player);
    }
    
    room.lastActivity = Date.now();
    console.log('Güncellenmiş oda durumu:', room);
    io.to(roomId).emit('roomUpdate', room);
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

  // Bağlantı koptuğunda
  socket.on('disconnect', () => {
    console.log('Kullanıcı ayrıldı:', socket.id);
    
    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        room.team1 = room.team1.filter(p => p.id !== socket.id);
        room.team2 = room.team2.filter(p => p.id !== socket.id);
        
        // Odada kimse kalmadıysa odayı ve timeri temizle
        if (room.players.length === 0) {
          if (room.currentTimer) {
            clearInterval(room.currentTimer);
          }
          console.log('Boş oda siliniyor:', roomId);
          delete rooms[roomId];
        } else {
          room.lastActivity = Date.now();
          console.log('Oda güncellendi (oyuncu ayrıldı):', room);
          io.to(roomId).emit('roomUpdate', room);
        }
      }
    });
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
