/// <reference lib="deno.unstable" />
const kv = await Deno.openKv()

import shuffle from "https://deno.land/x/shuffle/mod.ts";
import { Room } from "https://deno.land/x/socket_io@0.2.0/packages/socket.io/lib/adapter.ts";

const INITIAL_CASH = 4000000;

export type RoomDataType = {
  roomKey: string;
  hostEmail: string;
  maxGuests: number;
  guests: string[];
  isStarted: boolean;
  isEnded: boolean;
}

export type PlayerType = {
  email: string,
  icon: number,
  location: number,
  displayLocation: number,
  cash: number,
  cycles: number
}

export type PropertyType = {
  ownerEmail: string,
  count: number,
  cellId: number
}

export type GameStateType = {
  players: PlayerType[],
  properties: PropertyType[],
  nowInTurn: number
}


export async function createRoom(roomKey: string, hostEmail: string) {
  const search_result = await kv.get<RoomDataType>(["two-worlds", roomKey, "roomData"])
  if(search_result.value !== null) {
    return false;
  }
  const roomData: RoomDataType = {
    roomKey,
    hostEmail,
    maxGuests: 3,
    guests: [] as string[],
    isStarted: false,
    isEnded: false
  };
  await kv.set(["two-worlds", roomKey, "roomData"], roomData);
  const today = new Date()
  await kv.set(["two-worlds", roomKey, "logs"], [`[${today.getUTCFullYear()}-${today.getUTCMonth()}-${today.getUTCDate()} ${today.getUTCHours()}:${today.getUTCMinutes()}:${today.getUTCSeconds()}/UTC] room ${roomKey} created by ${hostEmail}`])
  return true;
}

export async function removeRoom(roomKey: string) {
  if(await kv.get(["two-worlds", roomKey]) === undefined) {
    return false;
  }
  await kv.delete(["two-worlds", roomKey]);
  return true;
}

export async function registerGuest(roomKey: string, guestEmail: string): Promise<[(string | null), boolean]> {
  let output = false
  if(await kv.get(["two-worlds", roomKey, "roomData"]) === undefined) {
    return ["incorrect roomKey", output];
  }
  const new_registry = (await kv.get<RoomDataType>(["two-worlds", roomKey, "roomData"])).value;
  if(new_registry !== null) {
    if(!new_registry.guests.includes(guestEmail)) {
      if(new_registry.guests.length >= new_registry.maxGuests) {
        return ["the room is already full",output];
      }
      if(new_registry.isStarted || new_registry.isEnded) {
        return ["the room has already started the game",output];
      }
      new_registry.guests.push(guestEmail);
      output = new_registry.guests.length >= new_registry.maxGuests
      await kv.set(["two-worlds", roomKey, "roomData"], new_registry)
      return ["already registered", output]
    }
  }
  return [null, output]
}

export async function startGame(roomKey: string) {
  const rawRoomData = await kv.get<RoomDataType>(["two-worlds", roomKey, "roomData"])
  const to_freeze = rawRoomData.value;
  if(to_freeze === null) {
    return null
  } else if(to_freeze.isEnded) {
    return null;
  } else {
    to_freeze.isStarted = true
  }

  await kv.set(["two-worlds", roomKey, "roomData"], to_freeze)
  
  const initial_state: GameStateType = {
    players: shuffle([to_freeze.hostEmail, ...to_freeze.guests]).map((email,icon) => ({email, icon,location: 0, displayLocation: 0, cash: INITIAL_CASH, cycles: 0})),
    properties: [],
    nowInTurn: 0
  }
  await kv.set(["two-worlds", roomKey, "gameState"], initial_state)
  return initial_state;
  
}

export async function endGame(roomKey: string) {
  const roomData = (await kv.get<RoomDataType>(["two-worlds", roomKey, "roomData"])).value
  if(roomData !== null) {
    roomData.isEnded = true
    await kv.set(["two-worlds", roomKey, "roomData"],roomData)
  }
}

export async function getGameState(roomKey: string) {
  return (await kv.get<GameStateType>(["two-worlds", roomKey, "gameState"])).value
}

export async function setGameState(roomKey: string, new_state: GameStateType) {
  await kv.set(["two-worlds", roomKey, "gameState"], new_state)
}