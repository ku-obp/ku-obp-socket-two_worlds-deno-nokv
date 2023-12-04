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

export async function getRoomQueue(roomKey: string) {
  const output: DBManager.RoomQueueType = (await db.roomQueue.find(roomKey))?.flat() ?? {
    roomKey,
    chances: {
      queue: [],
      processed: 0
    },
    payments: {
      queue: [],
      processed: 0
    }
  }
  return output
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
      await db.roomData.update(roomKey,{
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
      await db.roomData.update(roomKey,{
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
    await db.gameState.set(roomKey,initial_state)
    return initial_state;
  }  
}

function joinFinances(players: DBManager.PlayerType[], properties: DBManager.PropertyType[]): {
  playerEmail: string,
  cash: number,
  owns: number
}[] {
  const output = players.map(({email, cash}) => ({playerEmail: email, cash, owns: 0}))
  for (let {playerEmail, owns} of output) {
    const own_properties_count = properties.filter(({ownerEmail}) => ownerEmail === playerEmail).map(({count}) => count)
    owns = owns + own_properties_count.reduce((sum,curr_count) => (sum + curr_count),0)
  }
  return output
}


function calculateOverallFinances(players: DBManager.PlayerType[], properties: DBManager.PropertyType[]): {
  playerEmail: string,
  value: number
}[] {
  return joinFinances(players,properties).map(({playerEmail,cash,owns}) => ({
    playerEmail,
    value: (owns * 300000) + cash
  }))
}

export function deepcopyGameState(state: GameStateType): GameStateType {
  const {
    roomKey,
    players,
    properties,
    nowInTurn,
    govIncome,
    charityIncome,
    sidecars
  } = state
  const copied: GameStateType = {
    roomKey,
    players: Array.from(players),
    properties: Array.from(properties),
    nowInTurn,
    govIncome,
    charityIncome,
    sidecars
  }
  return copied
}


export async function endGame(roomKey: string) {
  
  const state = (await getGameState(roomKey))?.flat() ?? null
  if(state === null) {
    return []
  } else {
    const copied = deepcopyGameState(state)
    if((await db.roomData.find(roomKey)) !== null) {
      const overall_finances = calculateOverallFinances(copied.players,copied.properties)
      
      await db.roomData.update(roomKey, {
          isEnded: true
        },
        {
          mergeType: "shallow"
        }
      )
      return overall_finances
    } else {
      return []
    }
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
  private _player0: number
  public get player0(): number {
    return this._player0
  }
  private _player1: number
  public get player1(): number {
    return this._player1
  }
  private _player2: number
  public get player2(): number {
    return this._player2
  }
  private _player3: number
  public get player3(): number  {
    return this._player3
  }
  private _government: number
  public get government(): number {
    return this._government
  }
  private _charity: number
  public get charity(): number {
    return this._charity
  }
  public constructor({player0, player1, player2, player3, government, charity}: {
    player0?: number, player1?: number, player2?: number, player3?: number, government?: number, charity?: number
  }) {
    this._player0 = player0 ?? 0;
    this._player1 = player1 ?? 0;
    this._player2 = player2 ?? 0;
    this._player3 = player3 ?? 0;
    this._government = government ?? 0;
    this._charity = charity ?? 0;
  }
  public static toJSON(transaction: PaymentTransaction): PaymentTransactionJSON {
    const {
      player0, player1, player2, player3, government, charity
    }: {player0: number, player1: number, player2: number, player3: number, government: number, charity: number} = transaction
    return {
      player0,
      player1,
      player2,
      player3,
      government,
      charity
    }
  }

  public static fromJSON(transactionJSON: PaymentTransactionJSON): PaymentTransaction {
    return new PaymentTransaction(transactionJSON)
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

export type PaymentTransactionJSON = {
  player0: number;
  player1: number;
  player2: number;
  player3: number;
  government: number;
  charity: number;
}


import PREDEFINED_CELLS, {randomChanceId, Transportation, transact, ChanceActionCallback, chanceAction, PaymentsActionCallback} from "./cells.ts";

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

export function distributeBasicIncome(players: DBManager.PlayerType[], government_income: number) {
  return {
    players: players.map((player) => {
      return {
        ...player,
        cash: player.cash + government_income / 4
      }
    }) as DBManager.PlayerType[],
    government_income: 0
  }
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
    socket.to(roomKey).emit("updateGameState", {fresh: false, gameState: updated})
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
    const {
      type,
      name,
      maxBuildable,
      cellId
    } = cell
    if(["start", "chance", "transportation", "university", "park"].includes(type)) {
      if((type === "start") || (type === "park")) {
        return {
          state_after: state,
          cellType: type,
          turn_finished: true
        }
      } else if(type === "chance") {
        // 랜덤 카드 뽑은 후, 그에 따른 액션을 수행하면서 카드 내용 표출
        const chanceId = randomChanceId()
        const chanceActionCallback: ChanceActionCallback = (q,c) => {
          socket.to(roomKey).emit("syncQueue",{kind: "notifyChanceCardAcquistion", queues: q,payload: c})
        }
        const state_after = await chanceAction(roomKey, socket, state, playerEmail, chanceId, chanceActionCallback)
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
              socket.to(roomKey).emit("updateGameState", {fresh: false, gameState: _updated})
            })
          },(updated) => {
            setGameState(roomKey,updated,(_updated) => {
              socket.to(roomKey).emit("updateGameState", {fresh: false, gameState: _updated})
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
          socket.to(roomKey).emit("updateGameState", {fresh: false, gameState: updated})
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
      
      return {
        state_after,
        cellType: type,
        turn_finished: true
      }
    } else { // 돈을 지불하는 칸들
      const p =  transact(playerEmail,Array.from(state.players),Array.from(state.properties),cell)
      const [mandatory, optional] = [p.mandatory ?? null, p.optional ?? null]

      const paymentsActionCallback: PaymentsActionCallback = (q,p) => {
        socket.to(roomKey).emit("syncQueue",{kind: "notifyPayments", queues: q,payload: {
          type, name: cell.name,maxBuildable: cell.maxBuildable, invoices: p
        }})
      }
      safeEnqueuePayment(roomKey,cellId,{mandatory, optional},(q) => paymentsActionCallback(q,{mandatory,optional}))
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

export function dequeue<T>(queue: T[]): [(T | null), T[]] {
  if(queue.length > 0) {
    const item = queue[0]
    const remaining = queue.slice(1,undefined)
    return [item,remaining]
  } else {
    return [null, []]
  }
}

export type QueueCallback = ({chances, payments}: {chances: {queue: string[], processed: number}, payments: {queue: {
  cellId: number
  mandatory: PaymentTransactionJSON | null,
  optional: PaymentTransactionJSON | null
}[], processed: number}}) => void


export async function safeEnqueueChance(roomKey: string, chanceId: string, callback: QueueCallback) {
  const callbackParams = await (async (q) => {
    if(q === null) {
      const fresh = {
        chances: {
          queue: [chanceId],
          processed: 0
        },
        payments: {
          queue: [],
          processed: 0
        }
      }
      await db.roomQueue.set(roomKey, {...fresh, roomKey})
      return fresh
    } else {
      const {chances, payments} = q.flat()
      const updates = {
        chances: {
          queue: chances.queue.concat(chanceId),
          processed: chances.processed
        }
      }
      await db.roomQueue.update(roomKey,updates, {mergeType: "shallow"})
      return {
        chances: {
          queue: Array.from(updates.chances.queue),
          processed: updates.chances.processed
        },
        payments: {
          queue: Array.from(payments.queue),
          processed: payments.processed
        }
      }
    }
  })(await db.roomQueue.find(roomKey))
  callback(callbackParams)
}

export async function safeDequeueChance(roomKey: string, callback: QueueCallback) {
  const rq = (await db.roomQueue.find(roomKey))?.flat()
  if(rq === undefined) {
    return null
  } else {
    const {chances, payments} = rq
    const length = chances.queue.length
    const idx = chances.processed
    if(idx >= length) {
      return null
    } else {
      const output = chances.queue[idx]
      const new_chances = {
        queue: chances.queue,
        processed: Math.min(idx + 1,length)
      }
      await db.roomQueue.update(roomKey,{
        chances: new_chances
      })
      callback({chances: new_chances, payments})
      return output
    }
  }
}

export async function safeFlushChances(roomKey: string, callback: QueueCallback) {
  const rq = await db.roomQueue.find(roomKey)
  if(rq === null) {
    return;
  }
  const {payments} = rq.flat()
  await db.roomQueue.update(roomKey,{
    chances: {
      queue: [],
      processed: 0
    },
    payments
  })
  callback({chances: {
    queue: [],
    processed: 0
  }, payments})
}

export async function safeEnqueuePayment(roomKey: string, cellId: number, {mandatory, optional}: {mandatory: PaymentTransaction | null, optional: PaymentTransaction | null}, callback: QueueCallback) {
  const rq = (await db.roomQueue.find(roomKey))?.flat()
  const new_item = {
    cellId,
    mandatory: Utils.nullableMapper(mandatory,PaymentTransaction.toJSON,{mapNullIsGenerator: false, constant: null}),
    optional: Utils.nullableMapper(optional,PaymentTransaction.toJSON,{mapNullIsGenerator: false, constant: null})
  }
  let new_queue: {
    chances: {
      queue: string[],
      processed: number
    },
    payments: {
      queue: {
        cellId: number,
        mandatory: PaymentTransactionJSON | null,
        optional: PaymentTransactionJSON | null
      }[],
      processed: number
    }
  }
  if(rq === undefined) { 
    new_queue = {
      chances: {
        queue: [],
        processed: 0
      },
      payments: {
        queue: [new_item],
        processed: 0
      }
    }
    await db.roomQueue.set(roomKey, {...new_queue, roomKey: roomKey})
  } else {
    const {payments, chances} =  rq
    const updates = {
      queue: payments.queue.concat(new_item),
      processed: payments.processed
    }
    await db.roomQueue.update(roomKey,{
      payments: updates
    }, {mergeType: "shallow"})
    new_queue = {
      chances,
      payments: updates
    }
  }
  callback(new_queue)
}
  

export async function safeDequeuePayment(roomKey: string, callback: QueueCallback) {
  const rq = (await db.roomQueue.find(roomKey))?.flat()
  if(rq === undefined) {
    return null
  } else {
    const {chances, payments} = rq
    const length = payments.queue.length
    const idx = payments.processed
    if(idx >= length) {
      return null
    } else {
      const json = payments.queue[idx]
      const converted = {
        cellId: json.cellId,
        mandatory: Utils.nullableMapper(json.mandatory,PaymentTransaction.fromJSON,{mapNullIsGenerator: false, constant: null}),
        optional: Utils.nullableMapper(json.optional,PaymentTransaction.fromJSON,{mapNullIsGenerator: false, constant: null})
      }
      const updates = {
        queue: payments.queue,
        processed: Math.min(idx + 1,length)
      }

      await db.roomQueue.update(roomKey,{
        payments: updates
      })
      callback({chances, payments: updates})
      return converted
    }
  }
}

export async function safeFlushPayments(roomKey: string, callback: QueueCallback) {
  const rq = await db.roomQueue.find(roomKey)
  if(rq === null) {
    return;
  }
  const {chances} = rq.flat()
  await db.roomQueue.update(roomKey,{
    chances,
    payments: {
      queue: [],
      processed: 0
    }
  })
  callback({chances,payments: {
    queue: [],
    processed: 0
  }})
}



export function tryConstruct(players: DBManager.PlayerType[], properties: DBManager.PropertyType[], playerEmail: string, location: number): [DBManager.PlayerType[],DBManager.PropertyType[]] {
  const property_foundIdx = properties.findIndex(({cellId}) => cellId === location)
  const is_buildable = ((cell) => {
    if(property_foundIdx < 0) {
      return false
    }
    return ((properties[property_foundIdx].count) < (cell.maxBuildable as number)) && (cell.maxBuildable !== 0)
  })(PREDEFINED_CELLS[location]);
  if(is_buildable) {
    const players_after = players.map((player) => {
      if(player.email === playerEmail) {
        return {
          ...player,
          cash: player.cash - 300000
        }
      } else {
        return player
      }
    })
    const properties_after = properties.map((property) => {
      if(property.cellId === location) {
        return {
          ...property,
          count: property.count + 1
        }
      } else {
        return property
      }
    })
    return [players_after, properties_after]
  } else {
    return [Array.from(players), Array.from(properties)]
  }
}

export function tryDeconstruct(players: DBManager.PlayerType[], properties: DBManager.PropertyType[], playerEmail: string, location: number, amount = 1): [DBManager.PlayerType[],DBManager.PropertyType[]] {
  const property_foundIdx = properties.findIndex(({cellId}) => cellId === location)
  const isDeconstructable = ((cell) => {
    if(property_foundIdx < 0) {
      return false
    }
    return ((properties[property_foundIdx].count) > 0) && (cell.maxBuildable !== 0)
  })(PREDEFINED_CELLS[location]);
  if(isDeconstructable) {
    const deconstruct_amount = Math.min(properties[property_foundIdx].count, amount)

    const players_after = players.map((player) => {
      if(player.email === playerEmail) {
        return {
          ...player,
          cash: player.cash + (300000 * deconstruct_amount)
        }
      } else {
        return player
      }
    })
    const properties_after = properties.map((property) => {
      if(property.cellId === location) {
        return {
          ...property,
          count: property.count - deconstruct_amount
        }
      } else {
        return property
      }
    }).filter((property) => property.count > 0)
    return [players_after, properties_after]
  } else {
    return [Array.from(players), Array.from(properties)]
  }
}