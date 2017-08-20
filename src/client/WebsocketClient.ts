"use strict";

import { EventEmitter } from "events";
import { ButtplugClient } from "./Client";
import { ButtplugMessage, FromJSON } from "../core/Messages";

export class ButtplugWebsocketClient extends ButtplugClient {
  private _ws: WebSocket | undefined;

  constructor(aClientName: string) {
    super(aClientName);
  }

  public get Connected(): boolean {
    return this._ws !== undefined;
  }

  public ParseIncomingMessage = (aEvent: MessageEvent) => {
    if (typeof (aEvent.data) === "string") {
      const msgs = FromJSON(aEvent.data);
      this.ParseMessages(msgs);
    } else if (aEvent.data instanceof Blob) {
      const reader = new FileReader();
      reader.addEventListener("load", (ev) => { this.OnReaderLoad(ev); });
      reader.readAsText(aEvent.data);
    }
  }

  public Connect = async (aUrl: string): Promise<void> => {
    const ws = new WebSocket(aUrl);
    let res;
    let rej;
    const p = new Promise<void>((resolve, reject) => { res = resolve; rej = reject; });
    const conErrorCallback = (ev) => { rej(ev); };
    ws.addEventListener("open", async (ev) => {
      this._ws = ws;
      this._ws.addEventListener("message", (aMsg) => { this.ParseIncomingMessage(aMsg); });
      this._ws.removeEventListener("close", conErrorCallback);
      this._ws.addEventListener("close", this.Disconnect);
      if (!(await this.InitializeConnection())) {
        rej();
        return;
      }
      res();
    });
    ws.addEventListener("close", conErrorCallback);
    return p;
  }

  public Disconnect = () => {
    if (!this.Connected) {
      return;
    }
    this.ShutdownConnection();
    this._ws!.close();
    this._ws = undefined;
    this.emit("close");
  }

  protected Send = (aMsg: ButtplugMessage) => {
    if (!this.Connected) {
      throw new Error("ButtplugClient not connected");
    }
    this._ws!.send("[" + aMsg.toJSON() + "]");
  }

  private OnReaderLoad(aEvent: Event) {
    const msgs = FromJSON((aEvent.target as FileReader).result);
    this.ParseMessages(msgs);
  }
}
