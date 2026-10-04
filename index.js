require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    SlashCommandBuilder,
    REST,
    Routes,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const config = require("./config");

/* =========================================================
   CLIENT
========================================================= */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.GuildMember
    ]
});

/* =========================================================
   DATEIEN
========================================================= */

const DATA_DIR = path.join(__dirname, "data");
const WARN_FILE = path.join(DATA_DIR, "teamwarns.json");
const TEAMLIST_FILE = path.join(DATA_DIR, "teamliste.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

if (!fs.existsSync(WARN_FILE)) {
    fs.writeFileSync(WARN_FILE, "{}");
}

if (!fs.existsSync(TEAMLIST_FILE)) {
    fs.writeFileSync(TEAMLIST_FILE, "{}");
}

/* =========================================================
   CHANNELS
========================================================= */

const TEAMWARN_CHANNEL_ID =
    "1556001017810780250";

const TEAMKICK_CHANNEL_ID =
    "1556001078107967498";

/* =========================================================
   TEAMKICK - ROLLEN DIE BLEIBEN
========================================================= */

const KEEP_ON_TEAMKICK = [
    config.BÜRGER,
    config.TEAMKICK,

    // Pingrollen
    "1555631609284395013",
    "1555631609284395014",
    "1555631609284395015",
    "1555631609284395016",

    // Altersrollen
    "1556241121997230161",
    "1556241180474343475",
    "1556241220265574400"
];

/* =========================================================
   JSON
========================================================= */

function loadJson(file) {
    try {
        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch {
        return {};
    }
}

function saveJson(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );
}

function loadWarns() {
    return loadJson(WARN_FILE);
}

function saveWarns(data) {
    saveJson(WARN_FILE, data);
}

function loadTeamliste() {
    return loadJson(TEAMLIST_FILE);
}

function saveTeamliste(data) {
    saveJson(TEAMLIST_FILE, data);
}

/* =========================================================
   RÄNGE
========================================================= */

function getRankIndex(member) {
    return config.TEAM_RANKS.findIndex(
        rank =>
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

    const executorIndex =
        getRankIndex(executor);

    const targetIndex =
        getRankIndex(target);

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
   NAMETAG
========================================================= */

function getNametagFromRole(role) {

    if (!role) {
        return null;
    }

    const match =
        role.name.match(/^\[([^\]]+)\]/);

    if (match) {
        return `[${match[1]}]`;
    }

    return role.name;
}

function getNametagRole(member) {

    const excluded =
        new Set(config.NO_NAMETAG_ROLES);

    const partnerRole =
        member.guild.roles.cache.find(
            role =>
                role.name.toLowerCase() ===
                "partner"
        );

    if (
        partnerRole &&
        member.roles.cache.has(
            partnerRole.id
        )
    ) {
        return partnerRole;
    }

    for (
        const rank of config.TEAM_RANKS
    ) {

        if (
            member.roles.cache.has(rank.id) &&
            !excluded.has(rank.id)
        ) {

            return member.guild.roles.cache.get(
                rank.id
            );
        }
    }

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

        if (
            !member ||
            member.user.bot ||
            !member.manageable
        ) {
            return;
        }

        const role =
            getNametagRole(member);

        let nickname;

        if (!role) {

            nickname =
                member.user.username;

        } else {

            const tag =
                getNametagFromRole(role);

            nickname =
                `${tag} ✘ ${member.user.username}`;
        }

        const finalNickname =
            nickname.substring(0, 32);

        if (
            member.nickname !==
            finalNickname
        ) {

            await member.setNickname(
                finalNickname
            );
        }

    } catch (error) {

        console.error(
            `Nametag Fehler bei ${member.user.tag}:`,
            error.message
        );
    }
}

/* =========================================================
   NEBENROLLEN
========================================================= */

async function removeAuxiliaryRoles(member) {

    const roleIds =
        Object.values(
            config.AUXILIARY_ROLES
        );

    const removable =
        roleIds.filter(
            roleId =>
                member.roles.cache.has(
                    roleId
                )
        );

    if (removable.length > 0) {

        await member.roles.remove(
            removable
        );
    }
}

function getAuxiliaryRoleId(rankIndex) {

    if (rankIndex <= 7) {
        return config.AUXILIARY_ROLES.PROJEKTSPITZE;
    }

    if (rankIndex <= 10) {
        return config.AUXILIARY_ROLES.TEAMVERWALTUNG;
    }

    if (rankIndex <= 14) {
        return config.AUXILIARY_ROLES.LEITUNGSEBENE;
    }

    if (rankIndex <= 21) {
        return config.AUXILIARY_ROLES.HIGHTEAM;
    }

    if (rankIndex <= 26) {
        return config.AUXILIARY_ROLES.ADMIN_EBENE;
    }

    if (rankIndex <= 30) {
        return config.AUXILIARY_ROLES.MODERATOR_EBENE;
    }

    if (rankIndex <= 35) {
        return config.AUXILIARY_ROLES.SUPPORTER_EBENE;
    }

    return null;
}

async function setAuxiliaryRole(
    member,
    rankIndex
) {

    await removeAuxiliaryRoles(
        member
    );

    const auxiliaryId =
        getAuxiliaryRoleId(
            rankIndex
        );

    if (auxiliaryId) {

        await member.roles.add(
            auxiliaryId
        );
    }

    return auxiliaryId;
}

/* =========================================================
   ACTION EMBED
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
        `**Evil RP**\n\n`;

    text +=
        `╔════════════════════════════════════════════╗\n`;

    text +=
        `║            ${emoji} **${title}**             ║\n`;

    text +=
        `║              𝑬𝒗𝒊𝒍 𝑹𝒑                    ║\n`;

    text +=
        `╚════════════════════════════════════════════╝\n\n`;

    text +=
        `**👤 Teammitglied**\n> ${member}\n\n`;

    for (const field of fields) {
        text += `${field}\n\n`;
    }

    text +=
        `**📝 Grund**\n> ${reason}\n\n`;

    text +=
        `**👮 Ausgeführt von**\n> ${executor}\n\n`;

    text +=
        `╔════════════════════════════════════════════╗\n`;

    text +=
        `║          **𝑬𝒗𝒊𝒍 𝑹𝒑 • 𝑻𝒆𝒂𝒎**             ║\n`;

    text +=
        `╚════════════════════════════════════════════╝`;

    return new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(text)
        .setTimestamp();
}

/* =========================================================
   TEAMLISTE
========================================================= */

function getTeamlisteCategory(index) {

    if (index <= 7) {
        return "👑 Projektspitze";
    }

    if (index <= 21) {
        return "🟣 High Team";
    }

    if (index <= 26) {
        return "🔵 High Administration";
    }

    return "🟢 Low Team";
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
        `**Evil RP**\n\n`;

    description +=
        `╔════════════════════════════════════════════╗\n`;

    description +=
        `║              👥 **TEAMLISTE**              ║\n`;

    description +=
        `║              𝑬𝒗𝒊𝒍 𝑹𝒑                    ║\n`;

    description +=
        `╚════════════════════════════════════════════╝\n\n`;

    const inhaberRole =
        guild.roles.cache.get(
            config.DISCORD_INHABER
        );

    if (inhaberRole) {

        const members =
            guild.members.cache.filter(
                member =>
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

            for (
                const member of members.values()
            ) {

                description +=
                    `> ${member}\n`;
            }

            description += `\n`;
        }
    }

    for (
        let index = 0;
        index < config.TEAM_RANKS.length;
        index++
    ) {

        const rank =
            config.TEAM_RANKS[index];

        const role =
            guild.roles.cache.get(
                rank.id
            );

        if (!role) {
            continue;
        }

        const members =
            guild.members.cache.filter(
                member =>
                    member.roles.cache.has(
                        role.id
                    )
            );

        const category =
            getTeamlisteCategory(index);

        categories[category].push({
            role,
            members
        });
    }

    for (
        const [category, ranks]
        of Object.entries(categories)
    ) {

        description +=
            `## ${category}\n\n`;

        for (const rankData of ranks) {

            description +=
                `**${rankData.role.name}**\n`;

            if (
                rankData.members.size === 0
            ) {

                description +=
                    `> Keine Mitglieder\n\n`;

            } else {

                for (
                    const member
                    of rankData.members.values()
                ) {

                    description +=
                        `> ${member}\n`;
                }

                description += `\n`;
            }
        }
    }

    description +=
        `╔════════════════════════════════════════════╗\n`;

    description +=
        `║          **𝑬𝒗𝒊𝒍 𝑹𝒑 • 𝑻𝒆𝒂𝒎**             ║\n`;

    description +=
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
   TEAMLISTE UPDATE
========================================================= */

let teamlisteTimer = null;
const teamlisteQueue = new Map();

function scheduleTeamlisteUpdate(guild) {

    if (!guild) {
        return;
    }

    teamlisteQueue.set(
        guild.id,
        guild
    );

    if (teamlisteTimer) {
        return;
    }

    teamlisteTimer =
        setTimeout(
            async () => {

                teamlisteTimer = null;

                const queue =
                    [...teamlisteQueue.values()];

                teamlisteQueue.clear();

                for (
                    const queuedGuild of queue
                ) {

                    await updateTeamliste(
                        queuedGuild
                    );
                }

            },
            1500
        );
}

async function updateTeamliste(guild) {

    try {

        const data =
            loadTeamliste();

        const saved =
            data[guild.id];

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

        if (
            !channel ||
            !channel.isTextBased()
        ) {

            delete data[guild.id];

            saveTeamliste(data);

            return;
        }

        const embed =
            await buildTeamlisteEmbed(
                guild
            );

        const message =
            await channel.messages
                .fetch(saved.messageId)
                .catch(() => null);

        if (!message) {

            const newMessage =
                await channel.send({
                    embeds: [embed]
                });

            data[guild.id] = {
                channelId: channel.id,
                messageId: newMessage.id
            };

            saveTeamliste(data);

            return;
        }

        await message.edit({
            embeds: [embed]
        });

    } catch (error) {

        console.error(
            "Teamliste Update Fehler:",
            error
        );
    }
}

/* =========================================================
   TEAMKICK
========================================================= */

async function performTeamkick(member) {

    if (!member.manageable) {

        throw new Error(
            "Der Bot kann die Rollen dieses Mitglieds nicht verwalten. Prüfe die Rollen-Hierarchie."
        );
    }

    const removable =
        member.roles.cache
            .filter(
                role =>
                    role.id !== member.guild.id
            )
            .filter(
                role =>
                    !KEEP_ON_TEAMKICK.includes(
                        role.id
                    )
            )
            .filter(
                role =>
                    role.editable
            )
            .map(
                role =>
                    role.id
            );

    if (removable.length > 0) {

        await member.roles.remove(
            removable
        );
    }

    if (
        !member.roles.cache.has(
            config.BÜRGER
        )
    ) {

        await member.roles.add(
            config.BÜRGER
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

    const warns =
        loadWarns();

    delete warns[member.id];

    saveWarns(warns);

    await updateNametag(member);

    scheduleTeamlisteUpdate(
        member.guild
    );
}

/* =========================================================
   CHANNEL SEND
========================================================= */

async function sendToChannel(
    guild,
    channelId,
    embed
) {

    const channel =
        await guild.channels
            .fetch(channelId)
            .catch(() => null);

    if (
        !channel ||
        !channel.isTextBased()
    ) {

        throw new Error(
            `Der Kanal ${channelId} wurde nicht gefunden.`
        );
    }

    await channel.send({
        embeds: [embed]
    });
}

/* =========================================================
   COMMANDS
========================================================= */

const commands = [

    new SlashCommandBuilder()
        .setName("uprank")
        .setDescription(
            "Befördert ein Teammitglied"
        )
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

    new SlashCommandBuilder()
        .setName("downrank")
        .setDescription(
            "Stuft ein Teammitglied herunter"
        )
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

    new SlashCommandBuilder()
        .setName("teamwarn")
        .setDescription(
            "Verwarnt ein Teammitglied"
        )
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

    new SlashCommandBuilder()
        .setName("deletewarn")
        .setDescription(
            "Entfernt eine Teamwarnung"
        )
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

    new SlashCommandBuilder()
        .setName("teamkick")
        .setDescription(
            "Entfernt ein Teammitglied aus dem Team"
        )
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

    new SlashCommandBuilder()
        .setName("bestanden")
        .setDescription(
            "Nimmt ein neues Teammitglied ins Team auf"
        )
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

    new SlashCommandBuilder()
        .setName("teamliste")
        .setDescription(
            "Erstellt oder aktualisiert die Teamliste"
        ),

    new SlashCommandBuilder()
        .setName("embed")
        .setDescription(
            "Erstellt einen individuellen Embed"
        )

].map(command => command.toJSON());

/* =========================================================
   READY
========================================================= */

client.once(
    "ready",
    async () => {

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
                "✅ Slash Commands registriert."
            );

            const guild =
                client.guilds.cache.get(
                    config.GUILD_ID
                );

            if (!guild) {

                console.error(
                    "❌ Server nicht gefunden."
                );

                return;
            }

            for (
                const member
                of guild.members.cache.values()
            ) {

                if (!member.user.bot) {

                    await updateNametag(
                        member
                    );
                }
            }

            scheduleTeamlisteUpdate(
                guild
            );

            console.log(
                "✅ Bot vollständig gestartet."
            );

        } catch (error) {

            console.error(
                "❌ Ready Fehler:",
                error
            );
        }
    }
);

/* =========================================================
   ROLE UPDATE
========================================================= */

client.on(
    "guildMemberUpdate",
    async (
        oldMember,
        newMember
    ) => {

        try {

            if (newMember.user.bot) {
                return;
            }

            const oldRoles =
                [...oldMember.roles.cache.keys()]
                    .sort()
                    .join(",");

            const newRoles =
                [...newMember.roles.cache.keys()]
                    .sort()
                    .join(",");

            if (oldRoles !== newRoles) {

                await updateNametag(
                    newMember
                );

                scheduleTeamlisteUpdate(
                    newMember.guild
                );
            }

        } catch (error) {

            console.error(
                "guildMemberUpdate Fehler:",
                error
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

        /*
            Nur Slash Commands und Modals
        */

        if (
            !interaction.isChatInputCommand() &&
            !interaction.isModalSubmit()
        ) {
            return;
        }

        try {

            /* =================================================
               TEAMVERWALTUNG CHECK
            ================================================= */

            if (
                !interaction.member ||
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

            /* =================================================
               /EMBED - MODAL ABSENDEN
            ================================================= */

            if (
                interaction.isModalSubmit() &&
                interaction.customId ===
                    "evilrp_embed_modal"
            ) {

                const title =
                    interaction.fields.getTextInputValue(
                        "embed_title"
                    );

                const description =
                    interaction.fields.getTextInputValue(
                        "embed_description"
                    );

                const color =
                    interaction.fields.getTextInputValue(
                        "embed_color"
                    ) || "#2b2d31";

                const footer =
                    interaction.fields.getTextInputValue(
                        "embed_footer"
                    );

                const image =
                    interaction.fields.getTextInputValue(
                        "embed_image"
                    );

                /* =================================================
                   FARBE PRÜFEN
                ================================================= */

                if (
                    !/^#[0-9A-Fa-f]{6}$/.test(
                        color
                    )
                ) {

                    return interaction.reply({
                        content:
                            "❌ Die Farbe muss im Format `#2b2d31` angegeben werden.",
                        ephemeral: true
                    });
                }

                /* =================================================
                   BILD-URL PRÜFEN
                ================================================= */

                if (image) {

                    try {

                        new URL(image);

                    } catch {

                        return interaction.reply({
                            content:
                                "❌ Die Bild-URL ist ungültig.",
                            ephemeral: true
                        });
                    }
                }

                /* =================================================
                   EMBED ERSTELLEN
                ================================================= */

                const embed =
                    new EmbedBuilder()
                        .setColor(color)
                        .setTitle(title)
                        .setDescription(description)
                        .setTimestamp();

                if (footer) {

                    embed.setFooter({
                        text: footer
                    });
                }

                if (image) {

                    embed.setImage(image);
                }

                /* =================================================
                   KANAL PRÜFEN
                ================================================= */

                if (
                    !interaction.channel ||
                    !interaction.channel.isTextBased()
                ) {

                    return interaction.reply({
                        content:
                            "❌ In diesem Kanal kann kein Embed gesendet werden.",
                        ephemeral: true
                    });
                }

                /* =================================================
                   EMBED ÖFFENTLICH SENDEN
                ================================================= */

                await interaction.channel.send({
                    embeds: [embed]
                });

                return interaction.reply({
                    content:
                        "✅ Embed wurde erfolgreich gesendet.",
                    ephemeral: true
                });
            }

            /* =================================================
               /EMBED - MODAL ÖFFNEN
            ================================================= */

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                    "embed"
            ) {

                const modal =
                    new ModalBuilder()
                        .setCustomId(
                            "evilrp_embed_modal"
                        )
                        .setTitle(
                            "Evil RP • Embed erstellen"
                        );

                /* =================================================
                   TITEL
                ================================================= */

                const titleInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "embed_title"
                        )
                        .setLabel(
                            "Titel"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(true)
                        .setMaxLength(256);

                /* =================================================
                   BESCHREIBUNG
                ================================================= */

                const descriptionInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "embed_description"
                        )
                        .setLabel(
                            "Beschreibung"
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setRequired(true)
                        .setMaxLength(4000);

                /* =================================================
                   FARBE
                ================================================= */

                const colorInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "embed_color"
                        )
                        .setLabel(
                            "Farbe"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setPlaceholder(
                            "#2b2d31"
                        )
                        .setRequired(false)
                        .setMaxLength(7);

                /* =================================================
                   FOOTER
                ================================================= */

                const footerInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "embed_footer"
                        )
                        .setLabel(
                            "Footer"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(false)
                        .setMaxLength(2048);

                /* =================================================
                   BILD
                ================================================= */

                const imageInput =
                    new TextInputBuilder()
                        .setCustomId(
                            "embed_image"
                        )
                        .setLabel(
                            "Bild-URL"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(false);

                /* =================================================
                   MODAL KOMPONENTEN
                ================================================= */

                modal.addComponents(

                    new ActionRowBuilder()
                        .addComponents(
                            titleInput
                        ),

                    new ActionRowBuilder()
                        .addComponents(
                            descriptionInput
                        ),

                    new ActionRowBuilder()
                        .addComponents(
                            colorInput
                        ),

                    new ActionRowBuilder()
                        .addComponents(
                            footerInput
                        ),

                    new ActionRowBuilder()
                        .addComponents(
                            imageInput
                        )
                );

                return interaction.showModal(
                    modal
                );
            }

            /* =================================================
               TEAMLISTE
            ================================================= */

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                    "teamliste"
            ) {

                await interaction.deferReply({
                    ephemeral: true
                });

                const guild =
                    interaction.guild;

                const embed =
                    await buildTeamlisteEmbed(
                        guild
                    );

                const data =
                    loadTeamliste();

                let message = null;

                /*
                    Alte Teamliste suchen
                */

                if (
                    data[guild.id] &&
                    data[guild.id].channelId &&
                    data[guild.id].messageId
                ) {

                    const oldChannel =
                        await guild.channels
                            .fetch(
                                data[guild.id].channelId
                            )
                            .catch(
                                () => null
                            );

                    if (
                        oldChannel &&
                        oldChannel.isTextBased()
                    ) {

                        message =
                            await oldChannel.messages
                                .fetch(
                                    data[guild.id].messageId
                                )
                                .catch(
                                    () => null
                                );
                    }
                }

                /*
                    Vorhandene Nachricht bearbeiten
                */

                if (message) {

                    await message.edit({
                        embeds: [embed]
                    });

                    return interaction.editReply({
                        content:
                            "✅ Die Teamliste wurde aktualisiert."
                    });
                }

                /*
                    Neue Nachricht erstellen
                */

                if (
                    !interaction.channel ||
                    !interaction.channel.isTextBased()
                ) {

                    return interaction.editReply({
                        content:
                            "❌ In diesem Kanal kann keine Teamliste erstellt werden."
                    });
                }

                const newMessage =
                    await interaction.channel.send({
                        embeds: [embed]
                    });

                data[guild.id] = {
                    channelId:
                        newMessage.channel.id,

                    messageId:
                        newMessage.id
                };

                saveTeamliste(data);

                return interaction.editReply({
                    content:
                        "✅ Die Teamliste wurde erstellt."
                });
            }

            /* =================================================
               TARGET
            ================================================= */

            const target =
                interaction.options.getMember(
                    "user"
                );

            const reason =
                interaction.options.getString(
                    "grund"
                );

            const executor =
                interaction.member;

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

            /* =================================================
               BERECHTIGUNG
            ================================================= */

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

            /*
                Interaction bestätigen
            */

            await interaction.deferReply({
                ephemeral: false
            });

            /* =================================================
               UPRANK / DOWNRANK
            ================================================= */

            if (
                interaction.commandName ===
                    "uprank" ||
                interaction.commandName ===
                    "downrank"
            ) {

                const currentIndex =
                    getRankIndex(target);

                if (currentIndex === -1) {

                    return interaction.editReply({
                        content:
                            "❌ Das Mitglied besitzt keinen gültigen Teamrang."
                    });
                }

                const newIndex =
                    interaction.commandName ===
                    "uprank"
                        ? currentIndex - 1
                        : currentIndex + 1;

                if (newIndex < 0) {

                    return interaction.editReply({
                        content:
                            "❌ Das Mitglied besitzt bereits den höchsten Rang."
                    });
                }

                if (
                    newIndex >=
                    config.TEAM_RANKS.length
                ) {

                    return interaction.editReply({
                        content:
                            "❌ Das Mitglied besitzt bereits den niedrigsten Rang."
                    });
                }

                const oldRank =
                    config.TEAM_RANKS[
                        currentIndex
                    ];

                const newRank =
                    config.TEAM_RANKS[
                        newIndex
                    ];

                /*
                    WICHTIG:
                    discord.js v14
                    -> roles.cache.get()
                */

                const newRole =
                    interaction.guild.roles.cache.get(
                        newRank.id
                    );

                if (
                    !newRole ||
                    !newRole.editable
                ) {

                    return interaction.editReply({
                        content:
                            "❌ Der Bot kann diese Rolle nicht verwalten."
                    });
                }

                /*
                    Alten Rang entfernen
                */

                await target.roles.remove(
                    oldRank.id
                );

                /*
                    Neuen Rang hinzufügen
                */

                await target.roles.add(
                    newRank.id
                );

                /*
                    Nebenrolle aktualisieren
                */

                const auxiliaryId =
                    await setAuxiliaryRole(
                        target,
                        newIndex
                    );

                /*
                    Nametag
                */

                await updateNametag(
                    target
                );

                /*
                    Teamliste
                */

                scheduleTeamlisteUpdate(
                    target.guild
                );

                /*
                    Nebenrollen-Objekt holen
                    WICHTIG:
                    cache.get()
                */

                const auxiliary =
                    auxiliaryId
                        ? interaction.guild.roles.cache.get(
                            auxiliaryId
                        )
                        : null;

                /*
                    Embed
                */

                const embed =
                    createActionEmbed({

                        emoji:
                            interaction.commandName ===
                            "uprank"
                                ? "⬆️"
                                : "⬇️",

                        title:
                            interaction.commandName ===
                            "uprank"
                                ? "UPRANK"
                                : "DOWNRANK",

                        member:
                            target,

                        reason,

                        executor,

                        fields: [

                            `**🎖️ Neue Rolle**\n> ${newRank.name}`,

                            `**🛡️ Nebenrolle**\n> ${
                                auxiliary
                                    ? auxiliary.name
                                    : "Keine"
                            }`
                        ]
                    });

                return interaction.editReply({
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
                    Number(
                        warns[target.id] || 0
                    );

                if (currentWarn >= 3) {

                    return interaction.editReply({
                        content:
                            "❌ Dieses Mitglied ist bereits bei Teamwarn 3/3."
                    });
                }

                const newWarn =
                    currentWarn + 1;

                /*
                    Alte Warnrolle entfernen
                */

                if (
                    currentWarn > 0 &&
                    config.TEAMWARNS[
                        currentWarn
                    ]
                ) {

                    await target.roles.remove(
                        config.TEAMWARNS[
                            currentWarn
                        ]
                    );
                }

                /*
                    Neue Warnrolle
                */

                if (
                    config.TEAMWARNS[
                        newWarn
                    ]
                ) {

                    await target.roles.add(
                        config.TEAMWARNS[
                            newWarn
                        ]
                    );
                }

                warns[target.id] =
                    newWarn;

                saveWarns(warns);

                /*
                    Warn Embed
                */

                const warnEmbed =
                    createActionEmbed({

                        emoji: "⚠️",

                        title:
                            "TEAMWARNUNG",

                        member:
                            target,

                        reason,

                        executor,

                        fields: [

                            `**⚠️ Verwarnungsstufe**\n> Teamwarn ${newWarn}/3`,

                            ...(newWarn === 3
                                ? [
                                    `**🚫 Folge**\n> Automatischer Teamkick`
                                ]
                                : [])
                        ]
                    });

                /*
                    Warnung in Warn-Kanal
                */

                await sendToChannel(
                    target.guild,
                    TEAMWARN_CHANNEL_ID,
                    warnEmbed
                );

                /*
                    3/3 = Teamkick
                */

                if (newWarn === 3) {

                    await performTeamkick(
                        target
                    );

                    const kickEmbed =
                        createActionEmbed({

                            emoji: "🚫",

                            title:
                                "TEAMKICK",

                            member:
                                target,

                            reason:
                                "Automatischer Teamkick nach 3/3 Teamwarnungen",

                            executor
                        });

                    await sendToChannel(
                        target.guild,
                        TEAMKICK_CHANNEL_ID,
                        kickEmbed
                    );
                }

                /*
                    Keine öffentliche
                    Command-Antwort
                */

                await interaction.deleteReply()
                    .catch(() => {});

                return;
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
                    Number(
                        warns[target.id] || 0
                    );

                if (currentWarn <= 0) {

                    return interaction.editReply({
                        content:
                            "❌ Dieses Teammitglied hat keine Teamwarnung."
                    });
                }

                /*
                    Alte Warnrolle entfernen
                */

                if (
                    config.TEAMWARNS[
                        currentWarn
                    ]
                ) {

                    await target.roles.remove(
                        config.TEAMWARNS[
                            currentWarn
                        ]
                    );
                }

                const newWarn =
                    currentWarn - 1;

                if (newWarn > 0) {

                    if (
                        config.TEAMWARNS[
                            newWarn
                        ]
                    ) {

                        await target.roles.add(
                            config.TEAMWARNS[
                                newWarn
                            ]
                        );
                    }

                    warns[target.id] =
                        newWarn;

                } else {

                    delete warns[
                        target.id
                    ];
                }

                saveWarns(warns);

                const embed =
                    createActionEmbed({

                        emoji: "🗑️",

                        title:
                            "DELETEWARN",

                        member:
                            target,

                        reason,

                        executor,

                        fields: [

                            `**⚠️ Alte Stufe**\n> Teamwarn ${currentWarn}/3`,

                            `**✅ Neue Stufe**\n> ${newWarn}/3`
                        ]
                    });

                await sendToChannel(
                    target.guild,
                    TEAMWARN_CHANNEL_ID,
                    embed
                );

                await interaction.deleteReply()
                    .catch(() => {});

                return;
            }

            /* =================================================
               TEAMKICK
            ================================================= */

            if (
                interaction.commandName ===
                "teamkick"
            ) {

                await performTeamkick(
                    target
                );

                const embed =
                    createActionEmbed({

                        emoji: "🚫",

                        title:
                            "TEAMKICK",

                        member:
                            target,

                        reason,

                        executor
                    });

                await sendToChannel(
                    target.guild,
                    TEAMKICK_CHANNEL_ID,
                    embed
                );

                return interaction.editReply({
                    content:
                        `✅ ${target} wurde aus dem Team gekickt.`
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

                    return interaction.editReply({
                        content:
                            "❌ Keine Rolle ausgewählt."
                    });
                }

                const selectedIndex =
                    config.TEAM_RANKS.findIndex(
                        rank =>
                            rank.id ===
                            selectedRole.id
                    );

                if (selectedIndex === -1) {

                    return interaction.editReply({
                        content:
                            "❌ Diese Rolle ist keine gültige Team-Hauptrangrolle."
                    });
                }

                /*
                    Nur Discord-Inhaber
                    dürfen jeden Rang vergeben.
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

                        return interaction.editReply({
                            content:
                                "❌ Du besitzt keinen gültigen Teamrang."
                        });
                    }

                    if (
                        selectedIndex <=
                        executorIndex
                    ) {

                        return interaction.editReply({
                            content:
                                "❌ Du kannst deinen eigenen oder einen höheren Rang nicht vergeben."
                        });
                    }
                }

                /*
                    Rollen-Hierarchie
                */

                if (
                    !selectedRole.editable
                ) {

                    return interaction.editReply({
                        content:
                            "❌ Der Bot kann diese Rolle nicht verwalten."
                    });
                }

                /*
                    Alte Teamränge entfernen
                */

                const oldRanks =
                    config.TEAM_RANKS
                        .map(
                            rank =>
                                rank.id
                        )
                        .filter(
                            id =>
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
                    Nebenrollen entfernen
                */

                await removeAuxiliaryRoles(
                    target
                );

                /*
                    Bürger
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
                    Server Team
                */

                if (
                    !target.roles.cache.has(
                        config.AUXILIARY_ROLES.SERVER_TEAM
                    )
                ) {

                    await target.roles.add(
                        config.AUXILIARY_ROLES.SERVER_TEAM
                    );
                }

                /*
                    Neue Teamrolle
                */

                await target.roles.add(
                    selectedRole.id
                );

                /*
                    Neue Nebenrolle
                */

                const auxiliaryId =
                    await setAuxiliaryRole(
                        target,
                        selectedIndex
                    );

                /*
                    Nametag
                */

                await updateNametag(
                    target
                );

                /*
                    Teamliste
                */

                scheduleTeamlisteUpdate(
                    target.guild
                );

                const auxiliary =
                    auxiliaryId
                        ? interaction.guild.roles.cache.get(
                            auxiliaryId
                        )
                        : null;

                /*
                    Embed
                */

                const embed =
                    createActionEmbed({

                        emoji: "✅",

                        title:
                            "BESTANDEN",

                        member:
                            target,

                        reason,

                        executor,

                        fields: [

                            `**🎖️ Neue Rolle**\n> ${selectedRole.name}`,

                            `**🛡️ Ebene**\n> ${
                                auxiliary
                                    ? auxiliary.name
                                    : "Keine"
                            }`,

                            `**👥 Teamrolle**\n> Server Team`
                        ]
                    });

                return interaction.editReply({
                    embeds: [embed]
                });
            }

            /* =================================================
               UNBEKANNTER COMMAND
            ================================================= */

            return interaction.editReply({
                content:
                    "❌ Unbekannter Command."
            });

        } catch (error) {

            console.error(
                "❌ Interaction Fehler:",
                error
            );

            const errorMessage =
                `❌ Fehler: ${
                    error?.message ||
                    "Unbekannter Fehler."
                }`;

            if (
                interaction.deferred ||
                interaction.replied
            ) {

                await interaction.editReply({
                    content:
                        errorMessage
                }).catch(
                    () => {}
                );

            } else {

                await interaction.reply({
                    content:
                        errorMessage,
                    ephemeral: true
                }).catch(
                    () => {}
                );
            }
        }
    }
);

/* =========================================================
   LOGIN
========================================================= */

if (
    !process.env.DISCORD_TOKEN ||
    process.env.DISCORD_TOKEN ===
        "DEIN_BOT_TOKEN"
) {

    console.error(
        "❌ DISCORD_TOKEN fehlt in der .env."
    );

    process.exit(1);
}

client.login(
    process.env.DISCORD_TOKEN
)
.then(() => {

    console.log(
        "✅ Login erfolgreich."
    );

})
.catch(error => {

    console.error(
        "❌ Discord Login fehlgeschlagen:",
        error.message
    );

    process.exit(1);
});