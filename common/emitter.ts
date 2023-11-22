import { Evt } from "evt";

export interface Todo {
  title: string;
  isDone: boolean;
  createdBy: string;
}

export const todoEmitter = Evt.create<Todo>();