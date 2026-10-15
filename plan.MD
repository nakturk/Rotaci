# Rotacı — Çok Günlü / Çok Duraklı Seyahat Planlayıcı

> Durum: **Taslak v0.3** — Temel mimari ve yol haritası netleşti.
>
> **Kesinleşen kararlar:** Ücretsiz & Açık Kaynak (**GPL-3.0**) · Masaüstü (Win/Linux/Mac) · Tauri 2 · Bulut/senkronizasyon yok (tamamen yerel) · Arayüz Türkçe + İngilizce, dinamik çoklu dil · Mobil sürüm hedeflenmiyor · Rota zekâsı & Hava durumu (Faz 2) · Veri alışverişi (Faz 3) · Bütçesiz/imzasız dağıtım (Flathub, winget, Homebrew).

---

## 1. Hedef

Kullanıcının harita üzerinde, gün gün ve gün içinde rota parçaları (span) halinde seyahat
planlayabildiği; rotaları elle çizebildiği veya POI'ler arası otomatik hesaplatabildiği;
planlarını kaydedip açabildiği ve GPX/KML/KMZ ile dışarı/içeri aktarabildiği,
**Windows / Linux / macOS** üzerinde çalışan bir masaüstü uygulaması.

**Temel ilke:** Tüm harita ve rota kaynakları **ücretsiz** olmalı; ücretli bir anahtara bağımlılık olmamalı.

---

## 2. Teknoloji Seçimi

| Katman | Seçim | Gerekçe |
|---|---|---|
| Masaüstü kabuk | **Tauri 2** (Rust) | Win/Linux/Mac tek kod tabanı, Electron'a göre ~10x küçük paket, düşük RAM. **(Onaylandı)** |
| UI | **React + TypeScript + Vite** | Geniş ekosistem, harita kütüphaneleriyle olgun entegrasyon. |
| Stil | Vanilla CSS (CSS değişkenleri ile tasarım sistemi), koyu/açık tema | |
| Harita motoru | **MapLibre GL JS** | Açık kaynak, vektör + raster + 3D arazi (terrain) desteği, ücretsiz. |
| Çizim | **terra-draw** (MapLibre adapter) | Çizgi, poligon, nokta düzenleme; yasak bölge ve manuel rota çizimi için. |
| Coğrafi hesap | **Turf.js** | Mesafe, kesişim, buffer, viraj (curvature) hesabı. |
| Yerel veritabanı | **SQLite** (`tauri-plugin-sql` veya Rust tarafında `rusqlite`) | Tek dosya, hızlı, yedeklemesi kolay. Geometriler GeoJSON/polyline olarak saklanır. |
| Durum yönetimi | Zustand + Immer (undo/redo için patch geçmişi) | |
| Import/Export | `@tmcw/togeojson` (GPX/KML okuma), özel GPX/KML yazıcı, **JSZip** (KMZ) | |
| Tile önbellek | Rust tarafında HTTP proxy + disk cache | Tile sunucularına yükü azaltır, kullanım politikalarına uyum sağlar. |

> Alternatif: Electron (daha büyük paket ama saf JS). Tercih değişirse sadece kabuk katmanı etkilenir.

---

## 3. Ücretsiz Harita Kaynakları

Harita kaynakları **yapılandırılabilir bir katman kataloğu** (JSON) olarak tutulur; kullanıcı kendi XYZ/WMTS kaynağını da ekleyebilir.

| Tür | Kaynak | Not |
|---|---|---|
| Harita (vektör) | **OpenFreeMap** (Liberty/Bright/Positron stilleri) | Anahtarsız, limitsiz, OSM tabanlı. Varsayılan. |
| Harita (raster) | OpenStreetMap Standard | Tile kullanım politikası var → önbellek + doğru User-Agent zorunlu. |
| Arazi / Topo | **OpenTopoMap** | Eş yükselti eğrili topografik harita. |
| 3D arazi + hillshade | **AWS Terrain Tiles (Terrarium DEM)** | Ücretsiz DEM; MapLibre 3D terrain, gölgelendirme, **eğim profili ve eğim skorlaması** için (bkz. 4.4). |
| Uydu | **Esri World Imagery** | Ücretsiz kullanım, atıf zorunlu; kullanım şartları dağıtım öncesi kontrol edilecek. |
| Uydu (alternatif) | **EOX Sentinel-2 Cloudless** (2016, CC-BY) | Tam açık lisans, daha düşük çözünürlük. |
| Overlay | Hillshade, OpenRailwayMap, Waymarked Trails (yürüyüş/bisiklet) | İsteğe bağlı katmanlar. |

