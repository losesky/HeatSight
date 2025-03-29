-- 示例主题数据
INSERT INTO topics (title, summary, source_id, category, url, image_url, heat, extra)
VALUES
    ('元宇宙发展现状与未来趋势', 'Facebook更名为Meta后，元宇宙概念持续升温，各大科技巨头争相布局。', '科技日报', '科技', 'https://example.com/news/1', 'https://via.placeholder.com/300x200?text=元宇宙', 98, '{"likes": 1205, "comments": 368}'),
    ('数字人民币试点扩大到更多城市', '数字人民币试点范围进一步扩大，新增多个省份的主要城市。', '金融时报', '财经', 'https://example.com/news/2', 'https://via.placeholder.com/300x200?text=数字人民币', 92, '{"likes": 845, "comments": 226}'),
    ('新能源汽车销量创历史新高', '今年以来，我国新能源汽车销量持续攀升，市场渗透率进一步提高。', '汽车周刊', '汽车', 'https://example.com/news/3', 'https://via.placeholder.com/300x200?text=新能源汽车', 85, '{"likes": 632, "comments": 154}'),
    ('AI绘画引发版权争议', '人工智能绘画工具的兴起引发了关于艺术创作版权归属的广泛争议。', '数字文化报', '文化', 'https://example.com/news/4', 'https://via.placeholder.com/300x200?text=AI绘画', 82, '{"likes": 758, "comments": 293}'),
    ('芯片短缺问题持续影响全球供应链', '全球芯片短缺情况虽有所缓解，但仍影响多个行业生产和供应。', '半导体周刊', '科技', 'https://example.com/news/8', 'https://via.placeholder.com/300x200?text=芯片短缺', 73, '{"likes": 289, "comments": 105}'),
    ('在线教育行业进入深度调整期', '双减政策一年后，在线教育企业纷纷转型，行业生态重构。', '教育时报', '教育', 'https://example.com/news/7', 'https://via.placeholder.com/300x200?text=在线教育', 74, '{"likes": 356, "comments": 127}'),
    ('碳达峰碳中和政策推进情况分析', '各地积极推进碳达峰碳中和相关政策，能源结构持续优化。', '能源评论', '环保', 'https://example.com/news/6', 'https://via.placeholder.com/300x200?text=碳中和', 76, '{"likes": 412, "comments": 98}'),
    ('直播电商新规出台', '新规要求直播带货需更加规范透明，明确标示商品信息和促销规则。', '电商日报', '电商', 'https://example.com/news/5', 'https://via.placeholder.com/300x200?text=直播电商', 79, '{"likes": 542, "comments": 187}');

-- 内容建议模板数据 - 科技类
INSERT INTO content_suggestions (category, suggestion_type, content, position)
VALUES
    ('科技', 'title', '{topic}：改变行业格局的技术革新', 0),
    ('科技', 'title', '{topic}的商业应用与投资价值分析', 1),
    ('科技', 'title', '{topic}：从概念到落地的全景分析', 2),
    ('科技', 'title', '2023年{topic}发展趋势报告', 3),
    ('科技', 'outline', '1. 引言：技术创新的时代背景', 0),
    ('科技', 'outline', '2. 核心技术剖析：原理与架构', 1),
    ('科技', 'outline', '3. 产业链分析：关键参与者与技术壁垒', 2),
    ('科技', 'outline', '4. 市场应用场景与典型案例', 3),
    ('科技', 'outline', '5. 商业模式与投资逻辑', 4),
    ('科技', 'outline', '6. 未来发展趋势与潜在挑战', 5),
    ('科技', 'keyPoint', '{topic}市场规模预计在未来5年内达到千亿规模', 0),
    ('科技', 'keyPoint', '核心技术壁垒主要集中在算法、计算力和数据三方面', 1),
    ('科技', 'keyPoint', '产业链上下游已形成初步生态，但整合度仍有待提高', 2),
    ('科技', 'keyPoint', '头部企业已在该领域投入大量研发资源，竞争格局正在形成', 3),
    ('科技', 'keyPoint', '政策支持力度逐渐加大，规范化管理同步推进', 4),
    ('科技', 'keyPoint', '商业模式正从B端向C端逐步拓展，多样化场景落地', 5),
    ('科技', 'introduction', '近期，{topic}成为科技领域的焦点话题，其突破性进展吸引了产业界、投资界的广泛关注。本文将从技术原理、应用场景、商业模式和未来趋势等多个维度对{topic}进行深入解析，帮助读者全面把握这一前沿技术带来的变革与机遇。', 0);

