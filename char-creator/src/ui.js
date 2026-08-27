import { getContext } from '../../../../st-context.js';
import { runGeneration } from './generator.js';
import { generatePhase2Field, cancelAll } from './ai.js';
import { importCard, downloadCard } from './writer.js';
import { TEMPLATE_KEYS, getDisplayName, getPhase1Fields, getPhase2Fields, FIELD_LABELS } from './templates.js';

const EXT_SETTINGS_KEY = 'char_creator';

/** @returns {object} 本扩展的设置对象（挂载到 ctx.extensionSettings） */
function getSettings() {
    const ctx = getContext();
    ctx.extensionSettings[EXT_SETTINGS_KEY] ??= {};
    return ctx.extensionSettings[EXT_SETTINGS_KEY];
}

function saveSettings() {
    getContext().saveSettingsDebounced();
}

function buildDialogHtml() {
    const opts = TEMPLATE_KEYS.map(k => `<option value="${k}">${getDisplayName(k)}</option>`).join('');
    return `
<div class="cc-dialog">
    <div class="cc-form-row">
        <label class="cc-label">模板</label>
        <select id="cc_template" class="cc-select">${opts}</select>
    </div>
    <div class="cc-form-row">
        <label class="cc-label">模式</label>
        <label class="cc-radio"><input type="radio" name="cc_mode" value="original" checked> 原创角色</label>
        <label class="cc-radio"><input type="radio" name="cc_mode" value="ip"> 现有 IP 角色</label>
    </div>
    <div class="cc-form-row">
        <label class="cc-label">需求描述</label>
        <textarea id="cc_desc" class="cc-textarea" rows="4" placeholder="原创模式：描述你想要的角色方向（如“一个傲娇的剑客妹妹”）；IP 模式：指明角色名与出处（如“鸣人，火影忍者”）"></textarea>
    </div>
    <div class="cc-form-row">
        <label class="cc-checkbox"><input type="checkbox" id="cc_mes_example"> 同时生成对话示例</label>
        <div class="cc-actions">
            <button id="cc_generate_btn" class="menu_button"><i class="fa-solid fa-wand-magic-sparkles"></i> 生成</button>
            <button id="cc_cancel_gen_btn" class="menu_button" style="display:none">取消</button>
            <span id="cc_progress" class="cc-progress"></span>
        </div>
    </div>
    <div id="cc_preview" class="cc-preview">
        <p class="cc-placeholder">填写需求后点击「生成」，AI 将按模板填充字段并显示在下方供预览与调整。</p>
    </div>
</div>`;
}

function fieldRowHtml(field) {
    const label = FIELD_LABELS[field] || field;
    return `
<div class="cc-field" data-field="${field}">
    <div class="cc-field-head">
        <label class="cc-field-label">${label}</label>
        <button class="cc-regen-btn menu_button fa-solid fa-rotate-right" data-field="${field}" title="重新生成该字段" disabled></button>
    </div>
    <textarea id="cc_field_${field}" class="cc-field-textarea" rows="${field === 'description' ? 12 : 6}" placeholder="待生成…"></textarea>
</div>`;
}

