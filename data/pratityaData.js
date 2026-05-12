// ════════════════════════════════════════
// DATA: 佛教十二因缘 (Pratityasamutpada)
// ════════════════════════════════════════

const pratityaData = {
    avidya: { name: "无明", meaning: "无知、不明真理，对实相的误解", manifestation: "不了解因果、不知无常、执着于自我", inDecision: "因信息不全、认知偏差、情绪蒙蔽而做出错误判断", breakPoint: "获取真实信息、提升认知、觉察情绪", color: "node-avidya" },
    samskara: { name: "行", meaning: "因无明而产生的意志冲动、行为倾向", manifestation: "习惯性反应、冲动决策、业力惯性", inDecision: "被过往经验、惯性思维驱动的自动反应", breakPoint: "暂停、觉察冲动、打破自动化反应", color: "node-samskara" },
    vijnana: { name: "识", meaning: "认知、意识，对事物的识别与判断", manifestation: "贴标签、分类、形成初步认知框架", inDecision: "如何理解当前情境，赋予什么意义", breakPoint: "质疑初始认知、寻找多元视角", color: "node-vijnana" },
    namarupa: { name: "名色", meaning: "身心聚合，精神与物质的结合", manifestation: "自我身份认同、身体感受、心理状态", inDecision: "我的身份、角色、身体状态如何影响选择", breakPoint: "超越身份限制、觉察身心状态", color: "node-namarupa" },
    sadayatana: { name: "六入", meaning: "六根（眼耳鼻舌身意）接触外境的门户", manifestation: "感官开放、信息输入渠道", inDecision: "通过什么渠道获取信息，感官是否被操控", breakPoint: "关闭某些感官输入、选择信息源", color: "node-sadayatana" },
    sparsha: { name: "触", meaning: "根、境、识三者和合而产生的接触", manifestation: "与世界的第一次接触、触发点", inDecision: "什么触发了这个决策需求", breakPoint: "觉察触发点、选择是否回应", color: "node-sparsha" },
    vedana: { name: "受", meaning: "接触后产生的感受：苦、乐、不苦不乐", manifestation: "情绪反应、身体感受、心理舒适/不适", inDecision: "这个选择让我感觉如何，追求快乐回避痛苦", breakPoint: "不随感受起舞、平等看待苦乐", color: "node-vedana" },
    trishna: { name: "爱", meaning: "对乐受的贪爱、对苦受的嗔厌", manifestation: "渴望、执着、欲望、排斥", inDecision: "我真正渴望什么，恐惧什么", breakPoint: "区分需要与欲望、觉察贪婪", color: "node-trishna" },
    upadana: { name: "取", meaning: "对爱的强化执取，形成固定模式", manifestation: "占有欲、控制欲、僵化信念", inDecision: "我在执着什么，不愿放手的是什么", breakPoint: "练习放下、松动执着", color: "node-upadana" },
    bhava: { name: "有", meaning: "因执取而形成的存在状态、业力积聚", manifestation: "习惯模式、生活状态、存在方式", inDecision: "这个选择将我带向什么样的存在状态", breakPoint: "改变日常模式、创造新习惯", color: "node-bhava" },
    jati: { name: "生", meaning: "新的存在状态的产生", manifestation: "新身份、新角色、新开始", inDecision: "决策后将诞生的新自我", breakPoint: "觉察出生即苦、不执着于新身份", color: "node-jati" },
    jaramarana: { name: "老死", meaning: "衰变、消逝、终结", manifestation: "失去、结束、衰败、死亡焦虑", inDecision: "这个选择最终会导致什么终结", breakPoint: "接纳无常、向死而生", color: "node-jaramarana" }
};

const pratityaPatterns = {
    avidya: ["不知道", "不明白", "不懂", "误解", "错误认知", "盲目", "无知", "迷茫", "困惑", "不清楚", "无明"],
    samskara: ["冲动", "习惯", "惯性", "自动", "下意识", "本能", "反应", "倾向", "行"],
    vijnana: ["认为", "觉得", "看法", "认知", "理解", "判断", "识别", "标签", "定义", "识"],
    vedana: ["感觉", "感受", "情绪", "舒服", "不舒服", "快乐", "痛苦", "焦虑", "愉悦", "受"],
    trishna: ["想要", "渴望", "追求", "欲望", "喜欢", "讨厌", "贪", "怕", "恐惧", "希望", "爱"],
    upadana: ["执着", "坚持", "不放", "控制", "占有", "固守", "僵化", "模式", "习惯", "取"]
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { pratityaData, pratityaPatterns };
}
