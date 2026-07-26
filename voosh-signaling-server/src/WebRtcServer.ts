import NodeRSA from 'node-rsa';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ path: "/ss", port: 8080 });
const clients = new Map(); // Store active connections by ID

wss.on('connection', (ws, req) => {
  let clientId = crypto.randomUUID();
  console.log(`Client connected: [${clientId}] at [${req.url}]`);
  clients.set(clientId, ws);
  
  const rsa = new NodeRSA({ b: 2048 });
  
  // Inform the client of their assigned ID
  ws.send(JSON.stringify(getWelcomeMessage()));
  // Send setup message
  ws.send(JSON.stringify(getSetupMessage()));

  function getWelcomeMessage() {
    const r = rsa.exportKey("public");
    return { type: 'welcome', id: clientId, r: r };
  }

  function getSetupMessage() {
    const setup: RTCConfiguration = { iceServers: [
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
            credential: "zQ+j4EcQs1WwRpoX"
        }]};

    const base64RsaEncryptedPayload = rsa.encryptPrivate(setup, 'base64');
    return { type: 'setup', payload: base64RsaEncryptedPayload };
  }

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      const { target, type, payload, correlation } = data;

      // Handle heartbeat.
      if (type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
      }

      if (type === "welcomeAck") {
        const { confirm } = data;
        if (clientId !== confirm) {
          console.log(`suggestedId: ${clientId} keepMyId: ${confirm}`);
          // Update the key (clientId -> confirm) while keeping the ws.
          const improperWs = clients.get(clientId)!;
          clients.set(confirm, improperWs);
          clients.delete(clientId);
          clientId = confirm;
        }
        return;
      }

      // Forward message to target peer if they exist
      if (target && !isZeroUuid(target) && clients.has(target)) {
        clients.get(target).send(JSON.stringify({
          sender: clientId,
          type: type,
          correlation: correlation,
          payload
        }));
        return;
      }
      
      // Broadcast message if target is the UUID.zero value
      if (isZeroUuid(target)) {
        console.log("broadcasting message");
        clients.forEach((wss, target) => {
            if (target != clientId) {
              console.log(`broadcast from [${clientId}] to [${target}]`);
              wss.send(JSON.stringify({ 
                  sender: clientId,
                  type: type,
                  payload
              }));
            } else {
              console.info(`dropping broadcast message from [${clientId}] to [${target}]`);
            }
        });
        return;
      }

      // fallback: drop message.
      console.log(`invalid target, dropping message ${message}`);
    } catch (error) {
      console.error('Invalid message format:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client disconnected: [${clientId}]`);
  });
});

console.log(`Signaling server running!`);

function isZeroUuid(uuid: string): boolean {
  return /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(uuid);
}
