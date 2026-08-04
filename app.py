# -*- coding: utf-8 -*-
"""
股票交易决策仪表盘 - Flask主应用
多数据源架构：腾讯行情(A股/港股/美股K线) + 新浪行情中心(排行/情绪) + 东方财富(新闻)
"""

from flask import Flask, render_template, jsonify, request
from scrapers import MarketScraper, INDEX_MAP
from datetime import datetime

app = Flask(__name__)
app.config["JSON_AS_ASCII"] = False
app.config["SECRET_KEY"] = "stock-dashboard-2026"

scraper = MarketScraper()


# ==================== 页面路由 ====================

@app.route("/")
def index():
    """主仪表盘页面"""
    return render_template("index.html", active_page="home")


@app.route("/chinext")
def chinext():
    """创业板/科创板K线分析页面"""
    index_items = [
        {"name": "创业板指", "secid": "0.399006"},
        {"name": "科创50", "secid": "1.000688"},
        {"name": "深证成指", "secid": "0.399001"},
    ]
    return render_template("chinext.html", active_page="chinext", index_items=index_items)


@app.route("/a-stock")
def a_stock():
    """A股大盘K线分析页面"""
    index_items = [
        {"name": "上证指数", "secid": "1.000001"},
        {"name": "深证成指", "secid": "0.399001"},
        {"name": "创业板指", "secid": "0.399006"},
        {"name": "科创50", "secid": "1.000688"},
    ]
    return render_template("a_stock.html", active_page="a-stock", index_items=index_items)


@app.route("/hk-stock")
def hk_stock():
    """港股资金走势页面"""
    index_items = [
        {"name": "恒生指数", "secid": "100.HSI"},
        {"name": "恒生科技", "secid": "100.HSTECH"},
    ]
    return render_template("hk_stock.html", active_page="hk", index_items=index_items)


@app.route("/news")
def news():
    """新闻资讯页面"""
    return render_template("news.html", active_page="news")


@app.route("/us-stock")
def us_stock():
    """美股K线分析页面"""
    index_items = [
        {"name": "道琼斯", "secid": "100.DJIA"},
        {"name": "标普500", "secid": "100.SPX"},
        {"name": "纳斯达克", "secid": "100.NDAQ"},
    ]
    return render_template("us_stock.html", active_page="us", index_items=index_items)


@app.route("/sectors")
def sectors():
    """板块资金流向页面"""
    return render_template("sectors.html", active_page="sectors")


@app.route("/fund-flow")
def fund_flow():
    """资金流向分析页面"""
    index_items = [
        {"name": "上证", "secid": "1.000001"},
        {"name": "深证", "secid": "0.399001"},
        {"name": "创业板", "secid": "0.399006"},
        {"name": "科创50", "secid": "1.000688"},
        {"name": "恒生", "secid": "100.HSI"},
        {"name": "道琼斯", "secid": "100.DJIA"},
        {"name": "标普500", "secid": "100.SPX"},
    ]
    return render_template("fund_flow.html", active_page="fundflow", index_items=index_items)


# ==================== API路由 ====================

@app.route("/api/market-overview")
def api_market_overview():
    """大盘指数概览"""
    try:
        data = scraper.get_market_overview()
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "获取数据失败"})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500


@app.route("/api/kline")
def api_kline():
    """K线数据"""
    try:
        secid = request.args.get("secid", "0.399006")
        klt = request.args.get("klt", "101")
        lmt = int(request.args.get("lmt", "120"))
        data = scraper.get_kline_data(secid, int(klt), lmt)
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "获取K线数据失败"})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500


def _parse_board_type(value):
    """将前端传来的market/type参数解析为板块类型board_type。
    支持两种格式:
      - type=ALL_BK / type=GN_BK / type=DY_BK (直接board_type)
      - market=90 -> ALL_BK (行业板块)
      - market=90&t:3 / market=90,t:3 -> GN_BK (概念板块)
    """
    if not value:
        return "ALL_BK"
    # 直接board_type
    if value in ("ALL_BK", "GN_BK", "DY_BK"):
        return value
    # market格式: "90" 或 "90&t:3" 或 "90,t:3"
    if "t:3" in value:
        return "GN_BK"
    if "t:1" in value:
        return "DY_BK"
    # 默认market=90 -> 行业板块
    return "ALL_BK"


