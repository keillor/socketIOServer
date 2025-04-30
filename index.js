import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";

//supabase initialization
const supabase = createClient(process.env['PUBLIC_SUPABASE_URL'], process.env['PRIVATE_SUPABASE_KEY']);

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

io.use(async (socket, next) => {
  try{
    const token = socket.handshake.auth.token;
    const campaign = socket.handshake.auth.campaign;
    console.log()
    if (!token) {
      return next(new Error("authentication error: Token missing."))
    }

    const{ data: {user}} = await supabase.auth.getUser(token);
    if(!user && !campaign) {
      return next(new Error("authentication error: Invalid token."))
    }
    socket.user = user
    socket.campaign = campaign;
    next();
  } catch (error) {
    console.error('Authentication error with Socket.IO', error);
    return next(new Error("authentication error: internal server error"));
  }
})

io.on("connection", async (socket) => {
  //save the campaign id
  const campaign = socket.campaign;
  socket.join(campaign);
  socket.to(campaign).emit('message', 'a user connected');

  //user disconnects
  socket.on('disconnect', () => {
    console.log('a user disconnected');
  })

  //TODO: remove msg. this is not meant for production
  socket.on("message", (msg) => {
    console.log(`user ${socket.user.id} said: ${msg}`);
    io.to(campaign).emit("message", msg);
  });

  //dragable waypoint moved
  socket.on('dragableMoved', (pos) => {
    io.to(campaign).emit('dragableMoved', pos);
    //pos {x,y,id, (character, monster, object)}
    //TODO: call mongo. update position
  })

  socket.on('moveMarker', (markerObject) => {
    io.to(campaign).emit('moveMarker', markerObject);
  })

  socket.on('createShape', (shape) => {
    io.to(campaign).emit('createShape', shape);

    //TODO: call mongo, add shape
  })

  socket.on('removeShape', (shape) => {
    io.to(campaign).emit('removeShape', shape);

    //TODO: call mongo, remove shape
  })

  socket.on('roll', (roll) => {
    console.log(roll);
    io.to(campaign).emit('roll', roll);
  })



  
});

server.listen(5001, () => {
  console.log("server running!");
});
