import "dotenv/config";
import jwt from "jwt-simple";

import Scaledrone from "scaledrone-node";
import { loadDataFromTangoToCloud } from "./load-data-func";

type RemoteUpdateProgress = {
  value: number;
  message: string;
  finished: boolean;
  timestamp: number;
  error: boolean;
};

export function initialzeScaledroneListen() {
  const channel = process.env.SCALEDRONE_CHANNEL_ID;
  const secret = process.env.SCALEDRONE_SECRET;

  if (!channel) {
    console.error("No channel id provided");
    process.exit(1);
  }

  if (!secret) {
    console.error("No secret provided");
    process.exit(1);
  }

  const drone = new Scaledrone(channel);

  drone.on("open", (error: any) => {
    if (error) {
      console.log("Opening error", error);
      return;
    }

    const payload = {
      client: drone.clientId, // the client that wants to connect
      channel: channel, // channel_id the client want's to connect to
      permissions: {
        "^request_data_update$": {
          /* Regex exact match to general-chat */
          publish: true /* Allows publishing in general-chat */,
          subscribe: true,
        },
        "^update_progress$": {
          publish: true,
          subscribe: true,
        },
        "^data_updated$": {
          /* Regex exact match to general-chat */
          publish: true /* Allows publishing in general-chat */,
          subscribe: true,
        },
      },
      exp: Date.now() + 180000, // Client can use this token for 3 minutes (UTC0)
    };

    const token = jwt.encode(payload, secret, "HS256");

    drone.authenticate(token);
  });

  drone.on("authenticate", (error: any) => {
    if (error) {
      console.log("Authentication error", error);
      return;
    }

    console.log("Authenticated");

    onReady();
  });

  let dataIsUpdating = false;

  function onReady() {
    console.log("Listo para recibir comandos");

    const requestDataUpdateRoom = drone.subscribe("request_data_update");

    requestDataUpdateRoom.on("message", async (message: any) => {
      console.log("request_data_update:", message.data);

      if (dataIsUpdating || message.data == "null") {
        if (lastProgressSent) {
          console.log("Sending already starte progress update");
          sendProgressUpdate(lastProgressSent);
        } else {
          console.log("Sending null progress update");
        }
        return;
      }

      sendProgressUpdate({
        finished: false,
        message: "Iniciando actualización de datos",
        timestamp: Date.now(),
        value: 0,
        error: false,
      });

      dataIsUpdating = true;
      loadDataFromTangoToCloud({
        log: (...args: any[]) => {
          console.log("Update request progress:", ...args);

          sendProgressUpdate({
            finished: false,
            message: args.join(" "),
            timestamp: Date.now(),
            value: 50,
            error: false,
          });
        },
      })
        .then(() => {
          dataIsUpdating = false;
          sendProgressUpdate({
            finished: true,
            message: "Datos actualizados",
            timestamp: Date.now(),
            value: 100,
            error: false,
          });
        })
        .catch((error) => {
          console.error("Error updating data", error);

          setTimeout(() => {
            dataIsUpdating = false;

            sendProgressUpdate({
              finished: true,
              error: true,
              message: "Ocurrió un error al actualizar los datos",
              timestamp: Date.now(),
              value: 100,
            });
          }, 120);
        });
    });
  }

  let lastProgressSent: RemoteUpdateProgress | null = null;

  function sendProgressUpdate(progress: RemoteUpdateProgress) {
    lastProgressSent = progress;

    if (progress.finished) {
      lastProgressSent = null;
    }

    drone.publish({
      room: "update_progress",
      message: JSON.stringify(progress),
    });
  }
}
