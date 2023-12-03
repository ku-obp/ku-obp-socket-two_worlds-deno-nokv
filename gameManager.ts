import shuffle from "https://deno.land/x/shuffle@v1.0.1/mod.ts";
const INITIAL_CASH = 6000000;

import db, { RoomDataType, GameStateType, generateLog } from "./dbManager.ts";

import * as Utils from "./utils.ts"


export async function createRoom(roomKey: string, hostEmail: string) {
  if(await (db.roomData.find(roomKey)) !== null) {
    return false;
  }
  const roomData: RoomDataType = {
    roomKey,
    hostEmail,
    maxGuests: 3,
    guests: [] as string[],
    isStarted: false,
    isEnded: false,
    waitingForAnswer: 0,
  };
  await db.roomData.add(roomData);
  await db.roomLogs.add({
    roomKey,
    logs: []
  })
  await db.roomLogs.update(roomKey,{
    logs: [generateLog(`room ${roomKey} created by ${hostEmail}`)]
  },{
    mergeType: "shallow"
  })
  return true;
}

export async function removeRoom(roomKey: string) {
  await db.roomData.delete(roomKey)
}

export async function registerGuest(roomKey: string, guestEmail: string): Promise<[(string | null), boolean]> {
  let output = false
  if(await (db.roomData.find(roomKey)) === null) {
    return ["incorrect roomKey", output];
  }
  const tmp = await db.roomData.find(roomKey)
  if(tmp !== null) {
    const tmp_flat = tmp.flat()
    if(!tmp_flat.guests.includes(guestEmail)) {
      if(tmp_flat.guests.length >= tmp_flat.maxGuests) {
        return ["the room is already full",output];
      }
      if(tmp_flat.isStarted || tmp_flat.isEnded) {
        return ["the room has already started the game",output];
      }
      const new_guests = tmp_flat.guests.concat(guestEmail)
      output = tmp_flat.guests.length >= tmp_flat.maxGuests
      db.roomData.update(roomKey,{
        guests: new_guests
      },
      {
        mergeType: "shallow"
      })
    }
    else {
      return ["already registered", output]
    }
  }
  return [null, output]
}

export async function startGame(roomKey: string) {
  const rawRoomData = await db.roomData.find(roomKey)
  if(rawRoomData === null) {
    return null
  } else {
    const flatRoomData = rawRoomData.flat()
    if(flatRoomData.isEnded) {
      return null;
    } else {
      db.roomData.update(roomKey,{
        isStarted: true
      },
      {
        mergeType: "shallow"
      })
    }

    const shuffled = shuffle([flatRoomData.hostEmail, ...flatRoomData.guests.slice(0,3)])

    const initial_state: GameStateType = {
      roomKey,
      players: ((arr: string[]): DBManager.PlayerType[] => [
          {email: arr[0], icon: 0,location: 0, displayLocation: 0, cash: INITIAL_CASH, cycles: 0, university: "notYet", tickets: {discountRent: 0, bonus: false, doubleLotto: 0}, remainingJailTurns: 0},
          {email: arr[1], icon: 1,location: 0, displayLocation: 0, cash: INITIAL_CASH, cycles: 0, university: "notYet", tickets: {discountRent: 0, bonus: false, doubleLotto: 0}, remainingJailTurns: 0},
          {email: arr[2], icon: 2,location: 0, displayLocation: 0, cash: INITIAL_CASH, cycles: 0, university: "notYet", tickets: {discountRent: 0, bonus: false, doubleLotto: 0}, remainingJailTurns: 0},
          {email: arr[3], icon: 3,location: 0, displayLocation: 0, cash: INITIAL_CASH, cycles: 0, university: "notYet", tickets: {discountRent: 0, bonus: false, doubleLotto: 0}, remainingJailTurns: 0},
      ])(shuffled),
      properties: [],
      nowInTurn: 0,
      govIncome: 0,
      charityIncome: 0,
      sidecars: {
        limitRents: 0
      }
    }
    db.gameState.set(roomKey,initial_state)
    return initial_state;
  }  
}

export async function endGame(roomKey: string) {
  //const roomData = (await kv.get<RoomDataType>(["two-worlds", roomKey, "roomData"])).value
  if((await db.roomData.find(roomKey)) !== null) {
    db.roomData.update(roomKey, {
        isEnded: true
      },
      {
        mergeType: "shallow"
      }
    )
  }
}

export async function getGameState(roomKey: string) {
  return await db.gameState.find(roomKey)
}

