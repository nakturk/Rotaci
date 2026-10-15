# Rotacı — Çok Günlü Seyahat ve Rota Planlayıcı 🏍️🚗

Rotacı, motosiklet ve otomobil seyahatleri için tasarlanmış; gerçek yol ağı geometrisi, çok günlü etap yönetimi, Open-Meteo hava durumu tahminleri, yükseklik grafikleri ve yasak bölge kaçınma özelliklerine sahip modern bir seyahat planlama uygulamasıdır.

Bu proje hem **Web uygulaması (React + Vite)** hem de **Tauri (Native Masaüstü uygulaması)** olarak çalışabilir.

---

## 🚀 1. Hızlı Başlangıç (Web Modu — Önerilen)

En hızlı ve kolay yöntemdir. Yalnızca **Node.js** gerektirir.

### Önkoşullar
- **Git**: [git-scm.com](https://git-scm.com/)
- **Node.js**: v18 veya v20+ LTS önerilir ([nodejs.org](https://nodejs.org/))

### Adımlar:
```bash
# 1. Projeyi klonlayın
git clone <GITHUB_REPO_URL>
cd Rotacı

# 2. Bağımlılıkları yükleyin
npm install

# 3. Geliştirici sunucusunu başlatın
npm run dev
```
Terminalde çıkan adrese tarayıcınızdan gidin: **`http://localhost:5173/`**

---

## 🖥️ 2. Masaüstü Uygulaması (Tauri Native Desktop)

Rotacı'yı bağımsız bir masaüstü penceresi (`.exe`, `.deb`, `.AppImage`) olarak kurmak ve çalıştırmak için:

### Sistem Gereksinimleri

#### 🐧 Linux (Ubuntu / Debian / Mint):
```bash
# Gerekli sistem paketlerini kurun:
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Rust kurulumu:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

#### 🪟 Windows:
1. **Rust**: [rustup.rs](https://rustup.rs/) üzerinden Windows yükleyicisini kurun.
2. **C++ Derleyicisi**: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) indirip *"Desktop development with C++"* seçeneğini işaretleyerek kurun.
3. **WebView2**: Windows 10/11'de varsayılan olarak yüklüdür.

---

### Masaüstü Komutları

```bash
# Geliştirici modunda masaüstü penceresinde başlatma:
npm run tauri dev

# Kurulum paketlerini (.exe / .msi / .deb / .AppImage) derleme:
npm run tauri build
```

Derlenen dosyaların konumu:
- **Windows:** `src-tauri/target/release/bundle/nsis/*.exe` veya `msi/*.msi`
- **Linux:** `src-tauri/target/release/bundle/appimage/*.AppImage` veya `deb/*.deb`

---

## 📦 Komutlar Özeti

| Komut | Açıklama |
|---|---|
| `npm run dev` | Web geliştirme sunucusunu başlatır (`localhost:5173`) |
| `npm run build` | Web üretim (production) paketini `dist/` klasörüne derler |
| `npm run preview` | Derlenmiş web paketini yerel olarak önizler |
| `npm run tauri dev` | Tauri masaüstü uygulamasını geliştirici modunda açar |
| `npm run tauri build` | İşletim sistemine özel yerel kurulum dosyalarını derler |
