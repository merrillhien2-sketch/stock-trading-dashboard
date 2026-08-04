/* ==================== 公共工具函数 ==================== */

// 格式化数字（万、亿）
function formatAmount(val) {
    if (val === null || val === undefined || val === "") return "--";
    val = parseFloat(val);
    if (isNaN(val)) return "--";
    var abs = Math.abs(val);
    if (abs >= 1e8) return (val / 1e8).toFixed(2) + "亿";
    if (abs >= 1e4) return (val / 1e4).toFixed(2) + "万";
    return val.toFixed(2);
}

// 格式化百分比
function formatPct(val, decimals) {
    if (val === null || val === undefined || val === "") return "--";
    decimals = decimals || 2;
    val = parseFloat(val);
    if (isNaN(val)) return "--";
    var prefix = val > 0 ? "+" : "";
    return prefix + val.toFixed(decimals) + "%";
}

// 格式化价格
function formatPrice(val) {
    if (val === null || val === undefined || val === "") return "--";
    val = parseFloat(val);
    if (isNaN(val)) return "--";
    return val.toFixed(2);
}

// 获取涨跌CSS类
function getChangeClass(val) {
    val = parseFloat(val);
    if (isNaN(val) || val === 0) return "text-flat";
    return val > 0 ? "text-up" : "text-down";
}

// 获取涨跌符号
function getChangeSign(val) {
    val = parseFloat(val);
    if (isNaN(val) || val === 0) return "";
    return val > 0 ? "↑" : "↓";
}

// AJAX请求封装（自动添加时间戳防缓存）
function fetchData(url, callback, errorCallback) {
    // 在URL后自动添加时间戳参数防浏览器缓存
    var separator = (url.indexOf("?") !== -1) ? "&" : "?";
    url = url + separator + "_t=" + Date.now();

    $.ajax({
        url: url,
        type: "GET",
        dataType: "json",
        timeout: 15000,
        success: function (resp) {
            if (resp.code === 0 && resp.data) {
                callback(resp.data);
            } else {
                console.warn("API返回异常:", resp);
                if (errorCallback) errorCallback(resp.msg || "数据获取失败");
            }
        },
        error: function (xhr, status, error) {
            console.error("请求失败:", url, error);
            if (errorCallback) errorCallback("网络请求失败，请检查后端服务");
        }
    });
}

// 刷新当前页面
function refreshPage() {
    location.reload();
}

// 时钟
function updateClock() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2, "0");
    var m = String(now.getMinutes()).padStart(2, "0");
    var s = String(now.getSeconds()).padStart(2, "0");
    var el = document.getElementById("clock");
    if (el) el.textContent = h + ":" + m + ":" + s;
}

// 顶部指数滚动条
function loadIndexTicker() {
    fetchData("/api/market-overview", function (data) {
        if (!data || data.length === 0) return;
        var html = "";
        // 重复两遍以实现无缝滚动
        var items = data.concat(data);
        items.forEach(function (item) {
            var cls = getChangeClass(item.change_pct);
            var sign = getChangeSign(item.change_pct);
            html += '<span class="ticker-item">' +
                '<span class="ticker-name">' + item.name + '</span>' +
                '<span class="ticker-price ' + cls + '">' + formatPrice(item.price) + '</span>' +
                '<span class="' + cls + '">' + sign + formatPct(item.change_pct) + '</span>' +
                '</span>';
        });
        var container = $("#indexTicker .ticker-content");
        container.html(html);
    });
}

// 格式化新闻时间（智能显示）
function formatNewsTime(timeStr) {
    if (!timeStr) return "";
    timeStr = timeStr.trim();
    // 包含空格：日期 + 时间（如 "2026-07-14 09:30" 或 "2026-07-14 09:30:00"）
    if (timeStr.indexOf(" ") !== -1) {
        var parts = timeStr.split(" ");
        var timePart = parts[parts.length - 1];
        var timeParts = timePart.split(":");
        if (timeParts.length >= 2) {
            return timeParts[0] + ":" + timeParts[1];
        }
        return timePart;
    }
    // 纯时间（如 "09:30:00" 或 "09:30"）
    if (timeStr.indexOf(":") !== -1) {
        var tParts = timeStr.split(":");
        if (tParts.length >= 2) {
            return tParts[0] + ":" + tParts[1];
        }
        return timeStr;
    }
    // 纯日期，直接返回
    return timeStr;
}

// HTML转义（防XSS）
function escapeHtml(str) {
    if (typeof str !== "string") return str;
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return str.replace(/[&<>"']/g, function (m) { return map[m]; });
}

// 渲染新闻列表HTML
function renderNewsList(data, container, category) {
    if (!data || data.length === 0) {
        container.html('<div class="no-data"><i class="bi bi-inbox"></i>暂无新闻数据</div>');
        return;
    }
    var tagClass = {
        "policy": "news-tag-policy",
        "finance": "news-tag-finance",
        "tech": "news-tag-tech",
        "stock": "news-tag-stock",
        "global": "news-tag-finance"
    };
    var tagName = {
        "policy": "政策",
        "finance": "财经",
        "tech": "科技",
        "stock": "A股",
        "global": "国际"
    };
    var cat = category || "finance";
    var html = '<ul class="news-list">';
    data.forEach(function (item) {
        var title = item.title || "";
        var url = item.url || "#";
        var source = item.source || "";
        var time = item.publish_time || "";
        html += '<li class="news-item">' +
            '<a href="' + url + '" target="_blank">' +
            '<span class="news-tag ' + (tagClass[cat] || "news-tag-finance") + '">' + (tagName[cat] || "财经") + '</span>' +
            title +
            '</a>' +
            '<div class="news-meta">' +
            '<span class="news-source"><i class="bi bi-newspaper"></i> ' + source + '</span>' +
            (time ? '<span class="news-time"><i class="bi bi-clock"></i> ' + formatNewsTime(time) + '</span>' : '') +
            '</div>' +
            '</li>';
    });
    html += '</ul>';
    container.html(html);
}

// 渲染表格行
function renderStockRow(item, showMainNet, showCode) {
    var cls = getChangeClass(item.change_pct);
    showCode = showCode || false;
    var html = '<tr>' +
        '<td>' + (item.name || "--") + '</td>';
    if (showCode) {
        html += '<td class="text-muted text-sm">' + (item.code || "--") + '</td>';
    }
    html += '<td>' + formatPrice(item.price) + '</td>' +
        '<td class="' + cls + '">' + formatPct(item.change_pct) + '</td>';
    if (showMainNet) {
        var netCls = getChangeClass(item.main_net);
        html += '<td class="' + netCls + '">' + formatAmount(item.main_net) + '</td>';
    }
    html += '</tr>';
    return html;
}

// ECharts 暗色主题配置
var chartTextColor = "#8b949e";
var chartGridColor = "#30363d";
var chartUpColor = "#ff4d4f";
var chartDownColor = "#00b87a";

// 初始化ECharts实例
function initChart(domId) {
    var dom = document.getElementById(domId);
    if (!dom) return null;
    var chart = echarts.init(dom, null, { renderer: "canvas" });
    // 响应窗口大小变化
    window.addEventListener("resize", function () {
        chart.resize();
    });
    return chart;
}

// 页面初始化
$(document).ready(function () {
    // 启动时钟
    updateClock();
    setInterval(updateClock, 1000);

    // 加载顶部指数滚动条
    loadIndexTicker();
    // 每30秒刷新一次
    setInterval(loadIndexTicker, 30000);
});
