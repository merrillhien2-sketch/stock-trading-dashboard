/**
 * 资金流向公共模块 - chart-fundflow.js
 *
 * 提供统一的资金流向柱状图配置构建、实时资金流向面板HTML生成能力，
 * 供 a_stock.js、kline.js、us_kline.js、fundflow_analysis.js 等页面复用。
 *
 * 依赖: ECharts (全局 echarts), common.js (initChart, formatAmount, formatPct, getChangeClass,
 *        chartTextColor, chartGridColor, chartUpColor, chartDownColor)
 * 挂载: window.FundFlowChart
 */
(function (win) {
    "use strict";

    var FundFlowChart = {};

    // ----------------------------------------------------------------
    // 默认颜色配置
    // ----------------------------------------------------------------
    var DEFAULT_COLORS = {
        up:   (typeof chartUpColor   !== "undefined") ? chartUpColor   : "#ff4d4f",
        down: (typeof chartDownColor !== "undefined") ? chartDownColor : "#00b87a",
        text: (typeof chartTextColor !== "undefined") ? chartTextColor : "#8b949e",
        grid: (typeof chartGridColor !== "undefined") ? chartGridColor : "#30363d"
    };

    function _getColors(colors) {
        return {
            up:   (colors && colors.up   !== undefined) ? colors.up   : DEFAULT_COLORS.up,
            down: (colors && colors.down !== undefined) ? colors.down : DEFAULT_COLORS.down,
            text: (colors && colors.text !== undefined) ? colors.text : DEFAULT_COLORS.text,
            grid: (colors && colors.grid !== undefined) ? colors.grid : DEFAULT_COLORS.grid
        };
    }

    // =================================================================
    //  1. buildBarOption(params)
    // =================================================================
    /**
     * 构建资金流向柱状图 ECharts 配置
     *
     * @param {Object} params
     * @param {string[]} params.dates   - 日期数组
     * @param {number[]} params.mainNet - 主力净流入数据
     * @param {number[]} params.superNet - 超大单净流入数据
     * @param {number[]} params.bigNet  - 大单净流入数据
     * @param {Object}   [params.colors] - 颜色覆盖 {up, down}
     * @param {string[]} [params.legendData] - 图例名称（默认 ["主力净流入","超大单净流入","大单净流入"]）
     * @param {Object}   [params.dataZoom] - dataZoom配置覆盖 {start, end}
     * @param {Object}   [params.grid]    - grid配置覆盖
     * @returns {Object} ECharts option 配置
     */
    FundFlowChart.buildBarOption = function (params) {
        var colors = _getColors(params.colors);
        var dzStart = (params.dataZoom && params.dataZoom.start !== undefined) ? params.dataZoom.start : 0;
        var dzEnd   = (params.dataZoom && params.dataZoom.end   !== undefined) ? params.dataZoom.end   : 100;

        var legendData = params.legendData || ["\u4e3b\u529b\u51c0\u6d41\u5165", "\u8d85\u5927\u5355\u51c0\u6d41\u5165", "\u5927\u5355\u51c0\u6d41\u5165"];

        // 为每个柱子设置红涨绿跌颜色
        function buildColoredData(rawData) {
            var result = [];
            for (var i = 0; i < rawData.length; i++) {
                var val = rawData[i];
                result.push({
                    value: val,
                    itemStyle: {
                        color: val >= 0 ? colors.up : colors.down
                    }
                });
            }
            return result;
        }

        var mainData  = buildColoredData(params.mainNet  || []);
        var superData = buildColoredData(params.superNet || []);
        var bigData   = buildColoredData(params.bigNet   || []);

        // Y轴 formatter
        function yAxisFormatter(val) {
            var abs = Math.abs(val);
            if (abs >= 1e8) return (val / 1e8).toFixed(1) + "\u4ebf";
            if (abs >= 1e4) return (val / 1e4).toFixed(0) + "\u4e07";
            return val;
        }

        // grid 配置
        var gridCfg = { left: "2%", right: "4%", bottom: "14%", top: 40, containLabel: true };
        if (params.grid) {
            for (var gk in params.grid) {
                if (params.grid.hasOwnProperty(gk)) gridCfg[gk] = params.grid[gk];
            }
        }

        var option = {
            backgroundColor: "transparent",
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow" },
                borderWidth: 1,
                borderColor: colors.grid,
                backgroundColor: "rgba(22,27,34,0.95)",
                textStyle: { color: "#e6edf3", fontSize: 12 },
                formatter: function (tipParams) {
                    var html = '<div style="font-weight:600;margin-bottom:6px;font-size:13px;">' + tipParams[0].axisValue + "</div>";
                    tipParams.forEach(function (p) {
                        var val = p.value;
                        var clr = val >= 0 ? colors.up : colors.down;
                        var prefix = val >= 0 ? "+" : "";
                        html += p.marker + p.seriesName + ': <span style="color:' + clr + ';font-weight:600;">' + prefix + formatAmount(val) + "</span><br/>";
                    });
                    return html;
                }
            },
            legend: {
                data: legendData,
                top: 5,
                textStyle: { color: colors.text, fontSize: 12 },
                itemWidth: 14,
                itemHeight: 10
            },
            grid: gridCfg,
            xAxis: {
                type: "category",
                data: params.dates,
                axisLine: { lineStyle: { color: colors.grid } },
                axisLabel: { color: colors.text, fontSize: 10, rotate: 30 }
            },
            yAxis: {
                type: "value",
                axisLabel: {
                    color: colors.text,
                    fontSize: 11,
                    formatter: yAxisFormatter
                },
                splitLine: { lineStyle: { color: colors.grid } }
            },
            dataZoom: [
                { type: "inside", start: dzStart, end: dzEnd },
                {
                    show: true,
                    type: "slider",
                    bottom: 5,
                    height: 18,
                    start: dzStart,
                    end: dzEnd,
                    textStyle: { color: colors.text },
                    borderColor: colors.grid,
                    fillerColor: "rgba(47,129,247,0.15)",
                    handleStyle: { color: "#2f81f7" }
                }
            ],
            series: [
                {
                    name: legendData[0],
                    type: "bar",
                    data: mainData
                },
                {
                    name: legendData[1],
                    type: "bar",
                    data: superData
                },
                {
                    name: legendData[2],
                    type: "bar",
                    data: bigData
                }
            ]
        };

        return option;
    };

    // =================================================================
    //  2. buildRealtimeFlowHtml(data)
    // =================================================================
    /**
     * 生成实时资金流向面板HTML
     *
     * @param {Object} data
     * @param {number} data.mainNet    - 主力净流入
     * @param {number} data.mainPct    - 主力净流入占比
     * @param {number} data.superNet   - 超大单净流入
     * @param {number} data.superPct   - 超大单净流入占比
     * @param {number} data.bigNet     - 大单净流入
     * @param {number} data.bigPct     - 大单净流入占比
     * @param {number} data.midNet     - 中单净流入
     * @param {number} data.midPct     - 中单净流入占比
     * @param {number} data.smallNet   - 小单净流入
     * @param {number} data.smallPct   - 小单净流入占比
     * @returns {string} HTML字符串
     */
    FundFlowChart.buildRealtimeFlowHtml = function (data) {
        if (!data) return "";

        var items = [
            { label: "\u4e3b\u529b\u51c0\u6d41\u5165", net: data.mainNet,  pct: data.mainPct  },
            { label: "\u8d85\u5927\u5355\u51c0\u6d41\u5165", net: data.superNet, pct: data.superPct },
            { label: "\u5927\u5355\u51c0\u6d41\u5165",   net: data.bigNet,   pct: data.bigPct   },
            { label: "\u4e2d\u5355\u51c0\u6d41\u5165",   net: data.midNet,   pct: data.midPct   },
            { label: "\u5c0f\u5355\u51c0\u6d41\u5165",   net: data.smallNet, pct: data.smallPct }
        ];

        var html = "";
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var cls = getChangeClass(item.net);
            var prefix = item.net >= 0 ? "+" : "";
            var pctText = (item.pct !== undefined && item.pct !== null && item.pct !== "")
                ? formatPct(item.pct)
                : "--";

            html += '<div class="d-flex justify-content-between align-items-center" style="padding:10px 0;border-bottom:1px solid var(--border-color);">';
            html += '<span class="text-muted" style="font-size:13px;">' + item.label + "</span>";
            html += '<div style="text-align:right;">';
            html += '<div class="fw-600 ' + cls + '" style="font-size:15px;font-variant-numeric:tabular-nums;">' + prefix + formatAmount(item.net) + "</div>";
            html += '<div class="' + cls + '" style="font-size:11px;margin-top:2px;">\u5360\u6bd4 ' + pctText + "</div>";
            html += "</div>";
            html += "</div>";
        }

        return html;
    };

    // =================================================================
    //  3. renderFundFlowChart(domId, option)
    // =================================================================
    /**
     * 渲染资金流向图到指定DOM元素
     * 如果DOM上尚无ECharts实例，会自动通过 initChart 创建
     *
     * @param {string} domId  - DOM元素ID
     * @param {Object} option - ECharts option 配置
     * @returns {Object|null} ECharts 实例
     */
    FundFlowChart.renderFundFlowChart = function (domId, option) {
        var chart = echarts.getInstanceByDom(document.getElementById(domId)) || initChart(domId);
        if (!chart) return null;
        chart.setOption(option, true);
        return chart;
    };

    // 挂载到全局
    win.FundFlowChart = FundFlowChart;

})(window);
