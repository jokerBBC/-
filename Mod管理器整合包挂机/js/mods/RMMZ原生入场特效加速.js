//=============================================================================
// FastNativeEncounter.js
//=============================================================================
/*:
 * @target MZ
 * @plugindesc 加速原生战斗入场特效的持续时间。
 * @author joker创意 / GLM代码
 *
 * @param Encounter Duration
 * @text 入战特效总帧数
 * @desc 控制原生遇敌动画（画面闪烁）的持续时间。
 * RMMZ 默认运行在 60帧/秒（即 1秒 = 60帧）。
 * 原版默认值为 60。数值越小，切入战斗越快。
 * @type number
 * @min 1
 * @default 20
 *
 * @help
 * 本插件只可用于加速 RMMZ 原生的战斗入场特效。
 * (画面放大后缩小，屏幕白到黑的特效)
 * 若作者开启了第三方入战特效插件（如 MPP_EncounterEffect），
 * 本插件的加速效果不会对其产生影响。
 * 请在第三方插件MPP_EncounterEffect内部调整后启动MPP修改插件。
 */
(() => {
    'use strict';
    
    const pluginName = 'FastNativeEncounter';
    const parameters = PluginManager.parameters(pluginName);
    const paramDuration = Number(parameters['Encounter Duration'] || 1);// 默认值改为 1，确保至少有一个帧的持续时间。

    //-------------------------------------------------------------------------
    // Scene_Map
    // Alias: 安全加速原生入战特效时长（不误伤第三方特效插件）
    //-------------------------------------------------------------------------
    const _Scene_Map_encounterEffectSpeed = Scene_Map.prototype.encounterEffectSpeed;
    Scene_Map.prototype.encounterEffectSpeed = function() {
        // 1. 先调用底层原链，获取当前真实的特效时长
        const baseSpeed = _Scene_Map_encounterEffectSpeed.apply(this, arguments);
        
        // 2. 如果返回值是 60，说明当前走的是 RMMZ 原生闪白逻辑，我们将其替换为参数值
        // 3. 如果返回值不是 60（比如 MPP 返回了 90），说明已被第三方插件接管，原样返回，绝不干涉
        return baseSpeed === 60 ? paramDuration : baseSpeed;
    };

})();
