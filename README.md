# 股票交易决策仪表盘

一个基于 Flask + ECharts 的股票市场数据可视化仪表盘，支持 A股、港股、美股 K线分析、资金流向、行业板块和新闻资讯。

## 在线体验

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/merrillhien2-sketch/stock-trading-dashboard)

## 功能特性

- **新闻资讯**：顶部展示政策、财经、科技等多类新闻，带发布时间
- **A股大盘**：上证指数、深证成指、创业板指、科创50 K线分析
- **创业板/科创**：创业板指、科创50、深证成指走势
- **港股分析**：恒生指数、恒生科技指数资金流向与K线
- **美股K线**：道琼斯、标普500、纳斯达克指数（多数据源 fallback）
- **行业板块**：行业、概念、地域板块资金流向
- **资金流向**：主力/超大单/大单净流入分析

## 技术栈

- 后端：Flask + requests + BeautifulSoup4
- 前端：Bootstrap5 + ECharts + native JS
- 数据源：腾讯财经、新浪财经、东方财富
- 部署：Render（Gunicorn）

## 本地运行

```bash
pip install -r requirements.txt
python app.py
```

访问 http://127.0.0.1:5566

## 数据来源声明

本项目数据来源于公开金融数据接口，仅供学习交流使用，不构成投资建议。
