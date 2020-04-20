import fs from "fs";
import path from "path";

export default class Config {
    private fileConf: { [k: string]: any } = {};

    public static readonly TwitterConsumerKey = "TWITTER_CONSUMER_KEY";
    public static readonly TwitterConsumerSecret = "TWITTER_CONSUMER_SECRET";
    public static readonly TwitterAccessKey = "TWITTER_ACCESS_KEY";
    public static readonly TwitterAccessSecret = "TWITTER_ACCESS_SECRET";
    public static readonly TelegramBotKey = "TELEGRAM_BOT_KEY";
    public static readonly TwitterKeyword = "TWITTER_KEYWORD";

    private static readonly RequiredConfig = [
        Config.TwitterAccessKey,
        Config.TwitterAccessSecret,
        Config.TwitterConsumerKey,
        Config.TwitterConsumerSecret,
        Config.TwitterKeyword,
        Config.TelegramBotKey,
    ]

    constructor() {
        this.loadFileConf();
        this.checkRequired();
    }

    get(key: string, def: any = null) {
        return process.env[key.toUpperCase()] || (this.fileConf[key.toLowerCase()] || def);
    }

    private loadFileConf() {
        if (fs.existsSync(path.join(__dirname, "data", "config.json"))) {
            const raw = fs.readFileSync(path.join(__dirname, "data", "config.json"));
            const conf = JSON.parse(raw.toString());
            for (const k in conf) {
                this.fileConf[k] = conf[k];
            }
        }
    }

    private checkRequired() {
        const missing = [];
        for (const key of Config.RequiredConfig) {
            if (this.get(key) === null) {
                missing.push(key);
            }
        }

        if (missing.length > 0) {
            console.log("Missing config!!!");
            throw missing;
        }
    }
}