const { Schema, model } = require("mongoose");

const schema = Schema({
    userID: { type: String, default: "" },
    favourites: { type: Array, default: [] }
});

module.exports = model("users_repository_favourite", schema);