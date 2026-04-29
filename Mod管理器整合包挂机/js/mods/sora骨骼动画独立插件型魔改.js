//=============================================================================
// sora骨骼动画独立插件型魔改.js
// 功能：在战斗速度 >= 3 时，跳过 Spine 骨骼动画的播放与更新，可选。
// 依赖：需要原版「sora骨骼动画.js」已加载。
//=============================================================================

/*:
 * @plugindesc 高速战斗下屏蔽 Spine 骨骼动画（需配合 sora骨骼动画.js 使用）
 * @author 玩家joker&deepseek专家模式 原作：sora
 * @help
 * 该插件会覆盖两个 Spine 相关方法，仅在 $gameSystem.sora.战斗加速倍数 >= 3 时生效。
 * 高速战斗下屏蔽 Spine 骨骼动画（需配合 sora骨骼动画.js 使用）
 */

(() => {
    // 等待原插件加载完成后再进行覆盖（确保类和方法已定义）
    
    // 1. 覆盖 Game_Temp.playSpineAnimation，高速模式下直接返回
    const _Game_Temp_playSpineAnimation = Game_Temp.playSpineAnimation;
    Game_Temp.playSpineAnimation = function(sprite, aniNames, isLoop, isForce = true) {
        const battleSpeed = $gameSystem.sora?.战斗加速倍数 || 0;
        if (battleSpeed >= 3) {
            return;  // 高速模式跳过动画播放
        }
        _Game_Temp_playSpineAnimation.call(this, sprite, aniNames, isLoop, isForce);
    };

    // 2. 覆盖 Sprite_Battler.prototype.updateSpineDragon，高速模式下跳过更新
    const _Sprite_Battler_updateSpineDragon = Sprite_Battler.prototype.updateSpineDragon;
    Sprite_Battler.prototype.updateSpineDragon = function() {
        const battleSpeed = $gameSystem.sora?.战斗加速倍数 || 0;
        if (battleSpeed >= 3) {
            return;  // 高速模式跳过骨骼更新
        }
        _Sprite_Battler_updateSpineDragon.call(this);
    };
})();