export async function setGameState(roomKey: string, new_state: Partial<GameStateType>, callback: (updated: GameStateType) => void) {
  await db.gameState.update(roomKey, new_state,
    {
      mergeType: "shallow"
    }
  )
  const updated = await db.gameState.find(roomKey)
  if(updated !== null) {
    callback(updated.flat())
  }
}

export class PaymentTransaction {
  public readonly player0: number
  public readonly player1: number
  public readonly player2: number
  public readonly player3: number
  public readonly government: number
  public readonly charity: number
  public constructor({player0, player1, player2, player3, government, charity}: {
    player0?: number, player1?: number, player2?: number, player3?: number, government?: number, charity?: number
  }) {
    this.player0 = player0 ?? 0;
    this.player1 = player1 ?? 0;
    this.player2 = player2 ?? 0;
    this.player3 = player3 ?? 0;
    this.government = government ?? 0;
    this.charity = charity ?? 0;
  }

  public merge(other: PaymentTransaction): PaymentTransaction {
    return new PaymentTransaction({
      player0: this.player0 + other.player0,
      player1: this.player1 + other.player1,
      player2: this.player2 + other.player2,
      player3: this.player3 + other.player3,
      government: this.government + other.government,
      charity: this.charity + other.charity
    })
  }

  public get revert() {
    return new PaymentTransaction({
      player0: -this.player0,
      player1: -this.player1,
      player2: -this.player2,
      player3: -this.player3,
      government: -this.government,
      charity: -this.charity
    })
  }

  public get flat() {
    return {
      playerTransactions: [
        this.player0,
        this.player1,
        this.player2,
        this.player3
      ],
      government: this.government,
      charity: this.charity,
    }
  }

  public static P2G(playerIcon: DBManager.PlayerIconType, amount: number) {
    switch(playerIcon) {
      case 0:
        return new PaymentTransaction({
          player0: -amount,
          government: amount
        })
      case 1:
        return new PaymentTransaction({
          player1: -amount,
          government: amount
        })
      case 2:
        return new PaymentTransaction({
          player2: -amount,
          government: amount
        })
      case 3:
        return new PaymentTransaction({
          player3: -amount,
          government: amount
        })
    }
  }

  public static G2M(amount: number) {
    return new PaymentTransaction({
      government: -amount,
    })
  }

  public static P2C(playerIcon: DBManager.PlayerIconType, amount: number) {
    switch(playerIcon) {
      case 0:
        return new PaymentTransaction({
          player0: -amount,
          charity: amount
        })
      case 1:
        return new PaymentTransaction({
          player1: -amount,
          charity: amount
        })
      case 2:
        return new PaymentTransaction({
          player2: -amount,
          charity: amount
        })
      case 3:
        return new PaymentTransaction({
          player3: -amount,
          charity: amount
        })
    }
  }

  public static unidirectional(playerIcon: DBManager.PlayerIconType, amount: number) {
    switch(playerIcon) {
      case 0:
        return new PaymentTransaction({
          player0: amount
        })
      case 1:
        return new PaymentTransaction({
          player1: amount
        })
      case 2:
        return new PaymentTransaction({
          player2: amount
        })
      case 3:
        return new PaymentTransaction({
          player3: amount
        })
    }
  }

  public static P2P(from: DBManager.PlayerIconType, to: DBManager.PlayerIconType, amount: number): PaymentTransaction {
    const different_pair = Utils.DifferentNumberPair.checkDifferent<DBManager.PlayerIconType>(from, to)
    return Utils.nullableMapper(different_pair,({a,b}) => {
      return PaymentTransaction.unidirectional(a, -amount).merge(PaymentTransaction.unidirectional(b, amount))
    },{
      mapNullIsGenerator: false, constant: new PaymentTransaction({})
    })
  }
}

import PREDEFINED_CELLS, {randomChance, Transportation, transact} from "./cells.ts";

import { Timeout } from "https://deno.land/x/timeout@2.4/mod.ts"

// @deno-types="npm:xrange@2.2.1"
import xrange from "npm:xrange@2.2.1"

