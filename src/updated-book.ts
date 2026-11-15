import { RoomName, Status } from "./models.js";

export interface UpdateBook {
    room?: RoomName,
    customer?: string,
    date? : string,
    start? : number,
    hours? : number,
    status?: Status
}