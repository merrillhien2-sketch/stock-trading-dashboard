# -*- coding: utf-8 -*-
"""东方财富数据源 - 新闻资讯、资金流向"""

import json
import time
from bs4 import BeautifulSoup

from .base import BaseScraper
from .constants import NEWS_COLUMNS


class EastmoneyScraper(BaseScraper):
    """东方财富数据源"""

    # 板块类型映射: board_type -> fs参数
    SECTOR_FS_MAP = {
        "ALL_BK": "m:90+t:2",   # 行业板块
        "GN_BK": "m:90+t:3",    # 概念板块
        "DY_BK": "m:90+t:1",    # 地域板块
    }

    def _eastmoney_get(self, url, params=None, retries=5):
        """东方财富API专用GET请求，带Referer和重试"""
        em_headers = {
            "Referer": "https://data.eastmoney.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
        for attempt in range(retries):
            try:
                resp = self.session.get(url, params=params, headers=em_headers, timeout=15)
                resp.raise_for_status()
                text = resp.text.strip()
                # 处理JSONP
                if text.startswith("jQuery") or text.startswith("kline_data"):
                    text = text[text.index("(") + 1: text.rindex(")")] if "(" in text and ")" in text else text
                return json.loads(text) if text else None
            except Exception as e:
                print(f"[EastMoney API Error] attempt={attempt+1}/{retries} {url}: {e}")
                if attempt < retries - 1:
                    time.sleep(5)
        return None

    def get_sector_fund_flow(self, board_type="ALL_BK"):
        """获取板块资金流向 (push2.eastmoney.com已被网络阻断，直接返回None)"""
        print(f"[SectorFlow] push2.eastmoney.com 不可用，板块资金流向数据暂不提供")
        return None

    def get_fund_flow(self, secid, klt=101, lmt=30):
        """获取历史资金流向 (东方财富个股/指数资金流向日K线)"""
        from config import Config

        params = {
            "secid": secid,
            "fields1": "f1,f2,f3,f7",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65",
            "klt": klt,
            "lmt": lmt,
            "end": "20500101",
            "ut": Config.EASTMONEY_UT,
        }
        data = self._eastmoney_get(
            "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get",
            params=params,
            retries=Config.RETRY_COUNT,
        )
        if not data or data.get("rc") != 0:
            return None

        trends = data.get("data", {}).get("trends")
        if not trends:
            return None

        result = []
        for trend in trends:
            try:
                parts = trend.split(",")
                if len(parts) < 12:
                    continue
                result.append({
                    "date": parts[0],
                    "main_net": round(float(parts[1]) / 10000, 2),       # 主力净流入(万元)
                    "super_net": round(float(parts[2]) / 10000, 2),        # 超大单净流入(万元)
                    "super_pct": float(parts[3]) if parts[3] else 0,       # 超大单净占比(%)
                    "big_net": round(float(parts[4]) / 10000, 2),           # 大单净流入(万元)
                    "big_pct": float(parts[5]) if parts[5] else 0,         # 大单净占比(%)
                    "mid_net": round(float(parts[6]) / 10000, 2),          # 中单净流入(万元)
                    "mid_pct": float(parts[7]) if parts[7] else 0,         # 中单净占比(%)
                    "small_net": round(float(parts[8]) / 10000, 2),         # 小单净流入(万元)
                    "small_pct": float(parts[9]) if parts[9] else 0,       # 小单净占比(%)
                    "amount": round(float(parts[10]) / 10000, 2) if parts[10] else 0,  # 成交额(万元)
                })
            except (IndexError, ValueError) as e:
                print(f"[FundFlow] 解析趋势数据失败: {e}")
                continue

        return result if result else None

    def get_realtime_fund_flow(self, secid):
        """获取实时资金流向 (使用日K线最新数据模拟)"""
        # 东方财富没有专门的实时资金流向API，用最近几天的日K线数据代替
        return self.get_fund_flow(secid, klt=101, lmt=5)

    # ==================== 新闻资讯 ====================

    def get_news(self, category="finance", page=1, page_size=20):
        """获取新闻资讯 (多源: 东方财富 + 同花顺)"""
        column = NEWS_COLUMNS.get(category, "350")
        url = "https://np-listapi.eastmoney.com/comm/web/getNewsByColumns"
        params = {
            "client": "web",
            "biz": "web_news_col",
            "column": column,
            "order": 1,
            "needInteractData": 0,
            "page_index": page,
            "page_size": page_size,
            "req_trace": str(int(time.time() * 1000)),
        }
        data = self._get(url, params)  # 不缓存新闻，每次刷新都重新爬取
        if data and str(data.get("code")) in ("0", "1", "200"):
            news_data = data.get("data")
            if news_data:
                news_list = news_data.get("list", [])
                if news_list:
                    return [{
                        "title": item.get("title", "").replace("<em>", "").replace("</em>", ""),
                        "url": item.get("uniqueUrl", item.get("url", "")),
                        "source": item.get("mediaName", item.get("source", "")),
                        "digest": item.get("summary", item.get("digest", "")).replace("<em>", "").replace("</em>", ""),
                        "publish_time": item.get("showTime", item.get("showtime", item.get("publishTime", ""))),
                        "image": "",
                    } for item in news_list]

        # 备用1: 东方财富网页
        news = self._scrape_news_page(category)
        if news:
            return news

        # 备用2: 同花顺
        return self._scrape_10jqka_news(category)

    def _scrape_news_page(self, category="finance"):
        """从东方财富网页抓取新闻"""
        url_map = {
            "finance": "https://finance.eastmoney.com/",
            "policy": "https://finance.eastmoney.com/",
            "tech": "https://finance.eastmoney.com/",
            "stock": "https://stock.eastmoney.com/",
            "global": "https://finance.eastmoney.com/",
        }
        keyword_map = {
            "policy": ["政策", "国务院", "央行", "监会", "财政部", "发改委", "规划", "改革", "意见", "通知", "条例"],
            "tech": ["科技", "芯片", "半导", "人工智", "AI", "5G", "量子", "生物", "数据", "算法", "算力", "数字", "创新"],
            "stock": ["股", "涨", "跌", "板", "指数", "成交", "资金", "主力", "龙虎", "北向"],
        }
        url = url_map.get(category, url_map["finance"])
        keywords = keyword_map.get(category, [])

        try:
            resp = self.session.get(url, timeout=10)
            resp.encoding = "utf-8"
            soup = BeautifulSoup(resp.text, "lxml")
            news_items = []
            seen_titles = set()

            for a in soup.select("a"):
                title = a.get_text(strip=True)
                href = a.get("href", "")
                if not title or len(title) < 8 or len(title) > 100:
                    continue
                if title in seen_titles:
                    continue
                if "eastmoney.com" not in href or ".html" not in href:
                    continue
                if keywords and not any(kw in title for kw in keywords):
                    continue

                seen_titles.add(title)
                news_items.append({
                    "title": title,
                    "url": href,
                    "source": "东方财富",
                    "digest": "",
                    "publish_time": "",
                    "image": "",
                })
                if len(news_items) >= 15:
                    break

            return news_items if news_items else None
        except Exception as e:
            print(f"[News Scrape Error] {e}")
            return None

    def _scrape_10jqka_news(self, category="finance"):
        """从同花顺抓取新闻"""
        try:
            resp = self.session.get("https://news.10jqka.com.cn/",
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.10jqka.com.cn/"}, timeout=10)
            resp.encoding = "utf-8"
            soup = BeautifulSoup(resp.text, "lxml")
            news_items = []
            seen_titles = set()

            for a in soup.select("a"):
                title = a.get_text(strip=True)
                href = a.get("href", "")
                if not title or len(title) < 10 or len(title) > 100:
                    continue
                if title in seen_titles:
                    continue
                if "10jqka.com.cn" not in href:
                    continue

                seen_titles.add(title)
                if category == "policy" and not any(k in title for k in ["政策", "国务院", "央行", "监管"]):
                    continue
                if category == "tech" and not any(k in title for k in ["科技", "AI", "芯片", "数据", "数字"]):
                    continue

                news_items.append({
                    "title": title,
                    "url": href if href.startswith("http") else f"https:{href}",
                    "source": "同花顺",
                    "digest": "",
                    "publish_time": "",
                    "image": "",
                })
                if len(news_items) >= 15:
                    break

            return news_items if news_items else None
        except Exception as e:
            print(f"[10jqka Error] {e}")
            return None