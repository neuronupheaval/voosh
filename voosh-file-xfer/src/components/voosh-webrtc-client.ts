import NodeRSA from "node-rsa";

export interface VooshWebRtcConfig {
    signalingServer: string;
}

export type RefMatchedResponse = {
    sender: string;
    fileName: string;
    fileSize: number;
    tags: string[];
}

export type WebRtcIsolationEventHandler = (messageType: string, payload: any, context: { 
    sendMessage(payload: any): void,  
    abortChannel(): void
}) => Promise<void> | void;

export type RefRequestEventHandler = (ref: string, sender: string) => Promise<RefMatchedResponse | undefined>
    | RefMatchedResponse | undefined;

export type RefMatchedIsolationEventHandler = (context: { download(): Promise<void> }, payload: RefMatchedResponse) => Promise<void> | void;

export type SignalingPayload = {
    type: string;
    sender: string;
    target?: string;
    payload?: any;
    correlation?: string;
};

export const ZeroUuid = "00000000-0000-0000-0000-000000000000";

enum ReadyStates {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3
};

export class VooshWebRtcClient {
    private ws: WebSocket;
    private peerConnection?: RTCPeerConnection;
    private dataChannel?: RTCDataChannel;
    private myId?: string;
    private s?: string;
    private targetId?: string; // Set this to the other peer's ID to connect
    private setup?: RTCConfiguration;
    private readonly messageQueueSignalingServer: any[];
    private readonly messageQueueP2PFriend: any[];
    private readonly messageQueueIceCandidate: RTCIceCandidate[];
    private refMatchedHandler?: RefMatchedIsolationEventHandler;

    private reconnectAttempts = 0;
    private readonly maxAttempts = 10;
    private baseDelayMs = 1000;
    private maxDelayMs = 30000;
    private pingIntervalMs = 20000;
    private pingTimer?: ReturnType<typeof setInterval>;
    private pongTimeoutTimer?: ReturnType<typeof setTimeout>;
    private signalingServerUrlDeferred: () => string = () => "ws://localhost:8080/ss";
    private refRequestHandler?: RefRequestEventHandler;
    
    private readonly FINISHED = 1000;
    
    private readonly p2pHandlers: Map<string, WebRtcIsolationEventHandler | undefined>;
    private p2pDataChannelLabel = "arquive-me";
    private isRemoteDescriptionSet = false;

    private readonly p2pResolvers: Map<string, { resolve(): void }>;
    private readonly p2pResolverTimers: Map<string, number>;

    private cannotUploadFurther = false;
    private readonly basicTimeoutForP2PInMs = 2_800; // Possible values: 0.2x, 1x, 2x, 17x.

    constructor(signalingServerUrlDeferred: () => string) {
        if (signalingServerUrlDeferred) {
            this.signalingServerUrlDeferred = signalingServerUrlDeferred;
        }
        this.ws = new WebSocket(this.signalingServerUrlDeferred());
        this.p2pHandlers = new Map<string, WebRtcIsolationEventHandler | undefined>();
        this.p2pResolvers = new Map<string, { resolve(): void }>();
        this.p2pResolverTimers = new Map<string, number>();
        this.messageQueueIceCandidate = [];
        this.messageQueueP2PFriend = [];
        this.messageQueueSignalingServer = [];
    }

    private flushSignalingServerQueue() {
        console.info(`signaling server message queue with ${this.messageQueueSignalingServer.length} element(s) has been flushed!`);
        while (this.messageQueueSignalingServer.length > 0 && this.ws.readyState == WebSocket.OPEN) {
            const queueHead = this.messageQueueSignalingServer.shift();
            this.ws.send(JSON.stringify(queueHead));
        }
    }

