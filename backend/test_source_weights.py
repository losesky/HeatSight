import asyncio
import json
from app.services.news_heat_score_service import heat_score_service
from app.services.heatlink_client import heatlink_client
from loguru import logger

async def main():
    print("\n===== 测试来源权重更新 =====")
    
    # 设置日志级别
    logger.remove()
    logger.add(lambda msg: print(msg), level="DEBUG")
    
    print("\n1. 首先获取所有来源列表:")
    sources_data = await heatlink_client.get_sources(force_update=True)
    
    # 输出源数据结构
    print(f"\n来源数据类型: {type(sources_data)}")
    
    # 处理API返回值可能是列表或字典的情况
    if isinstance(sources_data, dict):
        sources = sources_data.get("sources", [])
        print(f"从字典中提取源列表，字典键: {list(sources_data.keys())}")
    else:
        # 如果API直接返回列表，就直接使用
        sources = sources_data
        print("API直接返回了列表格式的源数据")
    
    print(f"共获取到 {len(sources)} 个源")
    
    # 显示前3个源的数据结构
    if sources and len(sources) > 0:
        print("\n前3个源的数据结构示例:")
        for i, source in enumerate(sources[:3], 1):
            print(f"\n源 #{i}:")
            print(json.dumps(source, indent=2, ensure_ascii=False))
            
            # 提取source_id
            source_id = source.get("source_id") or source.get("id")
            if source_id:
                print(f"\n2. 获取源 '{source_id}' 的详细信息:")
                try:
                    source_news = await heatlink_client.get_source(source_id, force_update=True)
                    print(f"源新闻数据类型: {type(source_news)}")
                    print(f"源新闻数据键: {list(source_news.keys()) if isinstance(source_news, dict) else 'Not a dict'}")
                    
                    # 输出完整的源新闻数据
                    print("\n源新闻数据结构:")
                    print(json.dumps(source_news, indent=2, ensure_ascii=False)[:500] + "..." if len(json.dumps(source_news)) > 500 else json.dumps(source_news, indent=2, ensure_ascii=False))
                    
                    # 尝试提取items数据
                    if isinstance(source_news, dict):
                        items = source_news.get("items", [])
                        if items:
                            print(f"\n成功获取到 {len(items)} 条新闻项")
                            # 显示第一条新闻的数据结构
                            if items and len(items) > 0:
                                print("\n第一条新闻项结构:")
                                print(json.dumps(items[0], indent=2, ensure_ascii=False)[:500] + "..." if len(json.dumps(items[0])) > 500 else json.dumps(items[0], indent=2, ensure_ascii=False))
                        else:
                            print("\n没有找到新闻项，检查API响应中的可能替代键:")
                            for key in source_news.keys():
                                if isinstance(source_news[key], list) and len(source_news[key]) > 0:
                                    print(f" - 键 '{key}' 包含 {len(source_news[key])} 个列表项")
                except Exception as e:
                    print(f"获取源详细信息失败: {e}")
                    import traceback
                    print(traceback.format_exc())
            
            # 只处理前3个源作为示例
            if i >= 1:
                break
    
    print("\n3. 运行来源权重更新方法:")
    result = await heat_score_service.update_source_weights(None)
    print(f"更新完成，处理了 {len(result)} 个来源权重")
    
    if result:
        print("\n来源权重示例:")
        for source_id, data in list(result.items())[:3]:
            print(f" - {source_id}: 权重={data['weight']:.2f}, 平均互动={data['avg_engagement']:.2f}, 更新频率={data['update_frequency']}")
    else:
        print("未返回来源权重数据")

if __name__ == "__main__":
    asyncio.run(main()) 