# IELTS Koç — Telefona kurulum

Uygulama bir **PWA** (web uygulaması). Play Store'dan indirilmez; bir kez internet adresinden açılır,
sonra **ana ekrana eklenir** ve normal bir uygulama gibi, internetsiz de çalışır.

VS Code yalnızca dosyaları görmek ve düzenlemek için bir editördür; uygulamayı telefona o yüklemez.
Telefonun uygulamayı açabilmesi için dosyaların ücretsiz bir HTTPS adresinde yayınlanması gerekir.
Aşağıda GitHub Pages ile nasıl yapılacağı anlatılıyor (bir kez yapılır, ~10 dk).

## 1. Dosyaları yayınla (bilgisayarda, bir kez)

1. **github.com** adresine git ve ücretsiz bir hesap aç (bu adımı sen yapmalısın).
2. Sağ üstte **+ → New repository**.
   - Repository name: `ielts-koc`
   - **Public** seç (ücretsiz GitHub Pages için gerekli; ilerleme verilerin yine yalnızca telefonunda kalır).
   - **Create repository**.
3. Açılan sayfada **"uploading an existing file"** bağlantısına tıkla.
4. `ielts-app` klasörünün **içindekileri** (index.html, sw.js, manifest.webmanifest, css, js, content, icons)
   sürükleyip bırak. Dikkat: klasörün kendisini değil, içini sürükle; `index.html` en üst seviyede olmalı.
5. Aşağıdaki **Commit changes** butonuna bas.
6. **Settings → Pages** bölümüne git:
   - Source: **Deploy from a branch**
   - Branch: **main**, klasör: **/ (root)** → **Save**.
7. 1–2 dakika bekle. Sayfanın üstünde adresin görünecek:
   `https://KULLANICI-ADIN.github.io/ielts-koc/`

## 2. Telefona ekle (Android + Chrome)

1. Telefonda **Chrome** ile yukarıdaki adresi aç.
2. Profilini kaydet. Ekranda **"Ana ekrana ekle"** kartı çıkarsa **Ekle**'ye bas.
   Çıkmazsa: sağ üstteki **⋮ → Uygulamayı yükle** (veya **Ana ekrana ekle**) → **Yükle**.
3. Ana ekranda **IELTS Koç** simgesi belirecek. Bundan sonra hep oradan aç.

## 3. Çalıştığını kontrol et ("bitti" koşulları)

- [ ] Simgeden açılınca tarayıcı çubuğu olmadan tam ekran açılıyor.
- [ ] **Uçak modunu aç**, uygulamayı kapatıp tekrar aç: açılıyor ve kelime kartları çalışıyor.
- [ ] Birkaç kart çöz, uygulamayı tamamen kapat, tekrar aç: ilerleme duruyor.
- [ ] Ben → Ayarlar → **Yedeği indir** ile dosya iniyor; **Yedekten geri yükle** ile geri geliyor.
- [ ] Ayarlar → **Sesi dene**: İngilizce okuma sesi duyuluyor.

İnternetsiz ses için: Android **Ayarlar → Sistem → Diller → Metin okuma çıkışı → Google → İngilizce (UK/US/Avustralya) seslerini indir.**

## 4. Güncelleme (yeni aşamalar geldiğinde)

1. Değişen dosyaları GitHub'da aynı şekilde tekrar yükle (üzerine yazar).
2. `sw.js` içindeki `VERSION` numarası her güncellemede artırılır (ben yaparım).
3. Telefonda uygulamayı açınca altta **"Yeni sürüm hazır → Yenile"** çıkar; bas, güncellenir.
   İlerlemen silinmez.

## Dosya yapısı

```
index.html             tek sayfa
manifest.webmanifest   ana ekrana ekleme bilgileri
sw.js                  internetsiz çalışma (önbellek)
css/app.css            tasarım, açık/koyu tema
js/app.js              ekranlar arası geçiş
js/db.js               cihazda kalıcı kayıt (IndexedDB), yedekleme
js/srs.js              aralıklı tekrar (SM-2)
js/planner.js          günlük görevler, seri, istatistik
js/scoring.js          band hesaplama ve yuvarlama
js/screens/*.js        ekranlar
content/index.json     içerik listesi
content/vocab/*.json   kelime setleri
content/grammar/*.json gramer dersleri
```

Yeni kelime seti eklemek için: `content/vocab/` içine aynı yapıda bir JSON dosyası koy,
`content/index.json` içindeki `vocab` listesine bir satır ekle.
