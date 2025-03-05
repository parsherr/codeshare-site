const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yetkili-alim-ayarla')
    .setDescription('Yetkili alımını başlat.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option => option.setName('basvuru-kanali')
      .setDescription('Başvuru mesajının gönderileceği kanal')
      .setRequired(true))
    .addChannelOption(option => option.setName('log-kanali')
      .setDescription('Başvuruların loglanacağı kanal')
      .setRequired(true))
    .addRoleOption(option => option.setName('rol')
      .setDescription('Başvuru kabul edildiğinde verilecek rol')
      .setRequired(true)),
  async execute(interaction, client) {
    const basvuruKanali = interaction.options.getChannel('basvuru-kanali');
    const logKanali = interaction.options.getChannel('log-kanali');
    const rol = interaction.options.getRole('rol');

    
    client.logChannelId = logKanali.id;
    client.basvuruRoleId = rol.id;

    await basvuruKanali.send({
      content: '✉️ Yetkili Başvurusu yapmak için butona tıklayın.',
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('basvuru_yap')
            .setLabel('Başvuru Yap')
            .setStyle(ButtonStyle.Success)
        )
      ]
    });

    await interaction.reply({ content: '📬 Başvuru mesajı gönderildi ve kanallar ayarlandı.', ephemeral: true });
  }
};