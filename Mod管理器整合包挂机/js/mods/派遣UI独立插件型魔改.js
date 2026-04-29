//=============================================================================
// AutoDispatch.js
// 派遣UI自动收派扩展 (v1.1.0)
//=============================================================================
/*:
 * @target MZ
 * @plugindesc 为派遣UI插件添加自动收派功能。需放置在“派遣UI.js”下方。
 * @author joker创意 & Deepseek代码
 * @help
 * ============================================================================
 * 功能介绍 (v1.1.0 更新)
 * ============================================================================
 * - 修复：读档后若存在已完成派遣，会自动领取并尝试再次派遣。
 * - 新增：未设置默认派遣时长时，无法开启自动功能，并显示提示文字。
 *
 * 1. 在派遣主界面右上角返回图标下方添加一个切换按钮：
 *    - “自动收派 ON” 时按钮背景为浅绿色。
 *    - “自动收派 OFF” 时按钮背景为灰色（与其他按钮一致）。
 *
 * 2. 开关状态会保存在存档中，读档后自动恢复。
 *
 * 3. 当开关处于 ON 状态时，系统会在后台自动执行以下操作：
 *    - 检测是否有已完成的派遣，若有则自动领取所有可领取的奖励。
 *    - 领取后，自动按照上次派遣的配置再次派遣相同的队伍（默认时长）。
 *    - 所有操作均在后台静默完成，无需打开派遣界面。
 *
 * 4. 自动调度采用基于时间戳的精确触发机制，性能开销极低。
 *
 * ============================================================================
 * 使用说明
 * ============================================================================
 * 1. 确保本插件在“派遣UI.js”之后加载。
 * 2. 打开派遣界面，点击右上角“自动收派 OFF”按钮即可开启自动循环。
 *    （注意：必须先在派遣界面设置好默认派遣时长，否则无法开启）
 * 3. 关闭派遣界面后，自动收派功能将在后台继续运行。
 * 4. 当无法继续派遣（例如无可用角色、战力不足、无上次记录）时，自动开关会
 *    自动关闭，玩家需要手动介入。
 */

