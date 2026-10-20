# Son Şafak 3.0

[Tarayıcıda oyna](https://son-safak.onrender.com/) — 1–8 kişilik kooperatif zombi savunması.

## Oynanış

- WASD / oklar: hareket; fare: nişan; sol tuşu basılı tut: ateş; R: şarjör.
- B: marketi aç/kapat; inşa seçiliyse iptal et. Esc / sağ tık da inşayı iptal eder.
- 1–9 / 0, Q / E, fare tekerleği veya cephanelik düğmeleri: satın alınmış silahları değiştir. Silahlar ölümle kaybolmaz. Geliştirmeler ortak kasadan bir kez alınır ve tüm ekibe, sonradan katılanlara da uygulanır. Her silah kendi şarjörünü korur.
- Yapı seç, boş zemine sol tıkla. İnşa bir yerleştirmeden sonra otomatik kapanır. X: imleçteki yapıyı 300 menzilden sök, kalan cana göre %40 bedel iadesi al.
- Boşluk: oda sahibi hazırlığı bitirir; Tab: ekip skorları.

Market: 12 kalıcı silah, 8 yapı, 6 destek ve 7 kademeli ortak geliştirme. Başlangıç ortak parası tek oyuncuda $550; ek oyuncu başına $200. İlk hazırlık 45 sn, sonraki hazırlıklar 30 sn. Market oyunu durdurmaz.

Duvarlar ve kapılar dost mermileri engellemez. Kapı oyunculara geçiş verirken zombileri durdurur. Dikenli tel yavaşlatır ve hasar verir; mayın tek kullanımlık alan patlamasıdır. Taretlerin menzil ve etkileri farklıdır. Duvar $50 / 240 can; yapı tamiri $15 / 160 can.

Her başarılı gecenin sonunda en az bir oyuncu ayaktaysa tüm ekip tam can ve şarjörle geri döner. Üs otomatik onarılmaz. Üs düşerse veya herkes ölürse maç biter.

10 düşman türü geceler ilerledikçe açılır. Zırhlı hasarı azaltır; Magnum ve keskin taret zırh deler. Yıkıcı yapılara 3 kat hasar verir. Şifacı yakın zombileri iyileştirir. Öfkeli yarı canın altında hızlanır. Her 4. gece koşucu akını, her 5. gece büyük düşman gelir. Can, hasar, hız ve toplam düşman sayısı gecelerle artar; ekip büyüklüğü de hesaba katılır.

## Yerelde çalıştır

Node.js 18+ ile npm ci ve npm start. http://localhost:3000 adresini aç. PORT ortam değişkeni desteklenir.

## Test ve yayın

npm test: oyun kuralları, çizim/market regresyonları ve yeni mekanik testleri. Çalışan sunucuda node test-sim.js çok oyunculu WebSocket testi yapar; TEST_URL ile başka sunucu seçilebilir.

render.yaml ücretsiz Frankfurt Node servisini tanımlar. Derleme: npm ci && npm test. Başlatma: npm start. Sağlık ve sürüm: /_health. GitHub main dalına push edilen commit otomatik yayınlanır. Yerel commit sonrasında git push gerekir.

Odalar bellekte tutulur ve sunucu yeniden başlayınca sıfırlanır. Ücretsiz servis boşta uyuyabilir, ilk açılış gecikebilir. Bir oda tek sunucuda çalışır.

## 3.0 içerikleri

Odak Lazeri aynı hedefte 4 saniye tutulduğunda her 0.2 sn vuruşu 3 hasardan 150 hasara çıkar; ekip hasar geliştirmesi bunu artırır. Menzil 800, hücre 50, doldurma 2.8 sn. Bırakma, hedef kaybı, hedef değişimi veya şarjör odağı sıfırlar. Zırhı yok sayar. 0 tuşu veya cephanelik ile seçilir.

Tesla Yayı 160 menzilde 3 ek hedefe, her seferinde %25 azalan hasarla sıçrar. Alev Püskürtücü 4 sn boyunca 16 hasar/sn yanma uygular. Ekip Sağlık Paketi ayaktaki herkesi iyileştirir; Ekip Mühimmat Sandığı tüm aktif/yedek şarjörleri doldurur.

Ana menüde 6 kıyafet rengi, 3 kıyafet, 3 başlık ve 3 ten rengi seçilebilir. Görünüm kozmetiktir, kaydedilir ve diğer oyunculara iletilir. Zombi Kataloğu tüm türlerin istatistiklerini, açılış gecelerini, davranışlarını ve karşı taktiklerini gösterir.

Ses Web Audio motoruyla ilk kullanıcı etkileşiminde açılır. Ana menüden Sesi dene ve ses seviyesi kontrolü, oyun içinden ses aç/kapat kullanılabilir. Tercihler tarayıcıda saklanır.
