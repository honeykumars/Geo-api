// Global State (Lives in RAM - Clears when empty)
const liveState = new Map(); 
const ADMIN_CODE = "1299"; 

export default {
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("🌍 Global Pulse Engine v3.0 | Status: Active", { 
        headers: { "Content-Type": "text/plain" } 
      });
    }

    const [client, server] = Object.values(new Uint32Array(2)).map(() => new WebSocketPair());
    server.accept();

    server.addEventListener("message", (msg) => {
      try {
        const data = JSON.parse(msg.data);
        
        // 1. JOIN LOGIC
        if (data.type === "join") {
          server.room = data.room || "General";
          if (!liveState.has(server.room)) {
            liveState.set(server.room, { users: new Set(), pin: null, muted: false });
          }
          liveState.get(server.room).users.add(server);
          return;
        }

        const room = liveState.get(server.room);
        if (!room) return;

        // 2. ADMIN POWER CHECK (CODE: 1299)
        if (data.admin_key === ADMIN_CODE) {
          if (data.action === "mute") {
            room.muted = data.value;
            broadcast(room, { type: "sys_alert", text: data.value ? "🔇 Owner has muted chat." : "🔊 Chat Resumed.", vibrate: true });
          } 
          else if (data.action === "redirect") {
            broadcast(room, { type: "sys_redirect", url: data.url });
          }
          else if (data.action === "broadcast") {
            broadcast(room, { type: "chat", user: "👑 OWNER", text: data.text, isOwner: true, vibrate: true });
          }
          return;
        }

        // 3. REGULAR USER RESTRICTION
        if (room.muted && data.type === "chat") {
          server.send(JSON.stringify({ type: "sys_error", text: "Read-only mode active." }));
          return;
        }

        // 4. GENERAL RELAY (Text, Likes, Replies, Media)
        broadcast(room, data);

      } catch (e) { console.log("Stream Error"); }
    });

    server.addEventListener("close", () => {
      if (server.room && liveState.has(server.room)) {
        const room = liveState.get(server.room);
        room.users.delete(server);
        if (room.users.size === 0) liveState.delete(server.room);
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
};

function broadcast(room, data) {
  const payload = JSON.stringify({
    ...data,
    id: Date.now(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  room.users.forEach(u => u.send(payload));
}