> [!] Uygulama ücretsiz dağıtılacağı için ticari lisans kısıtları gündemden çıktı. Esri'nin kullanım şartları (atıf, toplu indirme yasağı) uygulanır. Tile'lar toplu indirilmez, gezinme sırasında yerel olarak önbelleklenir.

### 3.1 Harita Katmanları ve Önbellek Mimarisi

Rotacı, çevrimiçi ve anahtarsız modern web harita servislerini kullanır:
- **OpenFreeMap (Vektör):** Liberty, Bright ve Positron stilleri. Hızlı, keskin ve anahtarsız.
- **OpenTopoMap:** Eş yükselti eğrili topografik harita.
- **OpenStreetMap Standard:** Raster taban harita.
- **Esri World Imagery:** Yüksek çözünürlüklü uydu görüntüsü.
- **AWS Terrarium DEM:** 3D arazi yükseltisi ve rota eğim profili oluşturma.

**Önbellekleme:** Görüntülenen harita tile'ları yerel disk önbelleğinde saklanarak sunuculara binen yük azaltılır ve gezinti performansı artırılır. Offline harita indirme/paketleme karmaşıklığı yerine doğrudan çevrimiçi harita servisleri ve tile önbellekleme esas alınır.

---

## 4. Rota Motoru Stratejisi

Tek motora bağlı kalmamak için **RoutingProvider arayüzü** tanımlanır; motorlar takılıp çıkarılabilir.

```ts
interface RoutingProvider {
  id: string;
  capabilities: Capabilities;            // hangi seçenekleri desteklediği
  route(req: RouteRequest): Promise<RouteResult[]>;   // alternatifler dahil
  snapToRoad?(points: LngLat[]): Promise<LineString>; // manuel çizimi yola oturtma
}
```

| Motor | Erişim | Güçlü yanı |
|---|---|---|
| **Valhalla** (FOSSGIS public sunucusu) | Ücretsiz, anahtarsız (adil kullanım) | `exclude_polygons` (yasak bölge), `use_tolls`, `use_highways`, `use_ferry`, kamyon boyutları, **motosiklet profili** (`use_trails`), bisiklet/yaya `use_hills` (yokuştan kaçınma), map matching. **Varsayılan.** |
| **OpenRouteService** | Ücretsiz API anahtarı (~2000 istek/gün) | `avoid_polygons`, `avoid_features` (tollways, ferries, highways), HGV (yükseklik/ağırlık/genişlik/dingil/tehlikeli madde). |
| **OSRM** (public demo) | Ücretsiz | Hızlı, basit; kısıtlı seçenek — güvenilir yedek motor. |

### 4.1 Taşıt Profilleri
Kullanıcı birden çok taşıt tanımlar; her span'a bir taşıt atanabilir.

- Tip: Otomobil, Motosiklet, Karavan/Kamyonet, Kamyon, Bisiklet, Yaya, Arazi aracı (4x4)
- Parametreler: yükseklik, genişlik, uzunluk, ağırlık, dingil yükü, römork, maks. hız (kendi hız tavanı), tehlikeli madde
- Yol izinleri: asfalt dışı yol, otoyol, feribot, toprak yol (`surface`, `tracktype`, `smoothness`)
- Seyahat süresi = min(yol hız limiti, taşıt maks. hızı) → gün süresi tahmini için kullanılır.

