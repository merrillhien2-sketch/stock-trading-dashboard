import os


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
    PORT = int(os.environ.get('PORT', 5566))
    DEBUG = os.environ.get('FLASK_DEBUG', '1') == '1'

    # 缓存配置
    CACHE_TTL = 5  # 秒
    NEWS_CACHE_TTL = 0  # 新闻不缓存

    # 东方财富工具参数
    EASTMONEY_UT = 'b2884a393a59ad64002292a3e90d46a5'

    # API重试配置
    RETRY_COUNT = 3
    RETRY_DELAY = 1  # 秒