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
    partials: [
        Partials.GuildMember
    ]
});

const DATA_DIR = path.join(__dirname, "data");

const WARN_FILE = path.join(
    DATA_DIR,
    "teamwarns.json"
);

const TEAMLIST_FILE = path.join(
    DATA_DIR,
    "teamliste.json"
);

const SERVERCODE_FILE = path.join(
    DATA_DIR,
    "servercode.json"
);

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

if (!fs.existsSync(WARN_FILE)) {
    fs.writeFileSync(
        WARN_FILE,
        "{}"
    );
}

if (!fs.existsSync(TEAMLIST_FILE)) {
    fs.writeFileSync(
        TEAMLIST_FILE,
        "{}"
    );
}

if (!fs.existsSync(SERVERCODE_FILE)) {
    fs.writeFileSync(
        SERVERCODE_FILE,
        "{}"
    );
}

/* =========================================================
   DATEN
========================================================= */

function loadWarns() {
    try {
        return JSON.parse(
            fs.readFileSync(
                WARN_FILE,
                "utf8"
            )
        );
    } catch {
        return {};
    }
}

function saveWarns(data) {
    fs.writeFileSync(
        WARN_FILE,
        JSON.stringify(
            data,
            null,
            2
        )
    );
}

function loadTeamliste() {
    try {
        return JSON.parse(
            fs.readFileSync(
                TEAMLIST_FILE,
                "utf8"
            )
        );
    } catch {
        return {};
    }
}

function saveTeamliste(data) {
    fs.writeFileSync(
        TEAMLIST_FILE,
        JSON.stringify(
            data,
            null,
            2
        )
    );
}

/* =========================================================
   SERVERCODE
========================================================= */

function loadServerCodes() {
    try {
        return JSON.parse(
            fs.readFileSync(
                SERVERCODE_FILE,
                "utf8"
            )
        );
    } catch {
        return {};
    }
}

function saveServerCodes(data) {
    fs.writeFileSync(
        SERVERCODE_FILE,
        JSON.stringify(
            data,
            null,
            2
        )
    );
}

function getServerCode(guildId) {
    const data =
        loadServerCodes();

    return data[guildId] || null;
}

function setServerCode(
    guildId,
    code
) {
    const data =
        loadServerCodes();

    data[guildId] = code;

    saveServerCodes(
        data
    );
}

/* =========================================================
   RÄNGE
========================================================= */

function getRankIndex(member) {
    return config.TEAM_RANKS.findIndex(
        rank =>
            member.roles.cache.has(
                rank.id
            )
    );
}

