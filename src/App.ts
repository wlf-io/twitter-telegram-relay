import UserData from "./UserData";
import TelegramService from "./TelegramService";
import TwitterService from "./TwitterService";
import EventManager from "./EventManager";
import Config from "./Config";

export default class App implements iRunnable {

    private eventManager: EventManager;
    private config: Config;

    private runableServices: iRunnable[];

    static Factory() {
        return new App();
    }

    constructor() {
        this.eventManager = new EventManager();
        this.config = new Config();


        const userData = new UserData(this.eventManager);
        const teleService = new TelegramService(this.eventManager, this.config, userData);
        const twitService = new TwitterService(this.eventManager, this.config, userData);

        this.runableServices = [
            userData,
            teleService,
            twitService
        ];

    }

    run(): iRunnable {
        this.runableServices
            .forEach(
                runable => runable.run()
            );
        return this;
    }

    stop(): Promise<iRunnable> {
        return new Promise((res, rej) => {
            const proms = this.runableServices
                .map(runable => runable.stop());
            Promise.all(proms)
                .then(() => res(this))
                .catch(rej);
        });
    }
}