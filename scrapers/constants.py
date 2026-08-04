# -*- coding: utf-8 -*-
"""常量定义模块"""

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# 指数secid映射 (东方财富secid, 腾讯代码, 新浪代码, 名称)
INDEX_MAP = {
    "sh": ("1.000001", "sh000001", "s_sh000001", "上证指数"),
    "sz": ("0.399001", "sz399001", "s_sz399001", "深证成指"),
    "cyb": ("0.399006", "sz399006", "s_sz399006", "创业板指"),
    "kc50": ("1.000688", "sh000688", "s_sh000688", "科创50"),
    "hsi": ("100.HSI", "hkHSI", "hkHSI", "恒生指数"),
    "hstech": ("100.HSTECH", "hkHSTECH", "hkHSTECH", "恒生科技"),
    "dji": ("100.DJIA", "usDJI", "gb_dji", "道琼斯"),
    "spx": ("100.SPX", "usSPX", "gb_inx", "标普500"),
    "ixic": ("100.NDAQ", "usIXIC", "gb_ixic", "纳斯达克"),
}

# 腾讯K线符号映射 (东方财富secid -> 腾讯符号)
KLINE_SYMBOL_MAP = {
    "0.399006": "sz399006",
    "0.399001": "sz399001",
    "1.000001": "sh000001",
    "1.000688": "sh000688",
    "100.HSI": "hkHSI",
    "100.HSTECH": "hkHSTECH",
    "100.DJIA": "usDJI",
    "100.SPX": "usSPX",
    "100.NDAQ": "usIXIC",
}

# 热门港股列表 (腾讯格式)
HOT_HK_STOCKS = [
    "hk00700", "hk09988", "hk03690", "hk09999", "hk01810",
    "hk02318", "hk09618", "hk02015", "hk01211", "hk02269",
    "hk09888", "hk06098", "hk00772", "hk00388", "hk00669",
]

# 热门美股列表 (腾讯格式)
HOT_US_STOCKS = [
    "usAAPL", "usMSFT", "usGOOGL", "usAMZN", "usNVDA",
    "usMETA", "usTSLA", "usJPM", "usV", "usJNJ",
    "usWMT", "usXOM", "usPG", "usUNH", "usHD",
]

# 新闻栏目
NEWS_COLUMNS = {
    "finance": "350",
    "policy": "351",
    "tech": "358",
    "stock": "74",
    "global": "355",
}

# 兼容旧版导入
INDEX_SECIDS = {k: v[0] for k, v in INDEX_MAP.items()}