/* ==================== 创业板K线分析 JavaScript ==================== */
(function() {
    'use strict';

    // 图表实例
    var klineChart = null;
    var fundFlowChart = null;

    // 当前状态
    var currentSecid = "0.399006";  // 默认创业板指
    var currentKlt = "101";         // 默认日K

    // MA线颜色
    var maColors = {
        ma5: "#d29922",   // 黄色
        ma10: "#2f81f7",  // 蓝色
        ma20: "#a371f7"   // 紫色
    };

    // 缓存K线原始数据，供tooltip使用
    var klineRawData = {
        dates: [],
        amounts: []
    };

    // 定时器引用
    var _realtimeTimer = null;
    var _klineTimer = null;


    // ==================== 加载指数实时数据 ====================
    function loadIndexData() {
        fetchData("/api/index-data?secid=" + currentSecid, function (data) {
            var cls = getChangeClass(data.change_pct);
            var sign = getChangeSign(data.change_pct);

            // 指数名称
            $("#idxName").text(data.name + "(" + data.code + ")");

            // 最新价
            $("#idxPrice")
                .text(formatPrice(data.price))
                .removeClass("text-up text-down text-flat")
                .addClass(cls);

            // 涨跌额 + 涨跌幅
            var changeText = sign + " " + formatPrice(data.change) + "  (" + formatPct(data.change_pct) + ")";
            $("#idxChange")
                .text(changeText)
                .removeClass("text-up text-down text-flat")
                .addClass(cls);

            // 成交额
            $("#idxAmount").text(formatAmount(data.amount));

            // 更新时间
            $("#idxUpdateTime").text(new Date().toLocaleTimeString("zh-CN"));

            // 同步更新K线图标题
            $("#klineTitle").text(data.name + " " + getKltName(currentKlt));
            $("#fundFlowTitle").text(data.name);
        }, function (msg) {
            $("#idxName").text("--");
            $("#idxPrice").text("--").removeClass("text-up text-down text-flat").addClass("text-flat");
            $("#idxChange").text("--").removeClass("text-up text-down text-flat").addClass("text-flat");
            $("#idxAmount").text("--");
            $("#idxUpdateTime").text("--");
        });
    }


    // ==================== 计算均线 ====================
    // 从收盘价数组计算移动平均线
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
                            text: "暂无K线数据",
                            left: "center",
                            top: "center",
                            textStyle: { color: chartTextColor, fontSize: 14 }
                        }
                    });
                    return;
                }

                // 解析数据
                var dates = [];
                var ohlcData = [];
                var volumeData = [];
                var closes = [];
                var amounts = [];

                klines.forEach(function (k) {
                    dates.push(k.date);
                    ohlcData.push([k.open, k.close, k.low, k.high]);
                    closes.push(k.close);
                    amounts.push(k.amount);

                    // 成交量柱状图：红涨绿跌
                    var isUp = k.close >= k.open;
                    volumeData.push({
                        value: k.volume,
                        itemStyle: {
                            color: isUp ? chartUpColor : chartDownColor
                        }
                    });
                });

                // 缓存数据供tooltip使用
                klineRawData.dates = dates;
                klineRawData.amounts = amounts;

                // 计算均线
                var ma5 = calculateMA(closes, 5);
                var ma10 = calculateMA(closes, 10);
                var ma20 = calculateMA(closes, 20);

                // 更新标题
                $("#klineTitle").text(data.name + " " + getKltName(currentKlt));

                // 构建ECharts配置
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
                            var html = '<div style="font-weight:600;margin-bottom:6px;font-size:13px;">' + date + '</div>';

                            params.forEach(function (p) {
                                if (p.seriesType === "candlestick") {
                                    var d = p.data;
                                    var open = d[0], close = d[1], low = d[2], high = d[3];
                                    var change = close - open;
                                    var changePct = open !== 0 ? (change / open * 100) : 0;
                                    var color = change >= 0 ? chartUpColor : chartDownColor;

                                    html += '<div style="margin-bottom:4px;">';
                                    html += '<span style="color:' + chartTextColor + ';">开</span> ' + formatPrice(open) + '  ';
                                    html += '<span style="color:' + chartTextColor + ';">收</span> <span style="color:' + color + ';font-weight:600;">' + formatPrice(close) + '</span><br/>';
                                    html += '<span style="color:' + chartTextColor + ';">高</span> ' + formatPrice(high) + '  ';
                                    html += '<span style="color:' + chartTextColor + ';">低</span> ' + formatPrice(low) + '<br/>';
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
                                    var idx = p.dataIndex;
                                    var amt = klineRawData.amounts[idx] || 0;
                                    html += p.marker + p.seriesName + ": " + formatAmount(vol) + "<br/>";
                                    html += '<span style="color:' + chartTextColor + ';padding-left:20px;">成交额: ' + formatAmount(amt) + '</span><br/>';
                                }
                            });

                            return html;
                        }
                    },
                    grid: [
                        {
                            // K线主图区域
                            left: "3%",
                            right: "6%",
                            top: 40,
                            height: "58%",
                            containLabel: true
                        },
                        {
                            // 成交量副图区域
                            left: "3%",
                            right: "6%",
                            top: "74%",
                            height: "18%",
                            containLabel: true
                        }
                    ],
                    xAxis: [
                        {
                            // K线X轴
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
                            // 成交量X轴
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
                            // K线Y轴
                            scale: true,
                            splitLine: { lineStyle: { color: chartGridColor } },
                            axisLabel: { color: chartTextColor, fontSize: 11 }
                        },
                        {
                            // 成交量Y轴
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
                                color: chartUpColor,         // 阳线实体颜色
                                color0: chartDownColor,      // 阴线实体颜色
                                borderColor: chartUpColor,   // 阳线边框颜色
                                borderColor0: chartDownColor  // 阴线边框颜色
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


    // ==================== 加载资金流向数据并渲染 ====================
    function loadFundFlow() {
        if (fundFlowChart) {
            fundFlowChart.showLoading({
                text: "加载中...",
                color: "#2f81f7",
                textColor: "#8b949e",
                maskColor: "rgba(13,17,23,0.8)"
            });
        }

        fetchData(
            "/api/fund-flow?secid=" + currentSecid + "&lmt=30",
            function (data) {
                if (!fundFlowChart) {
                    fundFlowChart = initChart("fundFlowChart");
                }
                if (!fundFlowChart) return;
                fundFlowChart.hideLoading();

                if (!data || !data.klines || data.klines.length === 0) {
                    fundFlowChart.clear();
                    fundFlowChart.setOption({
                        title: {
                            text: "资金流向数据暂不可用",
                            left: "center",
                            top: "center",
                            textStyle: { color: chartTextColor, fontSize: 14 }
                        }
                    });
                    return;
                }

                var klines = data.klines;

                // 解析数据
                var dates = [];
                var mainData = [];
                var superLargeData = [];
                var largeData = [];

                klines.forEach(function (k) {
                    dates.push(k.date);

                    // 每个柱子根据正负值设置颜色
                    mainData.push({
                        value: k.main,
                        itemStyle: { color: k.main >= 0 ? chartUpColor : chartDownColor }
                    });
                    superLargeData.push({
                        value: k.super_large,
                        itemStyle: { color: k.super_large >= 0 ? chartUpColor : chartDownColor }
                    });
                    largeData.push({
                        value: k.large,
                        itemStyle: { color: k.large >= 0 ? chartUpColor : chartDownColor }
                    });
                });

                // 更新标题
                $("#fundFlowTitle").text(data.name);

                var option = {
                    backgroundColor: "transparent",
                    tooltip: {
                        trigger: "axis",
                        axisPointer: { type: "shadow" },
                        borderWidth: 1,
                        borderColor: chartGridColor,
                        backgroundColor: "rgba(22,27,34,0.95)",
                        textStyle: { color: "#e6edf3", fontSize: 12 },
                        formatter: function (params) {
                            var html = '<div style="font-weight:600;margin-bottom:6px;font-size:13px;">' + params[0].axisValue + "</div>";
                            params.forEach(function (p) {
                                var val = p.value;
                                var color = val >= 0 ? chartUpColor : chartDownColor;
                                var prefix = val >= 0 ? "+" : "";
                                html += p.marker + p.seriesName + ': <span style="color:' + color + ';font-weight:600;">' + prefix + formatAmount(val) + "</span><br/>";
                            });
                            return html;
                        }
                    },
                    legend: {
                        data: ["主力净流入", "超大单净流入", "大单净流入"],
                        top: 5,
                        textStyle: { color: chartTextColor, fontSize: 12 },
                        itemWidth: 14,
                        itemHeight: 10
                    },
                    grid: { left: "2%", right: "4%", bottom: "14%", top: 40, containLabel: true },
                    xAxis: {
                        type: "category",
                        data: dates,
                        axisLine: { lineStyle: { color: chartGridColor } },
                        axisLabel: { color: chartTextColor, fontSize: 10, rotate: 30 }
                    },
                    yAxis: {
                        type: "value",
                        axisLabel: {
                            color: chartTextColor,
                            fontSize: 11,
                            formatter: function (val) {
                                var abs = Math.abs(val);
                                if (abs >= 1e8) return (val / 1e8).toFixed(1) + "亿";
                                if (abs >= 1e4) return (val / 1e4).toFixed(0) + "万";
                                return val;
                            }
                        },
                        splitLine: { lineStyle: { color: chartGridColor } }
                    },
                    dataZoom: [
                        { type: "inside", start: 0, end: 100 },
                        {
                            show: true,
                            type: "slider",
                            bottom: 5,
                            height: 18,
                            start: 0,
                            end: 100,
                            textStyle: { color: chartTextColor },
                            borderColor: chartGridColor,
                            fillerColor: "rgba(47,129,247,0.15)",
                            handleStyle: { color: "#2f81f7" }
                        }
                    ],
                    series: [
                        {
                            name: "主力净流入",
                            type: "bar",
                            data: mainData
                        },
                        {
                            name: "超大单净流入",
                            type: "bar",
                            data: superLargeData
                        },
                        {
                            name: "大单净流入",
                            type: "bar",
                            data: largeData
                        }
                    ]
                };

                fundFlowChart.setOption(option, true);
            },
            function (msg) {
                if (fundFlowChart) {
                    fundFlowChart.hideLoading();
                    fundFlowChart.clear();
                    fundFlowChart.setOption({
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


    // ==================== 加载实时资金流向 ====================
    function loadRealtimeFlow() {
        fetchData(
            "/api/realtime-flow?secid=" + currentSecid,
            function (data) {
                if (!data) {
                    $("#realtimeFlowTime").text("--");
                    $("#realtimeFlowPanel").html(
                        '<div class="no-data"><i class="bi bi-exclamation-triangle"></i>实时资金流向数据暂不可用</div>'
                    );
                    return;
                }

                // 更新时间
                $("#realtimeFlowTime").text(new Date().toLocaleTimeString("zh-CN"));

                // 资金流向项目
                var items = [
                    { label: "主力净流入", net: data.main_net, pct: data.main_pct },
                    { label: "超大单净流入", net: data.super_large_net, pct: data.super_large_pct },
                    { label: "大单净流入", net: data.large_net, pct: data.large_pct },
                    { label: "中单净流入", net: data.medium_net, pct: data.medium_pct },
                    { label: "小单净流入", net: data.small_net, pct: data.small_pct }
                ];

                var html = "";
                items.forEach(function (item) {
                    var cls = getChangeClass(item.net);
                    var prefix = item.net >= 0 ? "+" : "";
                    var pctText = (item.pct !== undefined && item.pct !== null && item.pct !== "") ? formatPct(item.pct) : "--";

                    html += '<div class="d-flex justify-content-between align-items-center" style="padding:10px 0;border-bottom:1px solid var(--border-color);">';
                    html += '<span class="text-muted" style="font-size:13px;">' + item.label + "</span>";
                    html += '<div style="text-align:right;">';
                    html += '<div class="fw-600 ' + cls + '" style="font-size:15px;font-variant-numeric:tabular-nums;">' + prefix + formatAmount(item.net) + "</div>";
                    html += '<div class="' + cls + '" style="font-size:11px;margin-top:2px;">占比 ' + pctText + "</div>";
                    html += "</div>";
                    html += "</div>";
                });

                $("#realtimeFlowPanel").html(html);
            },
            function (msg) {
                $("#realtimeFlowTime").text("--");
                $("#realtimeFlowPanel").html(
                    '<div class="no-data"><i class="bi bi-exclamation-triangle"></i>' + msg + "</div>"
                );
            }
        );
    }


    // ==================== 加载全部数据 ====================
    function loadAll() {
        loadIndexData();
        loadKlineData();
        loadFundFlow();
        loadRealtimeFlow();
    }


    // ==================== 暴露给HTML的函数 ====================
    window.switchIndex = function(btn, secid) {
        if (secid === currentSecid) return;

        // 更新按钮状态
        $("#indexSwitcher .btn-item").removeClass("active");
        $(btn).addClass("active");
        currentSecid = secid;

        // 重新加载所有数据
        loadAll();
    };

    window.switchKlt = function(btn, klt) {
        if (klt === currentKlt) return;

        // 更新按钮状态
        $("#kltSwitcher .btn-item").removeClass("active");
        $(btn).addClass("active");
        currentKlt = klt;

        // 仅重新加载K线数据
        loadKlineData();
    };


    // ==================== 初始化 ====================
    $(document).ready(function () {
        // 初始化图表实例（initChart已内置resize监听）
        klineChart = initChart("klineChart");
        fundFlowChart = initChart("fundFlowChart");

        // 加载全部数据
        loadAll();

        // 每30秒自动刷新指数实时数据和实时资金流向
        _realtimeTimer = setInterval(function () {
            loadIndexData();
            loadRealtimeFlow();
        }, 30000);

        // 每5分钟自动刷新K线图和资金流向图
        _klineTimer = setInterval(function () {
            loadKlineData();
            loadFundFlow();
        }, 300000);

        // 页面卸载时清理定时器
        $(window).on("beforeunload", function () {
            if (_realtimeTimer) { clearInterval(_realtimeTimer); _realtimeTimer = null; }
            if (_klineTimer) { clearInterval(_klineTimer); _klineTimer = null; }
        });
    });
})();