export async function openMainDialog() {
    const ctx = getContext();
    const settings = getSettings();
    let downloadHandler = null;

    const popup = new ctx.Popup(buildDialogHtml(), ctx.POPUP_TYPE.TEXT, '', {
        wide: true,
        large: true,
        okButton: '导入角色卡',
        customButtons: [
            { text: '下载角色卡', action: () => downloadHandler() },
            { text: '取消', result: ctx.POPUP_RESULT.CANCELLED },
        ],
        allowEscapeClose: true,
    });

    const dlg = popup.dlg;
    const $desc = $(dlg).find('#cc_desc');
    const $template = $(dlg).find('#cc_template');
    const $genBtn = $(dlg).find('#cc_generate_btn');
    const $cancelGenBtn = $(dlg).find('#cc_cancel_gen_btn');
    const $progress = $(dlg).find('#cc_progress');
    const $preview = $(dlg).find('#cc_preview');
    const $mesExampleCb = $(dlg).find('#cc_mes_example');

    // 恢复上次设置
    if (settings.template) $template.val(settings.template);
    if (settings.mode) $(dlg).find(`input[name="cc_mode"][value="${settings.mode}"]`).prop('checked', true);
    if (settings.mesExample) $mesExampleCb.prop('checked', true);

    // 记录设置变更
    $template.on('change', () => { settings.template = $template.val(); saveSettings(); });
    $(dlg).find('input[name="cc_mode"]').on('change', () => { settings.mode = $(dlg).find('input[name="cc_mode"]:checked').val(); saveSettings(); });
    $mesExampleCb.on('change', () => { settings.mesExample = $mesExampleCb.prop('checked'); saveSettings(); });

    /** 读取当前配置 */
    function readConfig() {
        return {
            key: $template.val(),
            mode: $(dlg).find('input[name="cc_mode"]:checked').val() || 'original',
            userDesc: $desc.val().trim(),
            mesExample: $mesExampleCb.prop('checked'),
        };
    }

    /** 读取所有预览字段的当前值 */
    function readFieldValues() {
        const cfg = readConfig();
        const allFields = [...getPhase1Fields(cfg.key), ...getPhase2Fields(cfg.key, { mesExample: cfg.mesExample })];
        const fieldValues = {};
        for (const f of allFields) {
            fieldValues[f] = $(dlg).find(`#cc_field_${f}`).val() ?? '';
        }
        return { cfg, fieldValues };
    }

    function setProgress(msg) { $progress.text(msg || ''); }
    function setGenerating(on) {
        $genBtn.prop('disabled', on);
        $cancelGenBtn.toggle(on);
    }

    /** 构建预览区字段行 */
    function buildPreview(key, mesExample) {
        const fields = [...getPhase1Fields(key), ...getPhase2Fields(key, { mesExample })];
        $preview.empty();
        for (const f of fields) {
            $preview.append(fieldRowHtml(f));
        }
        $preview.find('.cc-regen-btn').on('click', onRegenClick);
    }

    /** 把某字段值写入预览 textarea，并高亮【需用户补充：xxx】 */
    function setFieldValue(field, value) {
        const $ta = $(dlg).find(`#cc_field_${field}`);
        if (!$ta.length) return;
        $ta.val(value).toggleClass('cc-need-fill', /【需用户补充/.test(value));
        // 啟用該字段的重生按钮
        $(dlg).find(`.cc-regen-btn[data-field="${field}"]`).prop('disabled', false);
    }

    // 下载角色卡（不关闭弹窗，下载后可继续编辑或导入）
    downloadHandler = () => {
        const { cfg, fieldValues } = readFieldValues();
        if (!fieldValues.name?.trim()) {
            if (typeof toastr !== 'undefined') toastr.error('名称不能为空，无法下载');
            return;
        }
        try {
            downloadCard({ key: cfg.key, fieldValues });
        } catch (err) {
            console.error('[char-creator] 下载失败', err);
            if (typeof toastr !== 'undefined') toastr.error(`下载失败：${err.message}`);
        }
    };

    // 生成按钮
    let lastSettings = null;
    async function onGenerate() {
        const cfg = readConfig();
        if (!cfg.userDesc) {
            if (typeof toastr !== 'undefined') toastr.warning('请先填写需求描述');
            return;
        }
        buildPreview(cfg.key, cfg.mesExample);
        setGenerating(true);
        ctx.deactivateSendButtons?.();
        try {
            lastSettings = await runGeneration({
                ...cfg,
                onField: setFieldValue,
                onProgress: setProgress,
            });
        } catch (err) {
            console.error('[char-creator] 生成失败', err);
            if (typeof toastr !== 'undefined') toastr.error(`生成失败：${err.message}`);
            setProgress('生成失败');
        } finally {
            setGenerating(false);
            ctx.activateSendButtons?.();
        }
    }

    // 取消生成按钮
    async function onCancelGen() {
        cancelAll();
        setProgress('正在取消…');
    }

    // 单字段重生
    async function onRegenClick(e) {
        const field = $(e.currentTarget).data('field');
        if (!field || !lastSettings) return;
        const cfg = readConfig();
        const $ta = $(dlg).find(`#cc_field_${field}`);
        $ta.prop('disabled', true);
        ctx.deactivateSendButtons?.();
        try {
            const value = await generatePhase2Field({
                mode: cfg.mode, key: cfg.key, userDesc: cfg.userDesc,
                settings: lastSettings, fieldName: field,
            });
            lastSettings[field] = value;
            setFieldValue(field, value);
        } catch (err) {
            console.error(`[char-creator] 重生 ${field} 失败`, err);
            if (typeof toastr !== 'undefined') toastr.error(`重生失败：${err.message}`);
        } finally {
            $ta.prop('disabled', false);
            ctx.activateSendButtons?.();
        }
    }

    $genBtn.on('click', onGenerate);
    $cancelGenBtn.on('click', onCancelGen);

    // 显示弹窗（await 在用户点按钮时 resolve）
    const result = await popup.show();

    if (result === ctx.POPUP_RESULT.AFFIRMATIVE) {
        const { cfg, fieldValues } = readFieldValues();
        // 名称必填
        if (!fieldValues.name?.trim()) {
            if (typeof toastr !== 'undefined') toastr.error('名称不能为空，无法导入');
            return;
        }
        try {
            await importCard({ key: cfg.key, fieldValues });
        } catch (err) {
            console.error('[char-creator] 导入失败', err);
            if (typeof toastr !== 'undefined') toastr.error(`导入失败：${err.message}`);
        }
    }
}
