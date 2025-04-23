import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true,
  }
});

const __dirname = dirname(fileURLToPath(import.meta.url));


app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

io.on("connection", (socket) => {
  console.log('a user connected');
  io.emit('message', 'a user connected');


  socket.on('disconnect', () => {
    console.log('a user disconnected')
  })

  socket.on("message", (msg) => {
    console.log("message recieved:", msg);
    io.emit("message", msg);
  });
});


server.listen(5000, () => {
  console.log("server running!");
});
