/* ==================== 主仪表盘 JavaScript ==================== */
(function() {
    'use strict';

    var sentimentChart = null;
    var sectorFlowChart = null;
    var currentSectorMarket = "90";
    var _refreshTimer = null;

    // ==================== 加载大盘指数卡片 ====================
    function loadIndexCards() {
        fetchData("/api/market-overview", function (data) {
            $("#updateTime").text(new Date().toLocaleTimeString("zh-CN"));
            data.forEach(function (item) {
                var key = item.key;
                var cls = getChangeClass(item.change_pct);
                var sign = getChangeSign(item.change_pct);

                $("#idx-" + key + "-price").text(formatPrice(item.price)).removeClass("text-up text-down text-flat").addClass(cls);
                $("#idx-" + key + "-change").text(sign + " " + formatPrice(item.change) + " (" + formatPct(item.change_pct) + ")").removeClass("text-up text-down text-flat").addClass(cls);
                var meta = "成交额 " + formatAmount(item.amount);
                if (item.turnover_rate) meta += " | 振幅 " + formatPct(item.amplitude);
                $("#idx-" + key + "-meta").text(meta);
            });
        });
    }

    // ==================== 市场情绪 ====================
    function loadSentiment() {
        fetchData("/api/sentiment", function (data) {
            // 更新统计数字
            $("#stat-up").text(data.up_count);
            $("#stat-down").text(data.down_count);
            $("#stat-limit-up").text(data.limit_up);
            $("#stat-limit-down").text(data.limit_down);

            // 情绪状态文字
            var ratio = data.up_ratio;
            var status = "";
            var statusColor = "";
            if (ratio >= 70) {
                status = "极度强势";
                statusColor = "text-up";
            } else if (ratio >= 55) {
                status = "偏强";
                statusColor = "text-up";
            } else if (ratio >= 45) {
                status = "中性";
                statusColor = "text-flat";
            } else if (ratio >= 30) {
                status = "偏弱";
                statusColor = "text-down";
            } else {
                status = "极度弱势";
                statusColor = "text-down";
            }
            $("#sentimentStatus").text(status + " (" + ratio + "%)").removeClass("text-up text-down text-flat").addClass(statusColor);

            // 渲染情绪仪表盘
            if (!sentimentChart) {
                sentimentChart = initChart("sentimentChart");
            }
            var option = {
                series: [{
                    type: "gauge",
                    startAngle: 180,
                    endAngle: 0,
                    min: 0,
                    max: 100,
                    radius: "95%",
                    center: ["50%", "75%"],
                    progress: {
                        show: true,
                        width: 14,
                        itemStyle: {
                            color: ratio >= 50 ? chartUpColor : chartDownColor
                        }
                    },
                    axisLine: {
                        lineStyle: {
                            width: 14,
                            color: [
                                [0.3, chartDownColor],
                                [0.7, "#d29922"],
                                [1, chartUpColor]
                            ]
                        }
                    },
                    pointer: {
                        icon: "path://M 0,-6 L 0,6 L 100,0 Z",
                        length: "60%",
                        width: 5,
                        offsetCenter: [0, "-8%"],
                        itemStyle: { color: "auto" }
                    },
                    axisTick: { show: false },
                    splitLine: { show: false },
                    axisLabel: { show: false },
                    title: { show: false },
                    detail: {
                        valueAnimation: true,
                        formatter: "{value}%",
                        color: chartTextColor,
                        fontSize: 22,
                        fontWeight: "bold",
                        offsetCenter: [0, "-28%"]
                    },
                    data: [{ value: ratio }]
                }]
            };
            sentimentChart.setOption(option);
        });
    }

    // ==================== 板块资金流向 ====================
    function loadSectorFlow(market) {
        if (sectorFlowChart) {
            sectorFlowChart.showLoading({ text: "加载中...", color: "#2f81f7", textColor: "#8b949e", maskColor: "rgba(13,17,23,0.8)" });
        }
        fetchData("/api/sector-flow?market=" + market, function (data) {
            if (!sectorFlowChart) {
                sectorFlowChart = initChart("sectorFlowChart");
            }
            sectorFlowChart.hideLoading();

            if (!data || data.length === 0) {
                sectorFlowChart.setOption({
                    title: { text: "暂无数据", left: "center", top: "center", textStyle: { color: chartTextColor, fontSize: 14 } }
                });
                return;
            }

            // 取前10个
            var top = data.slice(0, 10);
            var names = top.map(function (d) { return d.name; });
            var values = top.map(function (d) { return d.main_net; });
            var colors = values.map(function (v) { return v >= 0 ? chartUpColor : chartDownColor; });

            var option = {
                tooltip: {
                    trigger: "axis",
                    axisPointer: { type: "shadow" },
                    formatter: function (params) {
                        var p = params[0];
                        var val = p.value;
                        var prefix = val >= 0 ? "+" : "";
                        return p.name + "<br/>主力净流入: <span style='color:" + (val >= 0 ? chartUpColor : chartDownColor) + ";font-weight:bold'>" + prefix + formatAmount(val) + "</span>";
                    }
                },
                grid: { left: "3%", right: "8%", bottom: "3%", top: "3%", containLabel: true },
                xAxis: {
                    type: "value",
                    axisLabel: {
                        color: chartTextColor,
                        formatter: function (val) {
                            var abs = Math.abs(val);
                            if (abs >= 1e8) return (val / 1e8).toFixed(1) + "亿";
                            if (abs >= 1e4) return (val / 1e4).toFixed(0) + "万";
                            return val;
                        }
                    },
                    splitLine: { lineStyle: { color: chartGridColor } }
                },
                yAxis: {
                    type: "category",
                    data: names.reverse(),
                    axisLabel: { color: chartTextColor, fontSize: 11 },
                    axisLine: { lineStyle: { color: chartGridColor } }
                },
                series: [{
                    type: "bar",
                    data: values.reverse().map(function (v) {
                        return {
                            value: v,
                            itemStyle: { color: v >= 0 ? chartUpColor : chartDownColor }
                        };
                    }),
                    barWidth: "60%",
                    label: {
                        show: true,
                        position: "right",
                        color: chartTextColor,
                        fontSize: 10,
                        formatter: function (p) {
                            return formatAmount(p.value);
                        }
                    }
                }]
            };
            sectorFlowChart.setOption(option, true);
        }, function (msg) {
            if (sectorFlowChart) sectorFlowChart.hideLoading();
            // 显示友好提示而非错误信息
            if (!sectorFlowChart) {
                sectorFlowChart = initChart("sectorFlowChart");
            }
            sectorFlowChart.setOption({
                title: {
                    text: msg || "数据源维护中，敬请期待",
                    subtext: "板块资金流向数据暂不可用",
                    left: "center",
                    top: "center",
                    textStyle: { color: chartTextColor, fontSize: 14 },
                    subtextStyle: { color: "#6e7681", fontSize: 12 }
                }
            }, true);
        });
    }

    // ==================== 涨跌幅榜 ====================
    function loadTopStocks() {
        // 涨幅榜
        fetchData("/api/top-stocks?sort=f3&count=5", function (data) {
            var html = "";
            data.forEach(function (item) {
                html += renderStockRow(item, false);
            });
            $("#topGainersBody").html(html);
        });

        // 跌幅榜
        fetchData("/api/top-stocks?sort=f3&count=5&asc=1", function (data) {
            var html = "";
            data.forEach(function (item) {
                html += renderStockRow(item, false);
            });
            $("#topLosersBody").html(html);
        });
    }

    // ==================== 新闻资讯 ====================
    function loadDashboardNews() {
        // 政策
        fetchData("/api/news?category=policy", function (data) {
            renderNewsList(data.slice(0, 8), $("#newsPolicy"), "policy");
        });

        // 财经
        fetchData("/api/news?category=finance", function (data) {
            renderNewsList(data.slice(0, 8), $("#newsFinance"), "finance");
        });

        // 科技
        fetchData("/api/news?category=tech", function (data) {
            renderNewsList(data.slice(0, 8), $("#newsTech"), "tech");
        });
    }

    // ==================== 暴露给HTML的函数 ====================
    window.switchSectorMarket = function(btn, market) {
        $(btn).siblings().removeClass("active");
        $(btn).addClass("active");
        currentSectorMarket = market;
        loadSectorFlow(market);
    };

    // ==================== 初始化 ====================
    $(document).ready(function () {
        loadIndexCards();
        loadSentiment();
        loadSectorFlow(currentSectorMarket);
        loadTopStocks();
        loadDashboardNews();

        // 每60秒自动刷新
        _refreshTimer = setInterval(function () {
            loadIndexCards();
            loadSentiment();
            loadSectorFlow(currentSectorMarket);
            loadTopStocks();
        }, 60000);

        // 页面卸载时清理定时器
        $(window).on("beforeunload", function () {
            if (_refreshTimer) {
                clearInterval(_refreshTimer);
                _refreshTimer = null;
            }
        });
    });
})();
