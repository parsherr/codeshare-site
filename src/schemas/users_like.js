const { Schema, model } = require("mongoose");

const schema = Schema({
    userID: { type: String, default: "" },
    likes: { type: Array, default: [] },
    dislikes: { type: Array, default: [] }
});

module.exports = model("users_like", schema);