### 4.2 Otomatik Rota Kriterleri
| Kriter | Uygulama yöntemi |
|---|---|
| En hızlı / en kısa | Motorun doğal modu |
| Ücretli yoldan kaçın | `use_tolls=0` / `avoid_features: tollways` |
| Otoyoldan kaçın | `use_highways` / `avoid_features: highways` |
| Feribot | `use_ferry` / `avoid_features: ferries` |
| **Yol yüzeyi: Asfalt / Karma / Offroad** | Üç seviyeli seçim (aşağıda 4.2.1). |
| **Virajlı yol** | Motosiklet profili + düşük otoyol tercihi; **alternatif rotalar üretilip istemci tarafında viraj skoru** (açı değişimi / km, Kurviger benzeri) ile sıralanır. |
| **Eğim / az yokuş** | Az yokuşlu rota tercihi + maksimum eğim sınırı (aşağıda 4.4.2). |
| Yasak bölgeler | Poligon/daire/koridor olarak çizilir → motora `exclude_polygons`/`avoid_polygons` olarak gönderilir; dönüş rotası yine de kesişiyorsa kullanıcı uyarılır. |

Yasak bölgeler iki seviyede: **Global** (her seyahatte geçerli, örn. "şehir merkezleri") ve **Seyahat özelinde**.

#### 4.2.1 Yol Yüzeyi (Asfalt / Offroad)

| Seçenek | Davranış | Motor karşılığı |
|---|---|---|
| **Sadece asfalt** | Asfaltsız yollar tamamen hariç | Valhalla `exclude_unpaved=true`; bisiklette `avoid_bad_surfaces=1` |
| **Karma** (varsayılan) | Gerekirse asfaltsız yol kullanılabilir, asfalt tercih edilir | Valhalla varsayılan maliyetler |
| **Offroad tercih et** | Toprak yol, stabilize, orman yolu (`highway=track`) öncelikli | Valhalla motosiklet `use_trails` → 1, bisiklette `bicycle_type=Mountain`; yerel GraphHopper'da `surface`/`track_type` custom model |

- Offroad seçeneği taşıt profiline bağlı: yalnızca **Motosiklet (adventure/enduro), 4x4, Bisiklet (MTB), Yaya** profillerinde etkin; otomobil/karavan/kamyonda gizlenir veya uyarı verir.
- 4x4 için ek ayar: kabul edilen en kötü `tracktype` (grade1…grade5) ve `smoothness` seviyesi.
- Rota hesaplandıktan sonra Valhalla `trace_attributes` ile kenar bazlı yüzey bilgisi alınır → her alternatif için **% asfalt / % stabilize / % toprak** dağılımı gösterilir ve harita üzerinde rota yüzeye göre renklendirilebilir.
- OSM'de `surface` etiketi eksik yollar "bilinmiyor" olarak işaretlenir; kullanıcı bu yolların asfaltsız sayılıp sayılmayacağını seçer.

### 4.3 Manuel Rota
- Harita üzerine tıklayarak / serbest çizim ile çizgi oluşturma
- İsteğe bağlı **yola oturt (snap-to-road)** — Valhalla `trace_route`
- Otomatik rota üzerinde noktayı sürükleyip rotayı yeniden şekillendirme (via point)
- Otomatik hesaplanmış rotayı "manuele dönüştür" → serbest düzenleme

### 4.4 Eğim (Yükseklik) Profili ve Eğime Göre Rota

#### 4.4.1 Eğim Profili
- **Veri:** AWS Terrarium DEM tile'ları istemci tarafında örneklenir (rate-limit yok, önbelleklenir, ileride offline çalışır). Yedek: Valhalla `/height` servisi.
- Rota geometrisi sabit aralıklarla (örn. 25–50 m) yeniden örneklenir → yükseklik okunur → DEM gürültüsüne karşı yumuşatma (hareketli ortalama + histerezis eşiği) uygulanır.
- **Grafik (alt panel):** Mesafe–yükseklik eğrisi, segmentler **eğime göre renklendirilir** (örn. <%3 yeşil, %3–6 sarı, %6–10 turuncu, %10–15 kırmızı, >%15 mor; iniş/çıkış ayrı tonlar).
- **Etkileşim:** Grafik üzerinde gezinince haritada konum işaretçisi senkron hareket eder; grafikte aralık seçince haritada o bölüm vurgulanır (ve tersi). Durak/POI'ler grafikte işaretli.
- **Kapsam:** Tek span, tüm gün veya tüm seyahat (günler arası ayırıcılarla).
- **İstatistikler:** Toplam tırmanış / iniş, min / maks yükseklik, ortalama ve maksimum eğim, eşik üstü dik bölümlerin listesi (konum, uzunluk, ortalama %).
- Haritada rota çizgisini isteğe bağlı **eğime göre renklendirme** modu.
- Manuel çizilen ve import edilen rotalar için de aynı profil üretilir (import edilen dosyada `<ele>` varsa o kullanılır, yoksa DEM).

