/*:
 * @target MZ
 * @plugindesc [V1.7.2F Patch] 传送UI - 独立补丁版（左侧按钮+防穿透修复）
 * @author joker创意 / Deepseek覆盖版代码 / GLM-5提取独立补丁 / 
 * @help
 * 需放在原版《传送UI.js》下方加载。
 * 1. 新增左侧常驻传送按钮。
 * 2. 修复点击穿透及战斗鼠标冲突。
 * 3. 修复不传list参数时的JSON报错。
 * 不喜欢手搓的丑陋图标可自己替换，只需保持文件名一致即可。
 * 图片请放置于：/js/mods/img/ 目录下。
 */

(() => {
    const pluginName = "传送UI";
    
    // --- 配置区 ---
    const CONFIG = {
        folder: "js/mods/img/", 
        btn1: { id: "森林栖息地", icon: "传送图标" },
        btn2: { id: "副本", icon: "秘境图标" },
        startX: 20,
        getCenterY: () => (Graphics.boxHeight / 2) + 116,
        spacing: 60
    };

    // --- 1. 重新解析公开参数（避免访问原插件闭包变量）---
    const params = PluginManager.parameters(pluginName);
    const rawGroups = JSON.parse(params["globalGroups"] || "[]");
    const PatchDatabase = {};
    rawGroups.forEach(groupStr => {
        const group = JSON.parse(groupStr);
        if (group.groupId) {
            const list = JSON.parse(group.list || "[]").map(item => JSON.parse(item));
            PatchDatabase[group.groupId] = list;
        }
    });

    // --- 2. 覆盖插件指令（修复 list 为空报错）---
    PluginManager.registerCommand(pluginName, "open", function(args) {
        let teleportData = [];
        const gKey = args.groupKey;
        if (gKey && PatchDatabase[gKey]) {
            teleportData = teleportData.concat(PatchDatabase[gKey]);
        }
        if (args.list) {
            const rawList = JSON.parse(args.list || "[]");
            teleportData = teleportData.concat(rawList.map(item => JSON.parse(item)));
        }
        if (SceneManager._scene instanceof Scene_Map && teleportData.length > 0) {
            SceneManager._scene.openCustomTeleportWindow(teleportData);
            this.setWaitMode('teleport_window');
        }
    });

    // --- 3. 场景扩展：按钮与触摸拦截 ---
    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        this.createQuickTeleportButtons();
    };

    Scene_Map.prototype.createQuickTeleportButtons = function() {
        const centerY = CONFIG.getCenterY();
        
        this._teleBtn1 = new Sprite_Clickable();
        this._teleBtn1.bitmap = ImageManager.loadBitmap(CONFIG.folder, CONFIG.btn1.icon);
        this._teleBtn1.x = CONFIG.startX;
        this._teleBtn1.y = centerY;
        this._teleBtn1.onClick = () => this.callTeleportById(CONFIG.btn1.id);
        this.addChild(this._teleBtn1);

        this._teleBtn2 = new Sprite_Clickable();
        this._teleBtn2.bitmap = ImageManager.loadBitmap(CONFIG.folder, CONFIG.btn2.icon);
        this._teleBtn2.x = CONFIG.startX;
        this._teleBtn2.y = centerY + CONFIG.spacing;
        this._teleBtn2.onClick = () => this.callTeleportById(CONFIG.btn2.id);
        this.addChild(this._teleBtn2);
    };

    Scene_Map.prototype.callTeleportById = function(groupId) {
        if ($gameMessage.isBusy() || (this._customTeleportWindow && this._customTeleportWindow.active)) return;
        const data = PatchDatabase[groupId];
        if (data && data.length > 0) {
            SoundManager.playOk();
            this.openCustomTeleportWindow(data);
        }
    };

    const _Scene_Map_processMapTouch = Scene_Map.prototype.processMapTouch;
    Scene_Map.prototype.processMapTouch = function() {
        const isSpriteTouched = (sprite) => {
            if (!sprite || !sprite.visible || !sprite.bitmap || sprite.opacity === 0) return false;
            const touchPos = new Point(TouchInput.x, TouchInput.y);
            const localPos = sprite.worldTransform.applyInverse(touchPos);
            return localPos.x >= 0 && localPos.y >= 0 && localPos.x < sprite.width && localPos.y < sprite.height;
        };

        if (isSpriteTouched(this._teleBtn1)) return;
        if (isSpriteTouched(this._teleBtn2)) return;
        if (this._customTeleportWindow && (this._customTeleportWindow.active || this._customTeleportWindow.openness > 0)) return;

        _Scene_Map_processMapTouch.call(this);
    };

    // --- 4. 修复原插件副作用与状态判定 ---
    const _Scene_Map_createCustomTeleportUI = Scene_Map.prototype.createCustomTeleportUI;
    Scene_Map.prototype.createCustomTeleportUI = function() {
        _Scene_Map_createCustomTeleportUI.call(this);
        // 覆盖版移除了对 Help 窗口的自定义 refresh，此处恢复默认以保持一致
        if (this._customTeleportHelpWindow) {
            this._customTeleportHelpWindow.refresh = Window_Help.prototype.refresh;
        }
    };

    const _Scene_Map_isBusy = Scene_Map.prototype.isBusy;
    Scene_Map.prototype.isBusy = function() {
        const isWindowBusy = this._customTeleportWindow && 
            (this._customTeleportWindow.isOpening() || 
             this._customTeleportWindow.isClosing() || 
             this._customTeleportWindow.active);
        return _Scene_Map_isBusy.call(this) || isWindowBusy;
    };
})();
