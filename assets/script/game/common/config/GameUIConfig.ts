/*
 * 界面配置（对齐 oops-plugin-framework 2.x）
 */

import { LayerType } from "../../../../../extensions/oops-plugin-framework/assets/core/gui/layer/LayerEnum";
import { UIConfig } from "../../../../../extensions/oops-plugin-framework/assets/core/gui/layer/UIConfig";

/** 界面唯一标识 */
export enum UIID {
    /** 资源加载界面 */
    Loading = 1,
    /** 弹窗界面 */
    Window,
    /** 加载与延时提示界面 */
    Netinstable,
    /** 主界面占位 */
    Hall,
    /** 旧战斗占位，保留资源兼容 */
    Battle,
    Equipment,
    Workshop,
    ArkBuild,
    Research,
    Crew,
    Intel,
    BattleHUD,
    NightDefense,
    PauseOverlay,
    ConfirmDialog,
}

/** 打开界面方式的配置数据 */
export var UIConfigData: { [key: number]: UIConfig } = {
    [UIID.Loading]: { layer: LayerType.UI, prefab: "gui/loading/loading", bundle: "bundle" },
    [UIID.Netinstable]: { layer: LayerType.PopUp, prefab: "common/prefab/netinstable", bundle: "bundle" },
    [UIID.Window]: { layer: LayerType.Dialog, prefab: "common/prefab/window", bundle: "bundle" },
    [UIID.Hall]: { layer: LayerType.UI, prefab: "gui/hall/hall", bundle: "bundle", destroy: false },
    [UIID.Battle]: { layer: LayerType.UI, prefab: "gui/battle/battle", bundle: "bundle" },
    [UIID.Equipment]: { layer: LayerType.UI, prefab: "gui/equipment/equipment", bundle: "bundle", destroy: false },
    [UIID.Workshop]: { layer: LayerType.UI, prefab: "gui/workshop/workshop", bundle: "bundle", destroy: false },
    [UIID.ArkBuild]: { layer: LayerType.UI, prefab: "gui/ark-build/ark-build", bundle: "bundle", destroy: false },
    [UIID.Research]: { layer: LayerType.UI, prefab: "gui/research/research", bundle: "bundle", destroy: false },
    [UIID.Crew]: { layer: LayerType.UI, prefab: "gui/crew/crew", bundle: "bundle", destroy: false },
    [UIID.Intel]: { layer: LayerType.UI, prefab: "gui/intel/intel", bundle: "bundle", destroy: false },
    [UIID.BattleHUD]: { layer: LayerType.UI, prefab: "gui/battle-hud/battle-hud", bundle: "bundle", destroy: true },
    [UIID.NightDefense]: { layer: LayerType.UI, prefab: "gui/night-defense/night-defense", bundle: "bundle", destroy: true },
    [UIID.PauseOverlay]: { layer: LayerType.PopUp, prefab: "gui/pause/pause", bundle: "bundle", destroy: true },
    [UIID.ConfirmDialog]: { layer: LayerType.Dialog, prefab: "gui/confirm/confirm", bundle: "bundle", destroy: true },
}
