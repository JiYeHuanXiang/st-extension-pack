import { SINGLE_ROLE } from '../templates/single-role.js';
import { BIG_WORLD } from '../templates/big-world.js';

export { SINGLE_ROLE, BIG_WORLD };

export const TEMPLATE_KEYS = ['single', 'big-world'];

export function getTemplate(key) {
    return key === 'big-world' ? BIG_WORLD : SINGLE_ROLE;
}

export function getDisplayName(key) {
    return key === 'big-world' ? '大世界模板' : '单角色模板';
}

/** Phase 1 需 AI 填的设定类字段（一次 JSON 调用保证一致性） */
export function getPhase1Fields(key) {
    return key === 'big-world'
        ? ['name', 'description', 'creator_notes']
        : ['name', 'description'];
}

/** Phase 2 需单独生成的长字段 */
export function getPhase2Fields(key, { mesExample = false } = {}) {
    const fields = ['first_mes'];
    if (mesExample) fields.push('mes_example');
    return fields;
}

/** 返回模板中某字段的原文（含占位符 + 固定规则），贴给 AI 作为“要填的模板原文” */
export function getFieldExcerpt(key, field) {
    const tpl = getTemplate(key);
    return String(tpl.data?.[field] ?? '');
}

/** 字段显示名 */
export const FIELD_LABELS = {
    name: '名称',
    description: '描述',
    creator_notes: '作者备注',
    first_mes: '开场白',
    mes_example: '对话示例',
};
