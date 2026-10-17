require("dotenv").config();

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("./config");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const DATA_DIR = path.join(__dirname, "data");
const SERVERCODE_FILE = path.join(DATA_DIR, "servercode.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SERVERCODE_FILE)) fs.writeFileSync(SERVERCODE_FILE, "{}");

function loadServerCodes() {
    try { return JSON.parse(fs.readFileSync(SERVERCODE_FILE, "utf8")); }
    catch { return {}; }
}
function saveServerCodes(data) { fs.writeFileSync(SERVERCODE_FILE, JSON.stringify(data, null, 2)); }
function getServerCode(guildId, server) { return loadServerCodes()[guildId]?.[server] || null; }
function setServerCode(guildId, server, code) {
    const data = loadServerCodes();
    if (!data[guildId] || typeof data[guildId] !== "object") data[guildId] = {};
    data[guildId][server] = code;
    saveServerCodes(data);
}

function isTeamverwaltung(member) {
    return member.roles.cache.has(config.TEAMVERWALTUNG) || member.roles.cache.has(config.DISCORD_INHABER);
}
function isDiscordInhaber(member) { return member.roles.cache.has(config.DISCORD_INHABER); }
function getRankIndex(member) { return config.TEAM_RANKS.findIndex(rank => member.roles.cache.has(rank.id)); }

// Automatisches Nametag-System: nutzt die höchstrangige Rolle, außer ausgeschlossene Rollen.
function getNametagFromRole(role) {
    if (!role) return null;
    const match = role.name.match(/^\[([^\]]+)\]/);
    return match ? `[${match[1]}]` : role.name;
}
function getNametagRole(member) {
    const excluded = new Set(config.NO_NAMETAG_ROLES || []);
    const roles = member.roles.cache
        .filter(role => role.id !== member.guild.id && !excluded.has(role.id))
        .sort((a, b) => b.position - a.position);
    return roles.first() || null;
}
async function updateNametag(member) {
    try {
        if (!member || member.user.bot || !member.manageable) return;
        const role = getNametagRole(member);
        const nickname = (role ? `${getNametagFromRole(role)} ✘ ${member.user.username}` : member.user.username).substring(0, 32);
        if (member.nickname !== nickname) await member.setNickname(nickname);
    } catch (error) {
        console.error("Nametag-Fehler:", error.message);
    }
}

// Rollen, die beim /bestanden passend zum Hauptrang vergeben werden.
function getRequiredAuxiliaryRoles(rankIndex) {
    const roles = [];
    if (rankIndex >= 0 && rankIndex <= 3) roles.push(config.AUXILIARY_ROLES.PROJEKTSPITZE);
    if (rankIndex >= 0 && rankIndex <= 10) roles.push(config.AUXILIARY_ROLES.TEAMVERWALTUNG);
    if (rankIndex >= 0 && rankIndex <= 15) roles.push(config.AUXILIARY_ROLES.LEITUNGSEBENE);
    if (rankIndex >= 0 && rankIndex <= 21) roles.push(config.AUXILIARY_ROLES.HIGHTEAM);
    if (rankIndex >= 0 && rankIndex <= 23) roles.push(config.AUXILIARY_ROLES.INGAME_RECHTE);
    if (rankIndex >= 22 && rankIndex <= 26) roles.push(config.AUXILIARY_ROLES.ADMIN_EBENE);
    if (rankIndex >= 27 && rankIndex <= 31) roles.push(config.AUXILIARY_ROLES.MODERATOR_EBENE);
    if (rankIndex >= 32 && rankIndex <= 35) roles.push(config.AUXILIARY_ROLES.SUPPORTER_EBENE);
    return roles.filter(Boolean);
}
async function removeAuxiliaryRoles(member) {
    const roleIds = Object.values(config.AUXILIARY_ROLES).filter(id => id && id !== config.AUXILIARY_ROLES.SERVER_TEAM);
    const removable = roleIds.filter(id => member.roles.cache.has(id));
    if (removable.length) await member.roles.remove(removable);
}
async function addRequiredAuxiliaryRoles(member, rankIndex) {
    const required = getRequiredAuxiliaryRoles(rankIndex);
    for (const roleId of required) {
        if (!member.roles.cache.has(roleId)) await member.roles.add(roleId);
    }
    return required;
}

