import App from "./App";

const app = App.Factory().run();

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
    app.stop()
        .then(
            () => process.exit()
        )
        .catch(e => {
            console.log(e);
            process.exit(1);
        });
    setInterval(() => {
        console.log("Failed to shutdown: Timeout");
        process.exit(1);
    }, 15000);
});