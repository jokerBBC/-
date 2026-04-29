//=============================================================================
// 强化界面UI独立插件型魔改.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc 强化自选词条魔改补丁
 * @author 玩家joker&deepseek专家模式 原作sora
 * @help
 * 此插件必须放在《强化界面UI》插件下方。
 * 功能：添加自选词条循环切换按钮。
 * 自选强化+3+6+9+12+15时消耗10倍资源。
 */

(() => {
    'use strict';

    // 等待原插件核心类加载完成（最多等待10秒）
    const CHECK_INTERVAL = 50;
    let attempts = 0;
    const MAX_ATTEMPTS = 200; // 10秒

    const waitForOriginalPlugin = setInterval(() => {
        attempts++;
        
        // 检查关键类和方法是否存在
        if (typeof sora !== 'undefined' && 
            typeof sora.强化插件 !== 'undefined' &&
            typeof sora.强化插件.prototype.创建背景图片 === 'function') {
            
            clearInterval(waitForOriginalPlugin);
            applyPatch();
            console.log('[强化自选魔改] 补丁已成功应用');
        } else if (attempts >= MAX_ATTEMPTS) {
            clearInterval(waitForOriginalPlugin);
            console.warn('[强化自选魔改] 等待超时，原插件可能未加载或版本不兼容');
        }
    }, CHECK_INTERVAL);

    function applyPatch() {
        // ========== 复制原插件局部函数（保证可用） ==========
        function 强化_确保顺序与孔位计次(item) {
            if (!item) return;
            item.sora ||= {};
            item.params ||= Array.isArray(item.params) ? item.params : new Array(8).fill(0);
            item.traits ||= [];
            if (!Array.isArray(item.sora._uiOrder) || item.sora._uiOrder.length === 0) {
                const order = [];
                const 读宝 = (pid) => Number(item?.sora?.镶嵌固定属性?.[pid]) || 0;
                for (let pid = 0; pid < item.params.length; pid++) {
                    const base = Number(item.params[pid]) || 0;
                    if (base - 读宝(pid) > 0)
                        order.push({ kind: 'fixed', paramId: pid });
                }
                const seen = Object.create(null);
                (item.traits || []).forEach(t => {
                    if (!t || t.主属性 || t.xiangqian === true) return;
                    if (t.code !== 21 && t.code !== 22) return;
                    const k = `${t.code}-${t.dataId}`;
                    if (!seen[k]) {
                        seen[k] = true;
                        order.push({ kind: 'percent', key: k });
                    }
                });
                item.sora._uiOrder = order;
            }
            item.sora.重铸计次 ||= { slot: [] };
            if (!Array.isArray(item.sora.重铸计次.slot))
                item.sora.重铸计次.slot = [];
            for (let i = 0; i < item.sora._uiOrder.length; i++) {
                if (item.sora.重铸计次.slot[i] == null)
                    item.sora.重铸计次.slot[i] = 0;
            }
        }

        // ========== 保存原始方法引用 ==========
        const _原创建背景图片 = sora.强化插件.prototype.创建背景图片;
        const _原toggleUIActive = sora.强化插件.prototype.toggleUIActive;

        // ========== ① 创建自选词条循环切换按钮 ==========
        sora.强化插件.prototype.创建背景图片 = function() {
            _原创建背景图片.call(this);

            this._自选词条索引 = 0; // 0=关闭, 1~4=副词条1~4

            this.背景图片.自选词条按钮 = new Sprite_Clickable();
            this.setupCodeButton(this.背景图片.自选词条按钮, 775, 620, 160, 50, "关闭自选", "#888888");
            this.addChild(this.背景图片.自选词条按钮);

            this.背景图片.自选词条按钮.onClick = () => {
                const oldIdx = this._自选词条索引;
                this._自选词条索引 = (this._自选词条索引 + 1) % 5;
                const idx = this._自选词条索引;
                const labels = ["关闭自选", "副词条1", "副词条2", "副词条3", "副词条4"];
                const color = idx === 0 ? "#888888" : "#3498db";
                this.setupCodeButton(this.背景图片.自选词条按钮, 775, 620, 160, 50, labels[idx], color);
                SoundManager.playOk();

                // ③ 从"关闭自选"切换到"副词条1"时弹框提示
                if (oldIdx === 0 && idx === 1 && !ConfigManager._不再提示自选强化) {
                    this._显示自选提示弹框();
                }
            };
        };

        // ========== toggleUIActive 增加自选按钮控制 ==========
        sora.强化插件.prototype.toggleUIActive = function(active) {
            _原toggleUIActive.call(this, active);
            if (this.背景图片 && this.背景图片.自选词条按钮) {
                this.背景图片.自选词条按钮.active = active;
            }
        };

        // ========== ② 覆盖执行强化逻辑 ==========
        sora.强化插件.prototype.执行强化逻辑 = function() {
            const displayedItem = this.背包窗口.选中装备;
            if (!displayedItem) return;
            const item = displayedItem;
            const 等级 = item.equipRequirements?.atLeast?.[8] || 1;

            if (item.sora?.当前强化等级 < item.sora?.最大强化等级) {
                const 当前强化 = item.sora.当前强化等级;

                let 基础消耗 = 0;
                let 消耗材料 = 18;

                if ([7, 8, 9].includes(item.etypeId)) {
                    消耗材料 = 54;
                    if (当前强化 <= 3) 基础消耗 = 1;
                    else if (当前强化 <= 6) 基础消耗 = 2;
                    else if (当前强化 <= 9) 基础消耗 = 3;
                    else if (当前强化 <= 12) 基础消耗 = 4;
                    else 基础消耗 = 5;
                } else {
                    if (当前强化 <= 2) 基础消耗 = 2 + Math.floor(等级 / 10) * 2;
                    else if (当前强化 <= 5) 基础消耗 = 4 + Math.floor(等级 / 10) * 3;
                    else if (当前强化 <= 8) 基础消耗 = 6 + Math.floor(等级 / 10) * 5;
                    else if (当前强化 <= 11) 基础消耗 = 8 + Math.floor(等级 / 10) * 6;
                    else 基础消耗 = 10 + Math.floor(等级 / 10) * 10;
                }

                let 消耗货币 = item.equipRequirements.atLeast[8] * 5 * (item.sora.当前强化等级 + 1);

                // ★ 自选词条10倍价格判定 ★
                const _是自选模式 = this._自选词条索引 > 0 && item.etypeId < 7;
                let _自选生效 = false;
                if (_是自选模式 && (当前强化 + 1) % 3 === 0) {
                    this.背包窗口.ensureInitRecordFromItem(item);
                    if (this.背包窗口.getInitAttrCount(item) >= 4) {
                        _自选生效 = true;
                        基础消耗 *= 10;
                        消耗货币 *= 10;
                    }
                }

                if ($gameParty.numItems($dataItems[消耗材料]) >= 基础消耗 && $gameParty.gold() >= 消耗货币) {
                    const _beforeSnap = this.背包窗口._makeSnapshot(item);
                    $gameParty.loseItem($dataItems[消耗材料], 基础消耗);
                    $gameParty.gainGold(-消耗货币);
                    item.sora.当前强化等级 += 1;
                    if (item.sora.当前强化等级 >= item.sora.最大强化等级) {
                        item.sora.装备锁定 = true;
                    }
                    AudioManager.playSe({ name: 'Item2', volume: 100, pitch: 100, pan: 0 });

                    // 主属性逻辑（原版不变）
                    if (item.sora?.主属性) {
                        const 主属性 = item.sora.主属性;
                        const id = 主属性?.属性ID;
                        const 强化分母 = (item.etypeId === 7) ? 30 : 15;
                        const _realRatio = Math.pow(2, item.sora.当前强化等级 / 强化分母);

                        if (主属性.属性类型 === "固定属性") {
                            主属性.强化加成 ??= 0;
                            const 最初值 = item.sora.主属性.最初属性值 || 0;
                            const 应有总固定加成 = Math.round(最初值 * _realRatio) - 最初值;
                            const 增加值 = 应有总固定加成 - 主属性.强化加成;
                            if (增加值 !== 0) {
                                item.sora.主属性.强化加成 = 应有总固定加成;
                                item.params[id] += 增加值;
                            }
                        } else if (主属性.属性类型 === "百分比属性") {
                            const 属性 = item.traits.find(t => t.主属性);
                            if (属性) {
                                if (主属性.最初属性值 === undefined) 主属性.最初属性值 = 属性.value;
                                if (属性.code === 21) {
                                    属性.value = Math.round((1 + ((主属性.最初属性值 - 1) * _realRatio)) * 1000) / 1000;
                                } else {
                                    属性.value = Math.round((主属性.最初属性值 * _realRatio) * 1000) / 1000;
                                }
                            }
                        }
                    }

                    this.维护显示顺序(item);

                    if (item.sora.当前强化等级 % 3 === 0 && item.etypeId < 7) {
                        let 已应用一次 = false;
                        强化_确保顺序与孔位计次(item);
                        this.背包窗口.ensureInitRecordFromItem(item);

                        if (this.背包窗口.getInitAttrCount(item) < 4) {
                            const pool = this.背包窗口.getPoolByEtypeId(item);
                            const 已有 = this.背包窗口.getExistingStatSet(item);
                            const 可用词条池 = pool.filter(p => !已有.has(`${this.背包窗口.getStatNameByCodeAndId(p.code, p.dataId)}#${p.code === '固定' ? 'flat' : 'percent'}`));

                            if (可用词条池.length > 0) {
                                let 选 = null;
                                this.背包窗口.withItemRNG(item, '词条', () => {
                                    选 = 可用词条池[Math.randomInt(可用词条池.length)];
                                });
                                const 数值 = this.背包窗口.rollValueForStat(item, 选.code, 选.dataId, 等级);
                                this.背包窗口.applyIncrement(item, 选.code, 选.dataId, 数值);
                                this.背包窗口.appendToInitRecord(item, 选.code, 选.dataId);
                                已应用一次 = true;
                                this.维护显示顺序(item);
                            }
                        }

                        if (!已应用一次) {
                            let 目标 = null;

                            // ★ 自选词条：按索引取代随机 ★
                            if (_自选生效) {
                                const rec = item.sora.强化用记录初始属性;
                                const cand = [];
                                (rec.固定属性 || []).forEach(id => cand.push({ type: 'flat', code: '固定', dataId: id }));
                                (rec.百分比属性 || []).forEach(o => cand.push({ type: 'percent', code: o.属性, dataId: o.属性ID }));
                                const pickIdx = this._自选词条索引 - 1; // 0~3
                                if (pickIdx < cand.length) {
                                    目标 = cand[pickIdx];
                                }
                            } else {
                                目标 = this.背包窗口.pickRandomFromInitRecord(item);
                            }

                            if (目标) {
                                const 数值 = this.背包窗口.rollValueForStat(item, 目标.code, 目标.dataId, 等级);
                                this.背包窗口.applyIncrement(item, 目标.code, 目标.dataId, 数值);
                                已应用一次 = true;
                                this.维护显示顺序(item);
                                this.记录重铸计次(item, 目标.type === 'flat' ? {
                                    kind: 'fixed', paramId: 目标.dataId
                                } : {
                                    kind: 'percent', key: `${目标.code}-${目标.dataId}`
                                });
                            }
                        }
                    }

                    const _afterSnap = this.背包窗口._makeSnapshot(item);
                    this.背包窗口._lastDelta = this.背包窗口._computeLastDelta(_beforeSnap, _afterSnap);
                    this.背包窗口._lastDelta.__showOnce = true;
                    this.背包窗口.refresh();
                    this.背包窗口.刷新文本();
                    item.sora.装备评分 = Math.round(计算装备评分(item));

                } else {
                    SoundManager.playBuzzer();
                }
            }
            this._objInfoWindow.refresh();
        };

        // ========== ③ 首次切换弹框提示 ==========
        sora.强化插件.prototype._显示自选提示弹框 = function() {
            this.toggleUIActive(false);

            const container = new Sprite();
            this.addChild(container);

            const mask = new Sprite(new Bitmap(Graphics.width, Graphics.height));
            mask.bitmap.fillRect(0, 0, Graphics.width, Graphics.height, 'rgba(0,0,0,0.6)');
            container.addChild(mask);

            const boxW = 520, boxH = 210;
            const boxX = (Graphics.width - boxW) / 2;
            const boxY = (Graphics.height - boxH) / 2;

            const box = new Sprite(new Bitmap(boxW, boxH));
            box.x = boxX;
            box.y = boxY;
            const bmp = box.bitmap;

            bmp.fillRect(0, 0, boxW, boxH, 'rgba(0, 30, 60, 0.95)');
            bmp.strokeRect(0, 0, boxW, boxH, '#00f0ff');
            const cs = 12;
            bmp.fillRect(0, 0, cs, 3, '#00f0ff');
            bmp.fillRect(0, 0, 3, cs, '#00f0ff');
            bmp.fillRect(boxW - cs, 0, cs, 3, '#00f0ff');
            bmp.fillRect(boxW - 3, 0, 3, cs, '#00f0ff');
            bmp.fillRect(0, boxH - 3, cs, 3, '#00f0ff');
            bmp.fillRect(0, boxH - cs, 3, cs, '#00f0ff');
            bmp.fillRect(boxW - cs, boxH - 3, cs, 3, '#00f0ff');
            bmp.fillRect(boxW - 3, boxH - cs, 3, cs, '#00f0ff');

            bmp.fontSize = 22;
            bmp.textColor = '#ffffff';
            bmp.outlineWidth = 3;
            bmp.drawText("自选普通装备强化词条时", 0, 25, boxW, 30, 'center');
            bmp.drawText("+3、+6、+9、+12、+15 时价格为10倍", 0, 60, boxW, 30, 'center');

            container.addChild(box);

            let _checked = false;
            const checkBtn = new Sprite_Clickable();
            const cbSize = 26;
            checkBtn.x = boxX + 130;
            checkBtn.y = boxY + 115;

            const drawCheckbox = () => {
                const cb = new Bitmap(220, cbSize);
                cb.fillRect(0, 2, cbSize - 4, cbSize - 4, 'rgba(0,0,0,0.5)');
                cb.strokeRect(0, 2, cbSize - 4, cbSize - 4, '#00f0ff');
                if (_checked) {
                    cb.fontSize = 16;
                    cb.textColor = '#00f0ff';
                    cb.drawText("✔", 0, 2, cbSize - 4, cbSize - 4, 'center');
                }
                cb.fontSize = 20;
                cb.textColor = '#cccccc';
                cb.drawText("不再提示", cbSize + 6, 0, 150, cbSize, 'left');
                checkBtn.bitmap = cb;
            };
            drawCheckbox();
            checkBtn.onClick = () => {
                _checked = !_checked;
                SoundManager.playCursor();
                drawCheckbox();
            };
            container.addChild(checkBtn);

            const okBtn = new Sprite_Clickable();
            this.setupCodeButton(okBtn, boxX + (boxW - 120) / 2, boxY + 160, 120, 36, "确  定", "#2ecc71", 20);
            okBtn.onClick = () => {
                if (_checked) {
                    ConfigManager._不再提示自选强化 = true;
                    ConfigManager.save();
                }
                this.removeChild(container);
                this.toggleUIActive(true);
                SoundManager.playOk();
            };
            container.addChild(okBtn);
        };

        // ========== ConfigManager 持久化"不再提示"设置 ==========
        const _ConfigManager_makeData = ConfigManager.makeData;
        ConfigManager.makeData = function() {
            const config = _ConfigManager_makeData.call(this);
            config._不再提示自选强化 = this._不再提示自选强化;
            return config;
        };

        const _ConfigManager_applyData = ConfigManager.applyData;
        ConfigManager.applyData = function(config) {
            _ConfigManager_applyData.call(this, config);
            this._不再提示自选强化 = config._不再提示自选强化 || false;
        };
    }
})();