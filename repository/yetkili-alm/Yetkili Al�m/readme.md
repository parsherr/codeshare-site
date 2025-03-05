# Discord.js v14 Slashlı Moderasyon Botu


## Kurulum
1. **Ayarlar Dosyasını Düzenleyin:**
    - `ayarlar.json` dosyasını açın ve aşağıdaki alanları kendi bilgilerinizle doldurun:
    ```json
module.exports = {
    token: 'BURAYA BOTUNUZUN TOKENİNİ GİRİN', 
    sahipID: 'BURAYA İD NİZİ GİRİN',
  };
    ```
    
2. **Gerekli Paketleri Yükleyin:**
    - Proje dizininde terminali açın ve aşağıdaki komutu çalıştırın:
    ```bash
    npm i
    ```
3. **Soruları Ayarlayın**
    - Yektili alımda sorulacak soruları `sorular.js` dosyasına giriniz.
    ```json
module.exports = {
    soru1: 'YETKİLİ ALIMDA SORULCAK 1.SORU',
    soru2: 'YETKİLİ ALIMDA SORULCAK 2.SORU',
    soru3: 'YETKİLİ ALIMDA SORULCAK 3.SORU',
    soru4: 'YETKİLİ ALIMDA SORULCAK 4.SORU',
    soru5: 'YETKİLİ ALIMDA SORULCAK 5.SORU',
  };
    ```
3. **Botu Başlatın:**
    - `node .` ve ya `node index.js` komutunuz terminalde çalıştırın.
 
## Kullanım

`/yetkili-alim-ayarla` komutu ile yetkili alım mesajının nereye atılacağını,log kanalının nerede olacağını ve yetkili başvuru kabul edilirse hangi rolün verilceğini seçerek botu botu kullanabilirsiniz.

## Destek

Herhangi bir sorunla karşılaşırsanız veya yardım almak isterseniz, [benimle iletişime](https://discord.com/users/657241749579759616) geçebilirsiniz.


[![Discord Banner](https://api.weblutions.com/discord/invite/bdfd/)](https://discord.gg/bdfd)