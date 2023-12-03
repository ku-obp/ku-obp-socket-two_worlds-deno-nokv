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
            const {players, nowInTurn} = initial_state
            socket.to(roomKey).emit("updateGameState", initial_state)
            socket.to(roomKey).emit("turnBegin", players.filter(({icon}) => {
              icon === nowInTurn
            })[0].email)
          }
        }
      }
    }
  )

  socket.on("reportRollDiceResult", async ({roomKey, playerEmail, dice1, dice2, doubles_count = 0, flag_jailbreak = false}: {roomKey: string, playerEmail: string, dice1: number, dice2: number, doubles_count: number, flag_jailbreak: boolean}) => {
    // 주사위 출력값들(dice1, dice2)부터 먼저 표시하도록 이벤트 trigger
    
    const state = await GameManager.getGameState(roomKey);
    if(state === null) {
      return;
    }
    const flat = state.flat();
    const players = Array.from(flat.players);
    const idx = players.findIndex((player) => (player.email === playerEmail));
    if(idx < 0) {
      return;
    }
    if(!flag_jailbreak) {
      let state_before_cell_action: DBManager.GameStateType | null = null
      const {can_get_salery, state_after_move} = await GameManager.movePlayer(flat,idx,{
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
      const task = await GameManager.cellAction(socket,state_before_cell_action,playerEmail)
      if(task === null) {
        return;
      }

      if(task.turn_finished) {
        if((doubles_count < 3) && (dice1 === dice2)) {
          socket.to(roomKey).emit("turnBegin",{
            playerEmail,
            doubles_count: doubles_count + 1
          })
        }
        else {
          socket.to(roomKey).emit("turnEnd")
        }
      } else {
        await GameManager.safeEnqueue(roomKey,task)
      }
    } else {
      const remainingJailTurns = ((remaining, isDouble) => {
        if (isDouble) {
          return 0
        } else {
          return Math.max(0,remaining - 1)
        }
      })(players[idx].remainingJailTurns, (dice1 === dice2))
      players[idx].remainingJailTurns = remainingJailTurns
      GameManager.setGameState(roomKey,{
        players
      },(updated) => {
        socket.to(roomKey).emit("updateGameState",updated)
      })
      socket.emit("checkJailbreak", {remainingJailTurns})
    }
  })

  socket.on("nextTurn", async (roomKey: string) => {
    const state = await GameManager.getGameState(roomKey)
    if(state === null) {
      return;
    }
    const new_state: DBManager.GameStateType = {
      ...state.flat(),
      nowInTurn: state.flat().nowInTurn + 1
    }
    await GameManager.setGameState(roomKey,{
      nowInTurn: new_state.nowInTurn
    }, (updated) => {
      socket.to(roomKey).emit("updateGameState", updated)
    })
    

    if(Math.min(...(new_state.players.map(({cycles}) => cycles))) >= 4) {
      await GameManager.endGame(roomKey)
      socket.to(roomKey).emit("endGame", {})
    }
    else {
      socket.to(roomKey).emit("turnBegin", {
        playerEmail: new_state.players.filter(({icon}) => {
          icon === new_state.nowInTurn
        })[0].email,
        doubles_count: 0
    })
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


