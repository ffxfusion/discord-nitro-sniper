const discord = require('discord.js'),
    request = require('phin').unpromisified,
    chalk = require('chalk'),
    fs = require('fs'),
    moment = require("moment");

const configJsonContents = {
    nitro_sniper: {
        enabled: true,
        avoid_dupe_code: true
    },
    giveaway_sniper: {
        enabled: true,
        react_delay_ms: 0,
        dm_giveaway_host: {
            enabled: true,
            dm_delay_sec: 30,
            dm_message: "hello i have won your giveaway"
        }
    },
    slotbot_sniper: {
        enabled: true
    },
    options: {
        snipe_on_main_token: true
    }
};

const tokensJsonContents = {
    main_token: "",
    alt_tokens: []
};

if (!fs.existsSync("./config.json"))
    fs.writeFileSync("./config.json", JSON.stringify(configJsonContents));

if (!fs.existsSync("./tokens.json"))
    fs.writeFileSync("./tokens.json", JSON.stringify(tokensJsonContents));
    
const config = require("./config.json"),
    userTokens = require("./tokens.json");

if (userTokens.main_token === "") {
    console.error(chalk.red("error: you didnt set a main token"));
    process.exit(1);
}

let dupedCodes = [];
let altArray = []
let giveaway_host_id;

if (config.options.snipe_on_main_token === true)
    altArray.push(userTokens.main_token);

for (const alts of userTokens.alt_tokens.values()) {
    altArray.push(alts);
}

load();
mainTokenInfo();

for (const tokens of altArray.values()) {
    const client = new discord.Client({
        disabledEvents: ['TYPING_START', 'VOICE_SERVER_UPDATE', 'RELATIONSHIP_ADD', 'RELATIONSHIP_REMOVE', 'GUILD_ROLE_DELETE', 'GUILD_ROLE_UPDATE', 'GUILD_BAN_ADD', 'GUILD_BAN_REMOVE', 'CHANNEL_UPDATE', 'CHANNEL_PINS_UPDATE', 'MESSAGE_DELETE', 'MESSAGE_UPDATE', 'MESSAGE_DELETE_BULK', 'MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE', 'GUILD_MEMBER_UPDATE', 'GUILD_MEMBERS_CHUNK', 'GUILD_ROLE_CREATE', 'MESSAGE_REACTION_REMOVE_ALL', 'USER_UPDATE', 'USER_NOTE_UPDATE', 'USER_SETTINGS_UPDATE', 'PRESENCE_UPDATE', 'VOICE_STATE_UPDATE', 'GUILD_UPDATE', 'GUILD_MEMBER_ADD', 'GUILD_MEMBER_REMOVE']
    });
    client.on("message", async message => {
        if (config.nitro_sniper.enabled !== true)
            return

        const start_time = +new Date();
        let codes = message.content.match(/(discord\.gift\/|discord\.com\/gifts\/|discordapp\.com\/gifts\/)[^\s]+/gim);
        if (!codes || !codes.length)
            return;

        for (code of codes) {
            code = code.replace(/(discord\.gift\/|discord\.com\/gifts\/|discordapp\.com\/gifts\/)/gim, '').replace(/\W/g, '');

            if (dupedCodes.includes(code) && config.nitro_sniper.avoid_dupe_code === true) {
                console.log(chalk.gray(`[-] [${moment().format("LTS")}] avoiding duplicate codes - ${chalk.bold(code)}`))
                continue;
            }

            if (code.length < 16 || code.length > 24) {
                console.log(chalk.gray(`[-] [${moment().format("LTS")}] detected fake code - ${chalk.bold(code)}`))
                continue;
            }

            request({
                url: `https://discord.com/api/v6/entitlements/gift-codes/${code}/redeem`,
                method: "POST",
                parse: "json",
                headers: {
                    "Authorization": userTokens.main_token,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36"
                }
            }, (err, res) => {
                dupedCodes.push(code);
                const end_time = +new Date();
                if (err)
                    return console.error(chalk.red(`an error happend ${err}`));

                if ("subscription_plan" in res.body)
                    return console.log(chalk.green(`[+] [${moment().format("LTS")}] successfully redeemed - ${chalk.bold(code)} - ${chalk.bold(res.body.subscription_plan.name)} - (${end_time - start_time} ms)`));

                switch (res.body.message) {
                    case "401: Unauthorized":
                        console.error(chalk.red(`[-] your ${chalk.bold("main token")} isnt correct`));
                        process.exit(1);

                    case "This gift has been redeemed already.":
                        console.log(chalk.red(`[-] [${moment().format("LTS")}] gift claimed already - ${chalk.bold(code)} - (${end_time - start_time} ms)`));
                        break;

                    case "Unknown Gift Code":
                        console.log(chalk.red(`[-] [${moment().format("LTS")}] invalid code - ${chalk.bold(code)} - (${end_time - start_time} ms)`));
                        break;
                }
            });
        }
    });

    client.on("message", async message => {
        if (message.content.includes("Someone just dropped") && message.author.id === "346353957029019648" && config.slotbot_sniper.enabled === true) {
            try {
                await message.channel.send("~grab");
                // i really cant be asked for a log message since slotbot is utter shit and useless

                // ill return nothing for the reasons above
            } catch {}
        }

        if (config.giveaway_sniper.enabled === true && message.content.includes("GIVEAWAY") && message.author.id === "294882584201003009") {
            if (!message.embeds[0].author.name.toLowerCase().includes("nitro"))
                return;

            setTimeout(() => {
                message.react("\u{1F389}");
                console.log(chalk.yellow(`[+] [${moment().format("LTS")}] entered giveaway - alt account: ${chalk.bold(client.user.tag)} - in server: ${chalk.bold(message.guild.name)} in channel: ${chalk.bold(message.channel.name)}`))
            }, config.giveaway_sniper.react_delay_ms);

            const giveaway_host = message.embeds[0].description.match(/Hosted by: <@(.*)>/gim);
            giveaway_host_id = giveaway_host[0].replace("Hosted by: ", "");
        }

        if (message.author.id === "294882584201003009" && message.content.includes("Congratulations") && message.isMemberMentioned(client.user)) {
            console.log(chalk.green(`[+] [${moment().format("LTS")}] won nitro giveaway - ${chalk.bold(client.user.tag)} - in server: ${chalk.bold(message.guild.name)} in channel: ${chalk.bold(message.channel.name)}`));

            if (config.giveaway_sniper.dm_giveaway_host.enabled === true) {
                console.log(chalk.green(`[+] [${moment().format("LTS")}] DMing giveaway host... (waiting ${config.giveaway_sniper.dm_giveaway_host.dm_delay_sec} seconds)`));
                setTimeout(() => {
                    client.fetchUser(giveaway_host_id.replace("<@", "").replace(">", "")).then(async host => {
                        try {
                            await host.send(config.giveaway_sniper.dm_giveaway_host.dm_message);
                        } catch {
                            return console.error(chalk.red(`[-] [${moment().format("LTS")}] failed to send DM`))
                        }
                        console.log(chalk.green(`[+] [${moment().format("LTS")}] successfully DMed giveaway host - host user: ${chalk.bold(host.tag)}`));
                    });
                }, config.giveaway_sniper.dm_giveaway_host.dm_delay_sec * 1000);
            }
        }
    })
    client.on("ready", () => {
        console.log(chalk.magenta(`logged in accounts: ${chalk.bold(client.user.tag)}`));
    });

    setTimeout(() => {
        client.login(tokens).catch(exeption => {
            console.error(`skipping token (${tokens}) - ${exeption}`);
        });
    }, Math.floor(Math.random() * (2000 - 1000)) + 2500);
}

