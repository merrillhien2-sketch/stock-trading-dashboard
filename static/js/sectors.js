/**
 * 板块资金流向分析 - Sectors Capital Flow Analysis
 * 支持行业板块(ALL_BK)、概念板块(GN_BK)、地域板块(DY_BK)
 */
(function () {
    'use strict';

    // ============ 状态管理 ============
    var currentType = 'ALL_BK';
    var sectorData = [];
    var filteredData = [];

    // 图表实例
    var barChart = null;
    var pieChart = null;

    // ============ DOM 引用 ============
    var $ = function (id) { return document.getElementById(id); };

    var doms = {
        tabs: $('sectorTypeTabs'),
        searchInput: $('searchInput'),
        tableBody: $('sectorTableBody'),
        totalCount: $('totalCount'),
        upCount: $('upCount'),
        downCount: $('downCount'),
        totalNetInflow: $('totalNetInflow'),
        updateTime: $('updateTime'),
        barChart: $('barChart'),
        pieChart: $('pieChart'),
    };

    // ============ 初始化图表 ============
    function initCharts() {
        barChart = initChart('barChart');
        pieChart = initChart('pieChart');
    }

    // ============ 获取板块数据 ============
    function loadSectorData(type) {
        var url = '/api/sector-list?type=' + type;

        // 显示加载状态
        doms.tableBody.innerHTML =
            '<tr><td colspan="6" class="text-center text-muted py-4">' +
            '<i class="fas fa-spinner fa-spin me-2"></i>加载中...</td></tr>';

        fetchData(url, function (resp) {
            if (resp && Array.isArray(resp) && resp.length > 0) {
                sectorData = resp;
                filteredData = sectorData.slice();
                renderAll();
                doms.updateTime.textContent = getCurrentTime();
            } else {
                // 数据为空，显示暂无数据
                sectorData = [];
                filteredData = [];
                renderAll();
                doms.updateTime.textContent = getCurrentTime();
            }
        }, function (err) {
            showError('数据源维护中，敬请期待');
        });
    }

    // ============ 渲染所有内容 ============
    function renderAll() {
        updateStats();
        renderTable();
        renderBarChart();
        renderPieChart();
    }

    // ============ 更新统计卡片 ============
    function updateStats() {
        var total = sectorData.length;
        var up = 0;
        var down = 0;
        var totalNet = 0;

        sectorData.forEach(function (item) {
            var pct = parseFloat(item.change_pct) || 0;
            var net = parseFloat(item.main_net) || 0;
            if (pct > 0) up++;
            else if (pct < 0) down++;
            totalNet += net;
        });

        doms.totalCount.textContent = total;
        doms.upCount.textContent = up;
        doms.downCount.textContent = down;
        doms.totalNetInflow.textContent = formatAmount(totalNet);
    }

    // ============ 渲染表格 ============
    function renderTable() {
        var data = filteredData;
        if (!data || data.length === 0) {
            doms.tableBody.innerHTML =
                '<tr><td colspan="6" class="text-center text-muted py-4">' +
                '<i class="fas fa-info-circle me-2"></i>数据源维护中，敬请期待</td></tr>';
            return;
        }

        var html = '';
        data.forEach(function (item, index) {
            var pct = parseFloat(item.change_pct) || 0;
            var net = parseFloat(item.main_net) || 0;
            var netPct = parseFloat(item.main_pct) || 0;
            var price = parseFloat(item.price) || 0;

            // 板块名称（带东方财富链接）
            var sectorName = buildSectorLink(item);

            // 涨跌幅样式
            var pctClass = getChangeClass(pct);
            var pctSign = getChangeSign(pct);
            var pctDisplay = pctSign + ' ' + formatPct(Math.abs(pct));

            // 主力净流入样式
            var netClass = getChangeClass(net);
            var netSign = getChangeSign(net);
            var netDisplay = netSign + ' ' + formatAmount(Math.abs(net));

            // 主力净流入占比样式
            var netPctClass = getChangeClass(netPct);
            var netPctSign = getChangeSign(netPct);
            var netPctDisplay = netPctSign + ' ' + formatPct(Math.abs(netPct));

            html += '<tr>' +
                '<td class="text-center text-muted">' + (index + 1) + '</td>' +
                '<td class="sector-name">' + sectorName + '</td>' +
                '<td class="text-end">' + formatPrice(price) + '</td>' +
                '<td class="text-end ' + pctClass + '">' + pctDisplay + '</td>' +
                '<td class="text-end ' + netClass + '">' + netDisplay + '</td>' +
                '<td class="text-end ' + netPctClass + '">' + netPctDisplay + '</td>' +
                '</tr>';
        });

        doms.tableBody.innerHTML = html;
    }

    // ============ 构建板块链接 ============
    function buildSectorLink(item) {
        // 东方财富板块详情页URL：https://quote.eastmoney.com/bk/90.{code}.html
        // 行业板块: ALL_BK -> 90.BKxxxx
        // 概念板块: GN_BK -> 90.BKxxxx
        // 地域板块: DY_BK -> 90.BKxxxx
        var code = item.code || '';
        var name = item.name || code;
        var detailUrl = 'https://quote.eastmoney.com/bk/90.' + code + '.html';
        return '<a href="' + detailUrl + '" target="_blank" class="sector-link" title="查看详情">' +
            escapeHtml(name) + '</a>';
    }

    // ============ 渲染柱状图 (TOP10 主力净流入) ============
    function renderBarChart() {
        if (!barChart) return;

        // 按主力净流入排序，取前10（正负各取有代表性的）
        var sorted = sectorData.slice().sort(function (a, b) {
            return (Math.abs(parseFloat(b.main_net) || 0)) - (Math.abs(parseFloat(a.main_net) || 0));
        });

        var top10 = sorted.slice(0, 10);
        // 按净流入值正序排列，让柱状图看起来更自然
        top10.sort(function (a, b) {
            return (parseFloat(a.main_net) || 0) - (parseFloat(b.main_net) || 0);
        });

        var names = top10.map(function (item) {
            var n = item.name || '';
            return n.length > 6 ? n.substring(0, 6) + '..' : n;
        });
        var values = top10.map(function (item) {
            return parseFloat(item.main_net) || 0;
        });
        var colors = values.map(function (v) {
            return v >= 0 ? chartUpColor : chartDownColor;
        });

        var option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(30, 30, 40, 0.9)',
                borderColor: '#333',
                textStyle: { color: '#e0e0e0', fontSize: 12 },
                formatter: function (params) {
                    var p = params[0];
                    var item = top10[p.dataIndex];
                    var name = item.name || '';
                    var net = parseFloat(item.main_net) || 0;
                    var netPct = parseFloat(item.main_pct) || 0;
                    var netSign = net >= 0 ? '+' : '';
                    var netPctSign = netPct >= 0 ? '+' : '';
                    return '<strong>' + escapeHtml(name) + '</strong><br/>' +
                        '主力净流入：' + netSign + formatAmount(Math.abs(net)) + '<br/>' +
                        '净流入占比：' + netPctSign + formatPct(Math.abs(netPct));
                }
            },
            grid: {
                left: 20,
                right: 20,
                bottom: 30,
                top: 15,
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: names,
                axisLine: { lineStyle: { color: '#333' } },
                axisLabel: {
                    color: chartTextColor,
                    fontSize: 11,
                    interval: 0,
                    rotate: 30
                },
                axisTick: { show: false }
            },
            yAxis: {
                type: 'value',
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: {
                    color: chartTextColor,
                    fontSize: 11,
                    formatter: function (val) {
                        if (Math.abs(val) >= 100000000) {
                            return (val / 100000000).toFixed(1) + '亿';
                        } else if (Math.abs(val) >= 10000) {
                            return (val / 10000).toFixed(1) + '万';
                        }
                        return val.toFixed(0);
                    }
                },
                splitLine: {
                    lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' }
                }
            },
            series: [{
                type: 'bar',
                data: values.map(function (v, i) {
                    return {
                        value: v,
                        itemStyle: {
                            color: colors[i],
                            borderRadius: [2, 2, 0, 0]
                        }
                    };
                }),
                barWidth: '60%',
                label: {
                    show: true,
                    position: 'top',
                    color: chartTextColor,
                    fontSize: 11,
                    formatter: function (p) {
                        var v = p.value;
                        if (Math.abs(v) >= 100000000) {
                            return (v / 100000000).toFixed(1) + '亿';
                        } else if (Math.abs(v) >= 10000) {
                            return (v / 10000).toFixed(1) + '万';
                        }
                        return v.toFixed(0);
                    }
                }
            }]
        };

        barChart.setOption(option, true);
        barChart.resize();
    }

    // ============ 渲染饼图 (资金流向分布) ============
    function renderPieChart() {
        if (!pieChart) return;

        // 按主力净流入绝对值排序，取前8个板块，其余归为"其他"
        var sorted = sectorData.slice().sort(function (a, b) {
            return Math.abs(parseFloat(b.main_net) || 0) - Math.abs(parseFloat(a.main_net) || 0);
        });

        var top8 = sorted.slice(0, 8);
        var rest = sorted.slice(8);

        var pieData = [];
        top8.forEach(function (item) {
            var net = parseFloat(item.main_net) || 0;
            if (net !== 0) {
                pieData.push({
                    name: item.name || item.code,
                    value: Math.abs(net)
                });
            }
        });

        // 计算剩余总金额
        var restTotal = 0;
        rest.forEach(function (item) {
            restTotal += Math.abs(parseFloat(item.main_net) || 0);
        });
        if (restTotal > 0 && rest.length > 0) {
            pieData.push({ name: '其他', value: restTotal });
        }

        // 如果没有任何数据，显示占位
        if (pieData.length === 0) {
            pieData.push({ name: '暂无数据', value: 1 });
        }

        // 配色
        var colorPalette = [
            '#ff4d4f', '#00b87a', '#1890ff', '#faad14',
            '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16',
            '#555555'
        ];

        var option = {
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(30, 30, 40, 0.9)',
                borderColor: '#333',
                textStyle: { color: '#e0e0e0', fontSize: 12 },
                formatter: function (p) {
                    var pct = p.percent ? p.percent.toFixed(1) : '0.0';
                    return '<strong>' + escapeHtml(p.name) + '</strong><br/>' +
                        '金额：' + formatAmount(p.value) + '<br/>' +
                        '占比：' + pct + '%';
                }
            },
            color: colorPalette,
            series: [{
                type: 'pie',
                radius: ['35%', '65%'],
                center: ['50%', '50%'],
                avoidLabelOverlap: true,
                padAngle: 1,
                itemStyle: {
                    borderRadius: 4,
                    borderColor: 'rgba(30,30,40,0.8)',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    color: chartTextColor,
                    fontSize: 11,
                    formatter: function (p) {
                        var pct = p.percent ? p.percent.toFixed(1) : '0.0';
                        if (pct < 3) return '';
                        return p.name + ' ' + pct + '%';
                    }
                },
                labelLine: {
                    lineStyle: { color: 'rgba(255,255,255,0.15)' },
                    smooth: true
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0,0,0,0.5)'
                    }
                },
                data: pieData
            }]
        };

        pieChart.setOption(option, true);
        pieChart.resize();
    }

    // ============ 搜索过滤 ============
    function handleSearch() {
        var keyword = doms.searchInput.value.trim().toLowerCase();
        if (!keyword) {
            filteredData = sectorData.slice();
        } else {
            filteredData = sectorData.filter(function (item) {
                return (item.name || '').toLowerCase().indexOf(keyword) !== -1;
            });
        }
        renderTable();
    }

    // ============ 切换板块类型 ============
    function switchType(type) {
        if (type === currentType) return;
        currentType = type;

        // 更新Tab样式
        var btns = doms.tabs.querySelectorAll('.btn-item');
        btns.forEach(function (btn) {
            if (btn.dataset.type === type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 清空搜索
        doms.searchInput.value = '';
        // 重新加载数据
        loadSectorData(type);
    }

    // ============ 辅助函数 ============
    function getCurrentTime() {
        var now = new Date();
        var y = now.getFullYear();
        var m = ('0' + (now.getMonth() + 1)).slice(-2);
        var d = ('0' + now.getDate()).slice(-2);
        var h = ('0' + now.getHours()).slice(-2);
        var mi = ('0' + now.getMinutes()).slice(-2);
        var s = ('0' + now.getSeconds()).slice(-2);
        return y + '-' + m + '-' + d + ' ' + h + ':' + mi + ':' + s;
    }

    function showError(msg) {
        doms.tableBody.innerHTML =
            '<tr><td colspan="6" class="text-center py-4" style="color:var(--text-muted);">' +
            '<i class="fas fa-info-circle me-2"></i>' + escapeHtml(msg || '数据源维护中，敬请期待') + '</td></tr>';
        // 图表也显示提示
        if (barChart) {
            barChart.setOption({
                title: { text: msg || '数据源维护中，敬请期待', left: 'center', top: 'center', textStyle: { color: chartTextColor, fontSize: 14 } }
            }, true);
        }
        if (pieChart) {
            pieChart.setOption({
                title: { text: msg || '数据源维护中，敬请期待', left: 'center', top: 'center', textStyle: { color: chartTextColor, fontSize: 14 } }
            }, true);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ============ 防抖 ============
    function debounce(fn, delay) {
        var timer = null;
        return function () {
            var args = arguments;
            var ctx = this;
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(ctx, args);
            }, delay);
        };
    }

    // ============ 窗口自适应 ============
    function handleResize() {
        if (barChart) barChart.resize();
        if (pieChart) pieChart.resize();
    }

    // ============ 事件绑定 ============
    function bindEvents() {
        // Tab切换（事件委托）
        doms.tabs.addEventListener('click', function (e) {
            var btn = e.target.closest('.btn-item');
            if (btn && btn.dataset.type) {
                switchType(btn.dataset.type);
            }
        });

        // 搜索输入（防抖）
        doms.searchInput.addEventListener('input', debounce(handleSearch, 300));

        // 窗口resize
        window.addEventListener('resize', handleResize);
    }

    // ============ 启动入口 ============
    function init() {
        initCharts();
        bindEvents();
        loadSectorData(currentType);
    }

    // DOM Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();