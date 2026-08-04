/**
 * K线图公共模块 - chart-kline.js
 *
 * 提供统一的K线图数据处理和ECharts配置构建能力，
 * 供 a_stock.js、kline.js、us_stock.js、us_kline.js 等页面复用。
 *
 * 依赖: ECharts (全局 echarts), common.js (initChart, formatPrice, formatAmount, formatPct,
 *        chartTextColor, chartGridColor, chartUpColor, chartDownColor)
 * 挂载: window.KlineChart
 */
(function (win) {
    "use strict";

    var KlineChart = {};

    // ----------------------------------------------------------------
    // 默认颜色配置（可被外部覆盖）
    // ----------------------------------------------------------------
    var DEFAULT_COLORS = {
        up:       (typeof chartUpColor   !== "undefined") ? chartUpColor   : "#ff4d4f",
        down:     (typeof chartDownColor !== "undefined") ? chartDownColor : "#00b87a",
        ma5:      "#d29922",
        ma10:     "#2f81f7",
        ma20:     "#a371f7",
        text:     (typeof chartTextColor !== "undefined") ? chartTextColor : "#8b949e",
        grid:     (typeof chartGridColor !== "undefined") ? chartGridColor : "#30363d"
    };

    /**
     * 合并颜色配置，调用者传入的 colors 覆盖默认值
     */
    function _mergeColors(colors) {
        var c = {};
        for (var k in DEFAULT_COLORS) {
            if (DEFAULT_COLORS.hasOwnProperty(k)) {
                c[k] = (colors && colors[k] !== undefined) ? colors[k] : DEFAULT_COLORS[k];
            }
        }
        return c;
    }

    // =================================================================
    //  1. calcMA(closes, period)
    // =================================================================
    /**
     * 计算移动平均线（MA）
     * @param {number[]} closes - 收盘价数组
     * @param {number}   period - 均线周期（如 5、10、20）
     * @returns {Array}  MA值数组，不足周期位置填充 "-"
     */
    KlineChart.calcMA = function (closes, period) {
        var result = [];
        for (var i = 0; i < closes.length; i++) {
            if (i < period - 1) {
                result.push("-");
                continue;
            }
            var sum = 0;
            for (var j = 0; j < period; j++) {
                sum += closes[i - j];
            }
            result.push(+(sum / period).toFixed(2));
        }
        return result;
    };

    // =================================================================
    //  2. parseKlineData(klines)
    // =================================================================
    /**
     * 解析K线原始数据为统一格式
     *
     * 支持两种输入格式：
     *   1) 字符串格式: "2026-07-14,52676.53,52800.20,52900.00,52500.00,1500000,200000000"
     *   2) 对象格式:   {date, open, close, high, low, volume [, amount]}
     *
     * @param {Array} klines - 原始K线数据数组
     * @returns {{ dates:string[], ohlcData:number[][], volumeData:Object[], closes:number[], amounts:number[] }}
     */
    KlineChart.parseKlineData = function (klines) {
        var dates = [];
        var ohlcData = [];     // [open, close, low, high]
        var volumeData = [];
        var closes = [];
        var amounts = [];

        var upColor   = DEFAULT_COLORS.up;
        var downColor = DEFAULT_COLORS.down;

        for (var i = 0; i < klines.length; i++) {
            var k = klines[i];
            var item;

            if (typeof k === "string") {
                // 字符串格式解析
                var parts = k.split(",");
                item = {
                    date:   parts[0],
                    open:   parseFloat(parts[1]),
                    close:  parseFloat(parts[2]),
                    high:   parseFloat(parts[3]),
                    low:    parseFloat(parts[4]),
                    volume: parseFloat(parts[5]),
                    amount: (parts.length > 6 ? parseFloat(parts[6]) : 0)
                };
            } else {
                // 对象格式解析
                item = {
                    date:   k.date,
                    open:   parseFloat(k.open),
                    close:  parseFloat(k.close),
                    high:  parseFloat(k.high),
                    low:    parseFloat(k.low),
                    volume: parseFloat(k.volume),
                    amount: (k.amount !== undefined ? parseFloat(k.amount) : 0)
                };
            }

            dates.push(item.date);
            ohlcData.push([item.open, item.close, item.low, item.high]);
            closes.push(item.close);
            amounts.push(item.amount);

            // 成交量柱状图：红涨绿跌
            var isUp = item.close >= item.open;
            volumeData.push({
                value: item.volume,
                itemStyle: {
                    color: isUp ? upColor : downColor
                }
            });
        }

        return {
            dates:      dates,
            ohlcData:   ohlcData,
            volumeData: volumeData,
            closes:     closes,
            amounts:    amounts
        };
    };

    // =================================================================
    //  3. buildKlineOption(params)
    // =================================================================
    /**
     * 构建K线图 ECharts 配置（蜡烛图 + 成交量 + MA均线 + dataZoom + tooltip）
     *
     * @param {Object} params
     * @param {string[]}   params.dates      - 日期数组
     * @param {number[][]} params.ohlcData   - OHLC数据 [[open,close,low,high], ...]
     * @param {Object[]}   params.volumeData - 成交量数据（含 itemStyle）
     * @param {Array[]}    params.maData      - MA均线数据 [ma5, ma10, ma20]
     * @param {Object}     [params.colors]    - 颜色覆盖 {up, down, ma5, ma10, ma20, grid}
     * @param {number[]}   [params.amounts]   - 成交额数组（用于tooltip显示）
     * @param {Object}     [params.dataZoom]  - dataZoom配置覆盖 {start, end}
     * @param {Object}     [params.grid]      - grid配置覆盖
     * @param {string}     [params.backgroundColor] - 背景色，默认 "transparent"
     * @returns {Object}   ECharts option 配置
     */
    KlineChart.buildKlineOption = function (params) {
        var colors = _mergeColors(params.colors);
        var textColor = colors.text;
        var gridColor = colors.grid;
        var dzStart = (params.dataZoom && params.dataZoom.start !== undefined) ? params.dataZoom.start : 60;
        var dzEnd   = (params.dataZoom && params.dataZoom.end   !== undefined) ? params.dataZoom.end   : 100;

        var gridMain = {
            left: "3%",
            right: "6%",
            top: 40,
            height: "58%",
            containLabel: true
        };
        var gridVolume = {
            left: "3%",
            right: "6%",
            top: "74%",
            height: "18%",
            containLabel: true
        };
        if (params.grid) {
            if (params.grid[0]) {
                for (var gk in params.grid[0]) {
                    if (params.grid[0].hasOwnProperty(gk)) gridMain[gk] = params.grid[0][gk];
                }
            }
            if (params.grid[1]) {
                for (var gk2 in params.grid[1]) {
                    if (params.grid[1].hasOwnProperty(gk2)) gridVolume[gk2] = params.grid[1][gk2];
                }
            }
        }

        // MA均线数据
        var ma5  = params.maData && params.maData[0] ? params.maData[0] : [];
        var ma10 = params.maData && params.maData[1] ? params.maData[1] : [];
        var ma20 = params.maData && params.maData[2] ? params.maData[2] : [];

        // 成交额缓存（tooltip用）
        var amounts = params.amounts || [];

        // Y轴成交量 formatter
        function volumeFormatter(val) {
            var abs = Math.abs(val);
            if (abs >= 1e8) return (val / 1e8).toFixed(1) + "\u4ebf";
            if (abs >= 1e4) return (val / 1e4).toFixed(0) + "\u4e07";
            return val;
        }

        var option = {
            backgroundColor: params.backgroundColor || "transparent",
            animation: false,
            legend: {
                data: ["K\u7ebf", "MA5", "MA10", "MA20", "\u6210\u4ea4\u91cf"],
                top: 5,
                textStyle: { color: textColor, fontSize: 12 },
                itemWidth: 14,
                itemHeight: 10
            },
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "cross" },
                borderWidth: 1,
                borderColor: gridColor,
                backgroundColor: "rgba(22,27,34,0.95)",
                textStyle: { color: "#e6edf3", fontSize: 12 },
                formatter: function (tipParams) {
                    var date = tipParams[0].axisValue;
                    var html = '<div style="font-weight:600;margin-bottom:6px;font-size:13px;">' + date + "</div>";

                    tipParams.forEach(function (p) {
                        if (p.seriesType === "candlestick") {
                            var d = p.data;
                            var open  = d[0], close = d[1], low = d[2], high = d[3];
                            var change = close - open;
                            var changePct = open !== 0 ? (change / open * 100) : 0;
                            var clr = change >= 0 ? colors.up : colors.down;

                            html += '<div style="margin-bottom:4px;">';
                            html += '<span style="color:' + textColor + ';">\u5f00</span> ' + formatPrice(open) + "  ";
                            html += '<span style="color:' + textColor + ';">\u6536</span> <span style="color:' + clr + ';font-weight:600;">' + formatPrice(close) + "</span><br/>";
                            html += '<span style="color:' + textColor + ';">\u9ad8</span> ' + formatPrice(high) + "  ";
                            html += '<span style="color:' + textColor + ';">\u4f4e</span> ' + formatPrice(low) + "<br/>";
                            html += '<span style="color:' + clr + ';font-weight:600;">\u6da8\u8dcc ' + (change >= 0 ? "+" : "") + formatPrice(change) + " (" + formatPct(changePct) + ")</span>";
                            html += "</div>";
                        } else if (p.seriesType === "line") {
                            var val = p.data;
                            if (val === "-" || val === null || val === undefined) {
                                html += p.marker + p.seriesName + ": --<br/>";
                            } else {
                                html += p.marker + p.seriesName + ": " + formatPrice(val) + "<br/>";
                            }
                        } else if (p.seriesType === "bar") {
                            var vol = (typeof p.data === "object" && p.data !== null) ? p.data.value : p.data;
                            var idx = p.dataIndex;
                            var amt = amounts[idx] || 0;
                            html += p.marker + p.seriesName + ": " + formatAmount(vol) + "<br/>";
                            if (amt > 0) {
                                html += '<span style="color:' + textColor + ';padding-left:20px;">\u6210\u4ea4\u989d: ' + formatAmount(amt) + "</span><br/>";
                            }
                        }
                    });

                    return html;
                }
            },
            grid: [gridMain, gridVolume],
            xAxis: [
                {
                    type: "category",
                    data: params.dates,
                    scale: true,
                    boundaryGap: false,
                    axisLine: { lineStyle: { color: gridColor } },
                    axisLabel: { color: textColor, fontSize: 11 },
                    splitLine: { show: false },
                    min: "dataMin",
                    max: "dataMax",
                    axisPointer: { z: 100 }
                },
                {
                    type: "category",
                    gridIndex: 1,
                    data: params.dates,
                    scale: true,
                    boundaryGap: false,
                    axisLine: { lineStyle: { color: gridColor } },
                    axisLabel: { show: false },
                    splitLine: { show: false },
                    min: "dataMin",
                    max: "dataMax",
                    axisPointer: { z: 100 }
                }
            ],
            yAxis: [
                {
                    scale: true,
                    splitLine: { lineStyle: { color: gridColor } },
                    axisLabel: { color: textColor, fontSize: 11 }
                },
                {
                    gridIndex: 1,
                    splitNumber: 2,
                    axisLabel: {
                        color: textColor,
                        fontSize: 10,
                        formatter: volumeFormatter
                    },
                    splitLine: { show: false }
                }
            ],
            dataZoom: [
                {
                    type: "inside",
                    xAxisIndex: [0, 1],
                    start: dzStart,
                    end: dzEnd
                },
                {
                    show: true,
                    type: "slider",
                    xAxisIndex: [0, 1],
                    bottom: 8,
                    height: 22,
                    start: dzStart,
                    end: dzEnd,
                    textStyle: { color: textColor },
                    borderColor: gridColor,
                    fillerColor: "rgba(47,129,247,0.15)",
                    handleStyle: { color: "#2f81f7" }
                }
            ],
            series: [
                {
                    name: "K\u7ebf",
                    type: "candlestick",
                    data: params.ohlcData,
                    itemStyle: {
                        color:        colors.up,
                        color0:       colors.down,
                        borderColor:  colors.up,
                        borderColor0: colors.down
                    }
                },
                {
                    name: "MA5",
                    type: "line",
                    data: ma5,
                    smooth: false,
                    showSymbol: false,
                    lineStyle: { width: 1, color: colors.ma5 }
                },
                {
                    name: "MA10",
                    type: "line",
                    data: ma10,
                    smooth: false,
                    showSymbol: false,
                    lineStyle: { width: 1, color: colors.ma10 }
                },
                {
                    name: "MA20",
                    type: "line",
                    data: ma20,
                    smooth: false,
                    showSymbol: false,
                    lineStyle: { width: 1, color: colors.ma20 }
                },
                {
                    name: "\u6210\u4ea4\u91cf",
                    type: "bar",
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: params.volumeData,
                    barWidth: "60%"
                }
            ]
        };

        return option;
    };

    // =================================================================
    //  4. renderKlineChart(domId, option)
    // =================================================================
    /**
     * 渲染K线图到指定DOM元素
     * 如果DOM上尚无ECharts实例，会自动通过 initChart 创建
     *
     * @param {string} domId  - DOM元素ID
     * @param {Object} option - ECharts option 配置
     * @returns {Object|null} ECharts 实例
     */
    KlineChart.renderKlineChart = function (domId, option) {
        var chart = echarts.getInstanceByDom(document.getElementById(domId)) || initChart(domId);
        if (!chart) return null;
        chart.setOption(option, true);
        return chart;
    };

    // 挂载到全局
    win.KlineChart = KlineChart;

})(window);