function getRank(member) {
    const index =
        getRankIndex(member);

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

function canManageTarget(
    executor,
    target
) {
    if (
        executor.id ===
        target.id
    ) {
        return {
            allowed: false,
            reason:
                "❌ Du kannst diesen Command nicht auf dich selbst anwenden."
        };
    }

    if (
        isDiscordInhaber(
            executor
        )
    ) {
        return {
            allowed: true
        };
    }

    const executorIndex =
        getRankIndex(
            executor
        );

    const targetIndex =
        getRankIndex(
            target
        );

    if (
        targetIndex === -1
    ) {
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

    const match =
        role.name.match(
            /^\[([^\]]+)\]/
        );

    if (match) {
        return `[${match[1]}]`;
    }

    return role.name;
}

function getNametagRole(member) {
    const excluded =
        new Set(
            config.NO_NAMETAG_ROLES || []
        );

    const roles = member.roles.cache
        .filter(role =>
            role.id !== member.guild.id &&
            !excluded.has(role.id)
        )
        .sort(
            (a, b) =>
                b.position - a.position
        );

    if (roles.size === 0) {
        return null;
    }

    return roles.first();
}
    /*
        HÖCHSTER TEAMRANG
    */

    for (
        const rank of
        config.TEAM_RANKS
    ) {
        if (
            member.roles.cache.has(
                rank.id
            ) &&
            !excluded.has(
                rank.id
            )
        ) {
            return member.guild.roles.cache.get(
                rank.id
            );
        }
    }

    /*
        BÜRGER
    */

    if (
        member.roles.cache.has(
            config.BÜRGER
        ) &&
        !excluded.has(
            config.BÜRGER
        )
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
            member.user.bot
        ) {
            return;
        }

        if (!member.manageable) {
            return;
        }

        const role =
            getNametagRole(
                member
            );

        let nickname;

        if (!role) {
            nickname =
                member.user.username;
        } else {
            const tag =
                getNametagFromRole(
                    role
                );

            nickname =
                `${tag} ✘ ${member.user.username}`;
        }

        if (
            nickname.length > 32
        ) {
            nickname =
                nickname.substring(
                    0,
                    32
                );
        }

        if (
            member.nickname !==
            nickname
        ) {
            await member.setNickname(
                nickname
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
   EBENEN
========================================================= */

function getRequiredAuxiliaryRoles(
    rankIndex
) {
    const roles = [];

    /*
        PROJEKTSPITZE
    */

    if (
        rankIndex >= 0 &&
        rankIndex <= 3
    ) {
        roles.push(
            config.AUXILIARY_ROLES.PROJEKTSPITZE
        );
    }

    /*
        TEAMVERWALTUNG
    */

    if (
        rankIndex >= 0 &&
        rankIndex <= 10
    ) {
        roles.push(
            config.AUXILIARY_ROLES.TEAMVERWALTUNG
        );
    }

    /*
        LEITUNGSEBENE
    */

    if (
        rankIndex >= 0 &&
        rankIndex <= 15
    ) {
        roles.push(
            config.AUXILIARY_ROLES.LEITUNGSEBENE
        );
    }

    /*
        HIGHTEAM
    */

    if (
        rankIndex >= 0 &&
        rankIndex <= 21
    ) {
        roles.push(
            config.AUXILIARY_ROLES.HIGHTEAM
        );
    }

    /*
        INGAME RECHTE
    */

    if (
        rankIndex >= 0 &&
        rankIndex <= 23
    ) {
        roles.push(
            config.AUXILIARY_ROLES.INGAME_RECHTE
        );
    }

    /*
        ADMIN EBENE
        Index 22 - 26
    */

    if (
        rankIndex >= 22 &&
        rankIndex <= 26
    ) {
        roles.push(
            config.AUXILIARY_ROLES.ADMIN_EBENE
        );
    }

    /*
        MODERATOR EBENE
        Index 27 - 31
    */

    if (
        rankIndex >= 27 &&
        rankIndex <= 31
    ) {
        roles.push(
            config.AUXILIARY_ROLES.MODERATOR_EBENE
        );
    }

    /*
        SUPPORTER EBENE
        Index 32 - 35
    */

    if (
        rankIndex >= 32 &&
        rankIndex <= 35
    ) {
        roles.push(
            config.AUXILIARY_ROLES.SUPPORTER_EBENE
        );
    }

    return roles;
}

async function removeAuxiliaryRoles(
    member
) {
    const roleIds =
        Object.values(
            config.AUXILIARY_ROLES
        );

    const removable =
        roleIds.filter(
            roleId =>
                roleId !==
                config.AUXILIARY_ROLES.SERVER_TEAM &&
                member.roles.cache.has(
                    roleId
                )
        );

    if (
        removable.length > 0
    ) {
        await member.roles.remove(
            removable
        );
    }
}

async function addRequiredAuxiliaryRoles(
    member,
    rankIndex
) {
    const requiredRoles =
        getRequiredAuxiliaryRoles(
            rankIndex
        );

    for (
        const roleId of
        requiredRoles
    ) {
        if (
            !member.roles.cache.has(
                roleId
            )
        ) {
            await member.roles.add(
                roleId
            );
        }
    }

    return requiredRoles;
}

/*
    UPRANK

    Kumulative Ebenen bleiben erhalten.

    Die drei Abteilungsebenen werden
    nur dann entfernt, wenn sie für
    den neuen Rang nicht mehr passen.

    SERVER TEAM bleibt immer.
*/

async function updateAuxiliaryRolesAfterUprank(
    member,
    rankIndex
) {
    const requiredRoles =
        getRequiredAuxiliaryRoles(
            rankIndex
        );

    const departmentRoles = [
        config.AUXILIARY_ROLES.ADMIN_EBENE,
        config.AUXILIARY_ROLES.MODERATOR_EBENE,
        config.AUXILIARY_ROLES.SUPPORTER_EBENE
    ];

    for (
        const roleId of
        departmentRoles
    ) {
        if (
            member.roles.cache.has(
                roleId
            ) &&
            !requiredRoles.includes(
                roleId
            )
        ) {
            await member.roles.remove(
                roleId
            );
        }
    }

    for (
        const roleId of
        requiredRoles
    ) {
        if (
            !member.roles.cache.has(
                roleId
            )
        ) {
            await member.roles.add(
                roleId
            );
        }
    }

    return requiredRoles;
}

/*
    DOWNRANK
*/

async function updateAuxiliaryRolesAfterDownrank(
    member,
    rankIndex
) {
    const requiredRoles =
        getRequiredAuxiliaryRoles(
            rankIndex
        );

    const auxiliaryRoles =
        Object.values(
            config.AUXILIARY_ROLES
        );

    for (
        const roleId of
        auxiliaryRoles
    ) {
        if (
            roleId ===
            config.AUXILIARY_ROLES.SERVER_TEAM
        ) {
            continue;
        }

        if (
            member.roles.cache.has(
                roleId
            ) &&
            !requiredRoles.includes(
                roleId
            )
        ) {
            await member.roles.remove(
                roleId
            );
        }
    }

    for (
        const roleId of
        requiredRoles
    ) {
        if (
            !member.roles.cache.has(
                roleId
            )
        ) {
            await member.roles.add(
                roleId
            );
        }
    }

    return requiredRoles;
}

function getAuxiliaryNames(
    guild,
    roleIds
) {
    const names = [];

    for (
        const roleId of
        roleIds
    ) {
        const role =
            guild.roles.cache.get(
                roleId
            );

        if (role) {
            names.push(
                role.name
            );
        }
    }

    return names;
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

async function performTeamkick(
    member
) {
    const rolesToRemove =
        member.roles.cache
            .filter(
                role =>
                    !KEEP_ON_TEAMKICK.includes(
                        role.id
                    ) &&
                    role.editable
            )
            .map(
                role => role.id
            );

    if (
        rolesToRemove.length > 0
    ) {
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

    const warns =
        loadWarns();

    delete warns[
        member.id
    ];

    saveWarns(
        warns
    );

    await updateNametag(
        member
    );

    await updateTeamliste(
        member.guild
    );
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
        `**Evil RP**\n\n` +

        `╔════════════════════════════════════════════╗\n` +
        `║            ${emoji} **${title}**             ║\n` +
        `║              𝑬𝒗𝒊𝒍 𝑹𝑷                    ║\n` +
        `╚════════════════════════════════════════════╝\n\n`;

    text +=
        `**👤 Teammitglied**\n` +
        `> ${member}\n\n`;

    for (
        const field of fields
    ) {
        text +=
            `${field}\n\n`;
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
        .setColor(
            0x2b2d31
        )
        .setDescription(
            text
        )
        .setTimestamp();
}

/* =========================================================
   RP EMBEDS
========================================================= */

function createRPStartEmbed(
    serverCode
) {
    const description =
        `# 🎃 EVIL RP | ROLEPLAY\n\n` +

        `🟢 **ROLEPLAY ERÖFFNET**\n\n` +

        `Das Roleplay auf **Evil RP** wurde offiziell gestartet!\n\n` +

        `🛰️ **Servercode:** \`${serverCode}\`\n\n` +

        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +

        `> 🔥 **DIE STADT LEBT. DEINE GESCHICHTE BEGINNT.**\n` +
        `>\n` +
        `> Ob Staatsfraktion, Unternehmen, Zivilist oder Unterwelt –\n` +
        `> **du entscheidest, welchen Weg du gehst.**\n` +
        `>\n` +
        `> 🎭 Erlebt einzigartiges Roleplay\n` +
        `> 🤝 Schreibt eure eigene Geschichte\n` +
        `> ⚠️ Haltet euch an die Serverregeln\n` +
        `> 🩸 Sorgt für faires und realistisches Roleplay\n\n` +

        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +

        `**🩸 EVIL RP**\n` +
        `*Deine Stadt. Deine Entscheidungen. Deine Konsequenzen.*`;

    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setDescription(
            description
        )
        .setTimestamp();
}

function createRPStopEmbed(
    serverCode
) {
    const description =
        `# 🎃 EVIL RP | ROLEPLAY\n\n` +

        `🔴 **ROLEPLAY BEENDET**\n\n` +

        `Das Roleplay auf **Evil RP** wurde offiziell beendet!\n\n` +

        `🛰️ **Servercode:** \`${serverCode}\`\n\n` +

        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +

        `> ⚠️ **DIE STADT SCHLIESST IHRE TORE.**\n` +
        `>\n` +
        `> Das heutige Roleplay ist beendet.\n` +
        `> Vielen Dank an alle, die dabei waren und für spannende RP-Situationen gesorgt haben!\n` +
        `>\n` +
        `> 🤝 Danke für eure Teilnahme\n` +
        `> 🎭 Danke für eure RP-Situationen\n` +
        `> ❤️ Danke für euren Support\n` +
        `> ⚠️ Bitte beendet laufende RP-Situationen ordnungsgemäß\n\n` +

        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +

        `**🩸 EVIL RP**\n` +
        `*Deine Stadt. Deine Entscheidungen. Deine Konsequenzen.*`;

    return new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(
            description
        )
        .setTimestamp();
}

function createServerCodeEmbed(
    serverCode
) {
    const description =
        `# 🎃 EVIL RP | SERVERCODE\n\n` +

        `🛰️ **AKTUELLER SERVERCODE**\n\n` +

        `🟢 **Servercode:** \`${serverCode}\`\n\n` +

        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +

        `🩸 **EVIL RP** | *Die Stadt wartet auf dich.*`;

    return new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(
            description
        )
        .setTimestamp();
}

/* =========================================================
   TEAMLISTE KATEGORIE
========================================================= */

function getTeamlisteCategory(
    index
) {
    if (
        index >= 0 &&
        index <= 7
    ) {
        return "👑 Projektspitze";
    }

    if (
        index >= 8 &&
        index <= 21
    ) {
        return "🟣 High Team";
    }

    if (
        index >= 22 &&
        index <= 26
    ) {
        return "🔵 High Administration";
    }

    if (
        index >= 27 &&
        index <= 35
    ) {
        return "🟢 Low Team";
    }

    return "Team";
}

/* =========================================================
   TEAMLISTE EMBED
========================================================= */

async function buildTeamlisteEmbed(
    guild
) {
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

        if (
            members.size === 0
        ) {
            description +=
                `> Keine Mitglieder\n\n`;
        } else {
            for (
                const member of
                members.values()
            ) {
                description +=
                    `> ${member}\n`;
            }

            description +=
                "\n";
        }
    }

    for (
        let index = 0;
        index <
        config.TEAM_RANKS.length;
        index++
    ) {
        const rank =
            config.TEAM_RANKS[
                index
            ];

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
            getTeamlisteCategory(
                index
            );

        categories[
            category
        ].push({
            role,
            members
        });
    }

    for (
        const [
            categoryName,
            ranks
        ] of Object.entries(
            categories
        )
    ) {
        description +=
            `## ${categoryName}\n\n`;

        if (
            ranks.length === 0
        ) {
            description +=
                `> Keine Ränge\n\n`;

            continue;
        }

        for (
            const rankData of
            ranks
        ) {
            description +=
                `**${rankData.role.name}**\n`;

            if (
                rankData.members.size === 0
            ) {
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

                description +=
                    "\n";
            }
        }
    }

    description +=
        `╔════════════════════════════════════════════╗\n` +
        `║          **𝑬𝒗𝒊𝒍 𝑹𝑷 • 𝑻𝒆𝒂𝒎**             ║\n` +
        `╚════════════════════════════════════════════╝`;

    return new EmbedBuilder()
        .setColor(
            0x2b2d31
        )
        .setDescription(
            description
        )
        .setFooter({
            text:
                "Automatisch aktualisiert"
        })
        .setTimestamp();
}

/* =========================================================
   TEAMLISTE UPDATE
========================================================= */

async function updateTeamliste(
    guild
) {
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
            await guild.channels.fetch(
                saved.channelId
            ).catch(
                () => null
            );

        if (!channel) {
            return;
        }

        const message =
            await channel.messages.fetch(
                saved.messageId
            ).catch(
                () => null
            );

        const embed =
            await buildTeamlisteEmbed(
                guild
            );

        if (!message) {
            const newMessage =
                await channel.send({
                    embeds: [embed]
                });

            data[guild.id] = {
                channelId:
                    channel.id,
                messageId:
                    newMessage.id
            };

            saveTeamliste(
                data
            );

            return;
        }

        await message.edit({
            embeds: [embed]
        });

    } catch (error) {
        console.error(
            "Teamliste Update Fehler:",
            error.message
        );
    }
}

/* =========================================================
   COMMANDS
========================================================= */

const commands = [

    /* =====================================================
       UPRANK
    ===================================================== */

    new SlashCommandBuilder()
        .setName("uprank")
        .setDescription(
            "Befördert ein Teammitglied"
        )
        .addUserOption(
            option =>
                option
                    .setName("user")
                    .setDescription(
                        "Teammitglied"
                    )
                    .setRequired(true)
        )
        .addStringOption(
            option =>
                option
                    .setName("grund")
                    .setDescription(
                        "Grund"
                    )
                    .setRequired(true)
        ),

    /* =====================================================
       DOWNRANK
    ===================================================== */

    new SlashCommandBuilder()
        .setName("downrank")
        .setDescription(
            "Stuft ein Teammitglied herunter"
        )
        .addUserOption(
            option =>
                option
                    .setName("user")
                    .setDescription(
                        "Teammitglied"
                    )
                    .setRequired(true)
        )
        .addStringOption(
            option =>
                option
                    .setName("grund")
                    .setDescription(
                        "Grund"
                    )
                    .setRequired(true)
        ),

    /* =====================================================
       TEAMWARN
    ===================================================== */

    new SlashCommandBuilder()
        .setName("teamwarn")
        .setDescription(
            "Verwarnt ein Teammitglied"
        )
        .addUserOption(
            option =>
                option
                    .setName("user")
                    .setDescription(
                        "Teammitglied"
                    )
                    .setRequired(true)
        )
        .addStringOption(
            option =>
                option
                    .setName("grund")
                    .setDescription(
                        "Grund"
                    )
                    .setRequired(true)
        ),

    /* =====================================================
       DELETEWARN
    ===================================================== */

    new SlashCommandBuilder()
        .setName("deletewarn")
        .setDescription(
            "Entfernt eine Teamwarnung"
        )
        .addUserOption(
            option =>
                option
                    .setName("user")
                    .setDescription(
                        "Teammitglied"
                    )
                    .setRequired(true)
        )
        .addStringOption(
            option =>
                option
                    .setName("grund")
                    .setDescription(
                        "Grund"
                    )
                    .setRequired(true)
        ),

    /* =====================================================
       TEAMKICK
    ===================================================== */

    new SlashCommandBuilder()
        .setName("teamkick")
        .setDescription(
            "Entfernt ein Teammitglied aus dem Team"
        )
        .addUserOption(
            option =>
                option
                    .setName("user")
                    .setDescription(
                        "Teammitglied"
                    )
                    .setRequired(true)
        )
        .addStringOption(
            option =>
                option
                    .setName("grund")
                    .setDescription(
                        "Grund"
                    )
                    .setRequired(true)
        ),

    /* =====================================================
       BESTANDEN
    ===================================================== */

    new SlashCommandBuilder()
        .setName("bestanden")
        .setDescription(
            "Nimmt ein neues Teammitglied ins Team auf"
        )
        .addUserOption(
            option =>
                option
                    .setName("user")
                    .setDescription(
                        "Teammitglied"
                    )
                    .setRequired(true)
        )
        .addRoleOption(
            option =>
                option
                    .setName("rolle")
                    .setDescription(
                        "Teamrolle"
                    )
                    .setRequired(true)
        )
        .addStringOption(
            option =>
                option
                    .setName("grund")
                    .setDescription(
                        "Grund"
                    )
                    .setRequired(true)
        ),

    /* =====================================================
       EMBED
    ===================================================== */

    new SlashCommandBuilder()
        .setName("embed")
        .setDescription(
            "Sendet einen eigenen Embed"
        )
        .addStringOption(
            option =>
                option
                    .setName("beschreibung")
                    .setDescription(
                        "Beschreibung des Embeds"
                    )
                    .setRequired(true)
        )
        .addStringOption(
            option =>
                option
                    .setName("titel")
                    .setDescription(
                        "Titel"
                    )
                    .setRequired(false)
        )
        .addStringOption(
            option =>
                option
                    .setName("farbe")
                    .setDescription(
                        "Hex-Farbe, z.B. #ff0000"
                    )
                    .setRequired(false)
        )
        .addStringOption(
            option =>
                option
                    .setName("footer")
                    .setDescription(
                        "Footer"
                    )
                    .setRequired(false)
        )
        .addStringOption(
            option =>
                option
                    .setName("bild")
                    .setDescription(
                        "Bild-URL"
                    )
                    .setRequired(false)
        )
        .addStringOption(
            option =>
                option
                    .setName("thumbnail")
                    .setDescription(
                        "Thumbnail-URL"
                    )
                    .setRequired(false)
        ),

    /* =====================================================
       TEAMLISTE
    ===================================================== */

    new SlashCommandBuilder()
        .setName("teamliste")
        .setDescription(
            "Erstellt oder aktualisiert die Teamliste"
        ),

    /* =====================================================
       RP
       /rp start
       /rp stop
    ===================================================== */

    new SlashCommandBuilder()
        .setName("rp")
        .setDescription(
            "Startet oder beendet das Roleplay"
        )

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("start")
                    .setDescription(
                        "Startet das Roleplay"
                    )
                    .addRoleOption(
                        option =>
                            option
                                .setName("rolle")
                                .setDescription(
                                    "Rolle, die gepingt werden soll"
                                )
                                .setRequired(false)
                    )
        )

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName("stop")
                    .setDescription(
                        "Beendet das Roleplay"
                    )
                    .addRoleOption(
                        option =>
                            option
                                .setName("rolle")
                                .setDescription(
                                    "Rolle, die gepingt werden soll"
                                )
                                .setRequired(false)
                    )
        ),

    /* =====================================================
       SERVERCODE
    ===================================================== */

    new SlashCommandBuilder()
        .setName("servercode")
        .setDescription(
            "Setzt den aktuellen Servercode"
        )
        .addStringOption(
            option =>
                option
                    .setName("code")
                    .setDescription(
                        "Der aktuelle Servercode"
                    )
                    .setRequired(true)
        )

].map(
    command =>
        command.toJSON()
);

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
                "Slash Commands registriert."
            );

            const guild =
                client.guilds.cache.get(
                    config.GUILD_ID
                );

            if (guild) {
                await updateTeamliste(
                    guild
                );
            }

        } catch (error) {
            console.error(
                "Ready Fehler:",
                error
            );
        }
    }
);

