/* ==================== 港股资金走势 JavaScript ==================== */
(function() {
    'use strict';

    var klineChart = null;
    var fundFlowChart = null;
    var currentSecid = "100.HSI";
    var currentIndexName = "恒生指数";

    // 定时器引用
    var _refreshTimer = null;

    // 加载动画配置
    var loadingOpts = {
        text: "加载中...",
        color: "#2f81f7",
        textColor: chartTextColor,
        maskColor: "rgba(13,17,23,0.8)"
    };

    // ==================== 指数实时数据（标题栏徽章） ====================
    function loadIndexRealtime() {
        fetchData("/api/index-data?secid=" + currentSecid, function (data) {
            var name = data.name || currentIndexName;
            var cls = getChangeClass(data.change_pct);
            var sign = getChangeSign(data.change_pct);

            $("#rtIndexName").text(name);
            $("#rtIndexPrice")
                .text(formatPrice(data.price))
                .removeClass("text-up text-down text-flat")
                .addClass(cls);

            var changeText = sign + " " + formatPrice(data.change) + " (" + formatPct(data.change_pct) + ")";
            $("#rtIndexChange")
                .text(changeText)
                .removeClass("text-up text-down text-flat")
                .addClass(cls);

            $("#klineIndexName").text(name);
            $("#flowIndexName").text(name);
            $("#updateTime").text(new Date().toLocaleTimeString("zh-CN"));
        }, function (msg) {
            $("#rtIndexPrice").text("--").removeClass("text-up text-down text-flat").addClass("text-flat");
            $("#rtIndexChange").text("--").removeClass("text-up text-down text-flat").addClass("text-flat");
        });
    }

    // ==================== 计算均线 ====================
    function calcMA(klines, n) {
        var result = [];
        for (var i = 0; i < klines.length; i++) {
            if (i < n - 1) {
                result.push("-");
                continue;
            }
            var sum = 0;
            for (var j = 0; j < n; j++) {
                sum += klines[i - j].close;
            }
            result.push(parseFloat((sum / n).toFixed(2)));
        }
        return result;
    }

    // ==================== K线图 ====================
    function loadKline() {
        if (klineChart) {
            klineChart.showLoading(loadingOpts);
        }
        fetchData("/api/kline?secid=" + currentSecid + "&klt=101&lmt=120", function (data) {
            if (!klineChart) {
                klineChart = initChart("klineChart");
            }
            klineChart.hideLoading();

            var klines = data.klines || [];
            if (klines.length === 0) {
                klineChart.setOption({
                    title: { text: "暂无K线数据", left: "center", top: "center", textStyle: { color: chartTextColor, fontSize: 14 } }
                }, true);
                return;
            }

            var dates = [];
            var ohlc = [];
            var volumes = [];
            klines.forEach(function (k) {
                dates.push(k.date);
                ohlc.push([k.open, k.close, k.low, k.high]);
                volumes.push({
                    value: k.volume,
                    itemStyle: { color: k.close >= k.open ? chartUpColor : chartDownColor }
                });
            });

            var ma5 = calcMA(klines, 5);
            var ma10 = calcMA(klines, 10);
            var ma20 = calcMA(klines, 20);

            var option = {
                backgroundColor: "transparent",
                tooltip: {
                    trigger: "axis",
                    axisPointer: {
                        type: "cross",
                        link: [{ xAxisIndex: "all" }]
                    },
                    formatter: function (params) {
                        var date = params[0].axisValue;
                        var html = '<div style="font-weight:600;margin-bottom:4px">' + date + '</div>';
                        params.forEach(function (p) {
                            if (p.seriesType === "candlestick") {
                                var d = (p.data && p.data.slice) ? p.data.slice(0, 4) : [0, 0, 0, 0]; // [open, close, low, high]
                                var color = d[1] >= d[0] ? chartUpColor : chartDownColor;
                                html += '<span style="display:inline-block;width:8px;height:8px;background:' + color + ';margin-right:5px;border-radius:50%;"></span>';
                                html += "开 " + d[0] + " / 收 " + d[1] + " / 低 " + d[2] + " / 高 " + d[3] + "<br/>";
                            } else if (p.seriesName === "成交量") {
                                html += p.marker + p.seriesName + "：" + formatAmount(p.value) + "<br/>";
                            } else {
                                var val = p.value;
                                if (val === "-" || val === null || val === undefined) val = "--";
                                html += p.marker + p.seriesName + "：" + val + "<br/>";
                            }
                        });
                        return html;
                    }
                },
                legend: {
                    data: ["日K", "MA5", "MA10", "MA20"],
                    top: 4,
                    textStyle: { color: chartTextColor, fontSize: 11 },
                    itemWidth: 14,
                    itemHeight: 8
                },
                grid: [
                    { left: "3%", right: "6%", top: "8%", height: "58%", containLabel: true },
                    { left: "3%", right: "6%", top: "72%", height: "18%", containLabel: true }
                ],
                xAxis: [
                    {
                        type: "category",
                        data: dates,
                        scale: true,
                        boundaryGap: false,
                        axisLine: { lineStyle: { color: chartGridColor } },
                        axisLabel: { color: chartTextColor, fontSize: 10 },
                        splitLine: { show: false },
                        axisTick: { show: false }
                    },
                    {
                        type: "category",
                        gridIndex: 1,
                        data: dates,
                        scale: true,
                        boundaryGap: false,
                        axisLine: { lineStyle: { color: chartGridColor } },
                        axisLabel: { show: false },
                        axisTick: { show: false }
                    }
                ],
                yAxis: [
                    {
                        scale: true,
                        splitLine: { lineStyle: { color: chartGridColor } },
                        axisLabel: { color: chartTextColor, fontSize: 10 },
                        axisLine: { show: false }
                    },
                    {
                        gridIndex: 1,
                        splitNumber: 2,
                        axisLabel: {
                            color: chartTextColor,
                            fontSize: 10,
                            formatter: function (v) {
                                var abs = Math.abs(v);
                                if (abs >= 1e8) return (v / 1e8).toFixed(1) + "亿";
                                if (abs >= 1e4) return (v / 1e4).toFixed(0) + "万";
                                return v;
                            }
                        },
                        splitLine: { show: false },
                        axisLine: { show: false }
                    }
                ],
                dataZoom: [
                    {
                        type: "inside",
                        xAxisIndex: [0, 1],
                        start: 50,
                        end: 100
                    },
                    {
                        show: true,
                        type: "slider",
                        xAxisIndex: [0, 1],
                        bottom: "2%",
                        height: 18,
                        start: 50,
                        end: 100,
                        textStyle: { color: chartTextColor, fontSize: 10 },
                        borderColor: chartGridColor,
                        fillerColor: "rgba(47,129,247,0.2)"
                    }
                ],
                series: [
                    {
                        name: "日K",
                        type: "candlestick",
                        data: ohlc,
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
                        smooth: true,
                        showSymbol: false,
                        lineStyle: { width: 1, color: "#f0b429" },
                        z: 5
                    },
                    {
                        name: "MA10",
                        type: "line",
                        data: ma10,
                        smooth: true,
                        showSymbol: false,
                        lineStyle: { width: 1, color: "#a371f7" },
                        z: 5
                    },
                    {
                        name: "MA20",
                        type: "line",
                        data: ma20,
                        smooth: true,
                        showSymbol: false,
                        lineStyle: { width: 1, color: "#2f81f7" },
                        z: 5
                    },
                    {
                        name: "成交量",
                        type: "bar",
                        xAxisIndex: 1,
                        yAxisIndex: 1,
                        data: volumes
                    }
                ]
            };
            klineChart.setOption(option, true);
        }, function (msg) {
            if (klineChart) klineChart.hideLoading();
            klineChart.setOption({
                title: { text: "K线数据加载失败", left: "center", top: "center", textStyle: { color: chartTextColor, fontSize: 14 } }
            }, true);
        });
    }

    // ==================== 更新当日资金流向汇总 ====================
    function updateRealtimeSummary(last) {
        if (!last) return;
        function setVal(id, val) {
            var cls = getChangeClass(val);
            $("#" + id)
                .text(formatAmount(val))
                .removeClass("text-up text-down text-flat")
                .addClass(cls);
        }
        setVal("rtMainNet", last.main);
        setVal("rtSuperLarge", last.super_large);
        setVal("rtLarge", last.large);
        setVal("rtMedium", last.medium);
        setVal("rtSmall", last.small);
        $("#rtFlowDate").text(last.date || "--");
    }

    // ==================== 资金流向趋势图 ====================
    function loadFundFlow() {
        if (fundFlowChart) {
            fundFlowChart.showLoading(loadingOpts);
        }
        fetchData("/api/fund-flow?secid=" + currentSecid + "&lmt=30", function (data) {
            if (!fundFlowChart) {
                fundFlowChart = initChart("fundFlowChart");
            }
            fundFlowChart.hideLoading();

            var klines = data.klines || [];
            if (klines.length === 0) {
                fundFlowChart.setOption({
                    title: { text: "暂无资金流向数据", left: "center", top: "center", textStyle: { color: chartTextColor, fontSize: 14 } }
                }, true);
                return;
            }

            // 更新汇总面板（取最新一日）
            updateRealtimeSummary(klines[klines.length - 1]);

            var dates = [];
            var mainArr = [];
            var superArr = [];
            var largeArr = [];
            klines.forEach(function (k) {
                dates.push(k.date);
                mainArr.push(k.main);
                superArr.push(k.super_large);
                largeArr.push(k.large);
            });

            var option = {
                backgroundColor: "transparent",
                tooltip: {
                    trigger: "axis",
                    axisPointer: { type: "cross" },
                    formatter: function (params) {
                        var date = params[0].axisValue;
                        var html = '<div style="font-weight:600;margin-bottom:4px">' + date + '</div>';
                        params.forEach(function (p) {
                            var val = p.value;
                            var cls = val >= 0 ? chartUpColor : chartDownColor;
                            var prefix = val >= 0 ? "+" : "";
                            html += '<span style="display:inline-block;width:8px;height:8px;background:' + cls + ';margin-right:5px;border-radius:50%;"></span>';
                            html += p.seriesName + "：<span style='color:" + cls + ";font-weight:bold'>" + prefix + formatAmount(val) + "</span><br/>";
                        });
                        return html;
                    }
                },
                legend: {
                    data: ["主力净流入", "超大单", "大单"],
                    top: 4,
                    textStyle: { color: chartTextColor, fontSize: 11 },
                    itemWidth: 14,
                    itemHeight: 8
                },
                grid: { left: "3%", right: "6%", top: "18%", bottom: "16%", containLabel: true },
                xAxis: {
                    type: "category",
                    data: dates,
                    boundaryGap: false,
                    axisLine: { lineStyle: { color: chartGridColor } },
                    axisLabel: { color: chartTextColor, fontSize: 10 },
                    axisTick: { show: false }
                },
                yAxis: {
                    type: "value",
                    axisLabel: {
                        color: chartTextColor,
                        fontSize: 10,
                        formatter: function (v) {
                            var abs = Math.abs(v);
                            if (abs >= 1e8) return (v / 1e8).toFixed(1) + "亿";
                            if (abs >= 1e4) return (v / 1e4).toFixed(0) + "万";
                            return v;
                        }
                    },
                    splitLine: { lineStyle: { color: chartGridColor } },
                    axisLine: { show: false }
                },
                dataZoom: [
                    { type: "inside", start: 0, end: 100 },
                    {
                        show: true,
                        type: "slider",
                        bottom: "2%",
                        height: 14,
                        start: 0,
                        end: 100,
                        textStyle: { color: chartTextColor, fontSize: 10 },
                        borderColor: chartGridColor,
                        fillerColor: "rgba(47,129,247,0.2)"
                    }
                ],
                // 正负区域不同颜色填充（作用于主力净流入线）
                visualMap: {
                    show: false,
                    type: "piecewise",
                    dimension: 1,
                    pieces: [
                        { gte: 0, color: chartUpColor },
                        { lt: 0, color: chartDownColor }
                    ],
                    seriesIndex: 0
                },
                series: [
                    {
                        name: "主力净流入",
                        type: "line",
                        data: mainArr,
                        smooth: true,
                        showSymbol: false,
                        lineStyle: { width: 2 },
                        areaStyle: { opacity: 0.25 },
                        markLine: {
                            symbol: "none",
                            silent: true,
                            lineStyle: { color: chartGridColor, type: "dashed", width: 1 },
                            data: [{ yAxis: 0 }]
                        },
                        z: 5
                    },
                    {
                        name: "超大单",
                        type: "line",
                        data: superArr,
                        smooth: true,
                        showSymbol: false,
                        lineStyle: { width: 1.5, color: "#f0b429" },
                        z: 4
                    },
                    {
                        name: "大单",
                        type: "line",
                        data: largeArr,
                        smooth: true,
                        showSymbol: false,
                        lineStyle: { width: 1.5, color: "#a371f7" },
                        z: 4
                    }
                ]
            };
            fundFlowChart.setOption(option, true);
        }, function (msg) {
            if (fundFlowChart) fundFlowChart.hideLoading();
            fundFlowChart.setOption({
                title: { text: "资金流向数据加载失败", left: "center", top: "center", textStyle: { color: chartTextColor, fontSize: 14 } }
            }, true);
        });
    }

    // ==================== 港股热门资金流向表格 ====================
    function loadHkStocks() {
        fetchData("/api/hk-stocks?count=15", function (data) {
            if (!data || data.length === 0) {
                $("#hkStocksBody").html('<tr><td colspan="7" class="text-center text-muted">暂无数据</td></tr>');
                return;
            }
            // 按主力净流入降序排序
            data.sort(function (a, b) {
                return (b.main_net || 0) - (a.main_net || 0);
            });

            var html = "";
            data.forEach(function (item) {
                var cls = getChangeClass(item.change_pct);
                var sign = getChangeSign(item.change_pct);
                var netCls = getChangeClass(item.main_net);
                var pctCls = getChangeClass(item.main_pct);
                var netPrefix = (item.main_net || 0) >= 0 ? "+" : "";
                var pctPrefix = (item.main_pct || 0) >= 0 ? "+" : "";
                html += '<tr>' +
                    '<td class="fw-600">' + (item.name || "--") + '</td>' +
                    '<td class="text-muted text-sm">' + (item.code || "--") + '</td>' +
                    '<td>' + formatPrice(item.price) + '</td>' +
                    '<td class="' + cls + '">' + sign + ' ' + formatPct(item.change_pct) + '</td>' +
                    '<td class="' + netCls + '">' + netPrefix + formatAmount(item.main_net) + '</td>' +
                    '<td class="' + pctCls + '">' + pctPrefix + formatPct(item.main_pct) + '</td>' +
                    '<td class="text-muted">' + formatAmount(item.amount) + '</td>' +
                    '</tr>';
            });
            $("#hkStocksBody").html(html);
        }, function (msg) {
            $("#hkStocksBody").html('<tr><td colspan="7" class="text-center text-muted">数据加载失败，请稍后刷新重试</td></tr>');
        });
    }

    // ==================== 暴露给HTML的函数 ====================
    window.switchIndex = function(btn, secid, name) {
        $(btn).siblings().removeClass("active");
        $(btn).addClass("active");
        currentSecid = secid;
        currentIndexName = name;
        // 重置汇总面板
        ["rtMainNet", "rtSuperLarge", "rtLarge", "rtMedium", "rtSmall"].forEach(function (id) {
            $("#" + id).text("--").removeClass("text-up text-down text-flat").addClass("text-flat");
        });
        $("#rtFlowDate").text("--");
        loadIndexRealtime();
        loadKline();
        loadFundFlow();
    };

    // ==================== 页面初始化 ====================
    $(document).ready(function () {
        klineChart = initChart("klineChart");
        fundFlowChart = initChart("fundFlowChart");

        loadIndexRealtime();
        loadKline();
        loadFundFlow();
        loadHkStocks();

        // 每60秒自动刷新实时数据与资金流向
        _refreshTimer = setInterval(function () {
            loadIndexRealtime();
            loadFundFlow();
        }, 60000);

        // 页面卸载时清理定时器
        $(window).on("beforeunload", function () {
            if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
        });
    });
})();
