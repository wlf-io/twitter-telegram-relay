import { ContextMessageUpdate } from "telegraf";
import fs from "fs";
import path from "path";
import EventManager, { Events } from "./EventManager";
import { TwitAuth } from "./TwitterService";

export interface User {
    id: string;
    name: string;
    twitter: { [k: string]: string };
    rawTele: {};
    session: { [k: string]: any };
}

export default class UserData implements iRunnable {
    public static readonly SavePath: string = "data/save.json";

    private data: { [k: string]: User } = {};

    private twitterToUserList: { [k: string]: string[] } = {};

    private eventManager: EventManager;

    constructor(eventManager: EventManager) {
        this.eventManager = eventManager;
        this.eventManager.hookEvent(Events.AuthNewTwitter, (auth: TwitAuth) => this.newTwitterAuth(auth));
    }

    public run(): iRunnable {
        this.load();
        return this;
    }

    private log(...args: any[]) {
        console.log("[User]", ...args);
    }

    public stop(): Promise<iRunnable> {
        return new Promise((res) => {
            const stopping = setInterval(() => this.log("Stopping..."), 1000);
            this.save()
                .then(() => {
                    clearInterval(stopping);
                    this.log("Stopped!!!");
                    res(this);
                });
        });
    }

    private updateListings() {
        const twitToUserList: { [k: string]: string[] } = {};
        for (const userID in this.data) {
            const user = this.data[userID];
            for (const twitID in user.twitter) {
                twitToUserList[twitID] = [userID, ...(twitToUserList[twitID] || [])];
            }
        }
        this.twitterToUserList = twitToUserList;
        this.eventManager.fireEvent(Events.TwitterHandleChange, [this.getTwitterIDs()]);
    }

    getTwitterIDs() {
        return Object.keys(this.twitterToUserList);
    }

    getUserIDsForTwiterID(twitID: string): (User | null)[] {
        return (this.twitterToUserList[twitID] || []).map(userID => this.getByID(userID));
    }

    getByID(id: string): User | null {
        return this.data[id] || null;
    }

    updateFromTelegramContext(ctx: ContextMessageUpdate): User | null {
        if (ctx.message && ctx.message.from) {
            const id: string = (ctx.message.from.id || "").toString();
            if (id.length > 0) {
                const _user: User = this.data[id] || {};
                _user.rawTele = ctx.message.from;
                _user.id = id;
                let username = ctx.message.from.username;
                if (username) {
                    username = `@${username}`;
                } else {
                    if (ctx.message.from.first_name) {
                        username = ctx.message.from.first_name;
                        if (ctx.message.from.last_name) {
                            username += ` ${ctx.message.from.last_name}`;
                        }
                    } else {
                        username = `#${id}`;
                    }
                }
                _user.name = username;
                const user = this.addUser(id, _user);
                return user;
            }
        }
        return null;
    }

    addTwitter(userID: string, twitterID: string, twitterHandle: string) {
        const user = this.getByID(userID);
        if (user) {
            if (!user.twitter.hasOwnProperty(twitterID)) {
                user.twitter[twitterID] = twitterHandle;
                this.updateListings();
                this.save();
            } else {
                user.twitter[twitterID] = twitterHandle;
            }
        } else {
            this.log("[Error]", "Trying to add twitterID to non existent user");
        }
    }

    addUser(id: string, data: { [k: string]: any }): User {
        const user = this.data[id] || {};
        user.id = id;
        if (data.name) {
            user.name = data.name;
        }
        if (typeof user.name !== "string") {
            user.name = `#${id}`;
        }
        if (data.rawTele) {
            user.rawTele = data.rawTele;
        }
        if (typeof user.rawTele !== "object" || user.rawTele === null) {
            user.rawTele = {};
        }
        if (typeof data.twitter === "object" && data.twitter !== null) {
            user.twitter = { ...data.twitter };
        }
        if (typeof user.twitter !== "object") {
            user.twitter = {};
        }
        if (typeof user.session !== "object" || user.session === null) {
            user.session = {};
        }
        this.data[id] = user;
        return user;
    }

    private load() {
        try {
            if (!fs.existsSync(path.join(__dirname, UserData.SavePath))) {
                return;
            }
            const raw = fs.readFileSync(path.join(__dirname, UserData.SavePath));
            const data = JSON.parse(raw.toString());
            if (typeof data === "object" && data !== null) {
                for (const id in data) {
                    delete data[id]["session"];
                    this.addUser(id, data[id]);
                }
                this.updateListings();
            }
        } catch (e) {
            this.log("[Error]", "Load Error", e);
        }
    }

    private save() {
        return new Promise((res) => {
            fs.writeFile(path.join(__dirname, UserData.SavePath), JSON.stringify(this.data, null, 2), () => {
                res();
                this.log("Saved!!!");
            });
        })
    }

    private newTwitterAuth(auth: TwitAuth): Promise<any> {
        this.addTwitter(auth.userID, auth.twitterID, auth.handle);
        return Promise.resolve();
    }
}