/* =========================================================
   AUTOMATISCHE NAMETAGS
========================================================= */

client.on(
    "guildMemberUpdate",
    async (
        oldMember,
        newMember
    ) => {
        try {
            if (
                newMember.user.bot
            ) {
                return;
            }

            const oldRoles =
                oldMember.roles.cache
                    .map(
                        role =>
                            role.id
                    )
                    .sort();

            const newRoles =
                newMember.roles.cache
                    .map(
                        role =>
                            role.id
                    )
                    .sort();

            if (
                oldRoles.join(",") !==
                newRoles.join(",")
            ) {
                await updateNametag(
                    newMember
                );

                await updateTeamliste(
                    newMember.guild
                );
            }

        } catch (error) {
            console.error(
                "guildMemberUpdate Fehler:",
                error.message
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

        if (
            !interaction.isChatInputCommand()
        ) {
            return;
        }

        /*
            SOFORT DEFERN
            verhindert "Anwendung reagiert nicht"
        */

        try {
            await interaction.deferReply({
                ephemeral: false
            });
        } catch (error) {
            console.error(
                "Defer Fehler:",
                error.message
            );

            return;
        }

        try {

            /* =================================================
               TEAMLISTE
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
                    return interaction.editReply({
                        content:
                            "❌ Du benötigst die Rolle **Teamverwaltung**."
                    });
                }

                const guild =
                    interaction.guild;

                const embed =
                    await buildTeamlisteEmbed(
                        guild
                    );

                const data =
                    loadTeamliste();

                if (
                    data[guild.id] &&
                    data[guild.id].channelId &&
                    data[guild.id].messageId
                ) {
                    const channel =
                        await guild.channels.fetch(
                            data[guild.id].channelId
                        ).catch(
                            () => null
                        );

                    if (channel) {
                        const message =
                            await channel.messages.fetch(
                                data[guild.id].messageId
                            ).catch(
                                () => null
                            );

                        if (message) {
                            await message.edit({
                                embeds: [
                                    embed
                                ]
                            });

                            return interaction.editReply({
                                content:
                                    "✅ Die Teamliste wurde aktualisiert."
                            });
                        }

                        const newMessage =
                            await channel.send({
                                embeds: [
                                    embed
                                ]
                            });

                        data[guild.id] = {
                            channelId:
                                channel.id,
                            messageId:
                                newMessage.id
                        };

                        saveTeamliste(
                            data
                        );

                        return interaction.editReply({
                            content:
                                "✅ Die Teamliste wurde neu erstellt."
                        });
                    }
                }

                const channel =
                    interaction.channel;

                if (!channel) {
                    return interaction.editReply({
                        content:
                            "❌ Kanal konnte nicht gefunden werden."
                    });
                }

                const message =
                    await channel.send({
                        embeds: [
                            embed
                        ]
                    });

                data[guild.id] = {
                    channelId:
                        message.channel.id,
                    messageId:
                        message.id
                };

                saveTeamliste(
                    data
                );

                return interaction.editReply({
                    content:
                        "✅ Die Teamliste wurde erstellt."
                });
            }

            /* =================================================
               TEAMVERWALTUNG
            ================================================= */

            if (
                !isTeamverwaltung(
                    interaction.member
                )
            ) {
                return interaction.editReply({
                    content:
                        "❌ Du benötigst die Rolle **Teamverwaltung**."
                });
            }

            /* =================================================
               SERVERCODE
            ================================================= */

            if (
                interaction.commandName ===
                "servercode"
            ) {
                const code =
                    interaction.options.getString(
                        "code"
                    );

                if (!code) {
                    return interaction.editReply({
                        content:
                            "❌ Bitte gib einen Servercode ein."
                    });
                }

                const cleanCode =
                    code.trim();

                if (
                    cleanCode.length === 0
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Der Servercode darf nicht leer sein."
                    });
                }

                /*
                    SERVERCODE SPEICHERN
                */

                setServerCode(
                    interaction.guild.id,
                    cleanCode
                );

                /*
                    SERVERCODE EMBED
                */

                const embed =
                    createServerCodeEmbed(
                        cleanCode
                    );

                await interaction.channel.send({
                    embeds: [
                        embed
                    ]
                });

                return interaction.editReply({
                    content:
                        `✅ Der Servercode \`${cleanCode}\` wurde gespeichert und gesendet.`
                });
            }

            /* =================================================
               RP
            ================================================= */

            if (
                interaction.commandName ===
                "rp"
            ) {
                const subcommand =
                    interaction.options.getSubcommand();

                const serverCode =
                    getServerCode(
                        interaction.guild.id
                    );

                /*
                    OHNE SERVERCODE KEIN RP START
                */

                if (
                    !serverCode
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Es wurde noch kein Servercode gespeichert.\nNutze zuerst **/servercode**."
                    });
                }

                const role =
                    interaction.options.getRole(
                        "rolle"
                    );

                let content =
                    "";

                if (role) {
                    content =
                        `${role}`;
                }

                /*
                    RP START
                */

                if (
                    subcommand ===
                    "start"
                ) {
                    const embed =
                        createRPStartEmbed(
                            serverCode
                        );

                    await interaction.channel.send({
                        content:
                            content || undefined,
                        embeds: [
                            embed
                        ],
                        allowedMentions: {
                            roles:
                                role
                                    ? [role.id]
                                    : []
                        }
                    });

                    return interaction.editReply({
                        content:
                            role
                                ? `✅ Roleplay wurde gestartet und ${role} wurde gepingt.`
                                : "✅ Roleplay wurde gestartet."
                    });
                }

                /*
                    RP STOP
                */

                if (
                    subcommand ===
                    "stop"
                ) {
                    const embed =
                        createRPStopEmbed(
                            serverCode
                        );

                    await interaction.channel.send({
                        content:
                            content || undefined,
                        embeds: [
                            embed
                        ],
                        allowedMentions: {
                            roles:
                                role
                                    ? [role.id]
                                    : []
                        }
                    });

                    return interaction.editReply({
                        content:
                            role
                                ? `🔴 Roleplay wurde beendet und ${role} wurde gepingt.`
                                : "🔴 Roleplay wurde beendet."
                    });
                }

                return interaction.editReply({
                    content:
                        "❌ Unbekannter RP-Befehl."
                });
            }

            /* =================================================
               EMBED
            ================================================= */

            if (
                interaction.commandName ===
                "embed"
            ) {
                const beschreibung =
                    interaction.options.getString(
                        "beschreibung"
                    );

                const titel =
                    interaction.options.getString(
                        "titel"
                    );

                const farbe =
                    interaction.options.getString(
                        "farbe"
                    );

                const footer =
                    interaction.options.getString(
                        "footer"
                    );

                const bild =
                    interaction.options.getString(
                        "bild"
                    );

                const thumbnail =
                    interaction.options.getString(
                        "thumbnail"
                    );

                const embed =
                    new EmbedBuilder()
                        .setDescription(
                            beschreibung
                        )
                        .setColor(
                            /^#[0-9A-Fa-f]{6}$/.test(
                                farbe || ""
                            )
                                ? farbe
                                : "#2b2d31"
                        );

                if (titel) {
                    embed.setTitle(
                        titel
                    );
                }

                if (footer) {
                    embed.setFooter({
                        text: footer
                    });
                }

                if (bild) {
                    try {
                        new URL(
                            bild
                        );

                        embed.setImage(
                            bild
                        );
                    } catch {}
                }

                if (thumbnail) {
                    try {
                        new URL(
                            thumbnail
                        );

                        embed.setThumbnail(
                            thumbnail
                        );
                    } catch {}
                }

                await interaction.channel.send({
                    embeds: [
                        embed
                    ]
                });

                return interaction.editReply({
                    content:
                        "✅ Embed wurde gesendet."
                });
            }

            /* =================================================
               USER
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
                return interaction.editReply({
                    content:
                        "❌ Das Teammitglied wurde nicht gefunden."
                });
            }

            if (
                target.user.bot
            ) {
                return interaction.editReply({
                    content:
                        "❌ Bots können nicht bearbeitet werden."
                });
            }

            /* =================================================
               TARGET BERECHTIGUNG
            ================================================= */

            const permission =
                canManageTarget(
                    executor,
                    target
                );

            if (
                !permission.allowed
            ) {
                return interaction.editReply({
                    content:
                        permission.reason
                });
            }

            /* =================================================
               UPRANK
            ================================================= */

            if (
                interaction.commandName ===
                "uprank"
            ) {
                const currentIndex =
                    getRankIndex(
                        target
                    );

                if (
                    currentIndex === -1
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Das Mitglied besitzt keinen gültigen Teamrang."
                    });
                }

                if (
                    currentIndex === 0
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Das Mitglied besitzt bereits den höchsten Rang."
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

                await target.roles.remove(
                    oldRank.id
                );

                await target.roles.add(
                    newRank.id
                );

                /*
                    NEUE EBENEN AKTUALISIEREN
                */

                const requiredRoles =
                    await updateAuxiliaryRolesAfterUprank(
                        target,
                        newIndex
                    );

                await updateNametag(
                    target
                );

                await updateTeamliste(
                    target.guild
                );

                const levelNames =
                    getAuxiliaryNames(
                        interaction.guild,
                        requiredRoles
                    );

                const embed =
                    createActionEmbed({
                        emoji: "⬆️",
                        title: "UPRANK",
                        member: target,
                        reason,
                        executor,
                        fields: [
                            `**🔻 Alte Rolle**\n> ${oldRank.name}`,
                            `**🔺 Neue Rolle**\n> ${newRank.name}`,
                            `**🛡️ Nebenrolle**\n> ${
                                levelNames.length > 0
                                    ? levelNames.join(", ")
                                    : "Keine"
                            }`
                        ]
                    });

                return interaction.editReply({
                    embeds: [
                        embed
                    ]
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
                    getRankIndex(
                        target
                    );

                if (
                    currentIndex === -1
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Das Mitglied besitzt keinen gültigen Teamrang."
                    });
                }

                if (
                    currentIndex ===
                    config.TEAM_RANKS.length - 1
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

                const newIndex =
                    currentIndex + 1;

                const newRank =
                    config.TEAM_RANKS[
                        newIndex
                    ];

                await target.roles.remove(
                    oldRank.id
                );

                await target.roles.add(
                    newRank.id
                );

                const requiredRoles =
                    await updateAuxiliaryRolesAfterDownrank(
                        target,
                        newIndex
                    );

                await updateNametag(
                    target
                );

                await updateTeamliste(
                    target.guild
                );

                const levelNames =
                    getAuxiliaryNames(
                        interaction.guild,
                        requiredRoles
                    );

                const embed =
                    createActionEmbed({
                        emoji: "⬇️",
                        title: "DOWNRANK",
                        member: target,
                        reason,
                        executor,
                        fields: [
                            `**🔻 Alte Rolle**\n> ${oldRank.name}`,
                            `**🔺 Neue Rolle**\n> ${newRank.name}`,
                            `**🛡️ Nebenrolle**\n> ${
                                levelNames.length > 0
                                    ? levelNames.join(", ")
                                    : "Keine"
                            }`
                        ]
                    });

                return interaction.editReply({
                    embeds: [
                        embed
                    ]
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
                    warns[
                        target.id
                    ] || 0;

                const newWarn =
                    currentWarn + 1;

                if (
                    currentWarn > 0
                ) {
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

                if (
                    newWarn >= 3
                ) {
                    const warn3Role =
                        config.TEAMWARNS[3];

                    if (warn3Role) {
                        await target.roles.add(
                            warn3Role
                        );
                    }

                    warns[
                        target.id
                    ] = 3;

                    saveWarns(
                        warns
                    );

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

                    await interaction.editReply({
                        embeds: [
                            embed
                        ]
                    });

                    await performTeamkick(
                        target
                    );

                    return;
                }

                const newWarnRole =
                    config.TEAMWARNS[
                        newWarn
                    ];

                if (newWarnRole) {
                    await target.roles.add(
                        newWarnRole
                    );
                }

                warns[
                    target.id
                ] = newWarn;

                saveWarns(
                    warns
                );

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

                return interaction.editReply({
                    embeds: [
                        embed
                    ]
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
                    warns[
                        target.id
                    ] || 0;

                if (
                    currentWarn <= 0
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Dieses Teammitglied hat aktuell keine Teamwarnung."
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

                if (
                    newWarn > 0
                ) {
                    const newWarnRole =
                        config.TEAMWARNS[
                            newWarn
                        ];

                    if (newWarnRole) {
                        await target.roles.add(
                            newWarnRole
                        );
                    }

                    warns[
                        target.id
                    ] = newWarn;
                } else {
                    delete warns[
                        target.id
                    ];
                }

                saveWarns(
                    warns
                );

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

                return interaction.editReply({
                    embeds: [
                        embed
                    ]
                });
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
                        title: "TEAMKICK",
                        member: target,
                        reason,
                        executor
                    });

                return interaction.editReply({
                    embeds: [
                        embed
                    ]
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

                const selectedIndex =
                    config.TEAM_RANKS.findIndex(
                        rank =>
                            rank.id ===
                            selectedRole.id
                    );

                if (
                    selectedIndex === -1
                ) {
                    return interaction.editReply({
                        content:
                            "❌ Diese Rolle ist keine gültige Team-Hauptrangrolle."
                    });
                }

                if (
                    !isDiscordInhaber(
                        executor
                    )
                ) {
                    const executorIndex =
                        getRankIndex(
                            executor
                        );

                    if (
                        executorIndex === -1
                    ) {
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

                if (
                    oldRanks.length > 0
                ) {
                    await target.roles.remove(
                        oldRanks
                    );
                }

                await removeAuxiliaryRoles(
                    target
                );

                if (
                    !target.roles.cache.has(
                        config.BÜRGER
                    )
                ) {
                    await target.roles.add(
                        config.BÜRGER
                    );
                }

                await target.roles.add(
                    selectedRole.id
                );

                const requiredRoles =
                    await addRequiredAuxiliaryRoles(
                        target,
                        selectedIndex
                    );

                /*
                    SERVER TEAM IMMER BEHALTEN
                    / HINZUFÜGEN
                */

                await target.roles.add(
                    config.AUXILIARY_ROLES.SERVER_TEAM
                );

                await updateNametag(
                    target
                );

                await updateTeamliste(
                    target.guild
                );

                const levelNames =
                    getAuxiliaryNames(
                        interaction.guild,
                        requiredRoles
                    );

                const embed =
                    createActionEmbed({
                        emoji: "✅",
                        title: "BESTANDEN",
                        member: target,
                        reason,
                        executor,
                        fields: [
                            `**🎖️ Neue Rolle**\n> ${selectedRole.name}`,
                            `**🛡️ Nebenrolle**\n> ${
                                levelNames.length > 0
                                    ? levelNames.join(", ")
                                    : "Keine"
                            }`
                        ]
                    });

                return interaction.editReply({
                    embeds: [
                        embed
                    ]
                });
            }

            /*
                UNBEKANNTER COMMAND
            */

            return interaction.editReply({
                content:
                    "❌ Dieser Command konnte nicht verarbeitet werden."
            });

        } catch (error) {
            console.error(
                "Command Fehler:",
                error
            );

            try {
                if (
                    interaction.deferred
                ) {
                    await interaction.editReply({
                        content:
                            `❌ Beim Ausführen ist ein Fehler aufgetreten.\n\`\`\`${error.message}\`\`\``
                    });
                }
            } catch (
                replyError
            ) {
                console.error(
                    "Fehler beim Senden der Fehlermeldung:",
                    replyError.message
                );
            }
        }
    }
);

/* =========================================================
   LOGIN
========================================================= */

if (
    !process.env.DISCORD_TOKEN
) {
    console.error(
        "❌ DISCORD_TOKEN fehlt in der .env!"
    );

    process.exit(1);
}

client.login(
    process.env.DISCORD_TOKEN
);
