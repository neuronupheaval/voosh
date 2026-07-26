import type { Logger } from "ts-log";

export class App {
    private readonly logger: Logger;
    
    constructor(logger: Logger) {
        this.logger = logger;
    }

    run() {
        console.log("Initializing...");



        console.log("Terminated.");
    }

    config = {
        iceServers: [
            {
                urls: "stun:stun.relay.metered.ca:80",
            },
            {
                urls: "turn:global.relay.metered.ca:80",
                username: "297df18ef1623036526836e8",
                credential: "zQ+j4EcQs1WwRpoX",
            },
            {
                urls: "turn:global.relay.metered.ca:80?transport=tcp",
                username: "297df18ef1623036526836e8",
                credential: "zQ+j4EcQs1WwRpoX",
            },
            {
                urls: "turn:global.relay.metered.ca:443",
                username: "297df18ef1623036526836e8",
                credential: "zQ+j4EcQs1WwRpoX",
            },
            {
                urls: "turns:global.relay.metered.ca:443?transport=tcp",
                username: "297df18ef1623036526836e8",
                credential: "zQ+j4EcQs1WwRpoX",
            },
        ]
    };
}