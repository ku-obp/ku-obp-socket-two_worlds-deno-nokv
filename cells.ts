import { PaymentType, generateNormalPaymentInfo, generateP2DPaymentInfo, generateG2MPaymentInfo } from "./utils.ts";

import { sample } from "$std/collections/mod.ts"

import io from "./server.ts"

export type CellType = "infrastructure" | "industrial" | "land" | "lotto" | "charity" | "chance" | "transportation" | "hospital" | "park" | "concert" | "university" | "jail" | "start";

type CellDic = {
    [cell: string]: {
        cellId: number,
        name: string
    }
}

export const INFRASTRUCTURE_NAMES: CellDic={
    "water": {
        cellId: 7,
        name: "수자원"
    },
    "electricity": {
        cellId: 16,
        name: "전력"
    },
    "gas": {
        cellId: 21,
        name: "도시가스"
    }
}

export type BuildableFlagType = 0 | 1 | 3

export type TransactionType = {get?: number; pay?: number}

export interface ICellData {
    get type(): CellType;
    get name(): string;
    get maxBuildable(): BuildableFlagType;
    get paymentInfos(): PaymentType[];
    get cellId(): number;
    readonly group_id?: number;
}

export class Infrastructure implements ICellData {
    public get type(): CellType { return "infrastructure" }
    private readonly kind: keyof (typeof INFRASTRUCTURE_NAMES);
    private constructor(kind: keyof (typeof INFRASTRUCTURE_NAMES)) {
        this.kind = kind;
    }
    public get maxBuildable(): BuildableFlagType { return 0 }
    public get name() { return INFRASTRUCTURE_NAMES[this.kind].name }
    public get paymentInfos(): PaymentType[] {
        return [generateNormalPaymentInfo("P2G", 300000)]
    }
    public get cellId(): number {
      return INFRASTRUCTURE_NAMES[this.kind].cellId
    }
    public static readonly Infrastructures = (key: keyof typeof INFRASTRUCTURE_NAMES) => {
        return new Infrastructure(key)
    }
}

export class Land implements ICellData {
    get type(): CellType { return "land" }
    get paymentInfos(): PaymentType[] {
        return [
            generateNormalPaymentInfo("P2O",0,300000),
            generateNormalPaymentInfo("P2G",this._price)
        ]
    }
    private readonly _name: string;
    private readonly _price: number;
    public readonly group_id: number;
    private readonly _cell_id: number;
    public constructor(_cell_id: number, _name: string, _group_id: number) {
        this._cell_id = _cell_id
        this._name = _name;
        this._price = GROUP_PRICES[_group_id];
        this.group_id = _group_id;
    }
    public get maxBuildable(): BuildableFlagType { return 3 }
    public get name() { return this._name }
    public get cellId(): number {
        return this._cell_id
    }
}

export class Lotto implements ICellData {
    public get type(): CellType { return "lotto" }
    public get paymentInfos(): PaymentType[] {
        return [generateNormalPaymentInfo("P2M", 0,200000)]
    }
    private readonly _cell_id: number;
    private constructor(_cell_id: number = 3) {
        this._cell_id = _cell_id
    }
    public get cellId(): number {
        return this._cell_id
    }
    public get maxBuildable(): BuildableFlagType { return 0 }
    public get name() { return "로또" }
    public static readonly LottoCell = new Lotto()
}

export class Charity implements ICellData {
    public get type(): CellType { return "charity" }
    public get paymentInfos(): PaymentType[] {
        return [generateNormalPaymentInfo("P2C", 600000)]
    }
    private readonly _cell_id: number;
    private constructor(_cell_id: number = 52) {
        this._cell_id = _cell_id
    }
    public get cellId(): number {
        return this._cell_id
    }
    public get maxBuildable(): BuildableFlagType { return 0 }
    public get name() { return "구제기금" }

    public static readonly CharityCell = new Charity()
}

