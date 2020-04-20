import Telegraf, { ContextMessageUpdate } from "telegraf";
import EventManager, { Events } from "./EventManager";
import Config from "./Config";
import UserData, { User } from "./UserData";
import TT from "telegraf/typings/telegram-types.d";
import { TwitAuth } from "./TwitterService";

export default class TelegramService implements iRunnable {
    private tele: Telegraf<ContextMessageUpdate>;
    private userData: UserData;
    private eventManager: EventManager;

    private helpText = [
        "/follow \\- setup following of your twitter account",
        "/help \\- show this help text",
    ].join("\n");

    constructor(eventManager: EventManager, config: Config, userData: UserData) {
        this.userData = userData;
        this.eventManager = eventManager;
        this.eventManager.hookEvent(Events.NewTweet, (twitterID: string, media: TT.MessageMedia[]) => this.handleTweet(twitterID, media));
        this.eventManager.hookEvent(Events.AuthNewTwitter, (auth: TwitAuth) => this.onTwitterAuth(auth));
        this.eventManager.hookEvent(Events.AuthTwitterSetup, (auth: TwitAuth) => this.onTwitterAuthSetup(auth));
        this.tele = new Telegraf(config.get(Config.TelegramBotKey));
        // @ts-ignore
        this.tele.context.user = null;
        // this.setupMiddleware(this.tele);
        this.registerTelegramEvents();
    }

    // private setupMiddleware(tele: Telegraf<ContextMessageUpdate>) {
    // }

    private log(...args: any[]) {
        console.log("[Tele]", ...args);
    }

    private handleTweet(twitterID: string, media: TT.MessageMedia[]): Promise<any> {
        this.log(`Tweet from [${twitterID}] with ${media.length} media item(s)`);
        return new Promise(res => {
            Promise.all(
                this.userData.getUserIDsForTwiterID(twitterID)
                    .map((user: User | null) => {
                        if (user) {
                            this.log("[Tweet]", `Sent to [${user.name}]`, `${media.length} media item(s)`);
                            this.tele.telegram.sendMediaGroup(user.id, media);
                        }
                    })
            ).then(() => {
                res();
            });
        });
    }

    private registerTelegramEvents() {
        this.tele.start(ctx => {
            // @ts-ignore
            const user = this.userData.updateFromTelegramContext(ctx);
            if (user) {
                user.session.state = "start";
                ctx.reply("Hi!\nMy main command is /follow\nPlease use /help for more info");
            }
        });
        this.tele.help(ctx => {
            // @ts-ignore
            const user = this.userData.updateFromTelegramContext(ctx);
            // this.log("[Help]", user);
            if (user) {
                user.session.state = "help";
                ctx.reply(this.helpText, { parse_mode: "MarkdownV2" });
                this.log("[Help]", "[Sent]", user.name);
            }
        });
        this.tele.command("follow", ctx => this.followCommand(ctx));
        this.tele.on("message", ctx => this.onMessage(ctx));
    }

    private followCommand(ctx: ContextMessageUpdate) {
        // @ts-ignore
        const user = this.userData.updateFromTelegramContext(ctx);
        if (user) {
            user.session.state = "follow";
            ctx.reply("Please enter the twitter handle you want to follow\ne\\.g\n`@my_handle`", { parse_mode: "MarkdownV2" });
        }
    }

    private onMessage(ctx: ContextMessageUpdate) {
        // @ts-ignore
        const user = this.userData.updateFromTelegramContext(ctx);
        if (user) {
            switch (user.session.state || "none") {
                case "follow":
                    this.setupFollow(user, ctx);
                    break;
                case "none":
                default:
                    ctx.reply("Unexpected message please try a command first.\n\nOr /help for a list of commands");
                    break;
            }
        }
    }

    private setupFollow(user: User, ctx: ContextMessageUpdate) {
        this.eventManager.fireEvent(Events.AuthTwitterRequest, [ctx.message?.text, user.id])
            .then(
                () => {
                    ctx.reply(`Due to rate limits on the twitter api, setup for this follow can take upto 15 minutes.\n\nYou will be messaged when it is ready`);
                }
            ).catch(
                (e) => {
                    ctx.reply(e.toString(), { parse_mode: "MarkdownV2" });
                    this.log("Auth Req FAIL", e);
                }
            );
        user.session.state = null;
    }

    run(): iRunnable {
        this.tele.launch()
            .then(() => this.log("Started!!!"))
            .catch(e => this.log("[Error]", e));

        return this;
    }

    stop(): Promise<iRunnable> {
        this.tele.stop();
        this.log("Stopped maybe? telegraf is bugged so cant rely on stop promise!!");
        return Promise.resolve(this);

        this.log("Stopping...");
        return new Promise((res, rej) => {
            const stopInterval = setInterval(() => this.log("Stopping..."), 1000);
            this.tele.stop()
                .then(() => {
                    clearInterval(stopInterval);
                    this.log("Stopped!!!");
                    res(this);
                })
                .catch(rej);
        });
    }

    private onTwitterAuth(auth: TwitAuth): Promise<any> {
        this.tele.telegram.sendMessage(auth.userID, `Authed twitter account \`${auth.handle}\``, { parse_mode: "MarkdownV2" });
        return Promise.resolve();
    }

    private onTwitterAuthSetup(auth: TwitAuth) {
        this.log("Auth Setup", JSON.stringify(auth));
        this.tele.telegram.sendMessage(auth.userID, `The twitter follow is setup\\.\n\nPlease tweet this code: \`${auth.hex}\``, { parse_mode: "MarkdownV2" });
        return Promise.resolve();
    }
}