function createRPEmbed(server, code, started) {
    const description = started
        ? `# 🎃 © Niedersachsen RP | ROLEPLAY\n\n🟢 **ROLEPLAY SERVER ${server} ERÖFFNET**\n\nDas Roleplay auf **Server ${server}** wurde offiziell gestartet!\n\n🛰️ **Servercode:** \`${code}\`\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n> 🔥 **DIE STADT LEBT. DEINE GESCHICHTE BEGINNT.**\n> Haltet euch an die Serverregeln und sorgt für faires Roleplay.`
        : `# 🎃 © Niedersachsen RP | ROLEPLAY\n\n🔴 **ROLEPLAY SERVER ${server} BEENDET**\n\nDas Roleplay auf **Server ${server}** wurde offiziell beendet.\n\n🛰️ **Servercode:** \`${code}\`\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n> ⚠️ **DIE STADT SCHLIESST IHRE TORE.**\n> Danke für eure Teilnahme. Beendet laufende RP-Situationen ordnungsgemäß.`;
    return new EmbedBuilder().setColor(started ? 0x2ecc71 : 0xe74c3c).setDescription(description).setTimestamp();
}

const commands = [
    new SlashCommandBuilder()
        .setName("bestanden").setDescription("Nimmt ein neues Teammitglied ins Team auf")
        .addUserOption(o => o.setName("user").setDescription("Teammitglied").setRequired(true))
        .addRoleOption(o => o.setName("rolle").setDescription("Teamrolle").setRequired(true))
        .addStringOption(o => o.setName("grund").setDescription("Grund").setRequired(true)),
    new SlashCommandBuilder()
        .setName("rp").setDescription("Startet oder beendet das Roleplay für einen der beiden Server")
        .addSubcommand(s => s.setName("start1").setDescription("Startet Roleplay auf Server 1"))
        .addSubcommand(s => s.setName("start2").setDescription("Startet Roleplay auf Server 2"))
        .addSubcommand(s => s.setName("stop").setDescription("Beendet Roleplay auf Server 1 oder 2")
            .addStringOption(o => o.setName("server").setDescription("Welcher Server soll beendet werden?").setRequired(true)
                .addChoices({ name: "Server 1", value: "1" }, { name: "Server 2", value: "2" }))),
    new SlashCommandBuilder()
        .setName("servercode").setDescription("Speichert und zeigt die Servercodes für beide Server")
        .addStringOption(o => o.setName("server1").setDescription("Servercode für Server 1").setRequired(true))
        .addStringOption(o => o.setName("server2").setDescription("Servercode für Server 2").setRequired(true))
].map(command => command.toJSON());

client.once("ready", async () => {
    console.log(`Niedersachsen RP Bot online als ${client.user.tag}`);
    try {
        const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationGuildCommands(client.user.id, config.GUILD_ID), { body: commands });
        console.log("Slash Commands registriert.");
    } catch (error) { console.error("Fehler beim Registrieren der Commands:", error); }

    // Beim Start Nametags für vorhandene Mitglieder aktualisieren.
    const guild = client.guilds.cache.get(config.GUILD_ID);
    if (guild) {
        try {
            const members = await guild.members.fetch();
            for (const member of members.values()) await updateNametag(member);
        } catch (error) { console.error("Nametags beim Start konnten nicht aktualisiert werden:", error.message); }
    }
});

