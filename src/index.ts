import Twitter from "twitter";
import Telegraf, { ContextMessageUpdate } from "telegraf";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import TT from "telegraf/typings/telegram-types.d";
import express from "express";
import http from "http";

//import Tweet from "tweet"

const confJson: { [k: string]: any } = {};



if (fs.existsSync(path.join(__dirname, "config.json"))) {
    const raw = fs.readFileSync(path.join(__dirname, "config.json"));
    const conf = JSON.parse(raw.toString());
    for (const k in conf) {
        confJson[k] = conf[k];
    }
}

const getConf = (name: string, def: any = null): any => {
    return process.env[name.toUpperCase()] || (confJson[name.toLowerCase()] || def);
}

const webhook = getConf("webhook", false);
const port = getConf("http_port", 8080);


const consumer_key = getConf("TWITTER_CONSUMER_KEY", false);
const consumer_secret = getConf("TWITTER_CONSUMER_SECRET", false);
const access_token_key = getConf("TWITTER_ACCESS_KEY", false);
const access_token_secret = getConf("TWITTER_ACCESS_SECRET", false);

const telegram_bot_key = getConf("telegram_bot_key", false);

const errors: string[] = [];

if (!consumer_key) errors.push("Missing twitter_consumer_key");
if (!consumer_secret) errors.push("Missing twitter_consumer_secret");
if (!access_token_key) errors.push("Missing twitter_access_key");
if (!access_token_secret) errors.push("Missing twitter_accesss_secret");
if (!telegram_bot_key) errors.push("Missing telegram_bot_key");

if (errors.length > 0) {
    throw errors;
}

let expressApp: null | express.Express = null;
let expressServer: null | http.Server = null;

const helpText = [
    "`/follow [twitter_id]` \\- setup following of your twitter account",
    "`/help` \\- show this help text",
].join("\n");

let twitterStream: any = null;

let followString = "";

const twit = new Twitter({
    consumer_key,
    consumer_secret,
    access_token_key,
    access_token_secret,
});

const tele = new Telegraf(telegram_bot_key);

const tele_id_to_username: { [k: string]: string } = {

}
const tele_username_to_id: { [k: string]: string } = {

}
const twit_id_to_username: { [k: string]: string } = {

}
const twit_username_to_id: { [k: string]: string } = {

}

const tele_to_twit: { [k: string]: string } = {
    //"@wolfgang": "770729052835553280"
};

const twit_to_tele: { [k: string]: string } = {
    //"770729052835553280": "@wolfgang",
};

const unauthed_twit: { [k: string]: { chatID: string, hex: string } } = {

}

const saveData = () => {
    return {
        teleUser: tele_id_to_username,
        twitUser: twit_id_to_username,
        twitTele: twit_to_tele,
    };
};

const save = () => {
    fs.writeFileSync(path.join(__dirname, "data.json"), JSON.stringify(saveData(), null, 2));
    console.log("Saved!!!");
}

const load = () => {
    try {
        const raw = fs.readFileSync(path.join(__dirname, "data.json"));
        const data = JSON.parse(raw.toString());
        if (data.teleUser && data.twitUser && data.twitTele) {
            const { teleUser, twitUser, twitTele } = data;
            for (const id in teleUser) {
                const user = teleUser[id];
                tele_id_to_username[id] = user;
                tele_username_to_id[user] = id;
            }
            for (const id in twitUser) {
                const user = twitUser[id];
                twit_id_to_username[id] = user;
                twit_username_to_id[user] = id;
            }
            for (const twit in twitTele) {
                const tele = twitTele[twit];
                tele_to_twit[tele] = twit;
                twit_to_tele[twit] = tele;
            }
        }
        console.log("Loaded", data);
    } catch (e) {
        console.log("Data not loaded");
    }
}

const followTwitterUsers = () => {
    createTwitterStream([...new Set([...Object.keys(twit_to_tele), ...Object.keys(unauthed_twit)])]);
}

const convertTweetToTeleMediaGroup = (tweet: tTweet): TT.MessageMedia[] => {
    const media: TT.MessageMedia[] = [];
    if (tweet.extended_entities && tweet.extended_entities.media) {

        for (const m of tweet.extended_entities.media) {
            switch (m.type) {
                case "photo":
                    media.push(createPhotoMedia(m));
                    break;
                case "video":
                    media.push(createVideoMedia(m));
                    break;
            }
        }
    }
    return media;
};

const createPhotoMedia = (m: tExtendedMedia): TT.InputMediaPhoto => {
    return {
        type: "photo",
        media: m.media_url_https,
    };
};

const createVideoMedia = (m: tExtendedMedia): TT.InputMediaVideo => {
    return {
        type: "video",
        media: getBestVideoUrlFromTweetMedia(m),
        thumb: m.media_url_https,
    }
};

const getBestVideoUrlFromTweetMedia = (m: tExtendedMedia): string => {
    let bit = 0;
    let url = "";
    if (m.video_info) {
        const variants = m.video_info.variants
            .filter(variant => variant.content_type === "video/mp4");
        for (const variant of variants) {
            if ((variant.bitrate || 0) > bit) {
                url = variant.url;
            }
        }
    }
    return url;
};

