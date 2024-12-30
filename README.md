# Word Guess Game - Backend

Bu proje, Word Guess oyununun backend kısmıdır. Node.js, Express ve Socket.IO kullanılarak geliştirilmiştir.

## Özellikler

- Gerçek zamanlı çok oyunculu oyun sunucusu
- Socket.IO ile anlık iletişim
- Oda yönetimi sistemi
- Kelime havuzu ve kelime seçim sistemi
- Oyun durumu yönetimi

## Teknolojiler

- Node.js
- Express
- Socket.IO
- CORS

## Kurulum

1. Repository'yi klonlayın:
```bash
git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
cd REPO_NAME
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. `.env` dosyasını oluşturun ve gerekli değişkenleri ayarlayın:
```env
NODE_ENV=development
PORT=3002
CLIENT_URL=http://localhost:5173
```

4. Sunucuyu başlatın:
```bash
npm start
```

Development modunda çalıştırmak için:
```bash
npm run dev
```

## API Endpoints

- `GET /health` - Sunucu sağlık kontrolü
- Socket.IO Events:
  - `joinRoom` - Odaya katılma
  - `selectTeam` - Takım seçme
  - `startGame` - Oyunu başlatma
  - `makeGuess` - Tahmin yapma

## Environment Variables

- `NODE_ENV` - Çalışma ortamı (development/production)
- `PORT` - Sunucu portu
- `CLIENT_URL` - Frontend URL'i (CORS için)

## Deploy

Bu proje Render'da host edilmektedir. Main branch'e yapılan her push otomatik olarak deploy edilir.

## Lisans

MIT 