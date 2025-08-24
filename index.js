const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');

function createFooter(guild, client) {
  return {
    text: guild?.name || client.user.username,
    iconURL: client.user.displayAvatarURL()
  };
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once('ready', () => {
  console.log(`Bot is online as ${client.user.tag}`);
  client.user.setActivity(config.gameActivity, { type: 0 });
});

// Register slash commands
const commands = [
  {
    name: 'ban',
    description: 'Ban a user',
    options: [
      { name: 'user', type: 6, description: 'User to ban', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false }
    ]
  },
  {
    name: 'kick',
    description: 'Kick a user',
    options: [
      { name: 'user', type: 6, description: 'User to kick', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false }
    ]
  },
  {
    name: 'warn',
    description: 'Warn a user',
    options: [
      { name: 'user', type: 6, description: 'User to warn', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false }
    ]
  },
  {
    name: 'mute',
    description: 'Mute a user',
    options: [
      { name: 'user', type: 6, description: 'User to mute', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false }
    ]
  },
  {
    name: 'tempmute',
    description: 'Temporarily mute a user',
    options: [
      { name: 'user', type: 6, description: 'User to mute', required: true },
      { name: 'duration', type: 3, description: 'Duration (e.g. 10m, 1h)', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false }
    ]
  },
  {
    name: 'unmute',
    description: 'Unmute a user',
    options: [
      { name: 'user', type: 6, description: 'User to unmute', required: true }
    ]
  },
  {
    name: 'verify-toggle',
    description: 'Enable or disable verification messages from the bot',
    options: [
      { name: 'enabled', type: 5, description: 'Enable (true) or disable (false)', required: true }
    ]
  },
  {
    name: 'addroleall',
    description: 'Add a role to all users in the server',
    options: [
      { name: 'role', type: 8, description: 'Role to add', required: true }
    ]
  }
];

// Helper to format messages from config
function formatMsg(template, vars) {
  return template.replace(/{(\w+)}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// Register commands on startup
client.once('ready', async () => {
  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, config.guildId),
    { body: commands }
  );
  console.log('Slash commands registered.');
});

// Load global verify preference
const verifyPrefsPath = './verify-prefs.json';
let verifyPrefs = { verify: true };
if (fs.existsSync(verifyPrefsPath)) {
  verifyPrefs = JSON.parse(fs.readFileSync(verifyPrefsPath, 'utf8'));
}

// Welcome message & verify prompt (embed)
client.on('guildMemberAdd', async member => {
  const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannel); // změna: podle ID
  if (welcomeChannel) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.welcome)
      .setTitle('👋 Welcome')
      .setDescription(`**Welcome to the ${member.guild.name}, <@${member.id}>! You are member #${member.guild.memberCount}.**`)
      .setTimestamp()
      .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() });
    welcomeChannel.send({ embeds: [embed] });
  }
  const verifyChannel = member.guild.channels.cache.get(config.verifyChannel); // změna: podle ID
  if (verifyChannel && verifyPrefs.verify) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.verify)
      .setDescription(formatMsg(config.messages.verify, { user: `<@${member.id}>` }));
    const msg = await verifyChannel.send({ embeds: [embed] });
    await msg.react('✅');
  }
});

