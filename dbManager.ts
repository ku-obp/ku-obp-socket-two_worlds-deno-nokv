import { PaymentTransactionJSON } from './gameManager.ts';

export type RoomDictionray<T> = {
    [roomId: string]: T
}


export type PlayerIconType = 0 | 1 | 2 | 3

export const roomData: RoomDictionray<{
    hostEmail: string;
    maxGuests: number;
    guests: string[];
    isStarted: boolean;
    isEnded: boolean;
}> = {}

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

export const gameStates: RoomDictionray<GameStateType> = {}

import { CellType } from "./cells.ts";

export type TaskType = {
    state_after: GameStateType,
    cellType: CellType,
    turn_finished: boolean
}
export type RoomQueueType = RoomDictionray<{
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
}>

export const roomQueue: RoomQueueType = {}

export type DiceType = 0 | 1 | 2 | 3 | 4 | 5 | 6
export const roomDoublesCount: RoomDictionray<number> = {}

export const RoomDices: RoomDictionray<{
    dice1: DiceType,
    dice2: DiceType
}> = {}