export class Chance implements ICellData {
    public get type(): CellType { return "chance" }
    public get paymentInfos(): PaymentType[] {
        return []
    }
    private readonly _cell_id: number;
    private constructor(_cell_id: number) {
        this._cell_id = _cell_id
    }
    public get cellId(): number {
        return this._cell_id
    }
    public get maxBuildable(): BuildableFlagType { return 0 }
    public get name() { return "변화카드" }
    public static readonly ChanceCells: {
        [cellId: number]: Chance
    } = {
        5: new Chance(5),
        14: new Chance(14),
        23: new Chance(23),
        31: new Chance(31),
        40: new Chance(40),
        50: new Chance(50)
    }
}

export class Transportation implements ICellData {
    public get type(): CellType { return "transportation" }
    public get paymentInfos(): PaymentType[] {
        return []
    }

    
    private readonly _cell_id: number;
    private constructor( _cell_id: number, dest: number) {
        this._cell_id = _cell_id
        this.dest = dest
    }
    public get cellId(): number {
        return this._cell_id
    }
    public get maxBuildable(): BuildableFlagType { return 0 }
    public get name() { return "대중교통" }
    public readonly dest: number
    public static readonly Transportations: {
        [cellId: number]: Transportation
    } = {
        1: new Transportation(1,10),
        10: new Transportation(10,19),
        19: new Transportation(19,28),
        28: new Transportation(28,37),
        37: new Transportation(37,46),
        46: new Transportation(46,1),
    }
}

export class Hospital implements ICellData {
    public get type(): CellType { return "hospital" }
    public get paymentInfos(): PaymentType[] {
        return [
            generateG2MPaymentInfo(100000),
            generateNormalPaymentInfo("P2M",100000,0)
        ]
    }
    private readonly _cell_id: number;
    private constructor(_cell_id: number = 45) {
        this._cell_id = _cell_id
    }
    public get cellId(): number {
        return this._cell_id
    }
    public get maxBuildable(): BuildableFlagType { return 0 }
    public get name() { return "병원" }

    public static readonly HospitalCell = new Hospital()    
}

export class Park implements ICellData {
    public get type(): CellType {
        return "park"
    }
    public get paymentInfos(): PaymentType[] {
        return []
    }
    private readonly _cell_id: number;
    private constructor(_cell_id: number = 36) {
        this._cell_id = _cell_id
    }
    public get cellId(): number {
        return this._cell_id
    }
    public get maxBuildable(): BuildableFlagType { return 0 }
    public get name() {return "공원"}

    public static readonly ParkCell = new Park()
}

export class University implements ICellData {
    public get type(): CellType { return "university" }
    public get paymentInfos(): PaymentType[] {
        return []
    }
    private readonly _cell_id: number;
    private constructor(_cell_id: number = 3) {
        this._cell_id = _cell_id
    }
    public get cellId(): number {
        return this._cell_id
    }
    public get maxBuildable(): BuildableFlagType { return 0 }
    public get name() { return "대학" }

    public static readonly UniversityCell = new University()
}

export class Jail implements ICellData {
    public get type(): CellType { return "jail" }
    public get paymentInfos(): PaymentType[] {
        return [{
            kind: "P2M",
            cost: {
                default: 0,
                additional: 400000
            }
        }]
    }
    private readonly _cell_id: number;
    private constructor(_cell_id: number = 9) {
        this._cell_id = _cell_id
    }
    public get cellId(): number {
        return this._cell_id
    }
    public get maxBuildable(): BuildableFlagType { return 0 }
    public get name() { return "감옥" }
    
    public static readonly JailCell = new Jail()
}

export class Start implements ICellData {
    public get type(): CellType { return "start" }
    public get paymentInfos(): PaymentType[] {
        return [
        ]
    }
    private constructor() {
    }
    public get cellId(): number {
      return 0
    }
    public get maxBuildable(): BuildableFlagType { return 0 }
    public get name() { return "출발" }

    public static readonly StartCell = new Start()
}