    private startSignalingServerHeartbeatLoop() {
        this.pingTimer = setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.sendToSignalingServer({ type: "ping", sender: this.myId });
                this.pongTimeoutTimer = setTimeout(() => {
                    console.warn("Signaling server heartbeat timed out. Severing link.");
                    this.ws.close();
                }, this.basicTimeoutForP2PInMs);
            }
        }, this.pingIntervalMs);
    }

    private handleSignalingServerPongReceived() {
        if (this.pongTimeoutTimer) {
            clearTimeout(this.pongTimeoutTimer);
        }
    }

    private cleanUpSignalingServerTimers() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
        }
        if (this.pongTimeoutTimer) {
            clearInterval(this.pongTimeoutTimer);
        }
    }

    private disconnectGracefullyFromSignalingServer() {
        this.cleanUpSignalingServerTimers();
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close(this.FINISHED);
        }
    }

    private connectToSignalingServer() {
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            this.ws = new WebSocket(this.signalingServerUrlDeferred());
        } else {
            console.warn(`Things do not look neat, signaling server closed the connection`);
        }
    }

    private scheduleSignalingServerRetry() {
        if (this.reconnectAttempts >= this.maxAttempts) {
            console.error(`maximum reconnect threshold (${this.maxAttempts}) hit. Aborting`);
            return;
        }

        const calculatedDelay = Math.min((1 << this.reconnectAttempts) * this.baseDelayMs,
            this.maxDelayMs);
        const jitter = Math.random() * 200 - 100;
        const finalDelay = Math.max(0, calculatedDelay + jitter);

        this.reconnectAttempts++;
        console.warn(`Signaling link lost. Retrying (#${this.reconnectAttempts}) in ${Math.round(finalDelay)}ms`);

        setTimeout(() => this.connectToSignalingServer(), finalDelay);
    }

    sendRef(ref: string): VooshWebRtcClient {
        console.log(`sending out ref request for ref [${ref}]`)
        this.sendToSignalingServer({
            type: "refrequest",
            sender: this.myId,
            target: ZeroUuid,
            payload: ref
        });
        return this;
    }

    onUpload(refRequestHandler?: RefRequestEventHandler): VooshWebRtcClient {
        if (this.refMatchedHandler) {
            console.error("you cannot upload and download at the same time!");
        } else {
            this.refRequestHandler = refRequestHandler;
        }
        return this;
    }

    onDownload(refMatchedHandler: RefMatchedIsolationEventHandler): VooshWebRtcClient {
        if (this.refRequestHandler) {
            console.error("you cannot download and upload at the same time");
        } else {
            this.refMatchedHandler = refMatchedHandler;
        }
        return this;
    }

    getPublicKeyWithoutLabels(r: string): string {
        return r
            .replace(/-----(BEGIN|END)[^-]+-----/g, '')
            .replace(/[^A-Za-z0-9+/=]/g, '');
    }

    prepare(): VooshWebRtcClient {
        this.ws.onopen = async () => {
            console.log("Signaling server connected!");
            this.flushSignalingServerQueue();
            this.startSignalingServerHeartbeatLoop();
            this.reconnectAttempts = 0;
        };

        this.ws.onmessage = async (event) => {
            //console.info(`event.data = ${event.data}`);
            const message = JSON.parse(event.data);

            this.removeExpiredP2PResolveTimers();
            this.resolveCorrelationIds(message);

            switch (message.type) {
                // Related to the signaling server.
                case 'pong':
                    this.handleSignalingServerPongReceived();
                    break;

                case 'welcome':
                    this.myId = this.myId || message.id;
                    this.s = message.r;
                    this.sendToSignalingServer({
                        type: 'welcomeAck',
                        sender: message.id,
                        confirm: this.myId
                    });
                    console.log(`suggestedId: [${message.id}], keptMyId: [${this.myId}]`);
                    break;

                case 'setup':
                    const rsa = new NodeRSA(this.s!);
                    const originalPayload = rsa.decryptPublic(message.payload, 'utf8');
                    this.setup = JSON.parse(originalPayload) as RTCConfiguration;
                    console.log(`Setup message received`);
                    break;

                case 'refrequest':
                    if (this.refRequestHandler) {
                        const response = await this.refRequestHandler(message.payload, message.sender);
                        if (response) {
                            console.log(`downloader candidate id [${message.sender}] gave me matching ref: [${message.payload}]`);
                            const payloadWithDetails = {
                                type: "refmatched",
                                sender: this.myId,
                                target: message.sender,
                                payload: response
                            };
                            this.sendToSignalingServer(payloadWithDetails);
                        } else {
                            console.log(`we don't have ref [${message.ref}] here`);
                        }
                    } else {
                        console.log(`this is not an uploader`);
                    }
                    break;

                case 'refmatched':
                    if (this.refMatchedHandler) {
                        const isolationContext = {
                            download: async () => {
                                console.log("download message being sent");
                                this.targetId = message.sender;
                                this.sendToSignalingServer({
                                    type: "dl",
                                    sender: this.myId,
                                    target: this.targetId
                                });
                                // Start P2P sender.
                                await this.createReceiverP2PConnection();
                            }
                        };
                        await this.refMatchedHandler(isolationContext, message.payload);
                        console.log("ref matched, awaiting download approval");
                    } else { 
                        console.info("received ref matched message for no reason");
                    }
                    break;

                case 'dl':
                    if (this.cannotUploadFurther) {
                        console.log(`cannot upload further, ignoring dl message from [${message.sender}]`);
                    } else {
                        this.cannotUploadFurther = true;
                        // Start P2P receiver.
                        this.targetId = message.sender;
                        console.log(`i've found somebody to give the file to: id [${this.targetId}]`);
                        await this.createSenderP2PConnection();
                    }
                    break;
                    
                // Related to the WebRTC syncing mechanism.
                case 'remoteIceCandidate': {
                    this.sendToSignalingServer({
                        type: "remoteIceCandidateAck",
                        correlation: message.correlation,
                        sender: this.myId,
                        target: this.targetId
                    });
                    this.addIceCandidate(new RTCIceCandidate(message.payload));
                    break;
                }
                case 'offerToReceiver': {
                    this.sendToSignalingServer({
                        type: "offerToReceiverAck",
                        correlation: message.correlation,
                        sender: this.myId,
                        target: this.targetId
                    });
                    const { sdp, type } = message.payload;
                    setTimeout(async () => {
                        await this.peerConnection!.setRemoteDescription({
                            sdp: sdp,
                            type: type
                        });
                        this.isRemoteDescriptionSet = true;
                        this.flushIceCandidateQueue();
                        const answer = await this.peerConnection!.createAnswer();
                        await this.gotReceiverP2PDescription(this.peerConnection!, answer);
                        console.log("signaling server received sender description message");
                    }, this.basicTimeoutForP2PInMs);
                    break;
                }
                case 'answerToSender': {
                    this.sendToSignalingServer({
                        type: "answerToSenderAck",
                        correlation: message.correlation,
                        sender: this.myId,
                        target: this.targetId
                    });
                    const { sdp, type } = message.payload;
                    setTimeout(async () => {
                        await this.peerConnection!.setRemoteDescription({
                            sdp: sdp,
                            type: type
                        });
                        this.isRemoteDescriptionSet = true;
                        this.flushIceCandidateQueue();
                    }, this.basicTimeoutForP2PInMs);
                    break;
                }
                default:
                    console.warn(`dropping message type: ${message.type}`);
                    break;
            }
        };

        this.ws.onclose = (event: CloseEvent) => {
            console.warn("Signaling socket closed. Retrying...");
            this.cleanUpSignalingServerTimers();

            if (event.code !== this.FINISHED) {
                this.scheduleSignalingServerRetry();
            }
        };

        this.ws.onerror = (error) => {
            console.error("Signaling socket error", error);
            this.ws.close(this.FINISHED);
        }

        return this;
    }

    private removeExpiredP2PResolveTimers() {
        for (const [ uuid, pastTime ] of this.p2pResolverTimers.entries()) {
            // messages cannot take more than 1 minute to respond, or else
            // they are dropped.
            if (pastTime && pastTime + (1 * 60 * 1000) < new Date().getTime()) {
                this.p2pResolverTimers.delete(uuid);
                this.p2pResolvers.delete(uuid);
                console.log(`correlation ${uuid} expired`);
            }
        }
    }

    private resolveCorrelationIds(message: any) {
        if ((message.type as string).endsWith("Ack") === false) return;

        console.log(`resolving message.type is [${message.type}]`);

        const correlationId = message.correlation as string;
        const callback = this.p2pResolvers.get(correlationId);

        if (!!callback)
            callback.resolve();
        else
            console.warn(`[${message.type}] didn't have a valid resolve() to call`);

        this.p2pResolvers.delete(correlationId);
        this.p2pResolverTimers.delete(correlationId);

        console.log(`inbound message with correlation ${message.correlation} was resolved`);
    }

    private sendToSignalingServer(message: any) {
        //console.info(`outbound.payload = ${JSON.stringify(message)}`);
        this.messageQueueSignalingServer.push(message);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.flushSignalingServerQueue();
        } else {
            console.log(`Socket closed with state ${ReadyStates[this.ws.readyState]}... retrying`)
            this.cleanUpSignalingServerTimers();
            this.scheduleSignalingServerRetry();
        }
    }

    private addIceCandidate(candidate: RTCIceCandidate) {
        this.messageQueueIceCandidate.push(candidate);
        if (this.isRemoteDescriptionSet) {
            this.flushIceCandidateQueue();
        } else {
            console.log(`remote description has not been set yet`);
        }
    }

    private flushP2PFriendQueue() {
        console.info(`p2p friend message queue with [${this.messageQueueP2PFriend.length}] element(s) has been flushed!`);
        while (this.messageQueueP2PFriend.length > 0 && this.dataChannel?.readyState === "open") {
            const queueHead = this.messageQueueP2PFriend.shift();
            this.dataChannel?.send(JSON.stringify(queueHead));
        }
    }

    private flushIceCandidateQueue() {
        console.info(`ICE candidate queue with [${this.messageQueueIceCandidate.length}] element(s) has been flushed!`);
        while (this.messageQueueIceCandidate.length > 0) {
            const queueHead = this.messageQueueIceCandidate.shift();
            this.peerConnection?.addIceCandidate(queueHead);
        }
    }

    private sendToP2PFriend(payload: any) {
        this.messageQueueP2PFriend.push(payload);

        if (this.dataChannel && this.dataChannel.readyState === "open") {
            this.flushP2PFriendQueue();
        } else {
            console.warn(`WebRTC data channel is [${this.dataChannel?.readyState ?? "dead"}]`)
        }
    }

    public onP2PHandler(type: string, eventHandler: WebRtcIsolationEventHandler): VooshWebRtcClient {
        if (!this.p2pHandlers.has(type) || !this.p2pHandlers.get(type)) {
            console.log(`i could register event handler for p2p message type [${type}]`);
            this.p2pHandlers.set(type, eventHandler);
        } else {
            console.log(`there is a p2p event handler already registered for type [${type}]`);
        }
        return this;
    }

    public offP2PHandler(type: string): VooshWebRtcClient {
        this.p2pHandlers.set(type, undefined);
        console.log(`event handler for p2p message type [${type}] has been removed!`);
        return this;
    }

    /**
     * 
     * New version of the WebRTC state machine, below, after losing sleep over
     * an AI model's spaghetti code for one entire week (60 hours at least of work lost).
     * 
    */
   async createSenderP2PConnection() {
        const self = this;
        console.log("createSenderP2PConnection has started");
        
        this.peerConnection = new RTCPeerConnection(this.setup);        
        
        this.peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                console.info(`ICE candidate has been created`);
                await this.fire("remoteIceCandidate", event.candidate);
            }
        };
        
        this.dataChannel = this.peerConnection.createDataChannel(this.p2pDataChannelLabel, { ordered: true });
        this.dataChannel.onopen = () => {
            const readyState = self.dataChannel?.readyState ?? "dead";
            if (readyState === "open") {
                console.log("kick-starting p2p messaging");
                self.sendToP2PFriend({ type: "welcome" });
            }
        };
        this.dataChannel.onclose = () => console.log("p2p channel closed");
        this.dataChannel.onmessage = event => {
            const message = JSON.parse(event.data);
            //console.log(`inbound p2p = ${event.data}`);

            // Call handler by type.
            if (message && self.p2pHandlers.has(message.type) && self.p2pHandlers.get(message.type)) {
                console.log(`handling p2p message type ${message.type}`);
                const eventHandler = self.p2pHandlers.get(message.type)!;
                // Call event handler.
                eventHandler(message.type, message.payload, {
                    sendMessage: payload => self.sendToP2PFriend(payload),
                    abortChannel: () => {
                        self.dataChannel!.close();
                        self.disconnectGracefullyFromSignalingServer();
                    }
                });
                console.log(`p2p handler for type ${message.type} finished`);
            } else {
                console.log(`dropped p2p message type ${message.type}`);
            }
        };
        
        this.peerConnection.oniceconnectionstatechange = async () => {
            const status = this.peerConnection!.iceConnectionState;
            
            if (status === "disconnected") {
                let timeout = self.basicTimeoutForP2PInMs / 10.0;
                (function reconnect() {
                    console.log("Network temporarily disrupted, attempting recovery...");
                    setTimeout(() => {
                        if (self.peerConnection!.iceConnectionState === "disconnected" ||
                            self.peerConnection!.iceConnectionState === "failed") {
                            console.log("Reconnecting to P2P friend...");
                            self.peerConnection!.restartIce();
                            reconnect();
                        } else {
                            console.log(`Connection recovered, state ${self.peerConnection!.iceConnectionState}`);
                        }
                    }, Math.min(timeout <<= 1, 17.0 * self.basicTimeoutForP2PInMs));
                })();
            }
            
            if (status === "failed") {
                console.log("Connection failed. Initiating ICE restart...");
                this.peerConnection!.restartIce();
                // Restart WebRTC state machine.
                this.isRemoteDescriptionSet = false;
                const offer = await this.peerConnection!.createOffer();
                await this.gotSenderP2PDescription(this.peerConnection!, offer)
            }
            
            if (status === "closed") {
                console.log("Connection permanently closed.");
            }
        };

        // Start WebRTC state machine.
        const offer = await this.peerConnection.createOffer();
        await this.gotSenderP2PDescription(this.peerConnection!, offer)
    }
    
    createReceiverP2PConnection() {
        const self = this;
        console.log("createReceiverP2PConnection has started");

        this.peerConnection = new RTCPeerConnection(this.setup);
        this.peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                console.info(`ICE candidate has been created`);
                await this.fire("remoteIceCandidate", event.candidate);
            }
        };

        this.peerConnection.ondatachannel = event => {
            console.log("onReceiverChannelCallback triggered");
            
            self.dataChannel = event.channel;
            self.dataChannel.onmessage = event => {
                const message = JSON.parse(event.data);
                //console.log(`inbound p2p = ${event.data}`);

                // Call handler by type.
                if (message && self.p2pHandlers.has(message.type)) {
                    console.log(`handling p2p message type ${message.type}`);
                    const eventHandler = self.p2pHandlers.get(message.type);
                    if (eventHandler) {
                        eventHandler(message.type, message.payload, {
                            sendMessage: payload => self.sendToP2PFriend(payload),
                            abortChannel: () => self.dataChannel!.close()
                        });
                        console.log(`p2p handler for type ${message.type} finished`);
                    } else {
                        console.warn(`dropped p2p message due to empty handler for type ${message.type}`);
                    }
                } else {
                    console.warn(`dropped p2p message type ${message.type}`);
                }
            };
            
            self.dataChannel.onopen = () => console.log("p2p channel open");
            self.dataChannel.onclose = () => {
                const readyState = self.dataChannel?.readyState ?? "dead";
                if (readyState === "closed") {
                    console.log("p2p channel closed");
                }
            }
        }
        
        this.peerConnection.oniceconnectionstatechange = async (_) => {
            const status = this.peerConnection!.iceConnectionState;

            if (status === "disconnected") {
                console.log("Network temporarily disrupted, waiting for recovery...");
            }

            if (status === "failed") {
                console.log("Connection failed. Initiating ICE restart...");
                this.peerConnection!.restartIce();
                // Restart WebRTC state machine.
                this.isRemoteDescriptionSet = false;
            }

            if (status === "closed") {
                console.log("Connection permanently closed.");
            }
        };
    }
    
    private async fire(type: string, payload: any): Promise<void> {
        const { promise, resolve, reject } = Promise.withResolvers<void>();

        const correlation = crypto.randomUUID();
        const payloadWithCorrelation = { 
            type: type, 
            payload: payload, 
            correlation: correlation,
            sender: this.myId,
            target: this.targetId 
        };
        this.sendToSignalingServer(payloadWithCorrelation);

        // Register correlation IDs for later use.
        this.p2pResolvers.set(correlation, { resolve: resolve });
        this.p2pResolverTimers.set(correlation, new Date().getTime());

        // Timeout counter.
        const timeoutId = setTimeout(reject, 10_000);
        await promise;

        // Stop timeout counter because everything went fine.
        clearTimeout(timeoutId);
    }

    private async gotSenderP2PDescription(peerConnection: RTCPeerConnection, offer: RTCSessionDescriptionInit) {
        console.log("got offer (produced by sender)");
        await peerConnection.setLocalDescription(offer);
        setTimeout(async () => await this.fire("offerToReceiver", offer), this.basicTimeoutForP2PInMs);
    }
    
    private async gotReceiverP2PDescription(peerConnection: RTCPeerConnection, answer: RTCSessionDescriptionInit) {
        console.log("got answer (produced by receiver)");
        await peerConnection.setLocalDescription(answer);
        setTimeout(async () => await this.fire("answerToSender", answer), this.basicTimeoutForP2PInMs);
    }
}
