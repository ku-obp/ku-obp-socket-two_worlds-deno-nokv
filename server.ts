import {Server} from "socket-io"

const io: Server = new Server({
    cors: {
      origin: ["https://ku-obp.vercel.app", "http://localhost:3000"],
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    }
});

export default io