#### 4.4.2 Eğime Göre Otomatik Rota Seçimi

| Ayar | Açıklama |
|---|---|
| **Yokuş tercihi** (kaydırıcı) | Farketmez ← → Az yokuş tercih et ← → Yokuştan kesinlikle kaçın |
| **Maksimum eğim (%)** | Taşıt profilinden varsayılan gelir (örn. karavan %10, römorklu %8, kamyon %8); aşan rota elenir veya uyarı verilir. |
| **Sadece çıkışlar / iniş de dahil** | Dik inişler de (fren, römork) cezalandırılsın mı? |

**Uygulama yöntemi (iki katmanlı):**
1. **Motor seviyesi:** Destekleyen profillerde doğrudan parametre — Valhalla bisiklet/yaya `use_hills` (0–1), ORS bisiklet `profile_params.restrictions.gradient` (maks. eğim) ve yokuş ağırlıkları.
2. **İstemci seviyesi (tüm taşıtlar için):** Motorlardan alternatif rotalar istenir (gerekirse ara noktalarla çeşitlendirilerek); her biri DEM ile profillenip **eğim maliyeti** hesaplanır:
   `maliyet = süre × (1 + w × (toplam_tırmanış/km normalize + dik_bölüm_cezası))`
   Maks. eğim sınırını aşan alternatifler elenir; kalanlar kullanıcının yokuş tercihi ağırlığına (`w`) göre sıralanır.

- Otomobil/motosiklet/kamyon için motorların yerleşik eğim parametresi yok → istemci seviyesi skorlama esas.
- Alternatif kartlarında tırmanış (m), maks. eğim (%) ve mini profil önizlemesi gösterilir.
- Eğim, taşıtın süre tahminine de yansıtılabilir (bisiklet/yaya için yokuşta hız düşürme — Tobler/Naismith benzeri).

### 4.5 Zaman Çizelgesi ve Rota Boyunca Hava Durumu

Seyahatlerin, günlerin ve rota parçalarının başlangıç tarih/saatlerine göre rotadaki her noktanın üzerinden **saat kaçta geçileceği** hesaplanır ve o anki beklenen meteorolojik koşullar harita üstünde gösterilir.

#### 4.5.1 Tarih ve Saat Yönetimi
- **Seyahat düzeyi:** Başlangıç tarihi (`startDate`) ve varsayılan günlük hareket saati (örn. 09:00).
- **Gün düzeyi:** Tarih (`date`) ve o günün hareket saati (`startTime`). Önceki günden otomatik ardışık tarih üretilir; kullanıcı serbestçe değiştirebilir (araya dinlenme günü eklenebilir).
- **Span düzeyi:** Kalkış saati (`plannedDeparture`) = önceki span varışı + POI/durak mola süresi (`stopDuration`). Kullanıcı gerekirse elle kalkış saatini sabitleyebilir.
- **Geçiş Zamanı (ETA) Enterpolasyonu:** Rota çizgisi boyunca her ara noktanın tahmini geçiş saati, span kalkış saati + katedilen mesafeye göre hesaplanır.

#### 4.5.2 Hava Durumu Kaynağı: Open-Meteo
- **Kaynak:** **Open-Meteo API** — Tamamen ücretsiz, açık kaynak, API anahtarı gerektirmez, adil kullanımda limitsiz, CORS uyumlu.
- **Parametreler:**
  - **Sıcaklık:** 2 m hava sıcaklığı (°C) ve hissedilen sıcaklık.
  - **Rüzgar:** Rüzgar hızı (km/s), rüzgar yönü (derece ve yön oku) ve rüzgar hamlesi (gusts - fırtına tespiti için).
  - **Yağış:** Yağış miktarı (mm/saat), yağış olasılığı (%) ve yağış türü (yağmur, sağanak, kar, donan yağmur).
  - **Genel durum:** WMO hava kodu (açık, parçalı bulutlu, sisli, fırtınalı vb. ikonlar).
