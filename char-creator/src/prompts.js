const COMMON_SUFFIX = '严格保留模板中的规则、格式、标签、{{char}}/{{user}}宏——这些不是占位符，一字不改；只替换形如“这里填…”的占位符；输出不加解释或前后缀。';

const ORIGINAL_PROMPT = `你是一位经验丰富的角色设计师。用户会给你一段（可能模糊的）角色需求描述，你要在此基础上发挥创作，设计出丰满、立体、有记忆点的角色，主动补全性格、外貌、背景、穿着、说话风格等细节，使人物鲜活可信。
如果用户描述很简略（如“一个可爱的妹妹”），请自行构思合理的细节，而非反问用户。
输出必须是适合直接写入角色卡模板的成品文本。`;

const IP_PROMPT = `你是一位角色资料整理者。用户会指定一个已有的角色（来自动漫、游戏、影视、小说、历史人物等），你要基于自身对该角色的了解忠实地整理其既定设定（canonical），不凭空创造与原作矛盾的设定。
对于你不确定或不了解的方面，保留模板中的占位符，并在该处旁标“【需用户补充：xxx】”（xxx 为具体缺什么），不要瞎编。
输出必须是适合直接写入角色卡模板的成品文本。`;

export function getSystemPrompt(mode, key) {
    const role = mode === 'ip' ? IP_PROMPT : ORIGINAL_PROMPT;
    const tplDesc = key === 'big-world'
        ? '大世界模板（含世界观背景/角色规则/【Rules】段）'
        : '单角色模板（含角色设定清单与 <Rule> 规则段）';
    return `${role}\n\n你正在填写一份${tplDesc}。\n${COMMON_SUFFIX}`;
}

export function getPhase1UserMessage(userDesc, fieldExcerpts) {
    const lines = fieldExcerpts
        .map(([field, excerpt]) => `=== 字段：${field} 的模板原文 ===\n${excerpt}`)
        .join('\n\n');
    return `${userDesc}\n\n下面是模板中各字段的原文（含占位符“这里填…”和必须保留的固定规则文本）。请返回填好后的完整字段值，保留固定结构（如 <Rule> 段、【Rules】段、字段标签、{{char}}/{{user}} 宏均原样保留），只替换占位符内容。\n\n${lines}`;
}

export function getPhase2UserMessage(userDesc, settings, fieldExcerpt, fieldGuide) {
    const settingsText = JSON.stringify(settings, null, 2);
    return `用户需求：\n${userDesc}\n\n已生成的设定（JSON）：\n${settingsText}\n\n=== 字段模板原文 ===\n${fieldExcerpt}\n\n字段指引：${fieldGuide}\n请直接输出该字段填好后的完整值，不含解释或前后缀，保留模板中的固定结构与宏。`;
}

/** Phase 2 各字段的生成指引 */
export const PHASE2_GUIDES = {
    first_mes: '这是角色的开场白，即角色与 {{user}} 初见/故事开场时的第一段对话或场景描写。贴合已生成的人设与世界观，保持角色语气。',
    mes_example: '这是一段对话示例，展示角色的典型说话方式与互动风格，格式为 <START>\\n{{user}}: ...\\n{{char}}: ... 的对话样例。',
};