export class Concert implements ICellData {
    public get type(): CellType {
        return "concert"
    }
    public get name(): string {
        return "콘서트"
    }
    public get maxBuildable(): BuildableFlagType { return 0 }
    public get paymentInfos(): PaymentType[] {
        return [
            generateNormalPaymentInfo("P2M", 200000),
            generateNormalPaymentInfo("P2G", 200000),
            generateNormalPaymentInfo("P2C", 200000)
        ]
    }
    private readonly _cell_id: number;
    private constructor(_cell_id: number = 27) {
        this._cell_id = _cell_id
    }
    public get cellId(): number {
        return this._cell_id
    }
    public static readonly ConcertCell = new Concert()
}

const INDUSTRIAL_NAMES: CellDic = {
    "digital-complex": {
        cellId: 44,
        name: "지식정보단지"
    },
    "agriculture": {
        cellId: 35,
        name: "농공단지"
    },
    "factory": {
        cellId: 35,
        name: "산업단지"
    }
}

export class Industrial implements ICellData {
    public get type(): CellType { return "industrial" }
    private readonly kind: keyof (typeof INDUSTRIAL_NAMES);
    private constructor(kind: keyof (typeof INDUSTRIAL_NAMES)) {
        this.kind = kind;
    }
    public get maxBuildable(): BuildableFlagType { return 1 }
    public get name() { return INDUSTRIAL_NAMES[this.kind].name }
    public get paymentInfos(): PaymentType[] {
        return [
            generateP2DPaymentInfo(300000),
            generateNormalPaymentInfo("P2G", 600000)
        ]
    }
    public static readonly Industrials = (key: keyof typeof INDUSTRIAL_NAMES) => {
        return new Industrial(key)
    }
    public get cellId(): number {
        return INDUSTRIAL_NAMES[this.kind].cellId
    }
}




const GROUP_PRICES = [1, 2, 3, 4, 5, 6, 7, 8].reduce((accumulator: {[key: number]: number}, target: number) => ({...accumulator, [target]: (target * 100000)}),{} as {[key: number]: number})
const parsePredefined: {
    generators: {
        land: (cellId: number, name: string, groupId: number) => Land,
        transportation: (cellId: number) => Transportation,
        chance: (cellId: number) => Chance
    },
    fixed: {
        [type: string]: ICellData
    }
} = {
    generators: {
        land: (cellId: number, name: string, groupId: number) => new Land(cellId, name, groupId),
        transportation: (cellId: number) => Transportation.Transportations[cellId],
        chance: (cellId) => Chance.ChanceCells[cellId]
    },
    fixed: {
        "water": Infrastructure.Infrastructures("water"),
        "electricity": Infrastructure.Infrastructures("electricity"),
        "lotto": Lotto.LottoCell,
        "charity": Charity.CharityCell,
        "hospital": Hospital.HospitalCell,
        "university": University.UniversityCell,
        "jail": Jail.JailCell,
        "start": Start.StartCell,
        "gas": Infrastructure.Infrastructures("gas"),
        "concert": Concert.ConcertCell,
        "agriculture": Industrial.Industrials("agriculture"),
        "park": Park.ParkCell,
        "factory": Industrial.Industrials("factory"),
        "digital-complex": Industrial.Industrials("digital-complex")
    }
}


import PredefinedCells from "./predefined_cells.json" with { type: "json" }



function gatherPredefined(): ICellData[] {
    const sorted = PredefinedCells.toSorted((a,b) => a.cellId - b.cellId)
    const output: Array<ICellData> = []
    for(const c of sorted) {
        if (c.type === "chance") {
            const {cellId} = c as {
                cellId: number,
                type: string
            }
            output.push(parsePredefined.generators.chance(cellId))
        } else if (c.type === "land") {
            const {cellId, name, groupId} = c as {
                cellId: number,
                type: string,
                name: string,
                groupId: number
            };
            output.push(parsePredefined.generators.land(cellId, name, groupId))
        } else if (c.type === "transportation") {
            const {
                cellId
            } = c as {
                cellId: number,
                type: string
            };
            output.push(parsePredefined.generators.transportation(cellId))
        } else {
            output.push(parsePredefined.fixed[c.type])
        }
    }
    return output.toSorted((a,b) => a.cellId - b.cellId);
}

