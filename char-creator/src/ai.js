import { getContext } from '../../../../st-context.js';
import { getSystemPrompt, getPhase1UserMessage, getPhase2UserMessage, PHASE2_GUIDES } from './prompts.js';
import { getFieldExcerpt, getPhase1Fields } from './templates.js';

const PHASE1_TIMEOUT = 90000;  // 90 秒
const PHASE2_TIMEOUT = 60000;  // 60 秒

// 协作取消标志：cancelAll() 置位后，Phase 2 循环每轮开头检查，stopGeneration 中止当前请求。
let cancelled = false;
export function isCancelled() { return cancelled; }
export function resetCancel() { cancelled = false; }

export function cancelAll() {
    cancelled = true;
    try {
        getContext().stopGeneration();
    } catch (e) {
        console.warn('[char-creator] stopGeneration 失败', e);
    }
}

/**
 * 给 generateRaw 包一层超时 + 取消：超时或用户取消后调用 stopGeneration，并抛出明确错误。
 * 防止 generateRaw 在冷门角色/网络问题下挂起导致 UI 无响应。
 */
async function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            try { getContext().stopGeneration(); } catch (_) { /* 已经停了 */ }
            reject(new Error(`${label}超时（${Math.round(ms / 1000)}秒未响应），请检查 API 连接或缩短需求后重试`));
        }, ms);
    });
    // 取消信号：cancelled 置位后每 500ms 检查一次，立即解除 await
    const cancelProbe = new Promise((_, reject) => {
        const probe = setInterval(() => {
            if (cancelled) {
                clearInterval(probe);
                reject(new Error('已取消'));
            }
        }, 500);
        // 超时后清理 probe（兜底，防止 setInterval 泄漏）
        setTimeout(() => clearInterval(probe), ms + 1000);
    });
    try {
        return await Promise.race([promise, timeout, cancelProbe]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Phase 1：一次 JSON 调用生成设定类字段，返回 { name, description, creator_notes? }。
 * OpenAI 走原生结构化输出（jsonSchema）；非 Chat Completion 或失败时降级为纯文本 + 前端 JSON.parse 兜底。
 */
export async function generatePhase1({ mode, key, userDesc }) {
    if (cancelled) throw new Error('已取消');
    const ctx = getContext();
    const fields = getPhase1Fields(key);
    const excerpts = fields.map(f => [f, getFieldExcerpt(key, f)]);
    const settingSchema = {
        type: 'object',
        properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            ...(key === 'big-world' ? { creator_notes: { type: 'string' } } : {}),
        },
        required: ['name', 'description'],
    };
    const sys = getSystemPrompt(mode, key)
        + '\n\n你只能输出一个合法的 JSON 对象，键为字段名，值为填好后的完整字段值。不要输出任何 JSON 之外的内容。';
    const userMsg = getPhase1UserMessage(userDesc, excerpts);

    let raw;
    try {
        raw = await withTimeout(
            ctx.generateRaw({
                prompt: [
                    { role: 'system', content: sys },
                    { role: 'user', content: userMsg },
                ],
                jsonSchema: { name: 'character_setting', value: settingSchema, strict: true, returnInvalid: false },
                responseLength: 2000,
            }),
            PHASE1_TIMEOUT,
            '设定生成',
        );
    } catch (err) {
        if (err.message?.includes('超时')) throw err; // 超时错误直接向上传
        console.error('[char-creator] Phase1 结构化输出失败，降级为纯文本', err);
        raw = await withTimeout(
            ctx.generateRaw({
                prompt: [
                    { role: 'system', content: sys },
                    { role: 'user', content: userMsg + '\n\n【重要】只输出合法 JSON，不要加 markdown 代码块或解释。' },
                ],
                responseLength: 2000,
            }),
            PHASE1_TIMEOUT,
            '设定生成（降级）',
        );
    }

    if (!raw || typeof raw !== 'string' || !raw.trim()) {
        throw new Error('设定生成失败：AI 返回了空内容。请检查 API 连接或更换模型后重试。');
    }
    const parsed = parseJsonResult(raw);
    if (!parsed) {
        throw new Error('设定生成失败：AI 返回的不是合法 JSON，请重试或更换模型。');
    }
    return parsed;
}

/**
 * Phase 2：单个长字段，返回清洗（去 reasoning）后的纯文本。
 * 单字段失败抛错，由调用方标记红色 + 可重生，不阻塞其它字段。
 */
export async function generatePhase2Field({ mode, key, userDesc, settings, fieldName }) {
    if (cancelled) throw new Error('已取消');
    const ctx = getContext();
    const excerpt = getFieldExcerpt(key, fieldName);
    const guide = PHASE2_GUIDES[fieldName] || `请填写字段 ${fieldName}。`;
    const text = await withTimeout(
        ctx.generateRaw({
            systemPrompt: getSystemPrompt(mode, key),
            prompt: getPhase2UserMessage(userDesc, settings, excerpt, guide),
            responseLength: 600,
        }),
        PHASE2_TIMEOUT,
        `${fieldName} 生成`,
    );
    if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error(`${fieldName} 生成失败：AI 返回了空内容`);
    }
    // parseReasoningFromString 返回 {reasoning, content}|null；无 reasoning 模板时返回 null → 回退原文
    const parsed = ctx.parseReasoningFromString(text);
    return parsed?.content ?? text;
}

/** 容错解析：去 markdown 围栏后 JSON.parse */
function parseJsonResult(raw) {
    let s = raw.trim();
    const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) s = fenced[1].trim();
    try {
        return JSON.parse(s);
    } catch (err) {
        console.error('[char-creator] JSON 解析失败', err, s.slice(0, 200));
        return null;
    }
}