export const movePlayer = async (game_state: DBManager.GameStateType, playerIdx: number, args: {
  kind: "forward" | "backward",
  type: "byAmount"
  amount: number
} | {
  kind: "forward" | "backward",
  type: "navigateTo"
  dest: number
} | {
  kind: "warp",
  dest: number
}, eachCallback: (updated: Partial<DBManager.GameStateType>) => void, finalCallback: (updated: Partial<DBManager.GameStateType>) => void): Promise<{
  can_get_salery: boolean,
  dest: number,
  state_after_move: DBManager.GameStateType | null
}> => {
  let dest = 0;
  let tmp_players = Array.from(game_state.players)
  const begin = game_state.players[playerIdx].location
  let can_get_salery: boolean
  if(args.kind === "warp") {
    dest = (args.dest) % 54;
    tmp_players = movePrimitive(tmp_players,playerIdx,dest,eachCallback);
    can_get_salery = false
  }
  else if (args.kind === "forward") {
    const [_dest, amount] = (args.type === "byAmount")
      ? [((begin + args.amount) % 54),(args.amount % 54)]
      : [(args.dest % 54),(args.dest - begin)];
    dest = _dest;
    for(const n of xrange(amount)) {
      tmp_players = movePrimitive(tmp_players, playerIdx, begin + n, eachCallback);
    }
    can_get_salery = (dest <= begin)
  }
  else {
    const [_dest, amount] = (args.type === "byAmount")
      ? [((begin - args.amount) % 54), args.amount]
      : [(args.dest % 54), ((begin - args.dest) % 54)];
    dest = _dest
    for(const n of xrange(amount)) {
      tmp_players = movePrimitive(tmp_players, playerIdx, begin - n, eachCallback);
    }
    can_get_salery = (dest >= begin)
  }
  tmp_players[playerIdx].location = dest
  finalCallback({
    players: tmp_players
  })
  const state_after_move = await getGameState(game_state.roomKey)
  return {can_get_salery, dest, state_after_move: (state_after_move !== null) ? state_after_move.flat() : null }
}

const movePrimitive = (players: DBManager.PlayerType[], playerIdx: number, new_location: number, callback: (updated: Partial<DBManager.GameStateType>) => void) => {
  const tmp = Array.from(players)
  tmp[playerIdx].displayLocation = new_location % 54
  const update: Partial<DBManager.GameStateType> = {
    players: tmp
  }
  Timeout.wait(600)
  .then(() => {
    callback(update)
  })
  return tmp
}





export async function giveSalery(state: DBManager.GameStateType | null, playerEmail: string, government_income: number, callback: (updated: Partial<DBManager.GameStateType>) => void): Promise<DBManager.GameStateType | null> {
  if(state === null) {
    return null;
  }
  const tmp = Array.from(state.players)
  const transactions: PaymentTransaction[] = []
  const player_get_salery = tmp.find((player) => player.email === playerEmail)
  if (player_get_salery !== undefined) {
    switch(player_get_salery.icon) {
      case 0:
        transactions.push(new PaymentTransaction({
          player0: 2000000 + ((player_get_salery.university == "graduated") ? 1000000 : 0),
          government: 1000000
        }))
        break;
      case 1:
        transactions.push(new PaymentTransaction({
          player1: 2000000 + ((player_get_salery.university == "graduated") ? 1000000 : 0),
          government: 1000000
        }))
        break;
      case 2:
        transactions.push(new PaymentTransaction({
          player2: 2000000 + ((player_get_salery.university == "graduated") ? 1000000 : 0),
          government: 1000000
        }))
        break;
      case 3:
        transactions.push(new PaymentTransaction({
          player3: 2000000 + ((player_get_salery.university == "graduated") ? 1000000 : 0),
          government: 1000000
        }))
        break;
    }
    const government_income_after = government_income + 1000000

    transactions.push(new PaymentTransaction({
      player0: government_income_after / 4,
      player1: government_income_after / 4,
      player2: government_income_after / 4,
      player3: government_income_after / 4,
      government: -government_income_after
    }))
  }
  const overall = transactions.reduce((acc,curr) => {
    return acc.merge(curr)
  },new PaymentTransaction({})).flat

  const players_after: DBManager.PlayerType[] = state.players.map((player) => {
    return {
      ...player,
      cash: player.cash + overall.playerTransactions[player.icon]
    };
  })
  
  const updates: Partial<DBManager.GameStateType> = {
    players: players_after,
    govIncome: 0
  }
  callback(updates)
  const state_after = await getGameState(state.roomKey)
  if(state_after === null) {
    return null
  }
  else {
    return state_after.flat()
  }
}





import * as DBManager from "./dbManager.ts"
import { Socket } from 'socket-io';

const universityAction = (university: DBManager.UniversityStateType): DBManager.UniversityStateType => {
  if(university === "notYet") return "undergraduate"
  else return "graduated"
}