// Verification system (embed DM)
client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.partial) await reaction.fetch();
  if (user.bot) return;
  if (reaction.message.channel.name !== config.verifyChannel) return;
  if (reaction.emoji.name === '✅') {
    const guild = reaction.message.guild;
    const member = guild.members.cache.get(user.id);
    const role = guild.roles.cache.get(config.verifyRole);
    if (role && member && !member.roles.cache.has(role.id)) {
      await member.roles.add(role);
      const embed = new EmbedBuilder()
        .setColor(config.embedColors.verify)
        .setDescription('You have been verified!');
      user.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

// Logging events
client.on('guildMemberAdd', member => {
  const channel = member.guild.channels.cache.find(ch => ch.name === config.logsChannel);
  if (channel) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.welcome)
      .setTitle('👋 Welcome')
      .setDescription(`**${formatMsg(config.messages.welcome, {
        user: member.user.tag,
        memberCount: member.guild.memberCount
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(member.guild, client));
    channel.send({ embeds: [embed] });
  }
});
client.on('guildMemberRemove', member => {
  const channel = member.guild.channels.cache.find(ch => ch.name === config.logsChannel);
  if (channel) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.welcome)
      .setTitle('🚪 Left')
      .setDescription(`**Left: ${member.user.tag}**`)
      .setTimestamp()
      .setFooter(createFooter(member.guild, client));
    channel.send({ embeds: [embed] });
  }
});
client.on('messageDelete', message => {
  const channel = message.guild.channels.cache.find(ch => ch.name === config.logsChannel);
  if (channel) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.messageDelete)
      .setTitle('🗑️ Message Deleted')
      .setDescription(`**${formatMsg(config.messages.messageDelete, {
        user: message.author.tag,
        content: message.content
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(message.guild, client));
    channel.send({ embeds: [embed] });
  }
});
client.on('messageUpdate', (oldMsg, newMsg) => {
  const channel = newMsg.guild.channels.cache.find(ch => ch.name === config.logsChannel);
  if (channel) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.messageEdit)
      .setTitle('✏️ Message Edited')
      .setDescription(`**${formatMsg(config.messages.messageEdit, {
        user: newMsg.author.tag,
        before: oldMsg.content,
        after: newMsg.content
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(newMsg.guild, client));
    channel.send({ embeds: [embed] });
  }
});

// Commands
client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith(config.prefix)) return;
  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // Admin-only command
  if (cmd === 'admin') {
    if (!message.member.roles.cache.has(config.adminRole)) {
      return message.reply('You do not have permission!');
    }
    return message.reply('Admin command executed.');
  }

  // Info command
  if (cmd === 'info') {
    return message.reply(`Server: ${message.guild.name}\nMembers: ${message.guild.memberCount}`);
  }

  // Role assignment command
  if (cmd === 'role') {
    const roleId = args[0];
    if (!config.roles.includes(roleId)) return message.reply('Invalid role.');
    const role = message.guild.roles.cache.get(roleId);
    if (!role) return message.reply('Role does not exist.');
    await message.member.roles.add(role);
    return message.reply(`Role has been added.`);
  }
});

// Slash command handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName, options, guild, member, user } = interaction;

  // Helper for logging
  const logAction = async (type, embed) => {
    const logChannelId = config.logChannels[type];
    if (!logChannelId) return;
    const logChannel = guild.channels.cache.get(logChannelId);
    if (logChannel) await logChannel.send({ embeds: [embed] });
  };

  if (commandName === 'ban') {
    if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: 'No permission.', ephemeral: true });
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason';
    const target = guild.members.cache.get(user.id);
    if (!target) return interaction.reply({ content: 'User not found.', ephemeral: true });

    // Nejprve pošli embed do logu a DM
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.ban)
      .setTitle('🚫 Ban')
      .setDescription(`**${formatMsg(config.messages.ban, { user: user.tag, reason })}**`)
      .setTimestamp()
      .setFooter(createFooter(guild, client));
    await logAction('ban', embed);

    const dmEmbed = new EmbedBuilder()
      .setColor(config.embedColors.ban)
      .setTitle('🚫 Ban Notification')
      .setDescription(`**${formatMsg(config.messages.dmBan, {
        server: guild.name,
        moderator: member.user.tag,
        reason,
        contact: config.contact
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(guild, client));
    await target.send({ embeds: [dmEmbed] }).catch(() => {});

    // Poté proveď ban
    await target.ban({ reason });

    return interaction.reply({ content: formatMsg(config.messages.ban, { user: user.tag, reason }), ephemeral: true });
  }

  if (commandName === 'kick') {
    if (!member.permissions.has(PermissionsBitField.Flags.KickMembers)) return interaction.reply({ content: 'No permission.', ephemeral: true });
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason';
    const target = guild.members.cache.get(user.id);
    if (!target) return interaction.reply({ content: 'User not found.', ephemeral: true });

    // Nejprve pošli embed do logu a DM
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.kick)
      .setTitle('👢 Kick')
      .setDescription(`**${formatMsg(config.messages.kick, { user: user.tag, reason })}**`)
      .setTimestamp()
      .setFooter(createFooter(guild, client));
    await logAction('kick', embed);

    const dmEmbed = new EmbedBuilder()
      .setColor(config.embedColors.kick)
      .setTitle('👢 Kick Notification')
      .setDescription(`**${formatMsg(config.messages.dmKick, {
        server: guild.name,
        moderator: member.user.tag,
        reason,
        contact: config.contact
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(guild, client));
    await target.send({ embeds: [dmEmbed] }).catch(() => {});

    // Poté proveď kick
    await target.kick(reason);

    return interaction.reply({ content: formatMsg(config.messages.kick, { user: user.tag, reason }), ephemeral: true });
  }

  if (commandName === 'warn') {
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason';
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.warn)
      .setTitle('⚠️ Warn')
      .setDescription(`**${formatMsg(config.messages.warn, { user: user.tag, reason })}**`)
      .setTimestamp()
      .setFooter(createFooter(guild, client));
    await logAction('warn', embed);

    const dmEmbed = new EmbedBuilder()
      .setColor(config.embedColors.warn)
      .setTitle('⚠️ Warn Notification')
      .setDescription(`**${formatMsg(config.messages.dmWarn, {
        server: guild.name,
        moderator: member.user.tag,
        reason,
        contact: config.contact
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(guild, client));
    await target.send({ embeds: [dmEmbed] }).catch(() => {});
    return interaction.reply({ content: formatMsg(config.messages.warn, { user: user.tag, reason }), ephemeral: true });
  }

  if (commandName === 'mute') {
    const user = options.getUser('user');
    const reason = options.getString('reason') || 'No reason';
    const target = guild.members.cache.get(user.id);
    if (!target) return interaction.reply({ content: 'User not found.', ephemeral: true });
    const muteRole = guild.roles.cache.get(config.muteRole);
    if (!muteRole) return interaction.reply({ content: 'Mute role does not exist.', ephemeral: true });
    await target.roles.add(muteRole);
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.mute)
      .setTitle('🔇 Mute')
      .setDescription(`**${formatMsg(config.messages.mute, { user: user.tag, reason })}**`)
      .setTimestamp()
      .setFooter(createFooter(guild, client));
    await logAction('mute', embed);

    const dmEmbed = new EmbedBuilder()
      .setColor(config.embedColors.mute)
      .setTitle('🔇 Mute Notification')
      .setDescription(`**${formatMsg(config.messages.dmMute, {
        server: guild.name,
        moderator: member.user.tag,
        reason,
        contact: config.contact
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(guild, client));
    await target.send({ embeds: [dmEmbed] }).catch(() => {});
    return interaction.reply({ content: formatMsg(config.messages.mute, { user: user.tag, reason }), ephemeral: true });
  }

  if (commandName === 'tempmute') {
    const user = options.getUser('user');
    const duration = options.getString('duration');
    const reason = options.getString('reason') || 'No reason';
    const target = guild.members.cache.get(user.id);
    if (!target) return interaction.reply({ content: 'User not found.', ephemeral: true });
    const muteRole = guild.roles.cache.get(config.muteRole);
    if (!muteRole) return interaction.reply({ content: 'Mute role does not exist.', ephemeral: true });
    await target.roles.add(muteRole);
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.tempmute)
      .setTitle('⏳ TempMute')
      .setDescription(`**${formatMsg(config.messages.tempmute, { user: user.tag, duration, reason })}**`)
      .setTimestamp()
      .setFooter(createFooter(guild, client));
    await logAction('tempmute', embed);

    const dmEmbed = new EmbedBuilder()
      .setColor(config.embedColors.tempmute)
      .setTitle('⏳ TempMute Notification')
      .setDescription(`**${formatMsg(config.messages.dmTempmute, {
        server: guild.name,
        moderator: member.user.tag,
        reason,
        duration,
        contact: config.contact
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(guild, client));
    await target.send({ embeds: [dmEmbed] }).catch(() => {});
    setTimeout(async () => {
      const unmuteEmbed = new EmbedBuilder()
        .setColor(config.embedColors.unmute)
        .setTitle('🔊 Unmute')
        .setDescription(`**${formatMsg(config.messages.unmute, { user: user.tag })}**`)
        .setTimestamp()
        .setFooter(createFooter(guild, client));
      await logAction('unmute', unmuteEmbed);
      await target.roles.remove(muteRole);
    }, ms(duration));
    return interaction.reply({ content: formatMsg(config.messages.tempmute, { user: user.tag, duration, reason }), ephemeral: true });
  }

  if (commandName === 'unmute') {
    const user = options.getUser('user');
    const target = guild.members.cache.get(user.id);
    if (!target) return interaction.reply({ content: 'User not found.', ephemeral: true });
    const muteRole = guild.roles.cache.get(config.muteRole);
    if (muteRole) await target.roles.remove(muteRole);
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.unmute)
      .setTitle('🔊 Unmute')
      .setDescription(`**${formatMsg(config.messages.unmute, { user: user.tag })}**`)
      .setTimestamp()
      .setFooter(createFooter(guild, client));
    await logAction('unmute', embed);
    return interaction.reply({ content: formatMsg(config.messages.unmute, { user: user.tag }), ephemeral: true });
  }

  if (commandName === 'verify-toggle') {
    const enabled = options.getBoolean('enabled');
    verifyPrefs.verify = enabled;
    fs.writeFileSync(verifyPrefsPath, JSON.stringify(verifyPrefs, null, 2));
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.verify)
      .setDescription(enabled
        ? 'Verification messages from the bot are now globally enabled. (verify = true)'
        : 'Verification messages from the bot are now globally disabled. (verify = false)');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (commandName === 'addroleall') {
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }
    const role = options.getRole('role');
    if (!role || !config.roles.includes(role.id)) {
      return interaction.reply({ content: 'Invalid role.', ephemeral: true });
    }
    let count = 0;
    await interaction.reply({ content: `Adding role <@&${role.id}> to all members...`, ephemeral: true });
    const members = await guild.members.fetch();
    for (const [, m] of members) {
      if (!m.user.bot && !m.roles.cache.has(role.id)) {
        await m.roles.add(role).catch(() => {});
        count++;
      }
    }
    return interaction.followUp({ content: `Role <@&${role.id}> added to ${count} members.`, ephemeral: true });
  }
});

// Helper for ms conversion
function ms(str) {
  // Simple ms parser: "10m" => 600000, "1h" => 3600000
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 0;
  const num = parseInt(match[1]);
  const unit = match[2];
  if (unit === 's') return num * 1000;
  if (unit === 'm') return num * 60 * 1000;
  if (unit === 'h') return num * 60 * 60 * 1000;
  if (unit === 'd') return num * 24 * 60 * 60 * 1000;
  return 0;
}

// VC events logging
client.on('voiceStateUpdate', (oldState, newState) => {
  const logChannelId = config.logChannels['voice'];
  if (!logChannelId) return;
  const logChannel = newState.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  // Join VC
  if (!oldState.channelId && newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.vcJoin)
      .setTitle('🎤 VC Join')
      .setDescription(`**${formatMsg(config.messages.vcJoin, {
        user: newState.member.user.tag,
        channel: newState.channel.name
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(newState.guild, client));
    logChannel.send({ embeds: [embed] });
  }
  // Leave VC
  else if (oldState.channelId && !newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.vcLeave)
      .setTitle('🚪 VC Leave')
      .setDescription(`**${formatMsg(config.messages.vcLeave, {
        user: oldState.member.user.tag,
        channel: oldState.channel.name
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(oldState.guild, client));
    logChannel.send({ embeds: [embed] });
  }
  // Move VC
  else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.vcMove)
      .setTitle('🔀 VC Move')
      .setDescription(`**${formatMsg(config.messages.vcMove, {
        user: newState.member.user.tag,
        oldChannel: oldState.channel.name,
        newChannel: newState.channel.name
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(newState.guild, client));
    logChannel.send({ embeds: [embed] });
  }
  // Disconnected by another user (kick from VC)
  if (oldState.channelId && !newState.channelId && oldState.disconnectReason === 'kick') {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.vcDisconnect)
      .setTitle('❌ VC Disconnect')
      .setDescription(`**${formatMsg(config.messages.vcDisconnect, {
        user: oldState.member.user.tag,
        channel: oldState.channel.name
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(oldState.guild, client));
    logChannel.send({ embeds: [embed] });
  }
});

// Logging for message edits/deletes (with log channel IDs)
client.on('messageDelete', message => {
  const logChannelId = config.logChannels['messageDelete'];
  if (!logChannelId) return;
  const logChannel = message.guild.channels.cache.get(logChannelId);
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.messageDelete)
      .setTitle('🗑️ Message Deleted')
      .setDescription(`**${formatMsg(config.messages.messageDelete, {
        user: message.author.tag,
        content: message.content
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(message.guild, client));
    logChannel.send({ embeds: [embed] });
  }
});
client.on('messageUpdate', (oldMsg, newMsg) => {
  const logChannelId = config.logChannels['messageEdit'];
  if (!logChannelId) return;
  const logChannel = newMsg.guild.channels.cache.get(logChannelId);
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColors.messageEdit)
      .setTitle('✏️ Message Edited')
      .setDescription(`**${formatMsg(config.messages.messageEdit, {
        user: newMsg.author.tag,
        before: oldMsg.content,
        after: newMsg.content
      })}**`)
      .setTimestamp()
      .setFooter(createFooter(newMsg.guild, client));
    logChannel.send({ embeds: [embed] });
  }
});

client.login(config.token);
