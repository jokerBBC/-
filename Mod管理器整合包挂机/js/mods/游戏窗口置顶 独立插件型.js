/*:
 * @plugindesc 游戏窗口置顶与缩放插件 v1.2 (仅文档标题)
 * @author joker创意Deepseek代码
 * @help
 * ============================================================================
 * 功能介绍
 * ============================================================================
 * 1. 窗口置顶切换 (Ctrl + 1)
 *    - 将游戏窗口置顶于所有程序之上，再次按下则取消置顶。
 *    - 置顶时 HTML 文档标题前会显示 📌 标记。
 *
 * 2. 窗口快速缩放 (Ctrl + 2)
 *    - 将窗口缩小至 192x108 像素（便于后台挂机或预览）。
 *    - 再次按下恢复为默认分辨率 1280x720。
 *
 * 3. 逻辑保活 (兼容 Yanfly 插件)
 *    - 自动覆盖 SceneManager.isGameActive 方法，防止切换程序时游戏卡死。
 *
 * ============================================================================
 * 注意事项
 * ============================================================================
 * - 本版本仅修改 document.title，不影响操作系统窗口标题栏。
 * - 若游戏界面内显示了 document.title（如某些自定义菜单），📌标记将可见。
 *
 */

(() => {
    if (typeof nw === 'undefined') return;

    const win = nw.Window.get();
    let isPinned = false;
    let isScaledDown = false;
    const defaultWidth = 1280;
    const defaultHeight = 720;
    const miniWidth = 192;
    const miniHeight = 108;

    // ---------- 保活逻辑 (兼容 Yanfly) ----------
    if (typeof SceneManager !== 'undefined') {
        SceneManager.isGameActive = function() {
            return true;
        };
    }

    // ---------- 辅助函数：获取干净标题 ----------
    function getCleanTitle() {
        return document.title.replace(/^📌\s*/, '');
    }

    // ---------- 置顶切换 ----------
    function toggleAlwaysOnTop() {
        isPinned = !isPinned;
        win.setAlwaysOnTop(isPinned);

        const clean = getCleanTitle();
        document.title = isPinned ? `📌 ${clean}` : clean;
    }

    // ---------- 缩放切换 ----------
    function toggleWindowSize() {
        if (!isScaledDown) {
            win.resizeTo(miniWidth, miniHeight);
            isScaledDown = true;
        } else {
            win.resizeTo(defaultWidth, defaultHeight);
            isScaledDown = false;
        }
    }

    // ---------- 快捷键监听 ----------
    function onKeyDown(event) {
        if (!event.ctrlKey) return;

        const key = event.code;
        if (key === 'Digit1' || key === 'Digit2') {
            event.preventDefault();
        }

        if (key === 'Digit1') {
            toggleAlwaysOnTop();
        } else if (key === 'Digit2') {
            toggleWindowSize();
        }
    }

    document.addEventListener('keydown', onKeyDown);

    // 清理监听（可选）
    window.__jokerPinCleanup = function() {
        document.removeEventListener('keydown', onKeyDown);
    };
})();