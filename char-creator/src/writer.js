import { getContext } from '../../../../st-context.js';
import { getTemplate } from './templates.js';

/**
 * 将预览区字段值回填到模板，返回填好的卡片对象 + 安全文件名。
 * @param {{ key: string, fieldValues: Object<string, string> }} param0
 * @returns {{ card: object, safeName: string }}
 */
export function buildCard({ key, fieldValues }) {
    const tpl = getTemplate(key);
    const card = structuredClone(tpl);

    // 回填 data.*（整字段替换，保留固定结构如 character_book/extensions/spec）
    card.data.name = fieldValues.name ?? card.data.name;
    card.data.description = fieldValues.description ?? card.data.description;
    card.data.first_mes = fieldValues.first_mes ?? card.data.first_mes;
    if (key === 'big-world' && fieldValues.creator_notes != null) {
        card.data.creator_notes = fieldValues.creator_notes;
    }
    if (fieldValues.mes_example != null) {
        card.data.mes_example = fieldValues.mes_example;
    }

    // 同步 root 镜像保持卡片自洽（root 是 V2 兼容层，导入后 ST 以 data 为准，但自洽更稳妥）
    card.name = card.data.name;
    card.description = card.data.description;
    card.first_mes = card.data.first_mes;
    if ('creatorcomment' in card && key === 'big-world') {
        card.creatorcomment = card.data.creator_notes ?? '';
    }

    const safeName = String(card.data.name).replace(/[\\/:*?"<>|]/g, '_').slice(0, 64) || 'character';
    return { card, safeName };
}

/**
 * 导入新角色卡：POST /api/characters/import → loadSingleCharacter 刷新 → selectCharacterById 选中。
 * @param {{ key: string, fieldValues: Object<string, string> }} param0
 * @returns {Promise<void>}
 */
export async function importCard({ key, fieldValues }) {
    const ctx = getContext();
    const { card, safeName } = buildCard({ key, fieldValues });

    const file = new File([JSON.stringify(card, null, 2)], `${safeName}.json`, { type: 'application/json' });
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('file_type', 'json');
    formData.append('user_name', ctx.name1);

    const resp = await fetch('/api/characters/import', {
        method: 'POST',
        body: formData,
        headers: ctx.getRequestHeaders({ omitContentType: true }),
        cache: 'no-cache',
    });
    if (!resp.ok) throw new Error(`导入失败：${resp.statusText}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);

    const avatarName = `${data.file_name}.png`;
    await ctx.loadSingleCharacter(avatarName);
    const chid = ctx.characters.findIndex(c => c?.avatar === avatarName);
    if (chid !== -1) {
        await ctx.selectCharacterById(chid);
    }
    if (typeof toastr !== 'undefined') {
        toastr.success(`角色卡已导入：${card.data.name}`);
    }
}

/**
 * 下载角色卡 JSON 文件到本地（Blob + <a download>）。
 * @param {{ key: string, fieldValues: Object<string, string> }} param0
 */
export function downloadCard({ key, fieldValues }) {
    const { card, safeName } = buildCard({ key, fieldValues });
    const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (typeof toastr !== 'undefined') {
        toastr.success(`角色卡已下载：${card.data.name}`);
    }
}
