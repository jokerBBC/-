//=============================================================================
// MPP_EncounterEffect_FastPatch.js
//=============================================================================
/*:
 * @target MV MZ
 * @plugindesc MPP_EncounterEffect 瞬间破碎加速补丁
 * @author joker创意魔改 / Mokusei Penguin原作者 / GLM独立化
 *
 * @help
 * 【必要前置操作】
 * 作者开启进入战斗时玻璃破碎效果才需要开启这个插件。原生加速插件不可加速这个特效。
 * 觉得太快了自己改参数，或者直接关闭本mod。
 * 
 * 【功能概述】
 * - 将三种破碎类型的持续时间压缩至原来的约 1/10，实现瞬间破碎。
 * - 修正特效期间的帧率平滑逻辑，防止掉帧导致的卡顿感。
 * 
 * 【以下作者启用MPP玻璃特效时应对】
 * 如果原版插件在未安装扩展包(Opt)时不会将核心类暴露至全局，
 * 导致外部补丁无法触达其闭包内部的参数。
 * 请打开原插件 MPP_EncounterEffect.js，找到约第 288 行的：
 * 
 * if (_importedPlugin(...pluginOptions)) {
 *     window.EncounterEffect = EncounterEffect;
 * }
 * 
 * 将其修改为（或直接在该 if 块下方新增一行）：
 * window.EncounterEffect = EncounterEffect;
 * 
 * 保存后即可正常使用本补丁。
 * 
 */

(() => {
    'use strict';

    // 安全检查：如果原插件未按帮助文档暴露核心类，则静默退出
    if (typeof window.EncounterEffect === 'undefined') {
        console.warn('[MPP_EncounterEffect_FastPatch] 未检测到全局 EncounterEffect，补丁未生效。请查阅插件帮助文档。');
        return;
    }

    const EncounterEffect = window.EncounterEffect;

    //-------------------------------------------------------------------------
    // 动态覆写参数读取 (替代修改闭包内的 DATABASE 常量)
    //-------------------------------------------------------------------------
    const _EncounterEffect_params = EncounterEffect.params;
    EncounterEffect.params = function() {
        const original = _EncounterEffect_params.call(this);
        if (!original) return original;

        const type = this._type;
        // 注入修改版的高速参数
        if (type === 1) {
            original['Break Duration'] = 3;
            original['Interval Duration'] = 3;
            original['Move Duration'] = 6;
        } else if (type === 2) {
            original['Break Duration'] = 2;
            original['Interval Duration'] = 3;
            original['Scatter Duration'] = 2;
            original['Move Duration'] = 7;
        } else if (type === 3) {
            original['Break Duration'] = 2;
            original['Interval Duration'] = 2;
            original['Scatter Duration'] = 11;
            original['Move Duration'] = 10;
        }
        return original;
    };

    //-------------------------------------------------------------------------
    // 覆写特效启动延迟 (4帧 -> 1帧)
    //-------------------------------------------------------------------------
    EncounterEffect.startEffectDelay = function() {
        this._effectDelay = 1;
    };

    //-------------------------------------------------------------------------
    // 覆写碎片添加逻辑 (增加 150 个上限锁，提升性能)
    //-------------------------------------------------------------------------
    const _EncounterEffect_addPolygon = EncounterEffect.addPolygon;
    EncounterEffect.addPolygon = function(polygon) {
        if (this._fragments.length >= 150) return;
        _EncounterEffect_addPolygon.call(this, polygon);
    };

    //-------------------------------------------------------------------------
    // 覆写帧率平滑控制逻辑 (优化特效期间的 deltaTime 处理)
    //-------------------------------------------------------------------------
    const _SceneManager_determineRepeatNumber = SceneManager.determineRepeatNumber;
    SceneManager.determineRepeatNumber = function(deltaTime) {
        if (EncounterEffect.isRunning()) {
            this._smoothDeltaTime *= 0.5;
            this._smoothDeltaTime += Math.min(deltaTime, 2) * 0.2;
            if (this._smoothDeltaTime >= 0.5) {
                this._elapsedTime = 0;
                return Math.round(this._smoothDeltaTime * 2);
            } else {
                this._elapsedTime += deltaTime;
                if (this._elapsedTime >= 0.5) {
                    this._elapsedTime -= 0.5;
                    return 1;
                }
                return 0;
            }
        }
        return _SceneManager_determineRepeatNumber.apply(this, arguments);
    };

    //-------------------------------------------------------------------------
    // 覆写地图战斗触发 (注入“玻璃开始破碎”音效)
    //-------------------------------------------------------------------------
    const _Scene_Map_launchBattle = Scene_Map.prototype.launchBattle;
    Scene_Map.prototype.launchBattle = function() {
        _Scene_Map_launchBattle.call(this);
        if (EncounterEffect.isRunning()) {
            setTimeout(() => {
                AudioManager.playSe({ name: '玻璃开始破碎', volume: 100, pitch: 100, pan: 0 });
            }, 32);
        }
    };

    //-------------------------------------------------------------------------
    // 覆写战斗场景初始化 (注入“玻璃破碎”音效)
    //-------------------------------------------------------------------------
    const _Scene_Battle_create = Scene_Battle.prototype.create;
    Scene_Battle.prototype.create = function() {
        _Scene_Battle_create.call(this);
        if (EncounterEffect.isRunning()) {
            setTimeout(() => {
                AudioManager.playSe({ name: '玻璃破碎', volume: 100, pitch: 100, pan: 0 });
            }, 32);
        }
    };

})();
