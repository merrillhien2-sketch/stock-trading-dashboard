/* ==================== 美股K线分析 JavaScript ==================== */
(function() {
    'use strict';

    // 图表实例
    var klineChart = null;
    var fundFlowChart = null;

    // 当前状态
    var currentSecid = "100.DJIA";
    var currentName = "道琼斯";
    var currentKlt = "101";

    // secid 与 新浪代码 映射
    var SECID_SYMBOL_MAP = {
        "100.DJIA": "gb_dji",
        "100.SPX":  "gb_spx",
        "100.NDAQ": "gb_ixic"
    };

    // MA线颜色
    var maColors = {
        ma5: "#d29922",
        ma10: "#2f81f7",
        ma20: "#a371f7"
    };

    // 缓存K线原始数据，供tooltip使用
    var klineRawData = { dates: [], volumes: [] };

    // 定时器引用
    var _realtimeTimer = null;


    // ==================== 计算均线 ====================
    function calculateMA(closes, dayCount) {
        var result = [];
        for (var i = 0; i < closes.length; i++) {
            if (i < dayCount - 1) {
                result.push("-");
                continue;
            }
            var sum = 0;
            for (var j = 0; j < dayCount; j++) {
                sum += closes[i - j];
            }
            result.push(+(sum / dayCount).toFixed(2));
        }
        return result;
    }


    // ==================== 获取周期名称 ====================
    function getKltName(klt) {
        var names = { "101": "日K", "102": "周K", "103": "月K" };
        return names[klt] || "日K";
    }


    // ==================== 加载美股三大指数实时行情 ====================
    function loadUSIndexRealtime() {
        var codes = ["gb_dji", "gb_ixic", "gb_spx"].join(",");
        fetchData("/api/us-index?codes=" + codes, function (data) {
            if (!data || data.length === 0) return;

            // 找到当前选中指数的行情
            var currentSymbol = SECID_SYMBOL_MAP[currentSecid];
            var currentItem = null;
            data.forEach(function (item) {
                if (item.symbol === currentSymbol) {
                    currentItem = item;
                }
            });
            if (!currentItem) currentItem = data[0];

            // 更新头部指数信息
            var cls = getChangeClass(currentItem.change_pct);
            var sign = getChangeSign(currentItem.change_pct);
            $("#indexName").text(currentItem.name || currentName);
            $("#indexPrice")
                .text(formatPrice(currentItem.price))
                .removeClass("text-up text-down text-flat")
                .addClass(cls);
            $("#indexChange")
                .text((currentItem.change >= 0 ? "+" : "") + formatPrice(currentItem.change))
                .removeClass("text-up text-down text-flat")
                .addClass(cls);
            $("#indexChangePct")
                .text(sign + " " + formatPct(currentItem.change_pct))
                .removeClass("text-up text-down text-flat")
                .addClass(cls);
        }, function (msg) {
            $("#indexName").text(currentName);
            $("#indexPrice").text("--").removeClass("text-up text-down text-flat").addClass("text-flat");
            $("#indexChange").text("--").removeClass("text-up text-down text-flat").addClass("text-flat");
            $("#indexChangePct").text("--").removeClass("text-up text-down text-flat").addClass("text-flat");
        });
    }


    // ==================== 加载K线数据并渲染 ====================
    function loadKlineData() {
        if (klineChart) {
            klineChart.showLoading({
                text: "加载中...",
                color: "#2f81f7",
                textColor: "#8b949e",
                maskColor: "rgba(13,17,23,0.8)"
            });
        }

        fetchData(
            "/api/kline?secid=" + currentSecid + "&klt=" + currentKlt + "&lmt=120",
            function (data) {
                if (!klineChart) {
                    klineChart = initChart("klineChart");
                }
                if (!klineChart) return;
                klineChart.hideLoading();

                var klines = data.klines || [];
                if (klines.length === 0) {
                    klineChart.clear();
                    klineChart.setOption({
                        title: {
                            text: "暂无K线数据（美股K线数据源可能不可用）",
                            subtext: "请查看上方实时行情与下方热门个股",
                            left: "center",
                            top: "center",
                            textStyle: { color: chartTextColor, fontSize: 14 },
                            subtextStyle: { color: "#6e7681", fontSize: 12 }
                        }
                    });
                    return;
                }

                // 美股K线数据源通常仅返回当日一条数据，无法形成有效K线走势
                // 此时以友好提示替代单根巨大K线，避免图表显示异常
                if (klines.length < 5) {
                    klineChart.clear();
                    klineChart.setOption({
                        title: {
                            text: "美股历史K线数据暂不可用",
                            subtext: "当前仅返回 " + klines.length + " 条数据，不足以绘制走势。\n请查看上方实时行情与下方热门个股。",
                            left: "center",
                            top: "center",
                            textStyle: { color: chartTextColor, fontSize: 14 },
                            subtextStyle: { color: "#6e7681", fontSize: 12, lineHeight: 18 }
                        }
                    });
                    return;
                }

                var dates = [];
                var ohlcData = [];
                var volumeData = [];
                var closes = [];
                var volumes = [];

                klines.forEach(function (k) {
                    dates.push(k.date);
                    ohlcData.push([k.open, k.close, k.low, k.high]);
                    closes.push(k.close);
                    volumes.push(k.volume);

                    var isUp = k.close >= k.open;
                    volumeData.push({
                        value: k.volume,
                        itemStyle: { color: isUp ? chartUpColor : chartDownColor }
                    });
                });

                klineRawData.dates = dates;
                klineRawData.volumes = volumes;

                var ma5 = calculateMA(closes, 5);
                var ma10 = calculateMA(closes, 10);
                var ma20 = calculateMA(closes, 20);

                var option = {
                    backgroundColor: "transparent",
                    animation: false,
                    legend: {
                        data: ["K线", "MA5", "MA10", "MA20", "成交量"],
                        top: 5,
                        textStyle: { color: chartTextColor, fontSize: 12 },
                        itemWidth: 14,
                        itemHeight: 10
                    },
                    tooltip: {
                        trigger: "axis",
                        axisPointer: { type: "cross" },
                        borderWidth: 1,
                        borderColor: chartGridColor,
                        backgroundColor: "rgba(22,27,34,0.95)",
                        textStyle: { color: "#e6edf3", fontSize: 12 },
                        formatter: function (params) {
                            var date = params[0].axisValue;
                            var html = '<div style="font-weight:600;margin-bottom:6px;font-size:13px;">' + date + "</div>";

                            params.forEach(function (p) {
                                if (p.seriesType === "candlestick") {
                                    var d = p.data;
                                    var open = d[0], close = d[1], low = d[2], high = d[3];
                                    var change = close - open;
                                    var changePct = open !== 0 ? (change / open * 100) : 0;
                                    var color = change >= 0 ? chartUpColor : chartDownColor;

                                    html += '<div style="margin-bottom:4px;">';
                                    html += '<span style="color:' + chartTextColor + ';">开</span> ' + formatPrice(open) + "  ";
                                    html += '<span style="color:' + chartTextColor + ';">收</span> <span style="color:' + color + ';font-weight:600;">' + formatPrice(close) + "</span><br/>";
                                    html += '<span style="color:' + chartTextColor + ';">高</span> ' + formatPrice(high) + "  ";
                                    html += '<span style="color:' + chartTextColor + ';">低</span> ' + formatPrice(low) + "<br/>";
                                    html += '<span style="color:' + color + ';font-weight:600;">涨跌 ' + (change >= 0 ? "+" : "") + formatPrice(change) + " (" + formatPct(changePct) + ")</span>";
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
                                    html += p.marker + p.seriesName + ": " + formatAmount(vol) + "<br/>";
                                }
                            });

                            return html;
                        }
                    },
                    grid: [
                        {
                            left: "3%",
                            right: "6%",
                            top: 40,
                            height: "58%",
                            containLabel: true
                        },
                        {
                            left: "3%",
                            right: "6%",
                            top: "74%",
                            height: "18%",
                            containLabel: true
                        }
                    ],
                    xAxis: [
                        {
                            type: "category",
                            data: dates,
                            scale: true,
                            boundaryGap: false,
                            axisLine: { lineStyle: { color: chartGridColor } },
                            axisLabel: { color: chartTextColor, fontSize: 11 },
                            splitLine: { show: false },
                            min: "dataMin",
                            max: "dataMax",
                            axisPointer: { z: 100 }
                        },
                        {
                            type: "category",
                            gridIndex: 1,
                            data: dates,
                            scale: true,
                            boundaryGap: false,
                            axisLine: { lineStyle: { color: chartGridColor } },
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
                            splitLine: { lineStyle: { color: chartGridColor } },
                            axisLabel: { color: chartTextColor, fontSize: 11 }
                        },
                        {
                            gridIndex: 1,
                            splitNumber: 2,
                            axisLabel: {
                                color: chartTextColor,
                                fontSize: 10,
                                formatter: function (val) {
                                    var abs = Math.abs(val);
                                    if (abs >= 1e8) return (val / 1e8).toFixed(1) + "亿";
                                    if (abs >= 1e4) return (val / 1e4).toFixed(0) + "万";
                                    return val;
                                }
                            },
                            splitLine: { show: false }
                        }
                    ],
                    dataZoom: [
                        {
                            type: "inside",
                            xAxisIndex: [0, 1],
                            start: 60,
                            end: 100
                        },
                        {
                            show: true,
                            type: "slider",
                            xAxisIndex: [0, 1],
                            bottom: 8,
                            height: 22,
                            start: 60,
                            end: 100,
                            textStyle: { color: chartTextColor },
                            borderColor: chartGridColor,
                            fillerColor: "rgba(47,129,247,0.15)",
                            handleStyle: { color: "#2f81f7" }
                        }
                    ],
                    series: [
                        {
                            name: "K线",
                            type: "candlestick",
                            data: ohlcData,
                            itemStyle: {
                                color: chartUpColor,
                                color0: chartDownColor,
                                borderColor: chartUpColor,
                                borderColor0: chartDownColor
                            }
                        },
                        {
                            name: "MA5",
                            type: "line",
                            data: ma5,
                            smooth: false,
                            showSymbol: false,
                            lineStyle: { width: 1, color: maColors.ma5 }
                        },
                        {
                            name: "MA10",
                            type: "line",
                            data: ma10,
                            smooth: false,
                            showSymbol: false,
                            lineStyle: { width: 1, color: maColors.ma10 }
                        },
                        {
                            name: "MA20",
                            type: "line",
                            data: ma20,
                            smooth: false,
                            showSymbol: false,
                            lineStyle: { width: 1, color: maColors.ma20 }
                        },
                        {
                            name: "成交量",
                            type: "bar",
                            xAxisIndex: 1,
                            yAxisIndex: 1,
                            data: volumeData,
                            barWidth: "60%"
                        }
                    ]
                };

                klineChart.setOption(option, true);
            },
            function (msg) {
                if (klineChart) {
                    klineChart.hideLoading();
                    klineChart.clear();
                    klineChart.setOption({
                        title: {
                            text: "数据加载失败：" + msg,
                            left: "center",
                            top: "center",
                            textStyle: { color: chartTextColor, fontSize: 14 }
                        }
                    });
                }
            }
        );
    }


    // ==================== 加载美股热门列表 ====================
    function loadHotStocks() {
        fetchData("/api/us-stocks?count=15", function (data) {
            var tbody = $("#hotStockTable");
            if (!data || data.length === 0) {
                tbody.html('<tr><td colspan="4" class="text-center text-muted py-3">暂无数据</td></tr>');
                return;
            }
            var html = "";
            data.forEach(function (item) {
                var cls = getChangeClass(item.change_pct);
                var sign = getChangeSign(item.change_pct);
                html += '<tr>' +
                    '<td class="fw-600">' + (item.name || "--") + '</td>' +
                    '<td class="text-muted text-sm">' + (item.code || "--") + '</td>' +
                    '<td class="' + cls + '" style="font-variant-numeric:tabular-nums;">' + formatPrice(item.price) + '</td>' +
                    '<td class="' + cls + '" style="font-variant-numeric:tabular-nums;">' + sign + formatPct(item.change_pct) + '</td>' +
                    '</tr>';
            });
            tbody.html(html);
        }, function (msg) {
            $("#hotStockTable").html('<tr><td colspan="4" class="text-center text-muted py-3">' + (msg || "加载失败") + '</td></tr>');
        });
    }


    // ==================== 渲染资金流向占位（美股资金流向数据暂不可用） ====================
    function renderFundFlowPlaceholder() {
        if (!fundFlowChart) {
            fundFlowChart = initChart("fundFlowChart");
        }
        if (!fundFlowChart) return;
        fundFlowChart.clear();
        fundFlowChart.setOption({
            title: {
                text: "美股资金流向数据暂不可用",
                subtext: "当前仅展示K线走势与热门个股",
                left: "center",
                top: "center",
                textStyle: { color: chartTextColor, fontSize: 14 },
                subtextStyle: { color: "#6e7681", fontSize: 12 }
            }
        });
    }


    // ==================== 事件绑定 ====================
    function bindEvents() {
        // 指数切换
        $("#indexSwitcher").on("click", ".index-btn", function () {
            var $btn = $(this);
            if ($btn.hasClass("active")) return;

            $("#indexSwitcher .index-btn").removeClass("active");
            $btn.addClass("active");

            currentSecid = $btn.data("secid");
            currentName = $btn.text().trim();

            loadUSIndexRealtime();
            loadKlineData();
        });

        // 周期切换
        $("#periodSwitcher").on("click", ".period-btn", function () {
            var $btn = $(this);
            if ($btn.hasClass("active")) return;

            $("#periodSwitcher .period-btn").removeClass("active");
            $btn.addClass("active");

            currentKlt = String($btn.data("klt"));
            loadKlineData();
        });
    }


    // ==================== 初始化 ====================
    $(document).ready(function () {
        bindEvents();

        // 初始化图表
        klineChart = initChart("klineChart");
        fundFlowChart = initChart("fundFlowChart");

        // 加载数据
        loadUSIndexRealtime();
        loadKlineData();
        loadHotStocks();
        renderFundFlowPlaceholder();

        // 每60秒自动刷新
        _realtimeTimer = setInterval(function () {
            loadUSIndexRealtime();
            loadHotStocks();
        }, 60000);

        // 页面卸载时清理定时器
        $(window).on("beforeunload", function () {
            if (_realtimeTimer) { clearInterval(_realtimeTimer); _realtimeTimer = null; }
        });
    });
})();
