const { Schema, model } = require("mongoose");

const schema = Schema({
  name: { type: String, default: "" },
  id: { type: String, default: "" },
  sharer: { type: String, default: [] },
  desc: { type: String, default: "" },
  modules: { type: Array, default: [] },
  mainCode: { type: String, default: "" },
  command: { type: String, default: "" },
  rank: { type: String, default: "" },
  bug: { type: String, default: "" },
  date: { type: Number, default: Date },
});

module.exports = model("code", schema);