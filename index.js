import express from "express";
  import { createServer } from "node:http";
  import { fileURLToPath } from "node:url";
  import { dirname, join } from "node:path";
  import { Server } from "socket.io";
  import { createClient } from "@supabase/supabase-js";
  import { MongoClient, ObjectId } from "mongodb"; // Import MongoDB client

  // Supabase initialization
  const supabase = createClient(process.env['PUBLIC_SUPABASE_URL'], process.env['PRIVATE_SUPABASE_KEY']);

  // MongoDB initialization
  const mongoClient = new MongoClient(process.env['MONGO_URL']); // MongoDB connection URI
  let client; // Reference to the database

  async function connectToMongo() {
    try {
      await mongoClient.connect(); // Connect to MongoDB
      console.log("Connected to MongoDB");
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
      process.exit(1); // Exit the process if the connection fails
    }
  }

  // Call the function to connect to MongoDB
  // 
  try {
    await connectToMongo();
  } catch {
    console.error('Unable to connect to mongo!');
  }

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "https://guild-table.98.148.238.215.sslip.io/",
      credentials: true,
    }
  });

  const __dirname = dirname(fileURLToPath(import.meta.url));

  app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "index.html"));
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const campaign = socket.handshake.auth.campaign;
      if (!token) {
        return next(new Error("authentication error: Token missing."));
      }

      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user && !campaign) {
        return next(new Error("authentication error: Invalid token."));
      }
      socket.user = user;
      socket.campaign = campaign;
      next();
    } catch (error) {
      console.error("Authentication error with Socket.IO", error);
      return next(new Error("authentication error: internal server error"));
    }
  });

  io.on("connection", async (socket) => {
    const campaign = socket.campaign;
    socket.join(campaign);
    socket.to(campaign).emit('message', 'a user connected');

    // Example: Query MongoDB for a collection
    // const collection = db.collection("campaigns"); // Reference the "campaigns" collection
    // const campaignData = await collection.findOne({ campaignId: campaign });
    socket.on('disconnect', () => {
      console.log('a user disconnected');
    });

    socket.on("message", (msg) => {
      console.log(`user ${socket.user.id} said: ${msg}`);
      io.to(campaign).emit("message", msg);
    });

    socket.on('dragableMoved', async (pos) => {
      io.to(campaign).emit('dragableMoved', pos);

      // Example: Update MongoDB with new position
      await collection.updateOne(
        { campaignId: campaign },
        { $set: { [`positions.${pos.id}`]: pos } }
      );
    });

    socket.on('createShape', async (shape) => {
      io.to(campaign).emit('createShape', shape);

      // Example: Insert a new shape into MongoDB
      await collection.updateOne(
        { campaignId: campaign },
        { $push: { shapes: shape } }
      );
    });

    socket.on('removeShape', async (shape) => {
      io.to(campaign).emit('removeShape', shape);

      // Example: Remove a shape from MongoDB
      /* await collection.updateOne(
        { campaignId: campaign },
        { $pull: { shapes: { id: shape.id } } }
      ); */
    });

    socket.on('moveMarker', (markerObject) => {
      io.to(campaign).emit('moveMarker', markerObject);
    })

    socket.on('changeMap', (mapID) => {
      io.to(campaign).emit('changeMap', mapID);
    })

    socket.on('roll', (roll) => {
      console.log(roll);
      io.to(campaign).emit('roll', roll);
    })

    socket.on('rollNumberedDice', (num, rolls) => {
      io.to(campaign).emit('rollNumberedDice', num, rolls);
    })

    socket.on('abilityRoll', (ability, bonud, rollType) => {
      io.to(campaign).emit('abilityRoll', ability, bonud, rollType);
    })

    // Monster Management
    socket.on("addMonster", (monsterID, markerType) => {
      io.to(campaign).emit("addMonster", monsterID, markerType);
    })

    socket.on('healthChange', async ({ characterID, newHealth }) => {
      console.log('characterId: ', characterID, '   health: ', newHealth);
      try {
        io.to(campaign).emit('healthChange', {characterID, newHealth})
        const campaignDb = mongoClient.db('campaign'); // Reference the database
        const campaignCollection = campaignDb.collection('campaign_data'); // Reference the collection
    
        // Update the hp value for the matching characterId in the characterIds array
        const result = await campaignCollection.updateOne(
          { _id: new ObjectId(campaign), "characterIds.characterId": characterID }, // Match the document and characterId
          { $set: { "characterIds.$.hp": newHealth } } // Set the hp value
        );
    
        if (result.modifiedCount > 0) {
          console.log(`Updated health for characterId ${characterID} to ${newHealth}`);
          io.to(campaign).emit('healthChange', characterID, newHealth); // Notify other clients
        } else {
          console.log(`No matching characterId ${characterID} found in campaign ${campaign}`);
        }
      } catch (error) {
        console.error("Error updating health:", error);
      }
    });
    
  });

  server.listen(process.env['PORT'], () => {
    console.log("server running!");
  });
