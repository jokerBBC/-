/*:
 * @target MZ
 * @plugindesc [Patch] 种植系统强化 & 农场快速传送 (独立补丁版)
 * @author Gemini原作/joker魔改创意 / Deepseek魔改代码 / GLM独立化
 * @help
 * 需放在原版《J_PlantSystem.js》下方加载。
 * 1. 一个精灵可以收种4块地。
 * 2. 优化部分提示文案。
 * 3. 新增左下角农场往返快速传送按钮。
 * 
 * bug：可以不买后面的精灵的一键种田功能，但有利于玩家不改了。
 * 
 * 不喜欢手搓的丑陋图标可自行替换，尺寸、命名与插件一致即可。
 * 图片请放置于：/js/mods/img/ 目录下。
 */
(() => {
    "use strict";
    const pluginName = "J_PlantSystem";

    // =========================================================================
    // [内部依赖提取区] 为了脱离原插件闭包且不引发状态隔离，本地化必须的工具
    // =========================================================================
    const getPlantData = (mapId, eventId) => {
        if (!$gameSystem._plantDataStorage) $gameSystem._plantDataStorage = {};
        return $gameSystem._plantDataStorage[`${mapId}_${eventId}`] || null;
    };

    const savePlantData = (mapId, eventId, data) => {
        if (!$gameSystem._plantDataStorage) $gameSystem._plantDataStorage = {};
        $gameSystem._plantDataStorage[`${mapId}_${eventId}`] = data;
    };

    class PlantParser {
        static parse(item) {
            if (!item || !item.note || !item.note.includes("<种植系统>")) return null;
            const match = item.note.match(/<种植系统>([\s\S]*?)<\/种植系统>/);
            if (!match) return null;
            const content = match[1];
            const time = parseInt(content.match(/时间:(\d+)/)?.[1] || 0);
            const gainStr = content.match(/获得:(.*)/)?.[1] || "";
            const rewards = gainStr.split(',').filter(s => s.trim()).map(s => {
                const parts = s.trim().split(/\s+/);
                const id = parseInt(parts[0].substring(1));
                const range = parts[1].split('-');
                return { id, min: parseInt(range[0]), max: parseInt(range[1] || range[0]), prob: parseInt(parts[2]) };
            });
            return { time, rewards };
        }
    }

    // =========================================================================
    // [必须重写] 原插件的窗口类被其 IIFE 封闭，补丁必须独立声明一份才能 new
    // =========================================================================
    class Window_FarmAction extends Window_Command {
        constructor(rect) {
            super(rect);
        }
        makeCommandList() {
            this.addCommand("一键种植", "plant");
            this.addCommand("一键收获", "harvest");
            this.addCommand("取消", "cancel");
        }
    }

    class Window_SeedSelect extends Window_Selectable {
        constructor(rect) {
            super(rect);
            this._data = $gameParty.items().filter(item => PlantParser.parse(item));
            this.refresh();
            this.activate();
            this.select(0);
        }
        maxItems() {
            return this._data ? this._data.length : 0;
        }
        item() {
            return this._data[this.index()];
        }
        drawItem(index) {
            const item = this._data[index];
            if (item) {
                const rect = this.itemLineRect(index);
                this.resetTextColor();
                this.drawIcon(item.iconIndex, rect.x, rect.y);
                this.drawText(item.name, rect.x + 40, rect.y, rect.width - 120);
                const count = $gameParty.numItems(item);
                this.drawText("×" + count, rect.x, rect.y, rect.width - 8, "right");
            }
        }
    }

    // =========================================================================
    // [差异 1] 重写 massAction 指令 (去除 farmIndex 依赖，优化提示语)
    // =========================================================================
    PluginManager.registerCommand(pluginName, "massAction", args => {
        const targets = $gameMap.events().filter(ev => {
            if (ev && ev.page()) {
                const list = ev.page().list;
                return list && list.some(cmd => (cmd.code === 108 || cmd.code === 408) && cmd.parameters[0].includes("<农田"));
            }
            return false;
        });
        if (targets.length === 0) return;

        const rect = new Rectangle((Graphics.boxWidth - 200) / 2, (Graphics.boxHeight - 160) / 2, 200, 160);
        const actionWin = new Window_FarmAction(rect);
        SceneManager._scene._farmActionWindow = actionWin;
        SceneManager._scene.addChild(actionWin);

        actionWin.setHandler('plant', () => {
            const emptyPlots = targets.filter(ev => !$gameSelfSwitches.value([$gameMap.mapId(), ev._eventId, 'A']));
            closeFarmWindow(actionWin, '_farmActionWindow');
            if (emptyPlots.length === 0) {
                $gameMessage.add("所有的农田目前都有作物在生长。");
            } else {
                openMassPlantWindow(emptyPlots);
            }
        });

        actionWin.setHandler('harvest', () => {
            let harvestCount = 0;
            let cleanCount = 0;
            targets.forEach(ev => {
                const mapId = $gameMap.mapId();
                const keyA = [mapId, ev._eventId, 'A'];
                const keyB = [mapId, ev._eventId, 'B'];
                const plantData = getPlantData(mapId, ev._eventId);
                if ($gameSelfSwitches.value(keyB)) {
                    ev.performHarvest(keyA, keyB);
                    harvestCount++;
                } else if ($gameSelfSwitches.value(keyA) && !plantData) {
                    ev.forceResetFarm(keyA, keyB);
                    cleanCount++;
                }
            });
            if (harvestCount > 0) $gameMessage.add(`批量收获了 ${harvestCount} 处作物。`);
            else if (cleanCount === 0) $gameMessage.add("目前没有可以收获的农作物。");
            if (cleanCount > 0) $gameMessage.add(`清理了 ${cleanCount} 处异常农田。`);
            closeFarmWindow(actionWin, '_farmActionWindow');
        });

        actionWin.setHandler('cancel', () => {
            closeFarmWindow(actionWin, '_farmActionWindow');
        });
    });

    function closeFarmWindow(win, propertyName) {
        if (win) {
            win.close();
            SceneManager._scene.removeChild(win);
            if (propertyName) SceneManager._scene[propertyName] = null;
        }
    }

    function openMassPlantWindow(plotList) {
        const seeds = $gameParty.items().filter(item => PlantParser.parse(item));
        if (seeds.length === 0) {
            $gameMessage.add("包裹里没有可用的种子。");
            return;
        }
        const rect = new Rectangle((Graphics.boxWidth - 400) / 2, (Graphics.boxHeight - 280) / 2, 400, 280);
        const seedWin = new Window_SeedSelect(rect);
        SceneManager._scene._seedWindow = seedWin;
        SceneManager._scene.addChild(seedWin);

        seedWin.setHandler('ok', () => {
            const item = seedWin.item();
            if (item) {
                const config = PlantParser.parse(item);
                const canPlantCount = Math.min($gameParty.numItems(item), plotList.length);
                $gameParty.loseItem(item, canPlantCount);
                const now = Date.now();
                for (let i = 0; i < canPlantCount; i++) {
                    const ev = plotList[i];
                    savePlantData($gameMap.mapId(), ev._eventId, {
                        matureTime: now + (config.time * 1000),
                        plantingData: config
                    });
                    $gameSelfSwitches.setValue([$gameMap.mapId(), ev._eventId, 'A'], true);
                }
                $gameMap.requestRefresh();
                $gameMessage.add(`成功播种了 ${canPlantCount} 份 ${item.name}。`);
            }
            closeFarmWindow(seedWin, '_seedWindow');
        });

        seedWin.setHandler('cancel', () => {
            closeFarmWindow(seedWin, '_seedWindow');
        });
    }

    // =========================================================================
    // [差异 2] 新增独立功能：农场快速传送按钮
    // =========================================================================
    const FARM_CONFIG = {
        mapId: 27,
        folder: "js/mods/img/",
        icons: { toFarm: "农场1", backHome: "返回原地" },
        farmPoint: { x: 10, y: 4 }
    };

    window._farmTravelData = window._farmTravelData || { origin: { mapId: 0, x: 0, y: 0 } };

    const _Scene_Map_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
    Scene_Map.prototype.createDisplayObjects = function() {
        _Scene_Map_createDisplayObjects.call(this);
        this.createFarmCycleButton();
    };

    Scene_Map.prototype.createFarmCycleButton = function() {
        this._farmBtn = new Sprite_Clickable();
        this._farmBtn.x = 20;
        this._farmBtn.y = Graphics.boxHeight - 120;

        this._farmBtn.refreshImage = function() {
            const currentMapId = $gameMap.mapId();
            const fileName = (currentMapId === FARM_CONFIG.mapId) ? FARM_CONFIG.icons.backHome : FARM_CONFIG.icons.toFarm;
            this.bitmap = ImageManager.loadBitmap(FARM_CONFIG.folder, fileName);
        };
        this._farmBtn.refreshImage();

        this._farmBtn.onClick = () => {
            const currentMapId = $gameMap.mapId();
            const data = window._farmTravelData;
            if (currentMapId !== FARM_CONFIG.mapId) {
                SoundManager.playOk();
                data.origin.mapId = currentMapId;
                data.origin.x = $gamePlayer.x;
                data.origin.y = $gamePlayer.y;
                $gamePlayer.reserveTransfer(FARM_CONFIG.mapId, FARM_CONFIG.farmPoint.x, FARM_CONFIG.farmPoint.y, 2, 0);
            } else {
                if (data.origin.mapId > 0) {
                    SoundManager.playCancel();
                    $gamePlayer.reserveTransfer(data.origin.mapId, data.origin.x, data.origin.y, 2, 0);
                } else {
                    $gameMessage.add("未找到返回坐标，已尝试紧急撤回。");
                    $gamePlayer.reserveTransfer(1, 10, 10, 2, 0);
                }
            }
        };
        this.addChild(this._farmBtn);
    };
})();
