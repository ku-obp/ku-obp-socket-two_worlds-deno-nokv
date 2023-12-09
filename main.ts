import { Application } from "oak"
import { Socket } from "socket-io"

import * as DBManager from "./manager.ts"

import * as Manager from "./manager.ts"
import { serve } from "http";

import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts"




const app = new Application();

import io, { router } from "./server.ts"

import DB, {DBType} from "./manager.ts";

type CreateRoomRequestPayloadType = {
  roomId: string,
  player1: string,
  player2: string,
  player3: string,
  player4: string
}


import { sanitizeRoomId } from "./utils.ts";




router.post("/create", async (context) => {
  const bodyJSON = context.request.body({type: "json"})
  const payload = await bodyJSON.value
  try {
    DB.initializeRoom(sanitizeRoomId(payload.roomId), payload.player1, payload.player2, payload.player3, payload.player4)
    context.response.body = {status: "succeeded"}
  }
  catch {
    context.response.body = {status: "failed"}
  }
  finally {
    context.response.type = "application/json"
    context.respond = true
  }
})

app.use(oakCors({
  origin: ["https://ku-obp.vercel.app", "http://localhost:3000", "https://ku-*-lake041.vercel.app"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Access-Control-Allow-Origin"],
  credentials: true
}))

app.use(router.routes())
app.use(router.allowedMethods())


export function turnEnd(roomId: string) {
  const _roomId = sanitizeRoomId(roomId)
  io.to(_roomId).emit("next")

  const allState = DB.get(_roomId)
  if(allState === undefined) {
    return;
  }
  const state = allState.gameState

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
  })((state.nowInTurn + 1))
  const new_state: DBManager.GameStateType = {
    ...DBType.copyGameState(state),
    nowInTurn
  }

  const now = new_state.players.filter(({icon}) => {
    icon === nowInTurn
  })[0]

  DB.updateGameState(_roomId,{
    nowInTurn
  }, (updated) => {
    io.to(_roomId).emit("updateGameState", {fresh: false, gameState: updated})
  })
  
  DB.flushDoubles(_roomId)

  if(Math.min(...(new_state.players.map(({cycles}) => cycles))) >= 4) {
    const overall_finances = DB.endGame(_roomId)
    io.to(_roomId).emit("endGame", overall_finances)
  }
  else {
    io.to(_roomId).emit("turnBegin", {
      playerNowEmail: now.email,
      doubles_count: 0,
      askJailbreak: (now.remainingJailTurns > 0)
    })
  }
}


function checkDouble(roomId: string, playerEmail: string) {
  const _roomId = sanitizeRoomId(roomId)
  const dices = DB.get(_roomId)?.dices
  if(dices === undefined) {
    return;
  }
  const is_double: boolean = (({dice1, dice2}) => {
    return ((!(dice1 === 0 || dice2 === 0)) && (dice1 === dice2))
  })(dices)
  if(is_double) {
    const new_doubles = DB.commitDoubles(_roomId)
    if(new_doubles !== undefined && new_doubles > 0) {
      io.to(_roomId).emit("turnBegin",{
        playerNowEmail: playerEmail,
        doubles_count: new_doubles,
        askJailbreak: false
      })
      return;
    }
  }
  turnEnd(_roomId)
}

