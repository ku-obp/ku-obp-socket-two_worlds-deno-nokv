import { Application } from "oak"
import { Socket } from "socket-io"

import * as DBManager from "./dbManager.ts"

import * as GameManager from "./gameManager.ts"
import { serve } from "http";

import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts"




const app = new Application();

import io, { router } from "./server.ts"

type CreateRoomRequestPayloadType = {
  roomId: string,
  player1: string,
  player2: string,
  player3: string,
  player4: string
}




router.post("/create", async(context) => {
  const bodyText = (await context.request.body({type: "text"}).value)
  const {
    roomId,
    player1,
    player2,
    player3,
    player4
  } = JSON.parse(bodyText)
  await GameManager.createRoom(roomId as string, player1 as string, player2 as string, player3 as string, player4 as string)
})



app.use((ctx) => {
  ctx.response.body = "Hello World!";
});

app.use(oakCors({
  origin: ["https://ku-obp.vercel.app", "http://localhost:3000"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Access-Control-Allow-Origin"],
  credentials: true
}))

app.use(router.routes())
app.use(router.allowedMethods())


async function turnEnd(roomId: string) {
  io.to(roomId).emit("next")

  const state = await GameManager.getGameState(roomId)
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

    await GameManager.setGameState(roomId,{
      nowInTurn
    }, (updated) => {
      io.to(roomId).emit("updateGameState", {fresh: false, gameState: updated})
    })
    
    await GameManager.flushDoubles(roomId)

    if(Math.min(...(new_state.players.map(({cycles}) => cycles))) >= 4) {
      const overall_finances = await GameManager.endGame(roomId)
      io.to(roomId).emit("endGame", overall_finances)
    }
    else {
      io.to(roomId).emit("turnBegin", {
        playerNowEmail: now.email,
        doubles_count: 0,
        askJailbreak: (now.remainingJailTurns > 0)
      })
    }
}


async function checkDouble(roomId: string, playerEmail: string) {
  const is_double: boolean = (({dice1, dice2}) => {
    return ((!(dice1 === 0 || dice2 === 0)) && (dice1 === dice2))
  })(await GameManager.getDices(roomId))
  if(is_double) {
    const new_doubles = await GameManager.tryCommitDoubles(roomId)
    if(new_doubles > 0) {
      io.to(roomId).emit("turnBegin",{
        playerNowEmail: playerEmail,
        doubles_count: new_doubles,
        askJailbreak: false
      })
      return;
    }
  }
  await turnEnd(roomId)
}

function onConnected(socket: Socket) {
  console.log(socket.id + " is connected.");

  socket.on("joinRoom", async ({playerEmail, roomId}: {playerEmail: string, roomId: string}) => {
    const _gameState = await GameManager.getGameState(roomId)
    if(_gameState === null) {
      socket.emit("joinFailed", {msg: "invalid room"})
      return;
    } else {
      const gameState: DBManager.GameStateType = _gameState.flat()
      socket.join(roomId)
      socket.emit("joinSucceed")
      const isPlayable = gameState.players.map(({email}) => email).includes(playerEmail)
      socket.emit("updateGameState", { fresh: true, gameState, isPlayable })
      const doubles_count = await GameManager.getDoubles(roomId) ?? 0
      socket.emit("refreshDoubles", doubles_count)
      const dices = await GameManager.getDices(roomId)
      socket.emit("showDices", dices)
    }
  })

  socket.on("skip", ({roomId, playerEmail}: {roomId: string, playerEmail: string}) => {
    checkDouble(roomId, playerEmail)
  })

  socket.on("reportTransaction", async ({type, roomId, playerEmail, cellId, amount} : {type: "construct", roomId: string, playerEmail: string, cellId: number, amount: 1} | {type: "sell", roomId: string, playerEmail: string, cellId: number, amount: 1 | 2 | 3}) => {
    const state = (await GameManager.getGameState(roomId))?.flat()
    if(state === undefined) {
      return;
    }
    const [players, properties] = (type === "construct") ? GameManager.tryConstruct(Array.from(state.players),Array.from(state.properties),playerEmail,cellId) :
      GameManager.tryDeconstruct(Array.from(state.players),Array.from(state.properties),playerEmail,cellId,amount);
    GameManager.setGameState(roomId,{
      players,
      properties
    }, (updated) => {
      socket.emit("updateGameState", {fresh: false, gameState: updated})
    })
    if(type === "construct") {
      checkDouble(roomId,playerEmail)
    }
  })

  socket.on("requestBasicIncome", async (roomId: string) => {
    const state = await GameManager.getGameState(roomId)
    if(state !== null) {
      const {
        players,
        govIncome,
        roomId
      } = state.flat()
      const after = await GameManager.distributeBasicIncome(players,govIncome)
      await GameManager.setGameState(roomId,{
        players: after.players,
        govIncome: after.government_income
      }, (updated) => {
        io.to(roomId).emit("updateGameState", {fresh: false, gameState: updated})
      })
    }
  })

  socket.on("jailbreakByMoney", async ({roomId, playerEmail}:{roomId: string, playerEmail: string}) => {
    const state = (await GameManager.getGameState(roomId))?.flat()
    if(state === undefined) {
      return
    }

    const playerNowIdx = (state.players ?? []).findIndex((player) => player.email === playerEmail)
    if(playerNowIdx < 0) {
      return;
    } else {
      const players = Array.from(state.players)
      players[playerNowIdx].cash = Math.max(0, state.players[playerNowIdx].cash - 400000)
      players[playerNowIdx].remainingJailTurns = 0
      await GameManager.setGameState(roomId,{
        players
      }, (updated) => {
        io.to(roomId).emit("updateGameState", {fresh: false, gameState: updated})
      })
      turnEnd(roomId)
    }
  })


  socket.on("reportRollDiceResult", async ({roomId, playerEmail, dice1, dice2, flag_jailbreak = false}: {roomId: string, playerEmail: string, dice1: DBManager.DiceType, dice2: DBManager.DiceType, flag_jailbreak: boolean}) => {
    
    
    io.to(roomId).emit("showDices", {dice1, dice2})
    
    const state = await GameManager.getGameState(roomId);
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
        amount: (dice1 as number) + (dice2 as number)
      },(updated) => {
        GameManager.setGameState(roomId,updated,(_updated) => {
          io.to(roomId).emit("updateGameState", {fresh: false, gameState: _updated})
        })
      },(updated) => {
        GameManager.setGameState(roomId,updated,(_updated) => {
          io.to(roomId).emit("updateGameState", {fresh: false, gameState: _updated})
        })
      })
      if (can_get_salery) {
        state_before_cell_action = await GameManager.giveSalery(state_after_move,playerEmail,flat.govIncome, (updated) => {
          GameManager.setGameState(roomId,updated, (_updated) => {
            io.to(roomId).emit("updateGameState", {fresh: false, gameState: _updated})
          })
        })
      }
      else {
        state_before_cell_action = state_after_move
      }

      // 도착한 곳에 따른 액션 수행
      const task = await GameManager.cellAction(state_before_cell_action,playerEmail)
      if(task === null) {
        return;
      }

      if(task.turn_finished) {
        checkDouble(roomId,playerEmail)
      } else if(task.cellType === "chance") {
        const task_by_chance = await GameManager.cellAction(task.state_after,playerEmail)
        const state_after_chance = task_by_chance?.state_after
        if(state_after_chance === undefined || state_after_chance === null) {
          return
        } else {
          checkDouble(roomId,playerEmail)
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
      GameManager.setGameState(roomId,{
        players
      },(updated) => {
        io.to(roomId).emit("updateGameState", {fresh: false, gameState: updated})
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