@app.route("/api/fund-flow")
def api_fund_flow():
    """资金流向数据"""
    try:
        secid = request.args.get("secid", "1.000001")
        klt = int(request.args.get("klt", "101"))
        lmt = int(request.args.get("lmt", "30"))
        data = scraper.get_fund_flow(secid, klt, lmt)
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "数据源维护中，敬请期待", "data_unavailable": True})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500


@app.route("/api/realtime-flow")
def api_realtime_flow():
    """实时资金流向"""
    try:
        secid = request.args.get("secid", "1.000001")
        data = scraper.get_realtime_fund_flow(secid)
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "数据源维护中，敬请期待", "data_unavailable": True})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500


@app.route("/api/sector-flow")
def api_sector_flow():
    """板块资金流向"""
    try:
        # 兼容两种参数格式: type=ALL_BK 或 market=90
        board_type = _parse_board_type(
            request.args.get("type") or request.args.get("market", "ALL_BK")
        )
        data = scraper.get_sector_fund_flow(board_type)
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "数据源维护中，敬请期待", "data_unavailable": True})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500

@app.route("/api/sector-list")
def api_sector_list():
    """板块分类列表"""
    try:
        board_type = _parse_board_type(
            request.args.get("type") or request.args.get("market", "ALL_BK")
        )
        data = scraper.get_sector_fund_flow(board_type)
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "数据源维护中，敬请期待", "data_unavailable": True})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500


@app.route("/api/top-stocks")
def api_top_stocks():
    """涨跌幅排行榜"""
    try:
        count = int(request.args.get("count", "10"))
        ascending = request.args.get("asc", "0") == "1"
        data = scraper.get_top_stocks("f3", count, ascending)
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "获取排行榜失败"})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500


@app.route("/api/news")
def api_news():
    """新闻资讯"""
    try:
        category = request.args.get("category", "finance")
        page = int(request.args.get("page", "1"))
        data = scraper.get_news(category, page)
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "获取新闻失败"})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500


@app.route("/api/sentiment")
def api_sentiment():
    """市场情绪"""
    try:
        data = scraper.get_market_sentiment()
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "获取市场情绪失败"})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500


@app.route("/api/hk-stocks")
def api_hk_stocks():
    """港股热门列表"""
    try:
        count = int(request.args.get("count", "15"))
        data = scraper.get_hk_stock_list(count)
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "获取港股列表失败"})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500


@app.route("/api/index-data")
def api_index_data():
    """单个指数实时数据"""
    try:
        secid = request.args.get("secid", "0.399006")
        data = scraper.get_index_data(secid)
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "获取指数数据失败"})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500


@app.route("/api/us-stocks")
def api_us_stocks():
    """美股热门列表"""
    try:
        count = int(request.args.get("count", "15"))
        data = scraper.get_us_stock_list(count)
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "获取美股列表失败"})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500


@app.route("/api/us-index")
def api_us_index():
    """美股三大指数实时行情"""
    try:
        codes = request.args.get("codes", "gb_dji,gb_ixic,gb_spx")
        secid_map = {
            "gb_dji": "100.DJIA",
            "gb_ixic": "100.NDAQ",
            "gb_spx": "100.SPX",
            "gb_inx": "100.SPX",
        }
        symbols = [s.strip() for s in codes.split(",") if s.strip()]
        data = []
        for sym in symbols:
            secid = secid_map.get(sym)
            if not secid:
                continue
            item = scraper.get_index_data(secid)
            if item:
                item["symbol"] = sym
                data.append(item)
        if data:
            return jsonify({"code": 0, "data": data})
        return jsonify({"code": -1, "msg": "获取美股指数失败"})
    except Exception as e:
        return jsonify({"code": -1, "msg": str(e)}), 500





# ==================== 全局数据注入 ====================

@app.context_processor
def inject_globals():
    """向所有模板注入全局变量"""
    return {
        "current_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "active_page": "",
    }


# ==================== 错误处理 ====================

@app.errorhandler(404)
def not_found(e):
    return render_template("404.html"), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"code": -1, "msg": "服务器内部错误"}), 500


if __name__ == "__main__":
    print("=" * 50)
    print("  股票交易决策仪表盘")
    print("  访问地址: http://127.0.0.1:5566")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5566, debug=True)