client.on("guildMemberAdd", async member => updateNametag(member));
client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const oldRoles = oldMember.roles.cache.map(role => role.id).sort().join(",");
    const newRoles = newMember.roles.cache.map(role => role.id).sort().join(",");
    if (oldRoles !== newRoles) await updateNametag(newMember);
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    try {
        await interaction.deferReply({ ephemeral: false });
        if (!interaction.guild || !interaction.member) {
            return interaction.editReply({ content: "❌ Dieser Befehl kann nur auf einem Server verwendet werden." });
        }
        if (!isTeamverwaltung(interaction.member)) {
            return interaction.editReply({ content: "❌ Du benötigst die Rolle **Teamverwaltung** oder **Discord-Inhaber**." });
        }

        if (interaction.commandName === "servercode") {
            const code1 = interaction.options.getString("server1", true).trim();
            const code2 = interaction.options.getString("server2", true).trim();
            if (!code1 || !code2) {
                return interaction.editReply({ content: "❌ Bitte gib die Servercodes für **beide Server** ein." });
            }
            setServerCode(interaction.guild.id, "1", code1);
            setServerCode(interaction.guild.id, "2", code2);
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setDescription(
                    "# 🎃 © 𝙉𝙞𝙚𝙙𝙚𝙧𝙨𝙖𝙘𝙝𝙨𝙚𝙣 RP | SERVERCODE\n\n" +
                    "🛰️ **AKTUELLE SERVERCODES**\n\n" +
                    `🟢 **Server 1:** \`${code1}\`\n` +
                    `🟢 **Server 2:** \`${code2}\`\n` +
                    "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                    "🩸 **© 𝙉𝙞𝙚𝙙𝙚𝙧𝙨𝙖𝙘𝙝𝙨𝙚𝙣 RP** | *Die Stadt wartet auf dich.*"
                )
                .setTimestamp();
            return interaction.editReply({ content: "✅ Beide Servercodes wurden gespeichert.", embeds: [embed] });
        }

        if (interaction.commandName === "rp") {
            const subcommand = interaction.options.getSubcommand();
            let server;
            let started;
            if (subcommand === "start1") { server = "1"; started = true; }
            else if (subcommand === "start2") { server = "2"; started = true; }
            else { server = interaction.options.getString("server", true); started = false; }
            const code = getServerCode(interaction.guild.id, server);
            if (!code) return interaction.editReply({ content: `❌ Für **Server ${server}** wurde noch kein Servercode gespeichert. Nutze zuerst **/servercode**.` });
            await interaction.channel.send({ embeds: [createRPEmbed(server, code, started)] });
            return interaction.editReply({ content: started ? `✅ Roleplay auf Server ${server} wurde gestartet.` : `🔴 Roleplay auf Server ${server} wurde beendet.` });
        }

        if (interaction.commandName === "bestanden") {
            const targetUser = interaction.options.getUser("user", true);
            const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            const selectedRole = interaction.options.getRole("rolle", true);
            const reason = interaction.options.getString("grund", true);
            const executor = interaction.member;
            if (!target) return interaction.editReply({ content: "❌ Das Teammitglied wurde nicht gefunden." });
            if (target.user.bot) return interaction.editReply({ content: "❌ Bots können nicht ins Team aufgenommen werden." });

            const selectedIndex = config.TEAM_RANKS.findIndex(rank => rank.id === selectedRole.id);
            if (selectedIndex === -1) return interaction.editReply({ content: "❌ Diese Rolle ist keine gültige Team-Hauptrangrolle." });
            if (!isDiscordInhaber(executor)) {
                const executorIndex = getRankIndex(executor);
                if (executorIndex === -1) return interaction.editReply({ content: "❌ Du besitzt keinen gültigen Teamrang." });
                if (selectedIndex <= executorIndex) return interaction.editReply({ content: "❌ Du kannst deinen eigenen oder einen höheren Rang nicht vergeben." });
            }

            const oldRanks = config.TEAM_RANKS.map(rank => rank.id).filter(id => target.roles.cache.has(id));
            if (oldRanks.length) await target.roles.remove(oldRanks);
            await removeAuxiliaryRoles(target);
            if (config.BÜRGER && !target.roles.cache.has(config.BÜRGER)) await target.roles.add(config.BÜRGER);
            await target.roles.add(selectedRole.id);
            const requiredRoles = await addRequiredAuxiliaryRoles(target, selectedIndex);
            if (config.AUXILIARY_ROLES.SERVER_TEAM) await target.roles.add(config.AUXILIARY_ROLES.SERVER_TEAM);
            await updateNametag(target);

            const levelNames = requiredRoles.map(id => interaction.guild.roles.cache.get(id)?.name).filter(Boolean);
            const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle("✅ BESTANDEN")
                .setDescription(`**👤 Teammitglied**\n> ${target}\n\n**🎖️ Neue Rolle**\n> ${selectedRole.name}\n\n**🛡️ Nebenrollen**\n> ${levelNames.length ? levelNames.join(", ") : "Keine"}\n\n**📝 Grund**\n> ${reason}\n\n**👮 Ausgeführt von**\n> ${executor}`)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        return interaction.editReply({ content: "❌ Unbekannter Befehl." });
    } catch (error) {
        console.error("Command-Fehler:", error);
        try {
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: `❌ Fehler beim Ausführen: ${error.message}` });
            else await interaction.reply({ content: `❌ Fehler beim Ausführen: ${error.message}`, ephemeral: true });
        } catch {}
    }
});

if (!process.env.DISCORD_TOKEN) {
    console.error("❌ DISCORD_TOKEN fehlt in der .env!");
    process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);
