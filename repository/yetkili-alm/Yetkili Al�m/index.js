const { Client, Collection, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ayarlar = require('./ayarlar');
const sorular = require('./modules/sorular');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: ['CHANNEL'],
});

client.commands = new Collection();
const activeApplications = new Set();  


const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(__dirname, 'commands', file);
  const command = require(filePath);
  client.commands.set(command.data.name, command);
}

client.once('ready', async () => {
  console.log(`Bot başarıyla giriş yaptı: ${client.user.tag}`);
  console.log(`Sunucular: ${client.guilds.cache.size}`);
  console.log(`Kullanıcılar: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`);

  const commands = commandFiles.map(file => require(path.join(__dirname, 'commands', file)).data.toJSON());

  try {
    console.log('Slash komutları yükleniyor...');
    await client.application.commands.set(commands);
    console.log('Slash komutları başarıyla yüklendi.');
  } catch (error) {
    console.error('Komutlar yüklenirken bir hata oluştu:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand() && !interaction.isButton()) return;

  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    if (!ayarlar.sahipID.includes(interaction.user.id)) {
      return await interaction.reply({ content: 'Bu botun sahibi değilsin, bu komutu kullanamazsın.', ephemeral: true });
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error('Komut çalıştırılırken bir hata oluştu:', error);
      await interaction.reply({ content: 'Komut çalıştırılırken bir hata oluştu.', ephemeral: true });
    }
  } else if (interaction.isButton() && interaction.customId === 'basvuru_yap') {
    const userId = interaction.user.id;

    if (activeApplications.has(userId)) {
      return await interaction.reply({ content: '🚫 Zaten başvurun var.', ephemeral: true });
    }
    
    activeApplications.add(userId);
    let currentQuestion = 0;

    let dmChannel;
    try {
      dmChannel = await interaction.user.createDM();
      await interaction.user.send('📋 Yetkili başvurusu başlıyor. Lütfen aşağıdaki soruları cevaplayın.');
    } catch (error) {
      activeApplications.delete(userId);
      return await interaction.reply({ content: '🚫 DM kutunuz kapalı olduğu için başvuruya başlayamıyorsunuz.', ephemeral: true });
    }

    const sorularDizisi = [sorular.soru1, sorular.soru2, sorular.soru3, sorular.soru4, sorular.soru5];
    const cevaplar = [];

    const sendQuestion = async () => {
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📝 Yetkili Başvurusu')
        .setDescription(sorularDizisi[currentQuestion])
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('iptal_et')
            .setLabel('❌ İptal Et')
            .setStyle(ButtonStyle.Danger)
        );

      await dmChannel.send({ embeds: [embed], components: [row] });
    };

    sendQuestion();

    const filter = m => m.author.id === userId;
    const collector = dmChannel.createMessageCollector({ filter, time: 60000 });

    collector.on('collect', async m => {
      cevaplar.push({
        soru: sorularDizisi[currentQuestion],
        cevap: m.content,
      });
      currentQuestion++;
      if (currentQuestion < sorularDizisi.length) {
        sendQuestion();
      } else {
        collector.stop();
      }
    });

    collector.on('end', async collected => {
      if (currentQuestion < sorularDizisi.length && !activeApplications.has(userId)) {
        return dmChannel.send('⏰ Başvurunuz zaman aşımına uğradı.');
      }

      try {
        const logChannelFetched = await client.channels.fetch(client.logChannelId);
        const cevapEmbed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('📜 Yeni Yetkili Başvurusu')
          .setDescription(
            cevaplar.map(c => `**Soru:** ${c.soru}\n**Cevap:** ${c.cevap}`).join('\n\n')
          )
          .setFooter({ text: `UserID: ${userId} | LogChannelID: ${client.logChannelId} | BasvuruRoleID: ${client.basvuruRoleId}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('basvuru_kabul')
              .setLabel('✅ Kabul Et')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('basvuru_reddet')
              .setLabel('❌ Reddet')
              .setStyle(ButtonStyle.Danger)
          );

        await logChannelFetched.send({ embeds: [cevapEmbed], components: [row] });
        await dmChannel.send('📄 **Başvurunuz Tamamlandı!** Başvurunuz İncelemeye alınmıştır. Lütfen bu konuda sabırlı olunuz.').then(() => {
          activeApplications.delete(userId); 
        });
      } catch (error) {
        console.error('Log kanalı gönderilirken bir hata oluştu:', error);
      }
    });
  } else if (interaction.isButton()) {
    const handleButtonInteraction = async () => {
      const footerText = interaction.message.embeds[0]?.footer?.text;
      if (!footerText) {
        console.error('Kullanıcı kimliği bulunamadı.');
        return await interaction.reply({ content: '🚫 Footer alanında bilgi eksik, lütfen bir yetkiliye başvurun.', ephemeral: true });
      }

      const userIdMatch = footerText.match(/UserID: (\d+)/);
      const logChannelIdMatch = footerText.match(/LogChannelID: (\d+)/);
      const basvuruRoleIdMatch = footerText.match(/BasvuruRoleID: (\d+)/);

      if (!userIdMatch || !userIdMatch[1] || !logChannelIdMatch || !basvuruRoleIdMatch || !logChannelIdMatch[1] || !basvuruRoleIdMatch[1]) {
        console.error('Footer alanında kullanıcı kimliği veya diğer ID\'ler doğru formatta değil.');
        return await interaction.reply({ content: '⚠️ Footer formatında hata bulunmaktadır, lütfen bir yetkiliye başvurun.', ephemeral: true });
      }

      const userId = userIdMatch[1];
      const logChannelId = logChannelIdMatch[1];
      const basvuruRoleId = basvuruRoleIdMatch[1];

      const user = await client.users.fetch(userId).catch(() => null);

      if (!user) {
        console.error('Kullanıcı bulunamadı veya geçersiz ID.');
        return await interaction.reply({ content: '🚫 Kullanıcı bulunamadı veya geçersiz ID.', ephemeral: true });
      }

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: '🚫 Bu butonu kullanmak için yeterli yetkiniz yok.', ephemeral: true });
      }

      const embed = new EmbedBuilder().setDescription(interaction.message.embeds[0].description);

      if (interaction.customId === 'basvuru_kabul') {
        const guildMember = await interaction.guild.members.fetch(user.id).catch(console.error);
        if (guildMember) {
          await guildMember.roles.add(basvuruRoleId).catch(console.error);

          const kabulEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🥳 Başvurun Kabul Edildi')
            .setDescription('🔰 Yetkili Başvurun başarılı bir şekilde kabul edildi! Tebrikler!')
            .setFooter({ text: `${user.tag}`, iconURL: user.displayAvatarURL() })
            .setTimestamp();

          await user.send({ embeds: [kabulEmbed] }).catch(console.error);
          await interaction.update({
            content: 'Başvuru kabul edildi ve rol verildi.',
            embeds: [embed.setColor('#00ff00')],
            components: []
          }).catch(console.error);
        }
      } else if (interaction.customId === 'basvuru_reddet') {
        const redEmbed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('😞 Başvurun Reddedildi')
          .setDescription('🔰 Maalesef Yetkili Başvurun kabul edilmedi.')
          .setFooter({ text: `${user.tag}`, iconURL: user.displayAvatarURL() })
          .setTimestamp();

        await user.send({ embeds: [redEmbed] }).catch(console.error);
        await interaction.update({
          content: 'Başvuru reddedildi.',
          embeds: [embed.setColor('#ff0000')],
          components: []
        }).catch(console.error);
      }
    };

    if (interaction.customId === 'iptal_et') {
      const userId = interaction.user.id;
      activeApplications.delete(userId);  
      await interaction.reply({ content: 'Başvurunuz iptal edildi.', ephemeral: true });
    } else {
      await handleButtonInteraction();
    }
  }
});

client.login(ayarlar.token);