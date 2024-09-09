// const WebSocket = require("ws");
// const jwt = require("jsonwebtoken");
// const { pool } = require("../config/database");

// function setupChatWebSocket(server) {
//   const wss = new WebSocket.Server({ server, path: "/ws/chats" });

//   wss.on("connection", async (ws, req) => {
//     const token = req.url.split("token=")[1];

//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       const userId = decoded.userId;
//       const chatId = req.url.split("/")[2];

//       // Verify user's access to the chat
//       const chatAccess = await pool.query(
//         "SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
//         [chatId, userId],
//       );

//       if (chatAccess.rows.length === 0) {
//         ws.close();
//         return;
//       }

//       ws.userId = userId;
//       ws.chatId = chatId;

//       ws.on("message", async (message) => {
//         const data = JSON.parse(message);

//         // Handle different types of messages (new message, typing indicator, etc.)
//         switch (data.type) {
//           case "new_message":
//             // Save message to database
//             const result = await pool.query(
//               "INSERT INTO chat_messages (chat_id, user_id, message) VALUES ($1, $2, $3) RETURNING *",
//               [chatId, userId, data.message],
//             );

//             // Broadcast message to all clients in the chat
//             wss.clients.forEach((client) => {
//               if (client.chatId === chatId) {
//                 client.send(
//                   JSON.stringify({
//                     type: "new_message",
//                     message: result.rows[0],
//                   }),
//                 );
//               }
//             });
//             break;

//           // Handle other message types
//         }
//       });

//       ws.on("close", () => {
//         // Handle disconnection
//       });
//     } catch (error) {
//       console.error("WebSocket authentication error:", error);
//       ws.close();
//     }
//   });
// }

// module.exports = setupChatWebSocket;

const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");

function setupChatWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: "/ws/chats" });

  wss.on("connection", async (ws, req) => {
    const token = req.url.split("token=")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      const chatId = req.url.split("/")[2];

      // Verify user's access to the chat
      const chatAccess = await pool.query(
        "SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
        [chatId, userId],
      );

      if (chatAccess.rows.length === 0) {
        ws.close(1008, "User not authorized for this chat");
        return;
      }

      ws.userId = userId;
      ws.chatId = chatId;

      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message);

          switch (data.type) {
            case "new_message":
              const result = await pool.query(
                "INSERT INTO chat_messages (chat_id, user_id, message) VALUES ($1, $2, $3) RETURNING *",
                [chatId, userId, data.message],
              );

              wss.clients.forEach((client) => {
                if (
                  client.chatId === chatId &&
                  client.readyState === WebSocket.OPEN
                ) {
                  client.send(
                    JSON.stringify({
                      type: "new_message",
                      message: result.rows[0],
                    }),
                  );
                }
              });
              break;

            // Handle other message types
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Error processing message",
            }),
          );
        }
      });

      ws.on("close", (code, reason) => {
        console.log(
          `WebSocket closed for user ${userId} in chat ${chatId}. Code: ${code}, Reason: ${reason}`,
        );
        // Handle disconnection (e.g., update user status, clean up resources)
      });

      ws.on("error", (error) => {
        console.error(
          `WebSocket error for user ${userId} in chat ${chatId}:`,
          error,
        );
      });
    } catch (error) {
      console.error("WebSocket authentication error:", error);
      ws.close(1008, "Authentication failed");
    }
  });

  // Implement a heartbeat mechanism to detect dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping(() => {});
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });
}

module.exports = setupChatWebSocket;
