const { Schema, model } = require("mongoose");

const schema = Schema({
  userID: { type: String, default: "" },
  pathName: { type: String, default: "" },
  name: { type: String, default: "" },
  description: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = model("users_repository", schema);