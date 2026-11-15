import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import type { KeyValueStore } from "./SaveRepository.ts";

export class OopsStorageAdapter implements KeyValueStore {
    get(key: string): string | null {
        const value = oops.storage.get(key);
        return value == null ? null : String(value);
    }

    set(key: string, value: string): void {
        oops.storage.set(key, value);
    }

    remove(key: string): void {
        oops.storage.remove(key);
    }
}
