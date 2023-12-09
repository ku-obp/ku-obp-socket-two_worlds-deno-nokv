export type RoomDictionray<T> = {
    [roomId: string]: T
}


export type PlayerIconType = 0 | 1 | 2 | 3

export type QueuesType = {
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

export type RoomDataType = {
  hostEmail: string;
  maxGuests: number;
  guests: string[];
  isStarted: boolean;
  isEnded: boolean;
}

export type AllDataType = {
  roomId: string,
  roomData: RoomDataType,
  gameState: GameStateType,
  queues: QueuesType,
  doublesCount: number,
  dices: {
    dice1: DiceType,
    dice2: DiceType
  }
}

export class DBType{
  private _internal: Map<string, AllDataType>
  private constructor() {
    this._internal = new Map<string, AllDataType>
  }
  public room(roomId: string) {
    return this._internal.get(roomId)
  }
  
  public initializeRoom(roomId: string, host: string, ...guests: string[]) {
    const room: AllDataType = {
      roomId,
      roomData: {
        hostEmail: host,
        maxGuests: guests.length,
        guests: guests,
        isStarted: true,
        isEnded: false
      },
      gameState: {
        roomId: roomId,
        players: ((arr: string[]): PlayerType[] => [
            {email: arr[0], icon: 0,location: 0, displayLocation: 0, cash: INITIAL_CASH, cycles: 0, university: "notYet", tickets: {discountRent: 0, bonus: false, doubleLotto: 0}, remainingJailTurns: 0},
            {email: arr[1], icon: 1,location: 0, displayLocation: 0, cash: INITIAL_CASH, cycles: 0, university: "notYet", tickets: {discountRent: 0, bonus: false, doubleLotto: 0}, remainingJailTurns: 0},
            {email: arr[2], icon: 2,location: 0, displayLocation: 0, cash: INITIAL_CASH, cycles: 0, university: "notYet", tickets: {discountRent: 0, bonus: false, doubleLotto: 0}, remainingJailTurns: 0},
            {email: arr[3], icon: 3,location: 0, displayLocation: 0, cash: INITIAL_CASH, cycles: 0, university: "notYet", tickets: {discountRent: 0, bonus: false, doubleLotto: 0}, remainingJailTurns: 0},
        ])(Array.from([host].concat(guests))),
        properties: [],
        nowInTurn: 0,
        govIncome: 0,
        charityIncome: 0,
        sidecars: {
            limitRents: 0
        }
      },
      doublesCount: 0,
      dices: {
        dice1: 0,
        dice2: 0
      },
      queues: {
        chances: {
          queue: [],
          processed: 0
        },
        payments: {
          queue: [],
          processed: 0
        }
      }
    }
    this._internal = this._internal.set(roomId, room)
  }

  public removeRoom(roomId: string) {
    return this._internal.delete(roomId)
  }

  public get(roomId: string) {
    return this._internal.get(roomId)
  }

  private static copyQueue<T>(q: {queue: T[], processed: number}) {
    return {
      queue: Array.from(q.queue),
      processed: q.processed
    }
  }

  public static copyGameState(g: GameStateType): GameStateType {
    return {
      roomId: String(g.roomId),
      players: Array.from(g.players),
      properties: Array.from(g.properties),
      nowInTurn: g.nowInTurn,
      govIncome: g.govIncome,
      charityIncome: g.charityIncome,
      sidecars: g.sidecars
    }
  }

  private static copyIfDefined<T>(copy: (v: T) => T, a: T, b?: T): T {
    if(b === undefined || b === null) {
      return a
    } else {
      return copy(b)
    }
  }

  private static overwrite(orig: AllDataType, ...updates: Partial<AllDataType>[]): AllDataType {
    return updates.reduce<AllDataType>(
      (acc, curr) => {
        const gameState = this.copyIfDefined(this.copyGameState,acc.gameState, curr.gameState)
        const queues: QueuesType = curr.queues ?? {
          chances: this.copyQueue(acc.queues.chances),
          payments: this.copyQueue(acc.queues.payments)
        }
        const doublesCount = curr.doublesCount ?? acc.doublesCount
        const {
          dice1, dice2
        } = curr.dices ?? acc.dices
        return {
          roomId: orig.roomId,
          roomData: orig.roomData,
          gameState,
          queues,
          doublesCount,
          dices: {dice1, dice2}
        }
      },orig
    )
  }

  private static overwriteState(orig: GameStateType, ...updates: Partial<GameStateType>[]): GameStateType {
    return updates.reduce<GameStateType>(
      (acc, curr) => {
        const output: GameStateType = {
          roomId: this.copyIfDefined(String,acc.roomId, curr.roomId),
          players: this.copyIfDefined(Array.from<PlayerType>,acc.players,curr.players),
          properties: this.copyIfDefined(Array.from<PropertyType>,acc.properties,curr.properties),
          nowInTurn: curr.nowInTurn ?? acc.nowInTurn,
          govIncome: curr.govIncome ?? acc.govIncome,
          charityIncome: curr.charityIncome ?? acc.charityIncome,
          sidecars: curr.sidecars ?? acc.sidecars
        }
        return output
      },orig
    )
  }

  public updateRoom(roomId: string, updates: Partial<AllDataType>, callback: (updated: AllDataType) => void) {
    const got = this.get(roomId)
    if(got === undefined) {
      return;
    }
    const updated = DBType.overwrite(got,updates)
    this._internal = this._internal.set(roomId, updated)
    callback(updated)
  }

  public updateGameState(roomId: string, updates: Partial<GameStateType>, callback: (updated: GameStateType) => void) {
    const got = this.get(roomId)
    if(got === undefined) {
      return;
    }
    const updatedState = DBType.overwriteState(got.gameState,updates)
    const updated = DBType.overwrite(got,{
      gameState: updatedState
    })
    this._internal = this._internal.set(roomId, updated)
    callback(updatedState)
    return updatedState
  }

  public commitDoubles(roomId: string) {
    const got = this._internal.get(roomId)
    if(got === undefined) {
      return;
    }
    const doubles_count = got.doublesCount
    const new_doubles_count = (doubles_count < 3) ? Math.min(Math.max(0,doubles_count + 1), 3) : 0
    got.doublesCount = new_doubles_count
    this._internal = this._internal.set(roomId, got)
    return new_doubles_count
  }

  public flushDoubles(roomId: string) {
    const got = this._internal.get(roomId)
    if(got === undefined) {
      return;
    }
    got.doublesCount = 0
    this._internal = this._internal.set(roomId, got)
  }

  private static joinFinances(players: PlayerType[], properties: PropertyType[]): {
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

  private static calculateOverallFinances(players: PlayerType[], properties: PropertyType[]): {
    playerEmail: string,
    value: number
  }[] {
    return this.joinFinances(players,properties).map(({playerEmail,cash,owns}) => ({
      playerEmail,
      value: (owns * 300000) + cash
    }))
  }

  public endGame(roomId: string) {
    const allState = this.get(roomId)
    if(allState === undefined) {
      return []
    }
    const copied = DBType.copyGameState(allState.gameState)
    const overall_finances = DBType.calculateOverallFinances(copied.players,copied.properties)
    allState.roomData.isEnded = true
    this._internal = this._internal.set(roomId,allState)
    return overall_finances
  }

  public static DB: DBType = new DBType()
}



export type UniversityStateType = "notYet" | "undergraduate" | "graduated"

export type PlayerType = {
    email: string,
    icon: PlayerIconType,
    location: number,
    displayLocation: number,
    cash: number,
    cycles: number,
    university: UniversityStateType,
    tickets: {
        discountRent: number,
        bonus: boolean,
        doubleLotto: number,
    },
    remainingJailTurns: number,
}

export type PropertyType = {
    ownerEmail: string,
    count: number,
    cellId: number
}

export type GameStateType = {
    roomId: string,
    players: PlayerType[],
    properties: PropertyType[],
    nowInTurn: number,
    govIncome: number,
    charityIncome: number,
    sidecars: {
        limitRents: number
    }
}

import { CellType } from "./cells.ts";

export type TaskType = {
    state_after: GameStateType,
    cellType: CellType,
    turn_finished: boolean
}

export type DiceType = 0 | 1 | 2 | 3 | 4 | 5 | 6




const INITIAL_CASH = 6000000;

import io from "./server.ts"

import * as Utils from "./utils.ts"


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
  
    public static P2G(playerIcon: PlayerIconType, amount: number) {
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
  
    public static P2C(playerIcon: PlayerIconType, amount: number) {
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
  
    public static unidirectional(playerIcon: PlayerIconType, amount: number) {
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
  
    public static P2P(from: PlayerIconType, to: PlayerIconType, amount: number): PaymentTransaction {
        const different_pair = Utils.DifferentNumberPair.checkDifferent<PlayerIconType>(from, to)
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

export const movePlayer = (game_state: GameStateType, playerIdx: number, args: {
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
  }, eachCallback: (updated: Partial<GameStateType>) => void, finalCallback: (updated: Partial<GameStateType>) => void): {
    can_get_salery: boolean,
    dest: number,
    state_after_move: GameStateType
} | null => {
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
    const state_after_move = DBType.DB.get(game_state.roomId)?.gameState
    return (state_after_move !== undefined) ? {can_get_salery, dest, state_after_move } : null
}

const movePrimitive = (players: PlayerType[], playerIdx: number, new_location: number, callback: (updated: Partial<GameStateType>) => void) => {
  const tmp = Array.from(players)  
  Timeout.wait(600)
    .then(() => {
      tmp[playerIdx].displayLocation = new_location % 54
      const update: Partial<GameStateType> = {
        players: tmp
      }
      callback(update)
    })
    return tmp
}
  
export function distributeBasicIncome(players: PlayerType[], government_income: number) {
    return {
      players: players.map((player) => {
        return {
          ...player,
          cash: player.cash + government_income / 4
        }
      }) as PlayerType[],
      government_income: 0
    }
}

export function giveSalery(state: GameStateType, playerEmail: string, government_income: number, callback: (updated: Partial<GameStateType>) => void): GameStateType | undefined {
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
  
    const players_after: PlayerType[] = state.players.map((player) => {
      return {
        ...player,
        cash: player.cash + overall.playerTransactions[player.icon]
      };
    })
    
    return DBType.DB.updateGameState(state.roomId,{
      players: players_after,
      govIncome: 0
    },callback)
}

const universityAction = (university: UniversityStateType): UniversityStateType => {
    if(university === "notYet") return "undergraduate"
    else return "graduated"
}


const jailAction = (roomId: string, players: PlayerType[], playerIdx_now: number) => {
    const player_updates = Array.from(players)
    players[playerIdx_now].remainingJailTurns = ((remainingJailTurns) => {
        if(remainingJailTurns <= 0) {
            return 3
        } else {
            return remainingJailTurns - 1
        }
    })(players[playerIdx_now].remainingJailTurns)
    

    const state_after = DBType.DB.updateGameState(roomId, {
      players: player_updates
    },(updated) => {
      io.to(roomId).emit("updateGameState", {fresh: false, gameState: updated})
    })
    
    return state_after
}

export const cellAction = (state: GameStateType, playerEmail: string): TaskType | null => {
    const roomId = state.roomId
    const playerIdx_now = state.players.findIndex((player) => player.email === playerEmail)
    if(playerIdx_now >= 0) {
      const player_now = state.players[playerIdx_now]
      const cell = PREDEFINED_CELLS[player_now.location]
      const {
        type,
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
            io.to(roomId).emit("syncQueue",{kind: "notifyChanceCardAcquistion", queues: q,payload: c})
          }
          const state_after = chanceAction(roomId,  state, playerEmail, chanceId, chanceActionCallback)
          if(state_after !== null) {
            return {
              state_after,
              cellType: type,
              turn_finished: false
            }
          } else {return null}
        } else if(type === "transportation") {
          const dest = (cell as Transportation).dest
          const after_move = movePlayer(state,playerIdx_now,{
            kind: "warp",
            dest: dest
          },(updated) => {
            DBType.DB.updateGameState(roomId,updated,(_updated) => {
              io.to(roomId).emit("updateGameState", {fresh: false, gameState: _updated})
            })
          },(updated) => {
            DBType.DB.updateGameState(roomId,updated,(_updated) => {
              io.to(roomId).emit("updateGameState", {fresh: false, gameState: _updated})
            })
          })
          if(after_move !== null) {
            return {
              state_after: after_move.state_after_move,
              cellType: type,
              turn_finished: true
            }
          } else {
            return null
          }
        } else {
          const updates: Partial<GameStateType> = ((players: PlayerType[]) => {
            const players_new = Array.from(players)
            players_new[playerIdx_now].university = universityAction(players_new[playerIdx_now].university)
            return {
              players: players_new
            }
          })(state.players)
          const after = DBType.DB.updateGameState(roomId,updates,(updated) => {
            io.to(roomId).emit("updateGameState", {fresh: false, gameState: updated})
          })
          if(after !== undefined) {  
            return {
              state_after: after,
              cellType: type,
              turn_finished: true
            }
          }
          else {return null}
        }
      } else if(type === "jail") {
        const state_after = jailAction(roomId,state.players,playerIdx_now)
        if (state_after !== undefined) {
          return {
            state_after,
            cellType: type,
            turn_finished: true
          }
        } else {
          return null
        }
      } else { // 돈을 지불하는 칸들
        const p =  transact(playerEmail,Array.from(state.players),Array.from(state.properties),cell)
        const [mandatory, optional] = [p.mandatory ?? null, p.optional ?? null]
  
        const paymentsActionCallback: PaymentsActionCallback = (q,p) => {
          io.to(roomId).emit("syncQueue",{kind: "notifyPayments", queues: q,payload: {
            type, name: cell.name,maxBuildable: cell.maxBuildable, invoices: p
          }})
        }
        safeEnqueuePayment(roomId,cellId,{mandatory, optional},(q) => paymentsActionCallback(q,{mandatory,optional}))
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

export function safeEnqueueChance(roomId: string, chanceId: string, callback: QueueCallback) {
    const newRq = (() => {
      const queues = DBType.DB.get(roomId)?.queues
      if(queues === undefined) {
        return;
      }
      queues.chances = {
          queue: queues.chances.queue.concat(chanceId),
          processed: queues.chances.processed
      }
      return queues
    })()
    if(newRq !== undefined) {
      DBType.DB.updateRoom(roomId,{
        queues: newRq
      },(_) => callback(newRq))
    }
}

export function safeDequeueChance(roomId: string, callback: QueueCallback) {
  const rq = DBType.DB.get(roomId)?.queues
  try {
    if(rq === undefined) {
      throw {}
    } else {
      const length = rq.chances.queue.length
      const idx = rq.chances.processed
      if(idx >= length) {
        throw {}
      } else {
        const output = rq.chances.queue[idx]
        rq.chances.processed = Math.min(idx + 1,length)
        DBType.DB.updateRoom(roomId,{
          queues: rq
        },(_) => callback(rq))
        return output
      }
    }
  }
  catch {
    return null
  }
}

export function safeFlushChances(roomId: string, callback: QueueCallback) {
  const rq = DBType.DB.get(roomId)?.queues
  if(rq !== undefined) {
    rq.chances = {
      queue: new Array<string>(),
      processed: 0
    }
    DBType.DB.updateRoom(roomId,{
      queues: rq,
    },(_) => callback(rq))
  }
}

export function safeEnqueuePayment(roomId: string, cellId: number, {mandatory, optional}: {mandatory: PaymentTransaction | null, optional: PaymentTransaction | null}, callback: QueueCallback) {
  const newRq = (() => {
    const queues = DBType.DB.get(roomId)?.queues
    if(queues === undefined) {
      return;
    }
    queues.payments.queue = queues.payments.queue.concat({cellId, mandatory,optional})
    return queues
  })()
  if(newRq !== undefined) {
    DBType.DB.updateRoom(roomId,{
      queues: newRq
    },(_) => callback(newRq))
  }
}

export function safeDequeuePayment(roomId: string, callback: QueueCallback) {
  const rq = DBType.DB.get(roomId)?.queues
  try {
    if(rq === undefined) {
      throw {}
    } else {
      const length = rq.payments.queue.length
      const idx = rq.payments.processed
      if(idx >= length) {
        throw {}
      } else {
        const json = rq.payments.queue[idx]
        rq.payments.processed = Math.min(idx + 1,length)
        DBType.DB.updateRoom(roomId,{
          queues: rq
        },(_) => callback(rq))
        const converted = {
          cellId: json.cellId,
          mandatory: Utils.nullableMapper(json.mandatory,PaymentTransaction.fromJSON,{mapNullIsGenerator: false, constant: null}),
          optional: Utils.nullableMapper(json.optional,PaymentTransaction.fromJSON,{mapNullIsGenerator: false, constant: null})
        }
        return converted
      }
    }
  }
  catch {
    return null
  }
}

export function safeFlushPayments(roomId: string, callback: QueueCallback) {
  const rq = DBType.DB.get(roomId)?.queues
  if(rq !== undefined) {
    rq.payments = {
      queue: [],
      processed: 0
    }
    DBType.DB.updateRoom(roomId,{
      queues: rq,
    },(_) => callback(rq))
  }
}

export function tryConstruct(players: PlayerType[], properties: PropertyType[], playerEmail: string, location: number): [PlayerType[],PropertyType[]] {
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

export function tryDeconstruct(players: PlayerType[], properties: PropertyType[], playerEmail: string, location: number, amount = 1): [PlayerType[],PropertyType[]] {
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

export function setDices(roomId: string, callback: (dice1: 0 | 1 | 2 | 3 | 4 | 5 | 6, dice2: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void, dices: {dice1: 1 | 2 | 3 | 4 | 5 | 6, dice2: 1 | 2 | 3 | 4 | 5 | 6} | undefined) {
  const roomDices = DBType.DB.get(roomId)?.dices
  if(roomDices === undefined) {
    return;
  }
  if(dices === undefined) {
    roomDices.dice1 = roomDices.dice2 = 0
  } else {
    roomDices.dice1 = dices.dice1
    roomDices.dice2 = dices.dice2
  }
  DBType.DB.updateRoom(roomId,{
    dices: roomDices
  },(_) => callback(roomDices.dice1, roomDices.dice2))
}