import { Application } from "oak"
import {Server, Socket} from "socket-io"

import * as GameManager from "./gameManager.ts"

const app = new Application();
const io = new Server();

app.use((ctx) => {
  ctx.response.body = "Hello World!";
});

function onConnected(socket: Socket) {
  console.log(socket.id + " is connected.");

  socket.on("joinRoom",
    async ({playerEmail, roomKey}: {playerEmail: string, roomKey: string} ) => {
      if (!await GameManager.createRoom(roomKey,playerEmail)) {
        const [joinResult, justGotFull] = await GameManager.registerGuest(roomKey,playerEmail)
        if(joinResult === "already registered") {
          const current_game_state = (await GameManager.getGameState(roomKey))
          socket.emit("updateGameState", {current_game_state})
        }
        else if(joinResult !== null) {
          socket.emit("reportJoinFailure", {msg: joinResult as string})
        }
        else if (justGotFull) {
          const initial_state = await GameManager.startGame(roomKey)
          if(initial_state !== null) {
            const {players, properties, nowInTurn} = initial_state
            socket.emit("updateGameState", {players,properties, nowInTurn})
            socket.emit("turnBegin", players.filter(({icon}) => {
              icon === nowInTurn
            })[0].email)
          }
        }
      }
    }
  )

  socket.on("turnEnd", async (roomKey: string) => {
    const state = await GameManager.getGameState(roomKey)
    if(state === null) {
      return;
    }
    const new_state = {
      ...state,
      nowInTurn: state.nowInTurn + 1
    }
    await GameManager.setGameState(roomKey,new_state)
    socket.emit("updateGameState", new_state)

    if(Math.min(...(new_state.players.map(({cycles}) => cycles))) >= 4) {
      await GameManager.endGame(roomKey)
      socket.emit("endGame", {})
    }
    else {
      socket.emit("turnBegin", new_state.players.filter(({icon}) => {
        icon === new_state.nowInTurn
      })[0].email)
    }

    
  })
  
  socket.on("disconnect", (reason) => {
    console.log(`socket ${socket.id} disconnected due to ${reason}`)
  })
}


io.on("connection", onConnected)

const handler: Deno.ServeHandler = async (request, _info) => {
  return await app.handle(request) || new Response(null, { status: 404 });
}

await Deno.serve({port: 11000}, handler)


