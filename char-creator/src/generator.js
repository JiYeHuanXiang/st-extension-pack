import { generatePhase1, generatePhase2Field, resetCancel, isCancelled } from './ai.js';
import { getPhase1Fields, getPhase2Fields } from './templates.js';

/**
 * 混合调度：Phase 1 一次 JSON 调用生成设定类字段；Phase 2 串行生成长字段。
 * @param {{ key: string, mode: string, userDesc: string, mesExample: boolean,
 *           onField?: (field: string, value: string) => void,
 *           onProgress?: (msg: string) => void,
 *           getSettings?: () => object }} opts
 * @returns {Promise<object>} 返回 Phase 1 的 settings（供单字段重生复用）
 */
export async function runGeneration({ key, mode, userDesc, mesExample, onField, onProgress }) {
    resetCancel();

    // Phase 1 — 设定类字段（一次 JSON 调用）
    onProgress?.('正在生成设定…');
    const settings = await generatePhase1({ mode, key, userDesc });
    for (const f of getPhase1Fields(key)) {
        onField?.(f, String(settings[f] ?? ''));
    }

    // Phase 2 — 长字段（串行，前序结果经由 settings 作上下文）
    const phase2 = getPhase2Fields(key, { mesExample });
    for (const f of phase2) {
        if (isCancelled()) {
            onProgress?.('已取消');
            return settings;
        }
        onProgress?.(`正在生成 ${f}…`);
        try {
            const value = await generatePhase2Field({ mode, key, userDesc, settings, fieldName: f });
            settings[f] = value; // 让后续字段可引用
            onField?.(f, value);
        } catch (err) {
            console.error(`[char-creator] 字段 ${f} 生成失败`, err);
            onField?.(f, `【生成失败：${err.message}】`);
        }
    }
    onProgress?.('生成完成');
    return settings;
}
