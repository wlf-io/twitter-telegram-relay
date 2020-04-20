import EventManager, { Events } from "./EventManager";
import Twitter from "twitter";
import Config from "./Config";
import UserData from "./UserData";
import { EventEmitter } from "events";
import crypto from "crypto";
import TT from "telegraf/typings/telegram-types.d";

export interface TwitAuth {
    handle: string;
    hex: string;
    userID: string;
    twitterID: string;
}

export default class TwitterService implements iRunnable {
    public static readonly TweetEvent = "tweet";
    private twit: Twitter;
    private keyword: string;
    private userData: UserData;
    private followString: string = "";
    private followList: string[] = [];
    private unauthed: { [k: string]: TwitAuth } = {};
    private stream: EventEmitter | null = null;
    private eventManager: EventManager;

    constructor(eventManager: EventManager, config: Config, userData: UserData) {
        this.twit = new Twitter({
            consumer_key: config.get(Config.TwitterConsumerKey),
            consumer_secret: config.get(Config.TwitterConsumerSecret),
            access_token_key: config.get(Config.TwitterAccessKey),
            access_token_secret: config.get(Config.TwitterAccessSecret)
        });
        this.keyword = config.get(Config.TwitterKeyword, "#NintendoSwitch").toLowerCase();
        this.userData = userData;
        this.eventManager = eventManager;
        eventManager.hookEvent(Events.TwitterHandleChange, (twitterIDs: string[]) => this.twitterHandleChange(twitterIDs));
        eventManager.hookEvent(Events.AuthTwitterRequest, (handle: string, chatID: string) => this.authNewTwitter(handle, chatID));
    }

    private log(...args: any[]) {
        console.log("[Twit]", ...args);
    }

    private twitterHandleChange(twitterIDs: string[]): Promise<any> {
        this.log("Handle Change", twitterIDs);
        this.followList = [...twitterIDs];
        return this.createStream();
    }

    private createStream(): Promise<any> {
        const handles = [...new Set([...this.followList, ...Object.keys(this.unauthed)])];
        handles.sort();
        const follow = handles.join(",");
        if (follow.length < 1) {
            this.log("Not creating stream", "No twitterIDs");
            return Promise.resolve();
        }
        if (follow === this.followString) {
            this.log("Not creating stream", "Same Users");
            return Promise.resolve();
        }

        this.log("Creating Stream...");

        this.followString = follow;

        if (this.stream !== null) {
            // @ts-ignore;
            this.stream.destroy();
            this.stream = null;
        }

        return new Promise((res) => {
            this.twit.stream("statuses/filter", { follow }, (stream: EventEmitter) => {
                this.stream = stream;
                this.hookStream(stream);
                this.log("Stream Create!!");
                res();
            });
        })

    }

    private authNewTwitter(twitter: string, userID: string) {
        this.log("Auth Request", twitter, userID);
        return new Promise((res, rej) => {
            this.twit.get("users/show", { screen_name: twitter })
                .then(dat => {
                    if (dat.hasOwnProperty("id_str")) {
                        const twitterID = dat.id_str;
                        const handle = "@" + dat.screen_name;
                        this.getUniqueToken()
                            .then(hex => {
                                this.unauthed[twitterID] = { handle, hex, userID, twitterID };
                                this.createStream();
                                res({ ...this.unauthed[twitterID] });
                            })
                            .catch(rej);
                    } else {
                        rej(`Could not load profile for that handle`);
                    }
                })
                .catch(() => rej(`Could not load profile for that handle`));
        });
    }

    private hookStream(stream: EventEmitter) {
        stream.on("data", (tweet: tTweet) => this.onTweet(tweet));
        stream.on("error", (e: any) => this.streamError(e));
    }

    private streamError(error: any) {
        this.log("[Stream]", "[Error]", error);
        throw error;
    }

    private randomHex(len: number = 48): Promise<string> {
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

    private getUniqueToken(len: number = 4): Promise<string> {
        return new Promise((res, rej) => {
            this.randomHex(len)
                .then(hex => {
                    let pass = true;
                    for (const twit in this.unauthed) {
                        if (this.unauthed[twit].hex === hex) {
                            pass = false;
                            break;
                        }
                    }
                    if (pass) {
                        res(hex);
                    } else {
                        this.getUniqueToken(len)
                            .then(res)
                            .catch(rej);
                    }
                })
                .catch(rej)
        });
    }

    private onTweet(tweet: tTweet) {
        const twitID = tweet.user.id_str.toString();
        //this.log("[Tweet]", tweet.text);
        if (this.checkUnauthed(twitID, tweet)) {
            return;
        }
        if (!this.twitterIDIsFollowed(twitID)) {
            return;
        }
        if (!this.containsKeyword(tweet)) {
            return;
        }
        this.fireTweetEvent(twitID, tweet);
    }

    private checkUnauthed(twitterID: string, tweet: tTweet) {
        if (this.unauthed.hasOwnProperty(twitterID)) {
            const check = this.unauthed[twitterID];
            const user = this.userData.getByID(check.userID);
            if (user) {
                const parts = tweet.text.toLowerCase().split(" ");
                if (parts.indexOf(check.hex.toLowerCase()) >= 0) {
                    this.log(`Twitter ${check.handle} authed for telegram ${user.name}`);
                    delete this.unauthed[twitterID];
                    this.eventManager.fireEvent(Events.AuthNewTwitter, [{ ...check }])
                        .then(() => {
                            this.onTweet(tweet);
                        });
                    return true;
                }
            }
        }
        return false;
    }

    private twitterIDIsFollowed(tweetID: string): boolean {
        return this.followList.indexOf(tweetID) >= 0;
    }

    private containsKeyword(tweet: tTweet): boolean {
        return tweet.text.toLowerCase().includes(this.keyword);
    }

    private fireTweetEvent(twitID: string, tweet: tTweet) {
        const media = TwitterService.ExtractMediaFromTweet(tweet);
        if (media.length > 0) {
            this.eventManager.fireEvent(Events.NewTweet, [twitID, media]);
        }
    }

    public static ExtractMediaFromTweet(tweet: tTweet): TT.MessageMedia[] {
        const media: TT.MessageMedia[] = [];
        if (tweet.extended_entities && tweet.extended_entities.media) {

            for (const m of tweet.extended_entities.media) {
                switch (m.type) {
                    case "photo":
                        media.push(TwitterService.CreatePhotoMedia(m));
                        break;
                    case "video":
                        media.push(TwitterService.CreateVideoMedia(m));
                        break;
                }
            }
        }
        return media;
    }



    public static CreatePhotoMedia(m: tExtendedMedia): TT.InputMediaPhoto {
        return {
            type: "photo",
            media: m.media_url_https,
        };
    }

    public static CreateVideoMedia(m: tExtendedMedia): TT.InputMediaVideo {
        return {
            type: "video",
            media: TwitterService.GetBestVideoUrlFromTweetMedia(m),
            thumb: m.media_url_https,
        }
    }

    public static GetBestVideoUrlFromTweetMedia(m: tExtendedMedia): string {
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
    }

    run(): iRunnable {
        return this;
    }

    stop(): Promise<iRunnable> {
        if (this.stream !== null) {
            // @ts-ignore
            this.stream.destroy();
            this.stream = null;
        }
        this.log("Stopped!!!");
        return Promise.resolve(this);
    }
}