import * as DBManager from "./dbManager.ts"

import * as GameManager from "./gameManager.ts"


const PREDEFINED_CELLS: ICellData[] = gatherPredefined();

export default PREDEFINED_CELLS

type ChanceCard = {
    description: string,
    displayName: string,
    action: (state: DBManager.GameStateType, playerEmail: string) => Promise<DBManager.GameStateType | null>,
    isMoving: boolean
}

export const CHANCE_IDS = [
    "free-lotto",
    "scholarship",
    "discountRent",
    "bonus",
    "doubleLotto",
    "limitRents",
]

export type ChanceActionCallback = ({chances, payments}: {chances: {queue: string[], processed: number}, payments: {queue: {
    cellId: number,
    mandatory: GameManager.PaymentTransactionJSON | null,
    optional: GameManager.PaymentTransactionJSON | null
  }[], processed: number}}, {description, displayName}: {description: string, displayName: string}) => void

export type PaymentsActionCallback = ({chances, payments}: {chances: {queue: string[], processed: number}, payments: {queue: {
    cellId: number,
    mandatory: GameManager.PaymentTransactionJSON | null,
    optional: GameManager.PaymentTransactionJSON | null
  }[], processed: number}}, {mandatory, optional}:{
    mandatory: GameManager.PaymentTransactionJSON | null,
    optional: GameManager.PaymentTransactionJSON | null
}) => void


export async function chanceAction(roomId: string, state: DBManager.GameStateType, playerEmail: string, chanceId: string, callback: ChanceActionCallback) {
    const {description, displayName, action} = CHANCE_CARDS[chanceId]
    const state_after = await action(state,playerEmail)
    GameManager.safeEnqueueChance(roomId,chanceId,(q) => callback(q,{description,displayName}))
    return state_after
}

