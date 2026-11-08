import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { RESEARCH_DEFINITIONS } from "./model/ResearchCatalog.ts";
import { ResearchRuntime } from "./model/ResearchRuntime.ts";
import type { ResearchSaveV1, ResearchStorage } from "./model/ResearchTypes.ts";

const RESEARCH_STORAGE_KEY = "research.progression.v1";

class OopsResearchStorage implements ResearchStorage {
    load(): unknown {
        try {
            return oops.storage.getJson(RESEARCH_STORAGE_KEY, undefined);
        } catch (error) {
            console.warn("研究存档读取失败，将使用新档", error);
            return undefined;
        }
    }

    save(state: ResearchSaveV1): void {
        try {
            oops.storage.set(RESEARCH_STORAGE_KEY, state);
        } catch (error) {
            console.warn("研究进度保存失败", error);
        }
    }
}

export const researchRuntime = new ResearchRuntime(RESEARCH_DEFINITIONS, new OopsResearchStorage());
