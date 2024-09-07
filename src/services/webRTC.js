const WebSocket = require("ws");
const { processAudio } = require("./audioProcessing");

const rooms = new Map();

exports.setupWebRTC = (ws) => {
  ws.on("message", async (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "join":
        handleJoin(ws, data);
        break;
      case "offer":
        handleOffer(ws, data);
        break;
      case "answer":
        handleAnswer(ws, data);
        break;
      case "ice-candidate":
        handleIceCandidate(ws, data);
        break;
      case "leave":
        handleLeave(ws, data);
        break;
      case "audio":
        handleAudio(ws, data);
        break;
    }
  });

  ws.on("close", () => {
    // Handle disconnection
    for (const [roomId, room] of rooms.entries()) {
      const index = room.participants.findIndex((p) => p.ws === ws);
      if (index !== -1) {
        room.participants.splice(index, 1);
        broadcastToRoom(roomId, {
          type: "participant-left",
          participantId: room.participants[index].id,
        });
        break;
      }
    }
  });
};

function handleJoin(ws, data) {
  const { roomId, participantId } = data;
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { participants: [] });
  }
  const room = rooms.get(roomId);
  room.participants.push({ id: participantId, ws });
  broadcastToRoom(roomId, {
    type: "participant-joined",
    participantId,
  });
}

function handleOffer(ws, data) {
  const { roomId, to, offer } = data;
  const room = rooms.get(roomId);
  const recipient = room.participants.find((p) => p.id === to);
  if (recipient) {
    recipient.ws.send(
      JSON.stringify({
        type: "offer",
        offer,
        from: data.from,
      }),
    );
  }
}

function handleAnswer(ws, data) {
  const { roomId, to, answer } = data;
  const room = rooms.get(roomId);
  const recipient = room.participants.find((p) => p.id === to);
  if (recipient) {
    recipient.ws.send(
      JSON.stringify({
        type: "answer",
        answer,
        from: data.from,
      }),
    );
  }
}

function handleIceCandidate(ws, data) {
  const { roomId, to, candidate } = data;
  const room = rooms.get(roomId);
  const recipient = room.participants.find((p) => p.id === to);
  if (recipient) {
    recipient.ws.send(
      JSON.stringify({
        type: "ice-candidate",
        candidate,
        from: data.from,
      }),
    );
  }
}

function handleLeave(ws, data) {
  const { roomId, participantId } = data;
  const room = rooms.get(roomId);
  if (room) {
    const index = room.participants.findIndex((p) => p.id === participantId);
    if (index !== -1) {
      room.participants.splice(index, 1);
      broadcastToRoom(roomId, {
        type: "participant-left",
        participantId,
      });
    }
  }
}

async function handleAudio(ws, data) {
  const { roomId, audioData } = data;
  const processedAudio = await processAudio(audioData);
  broadcastToRoom(roomId, {
    type: "audio",
    audioData: processedAudio,
    from: data.from,
  });
}

function broadcastToRoom(roomId, message) {
  const room = rooms.get(roomId);
  if (room) {
    room.participants.forEach((participant) => {
      participant.ws.send(JSON.stringify(message));
    });
  }
}
