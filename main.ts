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

async function turnEnd(socket: Socket, roomKey: string) {
  socket.to(roomKey).emit("next")

  const state = await GameManager.getGameState(roomKey)
    if(state === null) {
      return;
    }
    const nowInTurn: 0 | 1 | 2 | 3 = ((old): 0|1|2|3 => {
      if(old % 4 === 0) {
        return 1
      } else if(old % 4 === 1) {
        return 2
      } else if(old % 4 === 2) {
        return 3
      } else {
        return 0
      }
    })((state.flat().nowInTurn + 1))
    const new_state: DBManager.GameStateType = {
      ...state.flat(),
      nowInTurn
    }

    const now = new_state.players.filter(({icon}) => {
      icon === nowInTurn
    })[0]

    await GameManager.setGameState(roomKey,{
      nowInTurn
    }, (updated) => {
      socket.to(roomKey).emit("updateGameState", {fresh: false, gameState: updated})
    })
    

    if(Math.min(...(new_state.players.map(({cycles}) => cycles))) >= 4) {
      const overall_finances = await GameManager.endGame(roomKey)
      socket.to(roomKey).emit("endGame", overall_finances)
    }
    else {
      socket.to(roomKey).emit("turnBegin", {
        playerNowEmail: now.email,
        doubles_count: 0,
        askJailbreak: (now.remainingJailTurns > 0)
      })
    }
}


function onConnected(socket: Socket) {
  console.log(socket.id + " is connected.");

  socket.on("joinRoom",
    async ({playerEmail, roomKey}: {playerEmail: string, roomKey: string} ) => {
      socket.join(roomKey)
      if (!await GameManager.createRoom(roomKey,playerEmail)) {
        const [joinResult, justGotFull] = await GameManager.registerGuest(roomKey,playerEmail)
        if(joinResult === "already registered") {
          const current_game_state: DBManager.GameStateType | undefined = (await GameManager.getGameState(roomKey))?.flat()
          if(current_game_state !== undefined) {
            const {
              chances,
              payments
            } = await GameManager.getRoomQueue(roomKey)
            socket.emit("updateGameState", {fresh: true, gameState: current_game_state, rq: {chances,payments}})
          }
        }
        else if(joinResult !== null) {
          socket.emit("JoinFailed", {msg: joinResult as string})
        }
        else if (justGotFull) {
          const initial_state = await GameManager.startGame(roomKey)
          if(initial_state !== null) {
            const {players, nowInTurn} = initial_state
            socket.to(roomKey).emit("updateGameState", {fresh: true, gameState: initial_state, rq: {
              chances: {
                queue: [] as string[],
                processed: 0
              }, 
              payments: {
                queue: [] as {
                  cellId: number,
                  mandatory: GameManager.PaymentTransactionJSON | null,
                  optional: GameManager.PaymentTransactionJSON | null
                }[],
                processed: 0
              }
            }})
            socket.to(roomKey).emit("turnBegin", {
              playerNowEmail: players.filter(({icon}) => {
                icon === nowInTurn
              })[0].email,
              doubles_count: 0,
              askJailbreak: false
            })
          }
        }
      }
    }
  )

  socket.on("requestBasicIncome", async (roomKey: string) => {
    const state = await GameManager.getGameState(roomKey)
    if(state !== null) {
      const {
        players,
        govIncome,
        roomKey
      } = state.flat()
      const after = await GameManager.distributeBasicIncome(players,govIncome)
      await GameManager.setGameState(roomKey,{
        players: after.players,
        govIncome: after.government_income
      }, (updated) => {
        socket.to(roomKey).emit("updateGameState", {fresh: false, gameState: updated})
      })
    }
  })

  socket.on("reportRollDiceResult", async ({roomKey, playerEmail, dice1, dice2, doubles_count = 0, flag_jailbreak = false}: {roomKey: string, playerEmail: string, dice1: number, dice2: number, doubles_count: number, flag_jailbreak: boolean}) => {
    socket.to(roomKey).emit("showDiceValues", {dice1, dice2})
    
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
          socket.to(roomKey).emit("updateGameState", {fresh: false, gameState: _updated})
        })
      },(updated) => {
        GameManager.setGameState(roomKey,updated,(_updated) => {
          socket.to(roomKey).emit("updateGameState", {fresh: false, gameState: _updated})
        })
      })
      if (can_get_salery) {
        state_before_cell_action = await GameManager.giveSalery(state_after_move,playerEmail,flat.govIncome, (updated) => {
          GameManager.setGameState(roomKey,updated, (_updated) => {
            socket.to(roomKey).emit("updateGameState", {fresh: false, gameState: _updated})
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
            playerNowEmail: playerEmail,
            doubles_count: doubles_count + 1,
            askJailbreak: false
          })
        }
        else {
          await turnEnd(socket,roomKey)
        }
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
        socket.to(roomKey).emit("updateGameState", {fresh: false, gameState: updated})
      })
      socket.emit("checkJailbreak", {remainingJailTurns})
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


