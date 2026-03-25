import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Game State
  const rooms = new Map<string, any>();

  function generateCard() {
    const card = Array(3).fill(null).map(() => Array(9).fill(null));
    for (let row = 0; row < 3; row++) {
      const positions = [];
      while (positions.length < 5) {
        const pos = Math.floor(Math.random() * 9);
        if (!positions.includes(pos)) positions.push(pos);
      }
      positions.sort((a, b) => a - b);
      
      positions.forEach(col => {
        let min = col * 10 + 1;
        let max = col * 10 + 10;
        if (col === 0) min = 1;
        if (col === 8) max = 90;
        
        let num;
        do {
          num = Math.floor(Math.random() * (max - min + 1)) + min;
        } while (card.some(r => r[col] === num));
        
        card[row][col] = num;
      });
    }
    return card;
  }

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, username }) => {
      socket.join(roomId);
      
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          id: roomId,
          players: [],
          drawnNumbers: [],
          availableNumbers: Array.from({ length: 90 }, (_, i) => i + 1),
          status: "waiting",
          lastNumber: null,
          winner: null,          // для хранения победителя
          timeoutId: null,
        });
      }

      const room = rooms.get(roomId);
      const player = {
        id: socket.id,
        username,
        cards: [generateCard(), generateCard(), generateCard()],
        ready: false,
      };
      
      room.players.push(player);
      io.to(roomId).emit("room-update", room);
    });

    socket.on("start-game", ({ roomId, intervalMs }) => {
      const room = rooms.get(roomId);
      if (room && room.status === "waiting") {
        room.status = "playing";
        room.drawnNumbers = [];
        room.availableNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
        room.drawInterval = intervalMs || 4000;
        room.winner = null; // сброс победителя на случай рестарта
        io.to(roomId).emit("game-started", room);
        
        // Start drawing numbers
        const drawNext = () => {
          if (room.status !== "playing" || room.availableNumbers.length === 0 || room.winner) {
            return;
          }
          
          const idx = Math.floor(Math.random() * room.availableNumbers.length);
          const num = room.availableNumbers.splice(idx, 1)[0];
          room.drawnNumbers.push(num);
          room.lastNumber = num;
          
          io.to(roomId).emit("new-number", { number: num, drawnNumbers: room.drawnNumbers });
          
          room.timeoutId = setTimeout(drawNext, room.drawInterval);
        };

        if (room.timeoutId) clearTimeout(room.timeoutId);
        room.timeoutId = setTimeout(drawNext, room.drawInterval);
      }
    });

    socket.on("stop-game", (roomId) => {
      const room = rooms.get(roomId);
      if (room) {
        room.status = "waiting";
        if (room.timeoutId) clearTimeout(room.timeoutId);
        io.to(roomId).emit("room-update", room);
      }
    });

    socket.on("bingo", ({ roomId, cardIdx }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      // Если игра не в процессе или уже есть победитель – игнорируем
      if (room.status !== "playing" || room.winner) return;

      // Находим игрока, отправившего bingo
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player) return;

      // Проверяем, что все числа на указанной карточке действительно выпали
      const card = player.cards[cardIdx];
      const cardNumbers = card.flat().filter((n: number | null) => n !== null);
      const allDrawn = cardNumbers.every((num: number) => room.drawnNumbers.includes(num));
      if (!allDrawn) return;

      // Объявляем победителя
      room.winner = {
        username: player.username,
        winnerId: socket.id,
        cardIdx: cardIdx,
      };
      room.status = "finished";
      if (room.timeoutId) clearTimeout(room.timeoutId);
      io.to(roomId).emit("winner", { username: player.username, winnerId: socket.id });
    });

    socket.on("disconnect", () => {
      rooms.forEach((room, roomId) => {
        const index = room.players.findIndex((p: any) => p.id === socket.id);
        if (index !== -1) {
          room.players.splice(index, 1);
          if (room.players.length === 0) {
            if (room.timeoutId) clearTimeout(room.timeoutId);
            rooms.delete(roomId);
          } else {
            io.to(roomId).emit("room-update", room);
          }
        }
      });
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();