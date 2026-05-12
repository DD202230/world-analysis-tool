// ════════════════════════════════════════
// DATA: 马克思主义实践论 (Praxis)
// ════════════════════════════════════════
// 核心框架：认识→实践→再认识→再实践的螺旋上升
// 五阶段：感性认识 → 理性认识 → 实践检验 → 修正认识 → 新的实践

const praxisData = {
    perceptual: {
        key: "perceptual",
        name: "感性认识",
        stage: 1,
        meaning: "通过感官直接接触事物获得的表面认识，是对现象的外部联系的认识",
        manifestation: "直观感受、第一印象、经验积累、现象观察、情绪反应",
        inDecision: "基于表面现象和直觉做出的快速判断，容易被表象迷惑",
        breakPoint: "深入调查研究，透过现象看本质；从感性上升到理性",
        dialectic: "量变积累阶段——大量感性材料的收集是飞跃到理性的前提",
        color: "node-perceptual"
    },
    rational: {
        key: "rational",
        name: "理性认识",
        stage: 2,
        meaning: "通过思维加工感性材料，达到对事物本质和规律的认识",
        manifestation: "概念形成、逻辑推理、规律总结、理论建构、系统思维",
        inDecision: "基于分析和推理做出判断，但可能脱离实际，成为教条",
        breakPoint: "将理论回到实践中检验；避免本本主义和教条主义",
        dialectic: "质变飞跃阶段——从感性到理性是认识过程的第一次飞跃",
        color: "node-rational"
    },
    practice: {
        key: "practice",
        name: "实践检验",
        stage: 3,
        meaning: "将认识付诸实践，通过行动验证理论的正确性",
        manifestation: "行动验证、实验测试、试点探索、执行落实、效果评估",
        inDecision: "在实践中检验决策，根据反馈调整方向",
        breakPoint: "勇于实践、不怕失败；从实践中学习而非纸上谈兵",
        dialectic: "否定之否定——实践可能证伪认识，推动认识向前发展",
        color: "node-practice"
    },
    reflection: {
        key: "reflection",
        name: "反思修正",
        stage: 4,
        meaning: "根据实践结果反思原有认识，修正错误、深化理解",
        manifestation: "复盘总结、错误分析、归因反思、经验萃取、认知更新",
        inDecision: "承认错误、调整策略；不因沉没成本而固执己见",
        breakPoint: "实事求是、敢于自我批评；将失败转化为养分",
        dialectic: "螺旋上升——每一次修正都是向更高层次的回归",
        color: "node-reflection"
    },
    new_practice: {
        key: "new_practice",
        name: "新的实践",
        stage: 5,
        meaning: "在修正认识的基础上展开新的、更高层次的实践",
        manifestation: "迭代升级、持续改进、创新突破、规模化推广、范式转移",
        inDecision: "将升级后的认识再次投入实践，开启新一轮循环",
        breakPoint: "保持开放心态；认识到实践-认识的循环永无止境",
        dialectic: "波浪式前进——发展是前进性与曲折性的统一",
        color: "node-new-practice"
    }
};

const praxisPatterns = {
    perceptual: ["感觉", "觉得", "看起来", "好像", "似乎", "直观", "印象", "经验", "感受", "观察到", "发现", "注意到"],
    rational: ["分析", "推理", "理论", "逻辑", "总结", "归纳", "概念", "规律", "系统", "框架", "模型", "认为", "判断"],
    practice: ["做", "行动", "实践", "执行", "落实", "尝试", "试验", "验证", "实施", "推进", "落地", "干"],
    reflection: ["反思", "复盘", "总结", "检讨", "修正", "调整", "改进", "吸取教训", "归因", "反省", "审视"],
    new_practice: ["迭代", "升级", "改进", "优化", "新一轮", "再次", "持续", "不断", "深化", "提升", "进阶"]
};

// 实践论阶段流转映射（用于分析结果展示）
const praxisFlow = [
    { from: "perceptual", to: "rational", arrow: "上升", desc: "从现象到本质" },
    { from: "rational", to: "practice", arrow: "飞跃", desc: "从理论到行动" },
    { from: "practice", to: "reflection", arrow: "反馈", desc: "从行动到反思" },
    { from: "reflection", to: "new_practice", arrow: "升华", desc: "从反思到新行动" },
    { from: "new_practice", to: "perceptual", arrow: "循环", desc: "开启新认识周期" }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { praxisData, praxisPatterns, praxisFlow };
}
