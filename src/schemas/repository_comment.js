const { Schema, model } = require('mongoose');

const schema = Schema({
    userID: { type: String, default: "" }, // Yorumu yapan kullanıcının ID'si
    repoID: { type: String, default: "" }, // Yorum yapılan kodun ID'si
    comment: { type: String, required: true }, // Yorum içeriği
    date: { type: Date, default: Date.now } // Yorumun yapıldığı tarih, varsayılan olarak şu anki tarih
});

module.exports = model('repository_comment', schema);
