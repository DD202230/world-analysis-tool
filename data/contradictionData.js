// ════════════════════════════════════════
// DATA: 马克思主义矛盾论 (Contradiction)
// ════════════════════════════════════════
// 核心框架：对立统一、主次矛盾、矛盾主次方面、矛盾转化
// 四维度：矛盾普遍性 → 矛盾特殊性 → 主次矛盾 → 矛盾转化

const contradictionData = {
    universality: {
        key: "universality",
        name: "矛盾普遍性",
        stage: 1,
        meaning: "矛盾存在于一切事物的发展过程中，每一事物的发展过程中存在着自始至终的矛盾运动",
        manifestation: "无处不在的冲突、对立面的共存、问题的必然性、张力与摩擦、竞争与博弈",
        inDecision: "认识到任何选择都伴随矛盾；不存在没有问题的完美方案",
        breakPoint: "正视矛盾而非回避；将矛盾视为发展的动力而非障碍",
        dialectic: "矛盾的普遍性——承认世界是充满矛盾的，这是客观现实",
        questions: [
            "我在回避哪些显而易见的矛盾？",
            "如果矛盾是常态，我的应对策略是什么？"
        ],
        color: "node-universality"
    },
    particularity: {
        key: "particularity",
        name: "矛盾特殊性",
        stage: 2,
        meaning: "不同事物的矛盾各有特点，同一事物在不同发展阶段的矛盾也各不相同",
        manifestation: "具体情境分析、差异化策略、因地制宜、因时制宜、个案处理",
        inDecision: "避免一刀切；分析当前情境的独特性，找到针对性的解法",
        breakPoint: "深入具体情境；拒绝教条主义和经验主义的照搬",
        dialectic: "具体问题具体分析——马克思主义活的灵魂",
        questions: [
            "这个情境有什么独特之处，不能套用通用解法？",
            "如果换一个人/时间/地点，矛盾会不同吗？"
        ],
        color: "node-particularity"
    },
    principal: {
        key: "principal",
        name: "主次矛盾",
        stage: 3,
        meaning: "复杂事物中存在主要矛盾和次要矛盾，主要矛盾决定事物的发展方向",
        manifestation: "核心问题识别、优先级排序、资源集中、关键路径、瓶颈突破",
        inDecision: "识别当前最关键的问题；避免在次要矛盾上消耗过多资源",
        breakPoint: "抓主要矛盾、抓矛盾的主要方面；学会取舍和聚焦",
        dialectic: "两点论与重点论的统一——既看到全面，又抓住关键",
        questions: [
            "如果只能解决一个问题，应该是哪个？",
            "我现在消耗最多精力的，是真正重要的吗？"
        ],
        color: "node-principal"
    },
    transformation: {
        key: "transformation",
        name: "矛盾转化",
        stage: 4,
        meaning: "矛盾双方在一定条件下可以相互转化；主次矛盾也会随条件变化而转化",
        manifestation: "危机转机、劣势优势、被动主动、问题机遇、逆境成长",
        inDecision: "创造条件促使矛盾向有利方向转化；预判矛盾转化的临界点",
        breakPoint: "把握转化的条件；在量变积累到临界点时主动推动质变",
        dialectic: "矛盾转化——坏事可以变好事，失败可以变教训，敌人可以变朋友",
        questions: [
            "这个『坏事』在什么条件下会变成『好事』？",
            "我需要创造什么条件来推动矛盾转化？"
        ],
        color: "node-transformation"
    }
};

const contradictionPatterns = {
    universality: ["矛盾", "冲突", "对立", "问题", "张力", "摩擦", "竞争", "博弈", "斗争", "分歧", "争议", "对抗"],
    particularity: ["具体情况", "特殊", "独特", "不同", "差异", "个案", "因地制宜", "因时制宜", "针对性", "特定"],
    principal: ["主要", "关键", "核心", "重点", "优先", "瓶颈", "根本", "主导", "决定", "最重要", "首要"],
    transformation: ["转化", "转变", "变化", "转机", "逆境", "危机", "机会", "翻转", "逆转", "蜕变", "升级"]
};

// 矛盾论分析工具：主次矛盾矩阵
const contradictionMatrix = {
    // 6大标准场景
    personal: {
        primary: "principal",
        secondary: "transformation",
        desc: "个人成长：主要矛盾是目标-能力匹配，次要矛盾是转型时机"
    },
    relationship: {
        primary: "particularity",
        secondary: "universality",
        desc: "关系场景：主要矛盾是沟通模式，次要矛盾是价值观差异"
    },
    business: {
        primary: "principal",
        secondary: "particularity",
        desc: "商业场景：主要矛盾是产品-市场匹配，次要矛盾是团队能力"
    },
    social: {
        primary: "universality",
        secondary: "particularity",
        desc: "社会场景：主要矛盾是利益分配，次要矛盾是文化认同"
    },
    creative: {
        primary: "particularity",
        secondary: "principal",
        desc: "创作场景：主要矛盾是表达-受众匹配，次要矛盾是技法突破"
    },
    political: {
        primary: "principal",
        secondary: "transformation",
        desc: "权力场景：主要矛盾是合法性-效率，次要矛盾是变革节奏"
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { contradictionData, contradictionPatterns, contradictionMatrix };
}
