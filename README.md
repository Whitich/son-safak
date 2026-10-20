# Son Şafak 4.4

[Tarayıcıda oyna](https://son-safak.onrender.com/) — 1–8 kişilik kooperatif zombi savunması.

## Oynanış

- WASD / oklar: hareket; fare: nişan; sol tuşu basılı tut: ateş; R: şarjör.
- B: marketi aç/kapat; inşa seçiliyse iptal et. Esc / sağ tık da inşayı iptal eder.
- 1–9 / 0, Q / E, fare tekerleği veya cephanelik düğmeleri: satın alınmış silahları değiştir. Silahlar ölümle kaybolmaz. Geliştirmeler ortak kasadan bir kez alınır ve tüm ekibe, sonradan katılanlara da uygulanır. Her silah kendi şarjörünü korur.
- Yapı seç, boş zemine sol tıkla. İnşa bir yerleştirmeden sonra otomatik kapanır. X: imleçteki yapıyı 300 menzilden sök, kalan cana göre %40 bedel iadesi al.
- Boşluk: oda sahibi hazırlığı bitirir; Tab: ekip skorları.

Market: 12 kalıcı silah, 9 yapı, 6 destek ve 7 kademeli ortak geliştirme. Başlangıç ortak parası tek oyuncuda $550; ek oyuncu başına $200. İlk hazırlık 45 sn, sonraki hazırlıklar 30 sn. Market oyunu durdurmaz.

Duvar, çelik barikat ve kapı taret ateşini engeller. Oyuncu mermileri dost yapılardan geçer. Demir çit ($130 / 300 can) zombileri ve oyuncuları durdururken taret ateşini ve asidi geçirir; her üs seviyesinde kullanılabilir ve seviye basılabilir. Kapı oyunculara geçiş verirken zombileri durdurur. Dikenli tel yavaşlatır ve hasar verir; mayın tek kullanımlık alan patlamasıdır. Taretlerin menzil ve etkileri farklıdır. Duvar $45 / 240 can; yapı tamiri $15 / 160 can.

Her başarılı gecenin sonunda en az bir oyuncu ayaktaysa tüm ekip tam can ve şarjörle geri döner. Üs otomatik onarılmaz. Üs düşerse veya herkes ölürse maç biter.

12 düşman türü geceler ilerledikçe açılır. Zırhlı hasarı azaltır; Magnum ve keskin taret zırh deler. Yıkıcı yapılara 3 kat hasar verir. Şifacı yakın zombileri iyileştirir. Öfkeli yarı canın altında hızlanır. Her 5. gece büyük düşman gelir. 10. geceden itibaren Kuşatmacı uzun menzilden taretleri avlar; 12. geceden itibaren Bozucu 260 menzilde taret atış aralığını iki katına çıkarır. Can, hasar, hız ve toplam düşman sayısı gecelerle artar; ekip büyüklüğü de hesaba katılır.

## Yerelde çalıştır

Node.js 18+ ile npm ci ve npm start. http://localhost:3000 adresini aç. PORT ortam değişkeni desteklenir.

## Test ve yayın

npm test: oyun kuralları, çizim/market regresyonları ve yeni mekanik testleri. Çalışan sunucuda node test-sim.js çok oyunculu WebSocket testi yapar; TEST_URL ile başka sunucu seçilebilir.

render.yaml ücretsiz Frankfurt Node servisini tanımlar. Derleme: npm ci && npm test. Başlatma: npm start. Sağlık ve sürüm: /_health. GitHub main dalına push edilen commit otomatik yayınlanır. Yerel commit sonrasında git push gerekir.

Odalar bellekte tutulur ve sunucu yeniden başlayınca sıfırlanır. Ücretsiz servis boşta uyuyabilir, ilk açılış gecikebilir. Bir oda tek sunucuda çalışır.

## 3.0 içerikleri

Odak Lazeri aynı hedefte 4 saniye tutulduğunda her 0.2 sn vuruşu 3 hasardan 150 hasara çıkar; ekip hasar geliştirmesi bunu artırır. Menzil 800, hücre 50, doldurma 2.8 sn. Bırakma, hedef kaybı, hedef değişimi veya şarjör odağı sıfırlar. Zırhı yok sayar. 0 tuşu veya cephanelik ile seçilir.

Tesla Yayı 160 menzilde 3 ek hedefe, her seferinde %25 azalan hasarla sıçrar. Alev Püskürtücü 4 sn boyunca 16 hasar/sn yanma uygular. Ekip Sağlık Paketi ayaktaki herkesi iyileştirir; Ekip Mühimmat Sandığı tüm aktif/yedek şarjörleri doldurur.

Ana menüde 6 üst modeli, 8 başlık, 5 alt modeli (kargo/kot pantolon, şort, düz/pileli etek) ve 3 ten rengi seçilebilir. Başlık, üst/göğüslük ve alt için 10 renk birbirinden bağımsız seçilir. Üst / Başlık / Alt / Ten sekmeleri iki önizlemeyi birlikte günceller; oyun içi önizlemede yürüyüş animasyonu vardır. Eski kayıtlar korunarak yeni alanlar varsayılanlarla tamamlanır. Görünüm kozmetiktir, kaydedilir ve diğer oyunculara iletilir. Zombi Kataloğu tüm türlerin istatistiklerini, açılış gecelerini, davranışlarını ve karşı taktiklerini gösterir.

Ses Web Audio motoruyla ilk kullanıcı etkileşiminde açılır. Ana menüden Sesi dene ve ses seviyesi kontrolü, oyun içinden ses aç/kapat kullanılabilir. Tercihler tarayıcıda saklanır.

## Üs ve yapı ilerleyişi (4.0)

| Üs | Tamamlanan gece şartı | Maliyet | Can | Taret kapasitesi |
| --- | --- | --- | --- | --- |
| 1 — Sığınak | 0 | Başlangıç | 3000 | 4 |
| 2 — Karakol | 3 | $650 | 3800 | 6 |
| 3 — Kale | 6 | $1500 | 4700 | 8 |
| 4 — Son Hat | 10 | $3000 | 5800 | 10 |

Üs yalnızca hazırlıkta, sırayla ve ortak kasadan yükseltilir. Yeni kapasite kadar can eklenir; hasar bedavaya onarılmaz. Üs 2 taarruz, nişancı, kriyo ve alev silahlarını, çelik barikatı ve uzman taretleri açar. Üs 3 Tesla, lazer, LMG ve bomba atarı açar. Kilitli ürünler markette görünür ve gereken seviyeyi yazar.

Market → Yapı Seviyeleri: en yakından sıralanan, 420 menzildeki bir yapıya ayrı seviye bas. Seviye sınırı üs seviyesidir, en fazla 4; mayın geliştirilemez. Seviye başına temel can +%65, taret/tel hasarı +%30, taret menzili +%5. Ortak yapı dayanıklılığı ve taret mühimmatı geliştirmeleri bunlarla birleşir. Yükseltme can oranını korur. Söküm, harcanan inşa ve seviye bedelinin cana göre %40'ını geri verir.

Taretler yaklaşık 6 sn kesintisiz ateşten sonra 3 sn soğur. Bozucu yakınındayken atış aralığı ikiye katlanır; birden fazla bozucu etkiyi katlamaz. Isı, soğuma ve bozulma oyun içinde görünür. Yapı seviyeleri ve kapasite sunucuda doğrulanır.

Düşman sayısı her gece ölçülü artar. İlerleyen gecelerde doğuş aralığı kısalır, saldırı hızı ve yavaşlatma direnci artar; geç oyunda can ve hasar büyümesi hızlanır. Sabit bir gece kaybetme kuralı yoktur. `node test-endurance.js` üç sabit rastgele akışta tam geliştirilmiş 10 taret / 40 demir çiti oyuncu ateşi ve tamir olmadan sınar: mevcut ayarlarda 18–19 gece tamamlayıp 19–20. gecelerde yenilir. Bu bir aktif oyuncu skor tahmini değildir.

Skor, başlanmış geceyi değil tamamlanan geceleri sayar. Bu cihazda tek kişilik ve ekip rekorları ayrı kaydedilir; küresel liderlik tablosu değildir.

Taret hedeflemesi görüş hattını kontrol eder; kapalı hedef yerine açık hedefi seçer. Atıştan sonra araya duvar kurulursa, hareketli mermi de duvarda durur. Delici taret mermileri duvarı delemez; dost yapılara ateş hasarı verilmez.

## Enfekte görünümü (4.3)

12 tür için ortak savaş alanı/katalog çizimi: bozuk gövde silüeti, uzanan pençeler, yırtık kıyafet, açık omurga ve türlere özgü detaylar. Sürücü yere yakın hareket eder; Güçlü ve boss asimetrik ve kemiksi çıkıntılıdır. Tükürükçü/kuşatmacı asit keseleri, şifacı mantarlar, bozucu mor çıkıntılar taşır. Adım animasyonu gerçek hareket mesafesine bağlıdır. Fiziksel boyutlar ve oyun kuralları korunur.

## Market görselleri ve akıcılık (4.4)

Silahlar, savunmalar, destekler, ekip geliştirmeleri, üsler ve tek tek yapı geliştirmeleri ürün çizimi taşır. Silah fiyatları yaklaşık %8 düşürüldü (en yakın $5'e yuvarlanır). Duvar $45, çelik barikat $100, kapı $80, demir çit $130; diğer yapı ve geliştirme fiyatları aynı kalır.

Sol üstte ms (sunucuya gidiş-dönüş süresi) ve gerçek çizim FPS'i gösterilir. Zombi yön/adım çizimleri 384 girişli bir önbellekte yeniden kullanılır; ekran dışındaki zombiler çizilmez. Vuruş sesi sıklığı ve parçacık sayısı sınırlandırılır. Yüksek yenileme hızlarında gereksiz çizim yükünü azaltmak için çizim 60 FPS ile sınırlıdır; hareket/girdi ve sunucu güncellemesi bu sınıra bağlı değildir. Yerel 100 zombi görsel kontrolünde 60 FPS görüldü; bu, her cihaz veya internet bağlantısı için garanti değildir.
