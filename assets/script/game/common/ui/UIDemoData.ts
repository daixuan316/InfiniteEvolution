import { UIID } from "../config/GameUIConfig";

export interface HallViewModel {
    chapter: string;
    day: number;
    phase: string;
    resources: ReadonlyArray<{ id: string; label: string; value: number }>;
    ark: { core: number; coreMax: number; power: number; powerMax: number; modules: number; modulesMax: number };
    threat: { level: string; enemy: string; countdown: string };
}

export interface FeatureViewModel {
    title: string;
    summary: string;
    icon: string;
    metrics: ReadonlyArray<{ label: string; value: string; tone?: "normal" | "warning" | "danger" }>;
    nextAction: string;
}

export const HALL_DEMO_VIEW_MODEL: HallViewModel = {
    chapter: "灰港废城",
    day: 3,
    phase: "黄昏整备",
    resources: [
        { id: "scrap", label: "废料", value: 368 },
        { id: "alloy", label: "合金", value: 712 },
        { id: "energy", label: "能源", value: 180 },
    ],
    ark: { core: 920, coreMax: 1000, power: 88, powerMax: 100, modules: 5, modulesMax: 7 },
    threat: { level: "中等", enemy: "奔袭者 / 巨力怪", countdown: "03:42" },
};

export const FEATURE_DEMO_VIEW_MODELS: Readonly<Partial<Record<UIID, FeatureViewModel>>> = {
    [UIID.Equipment]: {
        title: "装备与仓库",
        summary: "比较武器身份、进化方向与标签共鸣，管理本次探索携带方案。",
        icon: "system-nav/06-storage",
        metrics: [{ label: "仓库占用", value: "42 / 80" }, { label: "当前战力", value: "1,280" }, { label: "可进化装备", value: "2", tone: "warning" }],
        nextAction: "首阶段已打通页面入口，装备规则将在后续接入。",
    },
    [UIID.Workshop]: {
        title: "工坊制造",
        summary: "制造、强化、改装和拆解共享同一套材料与队列反馈。",
        icon: "system-nav/03-workshop",
        metrics: [{ label: "制造队列", value: "1 / 3" }, { label: "可制作配方", value: "6" }, { label: "缺少材料", value: "电子元件", tone: "warning" }],
        nextAction: "选择配方后将显示材料缺口与产出预览。",
    },
    [UIID.ArkBuild]: {
        title: "方舟建设",
        summary: "安装模块、检查供电与相邻加成，并预览次夜防线变化。",
        icon: "system-nav/02-layout",
        metrics: [{ label: "模块槽位", value: "5 / 7" }, { label: "能源负载", value: "88%", tone: "warning" }, { label: "核心耐久", value: "92%" }],
        nextAction: "正式建设页将提供拖放、射界和非法放置说明。",
    },
    [UIID.Research]: {
        title: "研究与进化",
        summary: "机械、生存与生化三条路线共同塑造角色和方舟流派。",
        icon: "system-nav/04-research",
        metrics: [{ label: "研究点", value: "4" }, { label: "可解锁节点", value: "3" }, { label: "生化负荷", value: "32", tone: "danger" }],
        nextAction: "后续接入节点前置、收益与副作用确认。",
    },
    [UIID.Crew]: {
        title: "成员与岗位",
        summary: "查看健康、士气、疲劳和个人任务，并为方舟模块分配岗位。",
        icon: "system-nav/05-crew",
        metrics: [{ label: "幸存者", value: "6" }, { label: "空闲岗位", value: "2" }, { label: "低士气成员", value: "1", tone: "warning" }],
        nextAction: "岗位分配将通过独立成员 ViewModel 接入。",
    },
    [UIID.Intel]: {
        title: "地图与情报",
        summary: "评估地点风险、奖励倾向、撤离距离与次夜尸潮趋势。",
        icon: "system-nav/01-map",
        metrics: [{ label: "已知地点", value: "5" }, { label: "高危事件", value: "1", tone: "danger" }, { label: "可用白昼", value: "06:30" }],
        nextAction: "从这里选择探索目标后再确认出发。",
    },
};
