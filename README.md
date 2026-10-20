# Son Şafak

Tarayıcıda 1–8 kişiyle oynanan zombi hayatta kalma ve üs savunma oyunu.

## Yerelde çalıştır

Node.js 18 veya üstü ile: npm ci, ardından npm start. http://localhost:3000 adresini aç.

WASD / oklar: hareket; fare: nişan; sol tık: ateş; R: şarjör; B: market; 1–5: silah; boşluk: hazırlığı bitir; Tab: skor.

Tek başına hemen başla veya oda oluşturup kodunu arkadaşlarınla paylaş. Marketten barikat ve otomatik taret al, haritaya tıklayarak yerleştir. Sağ tık yerleştirmeyi iptal eder. Para ekipçe paylaşılır.

## Render

render.yaml ücretsiz Frankfurt Node web servisini tanımlar. Build: npm ci && npm test. Start: npm start. Sağlık: /_health. GitHub main dalına gönderilen her commit otomatik yayınlanır. Yalnızca yerel commit yeterli değildir; git push gerekir.

Odalar bellekte tutulur; sunucu yeniden başladığında sıfırlanır. Ücretsiz servis boşta uyuyabilir; ilk açılış gecikebilir. Aynı oda tek sunucuda çalışır.

## Kontrol

npm test: oyun kuralları ve tarayıcı çizim regresyon testi. Sunucu çalışırken node test-sim.js: çok oyunculu WebSocket simülasyonu.
