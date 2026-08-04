/**
 * 资金流向综合分析 - Fund Flow Analysis
 * 股票交易决策仪表盘 - 多元化板块
 * 依赖: ECharts, 全局公共函数 (fetchData, formatAmount, formatPct, getChangeClass, initChart)
 */
(function (win, doc) {
    'use strict';

    // ============================================================
    //  配置常量
    // ============================================================
    var CFG = {
        defaultSecid: '0.399006',
        trendDays: 60,
        colors: {
            up: '#ff4d4f',
            down: '#00b87a',
            main: '#ff6b6b',
            superLarge: '#ffd93d',
            large: '#6bcb77',
            medium: '#4d96ff',
            small: '#9b59b6',
            text: '#8b949e'
        }
    };

    // ============================================================
    //  指数映射表
    // ============================================================
    var INDEX_MAP = {
        '1.000001': { name: '上证指数', short: '上证' },
        '0.399001': { name: '深证成指', short: '深证' },
        '0.399006': { name: '创业板指', short: '创业板' },
        '1.000688': { name: '科创50', short: '科创50' },
        '100.HSI': { name: '恒生指数', short: '恒生' },
        '100.DJIA': { name: '道琼斯工业平均', short: '道琼斯' },
        '100.SPX': { name: '标普500', short: '标普500' }
    };

    // ============================================================
    //  状态变量
    // ============================================================
    var currentSecid = CFG.defaultSecid;
    var trendChart = null;
    var structureChart = null;

    // ============================================================
    //  DOM 缓存
    // ============================================================
    var dom = {};

    function cacheDOM() {
        dom.updateTime = doc.getElementById('updateTime');
        dom.indexName = doc.getElementById('indexName');
        dom.indexSwitcher = doc.getElementById('indexSwitcher');

        // 统计卡片
        dom.mainNet = doc.getElementById('mainNet');
        dom.mainPct = doc.getElementById('mainPct');
        dom.superLargeNet = doc.getElementById('superLargeNet');
        dom.superLargePct = doc.getElementById('superLargePct');
        dom.largeNet = doc.getElementById('largeNet');
        dom.largePct = doc.getElementById('largePct');
        dom.mediumNet = doc.getElementById('mediumNet');
        dom.mediumPct = doc.getElementById('mediumPct');
        dom.smallNet = doc.getElementById('smallNet');
        dom.smallPct = doc.getElementById('smallPct');
        dom.mainNetPct = doc.getElementById('mainNetPct');
        dom.mainFlowPct = doc.getElementById('mainFlowPct');

        // 图表容器
        dom.trendChart = doc.getElementById('trendChart');
        dom.structureChart = doc.getElementById('structureChart');

        // 表格
        dom.sectorTableBody = doc.getElementById('sectorTableBody');
    }

    // ============================================================
    //  图表初始化
    // ============================================================
    function initCharts() {
        trendChart = initChart('trendChart');
        structureChart = initChart('structureChart');
    }

    // ============================================================
    //  事件绑定
    // ============================================================
    function bindEvents() {
        dom.indexSwitcher.addEventListener('click', function (e) {
            var btn = e.target.closest('.btn-item');
            if (!btn) return;
            var secid = btn.getAttribute('data-secid');
            if (!secid || secid === currentSecid) return;
            switchIndex(secid);
        });
    }

    // ============================================================
    //  指数切换
    // ============================================================
    function switchIndex(secid) {
        currentSecid = secid;

        // 更新按钮高亮
        var btns = dom.indexSwitcher.querySelectorAll('.btn-item');
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            if (b.getAttribute('data-secid') === secid) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        }

        // 更新指数名称
        var info = INDEX_MAP[secid];
        if (info && dom.indexName) {
            dom.indexName.textContent = info.name;
        }

        // 刷新数据
        loadRealtimeData();
        loadTrendData();
    }

    // ============================================================
    //  数据加载 - 全量
    // ============================================================
    function loadAllData() {
        loadRealtimeData();
        loadTrendData();
        loadSectorData();
    }

    // ============================================================
    //  数据加载 - 实时资金流向
    // ============================================================
    function loadRealtimeData() {
        setStatCardsLoading();
        fetchData(
            '/api/realtime-flow?secid=' + currentSecid,
            function (resp) {
                if (resp) {
                    updateRealtimeUI(resp);
                } else {
                    setStatCardsError();
                }
            },
            function () {
                setStatCardsError();
            }
        );
    }

    function setStatCardsLoading() {
        var cards = [
            dom.mainNet, dom.mainPct,
            dom.superLargeNet, dom.superLargePct,
            dom.largeNet, dom.largePct,
            dom.mediumNet, dom.mediumPct,
            dom.smallNet, dom.smallPct,
            dom.mainNetPct
        ];
        for (var i = 0; i < cards.length; i++) {
            if (cards[i]) {
                cards[i].textContent = '--';
                cards[i].className = 'stat-value';
            }
        }
        if (dom.mainFlowPct) {
            dom.mainFlowPct.textContent = '加载中...';
        }
    }

    function setStatCardsError() {
        var cards = [
            dom.mainNet, dom.mainPct,
            dom.superLargeNet, dom.superLargePct,
            dom.largeNet, dom.largePct,
            dom.mediumNet, dom.mediumPct,
            dom.smallNet, dom.smallPct,
            dom.mainNetPct
        ];
        for (var i = 0; i < cards.length; i++) {
            if (cards[i] && cards[i].textContent === '--') {
                cards[i].textContent = '--';
            }
        }
        if (dom.mainFlowPct) {
            dom.mainFlowPct.textContent = '--';
        }
    }

    // ============================================================
    //  UI 更新 - 实时资金流向
    // ============================================================
    function updateRealtimeUI(data) {
        // 更新时间
        var now = new Date();
        var timeStr =
            padZero(now.getHours()) + ':' +
            padZero(now.getMinutes()) + ':' +
            padZero(now.getSeconds());
        if (dom.updateTime) {
            dom.updateTime.textContent = '更新于 ' + timeStr;
        }

        // 更新指数名称
        var info = INDEX_MAP[currentSecid];
        if (info && dom.indexName) {
            dom.indexName.textContent = info.name;
        }

        // ---- 主力净流入 ----
        if (dom.mainNet) {
            dom.mainNet.textContent = formatAmount(data.main_net);
            dom.mainNet.className = 'stat-value ' + getChangeClass(data.main_net);
        }
        if (dom.mainPct) {
            dom.mainPct.textContent = formatPct(data.main_pct);
            dom.mainPct.className = 'stat-pct ' + getChangeClass(data.main_pct);
        }

        // ---- 超大单 ----
        updateStatCard(dom.superLargeNet, dom.superLargePct, data.super_large_net);

        // ---- 大单 ----
        updateStatCard(dom.largeNet, dom.largePct, data.large_net);

        // ---- 中单 ----
        updateStatCard(dom.mediumNet, dom.mediumPct, data.medium_net);

        // ---- 小单 ----
        updateStatCard(dom.smallNet, dom.smallPct, data.small_net);

        // ---- 主力净占比 ----
        if (dom.mainNetPct) {
            dom.mainNetPct.textContent = formatPct(data.main_pct);
            dom.mainNetPct.className = 'stat-value ' + getChangeClass(data.main_pct);
        }
        if (dom.mainFlowPct) {
            dom.mainFlowPct.textContent = '主力资金';
            dom.mainFlowPct.className = 'stat-pct';
        }

        // ---- 计算并更新各类资金占比 ----
        updateTypePercentages(data);

        // ---- 更新结构图 ----
        updateStructureChart(data);
    }

    /**
     * 更新单个统计卡片
     */
    function updateStatCard(valueEl, pctEl, value) {
        if (valueEl) {
            valueEl.textContent = formatAmount(value);
            valueEl.className = 'stat-value ' + getChangeClass(value);
        }

        // 计算各类型占比 — 仅显示占所有类型（除主力外）总绝对值的比例
        // 占比将在 updateRealtimeUI 中统一计算，此处不做处理
        if (pctEl) {
            // 先用占位，后续在 updateTypePercentages 中填充
            pctEl.textContent = '--';
            pctEl.className = 'stat-pct';
        }
    }

    /**
     * 计算并更新各类资金占比（基于当前实时数据）
     */
    function updateTypePercentages(data) {
        var types = [
            { val: data.super_large_net, el: dom.superLargePct },
            { val: data.large_net, el: dom.largePct },
            { val: data.medium_net, el: dom.mediumPct },
            { val: data.small_net, el: dom.smallPct }
        ];

        // 计算总绝对值
        var total = 0;
        for (var i = 0; i < types.length; i++) {
            total += Math.abs(types[i].val || 0);
        }

        // 更新占比
        for (var j = 0; j < types.length; j++) {
            var t = types[j];
            if (!t.el) continue;
            var pct = total > 0 ? (Math.abs(t.val || 0) / total * 100) : 0;
            t.el.textContent = pct.toFixed(1) + '%';
            t.el.className = 'stat-pct ' + getChangeClass(t.val);
        }
    }

    // ============================================================
    //  数据加载 - 资金流向趋势(60日)
    // ============================================================
    function loadTrendData() {
        if (trendChart) {
            trendChart.showLoading({
                text: '加载中...',
                color: '#4d96ff',
                textColor: '#8b949e',
                maskColor: 'rgba(26, 26, 46, 0.6)'
            });
        }
        fetchData(
            '/api/fund-flow?secid=' + currentSecid + '&lmt=' + CFG.trendDays,
            function (resp) {
                if (trendChart) trendChart.hideLoading();
                if (resp && resp.klines && resp.klines.length > 0) {
                    updateTrendChart(resp.klines);
                } else {
                    showTrendChartEmpty();
                }
            },
            function () {
                if (trendChart) trendChart.hideLoading();
                showTrendChartEmpty();
            }
        );
    }

    function showTrendChartEmpty() {
        if (!trendChart) return;
        trendChart.setOption({
            title: {
                text: '暂无数据',
                textStyle: { color: '#8b949e', fontSize: 14 },
                left: 'center',
                top: 'center'
            }
        }, true);
    }

    // ============================================================
    //  渲染 - 资金流向趋势图
    // ============================================================
    function updateTrendChart(klines) {
        var dates = [];
        var mainData = [];
        var superLargeData = [];
        var largeData = [];

        for (var i = 0; i < klines.length; i++) {
            var k = klines[i];
            dates.push(k.date);
            mainData.push(k.main);
            superLargeData.push(k.super_large);
            largeData.push(k.large);
        }

        // 计算 Y 轴最大值/最小值，留边
        var allValues = mainData.concat(superLargeData).concat(largeData);
        var maxVal = Math.max.apply(null, allValues.map(Math.abs));
        var yMax = maxVal * 1.3;

        var option = {
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(36, 36, 52, 0.95)',
                borderColor: '#3d3d5c',
                borderWidth: 1,
                textStyle: { color: '#e0e0e0', fontSize: 12 },
                formatter: function (params) {
                    var html = '<div style="font-weight:600;margin-bottom:4px;">' + params[0].axisValue + '</div>';
                    for (var i = 0; i < params.length; i++) {
                        var p = params[i];
                        var color = p.color;
                        var val = typeof p.value === 'number' ? formatAmount(p.value) : '--';
                        html += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">' +
                            '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + ';"></span>' +
                            '<span>' + p.seriesName + ': </span>' +
                            '<span style="font-weight:600;">' + val + '</span>' +
                            '</div>';
                    }
                    return html;
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '8%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: dates,
                boundaryGap: false,
                axisLine: { lineStyle: { color: '#333' } },
                axisTick: { show: false },
                axisLabel: {
                    color: CFG.colors.text,
                    fontSize: 10,
                    rotate: dates.length > 30 ? 45 : 0,
                    interval: Math.max(0, Math.floor(dates.length / 10) - 1)
                },
                splitLine: { show: false }
            },
            yAxis: {
                type: 'value',
                min: function (value) {
                    return -Math.max(Math.abs(value.min), Math.abs(value.max)) * 1.2;
                },
                max: function (value) {
                    return Math.max(Math.abs(value.min), Math.abs(value.max)) * 1.2;
                },
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: {
                    lineStyle: { color: 'rgba(255,255,255,0.06)', type: 'dashed' }
                },
                axisLabel: {
                    color: CFG.colors.text,
                    fontSize: 10,
                    formatter: function (val) {
                        var abs = Math.abs(val);
                        if (abs >= 1e8) return (val / 1e8).toFixed(1) + '亿';
                        if (abs >= 1e4) return (val / 1e4).toFixed(0) + '万';
                        return val;
                    }
                }
            },
            series: [
                {
                    name: '主力净流入',
                    type: 'line',
                    data: mainData,
                    smooth: true,
                    symbol: 'none',
                    lineStyle: {
                        width: 2,
                        color: CFG.colors.main
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(255, 107, 107, 0.35)' },
                                { offset: 1, color: 'rgba(255, 107, 107, 0.02)' }
                            ]
                        }
                    }
                },
                {
                    name: '超大单',
                    type: 'line',
                    data: superLargeData,
                    smooth: true,
                    symbol: 'none',
                    lineStyle: {
                        width: 1.5,
                        color: CFG.colors.superLarge,
                        type: 'dashed'
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(255, 217, 61, 0.15)' },
                                { offset: 1, color: 'rgba(255, 217, 61, 0.01)' }
                            ]
                        }
                    }
                },
                {
                    name: '大单',
                    type: 'line',
                    data: largeData,
                    smooth: true,
                    symbol: 'none',
                    lineStyle: {
                        width: 1.5,
                        color: CFG.colors.large,
                        type: 'dashed'
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(107, 203, 119, 0.15)' },
                                { offset: 1, color: 'rgba(107, 203, 119, 0.01)' }
                            ]
                        }
                    }
                }
            ]
        };

        trendChart.setOption(option, true);
    }

    // ============================================================
    //  渲染 - 资金流向结构图（环形图）
    // ============================================================
    function updateStructureChart(data) {
        if (!structureChart) return;

        var pieItems = [
            {
                name: '超大单',
                value: Math.abs(data.super_large_net || 0),
                realVal: data.super_large_net || 0,
                color: (data.super_large_net || 0) >= 0 ? CFG.colors.up : CFG.colors.down
            },
            {
                name: '大单',
                value: Math.abs(data.large_net || 0),
                realVal: data.large_net || 0,
                color: (data.large_net || 0) >= 0 ? CFG.colors.up : CFG.colors.down
            },
            {
                name: '中单',
                value: Math.abs(data.medium_net || 0),
                realVal: data.medium_net || 0,
                color: (data.medium_net || 0) >= 0 ? CFG.colors.up : CFG.colors.down
            },
            {
                name: '小单',
                value: Math.abs(data.small_net || 0),
                realVal: data.small_net || 0,
                color: (data.small_net || 0) >= 0 ? CFG.colors.up : CFG.colors.down
            }
        ];

        // 过滤掉值为 0 的项
        pieItems = pieItems.filter(function (item) { return item.value > 0; });

        if (pieItems.length === 0) {
            structureChart.setOption({
                title: {
                    text: '暂无数据',
                    textStyle: { color: '#8b949e', fontSize: 14 },
                    left: 'center',
                    top: 'center'
                }
            }, true);
            return;
        }

        var option = {
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(36, 36, 52, 0.95)',
                borderColor: '#3d3d5c',
                borderWidth: 1,
                textStyle: { color: '#e0e0e0', fontSize: 12 },
                formatter: function (params) {
                    var direction = params.data.realVal >= 0 ? '净流入' : '净流出';
                    return '<strong>' + params.name + '</strong><br/>' +
                        direction + ': ' + formatAmount(params.data.realVal) + '<br/>' +
                        '占比: ' + params.percent + '%';
                }
            },
            series: [
                {
                    type: 'pie',
                    radius: ['45%', '70%'],
                    center: ['50%', '50%'],
                    avoidLabelOverlap: true,
                    padAngle: 2,
                    itemStyle: {
                        borderRadius: 4,
                        borderColor: '#1a1a2e',
                        borderWidth: 2
                    },
                    label: {
                        color: CFG.colors.text,
                        fontSize: 11,
                        formatter: function (params) {
                            return params.name + '\n' + params.percent + '%';
                        }
                    },
                    labelLine: {
                        lineStyle: { color: 'rgba(139, 148, 158, 0.5)' }
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    },
                    data: pieItems.map(function (item) {
                        return {
                            name: item.name,
                            value: item.value,
                            realVal: item.realVal,
                            itemStyle: { color: item.color }
                        };
                    })
                }
            ]
        };

        structureChart.setOption(option, true);
    }

    // ============================================================
    //  数据加载 - 板块资金排行
    // ============================================================
    function loadSectorData() {
        if (dom.sectorTableBody) {
            dom.sectorTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">加载中...</td></tr>';
        }
        fetchData(
            '/api/sector-list?type=ALL_BK',
            function (resp) {
                if (resp) {
                    var list = resp;
                    if (Array.isArray(list)) {
                        updateSectorTable(list);
                    } else if (list.list && Array.isArray(list.list)) {
                        updateSectorTable(list.list);
                    } else {
                        showSectorTableEmpty();
                    }
                } else {
                    showSectorTableEmpty();
                }
            },
            function () {
                showSectorTableEmpty();
            }
        );
    }

    function showSectorTableEmpty() {
        if (dom.sectorTableBody) {
            dom.sectorTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">暂无数据</td></tr>';
        }
    }

    // ============================================================
    //  渲染 - 板块资金排行表
    // ============================================================
    function updateSectorTable(data) {
        if (!data || data.length === 0) {
            showSectorTableEmpty();
            return;
        }

        // 按主力净流入绝对值降序排列
        var sorted = data.slice().sort(function (a, b) {
            return Math.abs(b.main_net || 0) - Math.abs(a.main_net || 0);
        });

        // 取前 20 条
        var top = sorted.slice(0, 20);

        var html = '';
        for (var i = 0; i < top.length; i++) {
            var item = top[i];
            var rank = i + 1;
            var name = item.name || '--';
            var mainNet = item.main_net;
            var mainPct = item.main_pct;
            var changePct = item.change_pct;
            var mainNetClass = getChangeClass(mainNet);
            var changeClass = getChangeClass(changePct);

            html += '<tr>' +
                '<td style="color:#8b949e;">' + rank + '</td>' +
                '<td>' + escapeHtml(name) + '</td>' +
                '<td class="' + mainNetClass + '">' + formatAmount(mainNet) + '</td>' +
                '<td class="' + mainNetClass + '">' + (mainPct != null ? formatPct(mainPct) : '--') + '</td>' +
                '<td class="' + changeClass + '">' + (changePct != null ? formatPct(changePct) : '--') + '</td>' +
                '</tr>';
        }

        dom.sectorTableBody.innerHTML = html;
    }

    // ============================================================
    //  工具函数
    // ============================================================

    /** 补零 */
    function padZero(n) {
        return n < 10 ? '0' + n : '' + n;
    }

    /** 简单的 HTML 转义 */
    function escapeHtml(str) {
        if (typeof str !== 'string') return str;
        var div = doc.createElement('div');
        div.appendChild(doc.createTextNode(str));
        return div.innerHTML;
    }

    // ============================================================
    //  初始化入口
    // ============================================================
    function init() {
        cacheDOM();
        initCharts();
        bindEvents();

        // 加载初始数据
        loadAllData();
    }

    // 确保 DOM 就绪后执行
    if (doc.readyState === 'loading') {
        doc.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window, document);