/* ==================== 新闻资讯中心 JavaScript ==================== */
(function() {
    'use strict';

    // ==================== 分类配置 ====================

    // "全部"分类对应的源分类列表（合并请求）
    var ALL_CATEGORIES = ["finance", "policy", "tech"];

    // 分类名称映射
    var categoryNames = {
        "all": "全部新闻",
        "policy": "政策动态",
        "finance": "财经要闻",
        "tech": "科技科创",
        "stock": "A股市场",
        "global": "国际财经"
    };

    // 新闻标签CSS类映射
    var newsTagClass = {
        "policy": "news-tag-policy",
        "finance": "news-tag-finance",
        "tech": "news-tag-tech",
        "stock": "news-tag-stock",
        "global": "news-tag-finance"
    };

    // 新闻标签文字映射
    var newsTagName = {
        "policy": "政策",
        "finance": "财经",
        "tech": "科技",
        "stock": "A股",
        "global": "国际"
    };

    // ==================== 状态管理 ====================

    var state = {
        category: "all",        // 当前选中的分类
        page: 1,               // 当前页码
        newsData: [],          // 已加载的全部新闻数据
        searchKeyword: "",     // 搜索关键词
        isLoading: false,      // 是否正在加载
        hasMore: true,         // 是否还有更多数据
        hasMoreMap: {}         // 各源分类是否还有更多（用于"全部"分类）
    };

    // 注意：escapeHtml 和 formatNewsTime 已在 common.js 中定义，此处不再重复

    // ==================== 搜索高亮 ====================

    function highlightKeyword(text, keyword) {
        if (!text) return "";
        var safeText = escapeHtml(text);
        if (!keyword) return safeText;
        var safeKeyword = escapeHtml(keyword);
        // 转义正则特殊字符
        var escapedKeyword = safeKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        var regex = new RegExp("(" + escapedKeyword + ")", "gi");
        return safeText.replace(regex, '<span class="search-highlight">$1</span>');
    }

    // ==================== 构建单条新闻HTML ====================

    function buildNewsItemHtml(item, keyword) {
        var title = item.title || "";
        var url = item.url || "#";
        var source = item.source || "未知来源";
        var time = item.publish_time || "";
        var digest = item.digest || "";
        var image = item.image || "";
        // 获取该条新闻的源分类（用于标签显示）
        var cat = item._category || state.category;

        var tagClass = newsTagClass[cat] || "news-tag-finance";
        var tagName = newsTagName[cat] || "财经";

        var html = '<li class="news-item">';
        html += '<div class="news-item-row">';

        // 左侧：文字内容
        html += '<div class="news-item-main">';
        // 标题（可点击，新窗口打开）
        html += '<a href="' + url + '" target="_blank" class="news-title-link">';
        html += '<span class="news-tag ' + tagClass + '">' + tagName + '</span>';
        html += highlightKeyword(title, keyword);
        html += '</a>';

        // 摘要（如果有）
        if (digest) {
            html += '<div class="news-digest">' + highlightKeyword(digest, keyword) + '</div>';
        }

        // 元信息：来源 + 发布时间
        html += '<div class="news-meta">';
        html += '<span class="news-source"><i class="bi bi-newspaper"></i> ' + escapeHtml(source) + '</span>';
        if (time) {
            html += '<span class="news-time"><i class="bi bi-clock"></i> ' + formatNewsTime(time) + '</span>';
        }
        html += '</div>';

        html += '</div>'; // .news-item-main

        // 右侧：缩略图（如果有图片）
        if (image) {
            html += '<div class="news-item-thumb">';
            html += '<img src="' + image + '" alt="" onerror="this.parentElement.style.display=\'none\'">';
            html += '</div>';
        }

        html += '</div>'; // .news-item-row
        html += '</li>';

        return html;
    }

    // ==================== 渲染新闻列表 ====================
    // 注意：本函数为新闻页专属渲染，与 common.js 中的 renderNewsList(data, container, category) 不同

    function renderNewsPage() {
        var container = $("#newsListContainer");
        var keyword = state.searchKeyword.trim().toLowerCase();

        // 根据搜索关键词过滤
        var displayData = state.newsData;
        if (keyword) {
            displayData = state.newsData.filter(function (item) {
                var title = (item.title || "").toLowerCase();
                var digest = (item.digest || "").toLowerCase();
                return title.indexOf(keyword) !== -1 || digest.indexOf(keyword) !== -1;
            });
        }

        // 更新数量显示
        if (keyword) {
            $("#newsCount").text("找到 " + displayData.length + " 条 / 共 " + state.newsData.length + " 条");
            $("#searchResultTip").show().html(
                '搜索 "' + escapeHtml(state.searchKeyword) + '" 结果' +
                ' <a class="clear-search" onclick="clearSearch()">[清除]</a>'
            );
            $("#newsSearchClearBtn").show();
        } else {
            $("#newsCount").text("共 " + state.newsData.length + " 条");
            $("#searchResultTip").hide();
            $("#newsSearchClearBtn").hide();
        }

        // 无数据处理
        if (displayData.length === 0) {
            if (keyword) {
                container.html(
                    '<div class="no-data">' +
                    '<i class="bi bi-search"></i>' +
                    '未找到包含 "' + escapeHtml(state.searchKeyword) + '" 的新闻' +
                    '</div>'
                );
            } else {
                container.html(
                    '<div class="no-data">' +
                    '<i class="bi bi-inbox"></i>' +
                    '暂无新闻数据' +
                    '</div>'
                );
            }
            $("#loadMoreWrapper").hide();
            return;
        }

        // 构建列表HTML
        var html = '<ul class="news-list-enhanced">';
        displayData.forEach(function (item) {
            html += buildNewsItemHtml(item, keyword);
        });
        html += '</ul>';
        container.html(html);

        // 显示/隐藏加载更多按钮（搜索时不显示）
        if (!keyword && state.hasMore) {
            $("#loadMoreWrapper").show();
        } else {
            $("#loadMoreWrapper").hide();
        }
    }

    // ==================== 显示加载动画 ====================

    function showLoading() {
        $("#newsListContainer").html(
            '<div class="loading-spinner">' +
            '<div class="spinner-border spinner-border-sm"></div>' +
            '</div>'
        );
        $("#loadMoreWrapper").hide();
    }

    // ==================== 加载新闻数据 ====================

    /**
     * 加载新闻数据
     * @param {boolean} isLoadMore - 是否为"加载更多"（追加数据）
     */
    function loadNews(isLoadMore) {
        if (state.isLoading) return;
        state.isLoading = true;

        var category = state.category;
        var page = state.page;

        // 更新按钮状态
        if (isLoadMore) {
            var btn = $("#loadMoreBtn");
            btn.prop("disabled", true).html(
                '<div class="spinner-border spinner-border-sm"></div> 加载中...'
            );
        }

        // 判断是否为"全部"分类（需合并多个分类）
        var categories = (category === "all") ? ALL_CATEGORIES : [category];

        fetchMultipleCategories(categories, page, function (mergedData) {
            state.isLoading = false;

            // 为每条新闻标记源分类
            mergedData.forEach(function (item) {
                if (!item._category) {
                    item._category = item._sourceCategory || category;
                }
            });

            if (isLoadMore) {
                // 追加数据
                state.newsData = state.newsData.concat(mergedData);
            } else {
                // 替换数据
                state.newsData = mergedData;
            }

            // 判断是否还有更多数据
            // "全部"分类：所有源分类都返回空才算没有更多
            if (category === "all") {
                var allEmpty = categories.every(function (cat) {
                    return !state.hasMoreMap[cat];
                });
                state.hasMore = mergedData.length > 0 || !allEmpty;
            } else {
                state.hasMore = mergedData.length > 0;
            }

            // 重置按钮
            $("#loadMoreBtn").prop("disabled", false).html(
                '<i class="bi bi-arrow-down-circle"></i> 加载更多'
            );

            // 渲染
            renderNewsPage();

            // 如果没有更多数据，更新按钮文字
            if (!state.hasMore) {
                $("#loadMoreWrapper").show();
                $("#loadMoreBtn").prop("disabled", true).html(
                    '<i class="bi bi-check-circle"></i> 已加载全部'
                );
            }
        }, function (errorMsg) {
            state.isLoading = false;
            $("#loadMoreBtn").prop("disabled", false).html(
                '<i class="bi bi-arrow-down-circle"></i> 加载更多'
            );

            if (!isLoadMore) {
                $("#newsListContainer").html(
                    '<div class="no-data">' +
                    '<i class="bi bi-exclamation-triangle"></i>' +
                    '加载失败：' + escapeHtml(errorMsg || "未知错误") +
                    '<br><button class="btn btn-sm btn-outline-primary mt-2" onclick="loadNews(false)">重试</button>' +
                    '</div>'
                );
            } else {
                // 加载更多失败时保留已有数据
                console.error("加载更多失败:", errorMsg);
            }
        });
    }

    // ==================== 多分类并行请求 ====================

    /**
     * 并行请求多个分类的新闻数据，合并后返回
     * @param {Array} categories - 分类列表
     * @param {number} page - 页码
     * @param {Function} callback - 回调，参数为合并排序后的数据
     * @param {Function} errorCallback - 错误回调
     */
    function fetchMultipleCategories(categories, page, callback, errorCallback) {
        var results = {};
        var completed = 0;
        var total = categories.length;
        var hasError = false;

        categories.forEach(function (cat) {
            var apiUrl = "/api/news?category=" + cat + "&page=" + page;

            fetchData(apiUrl, function (data) {
                if (hasError) return;

                // 为每条新闻标记源分类
                if (data && data.length > 0) {
                    data.forEach(function (item) {
                        item._category = cat;
                        item._sourceCategory = cat;
                    });
                    results[cat] = data;
                    state.hasMoreMap[cat] = true;
                } else {
                    results[cat] = [];
                    state.hasMoreMap[cat] = false;
                }

                completed++;
                if (completed === total) {
                    // 合并所有分类的结果
                    var merged = [];
                    categories.forEach(function (cat) {
                        merged = merged.concat(results[cat] || []);
                    });

                    // 按发布时间降序排序（最新的在前）
                    merged.sort(function (a, b) {
                        var timeA = a.publish_time || "";
                        var timeB = b.publish_time || "";
                        if (timeA < timeB) return 1;
                        if (timeA > timeB) return -1;
                        return 0;
                    });

                    callback(merged);
                }
            }, function (msg) {
                if (hasError) return;
                hasError = true;
                if (errorCallback) errorCallback(msg);
            });
        });
    }

    // ==================== 切换分类 ====================

    function switchCategory(category) {
        if (state.category === category) return;

        state.category = category;
        state.page = 1;
        state.newsData = [];
        state.searchKeyword = "";
        state.hasMore = true;
        state.hasMoreMap = {};

        // 清空搜索框
        $("#newsSearchInput").val("");
        $("#newsSearchClearBtn").hide();

        // 更新标签按钮高亮
        $("#categoryBar .tag-btn").removeClass("active");
        $("#categoryBar .tag-btn[data-category='" + category + "']").addClass("active");

        // 更新列表标题
        $("#newsListTitle").text(categoryNames[category] || "新闻列表");

        // 显示加载动画
        showLoading();

        // 加载新闻
        loadNews(false);
    }

    // ==================== 加载更多 ====================

    function loadMoreNews() {
        if (state.isLoading || !state.hasMore) return;
        state.page++;
        loadNews(true);
    }

    // ==================== 搜索功能 ====================

    function handleSearch() {
        var keyword = $("#newsSearchInput").val().trim();
        state.searchKeyword = keyword;
        renderNewsPage();
    }

    function clearSearch() {
        $("#newsSearchInput").val("");
        state.searchKeyword = "";
        renderNewsPage();
    }

    // ==================== 暴露给HTML的函数 ====================
    window.switchCategory = switchCategory;
    window.loadMoreNews = loadMoreNews;
    window.clearSearch = clearSearch;
    window.loadNews = loadNews;

    // ==================== 页面初始化 ====================

    $(document).ready(function () {
        // 默认加载"全部"分类
        loadNews(false);

        // 搜索按钮点击
        $("#newsSearchBtn").on("click", function () {
            handleSearch();
        });

        // 搜索框回车
        $("#newsSearchInput").on("keypress", function (e) {
            if (e.which === 13) {
                handleSearch();
            }
        });

        // 实时搜索（输入时延迟过滤）
        var searchTimer = null;
        $("#newsSearchInput").on("input", function () {
            var val = $(this).val().trim();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                if (val === "" && state.searchKeyword !== "") {
                    clearSearch();
                }
            }, 300);
        });

        // 清除搜索按钮
        $("#newsSearchClearBtn").on("click", function () {
            clearSearch();
        });
    });
})();
