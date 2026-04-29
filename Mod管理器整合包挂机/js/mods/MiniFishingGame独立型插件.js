/*:
 * @target MZ
 * @plugindesc [Patch] 钓鱼系统优化 - 2倍速与倍率结算 (独立补丁版)
 * @author joker创意 / ChatGPT / Claude 3.5 Sonnet
 * @help
 * 需放在原版《MiniFishingGame.js》下方加载。
 * 1. 抛竿等待时间缩短至 1~2 秒。
 * 2. 判定进度速度提升为 2 倍。（通过减半进度条实现）
 * 3. 结算面板消失加速（1秒）。
 * 4. 手动钓鱼引入 1/7/77/777 倍率机制，按当前鱼饵存量限制最高倍率。
 * 5. 手动钓鱼综合暴击收益为60倍左右
 */

(() => {
    "use strict";
    
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        // 实例化拦截：仅在钓鱼界面被创建且未被补丁时执行一次
        if (this.MiniFishingGame && !this.MiniFishingGame._patched) {
            const inst = this.MiniFishingGame;
            inst._patched = true;

            // 【关键修复】在外部提前把原版的大脑(update)偷偷存起来，防止结束后丢失
            const _origInstUpdate = inst.update.bind(inst);

            // --- 差异 1: 缩短抛竿等待时间 ---
            inst.startThrowing = function() {
                this.selectFish();
                const delaySec = 1 + Math.random() * 1; 
                this._biteDelay = Math.floor(delaySec * 60);
                this._biteReady = false;
                this.createBobberOnly();
            };

            // --- 差异 2: 进度条2倍速 ---
            const _origSelectFish = inst.selectFish.bind(inst);
            inst.selectFish = function() {
                _origSelectFish();
                if (this._params && this._params.fish) {
                    this._params.fish.holdTime = Math.ceil(this._params.fish.holdTime / 2);
                }
            };

            // --- 差异 3: 倍率系统与结算逻辑重写 ---
            inst._finish = function(success) {
                const saveSlot = $gameVariables.value(4);
                if (saveSlot > 0) {
                    DataManager.saveGame(saveSlot);
                    console.log("钓鱼结束：已自动保存至存档点 " + saveSlot);
                }
                this._stopLoopSe();
                this._stopLooseBgs();
                this._finished = true;
                const p = this._params;
                this._rodInfoWindow.active = true;
                this._baitInfoWindow.active = true;

                // ------------------------------
                // 倍率计算（仅手动钓鱼且成功）
                // ------------------------------
                let multiplier = 1;
                const baitId = $gameSystem.sora?.当前鱼饵;
                const baitItem = baitId ? $dataItems[baitId] : null;
                const baitCount = baitItem ? $gameParty.numItems(baitItem) : 0;

                if (success && !this._autoEnabled) {
                    const rand = Math.random();
                    if (rand < 0.0777) {
                        multiplier = 777;
                    } else if (rand < 0.0777 + 0.077) {
                        multiplier = 77;
                    } else if (rand < 0.0777 + 0.077 + 0.07) {
                        multiplier = 7;
                    } else {
                        multiplier = 1;
                    }

                    if (baitCount >= 777) {
                        // 可触发任意倍率
                    } else if (baitCount >= 77) {
                        if (multiplier === 777) multiplier = 77;
                    } else if (baitCount >= 7) {
                        if (multiplier >= 77) multiplier = 7;
                    } else {
                        multiplier = 1;
                    }
                    multiplier = Math.min(multiplier, baitCount);
                }

                if (success) {
                    const itemCount = this._autoEnabled ? 1 : multiplier;
                    $gameParty.gainItem($dataItems[p.fish.itemId], itemCount);
                }

                if (baitId) {
                    const baitCost = this._autoEnabled ? 1 : multiplier;
                    $gameParty.loseItem(baitItem, baitCost);
                }

                if (success && typeof p.fish.exp === "number") {
                    const oldExp = $gameVariables.value(12) || 0;
                    const oldLevel = $gameVariables.value(13) || 1;
                    const expGain = this._autoEnabled ? p.fish.exp : p.fish.exp * multiplier;
                    const newExp = oldExp + expGain;
                    $gameVariables.setValue(12, newExp);

                    let newLevel = oldLevel;
                    const maxFishingLevel = 30;
                    const levelExpTable = JSON.parse(PluginManager.parameters("MiniFishingGame").levelExpTable || "[]").map(Number);
                    while ( newLevel < maxFishingLevel && levelExpTable[newLevel] !== undefined && newExp >= levelExpTable[newLevel] ) {
                        newLevel++;
                    }
                    if (newLevel !== oldLevel) {
                        $gameVariables.setValue(13, newLevel);
                    }
                }

                if (success && p.successSe) this._playSe(p.successSe);
                if (!success && p.failSe) this._playSe(p.failSe);

                // 判定区域居中提示框绘制
                const zoneLeft = this._zone.x;
                const zoneTop = this._zone.y;
                const zoneWidth = this._params.barWidth;
                const zoneHeight = this._zone.height;
                const zoneCenterX = zoneLeft + zoneWidth / 2;
                const tempBitmap = new Bitmap(1, 1);
                let msgWidth, msgHeight;
                const padding = 24;
                msgHeight = 60;
                let msg;

                if (success) {
                    const item = $dataItems[p.fish.itemId];
                    const iconIndex = item.iconIndex;
                    const colorIndex = Number(item.textColor) || 0;
                    const prefix = "你钓到了 ";
                    const name = item.name;
                    const suffix = "！";
                    const prefixW = tempBitmap.measureTextWidth(prefix);
                    const nameW = tempBitmap.measureTextWidth(name);
                    const suffixW = tempBitmap.measureTextWidth(suffix);
                    const iconSize = 32;
                    const gap = 6;
                    const textBlockW = prefixW + nameW + suffixW;
                    const totalW = iconSize + gap + textBlockW;
                    msgWidth = Math.max(120, totalW + padding);

                    msg = new Sprite(new Bitmap(msgWidth, msgHeight));
                    msg.x = Math.round(zoneCenterX - msgWidth / 2);
                    msg.y = Math.round(zoneTop + zoneHeight / 2 - msgHeight / 2);
                    msg.bitmap.fillRect(0, 0, msgWidth, msgHeight, "rgba(0,0,0,0.6)");

                    const startX = Math.round((msgWidth - totalW) / 2);
                    const iconX = startX;
                    const iconY = Math.round((msgHeight - iconSize) / 2);
                    const textX = iconX + iconSize + gap;
                    const textY = 0;

                    this.drawIconToBitmap(msg.bitmap, iconIndex, iconX, iconY);
                    msg.bitmap.drawText(prefix, textX, textY, prefixW, msgHeight, "left");
                    const oldColor = msg.bitmap.textColor;
                    msg.bitmap.textColor = ColorManager.textColor(colorIndex);
                    msg.bitmap.drawText(name, textX + prefixW, textY, nameW, msgHeight, "left");
                    msg.bitmap.textColor = oldColor;
                    msg.bitmap.drawText(suffix, textX + prefixW + nameW, textY, suffixW, msgHeight, "left");
                } else {
                    const text = "鱼儿逃走了...";
                    const textW = tempBitmap.measureTextWidth(text);
                    msgWidth = Math.max(120, textW + padding);
                    msg = new Sprite(new Bitmap(msgWidth, msgHeight));
                    msg.x = Math.round(zoneCenterX - msgWidth / 2);
                    msg.y = Math.round(zoneTop + zoneHeight / 2 - msgHeight / 2);
                    msg.bitmap.fillRect(0, 0, msgWidth, msgHeight, "rgba(0,0,0,0.6)");
                    msg.bitmap.drawText(text, 0, 0, msgWidth, msgHeight, "center");
                }

                this.addChild(msg);
                this._finishTimer = 60; 

                this.update = () => {
                    this._finishTimer--;
                    if (this._finishTimer <= 0) {
                        if (msg.parent) this.removeChild(msg);
                        this._cleanupAfterFishing();
                        for (const p of this._particles) {
                            if (p.parent) this.removeChild(p);
                        }
                        this._particles = [];
                        this._progressBar.bitmap.clear();
                        this._fishingStarted = false;
                        this._fishingElementsCreated = false;
                        this._finished = false;
                        this._progress = 0;
                        this._timer = 0;
                        this._timeout = 0;
                        this._zoneVel = 0;
                        this._zoneMoveTimer = 0;
                        this._lastInZone = false;
                        this._collectButton.visible = false;
                        this._throwButton.visible = true;
                        this._baitInfoWindow.refresh();
                        
                        // 【关键修复】完美恢复原版 update，彻底解决二次抛竿卡死问题
                        this.update = _origInstUpdate;
                    }
                };
                $gameTemp._forceNoFish = false;
            };
        }
        _Scene_Map_update.call(this);
    };
})();
