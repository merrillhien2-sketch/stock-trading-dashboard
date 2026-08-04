# -*- coding: utf-8 -*-
"""基础爬虫类 - 提供session管理、HTTP请求、缓存"""

import requests
import json
import time

from .constants import HEADERS


class BaseScraper:
    """爬虫基类，提供session管理、带缓存的HTTP请求"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.session.trust_env = False
        self._cache = {}
        self._cache_ttl = 5

    def _get(self, url, params=None, headers=None, cache_key=None, timeout=15, raw=False):
        """带缓存的GET请求"""
        if cache_key and cache_key in self._cache:
            cached = self._cache[cache_key]
            if time.time() - cached["time"] < self._cache_ttl:
                return cached["data"]

        try:
            req_headers = {**self.session.headers}
            if headers:
                req_headers.update(headers)
            resp = self.session.get(url, params=params, headers=req_headers, timeout=timeout)
            resp.raise_for_status()
            text = resp.text.strip()

            if raw:
                data = text
            else:
                # 处理JSONP
                if text.startswith("jQuery") or text.startswith("kline_data"):
                    text = text[text.index("(") + 1: text.rindex(")")] if "(" in text and ")" in text else text
                data = json.loads(text) if text else None

            if cache_key and data:
                self._cache[cache_key] = {"data": data, "time": time.time()}
            return data
        except Exception as e:
            print(f"[Scraper] {url}: {e}")
            return None