import { init as initCharCreator } from './char-creator/index.js';
import { init as initDeepRoleplay } from './deep-roleplay/index.js';

/**
 * 合集扩展入口：一次安装同时启用两个扩展
 *  - char-creator/  角色卡制作助手
 *  - deep-roleplay/ 深度扮演
 */
export function init() {
    initCharCreator();
    initDeepRoleplay();
    console.log('[st-extension-pack] 合集扩展已加载（角色卡制作助手 + 深度扮演）');
}
