# Son Şafak 2.0

[Tarayıcıda oyna](https://son-safak.onrender.com/) — 1–8 kişilik kooperatif zombi savunması.

## Oynanış

- WASD / oklar: hareket; fare: nişan; sol tuşu basılı tut: ateş; R: şarjör.
- B: marketi aç/kapat; inşa seçiliyse iptal et. Esc / sağ tık da inşayı iptal eder.
- 1–9, Q / E, fare tekerleği veya cephanelik düğmeleri: satın alınmış silahları değiştir. Silahlar ve geliştirmeler ölümle kaybolmaz. Her silah kendi şarjörünü korur.
- Yapı seç, boş zemine sol tıkla. İnşa bir yerleştirmeden sonra otomatik kapanır. X: imleçteki yapıyı 300 menzilden sök, kalan cana göre %40 bedel iadesi al.
- Boşluk: oda sahibi hazırlığı bitirir; Tab: ekip skorları.

Market: 9 kalıcı silah, 8 yapı, 4 destek ve 4 kademeli kişisel geliştirme. Başlangıç ortak parası tek oyuncuda $550; ek oyuncu başına $200. İlk hazırlık 45 sn, sonraki hazırlıklar 30 sn. Market oyunu durdurmaz.

Duvarlar ve kapılar dost mermileri engellemez. Kapı oyunculara geçiş verirken zombileri durdurur. Dikenli tel yavaşlatır ve hasar verir; mayın tek kullanımlık alan patlamasıdır. Taretlerin menzil ve etkileri farklıdır. Duvar $50 / 240 can; yapı tamiri $15 / 160 can.

Her başarılı gecenin sonunda en az bir oyuncu ayaktaysa tüm ekip tam can ve şarjörle geri döner. Üs otomatik onarılmaz. Üs düşerse veya herkes ölürse maç biter.

10 düşman türü geceler ilerledikçe açılır. Zırhlı hasarı azaltır; Magnum ve keskin taret zırh deler. Yıkıcı yapılara 3 kat hasar verir. Şifacı yakın zombileri iyileştirir. Öfkeli yarı canın altında hızlanır. Her 4. gece koşucu akını, her 5. gece büyük düşman gelir. Can, hasar, hız ve toplam düşman sayısı gecelerle artar; ekip büyüklüğü de hesaba katılır.

## Yerelde çalıştır

Node.js 18+ ile npm ci ve npm start. http://localhost:3000 adresini aç. PORT ortam değişkeni desteklenir.

## Test ve yayın

npm test: oyun kuralları, çizim/market regresyonları ve yeni mekanik testleri. Çalışan sunucuda node test-sim.js çok oyunculu WebSocket testi yapar; TEST_URL ile başka sunucu seçilebilir.

render.yaml ücretsiz Frankfurt Node servisini tanımlar. Derleme: npm ci && npm test. Başlatma: npm start. Sağlık ve sürüm: /_health. GitHub main dalına push edilen commit otomatik yayınlanır. Yerel commit sonrasında git push gerekir.

Odalar bellekte tutulur ve sunucu yeniden başlayınca sıfırlanır. Ücretsiz servis boşta uyuyabilir, ilk açılış gecikebilir. Bir oda tek sunucuda çalışır.
