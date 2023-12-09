import {Server} from "socket-io"

import { Router } from "oak"

const io: Server = new Server({
    cors: {
      origin: ["https://ku-obp.vercel.app", "http://localhost:3000", "https://ku-*-lake041.vercel.app", "https://ku-obp-gamma.vercel.app/"],
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization", "Access-Control-Allow-Origin"],
      credentials: true
    }
});

export const router = new Router()



export default io