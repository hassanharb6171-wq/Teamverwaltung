require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    SlashCommandBuilder,
    REST,
    Routes
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const config = require("./config");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.GuildMember]
});

const DATA_DIR = path.join(__dirname, "data");
const WARN_FILE = path.join(DATA_DIR, "teamwarns.json");
const TEAMLIST_FILE = path.join(DATA_DIR, "teamliste.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(WARN_FILE)) {
    fs.writeFileSync(WARN_FILE, "{}");
}

if (!fs.existsSync(TEAMLIST_FILE)) {
    fs.writeFileSync(TEAMLIST_FILE, "{}");
}

/* =========================================================
   DATEN
========================================================= */

function loadWarns() {
    try {
        return JSON.parse(fs.readFileSync(WARN_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveWarns(data) {
    fs.writeFileSync(
        WARN_FILE,
        JSON.stringify(data, null, 2)
    );
}

function loadTeamliste() {
    try {
        return JSON.parse(fs.readFileSync(TEAMLIST_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveTeamliste(data) {
    fs.writeFileSync(
        TEAMLIST_FILE,
        JSON.stringify(data, null, 2)
    );
}

/* =========================================================
   RÄNGE
========================================================= */

function getRankIndex(member) {
    return config.TEAM_RANKS.findIndex(rank =>
        member.roles.cache.has(rank.id)
    );
}

function getRank(member) {
    const index = getRankIndex(member);

    if (index === -1) {
        return null;
    }

    return config.TEAM_RANKS[index];
}

/* =========================================================
   BERECHTIGUNGEN
========================================================= */

function isTeamverwaltung(member) {
    return member.roles.cache.has(
        config.TEAMVERWALTUNG
    );
}

function isDiscordInhaber(member) {
    return member.roles.cache.has(
        config.DISCORD_INHABER
    );
}

function canManageTarget(executor, target) {
    if (executor.id === target.id) {
        return {
            allowed: false,
            reason:
                "❌ Du kannst diesen Command nicht auf dich selbst anwenden."
        };
    }

    if (isDiscordInhaber(executor)) {
        return {
            allowed: true
        };
    }

    const executorIndex = getRankIndex(executor);
    const targetIndex = getRankIndex(target);

    if (targetIndex === -1) {
        return {
            allowed: true
        };
    }

    if (
        executorIndex === -1 ||
        targetIndex <= executorIndex
    ) {
        return {
            allowed: false,
            reason:
                "❌ Du kannst keinen gleich hohen oder höheren Teamrang bearbeiten."
        };
    }

    return {
        allowed: true
    };
}

/* =========================================================
   NAMETAGS
========================================================= */

function getNametagFromRole(role) {
    if (!role) {
        return null;
    }

    const match = role.name.match(/^\[([^\]]+)\]/);

    if (match) {
        return `[${match[1]}]`;
    }

    return role.name;
}

function getNametagRole(member) {
    const excluded = new Set(
        config.NO_NAMETAG_ROLES || []
    );

    /*
        Partner
    */

    const partnerRole = member.guild.roles.cache.find(
        role =>
            role.name.toLowerCase() === "partner"
    );

    if (
        partnerRole &&
        member.roles.cache.has(partnerRole.id)
    ) {
        return partnerRole;
    }

    /*
        Höchster Teamrang zuerst
    */

    for (const rank of config.TEAM_RANKS) {
        if (
            member.roles.cache.has(rank.id) &&
            !excluded.has(rank.id)
        ) {
            return member.guild.roles.cache.get(rank.id);
        }
    }

    /*
        Bürger
    */

    if (
        member.roles.cache.has(config.BÜRGER) &&
        !excluded.has(config.BÜRGER)
    ) {
        return member.guild.roles.cache.get(
            config.BÜRGER
        );
    }

    return null;
}

async function updateNametag(member) {
    try {
        if (!member || member.user.bot) {
            return;
        }

        if (!member.manageable) {
            return;
        }

        const role = getNametagRole(member);

        let nickname;

        if (!role) {
            nickname = member.user.username;
        } else {
            const tag = getNametagFromRole(role);

            nickname =
                `${tag} ✘ ${member.user.username}`;
        }

        if (nickname.length > 32) {
            nickname = nickname.substring(0, 32);
        }

        if (member.nickname !== nickname) {
            await member.setNickname(nickname);
        }
    } catch (error) {
        console.error(
            `Nametag Fehler bei ${member.user.tag}:`,
            error.message
        );
    }
}

/* =========================================================
   EBENENLOGIK
========================================================= */

/*
    CUMULATIVE EBENEN

    Co.Owner und höher
    -> Projektspitze

    Teamleitung und höher
    -> Teamverwaltung

    Supportleitung und höher
    -> Leitungsebene

    Fraktions verwaltung und höher
    -> HighTeam

    Sr.Admin und höher
    -> Ingame Rechte

    Test admin und höher
    -> Admin Ebene

    Test moderator und höher
    -> Moderator Ebene

    Test Supporter und höher
    -> Supporter Ebene
*/

function getRequiredAuxiliaryRoles(rankIndex) {
    const roles = [];

    if (rankIndex <= 3) {
        roles.push(
            config.AUXILIARY_ROLES.PROJEKTSPITZE
        );
    }

    if (rankIndex <= 10) {
        roles.push(
            config.AUXILIARY_ROLES.TEAMVERWALTUNG
        );
    }

    if (rankIndex <= 15) {
        roles.push(
            config.AUXILIARY_ROLES.LEITUNGSEBENE
        );
    }

    if (rankIndex <= 21) {
        roles.push(
            config.AUXILIARY_ROLES.HIGHTEAM
        );
    }

    if (rankIndex <= 23) {
        roles.push(
            config.AUXILIARY_ROLES.INGAME_RECHTE
        );
    }

    if (rankIndex <= 26) {
        roles.push(
            config.AUXILIARY_ROLES.ADMIN_EBENE
        );
    }

    if (rankIndex <= 31) {
        roles.push(
            config.AUXILIARY_ROLES.MODERATOR_EBENE
        );
    }

    if (rankIndex <= 35) {
        roles.push(
            config.AUXILIARY_ROLES.SUPPORTER_EBENE
        );
    }

    return roles;
}

/*
    Nur für /bestanden:
    alle Ebenen zurücksetzen.
*/

async function removeAuxiliaryRoles(member) {
    const roleIds = Object.values(
        config.AUXILIARY_ROLES
    ).filter(
        roleId =>
            roleId !==
            config.AUXILIARY_ROLES.SERVER_TEAM
    );

    const removable = roleIds.filter(roleId =>
        member.roles.cache.has(roleId)
    );

    if (removable.length > 0) {
        await member.roles.remove(removable);
    }
}

/*
    Cumulative Ebenen setzen.
*/

async function addRequiredAuxiliaryRoles(
    member,
    rankIndex
) {
    const requiredRoles =
        getRequiredAuxiliaryRoles(rankIndex);

    for (const roleId of requiredRoles) {
        if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId);
        }
    }

    return requiredRoles;
}

/*
    /downrank:
    Nur Ebenen entfernen, die nach dem neuen Rang
    nicht mehr erreicht werden.

    Server Team wird NIEMALS entfernt.
*/

async function updateAuxiliaryRolesAfterDownrank(
    member,
    newRankIndex
) {
    const requiredRoles =
        getRequiredAuxiliaryRoles(newRankIndex);

    const auxiliaryRoles =
        Object.values(config.AUXILIARY_ROLES);

    for (const roleId of auxiliaryRoles) {
        if (
            roleId ===
            config.AUXILIARY_ROLES.SERVER_TEAM
        ) {
            continue;
        }

        if (
            member.roles.cache.has(roleId) &&
            !requiredRoles.includes(roleId)
        ) {
            await member.roles.remove(roleId);
        }
    }

    for (const roleId of requiredRoles) {
        if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId);
        }
    }

    return requiredRoles;
}

/* =========================================================
   TEAMKICK
========================================================= */

const KEEP_ON_TEAMKICK = [
    config.BÜRGER,
    config.TEAMKICK,

    "1555631609284395013",
    "1555631609284395014",
    "1555631609284395015",
    "1555631609284395016",

    "1556241121997230161",
    "1556241180474343475",
    "1556241220265574400"
];

async function performTeamkick(member) {
    const rolesToRemove =
        member.roles.cache
            .filter(role =>
                !KEEP_ON_TEAMKICK.includes(role.id) &&
                role.editable
            )
            .map(role => role.id);

    if (rolesToRemove.length > 0) {
        await member.roles.remove(
            rolesToRemove
        );
    }

    if (
        !member.roles.cache.has(
            config.TEAMKICK
        )
    ) {
        await member.roles.add(
            config.TEAMKICK
        );
    }

    const warns = loadWarns();

    delete warns[member.id];

    saveWarns(warns);

    await updateNametag(member);
    await updateTeamliste(member.guild);
}

/* =========================================================
   EMBEDS
========================================================= */

function createActionEmbed({
    emoji,
    title,
    member,
    reason,
    executor,
    fields = []
}) {
    let text =
        `**Evil RP**\n\n` +
        `╔════════════════════════════════════════════╗\n` +
        `║            ${emoji} **${title}**             ║\n` +
        `║              𝑬𝒗𝒊𝒍 𝑹𝑷                    ║\n` +
        `╚════════════════════════════════════════════╝\n\n`;

    text +=
        `**👤 Teammitglied**\n` +
        `> ${member}\n\n`;

    for (const field of fields) {
        text += `${field}\n\n`;
    }

    text +=
        `**📝 Grund**\n` +
        `> ${reason}\n\n` +

        `**👮 Ausgeführt von**\n` +
        `> ${executor}\n\n` +

        `╔════════════════════════════════════════════╗\n` +
        `║          **𝑬𝒗𝒊𝒍 𝑹𝑷 • 𝑻𝒆𝒂𝒎**             ║\n` +
        `╚════════════════════════════════════════════╝`;

    return new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(text)
        .setTimestamp();
}

/* =========================================================
   /EMBED
========================================================= */

function buildCustomEmbed(interaction) {
    const title =
        interaction.options.getString("titel");

    const description =
        interaction.options.getString("beschreibung");

    const color =
        interaction.options.getString("farbe");

    const footer =
        interaction.options.getString("footer");

    const image =
        interaction.options.getString("bild");

    const thumbnail =
        interaction.options.getString("thumbnail");

    const embed = new EmbedBuilder()
        .setDescription(description);

    if (title) {
        embed.setTitle(title);
    }

    if (color) {
        let parsedColor = color.trim();

        if (!parsedColor.startsWith("#")) {
            parsedColor = `#${parsedColor}`;
        }

        if (/^#[0-9A-Fa-f]{6}$/.test(parsedColor)) {
            embed.setColor(parsedColor);
        } else {
            embed.setColor(0x2b2d31);
        }
    } else {
        embed.setColor(0x2b2d31);
    }

    if (footer) {
        embed.setFooter({
            text: footer
        });
    }

    if (image) {
        try {
            new URL(image);
            embed.setImage(image);
        } catch {}
    }

    if (thumbnail) {
        try {
            new URL(thumbnail);
            embed.setThumbnail(thumbnail);
        } catch {}
    }

    embed.setTimestamp();

    return embed;
}

/* =========================================================
   TEAMLISTE
========================================================= */

function getTeamlisteCategory(index) {
    if (index >= 0 && index <= 7) {
        return "👑 Projektspitze";
    }

    if (index >= 8 && index <= 21) {
        return "🟣 High Team";
    }

    if (index >= 22 && index <= 26) {
        return "🔵 High Administration";
    }

    if (index >= 27 && index <= 35) {
        return "🟢 Low Team";
    }

    return "Team";
}

async function buildTeamlisteEmbed(guild) {
    try {
        await guild.members.fetch();
    } catch (error) {
        console.error(
            "Teamliste Member Fetch Fehler:",
            error.message
        );
    }

    const categories = {
        "👑 Projektspitze": [],
        "🟣 High Team": [],
        "🔵 High Administration": [],
        "🟢 Low Team": []
    };

    let description =
        `**Evil RP**\n\n` +
        `╔════════════════════════════════════════════╗\n` +
        `║              👥 **TEAMLISTE**              ║\n` +
        `║              𝑬𝒗𝒊𝒍 𝑹𝑷                    ║\n` +
        `╚════════════════════════════════════════════╝\n\n`;

    /*
        Discord Inhaber zuerst
    */

    const inhaberRole =
        guild.roles.cache.get(
            config.DISCORD_INHABER
        );

    if (inhaberRole) {
        const members =
            guild.members.cache.filter(member =>
                member.roles.cache.has(
                    inhaberRole.id
                )
            );

        description +=
            `**👑 ${inhaberRole.name}**\n`;

        if (members.size === 0) {
            description +=
                `> Keine Mitglieder\n\n`;
        } else {
            for (const member of members.values()) {
                description +=
                    `> ${member}\n`;
            }

            description += "\n";
        }
    }

    /*
        Hauptränge
    */

    for (
        let index = 0;
        index < config.TEAM_RANKS.length;
        index++
    ) {
        const rank =
            config.TEAM_RANKS[index];

        const role =
            guild.roles.cache.get(rank.id);

        if (!role) {
            continue;
        }

        const members =
            guild.members.cache.filter(member =>
                member.roles.cache.has(role.id)
            );

        const category =
            getTeamlisteCategory(index);

        categories[category].push({
            role,
            members
        });
    }

    /*
        Kategorien
    */

    for (const [
        categoryName,
        ranks
    ] of Object.entries(categories)) {

        description +=
            `## ${categoryName}\n\n`;

        if (ranks.length === 0) {
            description +=
                `> Keine Ränge\n\n`;
            continue;
        }

        for (const rankData of ranks) {
            description +=
                `**${rankData.role.name}**\n`;

            if (rankData.members.size === 0) {
                description +=
                    `> Keine Mitglieder\n\n`;
            } else {
                for (
                    const member of
                    rankData.members.values()
                ) {
                    description +=
                        `> ${member}\n`;
                }

                description += "\n";
            }
        }
    }

    description +=
        `╔════════════════════════════════════════════╗\n` +
        `║          **𝑬𝒗𝒊𝒍 𝑹𝑷 • 𝑻𝒆𝒂𝒎**             ║\n` +
        `╚════════════════════════════════════════════╝`;

    return new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(description)
        .setFooter({
            text: "Automatisch aktualisiert"
        })
        .setTimestamp();
}

/* =========================================================
   TEAMLISTE UPDATE / SELF HEALING
========================================================= */

async function updateTeamliste(guild) {
    try {
        const data = loadTeamliste();
        const saved = data[guild.id];

        if (
            !saved ||
            !saved.channelId ||
            !saved.messageId
        ) {
            return;
        }

        const channel =
            await guild.channels
                .fetch(saved.channelId)
                .catch(() => null);

        if (!channel || !channel.isTextBased()) {
            return;
        }

        const embed =
            await buildTeamlisteEmbed(guild);

        const message =
            await channel.messages
                .fetch(saved.messageId)
                .catch(() => null);

        /*
            Nachricht existiert noch
        */

        if (message) {
            await message.edit({
                embeds: [embed]
            });

            return;
        }

        /*
            UNKNOWN MESSAGE / gelöscht:
            neue Nachricht erstellen
        */

        const newMessage =
            await channel.send({
                embeds: [embed]
            });

        data[guild.id] = {
            channelId: channel.id,
            messageId: newMessage.id
        };

        saveTeamliste(data);

        console.log(
            "Teamliste wurde automatisch neu erstellt."
        );

    } catch (error) {
        console.error(
            "Teamliste Update Fehler:",
            error.message
        );
    }
}

/* =========================================================
   SLASH COMMANDS
========================================================= */

const commands = [

    /*
        /embed
    */

    new SlashCommandBuilder()
        .setName("embed")
        .setDescription("Sendet einen eigenen Embed")
        .addStringOption(option =>
            option
                .setName("beschreibung")
                .setDescription("Beschreibung des Embeds")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("titel")
                .setDescription("Titel")
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("farbe")
                .setDescription("Hex-Farbe, z.B. #ff0000")
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("footer")
                .setDescription("Footer")
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("bild")
                .setDescription("Bild-URL")
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("thumbnail")
                .setDescription("Thumbnail-URL")
                .setRequired(false)
        ),

    /*
        /uprank
    */

    new SlashCommandBuilder()
        .setName("uprank")
        .setDescription("Befördert ein Teammitglied")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Teammitglied")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("grund")
                .setDescription("Grund")
                .setRequired(true)
        ),

    /*
        /downrank
    */

    new SlashCommandBuilder()
        .setName("downrank")
        .setDescription("Stuft ein Teammitglied herunter")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Teammitglied")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("grund")
                .setDescription("Grund")
                .setRequired(true)
        ),

    /*
        /teamwarn
    */

    new SlashCommandBuilder()
        .setName("teamwarn")
        .setDescription("Verwarnt ein Teammitglied")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Teammitglied")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("grund")
                .setDescription("Grund")
                .setRequired(true)
        ),

    /*
        /deletewarn
    */

    new SlashCommandBuilder()
        .setName("deletewarn")
        .setDescription("Entfernt eine Teamwarnung")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Teammitglied")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("grund")
                .setDescription("Grund")
                .setRequired(true)
        ),

    /*
        /teamkick
    */

    new SlashCommandBuilder()
        .setName("teamkick")
        .setDescription("Entfernt ein Teammitglied aus dem Team")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Teammitglied")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("grund")
                .setDescription("Grund")
                .setRequired(true)
        ),

    /*
        /bestanden
    */

    new SlashCommandBuilder()
        .setName("bestanden")
        .setDescription("Nimmt ein neues Teammitglied ins Team auf")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Teammitglied")
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName("rolle")
                .setDescription("Teamrolle")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("grund")
                .setDescription("Grund")
                .setRequired(true)
        ),

    /*
        /teamliste
    */

    new SlashCommandBuilder()
        .setName("teamliste")
        .setDescription("Erstellt oder aktualisiert die Teamliste")

].map(command => command.toJSON());

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {
    console.log(
        "===================================="
    );

    console.log(
        `Evil RP gestartet als ${client.user.tag}`
    );

    console.log(
        "===================================="
    );

    try {
        const rest =
            new REST({
                version: "10"
            }).setToken(
                process.env.DISCORD_TOKEN
            );

        await rest.put(
            Routes.applicationGuildCommands(
                client.user.id,
                config.GUILD_ID
            ),
            {
                body: commands
            }
        );

        console.log(
            "Slash Commands registriert."
        );

        const guild =
            client.guilds.cache.get(
                config.GUILD_ID
            );

        if (guild) {
            await guild.members.fetch();

            for (
                const member of
                guild.members.cache.values()
            ) {
                if (!member.user.bot) {
                    await updateNametag(member);
                }
            }

            await updateTeamliste(guild);
        }

    } catch (error) {
        console.error(
            "Ready-Fehler:",
            error
        );
    }
});

