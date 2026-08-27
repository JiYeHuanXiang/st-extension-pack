import { getContext } from '../../../st-context.js';

/**
 * 深度扮演扩展
 *
 * 流程：点击按钮 → 校验模型为 DeepSeek V4 系列 → 校验思考模式已启用
 * （未启用时弹窗询问，继续则覆盖思考深度为 auto）→ 选择注入位置：
 *   模式一：提示词置于上下文顶部（BEFORE_PROMPT）
 *   模式二：提示词并入系统提示词（IN_PROMPT）
 *
 * 注入机制说明（不重复、不覆盖酒馆自带提示词）：
 *   setExtensionPrompt 以固定 key 存入字典，同 key 覆盖 value 不叠加；
 *   组装时 identifier=deep_roleplay_prompt 与自带 main 不同，走 add 追加；
 *   清空时 value='' 被组装逻辑跳过，注入彻底移除。
 */

/** 扩展注入键（固定，同 key 覆盖不叠加） */
const INJECT_KEY = 'deep_roleplay_prompt';

/** extension_prompt_types 枚举值（见 script.js） */
const EP_BEFORE_PROMPT = 2; // 上下文顶部 / start
const EP_IN_PROMPT = 0;     // 系统提示词末尾 / end
/** extension_prompt_roles.SYSTEM */
const EP_ROLE_SYSTEM = 0;

/** 深度扮演提示词（源自提示词.txt，可按需修改） */
const PROMPT = `【角色沉浸要求】在你的思考过程（<think标签内）中，请遵守以下规则：
1. 请以角色第一人称进行内心独白，用括号包裹内心活动，例如"（心想：……）"或"(内心OS：……)"
2. 用第一人称描写角色的内心感受，例如"我心想""我觉得""我暗自"等
3. 思考内容应沉浸在角色中，通过内心独白分析剧情和规划回复`;

/** 当前激活模式：null | 'top' | 'system' */
let activeMode = null;

/**
 * 宽松检测当前模型是否为 DeepSeek V4 系列（pro / flash）
 *
 * 兼容第三方供应商（硅基流动、OpenRouter 等）与官方的不同命名，
 * 如 deepseek-v4-flash / deepseek-ai/DeepSeek-V4-Pro / deepseek/deepseek-v4-flash
 * @param {string} model 当前模型 id
 * @returns {boolean}
 */
function isDeepSeekV4(model) {
    if (!model) return false;
    const s = String(model).toLowerCase();
    // 必须同时包含：deepseek 品牌词 + V4 版本 + pro/flash 型号
    return /deepseek/.test(s) && /v[\s_-]?4/.test(s) && /(pro|flash)/.test(s);
}

/**
 * 检测思考模式是否已启用（与 DeepSeek 服务端 resolveDeepSeekThinking 等价判断）
 * @param {object} oai oai_settings
 * @returns {boolean}
 */
function isThinkingEnabled(oai) {
    const effort = oai?.reasoning_effort;
    if (effort === 'disabled') return false;
    // 非 auto 的具体档位（high/max/medium/low/min）即视为已启用
    const hasActiveEffort = !!effort && effort !== 'auto';
    // auto 需配合 show_thoughts（include_reasoning）才真正启用 DeepSeek 思考
    return hasActiveEffort || !!oai?.show_thoughts;
}

/**
 * 覆盖思考设置：深度 auto（并开启 show_thoughts 以使 DeepSeek 的 auto 思考生效）
 * @param {object} ctx SillyTavern context
 */
function overrideThinkingSettings(ctx) {
    const oai = ctx.chatCompletionSettings;
    oai.reasoning_effort = 'auto';
    oai.show_thoughts = true;
    // 同步 UI 控件
    $('#openai_reasoning_effort').val('auto');
    $('#openai_show_thoughts').prop('checked', true);
    ctx.saveSettingsDebounced();
}

/**
 * 注入提示词到指定位置
 * @param {object} ctx SillyTavern context
 * @param {'top'|'system'} mode 注入模式
 * @returns {boolean} 是否实际变更（同模式重复点击返回 false）
 */
function injectPrompt(ctx, mode) {
    // 显式防重复 guard：已是该模式则提示并跳过
    if (activeMode === mode) {
        if (typeof toastr !== 'undefined') {
            toastr.info('深度扮演已处于该模式，无需重复启用');
        }
        return false;
    }
    const position = mode === 'top' ? EP_BEFORE_PROMPT : EP_IN_PROMPT;
    ctx.setExtensionPrompt(INJECT_KEY, PROMPT, position, 0, false, EP_ROLE_SYSTEM);
    activeMode = mode;
    updateButtonState();
    const label = mode === 'top' ? '上下文顶部' : '系统提示词';
    if (typeof toastr !== 'undefined') {
        toastr.success(`已启用深度扮演（提示词置于${label}）`);
    }
    return true;
}

