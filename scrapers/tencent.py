# -*- coding: utf-8 -*-
"""腾讯行情数据源 - 实时行情、K线数据"""

import json as _json
import urllib.request as _url
import urllib.parse as _parse
import time as _time

from .base import BaseScraper
from .constants import INDEX_MAP, KLINE_SYMBOL_MAP


class TencentScraper(BaseScraper):
    """腾讯行情数据源"""

    # ==================== 实时行情 (腾讯) ====================

    def get_index_data(self, secid):
        """获取指数实时数据 (腾讯行情API)"""
        # 查找腾讯代码
        qq_code = None
        for key, (eid, qq, _, name) in INDEX_MAP.items():
            if eid == secid:
                qq_code = qq
                break
        if not qq_code:
            return None

        try:
            resp = self.session.get(
                f"https://qt.gtimg.cn/q={qq_code}",
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://gu.qq.com/"},
                timeout=10
            )
            if resp.status_code == 200 and "~" in resp.text:
                parts = resp.text.split("~")
                if len(parts) > 37:
                    name = parts[1] if parts[1] else qq_code
                    price = float(parts[3]) if parts[3] else 0
                    prev_close = float(parts[4]) if parts[4] else price
                    open_p = float(parts[5]) if parts[5] else 0
                    high = float(parts[33]) if len(parts) > 33 and parts[33] else 0
                    low = float(parts[34]) if len(parts) > 34 and parts[34] else 0
                    change = float(parts[31]) if len(parts) > 31 and parts[31] else 0
                    change_pct = float(parts[32]) if len(parts) > 32 and parts[32] else 0
                    volume = int(float(parts[6])) if len(parts) > 6 and parts[6] else 0
                    amount = float(parts[37]) if len(parts) > 37 and parts[37] else 0
                    amplitude = abs(high - low) / prev_close * 100 if prev_close else 0

                    return {
                        "code": secid,
                        "name": name,
                        "price": price,
                        "open": open_p,
                        "high": high,
                        "low": low,
                        "prev_close": prev_close,
                        "change": round(change, 2),
                        "change_pct": round(change_pct, 2),
                        "amplitude": round(amplitude, 2),
                        "volume": volume,
                        "amount": amount,
                        "turnover_rate": 0,
                    }
        except Exception as e:
            print(f"[Tencent Index Error] {e}")

        # 备用: 新浪实时行情 (由SinaScraper提供)
        return None

    def get_market_overview(self):
        """获取大盘概览"""
        result = []
        for key, (secid, _, _, _) in INDEX_MAP.items():
            data = self.get_index_data(secid)
            if data:
                data["key"] = key
                result.append(data)
        return result

    # ==================== K线数据 (腾讯) ====================

    def get_kline_data(self, secid, klt=101, lmt=120):
        """获取K线数据 (多源: 腾讯为主，美股部分由SinaScraper补充)"""
        # 尝试腾讯K线API (支持A股/港股/美股)
        result = self._get_kline_tencent(secid, klt, lmt)

        # 美股K线数据补充: 腾讯API对美股支持有限
        # 腾讯有数据时直接用腾讯(交易日日期准确); 腾讯无数据(如标普500)时用新浪补充
        us_secids = {"100.DJIA", "100.SPX", "100.NDAQ"}
        if secid in us_secids and (not result or not result.get("klines")):
            # 由SinaScraper提供_get_us_kline_from_sina
            return None  # 交由MarketScraper的多继承链处理

        if result and result.get("klines"):
            return result

        return None  # 交由SinaScraper的_get_kline_sina处理

    def _get_kline_tencent(self, secid, klt=101, lmt=120):
        """腾讯K线API (带重试)"""
        symbol = KLINE_SYMBOL_MAP.get(secid)
        if not symbol:
            return None

        scale = "day" if klt == 101 else ("week" if klt == 102 else "month")
        # 腾讯K线参数格式: symbol,scale,start_date,end_date,count,qfq
        params = _parse.urlencode({"param": f"{symbol},{scale},,,{lmt},qfq"})
        url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?{params}"

        for attempt in range(5):
            try:
                req = _url.Request(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Referer": "https://gu.qq.com/",
                    "Accept": "*/*",
                })
                resp = _url.urlopen(req, timeout=10)
                data = _json.loads(resp.read().decode("utf-8"))

                err = data.get("error")
                code = data.get("code", 0)
                if err is not None or code != 0:
                    if attempt < 4:
                        _time.sleep(1)
                        continue
                    return None

                d = data.get("data")
                if not d:
                    if attempt < 4:
                        _time.sleep(1)
                        continue
                    return None

                board = d.get(symbol, {})
                if not board:
                    if attempt < 4:
                        _time.sleep(1)
                        continue
                    return None

                # 根据周期获取对应的数据键
                data_key = scale
                day_data = board.get(data_key, [])
                # 备用：尝试qfq前缀的键
                if not day_data:
                    day_data = board.get(f"qfq{data_key}", [])
                # 备用：尝试day键
                if not day_data and scale != "day":
                    day_data = board.get("day", [])

                if not day_data:
                    if attempt < 4:
                        _time.sleep(1)
                        continue
                    return None

                name = ""
                for key, (eid, _, _, n) in INDEX_MAP.items():
                    if eid == secid:
                        name = n
                        break

                klines = []
                for item in day_data:
                    if isinstance(item, list) and len(item) >= 6:
                        klines.append({
                            "date": str(item[0]),
                            "open": float(item[1]),
                            "close": float(item[2]),
                            "high": float(item[3]),
                            "low": float(item[4]),
                            "volume": int(float(item[5])),
                            "amount": float(item[5]),
                        })

                if not klines:
                    return None
                return {"name": name, "code": secid, "klines": klines}
            except Exception:
                if attempt < 2:
                    _time.sleep(0.5)
                    continue
                return None
        return None

    def get_hk_stock_list(self, count=15):
        """获取港股热门列表 (腾讯行情)"""
        from .constants import HOT_HK_STOCKS

        try:
            codes = ",".join(HOT_HK_STOCKS)
            resp = self.session.get(
                f"https://qt.gtimg.cn/q={codes}",
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://gu.qq.com/"},
                timeout=10
            )
            result = []
            for line in resp.text.strip().split(";"):
                if "~" in line:
                    parts = line.split("~")
                    if len(parts) > 37:
                        name = parts[1] if parts[1] else ""
                        code = parts[2] if len(parts) > 2 else ""
                        price = float(parts[3]) if parts[3] else 0
                        change_pct = float(parts[32]) if parts[32] else 0
                        change = float(parts[31]) if len(parts) > 31 and parts[31] else 0
                        amount = float(parts[37]) if len(parts) > 37 and parts[37] else 0
                        high = float(parts[33]) if len(parts) > 33 and parts[33] else 0
                        low = float(parts[34]) if len(parts) > 34 and parts[34] else 0
                        open_p = float(parts[5]) if len(parts) > 5 and parts[5] else 0
                        if name:
                            result.append({
                                "code": code,
                                "name": name,
                                "price": price,
                                "change_pct": round(change_pct, 2),
                                "change": round(change, 2),
                                "main_net": 0,
                                "main_pct": 0,
                                "amount": amount,
                                "high": high,
                                "low": low,
                                "open": open_p,
                            })
            return result[:count] if result else None
        except Exception as e:
            print(f"[HK Stock Error] {e}")
        return None

    def get_us_stock_list(self, count=15):
        """获取美股热门列表 (腾讯行情)"""
        from .constants import HOT_US_STOCKS

        try:
            codes = ",".join(HOT_US_STOCKS)
            resp = self.session.get(
                f"https://qt.gtimg.cn/q={codes}",
                headers={"User-Agent": "Mozilla/5.0", "Referer": "https://gu.qq.com/"},
                timeout=10
            )
            result = []
            for line in resp.text.strip().split(";"):
                if "~" in line:
                    parts = line.split("~")
                    if len(parts) > 37:
                        name = parts[1] if parts[1] else ""
                        code = parts[2] if len(parts) > 2 else ""
                        price = float(parts[3]) if parts[3] else 0
                        change_pct = float(parts[32]) if parts[32] else 0
                        change = float(parts[31]) if len(parts) > 31 and parts[31] else 0
                        amount = float(parts[37]) if len(parts) > 37 and parts[37] else 0
                        high = float(parts[33]) if len(parts) > 33 and parts[33] else 0
                        low = float(parts[34]) if len(parts) > 34 and parts[34] else 0
                        open_p = float(parts[5]) if len(parts) > 5 and parts[5] else 0
                        if name:
                            result.append({
                                "code": code,
                                "name": name,
                                "price": price,
                                "change_pct": round(change_pct, 2),
                                "change": round(change, 2),
                                "main_net": 0,
                                "main_pct": 0,
                                "amount": amount,
                                "high": high,
                                "low": low,
                                "open": open_p,
                            })
            return result[:count] if result else None
        except Exception as e:
            print(f"[US Stock Error] {e}")
        return None