import { Application } from "oak"
import {Server, Socket} from "socket-io"

import * as DBManager from "./dbManager.ts"

import * as GameManager from "./gameManager.ts"
import { serve } from "http";



const app = new Application();
const io = new Server();

app.use((ctx) => {
  ctx.response.body = "Hello World!";
});

const DICE = [1,2,3,4,5,6]

import {
  randomItem
} from "https://deno.land/x/random_item@v1.2.0/mod.ts";





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
            socket.to(roomKey).emit("updateGameState", {players,properties, nowInTurn})
            socket.to(roomKey).emit("turnBegin", players.filter(({icon}) => {
              icon === nowInTurn
            })[0].email)
          }
        }
      }
    }
  )

  socket.on("reportRollDiceResult", async ({roomKey, playerEmail, dice1, dice2, doubles_count = 0, flag}: {roomKey: string, playerEmail: string, dice1: number, dice2: number, doubles_count: number, flag?: string}) => {
    // 주사위 출력값들(dice1, dice2)부터 먼저 표시하도록 이벤트 trigger
    
    const state = await GameManager.getGameState(roomKey);
    if(state === null) {
      return;
    }
    const flat = state.flat();
    const players = Array.from(flat.players);
    let new_doubles_count = doubles_count;
    if(flag === undefined) {
      const idx = players.findIndex((player) => (player.email === playerEmail));
      if(idx < 0) {
        return;
      }
      else {
        let state_before_cell_action: DBManager.GameStateType | null = null
        const {can_get_salery, dest, state_after_move} = await GameManager.movePlayer(flat,idx,{
          kind: "forward",
          type: "byAmount",
          amount: dice1 + dice2
        },(updated) => {
          GameManager.setGameState(roomKey,updated,(_updated) => {
            socket.to(roomKey).emit("updateGameState", _updated)
          })
        },(updated) => {
          GameManager.setGameState(roomKey,updated,(_updated) => {
            socket.to(roomKey).emit("updateGameState", _updated)
          })
        })
        if (can_get_salery) {
          state_before_cell_action = await GameManager.giveSalery(state_after_move,playerEmail,flat.govIncome, (updated) => {
            GameManager.setGameState(roomKey,updated, (_updated) => {
              socket.to(roomKey).emit("updateGameState", _updated)
            })
          })
        }
        else {
          state_before_cell_action = state_after_move
        }

        // 도착한 곳에 따른 액션 수행

        

        if(dice1 === dice2) {
          new_doubles_count = new_doubles_count + 1
          // 주사위 또 굴리기 요청
        }
        else {
          // 턴 넘기기 요청
        }
      }
    }
  })

  socket.on("turnEnd", async (roomKey: string) => {
    const state = await GameManager.getGameState(roomKey)
    if(state === null) {
      return;
    }
    const new_state: DBManager.GameStateType = {
      ...state.flat(),
      nowInTurn: state.flat().nowInTurn + 1
    }
    await GameManager.setGameState(roomKey,{
      nowInTurn: state.flat().nowInTurn + 1
    }, (updated) => {
      socket.to(roomKey).emit("updateGameState", updated)
    })
    

    if(Math.min(...(new_state.players.map(({cycles}) => cycles))) >= 4) {
      await GameManager.endGame(roomKey)
      socket.to(roomKey).emit("endGame", {})
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

const handler = io.handler(async (request) => {
  return await app.handle(request) || new Response(null, { status: 404 });
})

await serve(handler,{port: 11000})


