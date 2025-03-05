const { Client, MessageEmbed } = require("discord.js");
const client = new Client();
const express = require("express");
const app = express();
const conf = require("./src/configs/config.json");
const settings = require("./src/configs/settings.json");
const colors = require("./src/configs/colors.json");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const ejs = require("ejs");
const flash = require('express-flash');
const path = require("path");
const passport = require("passport");
const { Strategy } = require("passport-discord");
const session = require("express-session");
const mongoose = require("mongoose");
const url = require("url");
const moment = require("moment");
const multer = require('multer');
const fs = require('fs');
const csurf = require('csurf');
const dotenv = require('dotenv').config();

moment.locale("tr");

// EJS motoru ve görüntü ayarları
app.engine(".ejs", ejs.__express);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));

// Statik dosya servisleri
app.use(express.static(path.join(__dirname, "/public")));
app.use(express.static(path.join(__dirname, "/src/public")));
app.use('/repository', express.static('repository'));

// Middleware'ler
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ limit: "50mb", extended: false }));
app.use(cookieParser());
app.use(flash());
app.use(
  session({
    secret: "secret-session-thing",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CSRF koruma middleware'i
const csrfProtection = csurf({ cookie: true });
app.use(csrfProtection);
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// MongoDB modeli
const User = require("./src/schemas/user");

// Passport yapılandırması
const scopes = ["identify", "guilds"];
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
  new Strategy(
    {
      clientID: settings.clientID,
      clientSecret: settings.secret,
      callbackURL: settings.callbackURL,
      scope: scopes,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ userID: profile.id });

// EĞER KULLANICI YOKSA YENİ KULLANICI OLUŞTUR
if (!user) {
  user = new User({
    userID: profile.id,
    about: profile.about || "",
    social: {
      personal: profile.personal || "",
      youtube: profile.youtube || "",
      twitter: profile.twitter || "",
      instagram: profile.instagram || "",
      github: profile.github || "",
    }
  });
} else {
  user.about = profile.about || user.about;
  user.social.personal = profile.personal || user.social.personal;
  user.social.youtube = profile.youtube || user.social.youtube;
  user.social.twitter = profile.twitter || user.social.twitter;
  user.social.instagram = profile.instagram || user.social.instagram;
  user.social.github = profile.github || user.social.github;
}

await user.save();
  return done(null, profile);
    } catch (err) {
  console.error(err);
  return done(err, null);
      }
    }
  )
);

// GENEL KONTROLLER TEK BİR FONKSİYONDA TOPLANDI ONU ÇAĞIRIYORUZ
const checkLogin = async (req, res, next) => {
  if (!req.user) {
    return error(res, 401, "Bu sayfaya girmek için giriş yapmalısınız!");
  }
  next();
};

const checkInGuild = async (req, res, next) => {
  if (!client.guilds.cache.get(conf.guildID).members.cache.has(req.user.id)) {
    return error(res, 138, "Bu sayfaya girmek için sunucumuza katılmalısınız!");
  }
  next();
}

mongoose.connect(settings.mongoURL, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useFindAndModify: false,
});

mongoose.connection.on("connected", () => {
  console.log("[DATABASE] Connected to DB");
});

mongoose.connection.on("error", () => {
  console.error("[DATABASE] Connection Error!");
});



// SADE GET METHODLARI
app.get("/login", passport.authenticate("discord", { scope: scopes }));
app.get("/callback", passport.authenticate("discord", { failureRedirect: "/error" }), (req, res) => res.redirect("/"));
app.get("/logout", (req, res) => { req.logOut(); return res.redirect("/"); });

app.get("/discord", (req, res) =>
  res.render("discord", {
    icon: client.guilds.cache.get(conf.guildID).iconURL({ dynamic: true }), conf,
  })
);

app.get("/faq", async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const user = req.user ? guild.members.cache.get(req.user.id) : null;

  res.render("faq", { user: req.user, icon: guild.iconURL({ dynamic: true }), reqMember: user });
});

app.get("/icerikler", async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const user = req.user ? guild.members.cache.get(req.user.id) : null;

  res.render("icerikler", { user: req.user, reqMember: user });
});

app.get("/boosterinfo", async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const user = req.user ? guild.members.cache.get(req.user.id) : null;

  res.render("boosterinfo", { user: req.user, icon: guild.iconURL({ dynamic: true }), reqMember: user });
});





app.get("/", csrfProtection, async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);

  if (!guild) {
    return res.status(500).send("Guild not found");
  }

  const parsher = guild.members.cache.filter((x) =>
    x.roles.cache.has(conf.parsher)
  );
  const owners = guild.members.cache.filter(
    (x) =>
      x.roles.cache.has(conf.ownerRole) && !parsher.some((b) => x.user.id === b.user.id)
  );
  const yonetim = guild.members.cache.filter(
    (x) =>
      x.roles.cache.has(conf.yonetim) &&
      !owners.some((b) => x.user.id === b.user.id) &&
      !parsher.some((b) => x.user.id === b.user.id)
  );
  const admins = guild.members.cache.filter(
    (x) =>
      x.roles.cache.has(conf.adminRole) &&
      !parsher.some((b) => x.user.id === b.user.id) &&
      !yonetim.some((b) => x.user.id === b.user.id) &&
      !owners.some((b) => x.user.id === b.user.id)
  );
  const codeSharer = guild.members.cache.filter(
    (x) =>
      x.roles.cache.has(conf.codeSharer) &&
      !parsher.some((b) => x.user.id === b.user.id) &&
      !yonetim.some((b) => x.user.id === b.user.id) &&
      !owners.some((b) => x.user.id === b.user.id) &&
      !admins.some((b) => x.user.id === b.user.id)
  );
  const booster = guild.members.cache.filter(
    (x) =>
      x.roles.cache.has(conf.booster) &&
      !codeSharer.some((b) => x.user.id === b.user.id) &&
      !yonetim.some((b) => x.user.id === b.user.id) &&
      !parsher.some((b) => x.user.id === b.user.id) &&
      !owners.some((b) => x.user.id === b.user.id) &&
      !admins.some((b) => x.user.id === b.user.id)
  );

  // Code verilerini alalım
  const codeData = require("./src/schemas/code");
  const code = await codeData.find({}).sort({ date: -1 });

  res.render("index", {
    user: req.user,
    icon: guild.iconURL({ dynamic: true }),
    parsher,
    owners,
    yonetim,
    admins,
    codeSharer,
    booster,
    reqMember: req.user
      ? guild.members.cache.get(req.user.id)
      : null,
    code, // Code verilerini ekleyelim
  });
});