export const CHANCE_CARDS: {
    [chanceId: string]: ChanceCard
} = {
    "free-lotto": {
        description: "복권 당첨을 축하드립니다! 100만원을 받습니다.",
        displayName: "복권당첨",
        action: async ( state, playerEmail) => {
            const roomId = state.roomId
            const player_updates: DBManager.PlayerType[] = []
            for(const player of state.players) {
                player_updates.push({
                    ...player,
                    cash: player.cash + ((player.email === playerEmail) ? 1000000 : 0)
                })
            }
            GameManager.setGameState(roomId, {
                players: player_updates
            },(updated) => {
                io.to(roomId).emit("updateGameState", {fresh: false, gameState: updated})
            })
            const state_after = await GameManager.getGameState(roomId)
            if(state_after === null) return null
            else return state_after.flat()
        },
        isMoving: false
    },
    "scholarship": {
        description: "특별한 당신, 장학금을 받기까지 참 열심히 살았습니다. 수고 많았습니다. 대학(원)으로갑니다. (수업료 무료)",
        displayName: "장학금",
        action: async (state, playerEmail) => {
            const roomId = state.roomId
            const playerIdx = state.players.findIndex((player) => player.email === playerEmail)
            if(playerIdx < 0) {
                return null
            }
            GameManager.movePlayer(state,playerIdx,{
                kind: "forward",
                type: "navigateTo",
                dest: University.UniversityCell.cellId
            },(updated) => {
                GameManager.setGameState(roomId,updated,(_updated) => {
                    io.to(roomId).emit("updateGameState", {fresh: false, gameState: _updated})
                })
            },(updated) => {
                GameManager.setGameState(roomId,updated,(_updated) => {
                    io.to(roomId).emit("updateGameState", {fresh: false, gameState: _updated})
                })
            })
            const state_after = await GameManager.getGameState(roomId)
            if(state_after === null) return null
            else return state_after.flat()
        },
        isMoving: true
    },
    "discountRent": {
        description: "경기부양을 위해 소비 진작 할인쿠폰이 발행되었습니다. 토지/건물 사용료 50% 감면받습니다.",
        displayName: "임대료 감면",
        action: async ( state, playerEmail) => {
            const roomId = state.roomId
            const player_updates: DBManager.PlayerType[] = []
            for(const player of state.players) {
                if (player.email === playerEmail) {
                    player_updates.push({
                        ...player,
                        tickets: {
                            ...player.tickets,
                            discountRent: player.tickets.discountRent + 1
                        }
                    })
                } else {
                    player_updates.push(player)
                }
            }
            GameManager.setGameState(roomId, {
                players: player_updates
            },(updated) => {
                io.to(roomId).emit("updateGameState", {fresh: false, gameState: updated})
            })
            const state_after = await GameManager.getGameState(roomId)
            if(state_after === null) return null
            else return state_after.flat()   
        },
        isMoving: false
    },
    "bonus": {
        description: "회사가 증권시장에 상장되었습니다. 다음 차례 출발지를 지나갈 때 성과급 포함 2배의 급여를 받습니다.",
        displayName: "보너스 지급",
        action: async ( state, playerEmail) => {
            const roomId = state.roomId
            const player_updates: DBManager.PlayerType[] = []
            for(const player of state.players) {
                if (player.email === playerEmail) {
                    player_updates.push({
                        ...player,
                        tickets: {
                            ...player.tickets,
                            bonus: true
                        }
                    })
                } else {
                    player_updates.push(player)
                }
            }
            GameManager.setGameState(roomId, {
                players: player_updates
            },(updated) => {
                io.to(roomId).emit("updateGameState", {fresh: false, gameState: updated})
            })
            const state_after = await GameManager.getGameState(roomId)
            if(state_after === null) return null
            else return state_after.flat()   
        },
        isMoving: false
    },
    "doubleLotto": {
        description: "복권 게임 시 당첨금 2배가 됩니다.",
        displayName: "곱빼기 복권",
        action: async ( state, playerEmail) => {
            const roomId = state.roomId
            const player_updates: DBManager.PlayerType[] = []
            for(const player of state.players) {
                if (player.email === playerEmail) {
                    player_updates.push({
                        ...player,
                        tickets: {
                            ...player.tickets,
                            doubleLotto: player.tickets.doubleLotto + 1
                        }
                    })
                } else {
                    player_updates.push(player)
                }
            }
            GameManager.setGameState(roomId, {
                players: player_updates
            },(updated) => {
                io.to(roomId).emit("updateGameState", {fresh: false, gameState: updated})
            })
            const state_after = await GameManager.getGameState(roomId)
            if(state_after === null) return null
            else return state_after.flat()   
        },
        isMoving: false
    },
    "limitRents": {
        description: "부동산투기가 심각합니다. 전면적인 임대료 통제정책이 시행됩니다. 1턴 동안 임대료가 면제됩니다.",
        displayName: "임대료 통제",
        action: async ( state, _playerEmail) => {
            const roomId = state.roomId
            GameManager.setGameState(roomId,{
                sidecars: {
                    limitRents: state.sidecars.limitRents + 4
                }
            },(updated) => {
                io.to(roomId).emit("updateGameState", {fresh: false, gameState: updated})
            })
            const state_after = await GameManager.getGameState(roomId)
            if(state_after === null) return null
            else return state_after.flat()   
        },
        isMoving: false
    }
}

export function randomChanceId() {
    return sample(CHANCE_IDS) as string
}