/** 清除注入 */
function clearPrompt(ctx) {
    ctx.setExtensionPrompt(INJECT_KEY, '', EP_IN_PROMPT, 0, false, EP_ROLE_SYSTEM);
    activeMode = null;
    updateButtonState();
    if (typeof toastr !== 'undefined') {
        toastr.info('已关闭深度扮演');
    }
}

/** 更新按钮激活态与提示 */
function updateButtonState() {
    const $btn = $('#deep_roleplay_toggle');
    $btn.toggleClass('active', activeMode !== null);
    $btn.text(activeMode
        ? `深度扮演 · ${activeMode === 'top' ? '上下文顶部' : '系统提示词'}（点击重新配置）`
        : '深度扮演');
}

/** 主流程 */
async function openDeepRoleplay() {
    const ctx = getContext();

    // 1. 模型校验
    const model = ctx.getChatCompletionModel();
    if (ctx.mainApi !== 'openai' || !isDeepSeekV4(model)) {
        if (typeof toastr !== 'undefined') toastr.warning('仅支持 deepseek V4 系列');
        return;
    }

    // 2. 思考模式校验：未启用则弹窗询问
    if (!isThinkingEnabled(ctx.chatCompletionSettings)) {
        const confirm = await ctx.callGenericPopup(
            '该模式需要启用思考模式。<br>点击「继续」将自动设置思考深度为 auto。',
            ctx.POPUP_TYPE.TEXT,
            '',
            { okButton: '继续', cancelButton: '返回' },
        );
        if (confirm !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        // 3. 覆盖思考设置
        overrideThinkingSettings(ctx);
    }

    // 4. 选择注入位置
    const customButtons = [
        { text: '模式二 · 系统提示词', result: 2 },
    ];
    if (activeMode) {
        customButtons.push({ text: '关闭深度扮演', result: 3 });
    }

    const modeResult = await ctx.callGenericPopup(
        '请选择提示词注入位置：',
        ctx.POPUP_TYPE.TEXT,
        '',
        {
            okButton: '模式一 · 上下文顶部',
            cancelButton: '取消',
            customButtons,
            // customButtons 默认插在 OK 按钮前，这里移到 cancel 前，
            // 保证顺序：模式一(OK) → 模式二(及关闭) → 取消
            onOpen: () => {
                $(document).find('.popup-button-custom').insertBefore(
                    $(document).find('.popup-button-cancel').first(),
                );
            },
        },
    );

    if (modeResult === ctx.POPUP_RESULT.AFFIRMATIVE) {
        injectPrompt(ctx, 'top');
    } else if (modeResult === 2) {
        injectPrompt(ctx, 'system');
    } else if (modeResult === 3) {
        clearPrompt(ctx);
    }
}

/** 在 Extensions 设置面板注入容器入口 */
function injectExtensionsPanelEntry() {
    if ($('#deep_roleplay_container').length) return;
    const ctx = getContext();
    const container = $('<div id="deep_roleplay_container" class="extension_container"></div>');
    const header = $('<div class="extension_toggle_row flex-container alignitemscenter"></div>');
    const title = $('<h4 class="margin0 flex1">深度扮演</h4>');
    const toggle = $('<div id="deep_roleplay_toggle" class="menu_button" style="cursor:pointer;">深度扮演</div>');
    toggle.on('click', openDeepRoleplay);
    header.append(title, toggle);
    const hint = $('<small style="opacity:0.7;display:block;margin-top:4px;">'
        + '检测 DeepSeek V4 系列 + 思考模式，将角色沉浸提示词注入上下文顶部或系统提示词。'
        + (ctx.mainApi === 'openai' && isDeepSeekV4(ctx.getChatCompletionModel())
            ? '<br><span style="color:var(--SmartThemeQuoteColor);">当前模型符合条件。</span>'
            : '<br><span style="opacity:0.6;">当前模型不符（仅支持 deepseek V4 pro/flash）。</span>')
        + '</small>');
    container.append(header, hint);
    $('#extensions_settings2').append(container);
    updateButtonState();
}

export function init() {
    const ctx = getContext();

    injectExtensionsPanelEntry();

    // 面板可能延迟渲染，APP_READY 时兜底重注入
    ctx.eventSource.on(ctx.eventTypes.APP_READY, () => injectExtensionsPanelEntry());

    // 注册 slash 命令 /deep-roleplay
    ctx.SlashCommandParser.addCommandObject(ctx.SlashCommand.fromProps({
        name: 'deep-roleplay',
        aliases: ['drp'],
        callback: async () => {
            await openDeepRoleplay();
            return '';
        },
        returns: 'string',
        helpString: '打开深度扮演配置：检测模型/思考模式，选择提示词注入位置',
    }));

    console.log('[deep-roleplay] 深度扮演扩展已加载');
}