- **Tahmin Zaman Ufku:**
  - *0–16 gün:* Saatlik yüksek çözünürlüklü tahmin (ECMWF, DWD ICON, GFS modelleri).
  - *16+ gün sonrası seyahatler:* Tarih yaklaştığında güncellenmek üzere geçmiş yılların iklim normalleri ortalaması (Open-Meteo Historical Climate API) veya "Tahmin seyahate 16 gün kala aktifleştirilecektir" bildirimi.
- **Çevrimdışı (Offline) Durum:** Çekilen hava verileri yerel SQLite'ta zaman damgasıyla önbelleklenir. İnternet yokken son indirilen veri "Önbellek: X saat önce" etiketiyle gösterilir.

#### 4.5.3 Harita Üstü Görselleştirme ve Etkileşim
- **Hava Rozetleri (Weather Badges):** Rota boyunca stratejik noktalarda (kalkış/varış, duraklar, zirveler/dağ geçitleri ve her 1–2 saatlik sürüş mesafesinde) harita üzerinde yüzen mini kartlar:
  - *Hava durumu ikonu* (güneş, bulut, yağmur damlası vb.)
  - *Sıcaklık (°C)*
  - *Rüzgar yönü oku + hız (km/s)*
  - *Beklenen yağış (mm veya % ihtimal)*
  - *O noktadan tahmini geçiş saati (ETA)*
- **Zaman Kaydırıcısı (Timeline Slider / Player):** Haritanın altında günün saatlerini gösteren kaydırıcı:
  - Kullanıcı saati ileri/geri kaydırdıkça, araç ikonu rotadaki o anki konumuna ilerler; hava rozetleri ve katmanlar o saate göre dinamik güncellenir.
- **Eğim Grafiği ile Entegre Gösterim:** Alt paneldeki yükseklik grafiğinin üst bandında sıcaklık eğrisi, rüzgar şiddeti çubukları ve yağış olasılığı eşzamanlı akar.
- **Güvenlik ve Hava Riski Uyarıları:**
  - Rota boyunca kritik eşikleri aşan hava olaylarında span veya harita üzerinde dikkat/uyarı rozeti:
    - *Şiddetli Yan Rüzgar:* > 45–50 km/s (özellikle motosiklet, yüksek tavanlı karavan ve römorklar için hayati).
    - *Donma Riski / Don:* Sıcaklık ≤ 0 °C (yüksek rakımlı geçitlerde gizli buzlanma).
    - *Aşırı Yağış / Fırtına:* > 10 mm/saat veya oraj uyarısı.
- **İsteğe Bağlı Radar Katmanı:** RainViewer ücretsiz tile API'si ile harita üzerine güncel yağış radarı overlay katmanı.

---

## 5. POI Yönetimi