app.get("/yetkililer", csrfProtection, async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const parsher = guild.members.cache.filter((x) =>
    x.roles.cache.has(conf.parsher)
  );
  const owners = guild.members.cache.filter(
    (x) =>
      x.roles.cache.has(conf.ownerRole) && !parsher.find((b) => x.user.id == b)
  );
  const yonetim = guild.members.cache.filter(
    (x) =>
      x.roles.cache.has(conf.yonetim) &&
      !owners.find((b) => x.user.id == b) &&
      !parsher.find((b) => x.user.id == b)
  );
  const admins = guild.members.cache.filter(
    (x) =>
      x.roles.cache.has(conf.adminRole) &&
      !yonetim.find((b) => x.user.id == b) &&
      !parsher.find((b) => x.user.id == b) &&
      !owners.find((b) => x.user.id == b)
  );
  const codeSharer = guild.members.cache.filter(
    (x) =>
      x.roles.cache.has(conf.codeSharer) &&
      !parsher.find((b) => x.user.id == b) &&
      !yonetim.find((b) => x.user.id == b) &&
      !owners.find((b) => x.user.id == b) &&
      !admins.find((b) => x.user.id == b)
  );
  const booster = guild.members.cache.filter(
    (x) =>
      x.roles.cache.has(conf.booster) &&
      !codeSharer.find((b) => x.user.id == b) &&
      !yonetim.find((b) => x.user.id == b) &&
      !parsher.find((b) => x.user.id == b) &&
      !owners.find((b) => x.user.id == b) &&
      !admins.find((b) => x.user.id == b)
  );
  res.render("yetkililer", {
    user: req.user,
    icon: guild.iconURL({ dynamic: true }),
    parsher,
    owners,
    yonetim,
    admins,
    codeSharer,
    booster,
    reqMember: req.user
      ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id)
      : null,
  });
});

app.get("/edit/:codeID", checkLogin, csrfProtection, async (req, res) => {
  const codeData = require("./src/schemas/code");
  const member = client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id);
  const code = await codeData.findOne({ id: req.params.codeID });
  if (!code) return error(res, 404, "Böyle bir kod bulunamadı!");
  if (!code.sharer || !member.hasPermission(8)) return error(res, 401, "Bu kodu düzenlemek için yetkiniz bulunmuyor!");


  res.render("editCode", { code, user: req.user, reqMember: req.user ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id) : null });
});

app.post("/edit/:codeID", checkLogin, csrfProtection, async (req, res) => {
  console.log(req.params);
  const { name, desc, modules, mainCode, command } = req.body;
  const codeData = require("./src/schemas/code");
  const member = client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id);
  const code = await codeData.findOne({ id: req.params.codeID });
  if (!code) return error(res, 404, "Böyle bir kod bulunamadı!");
  if (!code.sharer || !member.hasPermission(8)) return error(res, 401, "Bu kodu düzenlemek için yetkiniz bulunmuyor!");

  await codeData.findOneAndUpdate(
    { id: req.params.codeID },
    {
      $set: {
        name: name || code.name,
        desc: desc || code.desc,
        modules: modules || code.modules,
        mainCode: mainCode || code.mainCode,
        command: command || code.command,
      },
    }
  );

  req.flash("success", "Kod başarıyla güncellendi!");
  res.redirect(`/forum/${code.rank}/${req.params.codeID}`);
});

app.get("/profile/edit", checkLogin, csrfProtection, async (req, res) => {
  const userData = require("./src/schemas/user");
  let data = await userData.findOne({ userID: req.user.id });

  res.render("editProfile", {
    user: req.user,
    data: data ? data : {},
    reqMember: req.user
      ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id)
      : null,
  });
});

app.post("/profile/edit", checkLogin, csrfProtection, async (req, res) => {
  const { banner, about, personal, youtube, twitter, instagram, github } = req.body;
  const userData = require("./src/schemas/user");

  await userData.findOneAndUpdate(
    { userID: req.user.id },
    {
      $set: {
        banner: banner || '',
        about: about || '',
        'social.personal': personal || '',
        'social.youtube': youtube || '',
        'social.twitter': twitter || '',
        'social.instagram': instagram || '',
        'social.github': github || ''
      }
    },
    { new: true, upsert: true }
  );

  res.redirect(`/profile/${req.user.id}`);
});

