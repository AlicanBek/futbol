# Futbol

Telefonun ana ekranına eklenebilen kişisel bir futbol sayfası. Galatasaray ağırlıklı:

- **GS:** sıradaki maç ve geri sayım, puan durumu, önümüzdeki 2 haftanın maçları, sezonun kalanı, gündem
- **Maçlar:** Fenerbahçe, Beşiktaş, Trabzonspor ve Şampiyonlar Ligi'nin 2 haftalık programı
- **Tablolar:** Süper Lig, Şampiyonlar Ligi, Avrupa Ligi, Konferans Ligi; takıma dokununca maçları

Saatler Lizbon ve İstanbul saatiyle gösterilir.

## Veri

| Dosya | Kaynak | Güncelleme |
|---|---|---|
| `data/espn.json` | ESPN'in herkese açık verisi (puan tabloları, fikstür, skorlar) | Her gün GitHub Actions (`scripts/fetch_espn.py`) |
| `data/extras.json` | TV kanalları, Türkiye Kupası, GS gündemi | Her gün web araştırmasıyla (`scripts/extras.py`) |

Bu site herhangi bir kulüp, lig ya da yayıncıyla bağlantılı değildir. Kulüp logoları ESPN'den yüklenir.

## Yerelde çalıştırma

```bash
python3 scripts/fetch_espn.py
python3 -m http.server 8000
```

Sonra `http://localhost:8000` adresini aç.

## Telefona ekleme

iPhone'da sayfayı Safari'de aç, Paylaş > Ana Ekrana Ekle.
