const { Schema, model } = require("mongoose");

const schema = Schema({
  userID: { type: String, default: "" },
  banner: { type: String, default: "" },
  about: { type: String, default: "" },
  social: {
    personal : { type: String, default: "" },
    youtube: { type: String, default: "" },
    twitter: { type: String, default: "" },
    instagram: { type: String, default: "" },
    github: { type: String, default: "" }
  }
});

module.exports = model("user", schema);