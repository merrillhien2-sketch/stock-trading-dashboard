# -*- coding: utf-8 -*-
"""非debug模式启动"""
from app import app
app.run(host="0.0.0.0", port=5566, debug=False)