app.get("/profile/:userID", checkLogin, csrfProtection, checkInGuild, async (req, res) => {
  const userID = req.params.userID;
  const guild = client.guilds.cache.get(conf.guildID);
  const member = guild.members.cache.get(userID);
  const codeData = require("./src/schemas/code");
  const codeComments = require("./src/schemas/code_comment")
  const usersLike = require("./src/schemas/users_like")
  const userData = require("./src/schemas/user");
  const usersRepository = require("./src/schemas/users_repository");

  const userRepo = await usersRepository.find({ userID });
  let profileUser = await userData.findOne({ userID });
  let data = await codeData.find({ sharer: userID });

  if (!profileUser) return error(res, 404, "Böyle bir kullanıcı site de bulunamadı!");

  const totalLikes = await usersLike.find({ userID })
  const totalComments = await codeComments.find({ userID })

  let auth;
  if (member.roles.cache.has(conf.ownerRole)) auth = "Kurucu";
  else if (member.roles.cache.has(conf.adminRole)) auth = "Yönetici";
  else if (member.roles.cache.has(conf.codeSharer)) auth = "Paylaşımcı";
  else if (member.roles.cache.has(conf.booster)) auth = "Booster";
  else auth = "Member";
  res.render("profile", {
    user: req.user,
    member,
    profileUser,
    icon: client.guilds.cache.get(conf.guildID).iconURL({ dynamic: true }),
    auth,
    color: member.displayHexColor,
    data: data ? data : {},
    totalLikes: totalLikes.length,
    userRepo,
    totalComments: totalComments.length,
    reqMember: req.user ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id) : null,
  });
});

app.get("/admin", checkLogin, csrfProtection, async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const member = guild.members.cache.get(req.user.id);
  if (!member.hasPermission(8)) return error(res, 401, "Bu sayfaya girmek için yetkin bulunmuyor!");
  const codeData = require("./src/schemas/code");
  const code = await codeData.find({}).sort({ date: -1 });
  res.render("admin", {
    user: req.user,
    reqMember: req.user ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id) : null,
    icon: client.guilds.cache.get(conf.guildID).iconURL({ dynamic: true }),
    code,
  });
});

app.get("/bug/:codeID", checkLogin, csrfProtection, checkInGuild, async (req, res) => {
  res.render("bug", {
    user: req.user,
    icon: client.guilds.cache.get(conf.guildID).iconURL({ dynamic: true }),
    reqMember: req.user ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id) : null,
    codeID: req.params.codeID
  });
});

app.get("/bug", checkLogin, csrfProtection, checkInGuild, async (req, res) => {
  res.render("bug", {
    user: req.user,
    icon: client.guilds.cache.get(conf.guildID).iconURL({ dynamic: true }),
    reqMember: req.user ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id) : null,
    codeID: req.params.codeID,

  });
});

app.post("/bug", checkLogin, csrfProtection, checkInGuild, async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const member = req.user ? guild.members.cache.get(req.user.id) : null;
  const codeData = require("./src/schemas/code");
  const code = await codeData.findOne({ id: req.body.id });
  if (!code) return error(res, 404, "Böyle bir kod bulunamadı!");


  if (code.bug && code.bug.length > 0) return error(res, 400, "Bu kod zaten bir bug bildirilmiş!");

  await codeData.findOneAndUpdate(
    {
      id: req
        .body.id
    },
    {
      $set: {
        bug: req.body.bug,
      },
    }
  );

  const channel = client.channels.cache.get(conf.bugLog);
  const embed = new MessageEmbed()
    .setAuthor(req.user.username, member.user.avatarURL({ dynamic: true }))
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setTitle("Bir bug bildirildi!")
    .setDescription(
      `
• Kod adı: [${req.body.name}](https://${conf.domain}/${req.body.rank}/${req.body.id})
• Bug bildiren: ${guild.members.cache.get(req.user.id).toString()}
• Bug: ${req.body.bug}
  `
    )
    .setColor("RED");
  try { channel.send(embed) } catch (err) { console.error('Discord mesajı gönderilirken hata oluştu:', err); }


  req.flash("success", "Bug başarıyla bildirildi!");
  res.redirect(`/`);
});

app.get("/share", csrfProtection, async (req, res) => {
  if (
    !req.user ||
    !client.guilds.cache.get(conf.guildID).members.cache.has(req.user.id)
  )
    return error(
      res,
      138,
      "Kod paylaşabilmek için Discord sunucumuza katılmanız ve siteye giriş yapmanız gerekmektedir."
    );
  res.render("shareCode", {
    user: req.user,
    icon: client.guilds.cache.get(conf.guildID).iconURL({ dynamic: true }),
    isStaff: client.guilds.cache
      .get(conf.guildID)
      .members.cache.get(req.user.id)
      .roles.cache.has(conf.codeSharer),
    reqMember: req.user
      ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id)
      : null,
  });
});

// EKLENEN VE DÜZENLENENENLER

app.post('/like', checkLogin, csrfProtection, async (req, res) => {
  const codeId = req.body.id;

  const codeData = require('./src/schemas/users_like');

  let userLikes = await codeData.findOne({ userID: req.user.id });

  if (!userLikes) {
    userLikes = new codeData({ userID: req.user.id, likes: [codeId], dislikes: [] });
  } else {
    const likeIndex = userLikes.likes.indexOf(codeId);
    const dislikeIndex = userLikes.dislikes.indexOf(codeId);

    if (likeIndex !== -1) {
      userLikes.likes.splice(likeIndex, 1);
      req.flash('success', 'Beğeniyi kaldırdınız!');
    } else {
      userLikes.likes.push(codeId);
      req.flash('success', 'Kodu beğendiniz!');

      if (dislikeIndex !== -1) {
        userLikes.dislikes.splice(dislikeIndex, 1);
      }
    }
  }

  await userLikes.save();
  res.redirect(`/forum/${req.body.rank}/${codeId}`);
});