/* =========================================================
   AUTOMATISCHE NAMETAGS + TEAMLISTE
========================================================= */

client.on(
    "guildMemberUpdate",
    async (oldMember, newMember) => {

        if (newMember.user.bot) {
            return;
        }

        const oldRoles =
            oldMember.roles.cache
                .map(role => role.id)
                .sort();

        const newRoles =
            newMember.roles.cache
                .map(role => role.id)
                .sort();

        if (
            oldRoles.join(",") !==
            newRoles.join(",")
        ) {
            await updateNametag(newMember);
            await updateTeamliste(
                newMember.guild
            );
        }
    }
);

/* =========================================================
   INTERACTIONS
========================================================= */

client.on(
    "interactionCreate",
    async interaction => {

        if (!interaction.isChatInputCommand()) {
            return;
        }

        /* =================================================
           /EMBED
        ================================================= */

        if (
            interaction.commandName ===
            "embed"
        ) {
            if (
                !isTeamverwaltung(
                    interaction.member
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Du benötigst die Rolle **Teamverwaltung**.",
                    ephemeral: true
                });
            }

            const embed =
                buildCustomEmbed(
                    interaction
                );

            return interaction.reply({
                embeds: [embed]
            });
        }

        /* =================================================
           /TEAMLISTE
        ================================================= */

        if (
            interaction.commandName ===
            "teamliste"
        ) {
            if (
                !isTeamverwaltung(
                    interaction.member
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Du benötigst die Rolle **Teamverwaltung**.",
                    ephemeral: true
                });
            }

            /*
                SOFORT defer,
                damit Discord nicht nach 3 Sekunden
                mit Unknown Interaction antwortet.
            */

            await interaction.deferReply({
                ephemeral: false
            });

            const guild =
                interaction.guild;

            const data =
                loadTeamliste();

            const embed =
                await buildTeamlisteEmbed(
                    guild
                );

            const saved =
                data[guild.id];

            /*
                Gespeicherte Nachricht suchen
            */

            if (
                saved?.channelId &&
                saved?.messageId
            ) {
                const channel =
                    await guild.channels
                        .fetch(saved.channelId)
                        .catch(() => null);

                if (
                    channel &&
                    channel.isTextBased()
                ) {
                    const message =
                        await channel.messages
                            .fetch(saved.messageId)
                            .catch(() => null);

                    /*
                        Nachricht existiert:
                        einfach bearbeiten.
                    */

                    if (message) {
                        await message.edit({
                            embeds: [embed]
                        });

                        return interaction
                            .deleteReply()
                            .catch(() => {});
                    }

                    /*
                        Nachricht wurde gelöscht:
                        neue erstellen.
                    */

                    const newMessage =
                        await channel.send({
                            embeds: [embed]
                        });

                    data[guild.id] = {
                        channelId: channel.id,
                        messageId: newMessage.id
                    };

                    saveTeamliste(data);

                    return interaction
                        .deleteReply()
                        .catch(() => {});
                }
            }

            /*
                Keine gültige gespeicherte Nachricht:
                neue Nachricht im aktuellen Kanal.
            */

            if (
                !interaction.channel ||
                !interaction.channel.isTextBased()
            ) {
                return interaction.editReply({
                    content:
                        "❌ Dieser Kanal unterstützt keine Teamliste."
                });
            }

            const newMessage =
                await interaction.channel.send({
                    embeds: [embed]
                });

            data[guild.id] = {
                channelId:
                    interaction.channel.id,
                messageId:
                    newMessage.id
            };

            saveTeamliste(data);

            return interaction
                .deleteReply()
                .catch(() => {});
        }

        /* =================================================
           BERECHTIGUNG
        ================================================= */

        if (
            !isTeamverwaltung(
                interaction.member
            )
        ) {
            return interaction.reply({
                content:
                    "❌ Du benötigst die Rolle **Teamverwaltung**.",
                ephemeral: true
            });
        }

        const executor =
            interaction.member;

        const target =
            interaction.options.getMember(
                "user"
            );

        const reason =
            interaction.options.getString(
                "grund"
            );

        if (!target) {
            return interaction.reply({
                content:
                    "❌ Das Teammitglied wurde nicht gefunden.",
                ephemeral: true
            });
        }

        if (target.user.bot) {
            return interaction.reply({
                content:
                    "❌ Bots können nicht bearbeitet werden.",
                ephemeral: true
            });
        }

        /*
            BESTANDEN darf auch auf Bürger
            ohne bisherigen Teamrang.
        */

        if (
            interaction.commandName !==
            "bestanden"
        ) {
            const permission =
                canManageTarget(
                    executor,
                    target
                );

            if (!permission.allowed) {
                return interaction.reply({
                    content:
                        permission.reason,
                    ephemeral: true
                });
            }
        }

        /* =================================================
           UPRANK
        ================================================= */

        if (
            interaction.commandName ===
            "uprank"
        ) {
            const currentIndex =
                getRankIndex(target);

            if (currentIndex === -1) {
                return interaction.reply({
                    content:
                        "❌ Das Mitglied besitzt keinen gültigen Teamrang.",
                    ephemeral: true
                });
            }

            if (currentIndex === 0) {
                return interaction.reply({
                    content:
                        "❌ Das Mitglied besitzt bereits den höchsten Rang.",
                    ephemeral: true
                });
            }

            const oldRank =
                config.TEAM_RANKS[
                    currentIndex
                ];

            const newIndex =
                currentIndex - 1;

            const newRank =
                config.TEAM_RANKS[
                    newIndex
                ];

            /*
                Nur MAIN-Rolle wechseln.
                KEINE Ebenen entfernen.
            */

            await target.roles.remove(
                oldRank.id
            );

            await target.roles.add(
                newRank.id
            );

            /*
                Neue freigeschaltete Ebenen hinzufügen.
            */

            const requiredRoles =
                await addRequiredAuxiliaryRoles(
                    target,
                    newIndex
                );

            await updateNametag(target);
            await updateTeamliste(
                target.guild
            );

            const levelNames =
                requiredRoles
                    .map(id =>
                        interaction.guild.roles.cache.get(id)
                    )
                    .filter(Boolean)
                    .map(role => role.name)
                    .join(", ");

            const embed =
                createActionEmbed({
                    emoji: "⬆️",
                    title: "UPRANK",
                    member: target,
                    reason,
                    executor,
                    fields: [
                        `**⬆️ Neue Rolle**\n> ${newRank.name}`,
                        `**🛡️ Ebenen**\n> ${levelNames || "Keine"}`
                    ]
                });

            return interaction.reply({
                embeds: [embed]
            });
        }

        /* =================================================
           DOWNRANK
        ================================================= */

        if (
            interaction.commandName ===
            "downrank"
        ) {
            const currentIndex =
                getRankIndex(target);

            if (currentIndex === -1) {
                return interaction.reply({
                    content:
                        "❌ Das Mitglied besitzt keinen gültigen Teamrang.",
                    ephemeral: true
                });
            }

            if (
                currentIndex ===
                config.TEAM_RANKS.length - 1
            ) {
                return interaction.reply({
                    content:
                        "❌ Das Mitglied besitzt bereits den niedrigsten Rang.",
                    ephemeral: true
                });
            }

            const oldRank =
                config.TEAM_RANKS[
                    currentIndex
                ];

            const newIndex =
                currentIndex + 1;

            const newRank =
                config.TEAM_RANKS[
                    newIndex
                ];

            /*
                Nur MAIN-Rolle wechseln.
            */

            await target.roles.remove(
                oldRank.id
            );

            await target.roles.add(
                newRank.id
            );

            /*
                Nur Ebenen entfernen,
                deren Grenze nicht mehr erreicht wird.

                Server Team bleibt immer.
            */

            const requiredRoles =
                await updateAuxiliaryRolesAfterDownrank(
                    target,
                    newIndex
                );

            await updateNametag(target);
            await updateTeamliste(
                target.guild
            );

            const levelNames =
                requiredRoles
                    .map(id =>
                        interaction.guild.roles.cache.get(id)
                    )
                    .filter(Boolean)
                    .map(role => role.name)
                    .join(", ");

            const embed =
                createActionEmbed({
                    emoji: "⬇️",
                    title: "DOWNRANK",
                    member: target,
                    reason,
                    executor,
                    fields: [
                        `**⬇️ Neue Rolle**\n> ${newRank.name}`,
                        `**🛡️ Aktive Ebenen**\n> ${levelNames || "Keine"}`,
                        `**👥 Server Team**\n> Bleibt erhalten`
                    ]
                });

            return interaction.reply({
                embeds: [embed]
            });
        }

        /* =================================================
           TEAMWARN
        ================================================= */

        if (
            interaction.commandName ===
            "teamwarn"
        ) {
            const warns =
                loadWarns();

            const currentWarn =
                warns[target.id] || 0;

            const newWarn =
                currentWarn + 1;

            /*
                3/3 -> automatischer Teamkick
            */

            if (newWarn >= 3) {

                /*
                    3/3 Rolle setzen
                */

                if (
                    config.TEAMWARNS[3]
                ) {
                    await target.roles.add(
                        config.TEAMWARNS[3]
                    );
                }

                warns[target.id] = 3;
                saveWarns(warns);

                const embed =
                    createActionEmbed({
                        emoji: "⚠️",
                        title: "TEAMWARNUNG",
                        member: target,
                        reason,
                        executor,
                        fields: [
                            `**⚠️ Verwarnungsstufe**\n> Teamwarn 3/3`,
                            `**🚫 Folge**\n> Automatischer Teamkick`
                        ]
                    });

                await interaction.reply({
                    embeds: [embed]
                });

                await performTeamkick(
                    target
                );

                return;
            }

            /*
                Alte Warnrolle entfernen
            */

            if (currentWarn > 0) {
                const oldWarnRole =
                    config.TEAMWARNS[
                        currentWarn
                    ];

                if (oldWarnRole) {
                    await target.roles.remove(
                        oldWarnRole
                    );
                }
            }

            /*
                Neue Warnrolle
            */

            const newWarnRole =
                config.TEAMWARNS[
                    newWarn
                ];

            if (newWarnRole) {
                await target.roles.add(
                    newWarnRole
                );
            }

            warns[target.id] =
                newWarn;

            saveWarns(warns);

            const embed =
                createActionEmbed({
                    emoji: "⚠️",
                    title: "TEAMWARNUNG",
                    member: target,
                    reason,
                    executor,
                    fields: [
                        `**⚠️ Verwarnungsstufe**\n> Teamwarn ${newWarn}/3`
                    ]
                });

            return interaction.reply({
                embeds: [embed]
            });
        }

        /* =================================================
           DELETEWARN
        ================================================= */

        if (
            interaction.commandName ===
            "deletewarn"
        ) {
            const warns =
                loadWarns();

            const currentWarn =
                warns[target.id] || 0;

            if (currentWarn <= 0) {
                return interaction.reply({
                    content:
                        "❌ Dieses Teammitglied hat aktuell keine Teamwarnung.",
                    ephemeral: true
                });
            }

            const currentWarnRole =
                config.TEAMWARNS[
                    currentWarn
                ];

            if (currentWarnRole) {
                await target.roles.remove(
                    currentWarnRole
                );
            }

            const newWarn =
                currentWarn - 1;

            if (newWarn > 0) {
                const newWarnRole =
                    config.TEAMWARNS[
                        newWarn
                    ];

                if (newWarnRole) {
                    await target.roles.add(
                        newWarnRole
                    );
                }

                warns[target.id] =
                    newWarn;
            } else {
                delete warns[target.id];
            }

            saveWarns(warns);

            const embed =
                createActionEmbed({
                    emoji: "🗑️",
                    title: "DELETEWARN",
                    member: target,
                    reason,
                    executor,
                    fields: [
                        `**⚠️ Alte Verwarnungsstufe**\n> Teamwarn ${currentWarn}/3`,
                        `**✅ Neue Verwarnungsstufe**\n> ${newWarn}/3`
                    ]
                });

            return interaction.reply({
                embeds: [embed]
            });
        }

        /* =================================================
           TEAMKICK
        ================================================= */

        if (
            interaction.commandName ===
            "teamkick"
        ) {
            /*
                Bürger bleibt erhalten.
                Teamkick + Ping + Altersrollen bleiben.
            */

            await performTeamkick(
                target
            );

            const embed =
                createActionEmbed({
                    emoji: "🚫",
                    title: "TEAMKICK",
                    member: target,
                    reason,
                    executor
                });

            return interaction.reply({
                embeds: [embed]
            });
        }

        /* =================================================
           BESTANDEN
        ================================================= */

        if (
            interaction.commandName ===
            "bestanden"
        ) {
            const selectedRole =
                interaction.options.getRole(
                    "rolle"
                );

            if (!selectedRole) {
                return interaction.reply({
                    content:
                        "❌ Keine Teamrolle ausgewählt.",
                    ephemeral: true
                });
            }

            const selectedIndex =
                config.TEAM_RANKS.findIndex(
                    rank =>
                        rank.id ===
                        selectedRole.id
                );

            if (selectedIndex === -1) {
                return interaction.reply({
                    content:
                        "❌ Diese Rolle ist keine gültige Team-Hauptrangrolle.",
                    ephemeral: true
                });
            }

            /*
                Rangvergabe prüfen
            */

            if (
                !isDiscordInhaber(
                    executor
                )
            ) {
                const executorIndex =
                    getRankIndex(
                        executor
                    );

                if (executorIndex === -1) {
                    return interaction.reply({
                        content:
                            "❌ Du besitzt keinen gültigen Teamrang.",
                        ephemeral: true
                    });
                }

                if (
                    selectedIndex <=
                    executorIndex
                ) {
                    return interaction.reply({
                        content:
                            "❌ Du kannst deinen eigenen oder einen höheren Rang nicht vergeben.",
                        ephemeral: true
                    });
                }
            }

            /*
                Alte Hauptränge entfernen
            */

            const oldRanks =
                config.TEAM_RANKS
                    .map(rank => rank.id)
                    .filter(id =>
                        target.roles.cache.has(
                            id
                        )
                    );

            if (oldRanks.length > 0) {
                await target.roles.remove(
                    oldRanks
                );
            }

            /*
                Alte Ebenen entfernen
            */

            await removeAuxiliaryRoles(
                target
            );

            /*
                Bürger behalten / hinzufügen
            */

            if (
                !target.roles.cache.has(
                    config.BÜRGER
                )
            ) {
                await target.roles.add(
                    config.BÜRGER
                );
            }

            /*
                Teamrolle
            */

            await target.roles.add(
                selectedRole.id
            );

            /*
                Server Team NACH dem Reset.
                Wird dadurch niemals versehentlich gelöscht.
            */

            await target.roles.add(
                config.AUXILIARY_ROLES.SERVER_TEAM
            );

            /*
                Alle passenden cumulative Ebenen setzen
            */

            const requiredRoles =
                await addRequiredAuxiliaryRoles(
                    target,
                    selectedIndex
                );

            await updateNametag(target);
            await updateTeamliste(
                target.guild
            );

            const levelNames =
                requiredRoles
                    .map(id =>
                        interaction.guild.roles.cache.get(id)
                    )
                    .filter(Boolean)
                    .map(role => role.name)
                    .join(", ");

            const embed =
                createActionEmbed({
                    emoji: "✅",
                    title: "BESTANDEN",
                    member: target,
                    reason,
                    executor,
                    fields: [
                        `**🎖️ Neue Rolle**\n> ${selectedRole.name}`,
                        `**🛡️ Ebenen**\n> ${levelNames || "Keine"}`,
                        `**👥 Teamrolle**\n> Server Team`
                    ]
                });

            return interaction.reply({
                embeds: [embed]
            });
        }
    }
);

/* =========================================================
   LOGIN
========================================================= */

if (!process.env.DISCORD_TOKEN) {
    console.error(
        "❌ DISCORD_TOKEN fehlt in der .env!"
    );

    process.exit(1);
}

client.login(
    process.env.DISCORD_TOKEN
);