export function transact<T extends ICellData>(playerEmail: string, players: DBManager.PlayerType[], properties: DBManager.PropertyType[], cell: T): {
    mandatory?: GameManager.PaymentTransaction,
    optional?: GameManager.PaymentTransaction
} {
    const mandatories: GameManager.PaymentTransaction[] = []
    const optionals: GameManager.PaymentTransaction[] = []
    const paymentInfos = Array.from(cell.paymentInfos)
    const playerIdx_now = players.findIndex((player) => player.email === playerEmail)
    if(playerIdx_now < 0) {
        return {}
    }
    const tmp = properties.find((p) => p.cellId === cell.cellId)
    const owned = (tmp !== undefined)

    switch(cell.type) {
        case "chance":
        case "transportation":
        case "park":
        case "university":
        case "start":
        default:
            return {};
        case "industrial": {
                const p2g_transactions: GameManager.PaymentTransaction[] = []
                for(const payment_info of paymentInfos) {
                    if(payment_info.kind === "P2G") {
                        p2g_transactions.push(GameManager.PaymentTransaction.P2G(players[playerIdx_now].icon,payment_info.cost.default))
                    }
                }
                mandatories.push(p2g_transactions.reduce(((acc, curr) => acc.merge(curr)), new GameManager.PaymentTransaction({})))
                if(owned) {
                    const ownerIdx = players.findIndex((player) => player.email === tmp.ownerEmail)
                    if(ownerIdx < 0) {
                        break;
                    }
                    
                    const p2d_transactions: GameManager.PaymentTransaction[] = []
                    const players_count = players.length
                    for(const payment_info of paymentInfos) {
                        if(payment_info.kind === "P2D") {
                            for (const other of players.filter(({icon}) => icon !== players[playerIdx_now].icon)) {
                                p2d_transactions.push(GameManager.PaymentTransaction.P2P(players[playerIdx_now].icon,other.icon,(payment_info.cost.overall / players_count)))
                            }
                            if(playerIdx_now !== ownerIdx) {
                                p2d_transactions.push(GameManager.PaymentTransaction.unidirectional(players[playerIdx_now].icon, -(payment_info.cost.overall / players_count)))
                            }
                        }
                    }
                    
                    mandatories.push(p2d_transactions.reduce(((acc, curr) => acc.merge(curr)), new GameManager.PaymentTransaction({})))
                    
                } else {
                    for(const payment_info of paymentInfos) {
                        if(payment_info.kind === "P2D") {
                            optionals.push(GameManager.PaymentTransaction.unidirectional(players[playerIdx_now].icon, -(payment_info.cost.overall)))
                        }
                    }
                }
            }
            break;
        case "infrastructure": {
                const p2g_transactions: GameManager.PaymentTransaction[] = []
                for(const payment_info of paymentInfos) {
                    if(payment_info.kind === "P2G") {
                        p2g_transactions.push(GameManager.PaymentTransaction.P2G(players[playerIdx_now].icon,payment_info.cost.default))
                    }
                }
            }
            break;
        case "land": {
                const p2g_transactions: GameManager.PaymentTransaction[] = []
                const p2o_transactions: GameManager.PaymentTransaction[] = []
                if(owned) {
                    const {all_built, minimum_constructed} = (cell.group_id !== undefined) ? ((() => {
                        const others_in_group = PREDEFINED_CELLS.filter(({group_id}) => group_id === cell.group_id)
                        const output: {built: boolean, count: number}[] = others_in_group.map((other) => {
                            const prop_found: DBManager.PropertyType | null = properties.find((p) => p.cellId === other.cellId) ?? null
                            if(prop_found === null) {
                                return {
                                    built: false,
                                    count: 0
                                }
                            } else {
                                return {
                                    built: (prop_found.count > 0),
                                    count: Math.max(0,prop_found.count)
                                }
                            }
                        })
                        return output
                    })().reduce((acc, curr) => ({
                        all_built: acc.all_built && curr.built,
                        minimum_constructed: Math.min(acc.minimum_constructed, curr.count)
                    }), {all_built: true, minimum_constructed: 3})) : ({
                        all_built: false,
                        minimum_constructed: 0
                    })
                    
                    const coefficient = (all_built) ? (2 * minimum_constructed) : 1

                    for(const payment_info of paymentInfos) {
                        if(payment_info.kind === "P2G") {
                            p2g_transactions.push(GameManager.PaymentTransaction.P2G(players[playerIdx_now].icon,(payment_info.cost.default * coefficient)))
                        }
                    }

                    const ownerIdx = players.findIndex((player) => player.email === tmp.ownerEmail)
                    if(ownerIdx < 0) {
                        break;
                    }
                    mandatories.push(p2g_transactions.reduce(((acc, curr) => acc.merge(curr)), new GameManager.PaymentTransaction({})))
                    
                    
                    if(playerIdx_now !== ownerIdx) {
                        for(const payment_info of paymentInfos) {
                            if(payment_info.kind === "P2O") {
                                p2o_transactions.push(GameManager.PaymentTransaction.P2P(players[playerIdx_now].icon,players[ownerIdx].icon,payment_info.cost.additional))
                            }
                        }
                        mandatories.push(p2o_transactions.reduce(((acc, curr) => acc.merge(curr)), new GameManager.PaymentTransaction({})))
                    } else if (tmp.count < 3) {
                        for(const payment_info of paymentInfos) {
                            if(payment_info.kind === "P2O") {
                                p2o_transactions.push(GameManager.PaymentTransaction.unidirectional(players[playerIdx_now].icon,-(payment_info.cost.additional)))
                            }
                        }
                        optionals.push(p2o_transactions.reduce(((acc, curr) => acc.merge(curr)), new GameManager.PaymentTransaction({})))
                    }
                    
                    
                } else {
                    for(const payment_info of paymentInfos) {
                        if(payment_info.kind === "P2G") {
                            p2g_transactions.push(GameManager.PaymentTransaction.P2G(players[playerIdx_now].icon,payment_info.cost.default))
                        }
                    }
                    mandatories.push(p2g_transactions.reduce(((acc, curr) => acc.merge(curr)), new GameManager.PaymentTransaction({})))
                    
                    for(const payment_info of paymentInfos) {
                        if(payment_info.kind === "P2O") {
                            p2o_transactions.push(GameManager.PaymentTransaction.unidirectional(players[playerIdx_now].icon,-(payment_info.cost.additional)))
                        }
                    }
                    optionals.push(p2o_transactions.reduce(((acc, curr) => acc.merge(curr)), new GameManager.PaymentTransaction({})))
                    
                }
            }
            break;
        case "lotto":
            for(const payment_info of paymentInfos) {
                if(payment_info.kind === "P2M") {
                    optionals.push(GameManager.PaymentTransaction.unidirectional(players[playerIdx_now].icon,-(payment_info.cost.additional)))
                }
            }
            break;
        case "charity":
            for(const payment_info of paymentInfos) {
                if(payment_info.kind === "P2C") {
                    mandatories.push(GameManager.PaymentTransaction.P2C(players[playerIdx_now].icon,payment_info.cost.default))
                }
            }
            break;
        case "hospital":
            for(const payment_info of paymentInfos) {
                if(payment_info.kind === "G2M") {
                    mandatories.push(GameManager.PaymentTransaction.G2M(payment_info.cost.fixed))
                } else if(payment_info.kind === "P2M") {
                    mandatories.push(GameManager.PaymentTransaction.unidirectional(players[playerIdx_now].icon,-(payment_info.cost.default)))
                }
            }
            break;
        case "concert":
            for(const payment_info of paymentInfos) {
                if(payment_info.kind === "P2G") {
                    mandatories.push(GameManager.PaymentTransaction.P2G(players[playerIdx_now].icon,payment_info.cost.default))
                } else if (payment_info.kind == "P2C") {
                    mandatories.push(GameManager.PaymentTransaction.P2C(players[playerIdx_now].icon,payment_info.cost.default))
                } else if(payment_info.kind === "P2M") {
                    mandatories.push(GameManager.PaymentTransaction.unidirectional(players[playerIdx_now].icon,-(payment_info.cost.default)))
                }
            }
            break;
        case "jail":
            for(const payment_info of paymentInfos) {
                if(payment_info.kind === "P2M") {
                    optionals.push(GameManager.PaymentTransaction.unidirectional(players[playerIdx_now].icon,-(payment_info.cost.default)))
                }
            }
            break;
    }
    return {
        mandatory: (mandatories.length > 0) ? mandatories.reduce(((acc, curr) => acc.merge(curr)), new GameManager.PaymentTransaction({})) : undefined,
        optional: (optionals.length > 0) ? optionals.reduce(((acc, curr) => acc.merge(curr)), new GameManager.PaymentTransaction({})) : undefined
    }
}