//*
app.post('/dislike', checkLogin, csrfProtection, async (req, res) => {
  const codeId = req.body.id;
  const codeData = require('./src/schemas/users_like');

  let userLikes = await codeData.findOne({ userID: req.user.id });

  if (!userLikes) {
    userLikes = new codeData({ userID: req.user.id, dislikes: [codeId], likes: [] });
  } else {
    const dislikeIndex = userLikes.dislikes.indexOf(codeId);
    const likeIndex = userLikes.likes.indexOf(codeId);

    if (dislikeIndex !== -1) {
      userLikes.dislikes.splice(dislikeIndex, 1);
      req.flash('success', 'Beğenmemeyi kaldırdınız!');
    } else {
      userLikes.dislikes.push(codeId);
      req.flash('success', 'Kodu beğenmediniz!');
      if (likeIndex !== -1) {
        userLikes.likes.splice(likeIndex, 1);
      }
    }
  }

  await userLikes.save();
  res.redirect(`/forum/${req.body.rank}/${codeId}`);
});

app.post("/favourite", checkLogin, csrfProtection, async (req, res) => {
  const favouriteData = require("./src/schemas/users_favourite");
  const codeID = req.body.codeID;
  const favouriteRecord = await favouriteData.findOne({ userID: req.user.id });

  if (!favouriteRecord) {
    await new favouriteData({ userID: req.user.id, favourites: [codeID] }).save();
  } else {
    if (favouriteRecord.favourites.includes(codeID)) {
      favouriteRecord.favourites = favouriteRecord.favourites.filter(x => x !== codeID);
      req.flash("success", "Favorilerinizden kaldırıldı!");
    } else {
      favouriteRecord.favourites.push(codeID);
      req.flash("success", "Favorilerinize eklendi!");
    }
    await favouriteRecord.save();
  }

  res.redirect(`/forum/${req.body.rank}/${codeID}`);
});

app.get("/my-favourites", checkLogin, csrfProtection, async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const member = guild.members.cache.get(req.user.id);
  const codeData = require("./src/schemas/code");
  const repositoryData = require("./src/schemas/users_repository");
  const favouriteData = require("./src/schemas/users_favourite");
  const favouriteRepo = require("./src/schemas/users_repository_favourite");

  const favouriteRecord = await favouriteData.findOne({ userID: req.user.id });
  let favourites = [];

  const favouriteRecordRepo = await favouriteRepo.findOne({ userID: req.user.id });
  let favouritesRepo = [];

  if (favouriteRecord && favouriteRecord.favourites.length > 0) {
    const code = await codeData.find({});
    favourites = code.filter(x => favouriteRecord.favourites.includes(x.id));
  }

  if (favouriteRecordRepo && favouriteRecordRepo.favourites.length > 0) {
    const code = await repositoryData.find({});
    favouritesRepo = code.filter(x => favouriteRecordRepo.favourites.includes(x.name));
  }

  console.log(favouritesRepo);

  res.render("my-favourites", {
    user: req.user,
    icon: guild.iconURL({ dynamic: true }),
    codes: favourites,
    repos: favouritesRepo,
    guild,
    reqMember: member
  });
});

app.post("/delete-repository", checkLogin, csrfProtection, async (req, res) => {
  const repositoryData = require("./src/schemas/users_repository");
  const guild = client.guilds.cache.get(conf.guildID);
  const member = guild.members.cache.get(req.user.id);
  const repo = await repositoryData.findOne({ name: req.body.repoID });

  if (!repo) return error(res, 404, "Böyle bir repository bulunamadı!");
  if (repo.userID !== req.user.id && !member.permissions.has('ADMINISTRATOR')) return res.status(403).send("Bu repositoryi silemezsiniz!");


  await repo.deleteOne();
  fs.promises.rmdir(`repository/${req.body.repoID}`, { recursive: true });

  req.flash("success", "Repository başarıyla silindi!");

  res.redirect("/");
});


app.post("/add-favourite-repo", checkLogin, csrfProtection, async (req, res) => {
  const favouriteData = require("./src/schemas/users_repository_favourite");
  const codeID = req.body.repoID;
  const favouriteRecord = await favouriteData.findOne({ userID: req.user.id });
  console.log(req.body);

  if (!favouriteRecord) {
    await new favouriteData({ userID: req.user.id, favourites: [codeID] }).save();
  } else {
    if (favouriteRecord.favourites.includes(codeID)) {
      favouriteRecord.favourites = favouriteRecord.favourites.filter(x => x !== codeID);
      req.flash("success", "Favorilerinizden kaldırıldı!");
    } else {
      favouriteRecord.favourites.push(codeID);
      req.flash("success", "Favorilerinize eklendi!");
    }
    await favouriteRecord.save();
  }

  res.redirect(`/repository/${codeID}`);
});




