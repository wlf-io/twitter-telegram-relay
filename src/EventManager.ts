export enum Events {
    NewTweet = "tweet",
    AuthNewTwitter = "authNewTwit",
    AuthTwitterRequest = "reequestAuthNewTwit",
    TwitterHandleChange = "twitterHandleChange",
}

export default class EventManager {

    // public static readonly NewTweet = "tweet";
    // public static readonly AuthNewTwitter = "authNewTwit";
    // public static readonly AuthTwitterRequest = "reequestAuthNewTwit";
    // public static readonly TwitterHandleChange = "twitterHandleChange";

    public static readonly Events = Events;

    private _hooks: { [k: string]: Array<(...args: any[]) => Promise<any>> } = {};


    public fireEvent(event: Events, args: any[]): Promise<any> {
        const hooks = this._hooks[event] || [];
        return Promise.all(hooks.map(hook => hook(...args)));
    }

    public hookEvent(event: Events, cb: (...args: any) => Promise<any>) {
        this._hooks[event] = [cb, ...(this._hooks[event] || [])];
    }
}