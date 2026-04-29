//=============================================================================
// 修复版：底层动画修改独立插件型魔改.js
// 功能：战斗速度 >= 3 时完全屏蔽所有动画（包括自定义播放器），无内存泄漏
//=============================================================================
/*:
 * @plugindesc 底层动画修改独立插件型魔改.js
 * @author 玩家joker&deepseek专家模式 原作：Yanfly
 * @help
 * 战斗速度 >= 3 时完全屏蔽所有动画（包括自定义播放器），无内存泄漏
 * 高速战斗下屏蔽动画特效
 * 底层动画修改.j下面加载
 */


(() => {
    'use strict';

    // Effekseer 动画
    const aliasSpriteAnimationUpdate = Sprite_Animation.prototype.update;
    Sprite_Animation.prototype.update = function() {
        const battleSpeed = $gameSystem.sora?.战斗加速倍数 || 0;
        if (battleSpeed >= 3) {
            if (this._handle) {
                this._handle.stop();
                this._handle = null;
            }
            this._effect = null;
            this._animation = null;
            this._playing = false;
            if (this.parent) this.parent.removeChild(this);
            return;
        }
        aliasSpriteAnimationUpdate.call(this);
    };

    // MV 帧动画
    const aliasSpriteAnimationMVUpdate = Sprite_AnimationMV.prototype.update;
    Sprite_AnimationMV.prototype.update = function() {
        const battleSpeed = $gameSystem.sora?.战斗加速倍数 || 0;
        if (battleSpeed >= 3) {
            if (typeof this.onEnd === 'function') this.onEnd();
            this._duration = 0;
            if (this.parent) this.parent.removeChild(this);
            return;
        }
        aliasSpriteAnimationMVUpdate.call(this);
    };

    // 自定义 MZ动画播放 类
    if (sora?.底层动画修改插件?.MZ动画播放) {
        const MZAnimPlayer = sora.底层动画修改插件.MZ动画播放;

        // 拦截 update
        const _update = MZAnimPlayer.prototype.update;
        MZAnimPlayer.prototype.update = function() {
            const battleSpeed = $gameSystem.sora?.战斗加速倍数 || 0;
            if (battleSpeed >= 3) {
                for (const sprite of this._animationSprites) {
                    if (sprite._handle) {
                        sprite._handle.stop();
                        sprite._handle = null;
                    }
                    sprite._effect = null;
                    sprite._animation = null;
                    sprite._playing = false;
                    if (sprite.onEnd) sprite.onEnd();
                }
                this._animationSprites = [];
                if (this.parent) this.parent.removeChild(this);
                if (this._finishCallback) {
                    this._finishCallback.call(this);
                    this._finishCallback = null;
                }
                return;
            }
            _update.call(this);
        };

        // 拦截 startAnimation，从源头阻止创建
        const _startAnimation = MZAnimPlayer.prototype.startAnimation;
        MZAnimPlayer.prototype.startAnimation = function(animation, mirror, delay) {
            const battleSpeed = $gameSystem.sora?.战斗加速倍数 || 0;
            if (battleSpeed >= 3) {
                if (this._finishCallback) {
                    this._finishCallback.call(this);
                    this._finishCallback = null;
                }
                this.resetAnimationData();
                return;
            }
            _startAnimation.call(this, animation, mirror, delay);
        };
    }

})();