app.post("/sharing", checkLogin, csrfProtection, checkInGuild, async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const member = guild.members.cache.get(req.user.id);
  const codeData = require("./src/schemas/code");

  if (conf.notCodeSharer.some(x => member.roles.cache.has(x) || member.user.id === x)) {
    req.flash("error", "Bu kodu paylaşma yetkiniz bulunmuyor!");
    return res.redirect("/");
  }

  const whenCreatedLast = await codeData.findOne({ sharer: req.user.id }).sort({ date: -1 });
  if (whenCreatedLast && Date.now() - whenCreatedLast.date < 1000 * 60 * 10) {
    req.flash("error", "Kod paylaşımı yapabilmek için en az 10 dakika beklemelisiniz!");
    return res.redirect("/");
  }

  const id = randomStr(8);
  const code = new codeData({
    id,
    name: req.body.name,
    desc: req.body.desc,
    modules: req.body.modules,
    mainCode: req.body.mainCode,
    command: req.body.command,
    rank: req.body.rank,
    sharer: req.user.id,
    date: Date.now(),
    bug: "",
  });
  await code.save();

  const colorMap = colors[code.rank];
  const channel = guild.channels.cache.get(conf.codeLog);
  const embed = new MessageEmbed()
    .setAuthor(req.user.username, member.user.avatarURL({ dynamic: true }))
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setTitle(`${code.rank} kategorisinde bir kod paylaşıldı!`)
    .setDescription(`
      • Kod adı: [${code.name}](https://${conf.domain}/${code.rank}/${id})
      • Kod Açıklaması: ${code.desc}
      • Kodu paylaşan: ${member.toString()}
    `)
    .setColor(colorMap[code.rank] || ""); // Default to an empty string if no color is found
  try { channel.send(embed) } catch (err) { console.error('Discord mesajı gönderilirken hata oluştu:', err); }


  req.flash("success", "Kod başarıyla paylaşıldı!");
  res.redirect(`/forum/${code.rank}/${id}`);
});


app.get("/code-view/:codeID", csrfProtection, async (req, res) => {
  const codeData = require("./src/schemas/code");
  const code = await codeData.findOne({ id: req.params.codeID });
  const data = await codeData.find({ rank: code.rank }).sort({ date: -1 });
  if (!code) return error(res, 404, "Böyle bir kod bulunamadı!");
  res.render("code-view", {
    user: req.user,
    icon: client.guilds.cache.get(conf.guildID).iconURL({ dynamic: true }),
    data,
    moment,
    rank: code.rank,
    guild: client.guilds.cache.get(conf.guildID),
    reqMember: req.user
      ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id)
      : null,

  });
});

app.get("/forum/:rank/:codeId", checkLogin, csrfProtection, async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const member = guild.members.cache.get(req.user.id);
  const codeData = require("./src/schemas/code");
  const usersLikeData = require("./src/schemas/users_like");
  const code_comments = require("./src/schemas/code_comment");
  const favouriteData = require("./src/schemas/users_favourite");
  const code = await codeData.findOne({ rank: req.params.rank, id: req.params.codeId });
  const comments = await code_comments.find({ codeID: req.params.codeId });
  if (!code) return error(res, 404, "Böyle bir kod bulunamadı!");

  const likedUsers = await usersLikeData.find({ likes: req.params.codeId });
  const dislikedUsers = await usersLikeData.find({ dislikes: req.params.codeId });
  const totalLikes = likedUsers.map(user => user.userID);
  const totalDislikes = dislikedUsers.map(user => user.userID);

  const favouriteRecord = await favouriteData.findOne({ userID: req.user.id });
  const IsInMyFavourite = favouriteRecord ? favouriteRecord.favourites?.includes(req.params.codeId) : false;

  res.render("code", {
    user: req.user,
    icon: guild.iconURL({ dynamic: true }),
    data: code,
    guild,
    reqMember: member,
    rank: code.rank,
    totalLikes: totalLikes,
    totalDislikes: totalDislikes,
    favourites: IsInMyFavourite,
    comments: comments || null
  });

});

app.get("/forum", checkLogin, csrfProtection, async (req, res) => {
  const codeData = require("./src/schemas/code");
  const code = await codeData.find({}).sort({ date: -1 });
  res.render("forum", {
    user: req.user,
    icon: client.guilds.cache.get(conf.guildID).iconURL({ dynamic: true }),
    data: code,
    reqMember: req.user ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id) : null,
  });
});


app.get("/forum/:rank", checkLogin, csrfProtection, async (req, res) => {
  const codeData = require("./src/schemas/code");
  const code = await codeData.find({ rank: req.params.rank }).sort({ date: -1 });

  res.render("rank", {
    user: req.user,
    icon: client.guilds.cache.get(conf.guildID).iconURL({ dynamic: true }),
    data: code,
    rank: req.params.rank,
    reqMember: req.user ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id) : null,
  });
});

app.post("/comment", checkLogin, csrfProtection, async (req, res) => {
  const code_comments = require("./src/schemas/code_comment");
  const codeData = require("./src/schemas/code");
  const code = await codeData.findOne({ id: req.body.codeID });

  if (!code) return error(res, 404, "Böyle bir kod bulunamadı!");

  const whenCreatedLast = await code_comments.findOne({ userID: req.user.id }).sort({ date: -1 });

  if (whenCreatedLast && Date.now() - whenCreatedLast.date < 1000 * 60 * 10) {
    req.flash("error", "Yorum yapabilmek için en az 1 dakika beklemelisiniz!");
    return res.redirect(`/forum/${code.rank}/${req.body.codeID}`);
  }

  code_comments.create({
    codeID: req.body.codeID,
    comment: req.body.comment,
    userID: req.user.id,
  });


  req.flash("success", "Yorumunuz başarıyla eklendi!");
  res.redirect(`/forum/${code.rank}/${req.body.codeID}`);
});