const jailAction = async (socket: Socket, roomKey: string, players: DBManager.PlayerType[], playerIdx_now: number) => {
  const player_updates = Array.from(players)
        players[playerIdx_now].remainingJailTurns = ((remainingJailTurns) => {
          if(remainingJailTurns <= 0) {
            return 3
          } else {
            return remainingJailTurns - 1
          }
        })(players[playerIdx_now].remainingJailTurns)
  
  setGameState(roomKey, {
    players: player_updates
  },(updated) => {
    socket.to(roomKey).emit("updateGameState", updated)
  })
  const state_after = await getGameState(roomKey)
  if(state_after === null) {return null}
  else {return state_after.flat()}
}


export const cellAction = async (socket: Socket, state: DBManager.GameStateType | null, playerEmail: string): Promise<DBManager.TaskType | null> => {
  if (state === null) {
    return null
  }
  const roomKey = state.roomKey
  const playerIdx_now = state.players.findIndex((player) => player.email === playerEmail)
  if(playerIdx_now >= 0) {
    const player_now = state.players[playerIdx_now]
    const cell = PREDEFINED_CELLS[player_now.location]
    const type = cell.type
    if(["start", "chance", "transportation", "university", "park"].includes(type)) {
      if((type === "start") || (type === "park")) {
        return {
          state_after: state,
          cellType: type,
          turn_finished: true
        }
      } else if(type === "chance") {
        // 랜덤 카드 뽑은 후, 그에 따른 액션을 수행하면서 카드 내용 표출
        const roomKey = state.roomKey
        const {displayName, description, action} = randomChance()
        const state_after = await action(socket,state,playerEmail)
        socket.to(roomKey).emit("chanceCardAcquistion", {displayName, description})
        return {
          state_after,
          cellType: type,
          turn_finished: false
        }
      } else if(type === "transportation") {
        const dest = (cell as Transportation).dest
        if(state !== null) {
          const {state_after_move} = await movePlayer(state,playerIdx_now,{
            kind: "warp",
            dest: dest
          },(updated) => {
            setGameState(roomKey,updated,(_updated) => {
              socket.to(roomKey).emit("updateGameState", _updated)
            })
          },(updated) => {
            setGameState(roomKey,updated,(_updated) => {
              socket.to(roomKey).emit("updateGameState", _updated)
            })
          })
          return {
            state_after: state_after_move,
            cellType: type,
            turn_finished: true
          }
        } else {
          return null
        }
      } else {
        const updates: Partial<GameStateType> = ((players: DBManager.PlayerType[]) => {
          const players_new = Array.from(players)
          players_new[playerIdx_now].university = universityAction(players_new[playerIdx_now].university)
          return {
            players: players_new
          }
        })(state.players)
        setGameState(roomKey,updates,(updated) => {
          socket.to(roomKey).emit("updateGameState", updated)
        })
        const state_after = Utils.nullableMapper(await getGameState(roomKey), (state_wrapped) => state_wrapped.flat(),{mapNullIsGenerator: false, constant: null})
        return {
          state_after,
          cellType: type,
          turn_finished: true
        }
      }
    } else if(type === "jail") {
      const state_after = await jailAction(socket,roomKey,state.players,playerIdx_now)
      socket.emit("askJailbreak")
      
      return {
        state_after,
        cellType: type,
        turn_finished: false
      }
    } else { // 돈을 지불하는 칸들
      const {mandatory, optional} = transact(playerEmail,Array.from(state.players),Array.from(state.properties),cell)

      socket.emit("notifyPayments", {type, invoices: {mandatory, optional}})
      return {
        state_after: state,
        cellType: type,
        turn_finished: false
      }
    }
  } else {
    return null
  }
}

function dequeue<T>(queue: T[]): [(T | null), T[]] {
  if(queue.length > 0) {
    const item = queue[0]
    const remaining = queue.slice(1,undefined)
    return [item,remaining]
  } else {
    return [null, []]
  }
}

export async function safeDequeue(roomKey: string) {
  const queue = (await db.roomWaiting.find(roomKey))?.flat().queue
  if(queue !== undefined) {
    const [task, remaining] = dequeue(queue)
    await db.roomWaiting.update(roomKey,{
      queue: remaining
    }, {
      mergeType: "shallow"
    })
    return task
  } else {
    return null
  }
}

export async function safeEnqueue(roomKey: string, task: DBManager.TaskType) {
  if(task.state_after === null) {
    return
  }
  const queue = (await db.roomWaiting.find(roomKey))?.flat().queue
  if (queue === undefined) {
    await db.roomWaiting.set(roomKey,{
      roomKey,
      queue: [
        {
          task,
          at: new Date(),
        }
      ]
    })
  } else {
    const new_queue = queue.concat({
      task,
      at: new Date(),
    })
    await db.roomWaiting.update(roomKey,{
      queue: new_queue
    },{
      mergeType: "shallow"
    })
  }
}