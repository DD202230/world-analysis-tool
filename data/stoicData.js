// ════════════════════════════════════════
// 斯多葛学派 — 行动指导数据
// 用于：指导行动（怎么做）
// ════════════════════════════════════════

const stoicData = {
    dichotomy: {
        name: "控制二分法",
        order: 1,
        color: "emerald",
        meaning: "区分什么是我们能控制的，什么是不能控制的，只在前者上投入精力",
        manifestation: "焦虑往往来自试图控制不可控之物，沮丧来自忽视可控之物",
        inDecision: "列出可控/不可控清单，决策只基于可控项",
        breakPoint: "问自己：『这件事中，什么完全取决于我？』",
        practice: "每日三省：今日为何事焦虑？它在我控制之内吗？我能做什么？"
    },
    amor_fati: {
        name: "爱命运",
        order: 2,
        color: "teal",
        meaning: "不是被动接受，而是主动拥抱发生的一切，将其转化为养分",
        manifestation: "『这件事为什么会发生在我身上？』→『这件事要教给我什么？』",
        inDecision: "假设这个情境是特意为你设计的训练，你会如何回应？",
        breakPoint: "寻找这个『坏事』中隐藏的『好事』种子",
        practice: "早晨预想今日可能的不顺，提前在心理上接纳它们"
    },
    memento_mori: {
        name: "勿忘你终有一死",
        order: 3,
        color: "green",
        meaning: "以终为始，用死亡视角过滤琐碎，聚焦于真正重要之事",
        manifestation: "『如果这是我生命的最后一天，我还会为这件事纠结吗？』",
        inDecision: "重大决策时，想象自己在临终床上回顾这个选择",
        breakPoint: "将时间尺度拉长到十年、一生，当下的纠结自然缩小",
        practice: "每晚睡前问自己：今日是否活出了我想成为的样子？"
    },
    premeditatio: {
        name: "预想逆境",
        order: 4,
        color: "lime",
        meaning: "在逆境到来前已在心中演练，当真实发生时不再措手不及",
        manifestation: "不是悲观，而是有准备的乐观——『最坏情况我能承受』",
        inDecision: "做计划时同时做『最坏情况预案』",
        breakPoint: "问自己：『如果这件事彻底失败，我的底线是什么？』",
        practice: "每周一次『预演』：想象下周最大的挑战，并写下应对"
    },
    apatheia: {
        name: "不动心",
        order: 5,
        color: "spring",
        meaning: "不被激情（pathos）裹挟，保持清晰判断与稳定行动",
        manifestation: "愤怒、恐惧、狂喜都会扭曲判断，斯多葛追求的不是麻木而是清明",
        inDecision: "情绪激动时暂停，等『情绪波浪』过去再做决定",
        breakPoint: "识别情绪背后的判断：『我感到愤怒，是因为我认为...』",
        practice: "情绪升起时，用第三人称描述自己的状态：『他现在感到...』"
    },
    oikeiosis: {
        name: "自我扩展",
        order: 6,
        color: "forest",
        meaning: "从自我关怀扩展到家庭、社群、人类、宇宙，找到更大归属",
        manifestation: "个人痛苦在更大尺度上变得可承受，行动获得更深意义",
        inDecision: "这个选择对我在乎的人/社群/世界有什么影响？",
        breakPoint: "将自己的困境放在人类共同经验中看，减少孤独感",
        practice: "每日一次『宇宙视角』冥想：想象从星空看地球，看自己的位置"
    }
};

const stoicPatterns = {
    dichotomy: ["控制", "可控", "不可控", "焦虑", "担心", "害怕", "无力", "无奈", "听天由命", "尽人事", "随缘"],
    amor_fati: ["接受", "接纳", "命运", "发生", "已然", "过去", "无法改变", "既然", "算了", "放下", "释怀"],
    memento_mori: ["意义", "重要", "价值", "时间", "有限", "生命", "人生", "后悔", "遗憾", "临终", "死亡"],
    premeditatio: ["准备", "预案", "最坏", "风险", "万一", "如果", "假设", "plan b", "备案", "退路", "底线"],
    apatheia: ["情绪", "愤怒", "冲动", "冷静", "理性", "平静", "稳定", "波动", "激动", "上头", "失控"],
    oikeiosis: ["关系", "他人", "社会", "世界", "人类", "责任", "意义", "归属", "连接", "共同体", "大局"]
};

const stoicMatrix = {
    personal: { primary: "dichotomy", secondary: "memento_mori", desc: "个人成长的核心是区分可控与不可控，同时以死亡视角锚定真正重要之事" },
    relationship: { primary: "oikeiosis", secondary: "apatheia", desc: "关系中的痛苦常来自情绪裹挟和边界模糊，需扩展自我同时保持清明" },
    business: { primary: "premeditatio", secondary: "dichotomy", desc: "商业决策需预想风险并区分可控因素，在不确定性中保持行动力" },
    social: { primary: "oikeiosis", secondary: "amor_fati", desc: "社会现象需从共同体视角理解，接纳结构性限制同时寻找行动空间" },
    creative: { primary: "amor_fati", secondary: "apatheia", desc: "创作瓶颈需接纳当下状态，不被自我怀疑吞噬，在限制中寻找形式" },
    political: { primary: "dichotomy", secondary: "oikeiosis", desc: "政治博弈需清醒区分可控边界，同时保持对人类共同体的关怀" }
};