const createTwitterStream = (users: string[]) => {
    if (twitterStream !== null) {
        twitterStream.destroy();
    }

    twitterStream = null;
    if (users.length < 1) {
        console.log("NOT CREATING TWITTER STREAM NO USERS");
        return;
    }

    users.sort();

    let follow = users.join(",");

    if (follow === followString) {
        console.log("NOT CREATING TWITTER STREAM UUSERS SAME");
        return;
    }

    followString = follow;

    console.log("CREATING TWITTER STREAM", users);

    twit.stream("statuses/filter", { follow }, (stream) => {
        twitterStream = stream;

        stream.on('data', function (event: tTweet) {
            const userID = event.user.id_str.toString();
            console.log(event.user.screen_name, event.text);
            if (!twit_to_tele.hasOwnProperty(userID)) {
                if (unauthed_twit.hasOwnProperty(userID)) {
                    const check = unauthed_twit[userID];
                    const parts = event.text.toLowerCase().split(" ");
                    if (parts.indexOf(check.hex.toLowerCase()) >= 0) {
                        twit_to_tele[userID] = check.chatID;
                        delete unauthed_twit[userID];
                        console.log(`Twitter @${event.user.screen_name} authed as telegram @${tele_id_to_username[check.chatID]}`);
                        tele.telegram.sendMessage(check.chatID, "Twitter authenticated as `@" + event.user.screen_name + "`", { parse_mode: "MarkdownV2" });
                    } else {
                        return;
                    }
                } else {
                    console.log("twit to tele does not have user id", userID, twit_to_tele);
                    return;
                }
            }
            if (!event.text.includes("#NintendoSwitch")) {
                console.log("Not a swonch tweet");
                return;
            }
            twit_id_to_username[userID] = event.user.screen_name;
            twit_username_to_id[event.user.screen_name] = userID;
            save();
            //tele.telegram.sendMessage(twit_to_tele[userID], event.text);
            tele.telegram.sendMediaGroup(twit_to_tele[userID], convertTweetToTeleMediaGroup(event));
        });

        stream.on('error', function (error) {
            console.log(error);
            throw error;
        });
    });

};

const updateRefs = (ctx: ContextMessageUpdate) => {
    if (ctx.message && ctx.message.from) {
        const id: string = (ctx.message.from.id || "").toString();
        const username: string = (ctx.message.from.username || "").toString().toLowerCase();
        if (username.length > 0 && id.length > 0) {
            tele_id_to_username[id] = username;
            tele_username_to_id[username] = id;
            save();
        }
    }
};

tele.start((ctx) => {
    updateRefs(ctx);
    ctx.reply("Hi")
});

const randomHex = (len: number = 48): Promise<string> => {
    return new Promise((res, rej) => {
        crypto.randomBytes(len, (err, buffer) => {
            if (err !== null) {
                rej(err);
            } else {
                res(buffer.toString("hex"));
            }
        });
    });
}

const getUniqueToken = (len: number = 4): Promise<string> => {
    return new Promise((res, rej) => {
        randomHex(len)
            .then(hex => {
                let pass = true;
                for (const twit in unauthed_twit) {
                    if (unauthed_twit[twit].hex === hex) {
                        pass = false;
                        break;
                    }
                }
                if (pass) {
                    res(hex);
                } else {
                    getUniqueToken(len)
                        .then(res)
                        .catch(rej);
                }
            })
            .catch(rej)
    });
}

tele.help(ctx => ctx.reply(helpText, { parse_mode: "MarkdownV2" }));

tele.command("follow", (ctx) => {
    updateRefs(ctx);

    if (Object.keys(twit_to_tele).length > 50) {
        ctx.reply("Please contact @wolfgang this boot is limited in capacity at the moment, but he could upgrade it");
    } else if (ctx.message && ctx.message.text && ctx.message.from) {
        const chatID: string = ctx.message.from.id.toString();
        const parts = ctx.message.text.split(" ");
        if (parts.length > 1 && parts[1].length > 0) {
            twit.get("users/show", { screen_name: parts[1] })
                .then(dat => {
                    if (dat.hasOwnProperty("id_str")) {
                        const twitID = dat.id_str;
                        const twitName = dat.screen_name;
                        getUniqueToken()
                            .then(hex => {
                                tele_to_twit[chatID] = parts[1];
                                unauthed_twit[twitID] = { chatID, hex };
                                twit_id_to_username[twitID] = twitName;
                                twit_username_to_id[twitName] = twitID;
                                ctx.reply("Please Tweet this string: " + hex);
                                followTwitterUsers();
                            });
                    }
                }).catch(() => {
                    ctx.reply("Could not find twitter user - " + parts[1]);
                });
        } else {
            ctx.reply("please use the format `/follow <twitter_handle>` \ne\\.g\\. `/follow @my_at`", { parse_mode: "MarkdownV2" });
        }
    }
});

load();


if (webhook) {
    const url = new URL(webhook);
    expressApp = express();
    expressApp.use(tele.webhookCallback(url.pathname));
    tele.telegram.setWebhook(webhook);
    expressServer = expressApp.listen(port, () => {
        console.log("Webhook active");
    });
} else {
    tele.telegram.deleteWebhook();
    expressApp = null;
}


tele.launch();
followTwitterUsers();



if (process.platform === "win32") {
    var rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on("SIGINT", function () {
        // @ts-ignore
        process.emit("SIGINT");
    });
}

process.on("SIGINT", function () {
    //graceful shutdown
    save();
    if (twitterStream !== null) {
        twitterStream.destroy();
    }
    if (expressServer !== null) {
        expressServer.close(() => {
            tele.stop();
            process.exit();
        });
        setTimeout(() => {
            tele.stop();
            console.log("Failed to shutdown expressServer");
            process.exit(1);
        }, 5000);
    } else {
        tele.stop();
        process.exit();
    }
});