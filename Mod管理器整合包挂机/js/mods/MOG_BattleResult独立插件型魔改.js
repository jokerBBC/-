/*:
 * @plugindesc 加速战斗结算流程（通过缩短超时和驻留帧数）
 * @author 玩家joker&deepseek专家模式 原作Moghunter
 * @help
 * 该插件会覆盖三个关键方法，使战斗结算界面几乎瞬间完成滚动和等待。
 * 通过缩短超时和驻留帧数
 * 
 */

(() => {
    if (!Imported.MOG_BattleResult) return;

    // 1. 缩短“无操作自动跳转”的超时时间（原为 3000ms → 100ms）
    BattleResult.prototype.isTimeOut = function(time) {
        return (new Date().getTime() - time >= 100);
    };

    // 2. 加快掉落物窗口的显示速度（原刷新控制需120帧→12帧，透明度增量5→50）
    const _updateTreasure = BattleResult.prototype.updateTreasure;
    BattleResult.prototype.updateTreasure = function() {
        if (this.刷新控制 < 12) {
            this.刷新控制 += 1;
            this.MOG掉落物滚动窗口.contentsBack._paintOpacity += 50;
            this.MOG掉落物滚动窗口.绘制背景();
            this.MOG掉落物滚动窗口.contentsOpacity += 50;
            this.MOG掉落物滚动窗口.opacity += 50;
        }
        if (this.刷新控制 >= 12 && this.pressAnyKey()) {
            BattleManager.gainDropItems();
            this.phaseAniClear();
            this._phase = 4;
        }
    };

    // 3. 移除经验值滚动结束后的强制驻留帧（原 _expHold 在总经验为0时会设为25帧）
    //    在 updateExp 中，驻留逻辑会在一切就绪后等待 _expHold 倒数。
    //    我们在初始化时直接将 _expHold 置为0，即可跳过等待。
    const _initialize = BattleResult.prototype.initialize;
    BattleResult.prototype.initialize = function() {
        _initialize.call(this);
        // 强制驻留帧数归零（原本在 updateExp 中动态赋值为 25 或 1）
        this._expHold = 0;
    };

    // 注：经验滚动速度（SPEED）和布局淡入淡出速度未修改，因为按任意键会直接跳转至目标值，
    //     不再需要逐帧滚动，因此对整体等待时间影响极小。

})();