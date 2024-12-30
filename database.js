const { Pool } = require('pg');
require('dotenv').config();

let pool = null;

// Boş bir veritabanı nesnesi
const emptyDB = {
  query: async () => null,
  pool: null
};

try {
  // Veritabanı bağlantısı gerekli değilse, boş nesneyi döndür
  if (process.env.SKIP_DB === 'true') {
    console.log('Veritabanı bağlantısı atlanıyor...');
    module.exports = emptyDB;
    return;
  }

  // SSL ayarlarını production ortamında aktifleştir
  const poolConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  };

  // Production ortamında SSL kullan
  if (process.env.NODE_ENV === 'production') {
    poolConfig.ssl = {
      rejectUnauthorized: false
    };
  }

  pool = new Pool(poolConfig);

  // Veritabanı bağlantısını test et
  pool.on('connect', () => {
    console.log('Veritabanına başarıyla bağlanıldı');
  });

  pool.on('error', (err) => {
    console.error('Beklenmeyen veritabanı hatası:', err);
  });

  // Veritabanı tabloları oluşturma
  const createTables = async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS games (
          id SERIAL PRIMARY KEY,
          room_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          winner_team VARCHAR(50),
          team1_score INTEGER DEFAULT 0,
          team2_score INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS players (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL,
          game_id INTEGER REFERENCES games(id),
          team VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_games_room_id ON games(room_id);
        CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
      `);
      console.log('Veritabanı tabloları oluşturuldu');
    } catch (err) {
      console.error('Tablo oluşturma hatası:', err);
    }
  };

  createTables();
  
  module.exports = {
    query: async (text, params) => {
      if (pool) {
        return await pool.query(text, params);
      }
      return null;
    },
    pool
  };

} catch (error) {
  console.log('Veritabanı bağlantısı olmadan devam ediliyor');
  module.exports = emptyDB;
}