app.post("/delete-comment", checkLogin, csrfProtection, async (req, res) => {
  const code_comments = require("./src/schemas/code_comment");
  const repo_comments = require("./src/schemas/repository_comment");
  const guild = client.guilds.cache.get(conf.guildID);
  const member = guild.members.cache.get(req.user.id);

  if (req.body.type === "code") {
    const code = await code_comments.findOne({ _id: req.body.commentID });
    if (!code) return error(res, 404, "Böyle bir yorum bulunamadı!");
    if (code.userID !== req.user.id && !member.permissions.has('ADMINISTRATOR')) return res.status(403).send("Bu yorumu silemezsiniz!");

    await code.deleteOne();
    req.flash("success", "Yorum başarıyla silindi!");
    return res.redirect(`/forum/${req.body.rank}/${req.body.codeID}`);
  } else if (req.body.type === "repository") {
    const repo = await repo_comments.findOne({ _id: req.body.commentID });
    if (!repo) return error(res, 404, "Böyle bir yorum bulunamadı!");
    if (repo.userID !== req.user.id && !member.permissions.has('ADMINISTRATOR')) return res.status(403).send("Bu yorumu silemezsiniz!");

    await repo.deleteOne();
    req.flash("success", "Yorum başarıyla silindi!");
    return res.redirect(`/repository/${req.body.repoID}`);
  }
});

app.post("/delete-code", checkLogin, csrfProtection, async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const member = guild.members.cache.get(req.user.id);
  if (!member) {
    return error(res, 138, "Bu sayfaya girmek için sunucumuza katılmalısınız!");
  }

  const codeData = require("./src/schemas/code");
  const userData = require("./src/schemas/user");
  const code = await codeData.findOne({ id: req.body.codeID });

  if (!code) {
    return error(res, 404, req.body.codeID + " ID'li bir kod bulunmuyor!");
  }

  // Check if the member has administrative permissions or is the sharer of the code
  if (!member.permissions.has('ADMINISTRATOR') && !code.sharer.includes(req.user.id)) {
    return error(res, 401, "Bu sayfaya girmek için yetkiniz bulunmuyor!");
  }

  const channel = client.channels.cache.get(conf.codeLog);
  const embed = new MessageEmbed()
    .setAuthor(req.user.username, member.user.avatarURL({ dynamic: true }))
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setTitle(`${code.rank} kategorisinde bir kod silindi!`)
    .setDescription(`
      • Kod adı: ${code.name}
      • Kod Açıklaması: ${code.desc}
      • Kodu paylaşan: ${guild.members.cache.get(code.sharer)
        ? guild.members.cache.get(code.sharer).toString()
        : (await client.users.fetch(code.sharer)).username
      }
      • Kodu silen: ${member.toString()}
    `)
    .setColor("RED");
  try { channel.send(embed) } catch (err) { console.error('Discord mesajı gönderilirken hata oluştu:', err); }


  await code.deleteOne();
  req.flash("success", "Kod başarıyla silindi!");
  res.redirect("/");
});

app.get("/error", checkAuth, (req, res) => {
  res.render("error", {
    user: req.user,
    statuscode: req.query.statuscode,
    message: req.query.message,
    icon: client.guilds.cache.get(conf.guildID).iconURL({ dynamic: true }),
    reqMember: req.user ? client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id) : null,
  });
});

// REPOSİTORY YÜKLEME



const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './repository'); // Dosyanın yükleneceği klasör
  },
  filename: function (req, file, cb) {
    // Dosyanın adındaki boşlukları _ ile değiştirir ve küçük harfe çevirir ve içinde harf, rakam, nokta ve - dışındaki karakterleri siler
    cb(null, `${file.originalname.replace(/ /g, '_').toLowerCase().replace(/[^a-z0-9.-]/g, '')}`);
  }
});

const upload = multer({ storage: storage });

const { promisify } = require('util');
const unzipper = require('unzipper');
const unrar = require('node-unrar-js');

// Yardımcı fonksiyonlar
const createDirectory = async (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    await promisify(fs.mkdir)(dirPath, { recursive: true });
  }
};

// ZİP DOSYASINI ÇIKARMA
const extractZip = async (filePath, outputDir) => {
  await createDirectory(outputDir);
  return fs.createReadStream(filePath)
    .pipe(unzipper.Extract({ path: outputDir }))
    .promise();
};


// RAR DOSYASINI ÇIKARMA
const extractRar = async (filePath, outputDir) => {
  await createDirectory(outputDir);
  const extractor = unrar.createExtractorFromFile({ filepath: filePath, targetPath: outputDir });
  return extractor.extractAll();
};



// Dosya çıkarma işlemleri
const handleExtraction = async (filePath, reqBodyName) => {
  try {
    const fileExtension = path.extname(filePath).toLowerCase();
    const tempDir = path.join(__dirname, 'repository');
    await createDirectory(tempDir);

    const extractDir = path.join(tempDir, reqBodyName.replace(/ /g, '-'));

    if (fileExtension === '.zip') {
      await extractZip(filePath, extractDir);
    } else if (fileExtension === '.rar') {
      await extractRar(filePath, extractDir);
    } else {
      throw new Error('Unsupported file type');
    }

    const files = await fs.promises.readdir(extractDir);

    const targetDir = path.join(__dirname, 'repository', reqBodyName.replace(/ /g, '-'));
    await createDirectory(targetDir);

    for (const file of files) {
      const sourcePath = path.join(extractDir, file);
      const targetPath = path.join(targetDir, file.replace(/ /g, '-'));

      const stats = await fs.promises.stat(sourcePath);
      if (stats.isFile()) {
        await fs.promises.copyFile(sourcePath, targetPath);
      } else if (stats.isDirectory()) {
        await fs.promises.mkdir(targetPath, { recursive: true });
        await copyDirectory(sourcePath, targetPath);
      }
    }

    console("vay")
    console.log(extractDir);

    fs.rmdir(extractDir, { recursive: true, force: true });

  } catch (error) {

  }
};

