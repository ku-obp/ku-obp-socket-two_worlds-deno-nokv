/// <reference lib="deno.unstable" />
const kv = (Deno.env.get("DENO_KV_ACCESS_TOKEN") === "hwfijkyyppfwy3zt2y877wl0qlq4m1r7") ? await Deno.openKv("https://ku-obp-socket-two-worlds-deno-flyio.fly.dev/") : await Deno.openKv()

 


import { PaymentTransactionJSON } from './gameManager.ts';

export type PlayerIconType = 0 | 1 | 2 | 3

export type RoomDataType = {
    roomId: string;
    hostEmail: string;
    maxGuests: number;
    guests: string[];
    isStarted: boolean;
    isEnded: boolean;
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

type LogType = {
    at: Date,
    message: string
}

export function generateLog(message: string): LogType {
    return {
        at: new Date(),
        message
    }
}


export type RoomLogsType = {
    roomId: string,
    logs: LogType[]
}



export type PlayingConnectionType = {
    socketId: string,
    email: string
}

import { CellType } from "./cells.ts";

export type TaskType = {
    state_after: GameStateType | null,
    cellType: CellType,
    turn_finished: boolean
}
export type RoomQueueType = {
    roomId: string,
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

export type DiceType = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type RoomDoublesCountType = {
    roomId: string,
    count: number
}

export type RoomDicesType = {
    roomId: string,
    dice1: DiceType,
    dice2: DiceType
}


import { model, kvdex, collection } from "https://deno.land/x/kvdex@v0.25.0/mod.ts"

const RoomDataModel = model<RoomDataType>();
const GameStateModel = model<GameStateType>();
const RoomLogsModel = model<RoomLogsType>();
const RoomQueueModel = model<RoomQueueType>();
const RoomDoublesCountModel = model<RoomDoublesCountType>();
const RoomDicesModel = model<RoomDicesType>();

const db = kvdex(kv,{
    gameState: collection(GameStateModel, {
        indices: {
            roomId: "primary"
        },
        serialize: "json"
    }),
    roomData: collection(RoomDataModel, {
        indices: {
            roomId: "primary"
        },
        serialize: "json"
    }),
    roomLogs: collection(RoomLogsModel, {
        indices: {
            roomId: "primary"
        },
        serialize: "json"
    }),
    roomQueue: collection(RoomQueueModel, {
        indices: {
            roomId: "primary"
        },
        serialize: "json"
    }),
    roomDouble: collection(RoomDoublesCountModel, {
        indices: {
            roomId: "primary"
        },
        serialize: "json"
    }),
    roomDices: collection(RoomDicesModel, {
        indices: {
            roomId: "primary"
        },
        serialize: "json"
    })
})

export default db
