import { getContext } from '../../../st-context.js';
import { openMainDialog } from './src/ui.js';

export function init() {
    const ctx = getContext();

    // 注入按钮到角色编辑器底部按钮栏（与 #favorite_button 同级）
    const btn = $('<div id="char_creator_button" class="menu_button fa-solid fa-wand-magic-sparkles" title="角色卡制作助手"></div>');
    btn.on('click', () => openMainDialog());

    function injectButton() {
        const mount = $('.form_create_bottom_buttons_block');
        if (mount.length && !$('#char_creator_button').length) {
            mount.append(btn);
        }
    }
    injectButton();

    // 编辑器打开时兜底重绘（面板可能被重新渲染导致按钮丢失）
    ctx.eventSource.on(ctx.eventTypes.CHARACTER_EDITOR_OPENED, () => {
        injectButton();
    });

    // 在 Extensions 设置面板增加可见入口（第三方扩展需自建容器）
    injectExtensionsPanelEntry();

    /**
     * 在 Extensions 设置面板增加一个可见区块，内含"打开角色卡制作助手"按钮。
     * 第三方扩展需自建 .extension_container div（ST 不预创建）。
     */
    function injectExtensionsPanelEntry() {
        if ($('#char_creator_ext_container').length) return;
        const container = $('<div id="char_creator_ext_container" class="extension_container"></div>');
        const header = $('<div class="extension_toggle_row flex-container alignitemscenter"></div>');
        const title = $('<h4 class="margin0 flex1" data-i18n="角色卡制作助手">角色卡制作助手</h4>');
        const openBtn = $('<div class="menu_button fa-solid fa-wand-magic-sparkles" title="打开角色卡制作助手向导" style="cursor:pointer;"> 打开向导</div>');
        openBtn.on('click', () => openMainDialog());
        header.append(title, openBtn);
        const hint = $('<small style="opacity:0.7;display:block;margin-top:4px;">选择模板与模式 → 描述需求 → AI 填充模板 → 预览调整 → 导入新角色卡。也可在角色编辑器底部点击 ✨ 按钮打开。</small>');
        container.append(header, hint);
        // 追加到 Extensions 设置面板第二列
        $('#extensions_settings2').append(container);
    }

    // 注册 slash 命令 /char-create
    ctx.SlashCommandParser.addCommandObject(ctx.SlashCommand.fromProps({
        name: 'char-create',
        aliases: ['character-create'],
        callback: async () => {
            openMainDialog();
            return '';
        },
        returns: 'string',
        helpString: '打开角色卡制作助手向导：选模板、选模式、描述需求，AI 填充并预览后导入为新角色卡。',
    }));

    console.log('[char-creator] 角色卡制作助手已加载');
}
