# -*- coding: utf-8 -*-
"""scrapers 包 - 多数据源市场数据抓取模块"""

from .base import BaseScraper
from .tencent import TencentScraper
from .sina import SinaScraper
from .eastmoney import EastmoneyScraper
from .constants import (
    INDEX_MAP, KLINE_SYMBOL_MAP, HOT_HK_STOCKS,
    HOT_US_STOCKS, NEWS_COLUMNS, INDEX_SECIDS, HEADERS,
)


class MarketScraper(TencentScraper, SinaScraper, EastmoneyScraper):
    """组合所有数据源的统一爬虫类

    MRO顺序: MarketScraper -> TencentScraper -> SinaScraper -> EastmoneyScraper -> BaseScraper
    - 腾讯数据源优先
    - 新浪作为备用
    - 东方财富负责新闻和资金流向
    """

    def get_index_data(self, secid):
        """获取指数实时数据 (腾讯优先，新浪备用)"""
        result = TencentScraper.get_index_data(self, secid)
        if result:
            return result
        return self._get_index_sina(secid)

    def get_kline_data(self, secid, klt=101, lmt=120):
        """获取K线数据 (多源: 腾讯+A股=新浪备用)"""
        # 尝试腾讯K线API (支持A股/港股/美股)
        result = self._get_kline_tencent(secid, klt, lmt)

        # 美股K线数据补充: 腾讯API对美股支持有限，使用新浪历史日K作为fallback
        us_secids = {"100.DJIA", "100.SPX", "100.NDAQ"}
        if secid in us_secids and (not result or not result.get("klines") or len(result.get("klines", [])) < 30):
            sina_kline = self._get_us_kline_from_sina(secid, klt=klt, lmt=lmt)
            if sina_kline and sina_kline.get("klines"):
                result = sina_kline

        if result and result.get("klines"):
            return result

        # 备用: 新浪K线 (仅A股)
        result = self._get_kline_sina(secid, klt, lmt)
        if result:
            return result

        return None


def qq_to_east(qq_code):
    """腾讯代码转东方财富代码"""
    mapping = {
        "sh000001": "1.000001", "sz399001": "0.399001",
        "sz399006": "0.399006", "sh000688": "1.000688",
        "hkHSI": "100.HSI", "hkHSTECH": "100.HSTECH",
    }
    return mapping.get(qq_code, qq_code)