-- 内容建议模板数据 - 财经类
INSERT INTO content_suggestions (category, suggestion_type, content, position)
VALUES
    ('财经', 'title', '{topic}投资策略与风险分析', 0),
    ('财经', 'title', '{topic}对宏观经济的影响与展望', 1),
    ('财经', 'title', '把握{topic}背后的投资机会', 2),
    ('财经', 'title', '{topic}相关产业链深度剖析', 3),
    ('财经', 'outline', '1. 市场概况：发展历程与现状', 0),
    ('财经', 'outline', '2. 政策环境：相关法规与监管动态', 1),
    ('财经', 'outline', '3. 市场参与者分析：头部机构与新兴力量', 2),
    ('财经', 'outline', '4. 风险因素与应对策略', 3),
    ('财经', 'outline', '5. 投资机会分析与布局建议', 4),
    ('财经', 'outline', '6. 未来展望与趋势预测', 5),
    ('财经', 'keyPoint', '{topic}已成为资本市场重点关注的新兴领域', 0),
    ('财经', 'keyPoint', '相关政策趋势逐渐明朗，监管框架日趋完善', 1),
    ('财经', 'keyPoint', '头部机构战略布局加速，市场集中度有望提升', 2),
    ('财经', 'keyPoint', '中长期投资价值显著，但短期波动风险需关注', 3),
    ('财经', 'keyPoint', '产业链上下游整合将创造新的价值增长点', 4),
    ('财经', 'keyPoint', '国际市场比较视角下，国内市场仍具较大发展空间', 5),
    ('财经', 'introduction', '{topic}作为金融市场的重要议题，正引发投资者广泛关注。本文将从宏观经济背景出发，结合政策环境变化，深入分析{topic}的投资价值、风险特征以及未来发展路径，为投资者提供系统性的分析框架和具体的投资策略参考。', 0);

-- 通用内容建议模板
INSERT INTO content_suggestions (category, suggestion_type, content, position)
VALUES
    ('default', 'title', '{topic}完全指南：核心要点与深度解析', 0),
    ('default', 'title', '{topic}：现状、挑战与未来方向', 1),
    ('default', 'title', '{topic}的多维度分析与实践参考', 2),
    ('default', 'title', '解码{topic}：趋势把握与实操建议', 3),
    ('default', 'outline', '1. 引言：话题背景与重要性', 0),
    ('default', 'outline', '2. 概念界定与理论基础', 1),
    ('default', 'outline', '3. 现状分析：发展历程与关键因素', 2),
    ('default', 'outline', '4. 案例研究：典型实践与经验总结', 3),
    ('default', 'outline', '5. 挑战与机遇：问题与潜力并存', 4),
    ('default', 'outline', '6. 未来展望：趋势预测与建议', 5),
    ('default', 'keyPoint', '{topic}已成为行业关注的焦点，影响日益扩大', 0),
    ('default', 'keyPoint', '正确理解{topic}的核心概念对把握其本质至关重要', 1),
    ('default', 'keyPoint', '目前{topic}发展呈现出区域不平衡、结构性转变等特点', 2),
    ('default', 'keyPoint', '先行者的实践经验表明，创新思维和系统方法是成功关键', 3),
    ('default', 'keyPoint', '面临的主要挑战包括认知偏差、资源限制和环境变化', 4),
    ('default', 'keyPoint', '未来发展将更加注重可持续性、整合性和价值创造', 5),
    ('default', 'introduction', '{topic}作为当下备受关注的话题，其重要性和影响力不断提升。本文将从多个角度对{topic}进行全面解析，包括其基本概念、发展现状、实践案例以及未来趋势，旨在为读者提供系统性的认识框架和实用的参考指南。', 0);