function load() {
    console.log(chalk.magenta(`
    ███▄    █  ██▓▄▄▄█████▓ ██▀███   ▒█████       ██████  ███▄    █  ██▓ ██▓███  ▓█████  ██▀███  
    ██ ▀█   █ ▓██▒▓  ██▒ ▓▒▓██ ▒ ██▒▒██▒  ██▒   ▒██    ▒  ██ ▀█   █ ▓██▒▓██░  ██▒▓█   ▀ ▓██ ▒ ██▒
   ▓██  ▀█ ██▒▒██▒▒ ▓██░ ▒░▓██ ░▄█ ▒▒██░  ██▒   ░ ▓██▄   ▓██  ▀█ ██▒▒██▒▓██░ ██▓▒▒███   ▓██ ░▄█ ▒
   ▓██▒  ▐▌██▒░██░░ ▓██▓ ░ ▒██▀▀█▄  ▒██   ██░     ▒   ██▒▓██▒  ▐▌██▒░██░▒██▄█▓▒ ▒▒▓█  ▄ ▒██▀▀█▄  
   ▒██░   ▓██░░██░  ▒██▒ ░ ░██▓ ▒██▒░ ████▓▒░   ▒██████▒▒▒██░   ▓██░░██░▒██▒ ░  ░░▒████▒░██▓ ▒██▒
   ░ ▒░   ▒ ▒ ░▓    ▒ ░░   ░ ▒▓ ░▒▓░░ ▒░▒░▒░    ▒ ▒▓▒ ▒ ░░ ▒░   ▒ ▒ ░▓  ▒▓▒░ ░  ░░░ ▒░ ░░ ▒▓ ░▒▓░
   ░ ░░   ░ ▒░ ▒ ░    ░      ░▒ ░ ▒░  ░ ▒ ▒░    ░ ░▒  ░ ░░ ░░   ░ ▒░ ▒ ░░▒ ░      ░ ░  ░  ░▒ ░ ▒░
      ░   ░ ░  ▒ ░  ░        ░░   ░ ░ ░ ░ ▒     ░  ░  ░     ░   ░ ░  ▒ ░░░          ░     ░░   ░ 
            ░  ░              ░         ░ ░           ░           ░  ░              ░  ░   ░                                                                                                
   created by fusion#3565 (623627611406336011)
   

                                        nitro sniper: ${config.nitro_sniper.enabled ? `${chalk.green("Enabled")}` : `${chalk.red("Disabled")}`}
                                        giveaway sniper: ${config.giveaway_sniper.enabled ? `${chalk.green("Enabled")}` : `${chalk.red("Disabled")}`}
                                        slotbot sniper: ${config.slotbot_sniper.enabled ? `${chalk.green("Enabled")}` : `${chalk.red("Disabled")}`}
                                        
                                        `))
}

function mainTokenInfo() {
    request({
        url: "https://discordapp.com/api/v8/users/@me",
        method: "GET",
        parse: "json",
        headers: {
            'Authorization': userTokens.main_token
        }
    }, (err, res) => {
        if (err) return;
        console.log(chalk.magenta(`nitro is being send to: ${chalk.bold(`${res.body.username}#${res.body.discriminator}`)} (main token)\n\n`))
    })
}