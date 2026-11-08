import { sys } from "cc";

import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { GameEvent } from "../common/config/GameEvent";
import { WorkshopRuntime, WorkshopRuntimeEvent } from "./WorkshopRuntime.ts";
import { LocalStorageWorkshopRepository } from "./workshop/WorkshopRepository.ts";
import { WorkshopService } from "./workshop/WorkshopService.ts";

const EVENT_MAP: Readonly<Record<WorkshopRuntimeEvent, GameEvent>> = {
    InventoryChanged: GameEvent.InventoryChanged,
    WorkshopQueueChanged: GameEvent.WorkshopQueueChanged,
    CraftCompleted: GameEvent.CraftCompleted,
};

let taskSequence = 0;

const service = new WorkshopService({
    repository: new LocalStorageWorkshopRepository(sys.localStorage),
    idFactory: () => `craft-${Date.now()}-${++taskSequence}`,
});

export const workshopRuntime = new WorkshopRuntime(
    service,
    () => Date.now(),
    (event, payload) => oops.message.dispatchEvent(EVENT_MAP[event], payload),
);
