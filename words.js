const words = [
  // Nesneler ve Eşyalar
  "sandalye", "bilgisayar", "telefon", "kitap", "kalem", "masa", "pencere", "kapı", "araba", "bisiklet",
  "televizyon", "buzdolabı", "çanta", "saat", "gözlük", "ayna", "yatak", "dolap", "koltuk", "halı",
  "tabak", "bardak", "çatal", "bıçak", "kaşık", "tencere", "tava", "fırın", "lamba", "perde",
  "kumanda", "klavye", "mouse", "monitör", "hoparlör", "mikrofon", "kamera", "yazıcı", "tarayıcı", "projeksiyon",
  
  // Yiyecek ve İçecekler
  "ekmek", "peynir", "süt", "yoğurt", "elma", "portakal", "muz", "çilek", "domates", "salatalık",
  "patates", "havuç", "soğan", "sarımsak", "pilav", "makarna", "çorba", "köfte", "tavuk", "balık",
  "kahve", "çay", "su", "meyve suyu", "limonata", "ayran", "dondurma", "çikolata", "pasta", "börek",
  "karpuz", "kavun", "üzüm", "kiraz", "şeftali", "armut", "incir", "mandalina", "nar", "erik",
  "kek", "kurabiye", "simit", "poğaça", "lahmacun", "pide", "pizza", "hamburger", "döner", "kebap",
  
  // Hayvanlar
  "kedi", "köpek", "kuş", "balık", "at", "inek", "tavuk", "koyun", "aslan", "kaplan",
  "fil", "zürafa", "maymun", "penguen", "tavşan", "fare", "yılan", "kaplumbağa", "kartal", "papağan",
  "ayı", "kurt", "tilki", "sincap", "kirpi", "ördek", "kaz", "güvercin", "serçe", "baykuş",
  "leopar", "panda", "koala", "kanguru", "zebra", "gergedan", "timsah", "iguana", "ahtapot", "yunus",
  
  // Doğa ve Çevre
  "ağaç", "çiçek", "güneş", "ay", "yıldız", "deniz", "dağ", "orman", "nehir", "göl",
  "bulut", "yağmur", "kar", "rüzgar", "şimşek", "gökkuşağı", "plaj", "ada", "çimen", "yaprak",
  "okyanus", "volkan", "vadi", "kanyon", "mağara", "şelale", "buzul", "çöl", "kumsal", "mercan",
  "fırtına", "kasırga", "deprem", "tsunami", "yanardağ", "krater", "meteor", "gezegen", "galaksi", "yıldırım",
  
  // Meslekler
  "doktor", "öğretmen", "mühendis", "aşçı", "polis", "itfaiyeci", "pilot", "şoför", "garson", "hemşire",
  "avukat", "diş hekimi", "ressam", "müzisyen", "terzi", "berber", "marangoz", "çiftçi", "kasap", "fırıncı",
  "mimar", "gazeteci", "yazar", "aktör", "yönetmen", "dansçı", "şarkıcı", "sporcu", "bilim adamı", "astronot",
  "veteriner", "psikolog", "eczacı", "cerrah", "hakim", "savcı", "bankacı", "muhasebeci", "pazarlamacı", "reklamcı",
  
  // Spor ve Aktiviteler
  "futbol", "basketbol", "voleybol", "tenis", "yüzme", "koşu", "dans", "yoga", "bisiklet", "kayak",
  "satranç", "bowling", "golf", "boks", "güreş", "jimnastik", "okçuluk", "balık tutma", "dağcılık", "sörf",
  "masa tenisi", "badminton", "beyzbol", "hokey", "rugby", "karate", "judo", "tekvando", "eskrim", "halter",
  "parkur", "paten", "kaykay", "rafting", "paraşüt", "dalış", "tırmanış", "yelken", "kürek", "kano",
  
  // Renkler ve Şekiller
  "kırmızı", "mavi", "yeşil", "sarı", "siyah", "beyaz", "mor", "turuncu", "pembe", "kahverengi",
  "kare", "daire", "üçgen", "dikdörtgen", "yıldız", "kalp", "elmas", "spiral", "küp", "silindir",
  "gri", "lacivert", "turkuaz", "bej", "bordo", "lila", "eflatun", "altın", "gümüş", "bronz",
  "prizma", "piramit", "koni", "küre", "oval", "yamuk", "paralelkenar", "beşgen", "altıgen", "sekizgen",
  
  // Duygular ve Hisler
  "mutlu", "üzgün", "kızgın", "yorgun", "heyecanlı", "şaşkın", "korkmuş", "sakin", "endişeli", "neşeli",
  "stresli", "rahat", "gergin", "keyifli", "uykulu", "enerjik", "huzurlu", "sinirli", "umutlu", "umutsuz",
  "yalnız", "sevgi dolu", "kıskanç", "gururlu", "utanmış", "pişman", "özgüvenli", "kaygılı", "şüpheli", "meraklı",
  
  // Mevsimler ve Hava Durumu
  "ilkbahar", "yaz", "sonbahar", "kış", "güneşli", "yağmurlu", "karlı", "rüzgarlı", "sisli", "bulutlu",
  "fırtınalı", "tipili", "dolu", "nemli", "kuru", "sıcak", "soğuk", "ılık", "serin", "dondurucu",
  
  // Aile ve İlişkiler
  "anne", "baba", "kardeş", "abla", "ağabey", "teyze", "amca", "dayı", "hala", "dede",
  "nine", "kuzen", "yeğen", "gelin", "damat", "kayınvalide", "kayınpeder", "torun", "aile", "arkadaş",
  "eş", "sevgili", "nişanlı", "komşu", "meslektaş", "öğrenci", "öğretmen", "müdür", "patron", "çalışan",
  
  // Giyim ve Aksesuar
  "gömlek", "pantolon", "etek", "elbise", "ceket", "ayakkabı", "çorap", "şapka", "eldiven", "atkı",
  "kemer", "çanta", "kolye", "yüzük", "bilezik", "küpe", "saat", "gözlük", "şemsiye", "valiz",
  "mont", "kazak", "tişört", "şort", "mayo", "bikini", "pijama", "gecelik", "takım elbise", "kravat",
  "eşarp", "fular", "bere", "terlik", "bot", "sandalet", "çizme", "spor ayakkabı", "smokin", "gelinlik",
  
  // Ev ve Mobilya
  "salon", "mutfak", "yatak odası", "banyo", "balkon", "bahçe", "garaj", "çatı", "merdiven", "asansör",
  "koltuk", "sandalye", "masa", "yatak", "dolap", "kitaplık", "televizyon", "buzdolabı", "çamaşır makinesi", "bulaşık makinesi",
  "kanepe", "sehpa", "vitrin", "gardırop", "şifonyer", "komodin", "avize", "abajur", "halı", "kilim",
  "perde", "yastık", "yorgan", "battaniye", "çarşaf", "havlu", "ayna", "tablo", "vazo", "saksı",
  
  // Okul ve Eğitim
  "okul", "sınıf", "öğrenci", "öğretmen", "kitap", "defter", "kalem", "silgi", "tahta", "sıra",
  "kütüphane", "laboratuvar", "spor salonu", "kantin", "müdür", "teneffüs", "sınav", "ödev", "proje", "diploma",
  "ders", "not", "karne", "okul çantası", "kalemlik", "pergel", "cetvel", "hesap makinesi", "sözlük", "atlas",
  "test", "quiz", "sunum", "rapor", "tez", "makale", "seminer", "konferans", "workshop", "sertifika",
  
  // Ulaşım
  "araba", "otobüs", "tren", "uçak", "gemi", "bisiklet", "motosiklet", "taksi", "metro", "tramvay",
  "helikopter", "kamyon", "minibüs", "vapur", "kayık", "teleferik", "scooter", "ambulans", "itfaiye", "polis arabası",
  "yat", "sürat teknesi", "jet ski", "zeplin", "balon", "roket", "uzay mekiği", "denizaltı", "feribot", "karavan",
  
  // Teknoloji
  "bilgisayar", "telefon", "tablet", "laptop", "akıllı saat", "drone", "robot", "yazıcı", "modem", "router",
  "şarj aleti", "powerbank", "kulaklık", "mikrofon", "kamera", "projeksiyon", "oyun konsolu", "sanal gerçeklik", "yapay zeka", "bluetooth",
  
  // Müzik ve Sanat
  "gitar", "piyano", "keman", "davul", "flüt", "saksafon", "trompet", "bateri", "org", "arp",
  "resim", "heykel", "fotoğraf", "film", "tiyatro", "bale", "opera", "konser", "sergi", "müze",
  
  // Şehir ve Mekan
  "park", "hastane", "market", "restoran", "kafe", "sinema", "tiyatro", "stadyum", "havaalanı", "istasyon",
  "otel", "alışveriş merkezi", "müze", "kütüphane", "postane", "banka", "eczane", "spor salonu", "kuaför", "berber",
  
  // Tatil ve Seyahat
  "otel", "tatil köyü", "kamping", "çadır", "karavan", "pasaport", "bilet", "bavul", "harita", "pusula",
  "rehber", "turist", "tur", "gezi", "macera", "keşif", "fotoğraf", "hatıra", "hediyelik", "kartpostal"
];

module.exports = words; 