const copyDirectory = async (source, target) => {
  const entries = await fs.promises.readdir(source, { withFileTypes: true });

  for (let entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name.replace(/ /g, '-'));

    if (entry.isDirectory()) {
      await fs.promises.mkdir(targetPath, { recursive: true });
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
};



// POST /upload route
app.post('/upload', checkLogin, csrfProtection, upload.single('file'), async (req, res) => {
  try {
    const usersRepo = require('./src/schemas/users_repository');
    const serveName = req.body.name.replace(/ /g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    // a-z A-Z 0-9 ve - dışındaki karakterleri req.flash ile hata veriyoruz
    if (serveName.length < 3 || serveName.length > 35 || !/^[a-zA-Z0-9-]+$/.test(serveName)) {
      req.flash('error', 'Repo adı en az 3 en fazla 35 karakter olabilir ve sadece harf, rakam ve - içerebilir!');
      return res.redirect('/share-repository');
    }

    // createdAt ile kullanıcının en son ne zaman oluşturduğunu alıp bugün ile çıkarıp 10 dakikadan küçükse hata ver şeklinde oluşturma süresi ypabilirsin
    // Eğer kullanıcıların direk repo yüklemesini sitemyiorsan yani yükledikten sonra onay ile yayınlamak istiyorsan bu kısmı yapabilirsin

    /*
    schema users_repository kısmında isVerified: { type: Boolean, default: false } gibi bir alan ekleyip
    burada da isVerified: false olanları gösterme şeklinde yapabilirsin
    daha sonra admin panel kısmında onaylama işlemi yapabilirsin
    */

    if (!req.file || !['.zip', '.rar'].includes(path.extname(req.file.originalname).toLowerCase())) {
      req.flash('error', 'Lütfen .zip veya .rar uzantılı bir dosya yükleyin!');
      return res.redirect('/share-repository');
    }

    const repo = await usersRepo.findOne({ name: serveName });
    if (repo) {
      req.flash('error', 'Bu isimde bir repo zaten var!');
      return res.redirect('/share-repository');
    }

    if (req.file.size > 1024 * 1024 * 10) {
      req.flash('error', 'Dosya boyutu 10mb\'dan büyük olamaz!');
      return res.redirect('/share-repository');
    }

    await handleExtraction(req.file.path, serveName);

    // Discord mesaj gönderme kısmı (değiştirilmedi)
    const guild = client.guilds.cache.get(conf.guildID);
    const member = guild.members.cache.get(req.user.id);
    const channel = guild.channels.cache.get(conf.codeLog);
    const embed = new MessageEmbed()
      .setAuthor(req.user.username, member.user.avatarURL({ dynamic: true }))
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addField("Yeni bir repo paylaşıldı!", `• Repo adı: ${serveName}\n• Repo açıklaması: ${req.body.description || "Yok"}\n• Repo paylaşan: ${member.toString()}`)
      .setColor("GREEN");
    try { channel.send(embed) } catch (err) { console.error('Discord mesajı gönderilirken hata oluştu:', err); }


    await new usersRepo({
      userID: req.user.id,
      pathName: serveName,
      name: serveName,
      description: req.body.description || ""
    }).save();

    res.redirect(`/repository/${serveName}`);
  } catch (err) {
    console.error('Dosya yüklenirken hata oluştu:', err);
    req.flash('error', 'Dosya yüklenirken hata oluştu!');
    res.redirect('/share-repository');
  }
});

app.get('/share-repository', checkLogin, csrfProtection, async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const member = guild.members.cache.get(req.user.id);

  res.render('share-repository', {
    user: req.user,
    icon: guild.iconURL({ dynamic: true }),
    reqMember: member
  });
});

app.get('/my-repository', checkLogin, async (req, res) => {
  const guild = client.guilds.cache.get(conf.guildID);
  const member = guild.members.cache.get(req.user.id);

  const usersRepo = require('./src/schemas/users_repository');
  const repos = await usersRepo.find({ userID: req.user.id });

  res.render('my-repositories', {
    user: req.user,
    icon: guild.iconURL({ dynamic: true }),
    repos,
    reqMember: member
  });
})

app.get('/repository/:repoName', checkLogin, csrfProtection, async (req, res) => {
  const Repository = require('./src/schemas/users_repository');
  const Comments = require('./src/schemas/repository_comment');
  const repo = await Repository.findOne({ name: req.params.repoName });
  const member = client.guilds.cache.get(conf.guildID).members.cache.get(req.user.id);
  const guild = client.guilds.cache.get(conf.guildID);
  const userFavourite = require('./src/schemas/users_repository_favourite');
  const comments = await Comments.find({ repoID: req.params.repoName });
  const isFavourite = await userFavourite.findOne({ userID: req.user.id })
  if (!repo) {
    return error(res, 404, "Repository not found");
  }

  const repoPath = path.join(__dirname, 'repository', repo.pathName);
  try {
    let directoryTree = getDirectoryTree(repoPath);

    normalizePaths(directoryTree, repo.pathName, repo.pathName.split('/'))

    res.render('repository', {
      directoryTree: directoryTree.children, repo, comments, repoUserName: client.users.cache.get(repo.userID).username, user: req.user || undefined, reqMember: member, guild, isFavourite: isFavourite ? isFavourite.favourites.includes(req.params.repoName) : false
    });
  } catch (err) {
    console.error('Error reading repository:', err);
    res.status(500).send('Error reading repository');
  }
});

app.post('/comment-repository', checkLogin, csrfProtection, async (req, res) => {
  const Comments = require('./src/schemas/repository_comment');
  const Repository = require('./src/schemas/users_repository');
  const repo = await Repository.findOne({ name: req.body.repoID });

  if (!repo) return error(res, 404, "Repository not found");

  // kendisi değilse 10 dakikada 1 yorum yapma
  if (repo.userID !== req.user.id) {
    if (repo.date < Date.now() - 1000 * 60 * 60 * 10) {
      return error(res, 400, "10 dakikada bir yorum yapabilirsiniz!");
    }
  }

  // discord mesaj gönderme
  const guild = client.guilds.cache.get(conf.guildID);
  const member = guild.members.cache.get(req.user.id);
  const channel = guild.channels.cache.get(conf.codeLog);
  const embed = new MessageEmbed()
    .setAuthor(req.user.username, member.user.avatarURL({ dynamic: true }))
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addField("Yeni bir yorum yapıldı!"
      , `• Repo adı: ${req.body.repoID}
• Yorum: ${req.body.comment}
• Yorum yapan: ${member.toString()}`
    )
    .setColor("GREEN");
  try { channel.send(embed) } catch (err) { console.error('Discord mesajı gönderilirken hata oluştu:', err); }


  await Comments.create({
    repoID: req.body.repoID,
    comment: req.body.comment,
    userID: req.user.id,
    date: Date.now()
  });

  req.flash('success', 'Yorum başarıyla eklendi!');
  res.redirect(`/repository/${req.body.repoID}`);
});


app.get('/view-file', async (req, res) => {
  try {
    let filePath = req.query.path.replace(/\\/g, '/');
    filePath = path.join(__dirname, 'repository', filePath);
    const fileContent = await getFileContent(filePath);
    res.send(fileContent);
  } catch (err) {
    console.error('Dosya okunurken hata oluştu:', err);
    res.status(500).send('Dosya okunurken hata oluştu');
  }
});

app.get('/search', (req, res) => {
  const code = require('./src/schemas/code');
  const repo = require('./src/schemas/users_repository');
  const searchQuery = req.query.search;
  const searchType = req.query.type;

  if (searchType === "code") {
    code.find({ name: { $regex: searchQuery, $options: 'i' } }, (err, codes) => {
      if (err) {
        console.log(err);
        return res.redirect('/home');
      }
      res.render('search', {
        query: searchQuery,
        type: searchType,
        total: codes.length,
        user: req?.user,
        codes: codes,
      });
    });
  } else if (searchType === "repo") {
    repo.find({ name: { $regex: searchQuery, $options: 'i' } }, (err, repos) => {
      if (err) {
        console.log(err);
        return res.redirect('/home');
      }
      res.render('search', {
        query: searchQuery,
        type: searchType,
        total: repos.length,
        user: req?.user,
        repos: repos,
        repo: repos,
      });
    });
  } else {
    req.flash('error', 'Invalid search type');
    res.redirect('/home');
  }
});

app.get('/download/:name', async (req, res) => {
  const usersRepo = require('./src/schemas/users_repository');
  const repo = await usersRepo.findOne({ name: req.params.name });

  if (!repo) {
    return error(res, 404, "Böyle bir repo bulunamadı!");
  }

  // zipe çevirme ve indirme 
  const filePath = path.join(__dirname, 'repository', repo.pathName);
  const output = fs.createWriteStream(path.join(__dirname, 'repository', `${repo.pathName}.zip`));
  const archive = archiver('zip', { zlib: { level: 9 } });


  res.download(filePath);
});

app.use((req, res) =>
  error(res, 404, "Sayfa bulunamadı Daha Sonra Tekrar Deneyiniz !")
);

const error = (res, statuscode, message) => {
  return res.redirect(
    url.format({ pathname: "/error", query: { statuscode, message } })
  );
};

const randomStr = (length) => {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};


function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/callback');
}

async function getFileContent(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}


function getDirectoryTree(dirPath) {
  const name = path.basename(dirPath);
  const item = { name, path: dirPath.replace(__dirname, '') };

  const stats = fs.statSync(dirPath);
  if (stats.isDirectory()) {
    item.type = 'directory';
    item.children = fs.readdirSync(dirPath).map(child =>
      getDirectoryTree(path.join(dirPath, child))
    );
  } else {
    item.type = 'file';
  }

  return item;
}

function normalizePaths(node, basePath, folderNameToRemove) {
  if (node.type === 'file' || node.type === 'directory') {
    node.path = path.join(basePath, node.name).replace(/\\/g, '/');
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => normalizePaths(child, node.path, folderNameToRemove));
    }
  }

  if (basePath.startsWith(`${folderNameToRemove}/`)) {
    node.path = node.path.replace(`/${folderNameToRemove}/`, '/');
  }
}

app.listen(process.env.PORT || 3000);
client.login(process.env.token);

client.on("ready", () => {
  console.log("BOT & Website Is Ready!");
  console.log(`http://localhost:${process.env.PORT || 3000}`);
});