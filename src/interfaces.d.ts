declare interface iRunnable {
    run(): iRunnable;
    stop(): Promise<iRunnable>;
}