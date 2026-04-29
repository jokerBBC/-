//=============================================================================
// 战斗UI独立插件型魔改.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc 战斗5档速魔改补丁
 * @author 玩家joker&deepseek专家模式 原作sora
 * @help
 * 此插件必须放在《战斗UI》插件下方。
 * 功能：战斗5档速循环切换按钮，请将游戏挂在前台使用5倍速。
 * 5倍速可能会导致内存回收来不及，导致比官方2倍速内存涨得快，请知晓。
 * 后台报错别找我
 */

// 20260408魔改新增：战斗加速按钮实现（0>2>3>4>5>0循环）
//=============================================================================

Scene_Battle.prototype.创建战斗加速按钮 = function () {
    this.sora各种窗口.战斗加速按钮 = new Sprite_Clickable();
    this.sora各种窗口.战斗加速按钮.x = 1120;
    this.sora各种窗口.战斗加速按钮.y = 20;
    this.addChild(this.sora各种窗口.战斗加速按钮);

    if ($gameSystem.sora.战斗加速倍数 === undefined) {
        $gameSystem.sora.战斗加速倍数 = 0;
    }

    this.sora各种窗口.战斗加速按钮.onClick = () => {
        SoundManager.playOk();
        let currentSpeed = $gameSystem.sora.战斗加速倍数 || 0;
        const speeds = [0, 2, 3, 4, 5];
        const currentIndex = speeds.indexOf(currentSpeed);
        const nextIndex = (currentIndex + 1) % speeds.length;
        let newSpeed = speeds[nextIndex];
        $gameSystem.sora.战斗加速倍数 = newSpeed;
        this.updateBattleSpeedButton();
    };

    this.updateBattleSpeedButton();
};

Scene_Battle.prototype.updateBattleSpeedButton = function () {
    const speed = $gameSystem.sora.战斗加速倍数;
    let imageName;
    switch (speed) {
        case 0:
            imageName = '战斗加速关闭';
            break;
        case 2:
            imageName = '战斗加速开启倍数2';
            break;
        case 3:
            imageName = '战斗加速开启倍数3';
            break;
        case 4:
            imageName = '战斗加速开启倍数4';
            break;
        case 5:
            imageName = '战斗加速开启倍数5';
            break;
        default:
            imageName = '战斗加速关闭';
            break;
    }

    ImageManager.战斗中的框(imageName).addLoadListener((bitmap) => {
        this.sora各种窗口.战斗加速按钮.bitmap = bitmap;
    });
};
