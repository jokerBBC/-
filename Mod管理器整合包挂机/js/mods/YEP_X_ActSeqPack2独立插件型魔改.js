//=============================================================================
// YEP_X_ActSeqPack2 独立插件型魔改.js
// 功能：在战斗速度 >= 3 时，跳过 GHOST SPREAD、移动幻影、旋转特效和残影生成。
// 依赖：需要原版「YEP_X_ActSeqPack2.js」已加载。
//=============================================================================

/*:
 * @plugindesc 高速战斗下屏蔽动作序列残影特效（需配合 YEP_X_ActSeqPack2.js 使用）
 * @author 玩家joker&deepseek专家模式 原作：Yanfly
 * @help
 * 该插件会覆盖三个与残影相关的方法，仅在 $gameSystem.sora.战斗加速倍数 >= 3 时生效。
 * 高速战斗下屏蔽动作序列残影特效
 */

(() => {
    // 等待原插件加载完成
    if (!Imported.YEP_X_ActSeqPack2) return;

    // 辅助函数：判断是否高速模式
    const isHighSpeed = () => {
        return $gameSystem && $gameSystem.sora && $gameSystem.sora.战斗加速倍数 >= 3;
    };

    // 1. 覆盖 actionGhostSpread，高速模式直接返回
    const _BattleManager_actionGhostSpread = BattleManager.actionGhostSpread;
    BattleManager.actionGhostSpread = function(name, motion, pattern, actionArgs) {
        if (isHighSpeed()) return true;
        return _BattleManager_actionGhostSpread.call(this, name, motion, pattern, actionArgs);
    };

    // 2. 覆盖 actionMove 中的 setupGhost 逻辑（完整替换以保证高速判断生效）
    const _BattleManager_actionMove = BattleManager.actionMove;
    BattleManager.actionMove = function(name, actionArgs, ghostData) {
        var movers = this.makeActionTargets(name);
        if (movers.length < 1) return true;
        var cmd = actionArgs[0].toUpperCase();
        var user = this._subject;
        var targets = this._targets;
        var target = (targets && targets.length > 0) ? targets[0] : null;
        
        // 定义修正后的 setupGhost
        const setupGhost = (mover, frames) => {
            var f = Math.max(1, parseInt(frames) || 12);
            if (ghostData && mover) {
                mover.sora判定 = mover.sora判定 || {};
                // 高速模式下强制禁用 ghostActive
                let ghostActive = !!ghostData.hasGhost;
                if (isHighSpeed()) {
                    ghostActive = false;
                }
                mover.sora判定._ghostActive = ghostActive;
                mover.sora判定._ghostTimer = 0;
                mover.sora判定._ghostInterval = ghostData.interval || 0;
                mover.sora判定._ghostFadeSpeed = ghostData.fade || 0;
                mover.sora判定._ghostDuration = f;
                mover.sora判定._ghostCountLimit = ghostData.count || 0;
                mover.sora判定._ghostCreated = 0;

                // 高速模式下禁止旋转
                if (isHighSpeed()) {
                    mover.sora判定._spinSpeed = 0;
                } else if (ghostData.spinCount !== undefined && ghostData.spinCount > 0) {
                    mover.sora判定._spinSpeed = (ghostData.spinCount * Math.PI * 2) / f;
                } else {
                    mover.sora判定._spinSpeed = 0;
                }
            } else if (mover && mover.sora判定) {
                mover.sora判定._ghostActive = false;
                mover.sora判定._ghostDuration = 0;
                mover.sora判定._spinSpeed = 0;
            }
        };

        if (['HOME', 'ORIGIN'].contains(cmd)) {
            var frames = actionArgs[1] || 12;
            movers.forEach(function(mover) {
                setupGhost(mover, frames);
                mover.battler().startMove(0, 0, frames);
                mover.requestMotion('walk');
                mover.spriteFaceHome();
            });
        } else if (['RETURN'].contains(cmd)) {
            var frames = actionArgs[1] || 12;
            movers.forEach(function(mover) {
                setupGhost(mover, frames);
                mover.battler().startMove(0, 0, frames);
                mover.requestMotion('evade');
                mover.spriteFaceForward();
            });
        } else if (['FORWARD', 'FORWARDS', 'BACKWARD', 'BACKWARDS'].contains(cmd)) {
            var distance = actionArgs[1] || Yanfly.Param.BECStepDist;
            if (['BACKWARD', 'BACKWARDS'].contains(cmd)) distance *= -1;
            var frames = actionArgs[2] || 12;
            movers.forEach(function(mover) {
                setupGhost(mover, frames);
                mover.battler().moveForward(distance, frames);
                mover.requestMotion('walk');
                mover.spriteFaceForward();
            });
        } else if (['POINT', 'POSITION', 'COORDINATE', 'SCREEN', 'SCREEN POS', 'COORDINATES'].contains(cmd)) {
            var destX = eval(actionArgs[1]) || 0;
            var destY = eval(actionArgs[2]) || 0;
            var frames = actionArgs[3] || 12;
            movers.forEach(function(mover) {
                setupGhost(mover, frames);
                mover.battler().moveToPoint(destX, destY, frames);
                mover.requestMotion('walk');
                mover.spriteFacePoint(destX, destY);
            });
        } else {
            // 修复重复声明：将内层 targets 重命名为 moveTargets
            var moveTargets = this.makeActionTargets(actionArgs[0]);
            var frames = actionArgs[2] || 12;
            var type = (actionArgs[1] || '').toUpperCase();
            if (moveTargets.length < 1) return false;
            for (var i = 0; i < movers.length; ++i) {
                var mover = movers[i];
                if (!mover) continue;
                setupGhost(mover, frames);
                var destX, destY;
                if (['BASE', 'FOOT', 'FEET'].contains(type)) {
                    destX = this.actionMoveX(mover, moveTargets, 'center');
                    destY = this.actionMoveY(mover, moveTargets, 'foot');
                } else if (['CENTER', 'MIDDLE'].contains(type)) {
                    destX = this.actionMoveX(mover, moveTargets, 'center');
                    destY = this.actionMoveY(mover, moveTargets, 'center');
                } else if (['HEAD', 'TOP'].contains(type)) {
                    destX = this.actionMoveX(mover, moveTargets, 'center');
                    destY = this.actionMoveY(mover, moveTargets, 'head');
                } else if (['FRONT BASE', 'FRONT FOOT', 'FRONT FEET', 'FRONT'].contains(type)) {
                    destX = this.actionMoveX(mover, moveTargets, 'front');
                    destY = this.actionMoveY(mover, moveTargets, 'foot');
                } else if (['BACK BASE', 'BACK FOOT', 'BACK FEET', 'BACK'].contains(type)) {
                    destX = this.actionMoveX(mover, moveTargets, 'back');
                    destY = this.actionMoveY(mover, moveTargets, 'foot');
                } else if (['FRONT CENTER', 'FRONT MIDDLE'].contains(type)) {
                    destX = this.actionMoveX(mover, moveTargets, 'front');
                    destY = this.actionMoveY(mover, moveTargets, 'center');
                } else if (['BACK CENTER', 'BACK MIDDLE'].contains(type)) {
                    destX = this.actionMoveX(mover, moveTargets, 'back');
                    destY = this.actionMoveY(mover, moveTargets, 'center');
                } else if (['FRONT HEAD', 'FRONT TOP'].contains(type)) {
                    destX = this.actionMoveX(mover, moveTargets, 'front');
                    destY = this.actionMoveY(mover, moveTargets, 'head');
                } else if (['BACK HEAD', 'BACK TOP'].contains(type)) {
                    destX = this.actionMoveX(mover, moveTargets, 'back');
                    destY = this.actionMoveY(mover, moveTargets, 'head');
                }
                mover.battler().moveToPoint(destX, destY, frames);
                mover.spriteFacePoint(destX, destY);
            }
        }
        return true;
    };

    // 3. 覆盖 updateGhostCountEffect，高速模式直接返回
    const _Sprite_Battler_updateGhostCountEffect = Sprite_Battler.prototype.updateGhostCountEffect;
    Sprite_Battler.prototype.updateGhostCountEffect = function() {
        if (isHighSpeed()) return;
        _Sprite_Battler_updateGhostCountEffect.call(this);
    };

})();