(() => {
    'use strict';
    const pluginName = 'AutoDispatch';

    //-----------------------------------------------------------------------------
    // 1. 数据存储扩展
    //-----------------------------------------------------------------------------
    const _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize.call(this);
        // 初始化自动开关状态和下次检查时间
        this.sora._autoDispatchEnabled = this.sora._autoDispatchEnabled || false;
        this.sora._nextAutoCheckTime = this.sora._nextAutoCheckTime || null;
    };

    Game_System.prototype.isAutoDispatchEnabled = function() {
        return !!this.sora._autoDispatchEnabled;
    };

    Game_System.prototype.setAutoDispatchEnabled = function(value) {
        // 如果要开启，但默认时长为空，则不允许开启
        if (value && !this.dispatchDefaultDuration()) {
            return false;
        }
        this.sora._autoDispatchEnabled = value;
        if (value) {
            this.recalculateNextAutoCheckTime();
        } else {
            this.sora._nextAutoCheckTime = null;
        }
        return true;
    };

    // 重新计算下一次需要检查的时间（最早完成且未领取的派遣结束时间）
    Game_System.prototype.recalculateNextAutoCheckTime = function() {
        const now = Date.now();
        let minTime = Infinity;
        const dispatches = this.getDispatches();
        for (const d of dispatches) {
            if (!d.claimed && d.endTime > now) {
                if (d.endTime < minTime) {
                    minTime = d.endTime;
                }
            }
        }
        this.sora._nextAutoCheckTime = (minTime === Infinity) ? null : minTime;
    };

    //-----------------------------------------------------------------------------
    // 2. 静默领取：领取所有已完成派遣的奖励（无UI反馈）
    //-----------------------------------------------------------------------------
    Game_System.prototype.claimAllCompletedDispatchesSilently = function() {
        const dispatches = this.getDispatches();
        let anyClaimed = false;
        for (const dispatch of dispatches) {
            if (!dispatch.claimed && Date.now() >= dispatch.endTime) {
                this._processDispatchRewardsSilently(dispatch);
                dispatch.claimed = true;
                anyClaimed = true;

                // 保存派遣记录（原插件逻辑）
                for (const actorId of dispatch.actorIds) {
                    const teammatesIds = dispatch.actorIds.filter(id => id !== actorId);
                    this.sora.一键派遣信息保存[actorId] = {
                        locationId: dispatch.locationId,
                        teammatesIds: teammatesIds
                    };
                }
            }
        }
        return anyClaimed;
    };

    // 内部方法：处理单个派遣的奖励发放（不依赖UI）
    Game_System.prototype._processDispatchRewardsSilently = function(dispatch) {
        const location = getLocationDataById(dispatch.locationId);
        if (!location || !location.rewardPool) return;

        const rewardPool = JSON.parse(location.rewardPool);
        const rolls = dispatch.duration;
        const finalRewards = { gold: 0, items: {}, weapons: {}, armors: {} };

        try {
            for (let i = 0; i < rolls; i++) {
                // 金钱
                if (rewardPool.gold) {
                    const goldData = JSON.parse(rewardPool.gold);
                    if (Math.random() * 100 < Number(goldData.probability || 0)) {
                        finalRewards.gold += getRandomInt(Number(goldData.min), Number(goldData.max));
                    }
                }
                // 物品
                if (rewardPool.items) {
                    const itemPool = JSON.parse(rewardPool.items).map(s => JSON.parse(s));
                    itemPool.forEach(item => {
                        if (Math.random() * 100 < Number(item.probability || 0)) {
                            const amount = getRandomInt(Number(item.min), Number(item.max));
                            finalRewards.items[item.id] = (finalRewards.items[item.id] || 0) + amount;
                        }
                    });
                }
                // 武器
                if (rewardPool.weapons) {
                    const weaponPool = JSON.parse(rewardPool.weapons).map(s => JSON.parse(s));
                    weaponPool.forEach(wep => {
                        if (Math.random() * 100 < Number(wep.probability || 0)) {
                            const amount = getRandomInt(Number(wep.min), Number(wep.max));
                            finalRewards.weapons[wep.id] = (finalRewards.weapons[wep.id] || 0) + amount;
                        }
                    });
                }
                // 护甲
                if (rewardPool.armors) {
                    const armorPool = JSON.parse(rewardPool.armors).map(s => JSON.parse(s));
                    armorPool.forEach(arm => {
                        if (Math.random() * 100 < Number(arm.probability || 0)) {
                            const amount = getRandomInt(Number(arm.min), Number(arm.max));
                            finalRewards.armors[arm.id] = (finalRewards.armors[arm.id] || 0) + amount;
                        }
                    });
                }
            }

            // 实际发放奖励
            if (finalRewards.gold > 0) $gameParty.gainGold(finalRewards.gold);
            for (const id in finalRewards.items) {
                if (finalRewards.items[id] > 0) $gameParty.gainItem($dataItems[id], finalRewards.items[id]);
            }
            for (const id in finalRewards.weapons) {
                if (finalRewards.weapons[id] > 0) $gameParty.gainItem($dataWeapons[id], finalRewards.weapons[id]);
            }
            for (const id in finalRewards.armors) {
                if (finalRewards.armors[id] > 0) $gameParty.gainItem($dataArmors[id], finalRewards.armors[id]);
            }
        } catch (e) {
            console.error("AutoDispatch: 奖励处理出错", e);
        }
    };

    //-----------------------------------------------------------------------------
    // 3. 静默派遣：按照上次配置派遣所有符合条件的队伍（无UI反馈）
    //-----------------------------------------------------------------------------
    Game_System.prototype.repeatLastDispatchIfPossibleSilently = function() {
        const duration = this.dispatchDefaultDuration();
        if (!duration) return false;

        const actorConfigs = this.sora.一键派遣信息保存 || {};
        if (Object.keys(actorConfigs).length === 0) return false;

        // 获取当前所有真正闲置的角色
        const availableActors = new Set($gameParty.members()
            .filter(actor => !actor.actor().meta.助战 && !$gameParty.isActorOnDispatch(actor.actorId()))
            .map(a => a.actorId()));

        // 提取唯一的队伍记录（防止重复）
        const seenActors = new Set();
        const uniqueSavedTeams = [];
        for (const aId in actorConfigs) {
            const actorId = Number(aId);
            if (seenActors.has(actorId)) continue;
            const config = actorConfigs[aId];
            const teamIds = [actorId, ...config.teammatesIds];
            uniqueSavedTeams.push({ locationId: config.locationId, actorIds: teamIds });
            teamIds.forEach(id => seenActors.add(id));
        }

        const processedActors = new Set();
        let anyDispatched = false;

        for (const team of uniqueSavedTeams) {
            const location = getLocationDataById(team.locationId);
            if (!location || !isLocationUnlocked(location)) continue;

            // 检查地点队伍上限
            const dispatchesForLoc = this.getDispatches().filter(d => !d.claimed && d.locationId === location.id);
            if (dispatchesForLoc.length >= MAX_DISPATCH_TEAMS_PER_LOCATION) continue;

            // 检查全员是否可用且未被本次循环占用
            const isTeamReady = team.actorIds.every(id => availableActors.has(id) && !processedActors.has(id));
            if (!isTeamReady) continue;

            // 检查战力
            const requiredPower = (() => {
                const match = location.requirementText?.match(/\d+/);
                return match ? parseInt(match[0], 10) : 0;
            })();
            const totalPower = team.actorIds.reduce((sum, id) => sum + getActorPower($gameActors.actor(id)), 0);
            if (totalPower < requiredPower) continue;

            // 执行派遣
            this.addDispatch(team.locationId, team.actorIds, duration);
            team.actorIds.forEach(id => processedActors.add(id));
            anyDispatched = true;
        }

        return anyDispatched;
    };

    //-----------------------------------------------------------------------------
    // 4. 场景地图后台更新：定时器驱动自动收派
    //-----------------------------------------------------------------------------
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        this._updateAutoDispatch();
    };

    Scene_Map.prototype._updateAutoDispatch = function() {
        if (!$gameSystem.isAutoDispatchEnabled()) return;
        if (this._autoDispatching) return; // 防止重入

        const nextTime = $gameSystem.sora._nextAutoCheckTime;
        if (!nextTime) return;

        if (Date.now() >= nextTime) {
            this._autoDispatching = true;
            try {
                // 1. 静默领取
                $gameSystem.claimAllCompletedDispatchesSilently();
                // 2. 静默派遣
                const dispatched = $gameSystem.repeatLastDispatchIfPossibleSilently();
                // 3. 重新计算下次检查时间
                $gameSystem.recalculateNextAutoCheckTime();
                // 如果派遣失败且没有新的待完成派遣，自动关闭开关
                if (!dispatched && $gameSystem.sora._nextAutoCheckTime === null) {
                    $gameSystem.setAutoDispatchEnabled(false);
                }
            } finally {
                this._autoDispatching = false;
            }
        }
    };

    // 执行一轮自动收派（供手动调用）
    function performAutoCycle() {
        if (!$gameSystem.isAutoDispatchEnabled()) return;
        // 领取所有已完成奖励
        $gameSystem.claimAllCompletedDispatchesSilently();
        // 尝试派遣
        const dispatched = $gameSystem.repeatLastDispatchIfPossibleSilently();
        // 重新计算下次时间
        $gameSystem.recalculateNextAutoCheckTime();
        // 如果派遣失败且没有待完成的派遣，关闭开关
        if (!dispatched && $gameSystem.sora._nextAutoCheckTime === null) {
            $gameSystem.setAutoDispatchEnabled(false);
        }
    }

    //-----------------------------------------------------------------------------
    // 5. 派遣界面劫持：添加切换按钮，并在手动操作后刷新调度
    //-----------------------------------------------------------------------------
    const _Scene_Dispatch_create = Scene_Dispatch.prototype.create;
    Scene_Dispatch.prototype.create = function() {
        _Scene_Dispatch_create.call(this);
        this.createAutoSwitchWindow();
        // 每次打开界面时，同步调度时间
        $gameSystem.recalculateNextAutoCheckTime();
    };

    Scene_Dispatch.prototype.createAutoSwitchWindow = function() {
        const w = 150;
        const h = this.calcWindowHeight(1, true);
        const x = Graphics.boxWidth - w - 20;
        const y = 60;
        const rect = new Rectangle(x, y, w, h);
        this._autoSwitchWindow = new Window_AutoDispatchSwitch(rect);
        this.addWindow(this._autoSwitchWindow);
    };

    // 劫持手动领取和派遣，以便刷新调度时间
    const _Scene_Dispatch_onClaimAllRewards = Scene_Dispatch.prototype.onClaimAllRewards;
    Scene_Dispatch.prototype.onClaimAllRewards = function() {
        _Scene_Dispatch_onClaimAllRewards.call(this);
        $gameSystem.recalculateNextAutoCheckTime();
    };

    const _Scene_Dispatch_onRepeatLastDispatch = Scene_Dispatch.prototype.onRepeatLastDispatch;
    Scene_Dispatch.prototype.onRepeatLastDispatch = function() {
        _Scene_Dispatch_onRepeatLastDispatch.call(this);
        $gameSystem.recalculateNextAutoCheckTime();
    };

    const _Scene_Dispatch_onConfirmOk = Scene_Dispatch.prototype.onConfirmOk;
    Scene_Dispatch.prototype.onConfirmOk = function() {
        _Scene_Dispatch_onConfirmOk.call(this);
        $gameSystem.recalculateNextAutoCheckTime();
    };

    //-----------------------------------------------------------------------------
    // 6. 读档后立即执行一轮自动收派（v1.1.0 新增）
    //-----------------------------------------------------------------------------
    const _Scene_Load_onLoadSuccess = Scene_Load.prototype.onLoadSuccess;
    Scene_Load.prototype.onLoadSuccess = function() {
        _Scene_Load_onLoadSuccess.call(this);
        if ($gameSystem.isAutoDispatchEnabled()) {
            // 先重新计算时间
            $gameSystem.recalculateNextAutoCheckTime();
            // 立即执行一轮自动收派（因为读档时可能已有派遣完成）
            performAutoCycle();
        }
    };

    //-----------------------------------------------------------------------------
    // 7. 自定义切换按钮窗口（v1.1.0 增加时长检查与提示）
    //-----------------------------------------------------------------------------
    class Window_AutoDispatchSwitch extends Window_Command {
        initialize(rect) {
            super.initialize(rect);
            this.opacity = 255;
            this.refresh();
            this.setHandler('ok', this.onToggle.bind(this));
        }

        makeCommandList() {
            const hasDuration = !!$gameSystem.dispatchDefaultDuration();
            const enabled = $gameSystem.isAutoDispatchEnabled();
            let text;
            if (!hasDuration) {
                text = '未设置默认时长';
            } else {
                text = enabled ? '自动收派 ON' : '自动收派 OFF';
            }
            this.addCommand(text, 'toggle', hasDuration);
        }

        onToggle() {
            const hasDuration = !!$gameSystem.dispatchDefaultDuration();
            if (!hasDuration) {
                SoundManager.playBuzzer();
                // 显示提示文字
                const scene = SceneManager._scene;
                if (scene && scene._actorHelpWindow) {
                    scene._actorHelpWindow.setText('请先设置派遣默认时长！');
                } else {
                    // 备用：使用顶部通知（如果有的话）
                    console.warn('AutoDispatch: 请先设置派遣默认时长。');
                }
                this.activate();
                return;
            }

            const newState = !$gameSystem.isAutoDispatchEnabled();
            const success = $gameSystem.setAutoDispatchEnabled(newState);
            if (success) {
                SoundManager.playCursor();
                this.refresh();
            } else {
                SoundManager.playBuzzer();
            }
        }

        drawItem(index) {
            const rect = this.itemLineRect(index);
            const hasDuration = !!$gameSystem.dispatchDefaultDuration();
            const enabled = $gameSystem.isAutoDispatchEnabled();

            // 背景色
            if (!hasDuration) {
                // 不可用状态：灰色背景
                this.contents.fillRect(rect.x, rect.y, rect.width, rect.height, ColorManager.gaugeBackColor());
            } else if (enabled) {
                this.contents.fillRect(rect.x, rect.y, rect.width, rect.height, 'rgba(144, 238, 144, 0.5)');
            } else {
                this.contents.fillRect(rect.x, rect.y, rect.width, rect.height, ColorManager.gaugeBackColor());
            }

            // 文字居中
            this.resetTextColor();
            if (!hasDuration) {
                this.changeTextColor(ColorManager.textColor(8)); // 灰色文字
            }
            this.drawText(this.commandName(index), rect.x, rect.y, rect.width, 'center');
            this.resetTextColor();
        }

        // 确保不可用的命令不能被选择
        isCurrentItemEnabled() {
            return !!$gameSystem.dispatchDefaultDuration();
        }
    }

})();