- **Global POI kütüphanesi:** Kullanıcının tüm seyahatlerinde kullanabileceği favori yerler (kategori, etiket, not, fotoğraf, link).
- **Seyahat POI'leri:** Yalnızca o seyahate ait (konaklama, mola, yakıt, görülecek yer…).
- Global POI → seyahate "ekle" (referans) veya "kopyala".
- Arama: **Photon** / **Nominatim** (geocoding, ücretsiz, rate-limit'e uygun)
- Çevre keşfi: **Overpass API** ile rota koridoru boyunca yakıt, kamp, otel, seyir noktası vb. bulma.
- Kategoriler + ikon/renk; haritada kümeleme (clustering).
- POI'ye planlanan varış/kalış süresi → gün zaman çizelgesine yansır.

---

## 6. Veri Modeli

```
Trip (Seyahat)
 ├─ id, name, description, startDate, defaultStartTime, defaultVehicleId, settings
 ├─ tripPois[]            (seyahat özel POI'ler)
 ├─ avoidAreas[]          (seyahat özel yasak bölgeler)
 └─ days[]  (sıralı)
     └─ Day
         ├─ id, index, date, startTime, title, notes, color
         └─ spans[] (sıralı)
             └─ Span (Rota Parçası)
                 ├─ id, order
                 ├─ from: StopRef, to: StopRef, vias: StopRef[]
                 ├─ mode: "auto" | "manual"
                 ├─ vehicleId, routingProviderId, routeOptions (kriterler)
                 ├─ geometry (LineString), distance, duration, ascent/descent, maxGrade, elevationProfile (önbellek)
                 ├─ plannedDeparture, stopDuration, calculatedEta
                 ├─ weatherForecastCache (saatlik sıcaklık, rüzgar, yağış, uyarılar)
                 └─ cacheKey (parametre hash'i → gereksiz yeniden hesaplama yok)

GlobalPOI, GlobalAvoidArea, VehicleProfile, MapLayerConfig, AppSettings
StopRef = { poiId } | { lngLat, label }
```

**Süreklilik kuralları:**
- Bir span'ın `to` noktası, sonraki span'ın `from` noktasıdır (bağlantılı zincir).
- Günün son durağı = sonraki günün ilk durağı (konaklama noktası) — varsayılan, kopartılabilir.
- Araya span/gün ekleme, silme, sürükle-bırak ile sıralama; komşu span'lar otomatik yeniden bağlanır ve sadece etkilenen span'lar yeniden hesaplanır.
- Günü böl (bir duraktan ikiye ayır) / iki günü birleştir.

**Kayıt:**
- Uygulama içi: SQLite (`~/.../Rotaci/rotaci.db`), otomatik kayıt + undo/redo.
- Paylaşım dosyası: `.rotaci` (zip içinde `trip.json` + ekler) — "Farklı kaydet / Aç".
- Şema versiyonlama + migration.

---

## 7. Import / Export

| Kapsam | GPX | KML | KMZ |
|---|---|---|---|
| Tüm seyahat | ✔ | ✔ (gün başına Folder) | ✔ (KML + ikonlar) |
| Seçili gün(ler) | ✔ | ✔ | ✔ |
| Seçili span(lar) | ✔ | ✔ | ✔ |
| POI'ler | `wpt` | `Placemark` | `Placemark` + ikon |

- GPX: span'lar `trk` (izlenen çizgi) **ve/veya** `rte` (navigasyon cihazları için ara noktalar) olarak — kullanıcı seçer. Garmin/OsmAnd uyumluluk seçenekleri (nokta sayısı sadeleştirme). Track noktalarına `<ele>` (yükseklik) yazılır.
- KML: Stil (renk/kalınlık gün bazında), açıklamalarda mesafe/süre.
- Import: Dosyadaki track'ler → manuel span; waypoint'ler → POI; Folder yapısı → gün önerisi. Mevcut seyahate ekleme veya yeni seyahat oluşturma.

---

## 8. Arayüz Taslağı

```
┌──────────────────────────────────────────────────────────────────┐
│ Üst bar: Seyahat seçici | Kaydet | Undo/Redo | Import/Export | ⚙ │
├───────────────┬──────────────────────────────────────┬───────────┤
│ Sol panel     │                                      │ Sağ panel │
│ • Günler      │            HARİTA                     │ (bağlamsal)│
│   └ Span'lar  │  (katman seçici: Harita/Arazi/Uydu)   │ Span/POI  │
│ • POI'ler     │  Hava durumu rozetleri (T, Rüzgar, ☔) │ detayı,   │
│ • Yasak bölge │  çizim araçları, yasak bölge aracı    │ rota      │
│ • Hava durumu │                                      │ seçenekleri│
├───────────────┴──────────────────────────────────────┴───────────┤
│ Alt: Zaman Çizelgesi Kaydırıcısı (Saatlik Hava & Konum Oynatıcı) │
│      Eğim & Hava profili (eğime göre renkli, T/Rüzgar/Yağış bandı)│
└──────────────────────────────────────────────────────────────────┘
```

- Her gün farklı renkte; seçili gün vurgulanır, diğerleri soluklaşır.
- Haritada sağ tık menüsü: "Buradan başla / Buraya git / Ara nokta ekle / POI ekle / Yasak bölge".
- Alternatif rotalar haritada gösterilir, skorları (süre, km, viraj, yüzey dağılımı, ücret) yan yana.
- Dil: Türkçe + İngilizce, dinamik dil desteği (bkz. 8.1).

### 8.1 Çoklu Dil (i18n)

- **Kütüphane:** `i18next` + `react-i18next`, ICU mesaj formatı (çoğul, cinsiyet, değişken).
- **Dil dosyaları = veri, kod değil:** Her dil tek bir JSON (`locales/tr.json`, `locales/en.json`), isim alanlarına bölünmüş (`common`, `map`, `routing`, `poi`, `io`…).
- **Dinamik ekleme:** Uygulama açılışta hem paketli dilleri hem de kullanıcı veri klasöründeki `locales/` dizinini tarar; buraya bırakılan yeni bir `xx.json` **yeniden derleme gerekmeden** dil menüsünde görünür. Dil dosyası kendi meta bilgisini taşır (`_meta: { code, name, nativeName, dir: "ltr"|"rtl", version }`).
- **Yedekleme (fallback):** Eksik anahtarlar İngilizceye düşer; ayarlarda "çeviri tamamlık %" gösterilir.
- **Çalışırken dil değiştirme** (yeniden başlatmadan); ilk açılışta işletim sistemi dili algılanır.
- **Bölgesel biçimler** dil dosyasından değil `Intl` API'sinden: tarih/saat, sayı, mesafe. Birim sistemi (km/mil, m/ft) dilden bağımsız ayrı bir ayar.
- **Kapsam:** UI metinleri, POI kategori adları, taşıt tipleri, hata mesajları, export dosyalarındaki açıklamalar, rota tarifleri (motorlardan `language` parametresiyle istenir).
- **Harita etiketleri:** Vektör haritada yer adları seçili dile göre (`name:tr`, `name:en`, yoksa `name`).
- **Geliştirici aracı:** Kodda kullanılan ama dil dosyasında olmayan anahtarları bulan script (`i18next-parser`), CI'da kontrol. RTL dil (Arapça vb.) ileride eklenebilsin diye CSS'te `margin-inline` gibi mantıksal özellikler kullanılır.

---

## 9. Proje Yapısı (öneri)

```
Rotacı/
├─ src-tauri/            # Rust: DB, dosya I/O, tile cache proxy, HTTP
├─ src/
│  ├─ app/               # layout, routing, tema
│  ├─ map/               # MapLibre kurulumu, katman kataloğu, çizim
│  ├─ routing/           # RoutingProvider arayüzü + valhalla/osrm adaptörleri, skorlayıcılar
│  ├─ trip/              # veri modeli, store, gün/span işlemleri
│  ├─ poi/               # POI kütüphanesi, arama, Overpass
│  ├─ io/                # gpx, kml, kmz, .rotaci
│  ├─ vehicles/
│  ├─ i18n/              # i18next kurulumu, dil keşfi (paketli + kullanıcı klasörü)
│  └─ ui/                # ortak bileşenler, tasarım sistemi
├─ locales/              # tr.json, en.json (paketli diller)
└─ plan.MD
```

### 9.1 Dağıtım
- Tauri bundler: Windows **MSI/NSIS**, macOS **DMG** (Intel + Apple Silicon), Linux **AppImage / .deb / .rpm**.
- GitHub Actions ile 3 platform otomatik build; GitHub Releases üzerinden dağıtım.
- Otomatik güncelleme: `tauri-plugin-updater` — kendi ücretsiz imza anahtarını kullanır (Apple/Microsoft sertifikası gerekmez).
- **Kod imzalama yok (bütçe ayrılmayacak):**
  - macOS: Tauri ad-hoc imza atar; kullanıcı ilk açılışta *Sağ tık → Aç* (veya Sistem Ayarları → Gizlilik → "Yine de aç") yapmalı. README'de ekran görüntülü anlatım.
  - Windows: SmartScreen "Ek bilgi → Yine de çalıştır". İndirme sayısı arttıkça uyarı azalır.
  - Linux: Sorun yok.
  - Uyarıları azaltan **ücretsiz kanallar**: Linux **Flathub**, Windows **winget** / **Scoop**, macOS **Homebrew cask**. Açık kaynak projeler için ücretsiz Windows imzalama programı (örn. SignPath Foundation) ileride başvurulabilir.
- Kullanıcı verisi tamamen yerel: platformun uygulama veri klasörü (`%APPDATA%`, `~/Library/Application Support`, `~/.local/share`). Yedekleme = veritabanı + `.rotaci` dışa aktarma.

---

## 10. Yol Haritası (Fazlar)

**Faz 0 — İskelet (Tamamlandı ✓)**
Tauri + React kurulum, SQLite, i18n altyapısı (TR/EN), tasarım sistemi, MapLibre + katman seçici (Harita/Arazi/Uydu), tile önbellek proxy'si, sağlayıcı/yedek (provider + fallback) soyutlaması, GitHub Actions 3 platform build.

**Faz 1 — Çekirdek planlama (Tamamlandı ✓)**
Seyahat CRUD, gün/span modeli, POI ekleme, Valhalla ile otomatik rota, manuel çizim, sürükle-bırak sıralama, otomatik kayıt, undo/redo.

**Faz 2 — Rota zekâsı & Hava durumu (Tamamlandı ✓)**
Taşıt profilleri (otomobil, motosiklet, karavan/truck, 4x4, bisiklet), ücretli/otoyol/feribot seçenekleri, asfalt/karma/offroad yüzey seçimi, yasak bölgeler (Valhalla bütçeli), alternatif rotalar (otoyollu/ücretsiz kıyaslamalı), viraj skorlaması (Kurviger stili) + OSM gerçek yüzey dağılımı (/trace_attributes), Valhalla DEM gerçek eğim profili (/height) + eğime göre rota seçimi (az yokuş, maks. eğim sınırı).
**Open-Meteo hava durumu entegrasyonu:** Rota boyu ETA ve kalkış saatine göre dinamik saatlik hesaplama, tarih aralığına duyarlı (tahmin/arşiv/iklim), harita hava rozetleri, zaman kaydırıcısı, şiddetli yan rüzgar/don/fırtına risk uyarıları. Harita sağ tık menüsü (rota ekleme, buradan başlama, POI ekleme, yasak alan oluşturma).

**Faz 3 — Veri alışverişi & Gelişmiş Entegrasyonlar (Sıradaki)**
GPX/KML/KMZ export & import (seyahat/gün/span), `.rotaci` dosya formatı, global POI kütüphanesi, Overpass koridor araması.

**Faz 4 — Dağıtım ve Yayın (1–2 hf)**
Dağıtım kanalları (Flathub, winget, Homebrew), ilk genel sürüm.

**Faz 5 — Gelişmiş (sonra)**
Zaman çizelgesi & konaklama planı, maliyet (yakıt/geçiş ücreti) tahmini, ek diller.

---

## 11. Riskler & Notlar

- **Public sunucu limitleri** (Valhalla FOSSGIS, OSM tile, Nominatim): önbellek, istek kısıtlama (throttle), doğru User-Agent; gerekirse yerel motor.
- **Offroad rotalama** OSM `surface`/`tracktype` etiketlerinin doluluğuna bağlı; bazı bölgelerde veri eksik olabilir. Public Valhalla'nın offroad esnekliği sınırlı → ileri kullanım için yerel GraphHopper (custom model) Faz 4'te.
- **Uydu kaynağı (Esri)** kullanım şartları dağıtım öncesi gözden geçirilmeli; toplu indirme yapılmamalı.
- Uzun rotalarda geometri boyutu → saklarken encoded polyline, gösterimde sadeleştirme.

---

## 12. Sorular

**Cevaplananlar:**
- ~~Kişisel mi / ticari mi?~~ → **Ücretsiz dağıtılacak.**
- ~~Bulut senkronizasyon?~~ → **Gerekmiyor**, tamamen yerel.
- ~~Arayüz dili?~~ → **Türkçe + İngilizce**, dinamik olarak yeni dil eklenebilir.
- ~~Tauri / Electron?~~ → **Tauri.**
- ~~Mobil?~~ → **Hedeflenmiyor.**
- ~~Offline harita?~~ → **İstenmiyor / İptal edildi.** Online tile önbellekleme ve standart web haritaları esas alındı.
- ~~Kaynak kodu & Lisans?~~ → **Açık kaynak (GPL-3.0).**
- ~~Kod imzalama bütçesi?~~ → **Yok**, imzasız dağıtım + ücretsiz kanallar.

**Açık soru kalmadı.** Temel mimari, gereksinimler ve yol haritası Faz 0 uygulamasına hazır.