function onConnected(socket: Socket) {
  console.log(socket.id + " is connected.");

  socket.on("joinRoom", ({playerEmail, roomId}: {playerEmail: string, roomId: string}) => {
    const _roomId = sanitizeRoomId(roomId)
    const _state = DB.get(_roomId)
    try {
      if(_state === undefined) {
        throw "invalid room"
      }
      const gameState: DBManager.GameStateType = DBType.copyGameState(_state.gameState)
      socket.join(_roomId)
      socket.emit("joinSucceed")
      const isPlayable = gameState.players.map(({email}) => email).includes(playerEmail)
      socket.emit("updateGameState", { fresh: true, gameState, isPlayable })
      const doubles_count = _state.doublesCount
      socket.emit("refreshDoubles", doubles_count)
      const dices = _state.dices
      socket.emit("showDices", dices)
    } catch(msg) {
      socket.emit("joinFailed", {msg: String(msg)})
    }
  })

  socket.on("skip", ({roomId, playerEmail}: {roomId: string, playerEmail: string}) => {
    checkDouble(sanitizeRoomId(roomId), playerEmail)
  })

  socket.on("reportTransaction", ({type, roomId, playerEmail, cellId, amount} : {type: "construct", roomId: string, playerEmail: string, cellId: number, amount: 1} | {type: "sell", roomId: string, playerEmail: string, cellId: number, amount: 1 | 2 | 3}) => {
    const _roomId = sanitizeRoomId(roomId)
    const state = DB.get(_roomId)?.gameState
    if(state === undefined) {
      return;
    }
    const [players, properties] = (type === "construct") ? Manager.tryConstruct(Array.from(state.players),Array.from(state.properties),playerEmail,cellId) :
      Manager.tryDeconstruct(Array.from(state.players),Array.from(state.properties),playerEmail,cellId,amount);
    DB.updateGameState(_roomId,{
      players,
      properties
    }, (updated) => {
      socket.emit("updateGameState", {fresh: false, gameState: updated})
    })
    if(type === "construct") {
      checkDouble(_roomId,playerEmail)
    }
  })

  socket.on("requestBasicIncome", (roomId: string) => {
    const _roomId = sanitizeRoomId(roomId)
    const state = DB.get(_roomId)?.gameState
    if(state === undefined) {
      return;
    }
    const {
      players,
      govIncome
    } = DBType.copyGameState(state)
    const after = Manager.distributeBasicIncome(players,govIncome)
    DB.updateGameState(_roomId,{
      players: after.players,
      govIncome: after.government_income
    }, (updated) => {
      io.to(_roomId).emit("updateGameState", {fresh: false, gameState: updated})
    })
  })

  socket.on("jailbreakByMoney", ({roomId, playerEmail}:{roomId: string, playerEmail: string}) => {
    const _roomId = sanitizeRoomId(roomId)
    const state = DB.get(_roomId)?.gameState
    try {
      if(state === undefined) {
        throw {}
      }
      const playerNowIdx = (state.players ?? []).findIndex((player) => player.email === playerEmail)
      if(playerNowIdx < 0) {
        return;
      } else {
        const players = Array.from(state.players)
        players[playerNowIdx].cash = Math.max(0, state.players[playerNowIdx].cash - 400000)
        players[playerNowIdx].remainingJailTurns = 0
        DB.updateGameState(_roomId,{
          players
        }, (updated) => {
          io.to(_roomId).emit("updateGameState", {fresh: false, gameState: updated})
        })
        turnEnd(_roomId)
      }
    } catch(_) {
      return;
    }
  })


  socket.on("reportRollDiceResult", ({roomId, playerEmail, dice1, dice2, flag_jailbreak = false}: {roomId: string, playerEmail: string, dice1: DBManager.DiceType, dice2: DBManager.DiceType, flag_jailbreak: boolean}) => {
    
    const _roomId = sanitizeRoomId(roomId)
    io.to(_roomId).emit("showDices", {dice1, dice2})
    
    const state = DB.get(_roomId)?.gameState;
    if(state === undefined) {
      return;
    }
    const copied = DBType.copyGameState(state)
    const players = Array.from(copied.players);
    const idx = players.findIndex((player) => (player.email === playerEmail));
    if(idx < 0) {
      return;
    }
    if(!flag_jailbreak) {
      let state_before_cell_action: DBManager.GameStateType | null = null
      const result = Manager.movePlayer(copied,idx,{
        kind: "forward",
        type: "byAmount",
        amount: (dice1 as number) + (dice2 as number)
      },(updated) => {
        DB.updateGameState(_roomId,updated,(_updated) => {
          io.to(_roomId).emit("updateGameState", {fresh: false, gameState: _updated})
        })
      },(updated) => {
        DB.updateGameState(_roomId,updated,(_updated) => {
          io.to(_roomId).emit("updateGameState", {fresh: false, gameState: _updated})
        })
      })
      if(result === null) {
        return;
      }
      const {can_get_salery, state_after_move} = result
      if (can_get_salery) {
        state_before_cell_action = Manager.giveSalery(state_after_move,playerEmail,copied.govIncome, (updated) => {
          DB.updateGameState(_roomId,updated, (_updated) => {
            io.to(_roomId).emit("updateGameState", {fresh: false, gameState: _updated})
          })
        }) ?? null
      }
      else {
        state_before_cell_action = state_after_move
      }

      if(state_before_cell_action === null) {
        return;
      }

      // 도착한 곳에 따른 액션 수행
      const task = Manager.cellAction(state_before_cell_action,playerEmail)
      if(task === null) {
        return;
      }

      if(task.turn_finished) {
        checkDouble(_roomId,playerEmail)
      } else if(task.cellType === "chance") {
        const task_by_chance = Manager.cellAction(task.state_after,playerEmail)
        const state_after_chance = task_by_chance?.state_after
        if(state_after_chance === undefined || state_after_chance === null) {
          return
        } else {
          checkDouble(_roomId,playerEmail)
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
      DB.updateGameState(_roomId,{
        players
      },(updated) => {
        io.to(_roomId).emit("updateGameState", {fresh: false, gameState: updated})
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


