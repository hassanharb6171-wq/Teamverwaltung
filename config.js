module.exports = {
    GUILD_ID: "1555631609284395010",
    DISCORD_INHABER: "1555245115188977784",
    BÜRGER: "1555243848043593778",
    TEAMKICK: "1558837073937694740",
    TEAM_SPERRE: "1555243817647607858",
    TEAMVERWALTUNG: "1555243801180905472",

    TEAMWARNS: {
        1: "1557389198812520528",
        2: "1556296198510354453",
        3: "1558836504296685658"
    },

    // Roles that must never be removed by performTeamkick.
    PERMANENT_ON_TEAMKICK: [
        "1557816878930333766", // 13-15
        "1557816875507916830", // 15-17
        "1557816870634266856", // 18+
        "1555243857673982063", // RP Ping
        "1555243856386195507", // Partner Ping
        "1555243855312593098", // News Ping
        "1555243853458702379", // Giveaway Ping
        "1555243851420016781", // Event Ping
        "1555243850149134336"  // Fraktions Ping
    ],

    // Highest rank first; the nametag/team-management logic relies on this order.
    TEAM_RANKS: [
        { id: "1555245112135647384", name: "Founder" },
        { id: "1555245115188977784", name: "[INH] Inhaber" },
        { id: "1555245111502315676", name: "[StvINH] Stv. Inhaber" },
        { id: "1555245115860058252", name: "[PL] Projektleitung" },
        { id: "1555245109979783288", name: "[StvPL] Stv. Projektleitung" },
        { id: "1555245108612571288", name: "[SVL] Serverleitung" },
        { id: "1555245107786027098", name: "[Stv SVL] Stv. Serverleitung" },
        { id: "1555245102358597773", name: "[H.TL] Head Teamleitung" },
        { id: "1555245101372940318", name: "[TL] Teamleitung" },
        { id: "1555245104980299947", name: "[DIR] Direktor" },
        { id: "1555245103864352924", name: "[Stv.DIR] Stv. Direktor" },
        { id: "1555245105886003300", name: "[MA] Manager" },
        { id: "1555245107366727820", name: "[StvMA] Stv. Manager" },
        { id: "1555245102069457068", name: "Supervisor" },
        { id: "1555245099800068167", name: "Stv. Supervisor" },
        { id: "1555243807778414663", name: "Head of Support" },
        { id: "1555243808457756838", name: "Supporter" },
        { id: "1555243809204338799", name: "Test Supporter" },
        { id: "1555243805152903219", name: "Head of Moderation" },
        { id: "1555243805874196510", name: "Moderator" },
        { id: "1555243806545412159", name: "Test Moderator" },
        { id: "1555243802451775630", name: "Head of Administration" },
        { id: "1555243803076460744", name: "Admin" },
        { id: "1555243803915460758", name: "Test Admin" }
    ],

    AUXILIARY_ROLES: {
        PROJEKTSPITZE: "1555245110319513641",
        TEAMVERWALTUNG: "1555243801180905472",
        LEITUNGSEBENE: "1555245103176486952",
        HIGHTEAM: "1555243792297238688",
        INGAME_RECHTE: "1555243812916564110",
        ADMIN_EBENE: "1555243804561506405",
        MODERATOR_EBENE: "1555243804561506405",
        SUPPORTER_EBENE: "1555243810009784350",
        SERVER_TEAM: "1555245109245780069"
    },

    NO_NAMETAG_ROLES: [
        "1555245112135647384",
        "1555245115188977784",
        "1555245111502315676",
        "1555304797186297986",
        "1555245110319513641",
        "1555245109245780069",
        "1557389705576980603",
        "1555245103176486952",
        "1555243801180905472",
        "1555245105223434271",
        "1555245106653692045",
        "1555243810009784350",
        "1555243804561506405",
        "1555243801784614923",
        "1555243812916564110",
        "1555243792297238688",
        "1555245096512004148",
        "1555245100492132542",
        "1555243848043593778",
        "1558837073937694740",
        "1555243817647607858",
        "1557389198812520528",
        "1556296198510354453",
        "1558836504296685658"
    ]
};
