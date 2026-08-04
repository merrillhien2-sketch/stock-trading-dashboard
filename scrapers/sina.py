# -*- coding: utf-8 -*-
"""新浪行情数据源 - 实时行情(备用)、K线(备用)、涨跌排行、市场情绪、港股/美股列表"""

import json
from datetime import datetime, timedelta

from .base import BaseScraper
from .constants import INDEX_MAP


class SinaScraper(BaseScraper):
    """新浪行情数据源"""

    def _get_index_sina(self, secid):
        """备用: 新浪实时行情 (支持A股/港股/美股)"""
        sina_code = None
        for key, (eid, _, sn, _) in INDEX_MAP.items():
            if eid == secid:
                sina_code = sn
                break
        if not sina_code:
            return None

        try:
            resp = self.session.get(
                f"https://hq.sinajs.cn/list={sina_code}",
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://finance.sina.com.cn/"},
                timeout=10
            )
            if resp.status_code == 200:
                text = resp.text.strip()
                if "=" in text and text.count('"') > 1:
                    val = text.split('"')[1]
                    fields = val.split(",")
                    if fields and fields[0]:
                        name = fields[0]
                        is_us = sina_code.startswith("gb_")

                        if is_us:
                            # 美股格式: 名称,最新价,涨跌%,日期时间,涨跌额,今开,最高,最低,昨收,...
                            price = float(fields[1]) if len(fields) > 1 and fields[1] else 0
                            change_pct = float(fields[2]) if len(fields) > 2 and fields[2] else 0
                            # fields[3]是日期时间字符串，跳过
                            change = float(fields[4]) if len(fields) > 4 and fields[4] else 0
                            open_p = float(fields[5]) if len(fields) > 5 and fields[5] else price
                            high = float(fields[6]) if len(fields) > 6 and fields[6] else price
                            low = float(fields[7]) if len(fields) > 7 and fields[7] else price
                            prev_close = float(fields[8]) if len(fields) > 8 and fields[8] else price
                            volume = 0
                            amount = 0
                        else:
                            # A股/港股格式: 名称,最新价,涨跌额,涨跌%,成交量,成交额
                            price = float(fields[1]) if len(fields) > 1 and fields[1] else 0
                            change = float(fields[2]) if len(fields) > 2 and fields[2] else 0
                            change_pct = float(fields[3]) if len(fields) > 3 and fields[3] else 0
                            # A股sinajs不返回开高低，用昨收近似
                            prev_close = price / (1 + change_pct / 100) if change_pct else price
                            open_p = prev_close
                            high = max(price, prev_close)
                            low = min(price, prev_close)
                            volume = float(fields[4]) if len(fields) > 4 and fields[4] else 0
                            amount = float(fields[5]) if len(fields) > 5 and fields[5] else 0

                        return {
                            "code": secid,
                            "name": name,
                            "price": price,
                            "open": open_p,
                            "high": high,
                            "low": low,
                            "prev_close": prev_close,
                            "change": change,
                            "change_pct": change_pct,
                            "amplitude": round((high - low) / prev_close * 100, 2) if prev_close else 0,
                            "volume": int(volume) if volume else 0,
                            "amount": amount,
                            "turnover_rate": 0,
                        }
        except Exception as e:
            print(f"[Sina Index Error] {e}")
        return None

    def _get_us_kline_from_sina(self, secid, klt=101, lmt=120):
        """通过新浪历史K线接口获取美股指数K线数据

        新浪美股K线接口: https://stock.finance.sina.com.cn/usstock/api/json_v2.php/US_MinKService.getDailyK
        支持指数: .DJI(道琼斯), .IXIC(纳斯达克), .INX(标普500)
        返回字段: d(日期), o(开盘), h(最高), l(最低), c(收盘), v(成交量), a(成交额)
        """
        sina_map = {
            "100.DJIA": ".DJI",
            "100.SPX": ".INX",
            "100.NDAQ": ".IXIC",
        }
        sina_code = sina_map.get(secid)
        if not sina_code:
            return None

        # 周期映射: 仅支持日K/周K/月K
        if klt == 101:
            scale = "d"  # 日K
        elif klt == 102:
            scale = "w"  # 周K
        elif klt == 103:
            scale = "m"  # 月K
        else:
            scale = "d"

        try:
            url = (
                "https://stock.finance.sina.com.cn/usstock/api/json_v2.php/"
                "US_MinKService.getDailyK"
            )
            resp = self.session.get(
                url,
                params={"symbol": sina_code, "___qn": "3n"},
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://finance.sina.com.cn/"},
                timeout=20
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            if not data or not isinstance(data, list):
                return None

            # 新浪返回全部历史数据，按需求截取最近 lmt 条
            items = data[-lmt:] if len(data) > lmt else data
            if not items:
                return None

            name = ""
            for key, (eid, _, _, n) in INDEX_MAP.items():
                if eid == secid:
                    name = n
                    break

            klines = []
            for item in items:
                klines.append({
                    "date": str(item.get("d", "")),
                    "open": float(item.get("o", 0)),
                    "close": float(item.get("c", 0)),
                    "high": float(item.get("h", 0)),
                    "low": float(item.get("l", 0)),
                    "volume": int(float(item.get("v", 0))),
                    "amount": float(item.get("a", 0)),
                })

            if len(klines) < 5:
                return None

            return {"name": name, "code": secid, "klines": klines}
        except Exception as e:
            print(f"[US Kline Sina Error] {e}")
        return None

    def _get_kline_sina(self, secid, klt, lmt):
        """备用: 新浪K线数据 (仅A股)"""
        sina_symbols = {"0.399006": "sz399006", "0.399001": "sz399001",
                        "1.000001": "sh000001", "1.000688": "sh000688"}
        symbol = sina_symbols.get(secid)
        if not symbol:
            return None
        scale = "240" if klt == 101 else ("120" if klt == 102 else "60")
        try:
            resp = self.session.get(
                "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData",
                params={"symbol": symbol, "scale": scale, "ma": "no", "datalen": str(lmt)},
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://finance.sina.com.cn/"},
                timeout=10
            )
            if resp.status_code == 200 and resp.text.strip() != "null":
                items = json.loads(resp.text.strip())
                if items:
                    name = items[0].get("name", "")
                    return {
                        "name": name,
                        "code": secid,
                        "klines": [{
                            "date": item["day"],
                            "open": float(item["open"]),
                            "close": float(item["close"]),
                            "high": float(item["high"]),
                            "low": float(item["low"]),
                            "volume": int(float(item["volume"])),
                            "amount": 0,
                        } for item in items],
                    }
        except Exception as e:
            print(f"[Sina Kline Error] {e}")
        return None

    def _fetch_top_stocks_page(self, base_url, sina_h, page, asc):
        """获取新浪行情中心单页排行数据"""
        try:
            r = self.session.get(base_url, params={
                "page": page, "num": 100, "sort": "changepercent",
                "asc": asc, "node": "hs_a", "_s_r_a": "page"
            }, headers=sina_h, timeout=15)
            data = r.text.strip()
            if data and data != "null" and data != "[]":
                items = json.loads(data)
                return items if items else []
        except Exception as e:
            print(f"[Top Stocks Page Error] asc={asc} page={page}: {e}")
        return []

    def get_top_stocks(self, sort_field="f3", count=10, ascending=False):
        """获取涨跌幅排行榜 (新浪行情中心)

        同时获取上涨榜(asc=0)和下跌榜(asc=1)数据，合并去重后本地排序，
        确保跌幅榜能返回真实的下跌股票而非仅接近零的上涨股票。
        """
        base_url = "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData"
        sina_h = {"User-Agent": "Mozilla/5.0", "Referer": "https://vip.stock.finance.sina.com.cn/"}

        try:
            all_items = []
            seen_codes = set()

            # 获取上涨榜 (asc=0)
            for page in [1, 2, 3]:
                items = self._fetch_top_stocks_page(base_url, sina_h, page, 0)
                if not items:
                    break
                for item in items:
                    code = item.get("code", "")
                    if code and code not in seen_codes:
                        seen_codes.add(code)
                        all_items.append(item)

            # 获取下跌榜 (asc=1)，新浪此参数有时为空，但获取到即可补充真实下跌数据
            for page in [1, 2, 3]:
                items = self._fetch_top_stocks_page(base_url, sina_h, page, 1)
                if not items:
                    break
                for item in items:
                    code = item.get("code", "")
                    if code and code not in seen_codes:
                        seen_codes.add(code)
                        all_items.append(item)

            if not all_items:
                return None

            # 本地排序
            all_items.sort(key=lambda x: float(x.get("changepercent", 0)), reverse=not ascending)

            result = []
            for item in all_items[:count]:
                result.append({
                    "code": item.get("code", ""),
                    "name": item.get("name", ""),
                    "price": float(item.get("trade", 0)),
                    "change_pct": float(item.get("changepercent", 0)),
                    "main_net": 0,
                    "amount": float(item.get("amount", 0)),
                })
            return result
        except Exception as e:
            print(f"[Top Stocks Error] {e}")
        return None

    def get_market_sentiment(self):
        """获取市场情绪(涨跌家数) (新浪行情中心多页)"""
        base_url = "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData"
        sina_h = {"User-Agent": "Mozilla/5.0", "Referer": "https://vip.stock.finance.sina.com.cn/"}

        try:
            # 获取上涨股票 (asc=0, 5页)
            all_items = []
            for page in [1, 2, 3, 4, 5]:
                r = self.session.get(base_url, params={
                    "page": page, "num": 100, "sort": "changepercent",
                    "asc": 0, "node": "hs_a", "_s_r_a": "page"
                }, headers=sina_h, timeout=10)
                data = r.text.strip()
                if data and data != "null" and data != "[]":
                    items = json.loads(data)
                    if items:
                        all_items.extend(items)
                else:
                    break

            # 获取下跌股票 (asc=1, 5页)
            for page in [1, 2, 3, 4, 5]:
                r = self.session.get(base_url, params={
                    "page": page, "num": 100, "sort": "changepercent",
                    "asc": 1, "node": "hs_a", "_s_r_a": "page"
                }, headers=sina_h, timeout=10)
                data = r.text.strip()
                if data and data != "null" and data != "[]":
                    items = json.loads(data)
                    if items:
                        all_items.extend(items)
                else:
                    break

            if not all_items:
                return None

            # 去重
            seen = set()
            unique_items = []
            for item in all_items:
                code = item.get("code", "")
                if code not in seen:
                    seen.add(code)
                    unique_items.append(item)

            up_count = sum(1 for i in unique_items if float(i.get("changepercent", 0)) > 0)
            down_count = sum(1 for i in unique_items if float(i.get("changepercent", 0)) < 0)
            flat_count = sum(1 for i in unique_items if float(i.get("changepercent", 0)) == 0)
            limit_up = sum(1 for i in unique_items if float(i.get("changepercent", 0)) >= 9.9)
            limit_down = sum(1 for i in unique_items if float(i.get("changepercent", 0)) <= -9.9)
            total_amount = sum(float(i.get("amount", 0)) for i in unique_items)
            total = up_count + down_count + flat_count

            return {
                "up_count": up_count,
                "down_count": down_count,
                "flat_count": flat_count,
                "limit_up": limit_up,
                "limit_down": limit_down,
                "total": total,
                "up_ratio": round(up_count / total * 100, 2) if total > 0 else 0,
                "down_ratio": round(down_count / total * 100, 2) if total > 0 else 0,
                "total_amount": total_amount,
            }
        except Exception as e:
            print(f"[Sentiment Error] {e}")
        return None